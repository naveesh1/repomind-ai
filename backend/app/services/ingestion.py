import ast
import os
import re
import stat
import subprocess
import tempfile
from typing import Any, Dict, Optional, Tuple
from fastapi import HTTPException

from app.services.dependency_analyzer import build_dependency_graph

# Source-code file extensions specified for RepoMind AI Step 11
SOURCE_EXTENSIONS = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".java",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".cs",
    ".go",
    ".rs",
    ".php",
}


def parse_github_url(url: str) -> Tuple[str, str]:
    """Validate that the URL belongs to github.com and matches expected repository format."""
    if not url or not isinstance(url, str):
        raise HTTPException(status_code=400, detail="repository_url is required")

    clean_url = url.strip()
    pattern = r"^https?://(?:www\.)?github\.com/([a-zA-Z0-9_.-]+)/([a-zA-Z0-9_.-]+?)(?:\.git)?/?$"
    match = re.match(pattern, clean_url)

    if not match:
        raise HTTPException(
            status_code=400,
            detail="Invalid GitHub repository URL format. Please provide a URL such as 'https://github.com/owner/repository'.",
        )

    owner, repo_name = match.groups()
    normalized_url = f"https://github.com/{owner}/{repo_name}"
    return normalized_url, repo_name


def analyze_python_file(filepath: str) -> Dict[str, Any]:
    """Extract functions, classes, imports, AST calls, line count, max complexity, and max nesting depth from a Python source file."""
    result = {
        "functions": [],
        "classes": [],
        "imports": [],
        "calls": [],
        "lines": 0,
        "max_complexity": 0,
        "max_nesting_depth": 0,
    }

    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as file:
            source = file.read()

        result["lines"] = len(source.splitlines())
        tree = ast.parse(source, filename=filepath)

        from app.services.code_quality import calculate_ast_complexity, calculate_ast_nesting_depth

        calls_set = set()

        for node in ast.walk(tree):

            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                result["functions"].append(node.name)
                comp = calculate_ast_complexity(node)
                nest = calculate_ast_nesting_depth(node, 0)
                if comp > result["max_complexity"]:
                    result["max_complexity"] = comp
                if nest > result["max_nesting_depth"]:
                    result["max_nesting_depth"] = nest

            elif isinstance(node, ast.ClassDef):
                result["classes"].append(node.name)

            elif isinstance(node, ast.Import):
                for alias in node.names:
                    result["imports"].append(alias.name)

            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    result["imports"].append(node.module)
                    for alias in node.names:
                        result["imports"].append(f"{node.module}.{alias.name}")

            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    calls_set.add(node.func.id)
                elif isinstance(node.func, ast.Attribute):
                    calls_set.add(node.func.attr)
                    if isinstance(node.func.value, ast.Name):
                        calls_set.add(f"{node.func.value.id}.{node.func.attr}")

            elif isinstance(node, ast.Name):
                calls_set.add(node.id)

        result["calls"] = sorted(list(calls_set))

    except (SyntaxError, OSError):
        pass

    return result

import functools

_LAST_ANALYZED_REPO_URL = None


def get_last_analyzed_repo_url() -> Optional[str]:
    return _LAST_ANALYZED_REPO_URL


def set_last_analyzed_repo_url(url: str):
    global _LAST_ANALYZED_REPO_URL
    _LAST_ANALYZED_REPO_URL = url


@functools.lru_cache(maxsize=16)
def _ingest_repository_cached(repo_url: str, github_token: Optional[str] = None) -> Dict[str, Any]:
    """Clones a GitHub repository temporarily (public or authenticated private), inspects structure, and calculates statistics."""
    from app.services.secure_repository import run_secure_git_command

    normalized_url, repo_name = parse_github_url(repo_url)

    # Use tempfile.TemporaryDirectory for temporary repository storage
    with tempfile.TemporaryDirectory(prefix="repomind_") as temp_dir:
        target_path = os.path.join(temp_dir, repo_name)

        cmd = [
            "clone",
            "--depth",
            "1",
            "--single-branch",
            normalized_url,
            target_path,
        ]
        try:
            result = run_secure_git_command(cmd, github_token=github_token, repo_url=normalized_url, timeout=60)

            if result.returncode != 0:
                raise HTTPException(
                    status_code=400,
                    detail="Repository could not be accessed. The repository may not exist, be private, or be inaccessible.",
                )
        except subprocess.TimeoutExpired:
            raise HTTPException(
                status_code=408,
                detail="Cloning repository timed out. Repository might be too large.",
            )

        # Resolve actual Git commit SHA of the analyzed repository HEAD
        commit_sha = ""
        try:
            rev_res = run_secure_git_command(["rev-parse", "HEAD"], cwd=target_path, github_token=github_token, repo_url=normalized_url)
            if rev_res.returncode == 0:
                commit_sha = rev_res.stdout.strip()
        except Exception:
            pass

        if not commit_sha:
            import hashlib
            commit_sha = hashlib.sha1(normalized_url.encode("utf-8")).hexdigest()

        total_files = 0
        source_files = 0
        test_files = 0
        directories = 0
        python_files = []

        # Recursively inspect the cloned repository
        for root, dirs, files in os.walk(target_path):
            # Ignore .git directory when calculating statistics
            if ".git" in dirs:
                dirs.remove(".git")

            directories += len(dirs)

            for file in files:
                total_files += 1
                filepath = os.path.join(root, file)
                rel_path = os.path.relpath(filepath, target_path).lower().replace("\\", "/")
                file_lower = file.lower()
                _, ext = os.path.splitext(file)

                if ext in SOURCE_EXTENSIONS:
                    source_files += 1

                if file_lower.startswith("test_") or file_lower.endswith("_test.py") or "test" in rel_path.split("/"):
                    test_files += 1

                if ext == ".py":
                    rel_orig = os.path.relpath(filepath, target_path).replace("\\", "/")
                    py_data = analyze_python_file(filepath)
                    py_data["file"] = rel_orig
                    python_files.append(py_data)

        # Python chmod permissions workaround for Windows read-only git objects
        for root_dir, dir_names, file_names in os.walk(temp_dir):
            for d in dir_names:
                try:
                    os.chmod(os.path.join(root_dir, d), stat.S_IWRITE)
                except Exception:
                    pass
            for f in file_names:
                try:
                    os.chmod(os.path.join(root_dir, f), stat.S_IWRITE)
                except Exception:
                    pass

        dependency_graph = build_dependency_graph(python_files)

        return {
            "status": "success",
            "repository_url": normalized_url,
            "repository_name": repo_name,
            "commit_sha": commit_sha,
            "total_files": total_files,
            "source_files": source_files,
            "test_files": test_files,
            "directories": directories,
            "python_files": python_files,
            "dependency_graph": dependency_graph,
        }


def ingest_repository(repo_url: str, github_token: Optional[str] = None) -> Dict[str, Any]:
    """Ingests repository and tracks last analyzed repository URL state."""
    normalized_url, _ = parse_github_url(repo_url)
    set_last_analyzed_repo_url(normalized_url)
    return _ingest_repository_cached(normalized_url, github_token)
