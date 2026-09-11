from typing import Any, Dict, List, Optional
from fastapi import HTTPException

from app.services.impact_analyzer import analyze_change_impact
from app.services.ingestion import ingest_repository


def explain_code_change(
    repository_url: str,
    changed_file: str,
    changed_function: Optional[str] = None,
    proposed_change: Optional[str] = None,
    change_description: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generates a deterministic AI-powered explanation layer for a proposed code change,
    explaining blast radius, dependency relationships, risk rationale, and test strategies based on repository analysis data.
    """
    effective_description = proposed_change or change_description or "Proposed code modification"

    # 1. Ingest repository to obtain python_files and dependency_graph
    repo_data = ingest_repository(repository_url)

    # 2. Perform change impact analysis
    impact_analysis = analyze_change_impact(repo_data, changed_file, changed_function)

    matched_file = impact_analysis["changed_file"]
    matched_function = impact_analysis["changed_function"]
    risk_score = impact_analysis["risk_score"]
    risk_level = impact_analysis["risk_level"]
    impacted_files = impact_analysis["impacted_files"]
    direct_dependents = impact_analysis["direct_dependents"]
    transitive_dependents = impact_analysis["transitive_dependents"]

    target_desc = (
        f"function '{matched_function}' in '{matched_file}'"
        if matched_function
        else f"file '{matched_file}'"
    )

    # 3. Determine important files (prioritizing direct dependents and high-impact modules)
    important_files: List[str] = []
    for f in direct_dependents:
        if f not in important_files:
            important_files.append(f)
    for f in transitive_dependents:
        if f not in important_files and len(important_files) < 6:
            important_files.append(f)

    # 4. Identify recommended tests among impacted files
    recommended_tests = sorted(
        [
            f
            for f in impacted_files
            if any(keyword in f.lower() for keyword in ("test", "tests", "spec", "specs"))
        ]
    )

    # 5. Generate concise summary
    summary = (
        f"Change explanation for {target_desc}: {len(impacted_files)} total file(s) affected "
        f"with a {risk_level} risk level (score: {risk_score}/100)."
    )

    # 6. Generate risk explanation
    risk_explanation = (
        f"Modifying {target_desc} received a {risk_level} risk rating ({risk_score}/100). "
        f"This rating is driven by {len(direct_dependents)} direct dependent file(s), "
        f"{len(transitive_dependents)} transitive dependent file(s), and "
        f"{len(recommended_tests)} affected test suite file(s) within the repository dependency graph."
    )

    # 7. Generate direct dependency explanation
    if direct_dependents:
        sample_direct = ", ".join([f"'{f}'" for f in direct_dependents[:3]])
        suffix = f" and {len(direct_dependents) - 3} other file(s)" if len(direct_dependents) > 3 else ""
        direct_dependency_explanation = (
            f"The following direct callers rely on '{matched_file}': {sample_direct}{suffix}. "
            f"Any modification to signatures, parameters, or return values in {target_desc} "
            f"will directly impact these modules."
        )
    else:
        direct_dependency_explanation = (
            f"No direct dependent files import '{matched_file}'. The change is localized with no immediate upstream callers."
        )

    # 8. Generate transitive dependency explanation
    if transitive_dependents:
        sample_transitive = ", ".join([f"'{f}'" for f in transitive_dependents[:3]])
        suffix = f" and {len(transitive_dependents) - 3} other file(s)" if len(transitive_dependents) > 3 else ""
        transitive_dependency_explanation = (
            f"Downstream transitive dependents include: {sample_transitive}{suffix}. "
            f"These secondary modules call direct dependents of '{matched_file}', so errors could propagate indirectly during runtime."
        )
    else:
        transitive_dependency_explanation = (
            f"No transitive dependent files were detected in the downstream dependency graph."
        )

    # 9. Generate final developer recommendation
    if risk_level in ("CRITICAL", "HIGH"):
        recommendation = (
            f"Due to the {risk_level} risk score ({risk_score}/100), perform a thorough code review of all direct callers ({', '.join(direct_dependents[:2]) or matched_file}), "
            f"execute the {len(recommended_tests)} affected test file(s), and verify staging behavior before merging."
        )
    elif risk_level == "MEDIUM":
        recommendation = (
            f"Execute unit tests for '{matched_file}' and run the {len(recommended_tests)} affected test suite(s). "
            f"Verify caller compatibility in direct dependent files."
        )
    else:
        recommendation = (
            f"Localized impact ({risk_level} risk). Verify unit tests for '{matched_file}' and ensure function signatures remain backward compatible."
        )

    return {
        "status": "success",
        "summary": summary,
        "change_description": effective_description,
        "risk_explanation": risk_explanation,
        "important_files": important_files,
        "direct_dependency_explanation": direct_dependency_explanation,
        "transitive_dependency_explanation": transitive_dependency_explanation,
        "recommended_tests": recommended_tests,
        "recommendation": recommendation,
    }
