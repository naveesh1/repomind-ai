import os
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException

from app.services.dependency_analyzer import get_reverse_dependencies
from app.services.impact_analyzer import analyze_change_impact, find_impacted_files
from app.services.ingestion import get_last_analyzed_repo_url, ingest_repository
from app.services.test_impact import compute_test_impact


def classify_risk_level(score: float | int) -> str:
    """
    Classifies a deterministic regression risk score (0-100) into a risk level.
    0-24: LOW
    25-49: MEDIUM
    50-74: HIGH
    75-100: CRITICAL
    """
    s = float(score)
    if s < 25:
        return "LOW"
    elif s < 50:
        return "MEDIUM"
    elif s < 75:
        return "HIGH"
    else:
        return "CRITICAL"


def calculate_risk_factors(
    repo_data: Dict[str, Any],
    changed_file: str,
    changed_function: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Extracts and calculates quantitative risk factors from repository structure,
    AST code quality metrics, dependency graph, and test impact analysis.
    """
    python_files = repo_data.get("python_files", [])
    dependency_graph = repo_data.get("dependency_graph", {})
    reverse_graph = get_reverse_dependencies(dependency_graph)

    from app.services.target_validator import validate_target_file_and_function
    target_file, changed_function = validate_target_file_and_function(repo_data, changed_file, changed_function)

    # 2. Impact Analysis
    impact_details = find_impacted_files(dependency_graph, reverse_graph, target_file)
    affected_files = impact_details.get("impacted_files", [target_file])
    impact_radius = len(affected_files)

    # 3. Test Impact Analysis
    repo_url = repo_data.get("repository_url", "")
    test_impact_data = compute_test_impact(repo_url, target_file, changed_function)

    direct_tests_count = test_impact_data.get("direct_tests", 0)
    indirect_tests_count = test_impact_data.get("indirect_tests", 0)
    possible_tests_count = test_impact_data.get("possible_tests", 0)
    high_confidence_count = test_impact_data.get("high_confidence_count", 0)
    affected_tests = test_impact_data.get("affected_tests", [])
    recommended_tests = test_impact_data.get("recommended_tests", [])

    # 4. AST Code Quality & Complexity metrics
    complex_functions_count = 0
    deep_nesting_count = 0
    large_files_count = 0
    affected_functions = []
    affected_classes = []

    target_complex_functions_count = 0
    target_max_complexity = 0
    target_max_nesting = 0
    target_file_lines = 0

    for pf in python_files:
        fp = pf.get("file", "").replace("\\", "/")
        lines = pf.get("lines", 0)
        max_comp = pf.get("max_complexity", 0)
        max_nest = pf.get("max_nesting_depth", 0)

        if lines > 200:
            large_files_count += 1
        if max_comp >= 5:
            complex_functions_count += 1
        if max_nest >= 3:
            deep_nesting_count += 1

        if fp == target_file:
            affected_functions.extend(pf.get("functions", []))
            affected_classes.extend(pf.get("classes", []))
            target_file_lines = lines
            target_max_complexity = max_comp
            target_max_nesting = max_nest
            if max_comp >= 5:
                target_complex_functions_count += 1

    # 5. Bottleneck / Central Module score (in-degree in reverse graph)
    in_degree = len(reverse_graph.get(target_file, []))
    central_bottleneck_score = min(10, in_degree)

    # 6. Test coverage indicator (ratio of test files to total source files)
    total_files = repo_data.get("total_files", len(python_files))
    test_files_count = test_impact_data.get("total_tests", 0)
    test_coverage_indicator = round(min(1.0, test_files_count / max(1, total_files)), 2)

    return {
        "target_file": target_file,
        "changed_function": changed_function or None,
        "changed_files_count": 1,
        "lines_added": 12,
        "lines_removed": 4,
        "affected_functions_count": len(affected_functions),
        "affected_classes_count": len(affected_classes),
        "affected_functions": affected_functions,
        "affected_classes": affected_classes,
        "impact_radius": impact_radius,
        "affected_files": affected_files,
        "direct_tests_count": direct_tests_count,
        "indirect_tests_count": indirect_tests_count,
        "possible_tests_count": possible_tests_count,
        "high_confidence_tests_count": high_confidence_count,
        "affected_tests": affected_tests,
        "recommended_tests": recommended_tests,
        "complex_functions_count": complex_functions_count,
        "large_files_count": large_files_count,
        "deep_nesting_count": deep_nesting_count,
        "target_complex_functions_count": target_complex_functions_count,
        "target_max_complexity": target_max_complexity,
        "target_max_nesting": target_max_nesting,
        "target_file_lines": target_file_lines,
        "central_bottleneck_score": central_bottleneck_score,
        "test_coverage_indicator": test_coverage_indicator,
        "in_degree": in_degree,
    }


def calculate_regression_risk(risk_factors: Dict[str, Any]) -> Tuple[int, str]:
    """
    Deterministically computes a 0-100 regression risk score based on quantitative risk factors.
    Uses normalized, progressive logarithmic scaling to prevent score saturation at 100
    for widely imported helper/typing modules without direct test coverage.

    Component allocation (100 pts total):
    1. Direct & High-Confidence Test Impact (Max 40 pts) - strongest risk factor
    2. Indirect & Transitive Test Impact (Max 15 pts) - diminishing returns
    3. Dependency Structure: Impact Radius & Centrality (Max 25 pts) - diminishing returns
    4. Target Code Complexity & Change Scope (Max 20 pts) - requires meaningful target complexity
    """
    import math

    impact_radius = max(1, risk_factors.get("impact_radius", 1))
    direct_tests = max(0, risk_factors.get("direct_tests_count", 0))
    indirect_tests = max(0, risk_factors.get("indirect_tests_count", 0))
    possible_tests = max(0, risk_factors.get("possible_tests_count", 0))
    high_confidence_tests = max(0, risk_factors.get("high_confidence_tests_count", 0))

    in_degree = max(0, risk_factors.get("in_degree", risk_factors.get("central_bottleneck_score", 0)))
    bottleneck_score = max(0, risk_factors.get("central_bottleneck_score", min(10, in_degree)))

    target_complex_funcs = risk_factors.get("target_complex_functions_count", 0)
    target_max_comp = risk_factors.get("target_max_complexity", 0)
    target_max_nest = risk_factors.get("target_max_nesting", 0)
    target_file_lines = risk_factors.get("target_file_lines", 0)

    affected_funcs_count = risk_factors.get("affected_functions_count", 0)
    affected_classes_count = risk_factors.get("affected_classes_count", 0)
    lines_added = risk_factors.get("lines_added", 0)
    lines_removed = risk_factors.get("lines_removed", 0)

    # 1. Direct & High-Confidence Test Impact (Max 40 pts) - Strongest factor
    direct_raw = direct_tests * 4.0 + high_confidence_tests * 2.0
    direct_pts = min(40.0, (math.log1p(direct_raw) / math.log1p(30.0)) * 40.0)

    # 2. Indirect & Transitive Test Impact (Max 15 pts) - Diminishing returns
    indirect_raw = indirect_tests * 0.5 + possible_tests * 0.1
    indirect_pts = min(15.0, (math.log1p(indirect_raw) / math.log1p(25.0)) * 15.0)

    # 3. Dependency Structure: Impact Radius & Centrality (Max 25 pts)
    radius_raw = max(0, impact_radius - 1)
    radius_pts = min(15.0, (math.log1p(radius_raw) / math.log1p(60.0)) * 15.0)

    coupling_raw = max(in_degree, bottleneck_score)
    coupling_pts = min(10.0, (math.log1p(coupling_raw) / math.log1p(20.0)) * 10.0)

    structure_pts = radius_pts + coupling_pts

    # 4. Target Code Complexity & Change Scope (Max 20 pts)
    # Only contributes points when target function/file has meaningful complexity (>1) or scope
    comp_raw = (
        target_complex_funcs * 3.0
        + max(0, target_max_comp - 1) * 1.0
        + max(0, target_max_nest - 1) * 1.5
        + (2.0 if target_file_lines > 200 else 0.0)
    )
    scope_raw = (
        max(0, affected_funcs_count - 1) * 1.0
        + affected_classes_count * 1.5
        + (lines_added + lines_removed) * 0.05
        + (2.0 if risk_factors.get("changed_function") else 0.0)
    )

    comp_scope_raw = comp_raw + scope_raw
    complexity_pts = min(20.0, (math.log1p(comp_scope_raw) / math.log1p(20.0)) * 20.0)

    total_score = direct_pts + indirect_pts + structure_pts + complexity_pts
    final_score = int(round(max(0.0, min(100.0, total_score))))
    level = classify_risk_level(final_score)

    return final_score, level


def generate_risk_recommendations(
    score: int,
    level: str,
    risk_factors: Dict[str, Any],
) -> List[str]:
    """
    Generates actionable risk mitigation recommendations based on the calculated risk level and factors.
    """
    recs = []

    if level in ["CRITICAL", "HIGH"]:
        recs.append("Execute all P0 (Direct) and P1 (Indirect) test suites prior to merging code changes.")
        recs.append("Perform mandatory peer code review focusing on ripple effects across dependent modules.")
    else:
        recs.append("Run targeted P0 unit tests for fast feedback before committing changes.")

    if risk_factors.get("impact_radius", 0) > 3:
        recs.append(f"High dependency impact radius ({risk_factors.get('impact_radius')} files). Verify downstream imports.")

    if risk_factors.get("central_bottleneck_score", 0) > 4:
        recs.append(f"Target module is depended on by {risk_factors.get('in_degree')} files. Ensure full backward compatibility.")

    if risk_factors.get("complex_functions_count", 0) > 0:
        recs.append(f"Refactor {risk_factors.get('complex_functions_count')} high-complexity functions to reduce cyclomatic risk.")

    recs.append("Monitor integration pipeline test execution logs for transient side-effects.")
    return recs


def get_regression_risk_for_repository(
    repository_url: Optional[str],
    changed_file: Optional[str] = None,
    changed_function: Optional[str] = None,
) -> Dict[str, Any]:
    """
    High-level entry point for calculating regression risk analysis for a repository.
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

    # Determine file to analyze
    target_file = changed_file.strip() if (changed_file and changed_file.strip()) else ""
    if not target_file:
        python_files = repo_data.get("python_files", [])
        if python_files:
            target_file = python_files[0].get("file", "main.py")
        else:
            target_file = "main.py"

    risk_factors = calculate_risk_factors(repo_data, target_file, changed_function)
    score, level = calculate_regression_risk(risk_factors)
    recommendations = generate_risk_recommendations(score, level, risk_factors)

    func_str = changed_function.strip() if (changed_function and changed_function.strip()) else None
    explanation = (
        f"Analyzed regression risk for '{target_file}'"
        + (f" (function: '{func_str}')" if func_str else "")
        + f". Score: {score}/100 ({level} risk level) based on impact radius of {risk_factors.get('impact_radius')} files "
        + f"and {len(risk_factors.get('affected_tests', []))} affected unit test files."
    )

    return {
        "status": "success",
        "repository_name": repo_data.get("repository_name", "repository"),
        "repository_url": repo_data.get("repository_url", ""),
        "target_file": risk_factors["target_file"],
        "changed_function": func_str,
        "score": score,
        "level": level,
        "risk_factors": risk_factors,
        "affected_files": risk_factors["affected_files"],
        "affected_functions": risk_factors["affected_functions"],
        "affected_classes": risk_factors["affected_classes"],
        "affected_tests": risk_factors["affected_tests"],
        "direct_tests": risk_factors["direct_tests_count"],
        "indirect_tests": risk_factors["indirect_tests_count"],
        "possible_tests": risk_factors["possible_tests_count"],
        "high_confidence_tests": risk_factors["high_confidence_tests_count"],
        "recommended_tests": risk_factors["recommended_tests"],
        "recommendations": recommendations,
        "explanation": explanation,
    }
