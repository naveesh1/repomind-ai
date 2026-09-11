import os
import json
import datetime
from typing import Dict, Any, List, Optional, Set, Tuple

from app.services.ingestion import ingest_repository, get_last_analyzed_repo_url
from app.services.test_impact import compute_test_impact, is_test_file
from app.services.dependency_analyzer import build_dependency_graph, get_reverse_dependencies


def select_smart_tests(
    repository_url: Optional[str] = None,
    changed_files: Optional[List[str]] = None,
    changed_function: Optional[str] = None,
    pr_id: Optional[str] = None,
    github_token: Optional[str] = None,
    min_confidence_threshold: int = 20,
) -> Dict[str, Any]:
    """
    Step 46: Smart Test Selection Engine.
    Identifies the smallest relevant set of tests for a given code change or PR diff,
    ranks tests by priority tier (P0 Critical, P1 High, P2 Secondary), traces changed code to affected
    tests through dependency/impact relationships, and explains why each test was selected or omitted.
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

    all_files = set()
    if isinstance(python_files, list):
        for pf in python_files:
            if isinstance(pf, dict) and pf.get("file"):
                all_files.add(pf.get("file").replace("\\", "/"))

    for g_key in dependency_graph:
        all_files.add(g_key.replace("\\", "/"))

    all_test_files = sorted([f for f in all_files if is_test_file(f)])
    total_repo_tests = len(all_test_files)

    # Resolve target changed files list
    target_files: List[str] = []

    if pr_id:
        try:
            from app.services.pull_request_intelligence import generate_pull_request_intelligence
            pr_intel = generate_pull_request_intelligence(
                repository_url=clean_url,
                pr_id=pr_id,
                github_token=github_token,
            )
            if isinstance(pr_intel, dict) and pr_intel.get("changed_files"):
                for fc in pr_intel.get("changed_files", []):
                    if isinstance(fc, dict) and fc.get("file"):
                        target_files.append(fc.get("file"))
            elif isinstance(pr_intel, dict) and pr_intel.get("modified_files"):
                target_files.extend(pr_intel.get("modified_files", []))
        except Exception:
            pass

    if not target_files and changed_files:
        if isinstance(changed_files, list):
            target_files = [f for f in changed_files if f and isinstance(f, str)]
        elif isinstance(changed_files, str):
            target_files = [changed_files]

    if not target_files:
        if python_files and isinstance(python_files, list):
            non_test = [pf.get("file") for pf in python_files if isinstance(pf, dict) and pf.get("file") and not is_test_file(pf.get("file"))]
            target_files = [non_test[0]] if non_test else [python_files[0].get("file")]
        else:
            target_files = ["requests/api.py"]

    # Compute test impact for each target changed file & aggregate
    aggregated_test_map: Dict[str, Dict[str, Any]] = {}

    for c_file in target_files:
        try:
            impact_res = compute_test_impact(
                repository_url=clean_url,
                changed_file=c_file,
                changed_function=changed_function,
            )
        except Exception:
            impact_res = {}

        if not isinstance(impact_res, dict) or "affected_tests" not in impact_res:
            continue

        for test_item in impact_res.get("affected_tests", []):
            tf = test_item.get("test_file")
            if not tf:
                continue

            conf = test_item.get("confidence", 50)
            imp_type = test_item.get("impact_type", "INDIRECT")
            prio = test_item.get("priority", "P1")
            reason = test_item.get("reason", "")
            dep_path = test_item.get("dependency_path", [])

            if tf not in aggregated_test_map:
                aggregated_test_map[tf] = {
                    "test_file": tf,
                    "max_confidence": conf,
                    "best_impact_type": imp_type,
                    "best_priority": prio,
                    "origin_files": [c_file],
                    "reasons": [reason],
                    "dependency_paths": [dep_path],
                }
            else:
                curr = aggregated_test_map[tf]
                if conf > curr["max_confidence"]:
                    curr["max_confidence"] = conf
                    curr["best_impact_type"] = imp_type,
                    curr["best_priority"] = prio
                if c_file not in curr["origin_files"]:
                    curr["origin_files"].append(c_file)
                if reason and reason not in curr["reasons"]:
                    curr["reasons"].append(reason)
                if dep_path and dep_path not in curr["dependency_paths"]:
                    curr["dependency_paths"].append(dep_path)

    # Process and rank tests into execution tiers
    selected_tests: List[Dict[str, Any]] = []
    omitted_tests: List[Dict[str, Any]] = []

    prio_order = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}

    for tf in all_test_files:
        if tf in aggregated_test_map:
            t_data = aggregated_test_map[tf]
            conf = t_data["max_confidence"]

            if conf < min_confidence_threshold:
                omitted_tests.append({
                    "test_file": tf,
                    "confidence": conf,
                    "exclusion_reason": f"Confidence score ({conf}%) below minimum selection threshold ({min_confidence_threshold}%).",
                })
                continue

            best_prio = t_data["best_priority"]
            if isinstance(best_prio, tuple):
                best_prio = best_prio[0]
            best_imp = t_data["best_impact_type"]
            if isinstance(best_imp, tuple):
                best_imp = best_imp[0]

            # Assign Tier
            if best_prio == "P0" or best_imp == "DIRECT":
                tier = "TIER 1 (CRITICAL P0)"
                tier_order = 1
            elif best_prio == "P1" or best_imp == "INDIRECT":
                tier = "TIER 2 (HIGH P1)"
                tier_order = 2
            else:
                tier = "TIER 3 (SECONDARY P2)"
                tier_order = 3

            primary_path = t_data["dependency_paths"][0] if t_data["dependency_paths"] else [tf]
            path_str = " ➔ ".join(primary_path) if isinstance(primary_path, list) else str(primary_path)

            primary_reason = t_data["reasons"][0] if t_data["reasons"] else "Affected by code change."
            origins_str = ", ".join(t_data["origin_files"])

            why_selected = f"{primary_reason} (Traced from modified target: {origins_str})"

            selected_tests.append({
                "test_file": tf,
                "execution_tier": tier,
                "tier_order": tier_order,
                "priority": best_prio,
                "impact_type": best_imp,
                "confidence": conf,
                "origin_files": t_data["origin_files"],
                "dependency_trace": path_str,
                "why_selected": why_selected,
                "estimated_duration_sec": 1.5 if tier_order == 1 else (0.8 if tier_order == 2 else 0.4),
            })
        else:
            omitted_tests.append({
                "test_file": tf,
                "confidence": 0,
                "exclusion_reason": "No direct or indirect dependency path connected to the target code changes.",
            })

    # Sort selected tests by Tier order -> Confidence descending -> File name ascending
    selected_tests.sort(key=lambda t: (t["tier_order"], prio_order.get(t["priority"], 4), -t["confidence"], t["test_file"]))

    # Summary Metrics Calculation
    selected_count = len(selected_tests)
    omitted_count = len(omitted_tests)

    if total_repo_tests > 0:
        reduction_pct = round(((total_repo_tests - selected_count) / float(total_repo_tests)) * 100.0, 1)
    else:
        reduction_pct = 0.0

    # Estimated time saved (assuming average 1.2 seconds per omitted test)
    time_saved_sec = round(omitted_count * 1.2, 1)

    # Generate executable Pytest command string
    test_files_cmd = " ".join([t["test_file"] for t in selected_tests])
    pytest_command = f"pytest {test_files_cmd}" if test_files_cmd else "pytest"

    # Execution Tiers Summary Breakdown
    tier1_count = len([t for t in selected_tests if t["tier_order"] == 1])
    tier2_count = len([t for t in selected_tests if t["tier_order"] == 2])
    tier3_count = len([t for t in selected_tests if t["tier_order"] == 3])

    return {
        "status": "success",
        "repository_name": repo_name,
        "repository_url": clean_url,
        "pr_id": pr_id or None,
        "changed_files": target_files,
        "changed_function": changed_function or None,
        "summary": {
            "total_repository_tests": total_repo_tests,
            "selected_test_count": selected_count,
            "omitted_test_count": omitted_count,
            "test_reduction_percentage": reduction_pct,
            "estimated_time_saved_seconds": time_saved_sec,
            "tier_breakdown": {
                "tier_1_critical_p0": tier1_count,
                "tier_2_high_p1": tier2_count,
                "tier_3_secondary_p2": tier3_count,
            },
        },
        "pytest_command": pytest_command,
        "selected_tests": selected_tests,
        "omitted_tests": omitted_tests,
        "source_primitives": [
            "test_impact.py (Step 23)",
            "dependency_analyzer.py (Step 22)",
            "pull_request_intelligence.py (Step 42)",
        ],
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }


def export_smart_test_selection(
    selection_data: Dict[str, Any],
    export_format: str = "json",
) -> Dict[str, Any]:
    """
    Exports Smart Test Selection results in JSON, Markdown, or Shell Script format.
    """
    if not selection_data or selection_data.get("status") == "error":
        return selection_data

    fmt = (export_format or "json").strip().lower()

    if fmt == "json":
        return {
            "status": "success",
            "format": "json",
            "filename": "smart_test_selection.json",
            "content_type": "application/json",
            "data": selection_data,
        }

    elif fmt in ["markdown", "md"]:
        summary = selection_data.get("summary", {})
        selected = selection_data.get("selected_tests", [])
        omitted = selection_data.get("omitted_tests", [])
        cmd = selection_data.get("pytest_command", "")

        md_lines = [
            "# 🎯 RepoMind Smart Test Selection Report",
            f"**Repository:** `{selection_data.get('repository_url', '')}`  ",
            f"**Target Changes:** `{', '.join(selection_data.get('changed_files', []))}`  ",
            f"**Generated At:** {selection_data.get('generated_at', '')}",
            "",
            "## Executive Reduction Metrics",
            f"- **Total Repo Tests:** {summary.get('total_repository_tests', 0)}",
            f"- **Minimal Selected Set:** {summary.get('selected_test_count', 0)} test(s)",
            f"- **Suite Reduction:** **{summary.get('test_reduction_percentage', 0)}%**",
            f"- **Estimated Time Saved:** {summary.get('estimated_time_saved_seconds', 0)} seconds",
            "",
            "## Executable Pytest Command",
            "```bash",
            cmd,
            "```",
            "",
            "## Ranked Selected Test Suite",
        ]

        for t in selected:
            md_lines.extend([
                f"### {t.get('execution_tier')} — `{t.get('test_file')}`",
                f"- **Confidence:** {t.get('confidence')}% | **Priority:** {t.get('priority')}",
                f"- **Trace:** `{t.get('dependency_trace')}`",
                f"- **Why Selected:** {t.get('why_selected')}",
                "",
            ])

        if omitted:
            md_lines.extend(["", "## Omitted / Unaffected Tests"])
            for om in omitted:
                md_lines.append(f"- `{om.get('test_file')}`: {om.get('exclusion_reason')}")

        return {
            "status": "success",
            "format": "markdown",
            "filename": "smart_test_selection.md",
            "content_type": "text/markdown",
            "content": "\n".join(md_lines),
        }

    elif fmt in ["shell", "sh", "bash", "cmd"]:
        cmd = selection_data.get("pytest_command", "pytest")
        sh_lines = [
            "#!/bin/bash",
            "# RepoMind AI - Smart Test Selection Execution Script",
            f"# Target repository: {selection_data.get('repository_url', '')}",
            f"# Test suite reduction: {selection_data.get('summary', {}).get('test_reduction_percentage', 0)}%",
            "",
            "echo '🚀 Running minimal smart test selection suite...'",
            cmd,
            "echo '✅ Smart test suite execution complete.'",
        ]
        return {
            "status": "success",
            "format": "shell",
            "filename": "pytest_selection.sh",
            "content_type": "text/x-shellscript",
            "content": "\n".join(sh_lines),
        }

    return {"status": "error", "message": f"Unsupported export format '{export_format}'."}
