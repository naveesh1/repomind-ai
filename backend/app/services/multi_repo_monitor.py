"""
Step 32: Multi-Repository Monitoring Dashboard & Aggregate Risk Intelligence Engine

Tracks multiple public GitHub repositories concurrently, aggregates cross-repository
regression risk metrics, filters monitored repositories by status, and exports
multi-repository audit reports (JSON, Markdown, HTML).
"""

import html
from typing import List, Dict, Any, Optional
from fastapi import HTTPException

from app.services.ingestion import get_last_analyzed_repo_url
from app.services.repo_monitor import monitor_repository

# In-memory store for multi-repository monitoring URLs
_MULTI_REPO_STORE: List[str] = [
    "https://github.com/psf/requests",
    "https://github.com/pallets/flask",
]


def track_multi_repositories(repo_urls: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Step 32: Ingest and monitor multiple public GitHub repositories concurrently.
    Returns aggregate cross-repository metrics and individual repository cards.
    """
    global _MULTI_REPO_STORE

    urls_to_process = repo_urls if repo_urls is not None and len(repo_urls) > 0 else list(_MULTI_REPO_STORE)
    
    # Also include last analyzed repo URL if present
    last_url = get_last_analyzed_repo_url()
    if last_url and last_url not in urls_to_process:
        urls_to_process.append(last_url)

    # De-duplicate while preserving order
    unique_urls = []
    for u in urls_to_process:
        if u and isinstance(u, str):
            norm_u = u.strip()
            if norm_u and norm_u not in unique_urls:
                unique_urls.append(norm_u)

    if not unique_urls:
        raise HTTPException(
            status_code=400,
            detail="No valid repository URLs provided for multi-repository monitoring.",
        )

    # Update in-memory store
    for u in unique_urls:
        if u not in _MULTI_REPO_STORE:
            _MULTI_REPO_STORE.append(u)

    repo_results: List[Dict[str, Any]] = []
    total_blockers = 0
    total_alerts = 0
    high_risk_count = 0
    status_dist = {"NO_CHANGE": 0, "CHANGES_DETECTED": 0, "ERROR": 0}

    for url in unique_urls:
        try:
            mon = monitor_repository(repository_url=url)
            dec = mon.get("decision_summary", {})
            risk = mon.get("risk_score_summary", {})
            alerts = mon.get("alerts", [])
            status = mon.get("monitoring_status", "NO_CHANGE")

            blockers_count = dec.get("new_blockers_count", 0)
            total_blockers += blockers_count
            total_alerts += len(alerts)

            curr_score = risk.get("current_score", 0)
            is_high_risk = curr_score >= 50 or dec.get("decision") in ["NEEDS_REVIEW", "BLOCKED"]
            if is_high_risk:
                high_risk_count += 1

            if status in status_dist:
                status_dist[status] += 1
            else:
                status_dist[status] = 1

            repo_results.append({
                "repository_url": url,
                "owner": mon.get("owner"),
                "repo_name": mon.get("repo_name"),
                "previous_revision": mon.get("previous_analyzed_revision"),
                "latest_revision": mon.get("latest_available_revision"),
                "monitoring_status": status,
                "risk_score": curr_score,
                "risk_delta": risk.get("display_delta"),
                "risk_level": risk.get("current_level"),
                "decision": dec.get("decision"),
                "blockers_count": blockers_count,
                "alerts_count": len(alerts),
                "alerts": alerts,
            })
        except Exception:
            status_dist["ERROR"] = status_dist.get("ERROR", 0) + 1
            repo_results.append({
                "repository_url": url,
                "owner": "unknown",
                "repo_name": url.split("/")[-1] if "/" in url else url,
                "previous_revision": "N/A",
                "latest_revision": "N/A",
                "monitoring_status": "ERROR",
                "risk_score": 0,
                "risk_delta": "0",
                "risk_level": "UNKNOWN",
                "decision": "NEEDS_REVIEW",
                "blockers_count": 0,
                "alerts_count": 0,
                "alerts": [],
            })

    return {
        "status": "success",
        "total_monitored_repositories": len(repo_results),
        "high_risk_repositories_count": high_risk_count,
        "total_new_blockers": total_blockers,
        "total_alerts_count": total_alerts,
        "status_distribution": status_dist,
        "repositories": repo_results,
    }


def get_multi_repository_summary() -> Dict[str, Any]:
    """
    Step 32: Returns aggregate monitoring summary for stored multi-repository list.
    """
    return track_multi_repositories(repo_urls=_MULTI_REPO_STORE)


def export_multi_repo_audit_report(
    repo_urls: Optional[List[str]] = None,
    export_format: str = "json",
) -> Dict[str, Any]:
    """
    Step 32: Exports aggregate multi-repository monitoring audit report in JSON, Markdown, or HTML format.
    """
    fmt = (export_format or "json").lower().strip()
    if fmt not in ["json", "markdown", "html"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported export format '{export_format}'. Supported formats are: json, markdown, html.",
        )

    data = track_multi_repositories(repo_urls=repo_urls)
    total_repos = data.get("total_monitored_repositories", 0)
    high_risk = data.get("high_risk_repositories_count", 0)
    total_blockers = data.get("total_new_blockers", 0)
    total_alerts = data.get("total_alerts_count", 0)
    repos = data.get("repositories", [])

    if fmt == "json":
        return {
            "status": "success",
            "format": "json",
            "content_type": "application/json",
            "filename": "multi_repository_audit_report.json",
            "content": data,
        }

    if fmt == "markdown":
        lines = [
            "# Multi-Repository Monitoring Audit Report",
            "",
            "## Aggregate Executive Overview",
            f"- **Total Monitored Repositories**: `{total_repos}`",
            f"- **High-Risk Repositories**: `{high_risk}`",
            f"- **Total New Blockers**: `{total_blockers}`",
            f"- **Total Active Alerts**: `{total_alerts}`",
            "",
            "## Monitored Repositories Summary",
        ]
        for r in repos:
            lines.extend([
                f"### {r.get('repo_name')} ({r.get('owner')})",
                f"- **URL**: {r.get('repository_url')}",
                f"- **Status**: `{r.get('monitoring_status')}`",
                f"- **Revisions**: `{str(r.get('previous_revision'))[:7]}` &rarr; `{str(r.get('latest_revision'))[:7]}`",
                f"- **Risk Level**: `{r.get('risk_level')}` (Score: {r.get('risk_score')}, Delta: {r.get('risk_delta')})",
                f"- **Merge Decision**: `{r.get('decision')}`",
                f"- **Alerts Count**: `{r.get('alerts_count')}`",
                "",
            ])

        md_content = "\n".join(lines)
        return {
            "status": "success",
            "format": "markdown",
            "content_type": "text/markdown",
            "filename": "multi_repository_audit_report.md",
            "content": md_content,
        }

    # HTML Export with strict html.escape()
    def safe(text: Any) -> str:
        return html.escape(str(text if text is not None else ""))

    cards_html = []
    for r in repos:
        name = safe(r.get("repo_name"))
        owner = safe(r.get("owner"))
        url = safe(r.get("repository_url"))
        status = safe(r.get("monitoring_status"))
        score = safe(r.get("risk_score"))
        level = safe(r.get("risk_level"))
        dec = safe(r.get("decision"))
        alerts_cnt = safe(r.get("alerts_count"))
        prev_rev = safe(r.get("previous_revision"))[:7]
        next_rev = safe(r.get("latest_revision"))[:7]

        cards_html.append(f"""
        <div class="repo-card">
          <div class="repo-header">
            <h3>{name} <small style="color:#64748b; font-weight:normal;">({owner})</small></h3>
            <span class="badge badge-status">{status}</span>
          </div>
          <p style="font-size:0.85rem; color:#475569;">URL: <a href="{url}" target="_blank">{url}</a></p>
          <div class="repo-grid">
            <div><strong>Revisions:</strong> {prev_rev} &rarr; {next_rev}</div>
            <div><strong>Risk Score:</strong> {score} ({level})</div>
            <div><strong>Decision:</strong> {dec}</div>
            <div><strong>Active Alerts:</strong> {alerts_cnt}</div>
          </div>
        </div>
        """)

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Multi-Repository Monitoring Audit Report</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #0f172a; background: #f8fafc; padding: 2rem; }}
    .container {{ max-width: 1000px; margin: 0 auto; background: #ffffff; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }}
    h1 {{ color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }}
    .summary-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1.5rem 0; }}
    .summary-card {{ background: #f1f5f9; padding: 1rem; border-radius: 8px; font-weight: bold; }}
    .summary-card span {{ display: block; font-size: 0.8rem; color: #64748b; text-transform: uppercase; }}
    .summary-card div {{ font-size: 1.4rem; color: #0f172a; margin-top: 0.2rem; }}
    .repo-card {{ border: 1px solid #cbd5e1; border-radius: 8px; padding: 1.2rem; margin-bottom: 1rem; background: #fff; }}
    .repo-header {{ display: flex; justify-content: space-between; align-items: center; }}
    .repo-header h3 {{ margin: 0; }}
    .badge {{ display: inline-block; padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; background: #e2e8f0; color: #1e293b; }}
    .repo-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.5rem; margin-top: 0.75rem; font-size: 0.9rem; color: #334155; }}
  </style>
</head>
<body>
  <div class="container">
    <h1>Multi-Repository Monitoring Audit Report</h1>
    <div class="summary-grid">
      <div class="summary-card"><span>Total Repositories</span><div>{safe(total_repos)}</div></div>
      <div class="summary-card"><span>High-Risk Repositories</span><div>{safe(high_risk)}</div></div>
      <div class="summary-card"><span>Total Blockers</span><div>{safe(total_blockers)}</div></div>
      <div class="summary-card"><span>Active Alerts</span><div>{safe(total_alerts)}</div></div>
    </div>
    <h2>Monitored Repositories</h2>
    {"".join(cards_html)}
  </div>
</body>
</html>
"""

    return {
        "status": "success",
        "format": "html",
        "content_type": "text/html",
        "filename": "multi_repository_audit_report.html",
        "content": html_content,
    }
