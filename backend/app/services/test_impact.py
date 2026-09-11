import os
from typing import Any, Dict, List, Optional
from fastapi import HTTPException

from app.services.dependency_analyzer import get_reverse_dependencies
from app.services.ingestion import get_last_analyzed_repo_url, ingest_repository


def is_test_file(path: str) -> bool:
    """
    Checks if a given file path represents a unit test file.
    Excludes pytest setup/fixture configuration files like conftest.py.
    """
    if not path or not isinstance(path, str):
        return False

    clean_path = path.replace("\\", "/").lower()
    fname = os.path.basename(clean_path)
    parts = [p for p in clean_path.split("/") if p]

    if fname in ("conftest.py", "__init__.py") or fname.startswith("conftest"):
        return False

    if fname.startswith("test_") or fname.endswith("_test.py"):
        return True
    if "test" in parts or "tests" in parts or "testing" in parts:
        if clean_path.endswith(".py"):
            return True

    return False


def find_dependency_path(
    start_file: str,
    target_file: str,
    graph: Dict[str, List[str]],
) -> Optional[List[str]]:
    """
    Finds the shortest dependency path from start_file (test) to target_file in dependency_graph.
    """
    if start_file == target_file:
        return [start_file]

    queue = [(start_file, [start_file])]
    visited = {start_file}

    while queue:
        curr, path = queue.pop(0)
        neighbors = graph.get(curr, [])
        for nbr in neighbors:
            clean_nbr = nbr.replace("\\", "/")
            if clean_nbr == target_file:
                return path + [target_file]
            if clean_nbr not in visited:
                visited.add(clean_nbr)
                queue.append((clean_nbr, path + [clean_nbr]))

    return None


def check_ast_reference(
    tf_calls: set,
    tf_imports: set,
    target_functions: set,
    target_classes: set,
    changed_function: Optional[str] = None,
) -> bool:
    """
    Checks if a test file's AST contains direct calls or constructor references to the changed function/class.
    Merely importing a module without AST call evidence is NOT treated as direct AST reference.
    """
    if changed_function and changed_function.strip():
        cf = changed_function.strip()
        if "." in cf:
            parts = cf.split(".")
            cls_name = parts[0]
            method_name = parts[-1]

            # Direct call / constructor matches for Class.method (e.g. Flask.__init__, Flask.__new__, Flask(...))
            if cls_name in tf_calls or cf in tf_calls:
                return True
            if f"{cls_name}.__init__" in tf_calls or f"{cls_name}.__new__" in tf_calls:
                return True
            for call in tf_calls:
                if call == cls_name or call.endswith("." + cls_name) or call == cf or call.endswith("." + cf):
                    return True
                if method_name != "__init__" and (call == method_name or call.endswith("." + method_name)):
                    return True
            return False
        else:
            if cf in tf_calls:
                return True
            for call in tf_calls:
                if call == cf or call.endswith("." + cf) or call.startswith(cf + "."):
                    return True
            return False
    else:
        for fn in target_functions:
            if fn in tf_calls or any(call.endswith("." + fn) for call in tf_calls):
                return True
        for cls in target_classes:
            if cls in tf_calls or any(call.endswith("." + cls) for call in tf_calls):
                return True
        return False


def compute_test_impact(
    repository_url: Optional[str],
    changed_file: str,
    changed_function: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Performs static dependency and AST analysis to determine which unit test files
    are affected (DIRECT, INDIRECT, POSSIBLE) by changes to changed_file/changed_function,
    calculating priority (P0-P3), confidence score (0-100), dependency paths, and summary metrics.
    """
    if not changed_file or not isinstance(changed_file, str) or not changed_file.strip():
        raise HTTPException(
            status_code=400,
            detail="changed_file parameter is required.",
        )

    clean_changed_file = changed_file.strip().replace("\\", "/")

    # Fetch analyzed repository data
    url = repository_url or get_last_analyzed_repo_url()
    if not url or not isinstance(url, str):
        raise HTTPException(
            status_code=400,
            detail="No repository has been analyzed. Please analyze a repository first.",
        )

    try:
        repo_data = ingest_repository(url)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Failed to retrieve analysis for the repository.",
        )

    if not repo_data:
        raise HTTPException(
            status_code=400,
            detail="No repository has been analyzed. Please analyze a repository first.",
        )

    from app.services.target_validator import validate_target_file_and_function
    target_file, func_str = validate_target_file_and_function(repo_data, changed_file, changed_function)

    python_files = repo_data.get("python_files", [])
    dependency_graph = repo_data.get("dependency_graph", {})

    file_map = {pf.get("file", "").replace("\\", "/"): pf for pf in python_files if pf.get("file")}

    all_file_paths = set(file_map.keys())
    for g_key in dependency_graph:
        all_file_paths.add(g_key.replace("\\", "/"))

    target_info = file_map.get(target_file, {})
    target_functions = set(target_info.get("functions", []))
    target_classes = set(target_info.get("classes", []))

    # Find all test files in the repository
    repo_test_files = sorted([fp for fp in all_file_paths if is_test_file(fp)])

    affected_tests = []
    direct_count = 0
    indirect_count = 0
    possible_count = 0
    unaffected_count = 0
    high_confidence_count = 0

    func_suffix = f" (target function: {func_str})" if func_str else ""

    for tf in repo_test_files:
        tf_info = file_map.get(tf, {})
        tf_calls = set(tf_info.get("calls", []))
        tf_imports = set(tf_info.get("imports", []))

        has_ast_ref = check_ast_reference(tf_calls, tf_imports, target_functions, target_classes, func_str)

        # 1. Target file is the test module itself
        if tf == target_file:
            impact_type = "DIRECT"
            priority = "P0"
            confidence = 100
            dep_path = [tf] + ([func_str] if func_str else [])
            reason = f"Target test module itself was modified{func_suffix}."
            direct_count += 1
            high_confidence_count += 1
            affected_tests.append({
                "test_file": tf,
                "impact_type": impact_type,
                "priority": priority,
                "confidence": confidence,
                "reason": reason,
                "dependency_path": dep_path,
            })
            continue

        # 2. Check dependency graph path from tf to target_file
        path = find_dependency_path(tf, target_file, dependency_graph)

        if has_ast_ref:
            # DIRECT impact: direct AST reference call/constructor evidence found
            impact_type = "DIRECT"
            priority = "P0"
            confidence = 95 if func_str else 90
            dep_path = (path if path else [tf, target_file]) + ([func_str] if func_str else [])
            reason = f"Direct AST call/constructor reference to '{func_str or target_file}'."
            direct_count += 1
            high_confidence_count += 1
            affected_tests.append({
                "test_file": tf,
                "impact_type": impact_type,
                "priority": priority,
                "confidence": confidence,
                "reason": reason,
                "dependency_path": dep_path,
            })
        elif path:
            # INDIRECT impact: valid dependency path exists, but no direct AST call evidence
            hops = len(path) - 1
            dep_path = path + ([func_str] if func_str else [])
            impact_type = "INDIRECT"
            confidence = 80 if hops == 1 else max(50, 75 - (hops - 2) * 10)
            priority = "P1"
            inter_info = f"via {path[1]}" if hops > 1 else "via direct module import"
            reason = f"Valid dependency path to {target_file} ({inter_info}), but no direct AST call evidence{func_suffix}."
            indirect_count += 1
            if confidence >= 70:
                high_confidence_count += 1

            affected_tests.append({
                "test_file": tf,
                "impact_type": impact_type,
                "priority": priority,
                "confidence": confidence,
                "reason": reason,
                "dependency_path": dep_path,
            })
        else:
            # Check meaningful module naming correlation for source files
            clean_target = target_file.replace("\\", "/").lower()
            target_parts = [p for p in clean_target.split("/") if p]
            t_base = os.path.basename(clean_target)
            t_stem, t_ext = os.path.splitext(t_base)

            # Check if target is a documentation file or non-source config file
            is_non_source = (
                any(p in ("docs", "doc", "documentation", "site", ".github", ".vscode") for p in target_parts)
                or t_ext in (".md", ".rst", ".txt", ".html", ".yml", ".yaml", ".json", ".ini", ".cfg", ".toml", ".sh")
                or t_base in ("conf.py", "setup.py", "tox.ini", "makefile", "dockerfile")
            )

            # Generic short stems that shouldn't trigger fallback name correlation
            generic_stems = {"conf", "doc", "docs", "test", "tests", "main", "index", "utils", "helper", "helpers", "base", "common", "core", "app"}

            name_correlated = False
            if not is_non_source and t_stem and len(t_stem) >= 3 and t_stem not in generic_stems:
                tf_base = os.path.basename(tf).lower()
                tf_stem, _ = os.path.splitext(tf_base)
                valid_test_names = {
                    f"test_{t_stem}.py",
                    f"{t_stem}_test.py",
                    f"test_{t_stem}_spec.py",
                }
                if tf_base in valid_test_names or tf_stem == f"test_{t_stem}" or tf_stem == f"{t_stem}_test":
                    name_correlated = True

            if name_correlated:
                impact_type = "POSSIBLE"
                confidence = 25
                priority = "P2"
                dep_path = [tf, "...", target_file] + ([func_str] if func_str else [])
                reason = f"Weak static evidence: related naming hierarchy pattern for {target_file}{func_suffix}."
                possible_count += 1
                affected_tests.append({
                    "test_file": tf,
                    "impact_type": impact_type,
                    "priority": priority,
                    "confidence": confidence,
                    "reason": reason,
                    "dependency_path": dep_path,
                })
            else:
                unaffected_count += 1

    # Order affected_tests by Priority (P0 -> P1 -> P2 -> P3), Confidence descending, test_file ascending
    prio_order = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}
    affected_tests.sort(key=lambda x: (prio_order.get(x["priority"], 4), -x["confidence"], x["test_file"]))

    recommended_tests = [t["test_file"] for t in affected_tests]

    return {
        "status": "success",
        "repository_name": repo_data.get("repository_name", "repository"),
        "repository_url": repo_data.get("repository_url", ""),
        "changed_file": target_file,
        "changed_function": func_str,
        "total_tests": len(repo_test_files),
        "direct_tests": direct_count,
        "indirect_tests": indirect_count,
        "possible_tests": possible_count,
        "unaffected_tests": unaffected_count,
        "recommended_count": len(recommended_tests),
        "high_confidence_count": high_confidence_count,
        "affected_tests": affected_tests,
        "recommended_tests": recommended_tests,
        "reason": f"Analyzed static dependency graph and AST references for {target_file}.",
    }
