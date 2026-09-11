import ast
import os
import re
import subprocess
import tempfile
from typing import Any, Dict, List, Optional, Set, Tuple
from fastapi import HTTPException

from app.services.ingestion import get_last_analyzed_repo_url, ingest_repository, parse_github_url


def parse_ast_from_code(code_str: str) -> Dict[str, Any]:
    """Extracts functions, classes, and imports from a Python code string."""
    info = {"functions": set(), "classes": set(), "imports": set()}
    if not code_str:
        return info

    try:
        tree = ast.parse(code_str)
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                info["functions"].add(node.name)
            elif isinstance(node, ast.ClassDef):
                info["classes"].add(node.name)
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    info["imports"].add(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    info["imports"].add(node.module)
    except SyntaxError:
        pass

    return info


def compare_ast_structures(
    filename: str, base_code: str, target_code: str
) -> Tuple[List[Dict[str, str]], List[Dict[str, str]], List[Dict[str, str]]]:
    """Compares AST structures between base and target code versions."""
    base_info = parse_ast_from_code(base_code)
    target_info = parse_ast_from_code(target_code)

    func_changes = []
    class_changes = []
    dep_changes = []

    # 1. Functions
    added_funcs = target_info["functions"] - base_info["functions"]
    removed_funcs = base_info["functions"] - target_info["functions"]
    common_funcs = base_info["functions"] & target_info["functions"]

    for fn in sorted(added_funcs):
        func_changes.append({"file": filename, "function_name": fn, "change_type": "ADDED"})
    for fn in sorted(removed_funcs):
        func_changes.append({"file": filename, "function_name": fn, "change_type": "DELETED"})
    for fn in sorted(common_funcs):
        func_changes.append({"file": filename, "function_name": fn, "change_type": "MODIFIED"})

    # 2. Classes
    added_classes = target_info["classes"] - base_info["classes"]
    removed_classes = base_info["classes"] - target_info["classes"]
    common_classes = base_info["classes"] & target_info["classes"]

    for cls in sorted(added_classes):
        class_changes.append({"file": filename, "class_name": cls, "change_type": "ADDED"})
    for cls in sorted(removed_classes):
        class_changes.append({"file": filename, "class_name": cls, "change_type": "DELETED"})
    for cls in sorted(common_classes):
        class_changes.append({"file": filename, "class_name": cls, "change_type": "MODIFIED"})

    # 3. Imports / Dependencies
    added_imports = target_info["imports"] - base_info["imports"]
    removed_imports = base_info["imports"] - target_info["imports"]

    for imp in sorted(added_imports):
        dep_changes.append({"file": filename, "import_name": imp, "change_type": "ADDED"})
    for imp in sorted(removed_imports):
        dep_changes.append({"file": filename, "import_name": imp, "change_type": "DELETED"})

    return func_changes, class_changes, dep_changes


import functools


@functools.lru_cache(maxsize=32)
def compute_change_detection_from_repo(
    repo_url: str, base_revision: str, target_revision: str, github_token: Optional[str] = None
) -> Dict[str, Any]:
    """
    Clones repo credential-safely, checks revisions, runs git diff, and calculates AST changes.
    """
    from app.services.secure_repository import run_secure_git_command

    if not base_revision or not base_revision.strip():
        raise HTTPException(status_code=400, detail="base_revision parameter is required.")
    if not target_revision or not target_revision.strip():
        raise HTTPException(status_code=400, detail="target_revision parameter is required.")

    normalized_url, repo_name = parse_github_url(repo_url)

    with tempfile.TemporaryDirectory(prefix="repomind_diff_") as temp_dir:
        target_path = os.path.join(temp_dir, repo_name)

        # Clone repository safely with full commit history
        clone_cmd = [
            "clone",
            "--no-single-branch",
            normalized_url,
            target_path,
        ]

        try:
            clone_res = run_secure_git_command(clone_cmd, github_token=github_token, repo_url=normalized_url, timeout=90)
            if clone_res.returncode != 0:
                raise HTTPException(
                    status_code=400,
                    detail="Repository could not be accessed. The repository may not exist, be private, or be inaccessible.",
                )
        except subprocess.TimeoutExpired:
            raise HTTPException(
                status_code=408,
                detail="Cloning repository timed out. Repository might be too large.",
            )

        # Verify revisions exist in repository
        def verify_rev(rev: str):
            check_cmd = ["git", "rev-parse", "--verify", rev]
            res = subprocess.run(
                check_cmd,
                cwd=target_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="ignore",
            )
            return res.returncode == 0

        base_rev_clean = base_revision.strip()
        target_rev_clean = target_revision.strip()

        if not verify_rev(base_rev_clean):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid revision/commit: '{base_rev_clean}' could not be resolved in the repository.",
            )
        if not verify_rev(target_rev_clean):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid revision/commit: '{target_rev_clean}' could not be resolved in the repository.",
            )

        # Run git diff --name-status
        diff_status_cmd = ["git", "diff", "--name-status", base_rev_clean, target_rev_clean]
        status_res = subprocess.run(
            diff_status_cmd,
            cwd=target_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="ignore",
        )

        file_changes = []
        all_func_changes = []
        all_class_changes = []
        all_dep_changes = []

        total_lines_added = 0
        total_lines_removed = 0

        python_files_count = 0
        added_count = 0
        modified_count = 0
        deleted_count = 0
        renamed_count = 0

        # Run git diff --numstat for line additions/deletions per file
        numstat_cmd = ["git", "diff", "--numstat", base_rev_clean, target_rev_clean]
        numstat_res = subprocess.run(
            numstat_cmd,
            cwd=target_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="ignore",
        )
        file_numstats = {}
        for line in numstat_res.stdout.splitlines():
            parts = line.strip().split("\t")
            if len(parts) == 3:
                added_str, removed_str, filename = parts
                add_cnt = int(added_str) if added_str.isdigit() else 0
                rem_cnt = int(removed_str) if removed_str.isdigit() else 0
                file_numstats[filename] = (add_cnt, rem_cnt)

        # Parse name-status lines
        for line in status_res.stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            parts = line.split("\t")
            code = parts[0]

            if code.startswith("R") and len(parts) >= 3:
                change_type = "RENAMED"
                old_path = parts[1]
                filename = parts[2]
                renamed_count += 1
            else:
                old_path = None
                filename = parts[1] if len(parts) > 1 else ""
                if code.startswith("A"):
                    change_type = "ADDED"
                    added_count += 1
                elif code.startswith("D"):
                    change_type = "DELETED"
                    deleted_count += 1
                else:
                    change_type = "MODIFIED"
                    modified_count += 1

            add_c, rem_c = file_numstats.get(filename, (0, 0))
            total_lines_added += add_c
            total_lines_removed += rem_c

            file_changes.append(
                {
                    "file": filename,
                    "change_type": change_type,
                    "old_path": old_path,
                    "lines_added": add_c,
                    "lines_removed": rem_c,
                }
            )

            # Perform AST comparison for Python files
            if filename.endswith(".py"):
                python_files_count += 1

                base_code = ""
                target_code = ""

                if change_type != "ADDED":
                    fetch_base = ["git", "show", f"{base_rev_clean}:{old_path or filename}"]
                    b_res = subprocess.run(
                        fetch_base,
                        cwd=target_path,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True,
                        encoding="utf-8",
                        errors="ignore",
                    )
                    if b_res.returncode == 0:
                        base_code = b_res.stdout

                if change_type != "DELETED":
                    fetch_target = ["git", "show", f"{target_rev_clean}:{filename}"]
                    t_res = subprocess.run(
                        fetch_target,
                        cwd=target_path,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True,
                        encoding="utf-8",
                        errors="ignore",
                    )
                    if t_res.returncode == 0:
                        target_code = t_res.stdout


                f_ch, c_ch, d_ch = compare_ast_structures(filename, base_code, target_code)
                all_func_changes.extend(f_ch)
                all_class_changes.extend(c_ch)
                all_dep_changes.extend(d_ch)

        summary = {
            "total_files_changed": len(file_changes),
            "added_files_count": added_count,
            "modified_files_count": modified_count,
            "deleted_files_count": deleted_count,
            "renamed_files_count": renamed_count,
            "lines_added": total_lines_added,
            "lines_removed": total_lines_removed,
            "python_files_changed": python_files_count,
            "functions_changed": len(all_func_changes),
            "classes_changed": len(all_class_changes),
            "dependency_changes": len(all_dep_changes),
        }

        return {
            "status": "success",
            "repository_name": repo_name,
            "repository_url": normalized_url,
            "base_revision": base_rev_clean,
            "target_revision": target_rev_clean,
            "summary": summary,
            "file_changes": file_changes,
            "function_changes": all_func_changes,
            "class_changes": all_class_changes,
            "dependency_changes": all_dep_changes,
        }


def get_change_detection_for_url(
    repository_url: Optional[str], base_revision: str, target_revision: str, github_token: Optional[str] = None
) -> Dict[str, Any]:
    """
    Entry point for change detection API endpoint.
    Raises HTTP 400 if repository_url is missing or revisions are invalid.
    """
    url = repository_url or get_last_analyzed_repo_url()
    if not url or not isinstance(url, str):
        raise HTTPException(
            status_code=400,
            detail="repository_url parameter is required. Please perform repository analysis first.",
        )

    if not base_revision or not base_revision.strip():
        raise HTTPException(status_code=400, detail="base_revision parameter is required.")
    if not target_revision or not target_revision.strip():
        raise HTTPException(status_code=400, detail="target_revision parameter is required.")

    return compute_change_detection_from_repo(url, base_revision, target_revision, github_token=github_token)
