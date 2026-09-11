from typing import Dict, Any, Optional, Tuple
from fastapi import HTTPException


def validate_target_file_and_function(
    repo_data: Dict[str, Any],
    changed_file: Optional[str],
    changed_function: Optional[str] = None,
) -> Tuple[str, Optional[str]]:
    """
    Validates that the supplied target file and optional function exist in the analyzed repository.

    Rules:
    1. If changed_file is supplied (non-empty string):
       - Must match an analyzed file path in the repository (exact match or path-suffix match).
       - If no match exists, raises HTTP 400: "Target file '{changed_file}' was not found in the analyzed repository."
       - NEVER silently falls back to docs/conf.py or any default file.
    2. If changed_file is omitted or empty string:
       - Uses the first available python file in repo_data as default.
    3. If changed_function is supplied (non-empty string):
       - Must exist in the validated target file's functions or classes.
       - If not found, raises HTTP 400: "Target function '{changed_function}' was not found in '{target_file}'."
       - NEVER silently falls back to another function or ignores the invalid function name.
    """
    python_files = repo_data.get("python_files", [])
    dependency_graph = repo_data.get("dependency_graph", {})

    file_map = {
        pf.get("file", "").replace("\\", "/"): pf
        for pf in python_files
        if pf.get("file")
    }

    all_file_paths = set(file_map.keys())
    for g_key in dependency_graph:
        all_file_paths.add(g_key.replace("\\", "/"))

    raw_file = (changed_file or "").strip()
    raw_func = (changed_function or "").strip()

    if raw_file:
        clean_target = raw_file.replace("\\", "/")
        matching_file = None

        # 1. Exact match
        if clean_target in all_file_paths:
            matching_file = clean_target
        else:
            # 2. Path suffix match (ensuring path boundary match)
            for fp in all_file_paths:
                clean_fp = fp.replace("\\", "/")
                if clean_fp == clean_target or clean_fp.endswith("/" + clean_target):
                    matching_file = fp
                    break

        if not matching_file:
            raise HTTPException(
                status_code=400,
                detail=f"Target file '{raw_file}' was not found in the analyzed repository.",
            )
        target_file = matching_file
    else:
        if python_files:
            target_file = python_files[0].get("file", "main.py")
        else:
            target_file = "main.py"

    # Function validation
    func_str = raw_func if raw_func else None
    if func_str:
        target_info = file_map.get(target_file, {})
        file_funcs = target_info.get("functions", [])
        file_classes = target_info.get("classes", [])

        # Check exact or case-insensitive match
        func_exists = False
        if func_str in file_funcs or func_str in file_classes:
            func_exists = True
        elif any(f.lower() == func_str.lower() for f in file_funcs) or any(c.lower() == func_str.lower() for c in file_classes):
            func_exists = True
        elif "." in func_str:
            cls_part, method_part = func_str.split(".", 1)
            cls_matched = (
                cls_part in file_classes
                or any(c.lower() == cls_part.lower() for c in file_classes)
            )
            method_matched = (
                method_part in file_funcs
                or any(f.lower() == method_part.lower() for f in file_funcs)
                or any(f.endswith("." + method_part) for f in file_funcs)
                or any(f.endswith("." + func_str) for f in file_funcs)
            )
            if (cls_matched and method_matched) or func_str in file_funcs or func_str in file_classes:
                func_exists = True

        if not func_exists:
            raise HTTPException(
                status_code=400,
                detail=f"Target function '{func_str}' was not found in '{target_file}'.",
            )

    return target_file, func_str
