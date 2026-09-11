import html
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException

from app.services.repo_monitor import monitor_repository
from app.services.ingestion import get_last_analyzed_repo_url, parse_github_url


VALID_SEVERITIES = {"CRITICAL", "HIGH", "MEDIUM", "LOW"}
VALID_EXPORT_FORMATS = {"json", "markdown", "html"}


def generate_alert_notifications(
    repository_url: Optional[str] = None,
    target_revision: Optional[str] = None,
    severity_filter: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Step 31: Generate structured alert notification payloads from Step 30 monitoring data.
    Supports severity filtering (CRITICAL, HIGH, MEDIUM, LOW, ALL).
    """
    monitor_data = monitor_repository(repository_url, target_revision)

    if severity_filter and severity_filter.strip():
        sev_clean = severity_filter.strip().upper()
        if sev_clean != "ALL" and sev_clean not in VALID_SEVERITIES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid severity_filter parameter: '{severity_filter}'. Supported values: ALL, CRITICAL, HIGH, MEDIUM, LOW.",
            )
    else:
        sev_clean = "ALL"

    alerts = monitor_data.get("alerts", [])
    if sev_clean != "ALL":
        filtered_alerts = [a for a in alerts if a.get("severity") == sev_clean]
    else:
        filtered_alerts = alerts

    # Sort deterministically by severity priority: CRITICAL > HIGH > MEDIUM > LOW
    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    filtered_alerts.sort(key=lambda x: severity_order.get(x.get("severity", "LOW"), 4))

    risk_summary = monitor_data.get("risk_summary", {})
    test_summary = monitor_data.get("test_impact_summary", {})
    decision_summary = monitor_data.get("decision_summary", {})

    notifications: List[Dict[str, Any]] = []
    for idx, alert in enumerate(filtered_alerts):
        notif = {
            "id": alert.get("id", f"notif-{idx}"),
            "repository_url": monitor_data.get("repository_url"),
            "owner": monitor_data.get("owner"),
            "repository_name": monitor_data.get("repository_name"),
            "previous_revision": monitor_data.get("previous_analyzed_revision"),
            "current_revision": monitor_data.get("current_analyzed_revision"),
            "latest_revision": monitor_data.get("latest_available_revision"),
            "monitoring_status": monitor_data.get("monitoring_status"),
            "timestamp": monitor_data.get("last_analysis_timestamp"),
            "severity": alert.get("severity"),
            "title": alert.get("title"),
            "explanation": alert.get("explanation"),
            "related_files": alert.get("related_files", []),
            "risk_information": alert.get("related_info"),
            "previous_risk_score": risk_summary.get("previous_score"),
            "current_risk_score": risk_summary.get("current_score"),
            "risk_delta": risk_summary.get("score_delta"),
            "risk_trend": risk_summary.get("risk_trend"),
            "previous_risk_level": risk_summary.get("previous_level"),
            "current_risk_level": risk_summary.get("current_level"),
            "affected_tests_count": test_summary.get("total_affected_tests", 0),
            "new_p0_tests_count": test_summary.get("new_p0_tests_count", 0),
            "new_p1_tests_count": test_summary.get("new_p1_tests_count", 0),
            "decision": decision_summary.get("decision"),
            "merge_readiness": decision_summary.get("merge_readiness"),
            "blockers_count": decision_summary.get("new_blockers_count", 0),
            "blockers": decision_summary.get("blockers", []),
            "recommended_action": alert.get("recommended_action"),
        }
        notifications.append(notif)

    return {
        "status": "success",
        "repository_url": monitor_data.get("repository_url"),
        "owner": monitor_data.get("owner"),
        "repository_name": monitor_data.get("repository_name"),
        "monitoring_status": monitor_data.get("monitoring_status"),
        "timestamp": monitor_data.get("last_analysis_timestamp"),
        "severity_filter": sev_clean,
        "total_alerts_count": len(alerts),
        "filtered_alerts_count": len(notifications),
        "notifications": notifications,
    }


def export_monitoring_audit_report(
    repository_url: Optional[str] = None,
    target_revision: Optional[str] = None,
    export_format: Optional[str] = "json",
) -> Dict[str, Any]:
    """
    Step 31: Export monitoring audit report in JSON, Markdown, or HTML format.
    Summarizes repository, revisions, risk deltas, change metrics, test impact, decision shifts, and alerts.
    """
    fmt = (export_format or "json").strip().lower()
    if fmt not in VALID_EXPORT_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported export format: '{export_format}'. Supported formats: json, markdown, html.",
        )

    monitor_data = monitor_repository(repository_url, target_revision)
    repo_name = monitor_data.get("repository_name", "repository")
    timestamp = monitor_data.get("last_analysis_timestamp")

    if fmt == "json":
        report_content = {
            "report_title": "Repository Monitoring Audit Report",
            "generated_at": timestamp,
            "repository": {
                "url": monitor_data.get("repository_url"),
                "owner": monitor_data.get("owner"),
                "name": repo_name,
            },
            "revisions": {
                "previous_analyzed_revision": monitor_data.get("previous_analyzed_revision"),
                "current_analyzed_revision": monitor_data.get("current_analyzed_revision"),
                "latest_available_revision": monitor_data.get("latest_available_revision"),
                "monitoring_status": monitor_data.get("monitoring_status"),
            },
            "risk_transition": monitor_data.get("risk_summary", {}),
            "change_metrics": monitor_data.get("diff_metrics", {}),
            "test_impact": monitor_data.get("test_impact_summary", {}),
            "decision": monitor_data.get("decision_summary", {}),
            "alerts": monitor_data.get("alerts", []),
        }
        return {
            "status": "success",
            "format": "json",
            "content_type": "application/json",
            "filename": f"{repo_name}_monitoring_audit.json",
            "content": report_content,
        }

    risk_sum = monitor_data.get("risk_summary", {})
    diff_sum = monitor_data.get("diff_metrics", {})
    test_sum = monitor_data.get("test_impact_summary", {})
    dec_sum = monitor_data.get("decision_summary", {})
    alerts = monitor_data.get("alerts", [])

    if fmt == "markdown":
        lines = [
            f"# Repository Monitoring Audit Report — {repo_name}",
            "",
            "## Repository Information",
            f"- **Repository URL**: `{monitor_data.get('repository_url')}`",
            f"- **Owner**: `{monitor_data.get('owner')}`",
            f"- **Repository Name**: `{repo_name}`",
            f"- **Generated At**: `{timestamp}`",
            "",
            "## Revision Transition",
            f"- **Previous Revision**: `{monitor_data.get('previous_analyzed_revision')}`",
            f"- **Current Revision**: `{monitor_data.get('current_analyzed_revision')}`",
            f"- **Latest Revision**: `{monitor_data.get('latest_available_revision')}`",
            f"- **Monitoring Status**: `{monitor_data.get('monitoring_status')}`",
            "",
            "## Risk Transition",
            f"- **Previous Risk Score**: `{risk_sum.get('previous_score')}` ({risk_sum.get('previous_level')})",
            f"- **Current Risk Score**: `{risk_sum.get('current_score')}` ({risk_sum.get('current_level')})",
            f"- **Risk Delta**: `{risk_sum.get('display_delta')}`",
            f"- **Risk Trend**: `{risk_sum.get('risk_trend')}`",
            "",
            "## Change Summary",
            f"- **Files Changed**: `{diff_sum.get('changed_files_count', 0)}`",
            f"- **Added Files**: `{diff_sum.get('added_files_count', 0)}`",
            f"- **Modified Files**: `{diff_sum.get('modified_files_count', 0)}`",
            f"- **Deleted Files**: `{diff_sum.get('deleted_files_count', 0)}`",
            f"- **Renamed Files**: `{diff_sum.get('renamed_files_count', 0)}`",
            f"- **Line Additions**: `+{diff_sum.get('additions', 0)}`",
            f"- **Line Deletions**: `-{diff_sum.get('deletions', 0)}`",
            "",
            "## Test Impact",
            f"- **New P0 Tests**: `{test_sum.get('new_p0_tests_count', 0)}`",
            f"- **New P1 Tests**: `{test_sum.get('new_p1_tests_count', 0)}`",
            f"- **Total Affected Tests**: `{test_sum.get('total_affected_tests', 0)}`",
            "",
            "## Decision Engine",
            f"- **Decision**: `{dec_sum.get('decision')}`",
            f"- **Merge Readiness**: `{dec_sum.get('merge_readiness')}`",
            f"- **New Blockers**: `{dec_sum.get('new_blockers_count', 0)}`",
            f"- **New Warnings**: `{dec_sum.get('new_warnings_count', 0)}`",
            "",
            f"## Prioritized Risk & Impact Alerts ({len(alerts)})",
        ]

        for a in alerts:
            rel_files = ", ".join([str(f) for f in a.get("related_files", []) if f is not None]) or "None"
            lines.extend([
                f"### [{a.get('severity')}] {a.get('title')}",
                f"- **Explanation**: {a.get('explanation')}",
                f"- **Related Info**: {a.get('related_info')}",
                f"- **Recommended Action**: {a.get('recommended_action')}",
                f"- **Related Files**: {rel_files}",
                "",
            ])

        md_content = "\n".join(lines)
        return {
            "status": "success",
            "format": "markdown",
            "content_type": "text/markdown",
            "filename": f"{repo_name}_monitoring_audit.md",
            "content": md_content,
        }

    # HTML Export with safe HTML escaping for dynamic text
    def safe(text: Any) -> str:
        return html.escape(str(text if text is not None else ""))

    alerts_html_items = []
    for a in alerts:
        sev = safe(a.get("severity"))
        sev_class = sev.lower()
        title = safe(a.get("title"))
        explanation = safe(a.get("explanation"))
        info = safe(a.get("related_info"))
        action = safe(a.get("recommended_action"))
        rel_files = ", ".join([safe(f) for f in a.get("related_files", [])]) or "None"

        alerts_html_items.append(f"""
        <div class="alert-card alert-{sev_class}">
          <div class="alert-header">
            <span class="badge badge-{sev_class}">{sev}</span>
            <strong class="alert-title">{title}</strong>
          </div>
          <p class="alert-explanation">{explanation}</p>
          <div class="alert-meta">
            <div><strong>Related Info:</strong> {info}</div>
            <div><strong>Related Files:</strong> {rel_files}</div>
            <div><strong>Recommended Action:</strong> {action}</div>
          </div>
        </div>
        """)

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Repository Monitoring Audit Report — {safe(repo_name)}</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background-color: #f8fafc;
      margin: 0;
      padding: 2rem;
    }}
    .container {{
      max-width: 960px;
      margin: 0 auto;
      background: #ffffff;
      padding: 2.5rem;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }}
    h1 {{ color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }}
    h2 {{ color: #334155; margin-top: 1.8rem; font-size: 1.3rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.3rem; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-top: 1rem; }}
    .card {{ background: #f1f5f9; padding: 1rem; border-radius: 8px; font-size: 0.95rem; }}
    .card-label {{ font-size: 0.8rem; text-transform: uppercase; color: #64748b; font-weight: 600; display: block; }}
    .card-value {{ font-size: 1.1rem; font-weight: 700; color: #0f172a; margin-top: 0.2rem; }}
    .alert-card {{ border: 1px solid #cbd5e1; border-left-width: 6px; padding: 1.2rem; border-radius: 6px; margin-bottom: 1rem; background: #ffffff; }}
    .alert-critical {{ border-left-color: #ef4444; background: #fef2f2; }}
    .alert-high {{ border-left-color: #f97316; background: #fff7ed; }}
    .alert-medium {{ border-left-color: #eab308; background: #fefce8; }}
    .alert-low {{ border-left-color: #3b82f6; background: #eff6ff; }}
    .badge {{ display: inline-block; padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; color: #fff; }}
    .badge-critical {{ background: #ef4444; }}
    .badge-high {{ background: #f97316; }}
    .badge-medium {{ background: #d97706; }}
    .badge-low {{ background: #3b82f6; }}
    .alert-header {{ display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }}
    .alert-explanation {{ margin: 0.5rem 0; color: #334155; }}
    .alert-meta {{ font-size: 0.88rem; color: #475569; margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem; }}
  </style>
</head>
<body>
  <div class="container">
    <h1>Repository Monitoring Audit Report</h1>
    <p><strong>Repository:</strong> {safe(monitor_data.get('repository_url'))} | <strong>Owner:</strong> {safe(monitor_data.get('owner'))} | <strong>Report Date:</strong> {safe(timestamp)}</p>

    <h2>Revision &amp; Risk Overview</h2>
    <div class="grid">
      <div class="card">
        <span class="card-label">Monitoring Status</span>
        <div class="card-value">{safe(monitor_data.get('monitoring_status'))}</div>
      </div>
      <div class="card">
        <span class="card-label">Revisions</span>
        <div class="card-value" style="font-size:0.95rem;">{safe(monitor_data.get('previous_analyzed_revision'))[:7]} &rarr; {safe(monitor_data.get('latest_available_revision'))[:7]}</div>
      </div>
      <div class="card">
        <span class="card-label">Risk Delta</span>
        <div class="card-value">{safe(risk_sum.get('previous_score'))} &rarr; {safe(risk_sum.get('current_score'))} ({safe(risk_sum.get('display_delta'))})</div>
      </div>
      <div class="card">
        <span class="card-label">Merge Decision</span>
        <div class="card-value">{safe(dec_sum.get('decision'))}</div>
      </div>
    </div>

    <h2>Change &amp; Test Impact Summary</h2>
    <div class="grid">
      <div class="card">
        <span class="card-label">Files Changed</span>
        <div class="card-value">{safe(diff_sum.get('changed_files_count', 0))} (+{safe(diff_sum.get('additions', 0))} / -{safe(diff_sum.get('deletions', 0))})</div>
      </div>
      <div class="card">
        <span class="card-label">New P0 Tests</span>
        <div class="card-value">{safe(test_sum.get('new_p0_tests_count', 0))}</div>
      </div>
      <div class="card">
        <span class="card-label">New P1 Tests</span>
        <div class="card-value">{safe(test_sum.get('new_p1_tests_count', 0))}</div>
      </div>
      <div class="card">
        <span class="card-label">New Blockers</span>
        <div class="card-value">{safe(dec_sum.get('new_blockers_count', 0))}</div>
      </div>
    </div>

    <h2>Prioritized Risk &amp; Impact Alerts ({len(alerts)})</h2>
    {"".join(alerts_html_items)}
  </div>
</body>
</html>
"""

    return {
        "status": "success",
        "format": "html",
        "content_type": "text/html",
        "filename": f"{repo_name}_monitoring_audit.html",
        "content": html_content,
    }


def get_notification_history(
    repository_url: Optional[str] = None,
    severity_filter: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Step 31: Return active alert notification settings and deterministic state representation.
    """
    return generate_alert_notifications(
        repository_url=repository_url,
        target_revision=None,
        severity_filter=severity_filter,
    )
