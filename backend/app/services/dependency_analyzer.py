from typing import Any, Dict, List, Optional


def build_dependency_graph(python_files: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    """
    Builds a dependency graph mapping each Python file path to the list of local Python
    file paths it imports/depends on based on AST-extracted import information.

    Args:
        python_files: List of dictionaries containing 'file', 'functions', 'classes', 'imports'.

    Returns:
        Dict[str, List[str]]: A dictionary mapping file paths to lists of imported file paths.
    """
    file_records = []
    for pf in python_files:
        file_path = pf.get("file", "")
        if not file_path:
            continue

        clean_fp = file_path.replace("\\", "/")
        no_ext = clean_fp[:-3] if clean_fp.endswith(".py") else clean_fp
        parts = [p for p in no_ext.split("/") if p]
        if parts and parts[-1] == "__init__":
            parts.pop()

        full_dot = ".".join(parts)
        file_records.append({
            "file_path": file_path,
            "clean_fp": clean_fp,
            "full_dot": full_dot,
            "parts": parts,
        })

    def resolve_import(source_record: Dict[str, Any], imp_str: str) -> Optional[str]:
        if not imp_str or not isinstance(imp_str, str):
            return None

        source_file = source_record["file_path"]

        # Count leading dots for relative imports
        lstripped = imp_str.lstrip(".")
        dot_count = len(imp_str) - len(lstripped)

        target_dots_to_try = []

        if dot_count > 0:
            # Relative import resolution
            source_parts = source_record["parts"][:-1]  # Directory parts of source file
            if len(source_parts) >= dot_count - 1:
                base_parts = source_parts[: len(source_parts) - (dot_count - 1)]
                if lstripped:
                    rel_dot = ".".join(base_parts + lstripped.split("."))
                else:
                    rel_dot = ".".join(base_parts)
                if rel_dot:
                    target_dots_to_try.append(rel_dot)
            if lstripped:
                target_dots_to_try.append(lstripped)
        else:
            target_dots_to_try.append(imp_str)

        for target_dot in target_dots_to_try:
            # 1. Check exact match with full dot path
            for rec in file_records:
                if rec["full_dot"] == target_dot and rec["file_path"] != source_file:
                    return rec["file_path"]

            # 2. Check suffix match (module ends with target_dot on dot boundary)
            matches = []
            for rec in file_records:
                if rec["file_path"] == source_file:
                    continue
                if rec["full_dot"].endswith("." + target_dot):
                    matches.append(rec)

            if matches:
                # Disambiguate multiple matches by shared directory prefix length with source file
                def score(rec: Dict[str, Any]) -> tuple:
                    sp1 = source_record["clean_fp"].split("/")
                    sp2 = rec["clean_fp"].split("/")
                    common = 0
                    for a, b in zip(sp1, sp2):
                        if a == b:
                            common += 1
                        else:
                            break
                    return (common, -len(rec["parts"]))

                matches.sort(key=score, reverse=True)
                return matches[0]["file_path"]

        return None

    dependency_graph: Dict[str, List[str]] = {}

    for pf in python_files:
        file_path = pf.get("file", "")
        if not file_path:
            continue

        source_record = next((r for r in file_records if r["file_path"] == file_path), None)
        if not source_record:
            dependency_graph[file_path] = []
            continue

        raw_imports = pf.get("imports", [])
        deps = set()
        for imp in raw_imports:
            resolved = resolve_import(source_record, imp)
            if resolved:
                deps.add(resolved)

        dependency_graph[file_path] = sorted(list(deps))

    return dependency_graph


def get_reverse_dependencies(dependency_graph: Dict[str, List[str]]) -> Dict[str, List[str]]:
    """
    Computes a reverse dependency graph from a forward dependency graph.
    Converts A -> B (A depends on B) to B -> A (B is depended on by A).

    Args:
        dependency_graph: Dict[str, List[str]] mapping file paths to their dependencies.

    Returns:
        Dict[str, List[str]]: Dict mapping file paths to list of files depending on them.
    """
    reverse_graph: Dict[str, List[str]] = {node: [] for node in dependency_graph}

    for source_file, dependencies in dependency_graph.items():
        if source_file not in reverse_graph:
            reverse_graph[source_file] = []
        for dep in dependencies:
            if dep not in reverse_graph:
                reverse_graph[dep] = []
            if source_file not in reverse_graph[dep]:
                reverse_graph[dep].append(source_file)

    for node in reverse_graph:
        reverse_graph[node] = sorted(reverse_graph[node])

    return reverse_graph
