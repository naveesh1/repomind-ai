import os
import subprocess
import tempfile
from typing import Any, Dict, List, Optional
from fastapi import HTTPException

from app.services.change_detection import compare_ast_structures
from app.services.ingestion import get_last_analyzed_repo_url, parse_github_url


def analyze_commit_in_repo(
    repo_url: str, commit_revision: str, github_token: Optional[str] = None
) -> Dict[str, Any]:
    """
    Clones the repository using credential-safe git, verifies commit SHA,
    extracts commit metadata, changed files, and AST changes for Python files.
    """
    from app.services.secure_repository import run_secure_git_command

    if not commit_revision or not isinstance(commit_revision, str) or not commit_revision.strip():
        raise HTTPException(
            status_code=400,
            detail="commit_revision parameter is required.",
        )

    rev_clean = commit_revision.strip()
    normalized_url, repo_name = parse_github_url(repo_url)

    with tempfile.TemporaryDirectory(prefix="repomind_commit_") as temp_dir:
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

        # Verify commit SHA exists
        rev_parse_cmd = ["git", "rev-parse", "--verify", f"{rev_clean}^{{commit}}"]
        rev_res = subprocess.run(
            rev_parse_cmd,
            cwd=target_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="ignore",
        )
        if rev_res.returncode != 0:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid commit SHA or revision: '{rev_clean}' could not be resolved in the repository.",
            )

        full_commit_sha = rev_res.stdout.strip()

        # Find parent commit SHA
        parent_parse_cmd = ["git", "rev-parse", "--verify", f"{full_commit_sha}^"]
        parent_res = subprocess.run(
            parent_parse_cmd,
            cwd=target_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="ignore",
        )
        parent_sha = parent_res.stdout.strip() if parent_res.returncode == 0 else ""

        # Extract author, date, message metadata
        log_cmd = ["git", "log", "-1", "--format=%an <%ae>%n%aI%n%B", full_commit_sha]
        log_res = subprocess.run(
            log_cmd,
            cwd=target_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="ignore",
        )

        author = "Unknown Author"
        date = ""
        commit_message = ""

        if log_res.returncode == 0 and log_res.stdout.strip():
            lines = log_res.stdout.strip().splitlines()
            if len(lines) >= 1:
                author = lines[0].strip()
            if len(lines) >= 2:
                date = lines[1].strip()
            if len(lines) >= 3:
                commit_message = "\n".join(lines[2:]).strip()

        # Determine git diff command
        diff_base = parent_sha if parent_sha else "--root"

        if parent_sha:
            status_cmd = ["git", "diff", "--name-status", parent_sha, full_commit_sha]
            numstat_cmd = ["git", "diff", "--numstat", parent_sha, full_commit_sha]
        else:
            status_cmd = ["git", "diff-tree", "--no-commit-id", "--name-status", "-r", full_commit_sha]
            numstat_cmd = ["git", "diff-tree", "--no-commit-id", "--numstat", "-r", full_commit_sha]

        status_res = subprocess.run(
            status_cmd,
            cwd=target_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="ignore",
        )
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
                add_str, rem_str, fname = parts
                a_cnt = int(add_str) if add_str.isdigit() else 0
                r_cnt = int(rem_str) if rem_str.isdigit() else 0
                file_numstats[fname] = (a_cnt, r_cnt)

        added_files = []
        modified_files = []
        deleted_files = []
        renamed_files = []

        all_func_changes = []
        all_class_changes = []
        all_dep_changes = []

        total_lines_added = 0
        total_lines_removed = 0

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
            else:
                old_path = None
                filename = parts[1] if len(parts) > 1 else ""
                if code.startswith("A"):
                    change_type = "ADDED"
                elif code.startswith("D"):
                    change_type = "DELETED"
                else:
                    change_type = "MODIFIED"

            add_c, rem_c = file_numstats.get(filename, (0, 0))
            total_lines_added += add_c
            total_lines_removed += rem_c

            record = {
                "file": filename,
                "change_type": change_type,
                "old_path": old_path,
                "lines_added": add_c,
                "lines_removed": rem_c,
            }

            if change_type == "ADDED":
                added_files.append(record)
            elif change_type == "MODIFIED":
                modified_files.append(record)
            elif change_type == "DELETED":
                deleted_files.append(record)
            elif change_type == "RENAMED":
                renamed_files.append(record)

            # Python AST Comparison
            if filename.endswith(".py"):
                base_code = ""
                target_code = ""

                if change_type != "ADDED" and parent_sha:
                    show_base = ["git", "show", f"{parent_sha}:{old_path or filename}"]
                    b_res = subprocess.run(
                        show_base,
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
                    show_target = ["git", "show", f"{full_commit_sha}:{filename}"]
                    t_res = subprocess.run(
                        show_target,
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

        files_changed_count = (
            len(added_files) + len(modified_files) + len(deleted_files) + len(renamed_files)
        )

        return {
            "status": "success",
            "repository_name": repo_name,
            "repository_url": normalized_url,
            "commit_sha": full_commit_sha,
            "parent_sha": parent_sha,
            "commit_message": commit_message,
            "author": author,
            "date": date,
            "files_changed": files_changed_count,
            "lines_added": total_lines_added,
            "lines_removed": total_lines_removed,
            "added_files": added_files,
            "modified_files": modified_files,
            "deleted_files": deleted_files,
            "renamed_files": renamed_files,
            "function_changes": all_func_changes,
            "class_changes": all_class_changes,
            "dependency_changes": all_dep_changes,
        }


def get_commit_analysis_for_url(
    repository_url: Optional[str], commit_revision: str
) -> Dict[str, Any]:
    """
    Entry point for commit analysis API endpoint.
    Raises HTTP 400 if repository_url is missing or commit revision is invalid.
    """
    url = repository_url or get_last_analyzed_repo_url()
    if not url or not isinstance(url, str):
        raise HTTPException(
            status_code=400,
            detail="repository_url parameter is required. Please perform repository analysis first.",
        )

    if not commit_revision or not isinstance(commit_revision, str) or not commit_revision.strip():
        raise HTTPException(
            status_code=400,
            detail="commit parameter is required. Please enter a valid commit SHA or revision.",
        )

    return analyze_commit_in_repo(url, commit_revision)
