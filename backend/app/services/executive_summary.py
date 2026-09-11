from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException


from app.services.code_quality import compute_repository_code_quality
from app.services.ingestion import get_last_analyzed_repo_url, ingest_repository
from app.services.repository_health import calculate_repository_health


def compute_overall_grade(score: int) -> str:
    """
    Computes deterministic letter grade from overall score (0-100).
    A: 90-100
    B: 75-89
    C: 60-74
    D: 45-59
    F: 0-44
    """
    if score >= 90:
        return "A"
    elif score >= 75:
        return "B"
    elif score >= 60:
        return "C"
    elif score >= 45:
        return "D"
    else:
        return "F"


def generate_executive_narrative(
    repo_name: str,
    overall_score: int,
    overall_grade: str,
    health_score: int,
    quality_score: int,
    risk_level: str,
    total_files: int,
    source_files: int,
    test_files: int,
    total_functions: int,
    complex_functions: int,
    large_files: int,
    deeply_nested: int,
    high_impact_files_count: int,
) -> str:
    """
    Generates a clear deterministic executive summary narrative synthesizing architecture, code quality, and maintainability risks.
    """
    test_clause = (
        f"supported by {test_files} automated test file(s)"
        if test_files > 0
        else "lacking dedicated automated test files"
    )

    quality_desc = (
        f"{complex_functions} complex function(s) (>10 cyclomatic complexity), "
        f"{large_files} large source file(s) (>250 lines), and "
        f"{deeply_nested} deeply nested function(s) (>=4 nesting depth)"
    )

    return (
        f"RepoMind AI Executive Audit for '{repo_name}': Overall Repository Grade is '{overall_grade}' "
        f"with an overall index score of {overall_score}/100 ({risk_level} executive risk). "
        f"The codebase comprises {total_files} total file(s) ({source_files} source files, {test_clause}), "
        f"encompassing {total_functions} functions. "
        f"Repository Health score is {health_score}/100 and Code Quality score is {quality_score}/100. "
        f"Static AST analysis identified {quality_desc}. "
        f"Architectural dependency mapping identified {high_impact_files_count} central bottleneck file(s) with direct dependent module coupling. "
        f"Executive priority should focus on refactoring complex modules, decoupling central callers, and expanding test coverage."
    )


def generate_executive_summary_report(repo_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Synthesizes ingestion metrics, dependency graph statistics, repository health,
    and code quality analysis into a unified Executive Summary Audit Report.
    """
    repo_name = repo_data.get("repository_name", "Unknown Repository")
    repo_url = repo_data.get("repository_url", "")

    # 1. Compute Step 18 Health Metrics
    health_metrics = calculate_repository_health(repo_data)
    health_score = health_metrics.get("health_score", 100)
    health_level = health_metrics.get("health_level", "LOW")
    risk_indicators = health_metrics.get("risk_indicators", [])
    high_impact_files = health_metrics.get("high_impact_files", [])
    health_recommendations = health_metrics.get("recommendations", [])

    # 2. Compute Step 19 Quality Metrics
    quality_metrics = compute_repository_code_quality(repo_data)
    quality_score = quality_metrics.get("quality_score", 100)
    quality_level = quality_metrics.get("quality_level", "HIGH")
    quality_issues = quality_metrics.get("issues", [])
    quality_recommendations = quality_metrics.get("recommendations", [])

    total_files_analyzed = quality_metrics.get("total_files_analyzed", 0)
    total_functions = quality_metrics.get("total_functions", 0)
    complex_functions = quality_metrics.get("complex_functions", 0)
    large_files = quality_metrics.get("large_files", 0)
    deeply_nested_functions = quality_metrics.get("deeply_nested_functions", 0)

    # 3. Overall Score, Grade, and Risk Level Calculations
    overall_score = round((health_score + quality_score) / 2)
    overall_grade = compute_overall_grade(overall_score)

    if overall_score < 45 or health_level == "CRITICAL" or quality_level == "CRITICAL":
        risk_level = "CRITICAL"
    elif overall_score < 60 or health_level == "HIGH" or quality_level == "LOW":
        risk_level = "HIGH"
    elif overall_score < 75 or health_level == "MEDIUM" or quality_level == "MEDIUM":
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    # 4. Generate Narrative Summary
    summary_narrative = generate_executive_narrative(
        repo_name=repo_name,
        overall_score=overall_score,
        overall_grade=overall_grade,
        health_score=health_score,
        quality_score=quality_score,
        risk_level=risk_level,
        total_files=repo_data.get("total_files", 0),
        source_files=repo_data.get("source_files", 0),
        test_files=repo_data.get("test_files", 0),
        total_functions=total_functions,
        complex_functions=complex_functions,
        large_files=large_files,
        deeply_nested=deeply_nested_functions,
        high_impact_files_count=len(high_impact_files),
    )

    # 5. Consolidate Critical Audit Risks & Recommendations
    critical_risks = list(dict.fromkeys(risk_indicators + quality_issues))
    executive_recommendations = list(dict.fromkeys(health_recommendations + quality_recommendations))

    key_metrics = {
        "total_files": repo_data.get("total_files", 0),
        "source_files": repo_data.get("source_files", 0),
        "test_files": repo_data.get("test_files", 0),
        "directories": repo_data.get("directories", 0),
        "python_files": total_files_analyzed,
        "total_functions": total_functions,
        "total_classes": health_metrics.get("total_classes", 0),
        "total_imports": health_metrics.get("total_imports", 0),
        "dependency_connections": health_metrics.get("dependency_connections", 0),
        "complex_functions": complex_functions,
        "large_files": large_files,
        "deeply_nested_functions": deeply_nested_functions,
    }

    return {
        "status": "success",
        "repository_name": repo_name,
        "repository_url": repo_url,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "overall_grade": overall_grade,
        "overall_score": overall_score,
        "health_score": health_score,
        "quality_score": quality_score,
        "risk_level": risk_level,
        "summary_narrative": summary_narrative,
        "key_metrics": key_metrics,
        "critical_risks": critical_risks,
        "top_bottleneck_files": high_impact_files,
        "executive_recommendations": executive_recommendations,
    }


def get_executive_summary_for_url(repository_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Ingests repository data and returns a full Executive Summary Audit Report.
    Raises HTTP 400 if repository_url is missing or repository analysis has not been performed.
    """
    target_url = repository_url or get_last_analyzed_repo_url()
    if not target_url or not isinstance(target_url, str):
        raise HTTPException(
            status_code=400,
            detail="repository_url parameter is required. Please perform repository analysis first.",
        )

    repo_data = ingest_repository(target_url)
    return generate_executive_summary_report(repo_data)
