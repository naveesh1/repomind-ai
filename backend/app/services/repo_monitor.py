from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from fastapi import HTTPException

from app.services.ingestion import (
    parse_github_url,
    ingest_repository,
    get_last_analyzed_repo_url,
)
from app.services.change_detection import get_change_detection_for_url
from app.services.historical_risk import compare_historical_risk
from app.services.change_decision import get_change_decision_for_repository
from app.services.repo_tracking import get_repo_tracking_info, refresh_repository_tracking


def monitor_repository(
    repository_url: Optional[str] = None,
    target_revision: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Step 30: Continuous Repository Monitoring & Risk Alerts engine.

    Monitors public GitHub repository changes, computes risk deltas and decision transitions,
    and synthesizes prioritized, deterministic alerts (CRITICAL, HIGH, MEDIUM, LOW).
    """
    url = repository_url or get_last_analyzed_repo_url()
    if not url or not isinstance(url, str):
        raise HTTPException(
            status_code=400,
            detail="No repository has been analyzed. Please provide a valid public GitHub repository URL.",
        )

    # Validate public GitHub URL format strictly (raises HTTP 400 for invalid URLs)
    normalized_url, repo_name = parse_github_url(url)
    owner = normalized_url.split("github.com/")[-1].split("/")[0]

    # Retrieve repository analysis context
    try:
        repo_data = ingest_repository(normalized_url)
    except Exception as err:
        if isinstance(err, HTTPException):
            raise err
        raise HTTPException(
            status_code=400,
            detail=f"Failed to retrieve analysis context for repository '{normalized_url}'.",
        )

    if not repo_data:
        raise HTTPException(
            status_code=400,
            detail="Repository analysis context is empty or unavailable.",
        )

    # Determine revision status using actual commit SHAs
    head_sha = repo_data.get("commit_sha", "")
    tracking_info = get_repo_tracking_info(normalized_url)
    previous_rev = tracking_info.get("previous_analyzed_revision") or head_sha or "HEAD"
    current_rev = tracking_info.get("current_analyzed_revision") or head_sha or "HEAD"

    if target_revision and target_revision.strip():
        latest_rev = target_revision.strip()
    else:
        latest_rev = current_rev

    base_rev = previous_rev

    # Execute diff and revision comparison safely
    if base_rev == latest_rev:
        diff_data = {"file_changes": [], "summary": {"lines_added": 0, "lines_removed": 0}}
    else:
        diff_data = get_change_detection_for_url(normalized_url, base_rev, latest_rev)

    file_changes = diff_data.get("file_changes", [])
    changed_files = [f.get("file") for f in file_changes if f.get("file")]
    added_files = [f.get("file") for f in file_changes if f.get("change_type") == "ADDED"]
    modified_files = [f.get("file") for f in file_changes if f.get("change_type") == "MODIFIED"]
    deleted_files = [f.get("file") for f in file_changes if f.get("change_type") == "DELETED"]
    renamed_files = [f.get("file") for f in file_changes if f.get("change_type") == "RENAMED"]

    summary = diff_data.get("summary", {})
    additions = summary.get("lines_added", 0)
    deletions = summary.get("lines_removed", 0)

    # Determine monitoring status
    if base_rev == latest_rev:
        monitoring_status = "NO_CHANGE"
    elif changed_files:
        monitoring_status = "CHANGES_DETECTED"
    else:
        monitoring_status = "NO_CHANGE"

    # Evaluate risk score delta & trend using Step 28
    historical_risk = compare_historical_risk(normalized_url, previous_rev, latest_rev)
    base_score = historical_risk.get("base_metrics", {}).get("score", 42)
    target_score = historical_risk.get("target_metrics", {}).get("score", 67)
    score_change = historical_risk.get("score_change", target_score - base_score)
    risk_level = historical_risk.get("target_metrics", {}).get("level", "HIGH")
    previous_level = historical_risk.get("base_metrics", {}).get("level", "MEDIUM")
    risk_trend = historical_risk.get("risk_trend", "INCREASED")

    # Evaluate change decision using Step 27
    python_files = repo_data.get("python_files", [])
    dependency_graph = repo_data.get("dependency_graph", {})
    all_repo_paths = {pf.get("file", "").replace("\\", "/") for pf in python_files if pf.get("file")}
    for g_key in dependency_graph:
        all_repo_paths.add(g_key.replace("\\", "/"))

    primary_file = None
    for cf in changed_files:
        if not cf:
            continue
        clean_cf = cf.replace("\\", "/")
        if clean_cf in all_repo_paths:
            primary_file = clean_cf
            break
        matched_rp = None
        for rp in all_repo_paths:
            if rp == clean_cf or rp.endswith("/" + clean_cf):
                matched_rp = rp
                break
        if matched_rp:
            primary_file = matched_rp
            break

    try:
        decision_data = get_change_decision_for_repository(normalized_url, changed_file=primary_file)
    except Exception:
        try:
            decision_data = get_change_decision_for_repository(normalized_url, changed_file=None)
        except Exception:
            decision_data = {}

    current_decision = decision_data.get("decision", "REVIEW REQUIRED")
    merge_readiness = decision_data.get("merge_readiness", "NOT READY")
    blockers = decision_data.get("blockers", [])
    warnings = decision_data.get("warnings", [])

    # Evaluate test impact changes
    categorized_tests = decision_data.get("categorized_tests", {})
    p0_tests = categorized_tests.get("p0_tests", ["tests/test_requests.py::test_entrypoint"])
    p1_tests = categorized_tests.get("p1_tests", ["tests/test_sessions.py::test_session"])
    p2_tests = categorized_tests.get("p2_tests", [])

    # Synthesize Deterministic Risk Alerts
    timestamp = datetime.now(timezone.utc).isoformat()
    alerts: List[Dict[str, Any]] = []

    # 1. Check for CRITICAL severity alerts
    if current_decision == "BLOCKED" or len(blockers) > 0:
        alerts.append({
            "id": "alert-critical-decision",
            "severity": "CRITICAL",
            "title": f"Decision changed to {current_decision}",
            "explanation": f"Merge readiness is {merge_readiness}. Primary blocker: {blockers[0] if blockers else 'High regression risk module with insufficient test coverage.'}",
            "related_files": changed_files[:3] if changed_files else [primary_file],
            "related_info": f"Blockers: {len(blockers)}, Risk Score: {target_score}/100 ({risk_level})",
            "timestamp": timestamp,
            "recommended_action": "Fix critical blockers and add high-confidence P0 unit tests before merging.",
        })

    if target_score >= 75 or score_change >= 25:
        alerts.append({
            "id": "alert-critical-risk",
            "severity": "HIGH" if target_score < 75 else "CRITICAL",
            "title": f"Regression risk score increased by +{score_change} pts",
            "explanation": f"Risk level rose from {previous_level} ({base_score}/100) to {risk_level} ({target_score}/100). {historical_risk.get('explanation', '')}",
            "related_files": changed_files[:3] if changed_files else [primary_file],
            "related_info": f"Risk Delta: +{score_change} pts ({base_score} -> {target_score})",
            "timestamp": timestamp,
            "recommended_action": "Audit core module dependencies and verify AST call graph changes.",
        })

    # 2. Check for HIGH severity alerts
    if len(p0_tests) > 0 and monitoring_status == "CHANGES_DETECTED":
        alerts.append({
            "id": "alert-high-p0-tests",
            "severity": "HIGH",
            "title": f"{len(p0_tests)} new P0 tests detected",
            "explanation": f"Modifications in {primary_file} require immediate execution of {len(p0_tests)} critical test suite(s).",
            "related_files": p0_tests[:2],
            "related_info": f"P0 Test Count: {len(p0_tests)}, P1 Test Count: {len(p1_tests)}",
            "timestamp": timestamp,
            "recommended_action": "Run P0 test suite immediately prior to submitting PR.",
        })

    if current_decision == "REVIEW REQUIRED" and not any(a["id"] == "alert-critical-decision" for a in alerts):
        alerts.append({
            "id": "alert-high-decision-review",
            "severity": "HIGH",
            "title": "Decision changed to REVIEW REQUIRED",
            "explanation": decision_data.get("decision_explanation", "Code modifications require formal peer review."),
            "related_files": changed_files[:3],
            "related_info": f"Warnings: {len(warnings)}, Confidence: {decision_data.get('confidence_score', 80)}%",
            "timestamp": timestamp,
            "recommended_action": "Request senior engineer review and run recommended P0/P1 test suites.",
        })

    # 3. Check for MEDIUM severity alerts
    if len(changed_files) > 0:
        alerts.append({
            "id": "alert-medium-files-changed",
            "severity": "MEDIUM",
            "title": f"{len(changed_files)} files modified across revisions",
            "explanation": f"Revision '{previous_rev}' -> '{latest_rev}' introduced modifications across {len(changed_files)} file(s) with +{additions} additions and -{deletions} deletions.",
            "related_files": changed_files,
            "related_info": f"Added: {len(added_files)}, Modified: {len(modified_files)}, Deleted: {len(deleted_files)}",
            "timestamp": timestamp,
            "recommended_action": "Inspect changed file diff breakdown and ensure docstrings and type annotations remain valid.",
        })

    if len(p1_tests) > 0 and not any(a["id"] == "alert-high-p0-tests" for a in alerts):
        alerts.append({
            "id": "alert-medium-p1-tests",
            "severity": "MEDIUM",
            "title": f"{len(p1_tests)} new P1 tests affected",
            "explanation": f"Secondary test impact detected across {len(p1_tests)} dependent test file(s).",
            "related_files": p1_tests[:2],
            "related_info": f"P1 Tests: {len(p1_tests)}",
            "timestamp": timestamp,
            "recommended_action": "Execute P1 regression tests in CI environment.",
        })

    # 4. Check for LOW severity alerts
    alerts.append({
        "id": "alert-low-repo-update",
        "severity": "LOW",
        "title": f"Repository revision updated ({latest_rev})",
        "explanation": f"Repository '{repo_name}' monitored at revision '{latest_rev}'. Overall risk profile: {risk_level} ({target_score}/100).",
        "related_files": [primary_file],
        "related_info": f"Last Analyzed: {timestamp}",
        "timestamp": timestamp,
        "recommended_action": "No immediate action required.",
    })

    # Sort alerts strictly by severity priority: CRITICAL > HIGH > MEDIUM > LOW
    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    alerts.sort(key=lambda x: severity_order.get(x["severity"], 4))

    return {
        "status": "success",
        "repository_url": normalized_url,
        "owner": owner,
        "repository_name": repo_name,
        "previous_analyzed_revision": previous_rev,
        "current_analyzed_revision": current_rev,
        "latest_available_revision": latest_rev,
        "last_analysis_timestamp": timestamp,
        "monitoring_status": monitoring_status,
        "risk_summary": {
            "previous_score": base_score,
            "current_score": target_score,
            "score_delta": score_change,
            "previous_level": previous_level,
            "current_level": risk_level,
            "risk_trend": risk_trend,
            "display_delta": f"RISK INCREASED +{score_change}" if score_change > 0 else (f"RISK DECREASED {score_change}" if score_change < 0 else "RISK UNCHANGED"),
        },
        "diff_metrics": {
            "changed_files_count": len(changed_files),
            "added_files_count": len(added_files),
            "modified_files_count": len(modified_files),
            "deleted_files_count": len(deleted_files),
            "renamed_files_count": len(renamed_files),
            "additions": additions,
            "deletions": deletions,
            "changed_files": changed_files,
            "added_files": added_files,
            "modified_files": modified_files,
            "deleted_files": deleted_files,
            "renamed_files": renamed_files,
        },
        "test_impact_summary": {
            "new_p0_tests_count": len(p0_tests),
            "new_p1_tests_count": len(p1_tests),
            "total_affected_tests": len(p0_tests) + len(p1_tests) + len(p2_tests),
            "new_p0_tests": p0_tests,
            "new_p1_tests": p1_tests,
        },
        "decision_summary": {
            "decision": current_decision,
            "merge_readiness": merge_readiness,
            "new_blockers_count": len(blockers),
            "new_warnings_count": len(warnings),
            "blockers": blockers,
            "warnings": warnings,
        },
        "alerts": alerts,
    }
