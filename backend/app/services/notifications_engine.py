import os
import json
import hashlib
import datetime
from typing import Dict, Any, List, Optional

from app.services.ingestion import get_last_analyzed_repo_url
from app.services.unified_engineering_intelligence import get_unified_engineering_intelligence
from app.services.pull_request_intelligence import generate_pull_request_intelligence
from app.services.release_gating import evaluate_release_readiness
from app.services.engineering_governance import generate_engineering_governance_report
from app.services.architecture_intelligence import analyze_repository_architecture
from app.services.smart_test_selection import select_smart_tests
from app.services.alert_notifications import generate_alert_notifications
from app.services.engineering_audit_history import generate_engineering_audit_history


# In-memory stores for events and user preferences
_EVENTS_STORE: List[Dict[str, Any]] = []
_DEDUP_CACHE: Dict[str, float] = {}  # dedup_hash -> timestamp
_PREFERENCES_STORE: Dict[str, Dict[str, Any]] = {}  # user_id -> preferences
_LAST_COLLECT_TS: Dict[str, float] = {}


def generate_dedup_hash(repository_url: str, event_type: str, severity: str, key_detail: str) -> str:
    """Generates a deterministic SHA256 deduplication hash for an event."""
    raw = f"{repository_url.strip().lower()}|{event_type.strip().upper()}|{severity.strip().upper()}|{key_detail.strip()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def is_duplicate_event(dedup_hash: str, window_seconds: int = 900) -> bool:
    """Checks if an identical event occurred within the sliding deduplication window (default 15 mins)."""
    now_ts = datetime.datetime.now(datetime.timezone.utc).timestamp()
    if dedup_hash in _DEDUP_CACHE:
        last_ts = _DEDUP_CACHE[dedup_hash]
        if (now_ts - last_ts) < window_seconds:
            return True
    _DEDUP_CACHE[dedup_hash] = now_ts
    return False


def create_event(
    event_type: str,
    severity: str,
    repository_url: str,
    title: str,
    summary: str,
    payload: Dict[str, Any],
    source_engine: str,
    key_detail: str = "",
) -> Optional[Dict[str, Any]]:
    """
    Creates and records a structured RepoMind event if it is not a duplicate.
    """
    clean_url = (repository_url or "").strip()
    sev_clean = severity.strip().upper()
    type_clean = event_type.strip().upper()

    d_hash = generate_dedup_hash(clean_url, type_clean, sev_clean, key_detail or title)
    if is_duplicate_event(d_hash):
        return None

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    evt_id = f"evt_{d_hash[:12]}"

    evt = {
        "event_id": evt_id,
        "event_type": type_clean,
        "severity": sev_clean,
        "repository_url": clean_url,
        "title": title,
        "summary": summary,
        "payload": payload,
        "source_engine": source_engine,
        "dedup_hash": d_hash,
        "created_at": now_iso,
    }

    _EVENTS_STORE.append(evt)
    # Keep up to 200 events in memory store
    if len(_EVENTS_STORE) > 200:
        _EVENTS_STORE.pop(0)

    return evt


def collect_events_from_ssot(repository_url: Optional[str] = None, force_refresh: bool = False) -> List[Dict[str, Any]]:
    """
    Step 49 Core Event Generator.
    Consumes decision outputs from Steps 40-48 SSoT engines and produces structured events.
    Does NOT recalculate any risk scores, health scores, or decision gates.
    """
    clean_url = (repository_url or "").strip()
    if not clean_url:
        clean_url = get_last_analyzed_repo_url() or "https://github.com/psf/requests"

    now_ts = datetime.datetime.now(datetime.timezone.utc).timestamp()
    if not force_refresh and clean_url in _LAST_COLLECT_TS:
        if (now_ts - _LAST_COLLECT_TS[clean_url]) < 30.0:  # 30-second cache window
            return []

    _LAST_COLLECT_TS[clean_url] = now_ts
    new_events: List[Dict[str, Any]] = []


    # 1. PR Intelligence SSoT (Step 42)
    try:
        pr_data = generate_pull_request_intelligence(clean_url, pr_id="101")
        pr_decision = pr_data.get("pr_decision_gate", {})
        if pr_decision.get("decision") in ["NEEDS_REVIEW", "REJECTED"]:
            evt = create_event(
                event_type="PR_HIGH_RISK",
                severity="CRITICAL" if pr_decision.get("decision") == "REJECTED" else "HIGH",
                repository_url=clean_url,
                title=f"PR Gate Warning: {pr_decision.get('decision')}",
                summary=pr_data.get("executive_summary", "PR exhibits elevated risk"),
                payload={"pr_id": "101", "decision": pr_decision.get("decision"), "risk_score": pr_data.get("risk_score")},
                source_engine="pull_request_intelligence.py (Step 42 SSoT)",
                key_detail="pr_101_" + str(pr_decision.get("decision")),
            )
            if evt:
                new_events.append(evt)
    except Exception:
        pass

    # 2. Release Risk Gate SSoT (Step 33)
    try:
        rel_data = evaluate_release_readiness(clean_url)
        if rel_data.get("release_gate_status") == "BLOCKED":
            evt = create_event(
                event_type="RELEASE_GATE_BLOCKED",
                severity="CRITICAL",
                repository_url=clean_url,
                title="Release Gate BLOCKED",
                summary="Release readiness evaluation failed critical safety criteria.",
                payload=rel_data,
                source_engine="release_gating.py (Step 33 SSoT)",
                key_detail="release_blocked",
            )
            if evt:
                new_events.append(evt)
    except Exception:
        pass

    # 3. Governance SSoT (Step 34)
    try:
        gov_data = generate_engineering_governance_report(clean_url)
        gov_score = gov_data.get("governance_score", {}).get("overall_score", 100)
        if gov_score < 75.0:
            evt = create_event(
                event_type="GOVERNANCE_VIOLATION",
                severity="HIGH" if gov_score < 60 else "MEDIUM",
                repository_url=clean_url,
                title="Engineering Governance Compliance Gap",
                summary=f"Governance score ({gov_score}/100) is below organizational compliance threshold (75/100).",
                payload={"governance_score": gov_score},
                source_engine="engineering_governance.py (Step 34 SSoT)",
                key_detail=f"gov_score_{int(gov_score)}",
            )
            if evt:
                new_events.append(evt)
    except Exception:
        pass

    # 4. Architecture Intelligence SSoT (Step 47)
    try:
        arch_data = analyze_repository_architecture(clean_url)
        arch_health = arch_data.get("architectural_health_score", 100)
        cycles_cnt = arch_data.get("metrics", {}).get("cyclic_dependencies_count", 0)

        if arch_health < 70 or cycles_cnt > 0:
            evt = create_event(
                event_type="ARCH_CRITICAL_HEALTH",
                severity="CRITICAL" if arch_health < 50 else "HIGH",
                repository_url=clean_url,
                title="Architecture Health Warning",
                summary=f"Architectural Health ({arch_health}/100) exhibits issues with {cycles_cnt} cyclic dependencies.",
                payload={"architectural_health_score": arch_health, "cyclic_dependencies_count": cycles_cnt},
                source_engine="architecture_intelligence.py (Step 47 SSoT)",
                key_detail=f"arch_{arch_health}_{cycles_cnt}",
            )
            if evt:
                new_events.append(evt)
    except Exception:
        pass

    # 5. Repository Health / Regression Risk SSoT (Step 40)
    try:
        ssot_data = get_unified_engineering_intelligence(clean_url)
        canon = ssot_data.get("canonical_metrics", {})
        reg_risk = canon.get("regression_risk", 0)

        if reg_risk >= 60.0:
            evt = create_event(
                event_type="REGRESSION_RISK_BREACH",
                severity="HIGH",
                repository_url=clean_url,
                title="Regression Risk Threshold Breach",
                summary=f"Repository regression risk ({reg_risk}/100) exceeded safety threshold (60/100).",
                payload={"regression_risk": reg_risk},
                source_engine="unified_engineering_intelligence.py (Step 40 SSoT)",
                key_detail=f"risk_breach_{int(reg_risk)}",
            )
            if evt:
                new_events.append(evt)
    except Exception:
        pass

    # 6. Repository Monitoring Alert Notifications (Step 31)
    try:
        alerts_data = generate_alert_notifications(clean_url)
        for notif in alerts_data.get("notifications", []):
            if notif.get("severity") in ["CRITICAL", "HIGH"]:
                evt = create_event(
                    event_type="REPO_HEALTH_DEGRADED",
                    severity=notif.get("severity", "HIGH"),
                    repository_url=clean_url,
                    title=notif.get("title", "Repository Monitor Alert"),
                    summary=notif.get("explanation", "Detected risk threshold breach in repository analysis."),
                    payload=notif,
                    source_engine="alert_notifications.py (Step 31 SSoT)",
                    key_detail=notif.get("id", "alert_notif"),
                )
                if evt:
                    new_events.append(evt)
    except Exception:
        pass

    return new_events


def get_notification_events(
    repository_url: Optional[str] = None,
    severity_filter: Optional[str] = None,
    event_type_filter: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """Returns stored notification events matching filters."""
    # Run SSoT collection first to ensure fresh events
    collect_events_from_ssot(repository_url)

    events = list(_EVENTS_STORE)
    if repository_url:
        clean_url = repository_url.strip().lower()
        events = [e for e in events if e.get("repository_url", "").lower() == clean_url]

    if severity_filter and severity_filter.strip().upper() != "ALL":
        sev = severity_filter.strip().upper()
        events = [e for e in events if e.get("severity") == sev]

    if event_type_filter and event_type_filter.strip().upper() != "ALL":
        e_type = event_type_filter.strip().upper()
        events = [e for e in events if e.get("event_type") == e_type]

    # Return most recent events first
    events.reverse()
    return events[:limit]


def get_notification_preferences(user_id: str) -> Dict[str, Any]:
    """Gets notification preferences for a user."""
    return _PREFERENCES_STORE.get(user_id, {
        "user_id": user_id,
        "email_notifications_enabled": True,
        "webhook_notifications_enabled": True,
        "min_severity": "HIGH",
        "subscribed_event_types": [
            "PR_HIGH_RISK",
            "RELEASE_GATE_BLOCKED",
            "GOVERNANCE_VIOLATION",
            "ARCH_CRITICAL_HEALTH",
            "REGRESSION_RISK_BREACH",
            "REPO_HEALTH_DEGRADED",
        ],
        "digest_frequency": "REALTIME",
    })


def update_notification_preferences(user_id: str, prefs: Dict[str, Any]) -> Dict[str, Any]:
    """Updates notification preferences for a user."""
    cur = get_notification_preferences(user_id)
    cur.update(prefs)
    cur["user_id"] = user_id
    cur["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    _PREFERENCES_STORE[user_id] = cur
    return cur
