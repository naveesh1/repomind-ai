from typing import Any, Dict, List, Optional
from fastapi import HTTPException

from app.services.dependency_analyzer import get_reverse_dependencies


def find_impacted_files(
    dependency_graph: Dict[str, List[str]],
    reverse_graph: Dict[str, List[str]],
    target_file: str,
) -> Dict[str, List[str]]:
    """
    Identifies direct dependents, transitive dependents, forward dependencies,
    and total impacted files for a given target_file.
    """
    direct_dependents = sorted(list(reverse_graph.get(target_file, [])))

    # Transitive dependents via BFS starting from direct_dependents
    visited = set(direct_dependents)
    visited.add(target_file)
    queue = list(direct_dependents)
    transitive_dependents = []

    while queue:
        curr = queue.pop(0)
        parents = reverse_graph.get(curr, [])
        for parent in parents:
            if parent not in visited:
                visited.add(parent)
                transitive_dependents.append(parent)
                queue.append(parent)

    transitive_dependents = sorted(transitive_dependents)
    forward_dependencies = sorted(list(dependency_graph.get(target_file, [])))

    # Total impacted files includes changed file, direct dependents, transitive dependents, and forward dependencies
    impacted_set = set([target_file] + direct_dependents + transitive_dependents + forward_dependencies)
    impacted_files = sorted(list(impacted_set))

    return {
        "direct_dependents": direct_dependents,
        "transitive_dependents": transitive_dependents,
        "forward_dependencies": forward_dependencies,
        "impacted_files": impacted_files,
    }


def calculate_risk_score(
    impacted_files: List[str],
    direct_dependents: List[str],
    transitive_dependents: List[str],
    forward_dependencies: List[str],
    python_files_count: int,
    changed_function: Optional[str] = None,
) -> int:
    """
    Computes a deterministic risk score between 0 and 100 based on graph impact breadth,
    dependency centrality, test file involvement, and function targeting.
    """
    # 1. Base modification score
    score = 10

    # 2. Direct dependents weight (up to 35 pts)
    score += min(35, len(direct_dependents) * 7)

    # 3. Transitive dependents weight (up to 25 pts)
    score += min(25, len(transitive_dependents) * 4)

    # 4. Total impacted files breadth weight (up to 20 pts)
    score += min(20, max(0, len(impacted_files) - 1) * 2)

    # 5. Forward dependencies weight (up to 10 pts)
    score += min(10, len(forward_dependencies) * 2)

    # 6. Test files affected bonus (up to 10 pts)
    test_count = sum(
        1 for f in impacted_files if any(kw in f.lower() for kw in ("test", "spec"))
    )
    score += min(10, test_count * 3)

    # 7. Central file check bonus (10 pts)
    if len(direct_dependents) >= 5 or (
        python_files_count > 0 and (len(direct_dependents) / python_files_count) > 0.15
    ):
        score += 10

    # 8. Targeted function modification adjustment
    if changed_function:
        score += 5

    return min(100, max(0, score))


def determine_risk_level(risk_score: int) -> str:
    """
    Categorizes risk score into LOW, MEDIUM, HIGH, or CRITICAL.
    """
    if risk_score >= 75:
        return "CRITICAL"
    if risk_score >= 50:
        return "HIGH"
    if risk_score >= 25:
        return "MEDIUM"
    return "LOW"


def generate_risk_reason(
    risk_level: str,
    risk_score: int,
    changed_file: str,
    changed_function: Optional[str],
    direct_dependents: List[str],
    transitive_dependents: List[str],
    impacted_files: List[str],
) -> str:
    """
    Generates a human-readable explanation of why the change received its risk level.
    """
    target_desc = (
        f"function '{changed_function}' in '{changed_file}'"
        if changed_function
        else f"file '{changed_file}'"
    )

    direct_count = len(direct_dependents)
    transitive_count = len(transitive_dependents)
    total_count = len(impacted_files)

    if risk_level == "CRITICAL":
        return (
            f"CRITICAL risk (Score {risk_score}/100): Modifying {target_desc} creates a widespread regression blast radius, "
            f"affecting {direct_count} direct dependents and {transitive_count} transitive dependents across {total_count} total repository files."
        )
    elif risk_level == "HIGH":
        return (
            f"HIGH risk (Score {risk_score}/100): Modifying {target_desc} impacts {direct_count} direct dependents and "
            f"{transitive_count} transitive dependents, affecting core modules in the repository."
        )
    elif risk_level == "MEDIUM":
        return (
            f"MEDIUM risk (Score {risk_score}/100): Modifying {target_desc} has moderate impact, affecting {total_count} files "
            f"including {direct_count} direct dependent(s)."
        )
    else:
        return (
            f"LOW risk (Score {risk_score}/100): Modifying {target_desc} has localized impact with {direct_count} direct dependent(s) "
            f"and minimal ripple effects across the codebase."
        )


def analyze_change_impact(
    repo_data: Dict[str, Any],
    changed_file: str,
    changed_function: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Main change impact analysis handler. Analyzes impact for a changed file and optional function.
    """
    python_files = repo_data.get("python_files", [])
    dependency_graph = repo_data.get("dependency_graph", {})
    reverse_graph = get_reverse_dependencies(dependency_graph)

    from app.services.target_validator import validate_target_file_and_function
    matched_file_path, changed_function = validate_target_file_and_function(repo_data, changed_file, changed_function)

    impact_details = find_impacted_files(dependency_graph, reverse_graph, matched_file_path)

    direct_dependents = impact_details["direct_dependents"]
    transitive_dependents = impact_details["transitive_dependents"]
    forward_dependencies = impact_details["forward_dependencies"]
    impacted_files = impact_details["impacted_files"]

    risk_score = calculate_risk_score(
        impacted_files=impacted_files,
        direct_dependents=direct_dependents,
        transitive_dependents=transitive_dependents,
        forward_dependencies=forward_dependencies,
        python_files_count=len(python_files),
        changed_function=changed_function,
    )

    risk_level = determine_risk_level(risk_score)

    reason = generate_risk_reason(
        risk_level=risk_level,
        risk_score=risk_score,
        changed_file=matched_file_path,
        changed_function=changed_function,
        direct_dependents=direct_dependents,
        transitive_dependents=transitive_dependents,
        impacted_files=impacted_files,
    )

    return {
        "status": "success",
        "changed_file": matched_file_path,
        "changed_function": changed_function,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "impacted_files": impacted_files,
        "impacted_file_count": len(impacted_files),
        "direct_dependents": direct_dependents,
        "transitive_dependents": transitive_dependents,
        "reason": reason,
    }
