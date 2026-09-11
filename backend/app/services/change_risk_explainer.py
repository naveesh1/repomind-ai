import os
from typing import Any, Dict, List, Optional
from fastapi import HTTPException

from app.services.ingestion import get_last_analyzed_repo_url, ingest_repository
from app.services.regression_risk import calculate_regression_risk, calculate_risk_factors, generate_risk_recommendations


def build_top_risk_factors(
    score: int,
    level: str,
    risk_factors: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Generates a deterministic list of structured risk factors with severity ratings and expandable details.
    """
    factors = []

    direct_tests = risk_factors.get("direct_tests_count", 0)
    indirect_tests = risk_factors.get("indirect_tests_count", 0)
    high_conf = risk_factors.get("high_confidence_tests_count", 0)
    impact_radius = risk_factors.get("impact_radius", 1)
    in_degree = risk_factors.get("in_degree", 0)
    target_comp = risk_factors.get("target_max_complexity", 0)
    target_complex_funcs = risk_factors.get("target_complex_functions_count", 0)

    # 1. Direct AST Test Evidence
    if direct_tests > 0:
        sev = "CRITICAL" if direct_tests >= 10 else "HIGH" if direct_tests >= 3 else "MEDIUM"
        factors.append({
            "id": "direct_test_impact",
            "title": "Direct AST Test Invocation Evidence",
            "severity": sev,
            "category": "Test Impact",
            "summary": f"{direct_tests} unit test(s) directly execute target AST symbols ({high_conf} high confidence).",
            "details": f"AST analysis identified {direct_tests} test file(s) with explicit function calls or constructor invocations pointing directly to this module. Any breaking signature or behavior change will immediately fail P0 unit test suites.",
        })
    else:
        factors.append({
            "id": "direct_test_impact",
            "title": "Zero Direct Unit Test Coverage",
            "severity": "MEDIUM",
            "category": "Test Coverage",
            "summary": "No direct unit tests explicitly execute this target component.",
            "details": "Static analysis detected 0 P0 unit tests calling this module directly. Risk relies primarily on indirect integration test paths.",
        })

    # 2. Dependency Impact Radius
    if impact_radius > 15:
        factors.append({
            "id": "dependency_radius",
            "title": "Extensive Dependency Impact Radius",
            "severity": "HIGH",
            "category": "Architecture",
            "summary": f"Modifications propagate downstream to {impact_radius} file(s) across the repository.",
            "details": f"Reverse dependency traversal traced {impact_radius} dependent files. Changes to exported contracts may introduce transitive ripple effects across downstream consumer modules.",
        })
    elif impact_radius > 3:
        factors.append({
            "id": "dependency_radius",
            "title": "Moderate Dependency Fan-Out",
            "severity": "MEDIUM",
            "category": "Architecture",
            "summary": f"Modifications impact {impact_radius} downstream file(s).",
            "details": f"Impact graph shows {impact_radius} files within the reverse dependency path.",
        })
    else:
        factors.append({
            "id": "dependency_radius",
            "title": "Isolated Change Radius",
            "severity": "LOW",
            "category": "Architecture",
            "summary": f"Change is isolated to {impact_radius} file(s).",
            "details": "Minimal downstream dependency fan-out detected.",
        })

    # 3. Dependency Coupling / Centrality
    if in_degree >= 5:
        factors.append({
            "id": "centrality_coupling",
            "title": "Central Bottleneck Component",
            "severity": "HIGH" if in_degree >= 10 else "MEDIUM",
            "category": "Coupling",
            "summary": f"Module is directly imported by {in_degree} distinct file(s).",
            "details": f"High in-degree centrality ({in_degree} direct reverse imports) makes this file a structural bottleneck.",
        })

    # 4. Code Complexity
    if target_comp >= 5 or target_complex_funcs > 0:
        factors.append({
            "id": "target_complexity",
            "title": "High Cyclomatic Complexity",
            "severity": "HIGH" if target_comp >= 10 else "MEDIUM",
            "category": "Code Quality",
            "summary": f"Target file contains {target_complex_funcs} complex function(s) (max complexity: {target_comp}).",
            "details": f"Cyclomatic complexity of {target_comp} increases decision path branching and testing effort required.",
        })

    # 5. Transitive Indirect Test Evidence
    if indirect_tests > 0:
        factors.append({
            "id": "indirect_test_impact",
            "title": "Transitive Integration Test Coverage",
            "severity": "MEDIUM" if indirect_tests >= 10 else "LOW",
            "category": "Test Impact",
            "summary": f"{indirect_tests} indirect test file(s) execute this module transitively.",
            "details": f"Dependency paths link {indirect_tests} P1/P2 integration tests to the target file.",
        })

    return factors


def get_change_risk_explanation_for_repository(
    repository_url: Optional[str],
    changed_file: Optional[str] = None,
    changed_function: Optional[str] = None,
    proposed_change: Optional[str] = None,
    change_description: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Intelligent Change Risk Explanation Service (Step 26).
    Combines Change Detection, AST Analysis, Dependency Graph, Test Impact (P0-P3),
    and Regression Risk into human-readable executive and technical risk explanations.
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

    from app.services.target_validator import validate_target_file_and_function
    target_file, changed_function = validate_target_file_and_function(repo_data, changed_file, changed_function)

    risk_factors = calculate_risk_factors(repo_data, target_file, changed_function)
    score, level = calculate_regression_risk(risk_factors)
    recommendations = generate_risk_recommendations(score, level, risk_factors)
    top_risk_factors = build_top_risk_factors(score, level, risk_factors)

    func_str = changed_function.strip() if (changed_function and changed_function.strip()) else None

    # Categorize tests by priority P0 -> P1 -> P2 -> P3
    affected_tests = risk_factors.get("affected_tests", [])
    p0_tests = [t["test_file"] for t in affected_tests if t.get("priority") == "P0"]
    p1_tests = [t["test_file"] for t in affected_tests if t.get("priority") == "P1"]
    p2_tests = [t["test_file"] for t in affected_tests if t.get("priority") == "P2"]
    p3_tests = [t["test_file"] for t in affected_tests if t.get("priority") == "P3"]

    # Executive Summary (Concise overview)
    exec_target = f"'{target_file}'" + (f" (function: '{func_str}')" if func_str else "")
    executive_summary = (
        f"Change Risk Evaluation for {exec_target} yields a score of {score}/100 ({level} risk level). "
        + (
            f"The change carries elevated risk primarily due to {risk_factors.get('direct_tests_count')} direct P0 unit test(s) and an impact radius of {risk_factors.get('impact_radius')} file(s)."
            if level in ["CRITICAL", "HIGH"]
            else f"The change presents manageable risk with {risk_factors.get('direct_tests_count')} direct test(s), {risk_factors.get('indirect_tests_count')} indirect test(s), and an impact radius of {risk_factors.get('impact_radius')} file(s)."
        )
    )

    # Technical Explanation (In-depth analysis of WHY the risk score is what it is)
    tech_lines = [
        f"1. Test Evidence: Identified {risk_factors.get('direct_tests_count')} direct (P0) test file(s) and {risk_factors.get('indirect_tests_count')} indirect (P1/P2) test file(s). Direct AST references carry the highest weight.",
        f"2. Architecture Impact: Reverse dependency traversal traced an impact radius of {risk_factors.get('impact_radius')} file(s) with an in-degree centrality score of {risk_factors.get('in_degree')}.",
        f"3. Code Complexity: Target file max complexity is {risk_factors.get('target_max_complexity')} with {risk_factors.get('target_complex_functions_count')} high-complexity function(s).",
    ]
    if proposed_change or change_description:
        desc = proposed_change or change_description
        tech_lines.append(f"4. Proposed Context: Evaluated proposed modification: '{desc[:100]}'.")

    technical_explanation = "\n".join(tech_lines)

    test_execution_order = [
        "P0: Direct Unit Tests — Immediate execution required prior to local commit",
        "P1: Indirect Integration Tests — Mandatory execution in CI pull request pipeline",
        "P2: Transitive Ripple Tests — Schedule in nightly / full integration suite",
        "P3: Regression Suite — Pre-release verification audit",
    ]

    return {
        "status": "success",
        "repository_name": repo_data.get("repository_name", "repository"),
        "repository_url": repo_data.get("repository_url", ""),
        "target_file": risk_factors["target_file"],
        "changed_function": func_str,
        "proposed_change": proposed_change or None,
        "change_description": change_description or None,
        "score": score,
        "level": level,
        "executive_summary": executive_summary,
        "risk_explanation": technical_explanation,
        "top_risk_factors": top_risk_factors,
        "affected_scope": {
            "impact_radius": risk_factors.get("impact_radius", 1),
            "affected_files": risk_factors.get("affected_files", []),
            "affected_functions": risk_factors.get("affected_functions", []),
            "affected_classes": risk_factors.get("affected_classes", []),
            "target_complex_functions_count": risk_factors.get("target_complex_functions_count", 0),
            "target_max_complexity": risk_factors.get("target_max_complexity", 0),
        },
        "test_impact_summary": {
            "direct_tests": risk_factors.get("direct_tests_count", 0),
            "indirect_tests": risk_factors.get("indirect_tests_count", 0),
            "possible_tests": risk_factors.get("possible_tests_count", 0),
            "high_confidence_tests": risk_factors.get("high_confidence_tests_count", 0),
            "total_affected_tests": len(affected_tests),
        },
        "test_execution_order": test_execution_order,
        "categorized_tests": {
            "p0_tests": p0_tests,
            "p1_tests": p1_tests,
            "p2_tests": p2_tests,
            "p3_tests": p3_tests,
        },
        "affected_tests": affected_tests,
        "recommended_tests": risk_factors.get("recommended_tests", []),
        "recommendations": recommendations,
    }
