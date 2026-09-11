from typing import Any, Dict, List, Optional
from fastapi import HTTPException

from app.services.impact_analyzer import analyze_change_impact
from app.services.ingestion import ingest_repository


def generate_review_recommendations(
    risk_level: str,
    risk_score: int,
    changed_file: str,
    changed_function: Optional[str],
    direct_dependents: List[str],
    transitive_dependents: List[str],
    impacted_files: List[str],
    affected_tests: List[str],
) -> List[str]:
    """
    Generates deterministic review recommendations for developers based on change impact metrics.
    """
    recommendations: List[str] = []

    if risk_level == "CRITICAL":
        recommendations.append(
            f"CRITICAL risk score ({risk_score}/100) detected: Senior engineer manual code review is mandatory before merging."
        )
    elif risk_level == "HIGH":
        recommendations.append(
            f"HIGH risk level ({risk_score}/100): Conduct thorough peer review and staging deployment verification."
        )

    if len(impacted_files) >= 5:
        recommendations.append(
            f"Broad blast radius ({len(impacted_files)} files impacted): Execute a broader regression test suite across dependent packages."
        )

    if len(direct_dependents) > 0:
        recommendations.append(
            f"Direct dependents identified ({len(direct_dependents)} modules): Review caller files and verify signature compatibility."
        )

    if len(affected_tests) > 0:
        recommendations.append(
            f"Affected test suite found ({len(affected_tests)} test files): Execute the affected unit and integration tests."
        )

    if changed_function:
        recommendations.append(
            f"Function-level change targeting '{changed_function}': Review all direct call sites of this function across the codebase."
        )

    if len(direct_dependents) >= 5 or len(impacted_files) >= 10:
        recommendations.append(
            f"Core source file modified: Ensure backward compatibility and run full end-to-end integration tests."
        )

    if not recommendations:
        recommendations.append(
            f"Localized change in '{changed_file}': Run standard unit test suite for the modified file."
        )

    return recommendations


def generate_simulation_summary(
    risk_level: str,
    risk_score: int,
    changed_file: str,
    changed_function: Optional[str],
    change_description: Optional[str],
    direct_dependents: List[str],
    transitive_dependents: List[str],
    impacted_files: List[str],
    affected_tests: List[str],
) -> str:
    """
    Generates a concise deterministic narrative summary of the simulated code change.
    """
    target_desc = (
        f"'{changed_function}' in {changed_file}"
        if changed_function
        else f"{changed_file}"
    )

    desc_clause = f" (Description: '{change_description}')" if change_description else ""

    test_desc = (
        f"{len(affected_tests)} test file(s)"
        if affected_tests
        else "no affected test files"
    )

    return (
        f"Changing {target_desc}{desc_clause} has a {risk_level} risk (score {risk_score}/100) "
        f"because {len(impacted_files)} repository file(s) are potentially impacted, "
        f"including {len(direct_dependents)} direct dependent(s), {len(transitive_dependents)} transitive dependent(s), "
        f"and {test_desc}."
    )


def simulate_code_change(
    repository_url: str,
    changed_file: str,
    changed_function: Optional[str] = None,
    change_description: Optional[str] = None,
    proposed_change: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Simulates a proposed code change and generates a complete impact & risk report without modifying the repository.
    Reuses ingestion and change impact analysis services.
    """
    effective_description = proposed_change or change_description

    # 1. Ingest repository to get AST & dependency graph data
    repo_data = ingest_repository(repository_url)

    # 2. Analyze change impact using Step 14 impact analyzer logic
    impact_analysis = analyze_change_impact(repo_data, changed_file, changed_function)

    matched_file = impact_analysis["changed_file"]
    matched_function = impact_analysis["changed_function"]
    risk_score = impact_analysis["risk_score"]
    risk_level = impact_analysis["risk_level"]
    impacted_files = impact_analysis["impacted_files"]
    direct_dependents = impact_analysis["direct_dependents"]
    transitive_dependents = impact_analysis["transitive_dependents"]

    # 3. Identify test files among impacted files
    affected_tests = sorted(
        [
            f
            for f in impacted_files
            if any(keyword in f.lower() for keyword in ("test", "tests", "spec", "specs"))
        ]
    )

    # 4. Generate deterministic review recommendations
    recommendations = generate_review_recommendations(
        risk_level=risk_level,
        risk_score=risk_score,
        changed_file=matched_file,
        changed_function=matched_function,
        direct_dependents=direct_dependents,
        transitive_dependents=transitive_dependents,
        impacted_files=impacted_files,
        affected_tests=affected_tests,
    )

    # 5. Generate deterministic narrative summary
    summary = generate_simulation_summary(
        risk_level=risk_level,
        risk_score=risk_score,
        changed_file=matched_file,
        changed_function=matched_function,
        change_description=effective_description,
        direct_dependents=direct_dependents,
        transitive_dependents=transitive_dependents,
        impacted_files=impacted_files,
        affected_tests=affected_tests,
    )

    # 6. Return structured response
    return {
        "status": "success",
        "changed_file": matched_file,
        "changed_function": matched_function,
        "change_description": effective_description or None,
        "proposed_change": proposed_change or effective_description or None,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "impacted_file_count": len(impacted_files),
        "impacted_files": impacted_files,
        "direct_dependents": direct_dependents,
        "transitive_dependents": transitive_dependents,
        "affected_tests": affected_tests,
        "review_recommendations": recommendations,
        "summary": summary,
        "reason": summary,
    }

