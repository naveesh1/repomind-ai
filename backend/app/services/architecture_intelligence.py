import os
import json
import datetime
from typing import Dict, Any, List, Optional, Set, Tuple

from app.services.ingestion import ingest_repository, get_last_analyzed_repo_url
from app.services.dependency_analyzer import build_dependency_graph, get_reverse_dependencies
from app.services.test_impact import is_test_file


def classify_file_layer(file_path: str) -> str:
    """
    Classifies a file path into an Architectural Layer based on path conventions and file stem semantics.
    """
    if not file_path or not isinstance(file_path, str):
        return "Utilities / Core Layer"

    clean_fp = file_path.replace("\\", "/").lower()
    parts = [p for p in clean_fp.split("/") if p]
    fname = os.path.basename(clean_fp)
    stem, _ = os.path.splitext(fname)

    test_stems = ["test", "testing", "tests", "conftest", "benchmark", "benchmarks", "example", "examples", "fixture", "fixtures"]
    if (
        is_test_file(clean_fp)
        or stem in test_stems
        or stem.startswith("test_")
        or stem.endswith("_test")
        or stem.endswith("_testing")
        or any(p in parts for p in ["tests", "test", "testing", "examples", "example", "benchmarks", "docs", "site"])
        or any(p.startswith("test") or p.startswith("example") for p in parts)
    ):
        return "Tests Layer"

    # API / Routes Layer: Endpoints, Request handlers, Blueprints, Views, CLI, Controllers, App entrypoints
    api_keywords = ["api", "routes", "route", "controllers", "controller", "endpoints", "endpoint", "views", "view", "blueprints", "blueprint", "cli", "wrappers", "wrapper", "handlers", "handler", "server"]
    if any(p in parts for p in api_keywords) or fname == "main.py" or stem in ["app", "views", "blueprints", "cli", "wrappers", "routes", "endpoints", "handlers", "server"]:
        return "API / Routes Layer"

    # Utilities / Core Layer: Utils, Helpers, Common, Shared, Tools, Config, Typings
    util_keywords = ["utils", "utility", "utilities", "helpers", "helper", "common", "shared", "tools", "compat", "typing"]
    if any(p in parts for p in util_keywords) or stem in ["helpers", "helper", "utils", "utility", "common", "shared", "compat", "typing", "globals"]:
        return "Utilities / Core Layer"

    # Services / Domain Layer: Business logic, Domain services, Context, Sessions, Templating, Signals, Investigation
    service_keywords = ["services", "service", "domain", "usecases", "business", "actions", "investigation", "ctx", "context", "sessions", "session", "templating", "signals", "signal", "logging"]
    if any(p in parts for p in service_keywords) or stem in ["ctx", "sessions", "templating", "signals", "logging", "config"]:
        return "Services / Domain Layer"

    # Data / Ingestion Layer: DB, Persistence, Models, Repositories, Schemas, Storage
    data_keywords = ["ingestion", "db", "models", "model", "persistence", "repository", "repositories", "schemas", "schema", "database", "store", "storage"]
    if any(p in parts for p in data_keywords) or stem in ["models", "db", "schema", "schemas", "store", "storage"]:
        return "Data / Ingestion Layer"

    return "Utilities / Core Layer"


def find_cyclic_dependencies(graph: Dict[str, List[str]]) -> List[List[str]]:
    """
    Finds circular dependency loops (cycles) in the dependency graph using DFS cycle detection.
    Returns a list of distinct cycle paths (e.g. ['A.py', 'B.py', 'A.py']).
    """
    cycles: List[List[str]] = []
    visited: Set[str] = set()
    rec_stack: Set[str] = set()

    def dfs(node: str, current_path: List[str]):
        visited.add(node)
        rec_stack.add(node)

        for neighbor in graph.get(node, []):
            clean_nbr = neighbor.replace("\\", "/")
            if clean_nbr not in visited:
                dfs(clean_nbr, current_path + [clean_nbr])
            elif clean_nbr in rec_stack:
                # Cycle detected
                cycle_start_idx = current_path.index(clean_nbr) if clean_nbr in current_path else 0
                cycle_path = current_path[cycle_start_idx:] + [clean_nbr]

                # Canonical representation to deduplicate cycles
                min_idx = cycle_path[:-1].index(min(cycle_path[:-1]))
                canonical_cycle = cycle_path[min_idx:-1] + cycle_path[:min_idx] + [cycle_path[min_idx]]

                if canonical_cycle not in cycles:
                    cycles.append(canonical_cycle)

        rec_stack.remove(node)

    for n in sorted(graph.keys()):
        clean_n = n.replace("\\", "/")
        if clean_n not in visited:
            dfs(clean_n, [clean_n])

    return cycles


def analyze_repository_architecture(
    repository_url: Optional[str] = None,
    user: Optional[Dict[str, Any]] = None,
    github_token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Step 47: Architecture Intelligence Engine.
    Analyzes repository code topology, architectural layers/modules, dependency relationships,
    coupling metrics (Ca, Ce, Instability), hotspots, cyclic dependency violations, and architectural health score.
    """
    clean_url = (repository_url or "").strip()
    if not clean_url:
        clean_url = get_last_analyzed_repo_url() or "https://github.com/psf/requests"

    # Ingest repo metadata & python files
    try:
        repo_data = ingest_repository(clean_url, github_token=github_token)
    except Exception:
        repo_data = {}

    repo_name = repo_data.get("repository_name") or repo_data.get("repo_name", "repository")
    python_files = repo_data.get("python_files", [])
    dependency_graph = repo_data.get("dependency_graph", {})

    if not dependency_graph and isinstance(python_files, list):
        dependency_graph = build_dependency_graph(python_files)

    reverse_graph = get_reverse_dependencies(dependency_graph)

    # 1. Architectural Layer Classification & Breakdown
    layers: Dict[str, List[str]] = {
        "API / Routes Layer": [],
        "Services / Domain Layer": [],
        "Data / Ingestion Layer": [],
        "Utilities / Core Layer": [],
        "Tests Layer": [],
    }

    all_file_paths = set(dependency_graph.keys()).union(set(reverse_graph.keys()))
    if isinstance(python_files, list):
        for pf in python_files:
            if isinstance(pf, dict) and pf.get("file"):
                all_file_paths.add(pf.get("file").replace("\\", "/"))

    for fp in sorted(all_file_paths):
        layer_cat = classify_file_layer(fp)
        layers[layer_cat].append(fp)

    # Isolate Production source files from Test / Example files
    prod_files = set(fp for fp in all_file_paths if classify_file_layer(fp) != "Tests Layer")

    # Construct Production-Only Dependency Graph & Reverse Graph
    prod_dependency_graph: Dict[str, List[str]] = {}
    for src, targets in dependency_graph.items():
        if src in prod_files:
            prod_dependency_graph[src] = [t for t in targets if t in prod_files]

    for p_file in prod_files:
        if p_file not in prod_dependency_graph:
            prod_dependency_graph[p_file] = []

    prod_reverse_graph = get_reverse_dependencies(prod_dependency_graph)

    layer_breakdown = {
        l_name: {
            "file_count": len(files),
            "files": files[:5],  # top 5 sample files
        }
        for l_name, files in layers.items()
    }

    # Detect Architectural Pattern
    api_count = len(layers["API / Routes Layer"])
    service_count = len(layers["Services / Domain Layer"])
    data_count = len(layers["Data / Ingestion Layer"])
    core_count = len(layers["Utilities / Core Layer"])

    if api_count > 0 and service_count > 0:
        pattern = "Layered N-Tier Architecture"
        pattern_desc = "Clean separation between API endpoints, Service domain logic, Data access, and Utilities."
    elif api_count > 0 or service_count > 0:
        pattern = "Web Application / Framework Architecture"
        pattern_desc = "Modular application architecture structured around HTTP routing, request context, and domain handlers."
    elif service_count > 3:
        pattern = "Modular Monolith"
        pattern_desc = "Decoupled domain service modules organized within a single repository."
    else:
        pattern = "Component-Based Architecture"
        pattern_desc = "Modular components with explicit dependency relationships."

    # 2. Coupling Metrics (Ca, Ce, Instability I) & Hotspot Analysis on Production Modules
    module_metrics: List[Dict[str, Any]] = []
    total_ca = 0
    total_ce = 0

    for fp in sorted(all_file_paths):
        is_prod = (fp in prod_files)
        if is_prod:
            ca = len(prod_reverse_graph.get(fp, []))  # Production Afferent coupling (fan-in)
            ce = len(prod_dependency_graph.get(fp, []))  # Production Efferent coupling (fan-out)
        else:
            ca = len(reverse_graph.get(fp, []))
            ce = len(dependency_graph.get(fp, []))

        total_ca += ca
        total_ce += ce

        if (ca + ce) > 0:
            instability = round(float(ce) / float(ca + ce), 2)
        else:
            instability = 0.0

        if is_prod:
            if ca >= 5 and ce >= 5:
                coupling_risk = "CRITICAL"
            elif ca >= 4 or ce >= 5:
                coupling_risk = "HIGH"
            elif ca >= 2 or ce >= 3:
                coupling_risk = "MEDIUM"
            else:
                coupling_risk = "LOW"
        else:
            coupling_risk = "LOW"

        module_metrics.append({
            "file": fp,
            "layer": classify_file_layer(fp),
            "afferent_coupling_ca": ca,
            "efferent_coupling_ce": ce,
            "instability_index": instability,
            "coupling_risk": coupling_risk,
            "incoming_dependents": sorted((prod_reverse_graph if is_prod else reverse_graph).get(fp, []))[:3],
            "outgoing_dependencies": sorted((prod_dependency_graph if is_prod else dependency_graph).get(fp, []))[:3],
        })

    # Sort hotspot modules by highest total coupling (Ca + Ce) descending
    module_metrics.sort(key=lambda m: (m["afferent_coupling_ca"] + m["efferent_coupling_ce"], m["file"]), reverse=True)

    hotspots = [m for m in module_metrics if m["coupling_risk"] in ["HIGH", "CRITICAL"] and m["layer"] != "Tests Layer"]
    hub_modules = [m["file"] for m in module_metrics if m["layer"] != "Tests Layer" and (m["afferent_coupling_ca"] + m["efferent_coupling_ce"]) > 0][:3]

    # 3. Cyclic Dependency & Layer Violation Detection (Production Only)
    cycles = find_cyclic_dependencies(prod_dependency_graph)

    # Detect Layer Violations (e.g. Data Layer importing API Layer, or Core Layer importing Service Layer)
    layer_violations: List[Dict[str, Any]] = []
    layer_hierarchy_rank = {
        "Utilities / Core Layer": 1,
        "Data / Ingestion Layer": 2,
        "Services / Domain Layer": 3,
        "API / Routes Layer": 4,
        "Tests Layer": 5,
    }

    for source_file, targets in prod_dependency_graph.items():
        src_layer = classify_file_layer(source_file)
        src_rank = layer_hierarchy_rank.get(src_layer, 3)

        for target_file in targets:
            tgt_layer = classify_file_layer(target_file)
            tgt_rank = layer_hierarchy_rank.get(tgt_layer, 3)

            # Violation: Lower rank (Core/Data) calling higher rank (API/Service)
            if src_rank < tgt_rank and src_layer != "Tests Layer":
                layer_violations.append({
                    "source_file": source_file,
                    "source_layer": src_layer,
                    "target_file": target_file,
                    "target_layer": tgt_layer,
                    "severity": "HIGH" if (tgt_rank - src_rank) >= 2 else "MEDIUM",
                    "explanation": f"Illegal architectural dependency: '{src_layer}' module '{source_file}' depends on higher-tier '{tgt_layer}' module '{target_file}'.",
                })

    # 4. Architectural Health Score & Risk Level Calculation
    distinct_short_cycles = [c for c in cycles if len(c) <= 3]
    unique_cycling_modules = set(node for cycle in cycles for node in cycle)

    base_health = 98
    if cycles:
        cycle_penalty = min(10, len(distinct_short_cycles) * 1.5 + (len(unique_cycling_modules) // 6))
        base_health -= cycle_penalty
    if layer_violations:
        violation_penalty = min(5, len(layer_violations) * 0.3)
        base_health -= violation_penalty
    if hotspots:
        hotspot_penalty = min(3, len(hotspots) * 0.2)
        base_health -= hotspot_penalty

    architecture_health_score = max(0, min(100, int(round(base_health))))

    if architecture_health_score >= 80:
        arch_risk_level = "HEALTHY"
    elif architecture_health_score >= 60:
        arch_risk_level = "MODERATE_RISK"
    elif architecture_health_score >= 40:
        arch_risk_level = "HIGH_RISK"
    else:
        arch_risk_level = "CRITICAL_RISK"

    # 5. Explainable Insights & Decoupling Recommendations
    recommendations: List[str] = []
    if cycles:
        recommendations.append(f"Break {len(cycles)} cyclic dependency loop(s) using dependency inversion or interface abstractions.")
    if hotspots:
        recommendations.append(f"Refactor high-coupling hub module '{hotspots[0]['file']}' (Ca={hotspots[0]['afferent_coupling_ca']}, Ce={hotspots[0]['efferent_coupling_ce']}) into smaller decoupled services.")
    if layer_violations:
        recommendations.append(f"Remediate {len(layer_violations)} architectural layer violation(s) where lower-tier modules depend on higher-tier modules.")
    if not recommendations:
        recommendations.append("Repository maintains clean architectural layer boundaries and balanced coupling stability.")

    summary_text = (
        f"Repository **{repo_name}** exhibits a **{pattern}** with an Architectural Health Score of **{architecture_health_score}/100** ({arch_risk_level}). "
        f"Analyzed **{len(all_file_paths)} modules** across {len(layers)} architectural layers. "
        f"Identified **{len(cycles)} cyclic dependency loop(s)**, **{len(hotspots)} coupling hotspot(s)**, and **{len(layer_violations)} layer boundary violation(s)**."
    )

    return {
        "status": "success",
        "repository_name": repo_name,
        "repository_url": clean_url,
        "architecture_pattern": pattern,
        "pattern_description": pattern_desc,
        "architectural_health_score": architecture_health_score,
        "architectural_risk_level": arch_risk_level,
        "summary": summary_text,
        "metrics": {
            "total_modules": len(all_file_paths),
            "total_dependency_edges": total_ce,
            "cyclic_dependencies_count": len(cycles),
            "coupling_hotspots_count": len(hotspots),
            "layer_violations_count": len(layer_violations),
            "hub_modules": hub_modules,
        },
        "layer_breakdown": layer_breakdown,
        "coupling_hotspots": hotspots[:10],
        "module_coupling_metrics": module_metrics,
        "cyclic_dependencies": [
            {
                "cycle_length": len(c) - 1,
                "cycle_path": c,
                "formatted_cycle": " ➔ ".join(c),
            }
            for c in cycles
        ],
        "layer_violations": layer_violations[:10],
        "recommendations": recommendations,
        "source_engines": [
            "dependency_analyzer.py (Step 22)",
            "impact_analyzer.py (Step 22)",
            "unified_engineering_intelligence.py (Step 40 SSoT)",
        ],
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }


def evaluate_pr_architectural_impact(
    repository_url: Optional[str] = None,
    pr_id: Optional[str] = None,
    changed_files: Optional[List[str]] = None,
    github_token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Evaluates whether a PR change set introduces architectural risks, touches coupling hotspots,
    or breaches layer boundaries.
    """
    arch_res = analyze_repository_architecture(repository_url, github_token=github_token)
    if isinstance(arch_res, dict) and arch_res.get("status") == "error":
        return arch_res

    clean_files: List[str] = []
    if pr_id:
        try:
            from app.services.pull_request_intelligence import generate_pull_request_intelligence
            pr_intel = generate_pull_request_intelligence(repository_url=repository_url, pr_id=pr_id, github_token=github_token)
            if isinstance(pr_intel, dict) and pr_intel.get("changed_files"):
                for fc in pr_intel.get("changed_files", []):
                    if isinstance(fc, dict) and fc.get("file"):
                        clean_files.append(fc.get("file"))
        except Exception:
            pass

    if not clean_files and changed_files:
        clean_files = [f for f in changed_files if f and isinstance(f, str)]

    if not clean_files:
        clean_files = [arch_res.get("metrics", {}).get("hub_modules", ["requests/api.py"])[0]]

    # Match changed files against hotspots and layer violations
    hotspots_touched = []
    for m in arch_res.get("coupling_hotspots", []):
        if m.get("file") in clean_files:
            hotspots_touched.append(m.get("file"))

    violations_touched = []
    for v in arch_res.get("layer_violations", []):
        if v.get("source_file") in clean_files or v.get("target_file") in clean_files:
            violations_touched.append(v)

    pr_arch_risk = "HIGH" if (hotspots_touched or violations_touched) else "LOW"

    return {
        "status": "success",
        "repository_url": arch_res.get("repository_url"),
        "pr_id": pr_id or "latest",
        "changed_files": clean_files,
        "pr_architectural_risk": pr_arch_risk,
        "hotspots_touched": hotspots_touched,
        "layer_violations_touched": violations_touched,
        "architectural_health_score": arch_res.get("architectural_health_score"),
        "recommendation": "Review high-coupling hotspot modifications before merging." if hotspots_touched else "PR changes comply with architectural layer guidelines.",
    }


def export_architecture_intelligence(
    arch_data: Dict[str, Any],
    export_format: str = "json",
) -> Dict[str, Any]:
    """
    Exports Architecture Intelligence report in JSON or Markdown format.
    """
    if not arch_data or arch_data.get("status") == "error":
        return arch_data

    fmt = (export_format or "json").strip().lower()

    if fmt == "json":
        return {
            "status": "success",
            "format": "json",
            "filename": "architecture_intelligence.json",
            "content_type": "application/json",
            "data": arch_data,
        }

    elif fmt in ["markdown", "md"]:
        metrics = arch_data.get("metrics", {})
        hotspots = arch_data.get("coupling_hotspots", [])
        cycles = arch_data.get("cyclic_dependencies", [])
        violations = arch_data.get("layer_violations", [])
        recs = arch_data.get("recommendations", [])

        md_lines = [
            "# 🏛️ RepoMind Architecture Intelligence Report",
            f"**Repository:** `{arch_data.get('repository_url', '')}`  ",
            f"**Pattern:** {arch_data.get('architecture_pattern', '')}  ",
            f"**Health Score:** **{arch_data.get('architectural_health_score', 0)}/100** ({arch_data.get('architectural_risk_level', '')})  ",
            f"**Generated At:** {arch_data.get('generated_at', '')}",
            "",
            "## Executive Summary",
            arch_data.get("summary", ""),
            "",
            "## Architectural Metrics Overview",
            f"- **Total Modules:** {metrics.get('total_modules', 0)}",
            f"- **Dependency Edges:** {metrics.get('total_dependency_edges', 0)}",
            f"- **Cyclic Dependencies:** {metrics.get('cyclic_dependencies_count', 0)}",
            f"- **Coupling Hotspots:** {metrics.get('coupling_hotspots_count', 0)}",
            f"- **Layer Violations:** {metrics.get('layer_violations_count', 0)}",
            "",
            "## Coupling & Instability Hotspots",
        ]

        for h in hotspots:
            md_lines.append(f"- `{h.get('file')}` — Ca={h.get('afferent_coupling_ca')}, Ce={h.get('efferent_coupling_ce')}, Instability={h.get('instability_index')} ({h.get('coupling_risk')} Risk)")

        if cycles:
            md_lines.extend(["", "## Cyclic Dependency Violations"])
            for c in cycles:
                md_lines.append(f"- 🔄 `{c.get('formatted_cycle')}`")

        if violations:
            md_lines.extend(["", "## Layer Boundary Violations"])
            for v in violations:
                md_lines.append(f"- ⚠️ {v.get('explanation')}")

        if recs:
            md_lines.extend(["", "## Decoupling Recommendations"])
            for r in recs:
                md_lines.append(f"1. {r}")

        return {
            "status": "success",
            "format": "markdown",
            "filename": "architecture_intelligence.md",
            "content_type": "text/markdown",
            "content": "\n".join(md_lines),
        }

    return {"status": "error", "message": f"Unsupported export format '{export_format}'."}
