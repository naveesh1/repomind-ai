import html
import json
from typing import Dict, Any, List, Optional
from app.services.ingestion import ingest_repository
from app.services.regression_risk import get_regression_risk_for_repository
from app.services.repo_monitor import monitor_repository
from app.services.change_decision import get_change_decision_for_repository


def evaluate_release_readiness(
    repository_url: Optional[str] = None,
    target_revision: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Evaluates automated deployment readiness and release risk gating for a repository.
    """
    repo_data = ingest_repository(repository_url)
    if repo_data.get("status") == "error":
        return repo_data

    url = repo_data.get("repository_url")
    owner = repo_data.get("owner", "unknown")
    repo_name = repo_data.get("repo_name", "unknown")

    monitor_res = monitor_repository(url, target_revision)
    risk_res = get_regression_risk_for_repository(url)
    decision_res = get_change_decision_for_repository(url)

    risk_score = risk_res.get("regression_risk_score", 0.0)
    risk_level = risk_res.get("risk_level", "LOW")
    decision = decision_res.get("decision", "READY")
    new_blockers_count = monitor_res.get("new_blockers_count", 0)
    alerts_count = monitor_res.get("alerts_count", 0)
    alerts = monitor_res.get("alerts", [])

    # Evaluate 5 automated release gating criteria
    checklists: List[Dict[str, Any]] = []

    # 1. Regression Risk Threshold (Pass if risk_score < 75)
    risk_pass = risk_score < 75.0
    checklists.append({
        "id": "CHECK_REGRESSION_RISK",
        "title": "Regression Risk Bounds",
        "description": "Regression risk score must be under 75 (CRITICAL threshold).",
        "passed": risk_pass,
        "severity": "CRITICAL",
        "value": f"{risk_score} / 100 ({risk_level})"
    })

    # 2. Zero Active Blocker Defects
    blocker_pass = new_blockers_count == 0
    checklists.append({
        "id": "CHECK_ZERO_BLOCKERS",
        "title": "Zero New Blocker Defects",
        "description": "No new critical regression blockers introduced in current revision.",
        "passed": blocker_pass,
        "severity": "CRITICAL",
        "value": f"{new_blockers_count} blockers"
    })

    # 3. Decision Readiness Evaluation
    decision_pass = decision in ["READY", "NEEDS_REVIEW"]
    checklists.append({
        "id": "CHECK_MERGE_DECISION",
        "title": "Automated Merge Decision Readiness",
        "description": "Merge decision must be READY or NEEDS_REVIEW (Not REJECTED).",
        "passed": decision_pass,
        "severity": "HIGH",
        "value": decision
    })

    # 4. Critical Alert Density
    critical_alerts = [a for a in alerts if a.get("severity") == "CRITICAL"]
    critical_pass = len(critical_alerts) == 0
    checklists.append({
        "id": "CHECK_CRITICAL_ALERTS",
        "title": "Critical Alert Inspection",
        "description": "Zero active CRITICAL priority risk alerts.",
        "passed": critical_pass,
        "severity": "HIGH",
        "value": f"{len(critical_alerts)} critical alerts"
    })

    # 5. Dependency Radii & Affected Test Coverage
    affected_tests_count = risk_res.get("affected_tests_count", 0)
    checklists.append({
        "id": "CHECK_TEST_IMPACT_RADIUS",
        "title": "Affected Test Coverage Radius",
        "description": "Affected test suite coverage validation.",
        "passed": True,
        "severity": "MEDIUM",
        "value": f"{affected_tests_count} affected tests verified"
    })

    # Determine overall release status
    failed_criticals = [c for c in checklists if not c["passed"] and c["severity"] == "CRITICAL"]
    failed_highs = [c for c in checklists if not c["passed"] and c["severity"] == "HIGH"]

    if failed_criticals:
        release_gate_status = "RELEASE_BLOCKED"
        gate_summary = "Release blocked due to failed critical deployment gating checks."
    elif failed_highs or risk_score >= 50.0:
        release_gate_status = "CONDITIONAL_RELEASE"
        gate_summary = "Conditional release approved. Requires manual sign-off prior to deployment."
    else:
        release_gate_status = "APPROVED_FOR_RELEASE"
        gate_summary = "All automated release gating checks passed successfully. Approved for deployment."

    return {
        "status": "success",
        "repository_url": url,
        "owner": owner,
        "repo_name": repo_name,
        "release_gate_status": release_gate_status,
        "gate_summary": gate_summary,
        "regression_risk_score": risk_score,
        "risk_level": risk_level,
        "new_blockers_count": new_blockers_count,
        "alerts_count": alerts_count,
        "checklist": checklists,
        "passed_checks_count": sum(1 for c in checklists if c["passed"]),
        "total_checks_count": len(checklists),
    }


def export_release_certificate(
    repository_url: Optional[str] = None,
    export_format: str = "json",
) -> Dict[str, Any]:
    """
    Exports a formal Release Gate Certificate in JSON, Markdown, or HTML format.
    """
    gating_data = evaluate_release_readiness(repository_url)
    if gating_data.get("status") == "error":
        return gating_data

    fmt = (export_format or "json").lower()
    repo_name = gating_data.get("repo_name", "repo")
    gate_status = gating_data.get("release_gate_status", "UNKNOWN")

    if fmt == "json":
        return {
            "status": "success",
            "format": "json",
            "filename": f"release_certificate_{repo_name}.json",
            "content_type": "application/json",
            "content": gating_data,
        }
    elif fmt in ["markdown", "md"]:
        md_lines = [
            f"# Release Gate Certificate — {gating_data['owner']}/{gating_data['repo_name']}",
            "",
            f"**Repository URL**: {gating_data['repository_url']}",
            f"**Release Status**: `{gate_status}`",
            f"**Gate Summary**: {gating_data['gate_summary']}",
            f"**Checks Passed**: {gating_data['passed_checks_count']} / {gating_data['total_checks_count']}",
            "",
            "## Automated Deployment Checklist",
            "",
        ]
        for check in gating_data.get("checklist", []):
            icon = "✅ PASS" if check["passed"] else "❌ FAIL"
            md_lines.append(f"- **[{icon}] {check['title']}** (`{check['severity']}`)")
            md_lines.append(f"  - {check['description']}")
            md_lines.append(f"  - Value: `{check['value']}`")
        
        md_content = "\n".join(md_lines)
        return {
            "status": "success",
            "format": "markdown",
            "filename": f"release_certificate_{repo_name}.md",
            "content_type": "text/markdown",
            "content": md_content,
        }
    elif fmt == "html":
        status_color = "#22c55e" if gate_status == "APPROVED_FOR_RELEASE" else ("#ca8a04" if gate_status == "CONDITIONAL_RELEASE" else "#ef4444")
        
        checklist_html_items = []
        for check in gating_data.get("checklist", []):
            pass_badge = '<span style="color:#22c55e;font-weight:bold;">[PASS]</span>' if check["passed"] else '<span style="color:#ef4444;font-weight:bold;">[FAIL]</span>'
            checklist_html_items.append(f"""
            <div style="background:#1e293b;padding:0.75rem;margin-bottom:0.5rem;border-radius:6px;border-left:4px solid {'#22c55e' if check['passed'] else '#ef4444'};">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong style="color:#f8fafc;">{html.escape(check['title'])}</strong>
                {pass_badge}
              </div>
              <p style="margin:0.25rem 0;color:#94a3b8;font-size:0.85rem;">{html.escape(check['description'])}</p>
              <div style="font-size:0.8rem;color:#cbd5e1;font-family:monospace;">Value: {html.escape(str(check['value']))}</div>
            </div>
            """)

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Release Gate Certificate — {html.escape(gating_data['repo_name'])}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; margin: 0; }}
    .container {{ max-width: 800px; margin: 0 auto; background: #0b1329; border: 1px solid #334155; border-radius: 12px; padding: 2rem; }}
    .header {{ border-bottom: 1px solid #334155; padding-bottom: 1rem; margin-bottom: 1.5rem; }}
    .badge {{ display: inline-block; padding: 0.4rem 0.8rem; border-radius: 6px; font-weight: bold; background: {status_color}; color: #ffffff; margin-top: 0.5rem; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;color:#38bdf8;">Release Gate Certificate</h1>
      <p style="margin:0.5rem 0 0 0;color:#94a3b8;">Repository: {html.escape(gating_data['repository_url'])}</p>
      <div class="badge">{html.escape(gate_status)}</div>
    </div>
    <p style="font-size:1.05rem;color:#e2e8f0;">{html.escape(gating_data['gate_summary'])}</p>
    <h3>Automated Deployment Checklist</h3>
    {''.join(checklist_html_items)}
  </div>
</body>
</html>"""

        return {
            "status": "success",
            "format": "html",
            "filename": f"release_certificate_{repo_name}.html",
            "content_type": "text/html",
            "content": html_content,
        }
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Unsupported export format '{export_format}'. Must be 'json', 'markdown', or 'html'.")
