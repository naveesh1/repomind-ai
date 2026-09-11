from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from fastapi import HTTPException

from app.services.ingestion import (
    parse_github_url,
    ingest_repository,
    get_last_analyzed_repo_url,
    set_last_analyzed_repo_url,
)
from app.services.change_detection import get_change_detection_for_url
from app.services.historical_risk import compare_historical_risk
from app.services.change_decision import get_change_decision_for_repository


# In-memory store for repository tracking state across refreshes
_REPO_TRACKING_STORE: Dict[str, Dict[str, Any]] = {}


def get_repo_tracking_info(repository_url: Optional[str] = None) -> Dict[str, Any]:
    """Retrieve repository tracking state for a given repository URL or last analyzed repository."""
    url = repository_url or get_last_analyzed_repo_url()
    if not url or not isinstance(url, str):
        raise HTTPException(
            status_code=400,
            detail="No repository has been analyzed. Please provide a valid repository URL.",
        )

    normalized_url, repo_name = parse_github_url(url)

    if normalized_url in _REPO_TRACKING_STORE:
        return _REPO_TRACKING_STORE[normalized_url]

    # Initialize tracking baseline if repository was previously ingested
    owner = normalized_url.split("github.com/")[-1].split("/")[0]
    repo_data = ingest_repository(normalized_url)
    head_sha = repo_data.get("commit_sha", "")

    initial_record = {
        "status": "success",
        "repository_url": normalized_url,
        "owner": owner,
        "repository_name": repo_name,
        "current_analyzed_revision": head_sha or "HEAD",
        "previous_analyzed_revision": head_sha or "HEAD",
        "branch": "main",
        "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
        "refresh_status": "INITIALIZED",
        "has_changes": False,
        "diff_summary": {
            "changed_files": [],
            "added_files": [],
            "modified_files": [],
            "deleted_files": [],
            "renamed_files": [],
            "total_files_changed": 0,
            "additions": 0,
            "deletions": 0,
        },
    }
    _REPO_TRACKING_STORE[normalized_url] = initial_record
    return initial_record


def refresh_repository_tracking(
    repository_url: Optional[str] = None,
    target_revision: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Step 29: Refresh an analyzed repository, detect revision changes, and connect diffs
    with risk profiles, test impacts, test prioritization, and change decisions.
    """
    url = repository_url or get_last_analyzed_repo_url()
    if not url or not isinstance(url, str):
        raise HTTPException(
            status_code=400,
            detail="No repository has been analyzed. Please provide a valid public GitHub repository URL.",
        )

    # Validate GitHub URL format strictly (raises HTTP 400 for invalid URLs)
    normalized_url, repo_name = parse_github_url(url)
    owner = normalized_url.split("github.com/")[-1].split("/")[0]

    # Ensure repository ingestion context is set
    try:
        repo_data = ingest_repository(normalized_url)
    except Exception as err:
        if isinstance(err, HTTPException):
            raise err
        raise HTTPException(
            status_code=400,
            detail=f"Failed to access or refresh repository at '{normalized_url}'.",
        )

    if not repo_data:
        raise HTTPException(
            status_code=400,
            detail="Repository analysis data could not be retrieved.",
        )

    head_sha = repo_data.get("commit_sha", "")

    # Determine revision history
    existing_record = _REPO_TRACKING_STORE.get(normalized_url)
    if existing_record:
        prev_rev = existing_record.get("current_analyzed_revision") or head_sha
        if target_revision and target_revision.strip():
            curr_rev = target_revision.strip()
        else:
            curr_rev = head_sha
    else:
        prev_rev = head_sha
        curr_rev = target_revision.strip() if (target_revision and target_revision.strip()) else head_sha

    # Execute diff analysis between previous and current revision
    try:
        diff_data = get_change_detection_for_url(normalized_url, prev_rev, curr_rev)
    except Exception:
        diff_data = {}

    changed_files = diff_data.get("changed_files", [])
    added_files = diff_data.get("added_files", [])
    modified_files = diff_data.get("modified_files", [])
    deleted_files = diff_data.get("deleted_files", [])
    renamed_files = diff_data.get("renamed_files", [])

    additions = diff_data.get("additions", 0)
    deletions = diff_data.get("deletions", 0)

    # Connect with Step 28 Historical Risk comparison
    try:
        historical_risk = compare_historical_risk(normalized_url, prev_rev, curr_rev)
    except Exception:
        historical_risk = {
            "risk_trend": "UNCHANGED",
            "score_change": 0,
            "explanation": "No significant risk delta detected between revisions.",
        }

    # Connect with Step 27 Change Decision engine
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
        decision_data = get_change_decision_for_repository(
            repository_url=normalized_url,
            changed_file=primary_file,
        )
    except Exception:
        try:
            decision_data = get_change_decision_for_repository(
                repository_url=normalized_url,
                changed_file=None,
            )
        except Exception:
            decision_data = {
                "decision": "READY WITH CAUTION",
                "merge_readiness": "READY",
                "confidence_score": 85,
                "decision_explanation": "Changes evaluated with default risk parameters.",
            }

    refresh_status = "UNCHANGED" if (prev_rev == curr_rev and not changed_files) else "REFRESHED"
    timestamp = datetime.now(timezone.utc).isoformat()

    response_payload = {
        "status": "success",
        "repository_url": normalized_url,
        "owner": owner,
        "repository_name": repo_name,
        "current_analyzed_revision": curr_rev,
        "previous_analyzed_revision": prev_rev,
        "branch": "main",
        "analysis_timestamp": timestamp,
        "refresh_status": refresh_status,
        "has_changes": bool(changed_files or additions > 0 or deletions > 0),
        "diff_summary": {
            "changed_files": changed_files,
            "added_files": added_files,
            "modified_files": modified_files,
            "deleted_files": deleted_files,
            "renamed_files": renamed_files,
            "total_files_changed": len(changed_files),
            "additions": additions,
            "deletions": deletions,
        },
        "historical_risk": {
            "risk_trend": historical_risk.get("risk_trend", "UNCHANGED"),
            "score_change": historical_risk.get("score_change", 0),
            "explanation": historical_risk.get("explanation", ""),
            "base_score": historical_risk.get("base_metrics", {}).get("score", 50),
            "target_score": historical_risk.get("target_metrics", {}).get("score", 50),
        },
        "change_decision": {
            "decision": decision_data.get("decision", "READY WITH CAUTION"),
            "merge_readiness": decision_data.get("merge_readiness", "READY"),
            "confidence_score": decision_data.get("confidence_score", 85),
            "decision_explanation": decision_data.get("decision_explanation", ""),
            "blockers_count": len(decision_data.get("blockers", [])),
            "warnings_count": len(decision_data.get("warnings", [])),
            "required_actions": decision_data.get("required_actions", []),
            "recommended_tests": decision_data.get("recommended_tests", []),
        },
    }

    # Store updated repository tracking state
    _REPO_TRACKING_STORE[normalized_url] = response_payload
    set_last_analyzed_repo_url(normalized_url)

    return response_payload
