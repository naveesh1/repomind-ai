from typing import Dict, Any, Optional, List
from fastapi import HTTPException

from app.services.ingestion import ingest_repository, get_last_analyzed_repo_url
from app.services.regression_risk import (
    calculate_risk_factors,
    calculate_regression_risk,
    generate_risk_recommendations,
)
from app.services.target_validator import validate_target_file_and_function


def get_change_decision_for_repository(
    repository_url: Optional[str],
    changed_file: Optional[str] = None,
    changed_function: Optional[str] = None,
    proposed_change: Optional[str] = None,
    change_description: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Step 27: Intelligent Change Decision & Action Plan synthesis engine.

    Aggregates results from Steps 11–26 into a final merge decision (READY, READY WITH CAUTION,
    REVIEW REQUIRED, BLOCKED), merge readiness indicator (READY, NOT READY), decision confidence score,
    blockers, warnings, required engineering actions, and ordered test execution roadmap.
    """
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

    # 1. Validate target file and function using target_validator
    target_file, func_str = validate_target_file_and_function(
        repo_data, changed_file, changed_function
    )

    # 2. Extract quantitative risk factors and compute regression risk score & level
    risk_factors = calculate_risk_factors(repo_data, target_file, func_str)
    score, level = calculate_regression_risk(risk_factors)
    recommendations = generate_risk_recommendations(score, level, risk_factors)

    direct_count = risk_factors.get("direct_tests_count", 0)
    indirect_count = risk_factors.get("indirect_tests_count", 0)
    possible_count = risk_factors.get("possible_tests_count", 0)
    high_conf_count = risk_factors.get("high_confidence_tests_count", 0)
    radius = risk_factors.get("impact_radius", 1)
    target_max_comp = risk_factors.get("target_max_complexity", 0)
    in_deg = risk_factors.get("in_degree", 0)

    # 3. Evaluate Blockers
    blockers: List[str] = []
    if level == "CRITICAL" and direct_count == 0:
        blockers.append(
            f"Target module '{target_file}' is CRITICAL risk (score: {score}/100) but has 0 direct P0 unit tests. Direct test coverage is required prior to merge."
        )
    if target_max_comp >= 10 and high_conf_count == 0:
        blockers.append(
            f"Target file has high cyclomatic complexity ({target_max_comp}) with zero high-confidence test verification."
        )
    if radius >= 25 and direct_count == 0:
        blockers.append(
            f"Wide architectural impact radius ({radius} files) without direct test verification."
        )

    # 4. Evaluate Warnings
    warnings: List[str] = []
    if radius > 5:
        warnings.append(
            f"Broad dependency impact radius: modification affects {radius} dependent modules."
        )
    if indirect_count > 10:
        warnings.append(
            f"High transitive test coverage footprint: {indirect_count} indirect integration test suites affected."
        )
    if in_deg > 5:
        warnings.append(
            f"High-centrality module: depended on directly by {in_deg} upstream files."
        )
    if risk_factors.get("target_complex_functions_count", 0) > 0:
        warnings.append(
            f"Target file contains {risk_factors.get('target_complex_functions_count')} high-complexity function(s)."
        )

    # 5. Determine Decision, Merge Readiness, and Confidence Score
    if blockers:
        decision = "BLOCKED"
        merge_readiness = "NOT READY"
        confidence_score = 95
    elif score >= 75:
        decision = "REVIEW REQUIRED"
        merge_readiness = "NOT READY"
        confidence_score = 90
    elif score >= 50:
        decision = "REVIEW REQUIRED"
        merge_readiness = "NOT READY"
        confidence_score = 85
    elif score >= 25:
        decision = "READY WITH CAUTION"
        merge_readiness = "READY"
        confidence_score = 88
    else:
        decision = "READY"
        merge_readiness = "READY"
        confidence_score = 95

    # 6. Formulate Decision Explanation
    target_desc = f"'{target_file}'" + (f" (function: '{func_str}')" if func_str else "")
    if decision == "BLOCKED":
        decision_explanation = (
            f"Proposed modification to {target_desc} is BLOCKED from merging. "
            f"{len(blockers)} critical blocker(s) identified. Immediate engineering action required to establish test coverage or refactor target code."
        )
    elif decision == "REVIEW REQUIRED":
        decision_explanation = (
            f"Proposed modification to {target_desc} requires MANDATORY REVIEW before merging (Risk Score: {score}/100 {level}). "
            f"Impact radius of {radius} file(s) and {direct_count + indirect_count} affected test suite(s) require peer validation."
        )
    elif decision == "READY WITH CAUTION":
        decision_explanation = (
            f"Proposed modification to {target_desc} is READY WITH CAUTION (Risk Score: {score}/100 {level}). "
            f"Proceed with merge after verifying P0 unit tests and P1 integration test suites."
        )
    else:
        decision_explanation = (
            f"Proposed modification to {target_desc} is READY for immediate merge (Risk Score: {score}/100 {level}). "
            f"Low risk classification with validated static test coverage."
        )

    # 7. Formulate Required Actions (Ordered by priority)
    required_actions = []
    if direct_count > 0:
        required_actions.append({
            "priority": "P0",
            "action": "Execute Direct P0 Unit Tests",
            "description": f"Run {direct_count} direct unit test suite(s) locally for fast feedback prior to commit.",
        })
    else:
        required_actions.append({
            "priority": "P0",
            "action": "Add Direct Unit Test Coverage",
            "description": f"Create dedicated P0 unit tests for '{target_file}' to catch potential regression bugs.",
        })

    if indirect_count > 0:
        required_actions.append({
            "priority": "P1",
            "action": "Run CI Integration Pipeline",
            "description": f"Execute {indirect_count} indirect (P1) integration test suite(s) in pull request pipeline.",
        })

    if level in ["CRITICAL", "HIGH"] or blockers:
        required_actions.append({
            "priority": "P1",
            "action": "Mandatory Peer Code Review",
            "description": f"Assign architectural reviewer to verify ripple effects across {radius} impacted file(s).",
        })

    required_actions.append({
        "priority": "P2",
        "action": "Schedule Transitive & Release Verification",
        "description": "Include transitive ripple test suites in nightly release validation pipeline.",
    })

    # 8. Categorize Affected Tests by Priority (P0 -> P1 -> P2 -> P3)
    affected_tests = risk_factors.get("affected_tests", [])
    p0_tests = [t["test_file"] for t in affected_tests if t.get("priority") == "P0"]
    p1_tests = [t["test_file"] for t in affected_tests if t.get("priority") == "P1"]
    p2_tests = [t["test_file"] for t in affected_tests if t.get("priority") == "P2"]
    p3_tests = [t["test_file"] for t in affected_tests if t.get("priority") == "P3"]

    recommended_tests_ordered = p0_tests + p1_tests + p2_tests + p3_tests
    if not recommended_tests_ordered:
        recommended_tests_ordered = risk_factors.get("recommended_tests", [])

    return {
        "status": "success",
        "repository_name": repo_data.get("repository_name", "repository"),
        "repository_url": repo_data.get("repository_url", ""),
        "target_file": target_file,
        "changed_function": func_str,
        "proposed_change": proposed_change or None,
        "change_description": change_description or None,
        "score": score,
        "level": level,
        "decision": decision,
        "merge_readiness": merge_readiness,
        "confidence_score": confidence_score,
        "decision_explanation": decision_explanation,
        "blockers": blockers,
        "warnings": warnings,
        "required_actions": required_actions,
        "recommended_tests": recommended_tests_ordered,
        "categorized_tests": {
            "p0_tests": p0_tests,
            "p1_tests": p1_tests,
            "p2_tests": p2_tests,
            "p3_tests": p3_tests,
        },
        "affected_scope": {
            "impact_radius": radius,
            "affected_files": risk_factors.get("affected_files", []),
            "affected_functions": risk_factors.get("affected_functions", []),
            "affected_classes": risk_factors.get("affected_classes", []),
            "target_complex_functions_count": risk_factors.get("target_complex_functions_count", 0),
            "target_max_complexity": risk_factors.get("target_max_complexity", 0),
        },
        "test_impact_summary": {
            "direct_tests": direct_count,
            "indirect_tests": indirect_count,
            "possible_tests": possible_count,
            "high_confidence_tests": high_conf_count,
            "total_affected_tests": len(affected_tests),
        },
        "recommendations": recommendations,
    }
