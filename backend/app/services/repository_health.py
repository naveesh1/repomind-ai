from typing import Any, Dict, List, Optional
from fastapi import HTTPException

from app.services.dependency_analyzer import get_reverse_dependencies
from app.services.ingestion import get_last_analyzed_repo_url, ingest_repository


def calculate_repository_health(repo_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Computes deterministic repository health metrics, high-impact files, risk indicators,
    health score, health level, and actionable recommendations based on repository analysis data.
    """
    repository_name = repo_data.get("repository_name", "Unknown Repository")
    total_files = repo_data.get("total_files", 0)
    source_files = repo_data.get("source_files", 0)
    test_files = repo_data.get("test_files", 0)
    directories = repo_data.get("directories", 0)
    python_files = repo_data.get("python_files", [])
    dependency_graph = repo_data.get("dependency_graph", {})

    python_files_count = len(python_files)
    total_functions = sum(len(f.get("functions", [])) for f in python_files)
    total_classes = sum(len(f.get("classes", [])) for f in python_files)
    total_imports = sum(len(f.get("imports", [])) for f in python_files)
    dependency_connections = sum(len(deps) for deps in dependency_graph.values())

    reverse_graph = get_reverse_dependencies(dependency_graph)

    # Identify high-impact files based on caller counts
    file_impact_records = []
    for pf in python_files:
        filepath = pf.get("file", "")
        callers = reverse_graph.get(filepath, [])
        imports = dependency_graph.get(filepath, [])
        file_impact_records.append({
            "file": filepath,
            "direct_dependents": len(callers),
            "imports": len(imports),
        })

    # Sort high-impact files by direct dependents descending, then imports descending
    file_impact_records.sort(key=lambda x: (x["direct_dependents"], x["imports"]), reverse=True)
    high_impact_files = [
        f for f in file_impact_records if f["direct_dependents"] > 0 or f["imports"] > 0
    ][:8]

    # Deterministic Risk Indicators & Health Score Calculation
    score = 100
    risk_indicators: List[str] = []
    recommendations: List[str] = []

    # 1. Test ratio check
    test_ratio = test_files / max(1, source_files)
    if test_files == 0:
        risk_indicators.append("No automated test files detected in repository file structure.")
        recommendations.append("Establish a dedicated test suite directory and add unit tests for core modules.")
        score -= 25
    elif test_ratio < 0.15:
        risk_indicators.append(f"Low test-to-source file ratio ({test_ratio:.1%}).")
        recommendations.append("Increase automated test coverage across high-impact source files.")
        score -= 15

    # 2. Central caller bottleneck check
    max_callers = max([len(callers) for callers in reverse_graph.values()], default=0)
    if max_callers >= 5:
        risk_indicators.append(f"High caller centralization: single module has {max_callers} direct dependent files.")
        recommendations.append("Decouple core central modules to reduce regression blast radius.")
        score -= 20
    elif max_callers >= 3:
        risk_indicators.append(f"Moderate caller centralization: central module has {max_callers} direct dependents.")
        score -= 10

    # 3. Inter-module coupling check
    avg_connections = dependency_connections / max(1, python_files_count)
    if python_files_count > 0 and avg_connections > 2.0:
        risk_indicators.append(f"High inter-module dependency coupling ({dependency_connections} connection edges).")
        recommendations.append("Refactor module imports and abstract shared helper utilities.")
        score -= 15

    # 4. Function complexity density check
    avg_funcs = total_functions / max(1, python_files_count)
    if avg_funcs > 8.0:
        risk_indicators.append(f"High function density per file ({avg_funcs:.1f} functions per Python file).")
        recommendations.append("Split large Python source files into focused sub-modules.")
        score -= 10

    if not risk_indicators:
        risk_indicators.append("Well-structured repository with balanced dependencies and localized impact.")
        recommendations.append("Maintain clean modular interfaces and keep unit tests updated.")

    health_score = max(0, min(100, score))

    if health_score >= 75:
        health_level = "HIGH"
    elif health_score >= 50:
        health_level = "MEDIUM"
    elif health_score >= 25:
        health_level = "LOW"
    else:
        health_level = "CRITICAL"

    return {
        "status": "success",
        "repository_name": repository_name,
        "total_files": total_files,
        "source_files": source_files,
        "test_files": test_files,
        "directories": directories,
        "python_files": python_files_count,
        "total_functions": total_functions,
        "total_classes": total_classes,
        "total_imports": total_imports,
        "dependency_connections": dependency_connections,
        "health_score": health_score,
        "health_level": health_level,
        "risk_indicators": risk_indicators,
        "high_impact_files": high_impact_files,
        "recommendations": recommendations,
    }


def get_repository_health_for_url(repository_url: str) -> Dict[str, Any]:
    """
    Ingests repository data and returns repository health metrics.
    Raises HTTP 400 if repository_url is missing or invalid.
    """
    if not repository_url or not isinstance(repository_url, str):
        raise HTTPException(
            status_code=400,
            detail="repository_url parameter is required. Please perform repository analysis first.",
        )

    repo_data = ingest_repository(repository_url)
    return calculate_repository_health(repo_data)


