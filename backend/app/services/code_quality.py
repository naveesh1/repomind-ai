import ast
import os
from typing import Any, Dict, List, Optional
from fastapi import HTTPException

from app.services.ingestion import get_last_analyzed_repo_url, ingest_repository

BLOCK_NODES = (
    ast.If,
    ast.For,
    ast.AsyncFor,
    ast.While,
    ast.Try,
    ast.With,
    ast.AsyncWith,
)


def calculate_ast_complexity(fn_node: ast.AST) -> int:
    """
    Computes deterministic cyclomatic complexity for an AST function node.
    Base complexity is 1.
    Increments for control-flow branching constructs:
    - If, For, AsyncFor, While, ExceptHandler, With, AsyncWith, Assert, IfExp
    - BoolOp (And, Or): +1 for each extra condition in boolean expressions
    - Comprehensions with if filters
    """
    complexity = 1
    for node in ast.walk(fn_node):
        if isinstance(
            node,
            (
                ast.If,
                ast.For,
                ast.AsyncFor,
                ast.While,
                ast.ExceptHandler,
                ast.With,
                ast.AsyncWith,
                ast.IfExp,
                ast.Assert,
            ),
        ):
            complexity += 1
        elif isinstance(node, ast.BoolOp):
            complexity += max(0, len(node.values) - 1)
        elif isinstance(node, ast.comprehension):
            complexity += 1 + len(node.ifs)
    return complexity


def calculate_ast_nesting_depth(node: ast.AST, current_depth: int = 0) -> int:
    """
    Calculates maximum control-flow nesting depth inside a function AST node.
    """
    max_d = current_depth
    for child in ast.iter_child_nodes(node):
        if isinstance(child, BLOCK_NODES):
            child_depth = calculate_ast_nesting_depth(child, current_depth + 1)
        else:
            child_depth = calculate_ast_nesting_depth(child, current_depth)
        if child_depth > max_d:
            max_d = child_depth
    return max_d


def analyze_file_code_quality(filepath: str, rel_path: str) -> Dict[str, Any]:
    """
    Performs deterministic static AST analysis on a single Python source file.
    Returns file metrics including lines, functions, classes, max complexity, and max nesting depth.
    """
    lines = 0
    functions_count = 0
    classes_count = 0
    max_complexity = 0
    max_nesting_depth = 0

    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            source = f.read()

        lines = len(source.splitlines())
        tree = ast.parse(source, filename=filepath)

        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                classes_count += 1
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                functions_count += 1
                comp = calculate_ast_complexity(node)
                nest = calculate_ast_nesting_depth(node, 0)

                if comp > max_complexity:
                    max_complexity = comp
                if nest > max_nesting_depth:
                    max_nesting_depth = nest
    except (SyntaxError, OSError):
        pass

    # File quality level classification
    if max_complexity > 15 or max_nesting_depth >= 5 or lines > 500:
        quality_level = "CRITICAL"
    elif max_complexity > 10 or max_nesting_depth >= 4 or lines > 250:
        quality_level = "LOW"
    elif max_complexity > 6 or max_nesting_depth >= 3 or lines > 120:
        quality_level = "MEDIUM"
    else:
        quality_level = "HIGH"

    return {
        "file": rel_path,
        "lines": lines,
        "functions": functions_count,
        "classes": classes_count,
        "max_complexity": max_complexity,
        "max_nesting_depth": max_nesting_depth,
        "quality_level": quality_level,
    }


def compute_repository_code_quality(repo_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculates deterministic repository code quality metrics, per-file metrics,
    issues, overall quality score (0-100), quality level, and recommendations.
    """
    python_files = repo_data.get("python_files", [])
    file_metrics: List[Dict[str, Any]] = []

    total_files_analyzed = len(python_files)
    total_functions = 0
    complex_functions = 0
    large_files = 0
    deeply_nested_functions = 0

    for pf in python_files:
        lines = pf.get("lines", 0)
        funcs = len(pf.get("functions", []))
        classes = len(pf.get("classes", []))
        max_comp = pf.get("max_complexity", 0)
        max_nest = pf.get("max_nesting_depth", 0)
        rel_file = pf.get("file", "")

        if max_comp > 10:
            complex_functions += 1
        if lines > 250:
            large_files += 1
        if max_nest >= 4:
            deeply_nested_functions += 1

        total_functions += funcs

        if max_comp > 15 or max_nest >= 5 or lines > 500:
            file_level = "CRITICAL"
        elif max_comp > 10 or max_nest >= 4 or lines > 250:
            file_level = "LOW"
        elif max_comp > 6 or max_nest >= 3 or lines > 120:
            file_level = "MEDIUM"
        else:
            file_level = "HIGH"

        file_metrics.append({
            "file": rel_file,
            "lines": lines,
            "functions": funcs,
            "classes": classes,
            "max_complexity": max_comp,
            "max_nesting_depth": max_nest,
            "quality_level": file_level,
        })

    # Sort file metrics by max_complexity descending, then lines descending
    file_metrics.sort(key=lambda x: (x["max_complexity"], x["lines"]), reverse=True)

    # Deterministic 0-100 Quality Score Rules:
    # Base score = 100
    # Deductions:
    # - Complex functions (>10 complexity): -10 points each (max 35)
    # - Large files (>250 lines): -10 points each (max 25)
    # - Deeply nested functions (>=4 nesting depth): -10 points each (max 25)
    score = 100
    score -= min(35, complex_functions * 10)
    score -= min(25, large_files * 10)
    score -= min(25, deeply_nested_functions * 10)

    quality_score = max(0, min(100, score))

    if quality_score >= 75:
        quality_level = "HIGH"
    elif quality_score >= 50:
        quality_level = "MEDIUM"
    elif quality_score >= 25:
        quality_level = "LOW"
    else:
        quality_level = "CRITICAL"

    issues: List[str] = []
    recommendations: List[str] = []

    if complex_functions > 0:
        issues.append(
            f"Detected {complex_functions} complex function(s) with cyclomatic complexity exceeding threshold (>10)."
        )
        recommendations.append(
            "Refactor complex functions by breaking them down into smaller single-responsibility helper functions."
        )

    if large_files > 0:
        issues.append(
            f"Detected {large_files} large Python file(s) exceeding 250 source lines."
        )
        recommendations.append(
            "Split large source files into modular packages and smaller sub-modules."
        )

    if deeply_nested_functions > 0:
        issues.append(
            f"Detected {deeply_nested_functions} function(s) with excessive control-flow nesting (>=4 levels)."
        )
        recommendations.append(
            "Reduce nesting depth by using early returns, guard clauses, and helper functions."
        )

    if not issues:
        issues.append(
            "Codebase maintains clean structure, low cyclomatic complexity, and shallow control-flow nesting."
        )
        recommendations.append(
            "Maintain clean function modularity, low complexity boundaries, and comprehensive unit tests."
        )

    return {
        "status": "success",
        "quality_score": quality_score,
        "quality_level": quality_level,
        "total_files_analyzed": total_files_analyzed,
        "total_functions": total_functions,
        "complex_functions": complex_functions,
        "large_files": large_files,
        "deeply_nested_functions": deeply_nested_functions,
        "issues": issues,
        "file_metrics": file_metrics,
        "recommendations": recommendations,
    }


def get_code_quality_for_url(repository_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Ingests repository data and computes static code quality and complexity metrics.
    Raises HTTP 400 if repository_url is missing or repository analysis has not been performed.
    """
    target_url = repository_url or get_last_analyzed_repo_url()
    if not target_url or not isinstance(target_url, str):
        raise HTTPException(
            status_code=400,
            detail="repository_url parameter is required. Please perform repository analysis first.",
        )

    repo_data = ingest_repository(target_url)
    return compute_repository_code_quality(repo_data)
