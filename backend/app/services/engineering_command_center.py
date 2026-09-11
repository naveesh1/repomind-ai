import html
import json
import datetime
from typing import Dict, Any, List, Optional

from app.services.ingestion import ingest_repository, get_last_analyzed_repo_url
from app.services.repository_health import get_repository_health_for_url
from app.services.code_quality import get_code_quality_for_url
from app.services.regression_risk import get_regression_risk_for_repository
from app.services.repo_monitor import monitor_repository
from app.services.engineering_governance import generate_engineering_governance_report
from app.services.historical_intelligence import generate_historical_intelligence_report
from app.services.repository_comparison import compare_repositories
from app.services.architecture_intelligence import analyze_repository_architecture


def generate_command_center_report(
    repository_url: Optional[str] = None,
    repository_urls: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Step 37: Engineering Command Center & Executive Product Dashboard Service.
    Aggregates intelligence from Steps 11-36 into a high-level executive engineering command center.
    """
    # Resolve repository list
    clean_urls = []
    seen = set()

    if repository_urls:
        for u in repository_urls:
            if isinstance(u, str) and u.strip():
                s = u.strip()
                if s not in seen:
                    seen.add(s)
                    clean_urls.append(s)

    if repository_url and isinstance(repository_url, str) and repository_url.strip():
        s = repository_url.strip()
        if s not in seen:
            seen.add(s)
            clean_urls.insert(0, s)

    if not clean_urls:
        last_url = get_last_analyzed_repo_url()
        if last_url:
            clean_urls = [last_url, "https://github.com/psf/requests"]
        else:
            clean_urls = ["https://github.com/psf/requests", "https://github.com/pallets/flask"]

    target_url = clean_urls[0]

    # Ingest target repository
    repo_data = ingest_repository(target_url)
    if isinstance(repo_data, dict) and repo_data.get("status") == "error":
        return repo_data

    canonical_url = repo_data.get("repository_url", target_url)
    owner = repo_data.get("owner") or (canonical_url.split("/")[-2] if "/" in canonical_url else "unknown")
    repo_name = repo_data.get("repository_name") or repo_data.get("repo_name") or (canonical_url.split("/")[-1] if "/" in canonical_url else "unknown")
    full_name = f"{owner}/{repo_name}"

    # Collect sub-reports from Steps 11-36 + Step 47 Architecture Intelligence
    gov_report = generate_engineering_governance_report(canonical_url)
    risk_res = get_regression_risk_for_repository(canonical_url)
    health_res = get_repository_health_for_url(canonical_url)
    quality_res = get_code_quality_for_url(canonical_url)
    monitor_res = monitor_repository(canonical_url)
    hist_report = generate_historical_intelligence_report(canonical_url)
    arch_res = analyze_repository_architecture(canonical_url)

    # Multi-repo benchmarking (ensure at least 2 repos for comparison)
    comp_urls = clean_urls if len(clean_urls) >= 2 else [canonical_url, "https://github.com/pallets/flask"]
    comp_report = compare_repositories(comp_urls)

    # Raw metrics extraction
    gov_score = gov_report["governance_score"]["overall_score"] if isinstance(gov_report, dict) and "governance_score" in gov_report and isinstance(gov_report["governance_score"], dict) and "overall_score" in gov_report["governance_score"] else 75.0
    risk_score = risk_res.get("score", risk_res.get("regression_risk_score", 0.0)) if isinstance(risk_res, dict) else 0.0
    health_score = health_res.get("health_score", 80.0) if isinstance(health_res, dict) else 80.0
    quality_score = quality_res.get("quality_score", quality_res.get("code_quality_score", 80.0)) if isinstance(quality_res, dict) else 80.0
    arch_score = float(arch_res.get("architectural_health_score", 80.0)) if isinstance(arch_res, dict) else 80.0

    test_ratio = 0.5
    if isinstance(health_res, dict):
        total_files = health_res.get("total_files", 1)
        test_files = health_res.get("test_files", 0)
        test_ratio = test_files / max(1, total_files)

    testing_health_score = min(100.0, round(test_ratio * 100.0 + 30.0, 1)) if test_ratio > 0 else 40.0
    alerts = monitor_res.get("alerts", []) if isinstance(monitor_res, dict) else []
    active_alerts_count = len(alerts)
    critical_alerts_count = sum(1 for a in alerts if isinstance(a, dict) and a.get("severity") == "CRITICAL")
    high_alerts_count = sum(1 for a in alerts if isinstance(a, dict) and a.get("severity") == "HIGH")

    release_status = "APPROVED_FOR_RELEASE"
    if isinstance(gov_report, dict) and "decision_metrics" in gov_report and isinstance(gov_report["decision_metrics"], dict):
        release_status = gov_report["decision_metrics"].get("release_gate_status", "APPROVED_FOR_RELEASE")

    release_confidence_score = 100.0 if release_status == "APPROVED_FOR_RELEASE" else (65.0 if release_status == "CONDITIONAL_RELEASE" else 30.0)

    # Overall Engineering Score (0-100) - Canonical Alignment
    overall_engineering_score = round(
        health_score * 0.25 +
        (100.0 - risk_score) * 0.25 +
        gov_score * 0.20 +
        quality_score * 0.15 +
        release_confidence_score * 0.15,
        1
    )
    overall_engineering_score = max(0.0, min(100.0, overall_engineering_score))

    # Engineering Health Level Classification
    if overall_engineering_score >= 85.0:
        engineering_health = "EXCELLENT"
    elif overall_engineering_score >= 75.0:
        engineering_health = "HEALTHY"
    elif overall_engineering_score >= 65.0:
        engineering_health = "GOOD"
    elif overall_engineering_score >= 50.0:
        engineering_health = "FAIR"
    else:
        engineering_health = "DEGRADED"

    # Overall System Status
    if critical_alerts_count > 0 or release_status == "RELEASE_BLOCKED" or overall_engineering_score < 40.0:
        system_status = "CRITICAL"
    elif overall_engineering_score < 60.0 or active_alerts_count >= 3:
        system_status = "DEGRADED"
    elif release_status == "CONDITIONAL_RELEASE" or active_alerts_count > 0:
        system_status = "ATTENTION_REQUIRED"
    else:
        system_status = "HEALTHY"

    # Top Engineering Risks (Prioritized list)
    top_risks = []
    if release_status == "RELEASE_BLOCKED":
        top_risks.append({
            "priority": "P0",
            "category": "RELEASE",
            "repository": full_name,
            "metric": "Release Readiness Gate",
            "score": 30.0,
            "explanation": "Deployment release gate is currently BLOCKED due to policy violations or blocker alerts.",
            "recommended_action": "Resolve critical blockers and governance failures before attempting deployment.",
        })

    if critical_alerts_count > 0:
        top_risks.append({
            "priority": "P0",
            "category": "MONITORING",
            "repository": full_name,
            "metric": "Critical Alerts",
            "score": float(critical_alerts_count),
            "explanation": f"Detected {critical_alerts_count} critical monitoring alert(s) requiring immediate attention.",
            "recommended_action": "Inspect active monitoring notifications and apply immediate code/config fixes.",
        })

    if risk_score > 50.0:
        top_risks.append({
            "priority": "P1",
            "category": "RISK",
            "repository": full_name,
            "metric": "Regression Risk",
            "score": risk_score,
            "explanation": f"Elevated regression risk score ({risk_score}/100) indicates high potential impact across dependent modules.",
            "recommended_action": "Execute prioritized unit and integration tests for affected dependency paths.",
        })

    if test_ratio < 0.3:
        top_risks.append({
            "priority": "P1",
            "category": "TESTING",
            "repository": full_name,
            "metric": "Test-to-Source Ratio",
            "score": round(test_ratio, 2),
            "explanation": f"Low test density ratio ({test_ratio:.2f}) increases vulnerability to undetected regressions.",
            "recommended_action": "Increase test coverage for core business logic and entry point functions.",
        })

    if quality_score < 70.0:
        top_risks.append({
            "priority": "P2",
            "category": "CODE_QUALITY",
            "repository": full_name,
            "metric": "Code Quality",
            "score": quality_score,
            "explanation": f"Sub-optimal code quality score ({quality_score}/100) with elevated cyclomatic complexity.",
            "recommended_action": "Refactor complex functions and reduce deep AST nesting in target modules.",
        })

    if not top_risks:
        top_risks.append({
            "priority": "P3",
            "category": "GOVERNANCE",
            "repository": full_name,
            "metric": "Governance Health",
            "score": gov_score,
            "explanation": "No critical or high-severity engineering risks detected across analyzed components.",
            "recommended_action": "Maintain current testing discipline and continuous repository monitoring.",
        })

    # Sort risks deterministically: P0 first, then P1, P2, P3
    priority_map = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}
    top_risks.sort(key=lambda r: (priority_map.get(r["priority"], 99), r["category"]))

    # Prioritized Recommendations
    recommendations = []
    if risk_score > 40.0:
        recommendations.append({
            "priority": "P1",
            "category": "RISK",
            "title": "Mitigate Dependency Radius Risk",
            "explanation": f"Regression risk score is {risk_score}/100.",
            "action": "Run focused test suites on identified high-risk functions before merging changes.",
        })

    if test_ratio < 0.5:
        recommendations.append({
            "priority": "P1",
            "category": "TESTING",
            "title": "Expand Automated Test Suite",
            "explanation": f"Current test-to-source ratio is {test_ratio:.2f}.",
            "action": "Add unit test cases for uncovered AST functions and class methods.",
        })

    if quality_score < 80.0:
        recommendations.append({
            "priority": "P2",
            "category": "CODE_QUALITY",
            "title": "Refactor High-Complexity Functions",
            "explanation": f"Code quality score is {quality_score}/100.",
            "action": "Simplify nested conditional branches and split large functions into smaller helpers.",
        })

    recommendations.append({
        "priority": "P2",
        "category": "MONITORING",
        "title": "Maintain Continuous Repository Monitoring",
        "explanation": f"{active_alerts_count} active alert(s) recorded.",
        "action": "Ensure continuous commit monitoring is enabled to catch regressions early.",
    })

    recommendations.append({
        "priority": "P3",
        "category": "GOVERNANCE",
        "title": "Maintain Release Confidence Standards",
        "explanation": f"Current release gate status is {release_status}.",
        "action": "Verify compliance rules and release certificates prior to deployment tagging.",
    })

    # Repository Leaderboard (from Step 36)
    leaderboard = comp_report.get("rankings", []) if isinstance(comp_report, dict) and "rankings" in comp_report else []

    # Historical Trend Summary (from Step 35)
    trends = hist_report.get("trends", {}) if isinstance(hist_report, dict) and "trends" in hist_report else {}
    trend_summary = {
        "risk_trend": trends.get("risk_trend", "STABLE"),
        "governance_trend": trends.get("health_trend", "IMPROVING"),
        "health_trend": trends.get("health_trend", "STABLE"),
        "testing_trend": trends.get("testing_trend", "STABLE"),
        "release_trend": "STABLE" if release_status == "APPROVED_FOR_RELEASE" else "DETERIORATING",
    }

    # Recent Engineering Events
    recent_events = [
        {
            "repository": full_name,
            "event_type": "repository_ingested",
            "severity": "INFO",
            "summary": f"AST and dependency analysis completed for {full_name}.",
        },
        {
            "repository": full_name,
            "event_type": "governance_evaluated",
            "severity": "INFO",
            "summary": f"Engineering governance score evaluated at {gov_score}/100.",
        },
        {
            "repository": full_name,
            "event_type": "release_gate_checked",
            "severity": "INFO" if release_status == "APPROVED_FOR_RELEASE" else "WARNING",
            "summary": f"Release gate status evaluated as {release_status}.",
        },
    ]

    if critical_alerts_count > 0:
        recent_events.insert(0, {
            "repository": full_name,
            "event_type": "critical_alert_generated",
            "severity": "CRITICAL",
            "summary": f"Critical monitoring alert generated for {full_name}.",
        })

    # Deterministic Executive Summary Text Synthesis
    exec_summary_text = (
        f"Engineering health is {engineering_health} with an overall score of {overall_engineering_score}/100 "
        f"and a governance score of {gov_score}/100. Regression risk is {trend_summary['risk_trend'].lower()} "
        f"at {risk_score}/100. {active_alerts_count} active alert(s) and {critical_alerts_count} critical alert(s) detected. "
        f"Release confidence is {release_confidence_score:.0f}% with gate status {release_status}."
    )

    generated_at = datetime.datetime.utcnow().isoformat() + "Z"

    return {
        "status": "success",
        "repository_url": canonical_url,
        "owner": owner,
        "repo_name": repo_name,
        "full_name": full_name,
        "executive_summary": exec_summary_text,
        "overall_engineering_score": overall_engineering_score,
        "engineering_health": engineering_health,
        "system_status": system_status,
        "current_regression_risk": risk_score,
        "governance_score": gov_score,
        "repository_health": health_score,
        "architecture_health": arch_score,
        "code_quality": quality_score,
        "testing_health": testing_health_score,
        "release_confidence": release_confidence_score,
        "release_gate_status": release_status,
        "monitoring_status": "ACTIVE",
        "active_alerts": active_alerts_count,
        "critical_alerts": critical_alerts_count,
        "high_alerts": high_alerts_count,
        "high_risk_repositories": 1 if risk_score > 50 else 0,
        "release_blockers": 1 if release_status == "RELEASE_BLOCKED" else 0,
        "historical_risk_trend": trend_summary["risk_trend"],
        "engineering_health_trend": trend_summary["health_trend"],
        "top_risks": top_risks,
        "recommendations": recommendations,
        "repository_leaderboard": leaderboard,
        "trend_summary": trend_summary,
        "recent_events": recent_events,
        "generated_at": generated_at,
    }


def export_command_center_report(
    repository_url: Optional[str] = None,
    repository_urls: Optional[List[str]] = None,
    export_format: str = "json",
) -> Dict[str, Any]:
    """
    Exports the Executive Engineering Command Center Report in JSON, Markdown, or HTML format.
    HTML export uses html.escape() for ALL dynamic content.
    """
    report = generate_command_center_report(repository_url, repository_urls)
    if isinstance(report, dict) and report.get("status") == "error":
        return report

    fmt = (export_format or "json").lower()

    if fmt == "json":
        return {
            "status": "success",
            "format": "json",
            "filename": "engineering_command_center.json",
            "content_type": "application/json",
            "content": report,
        }
    elif fmt in ["markdown", "md"]:
        md_lines = [
            "# Engineering Command Center — Executive Report",
            "",
            f"**Generated At**: `{report.get('generated_at', '')}`",
            f"**Repository**: `{report.get('full_name', '')}`",
            f"**Overall Score**: `{report.get('overall_engineering_score', 0)}/100` (`{report.get('engineering_health', '')}`)",
            f"**System Status**: `{report.get('system_status', '')}`",
            "",
            "## Executive Summary",
            f"> {report.get('executive_summary', '')}",
            "",
            "## Core KPI Metrics",
            f"- **Governance Score**: `{report.get('governance_score', 0)}`",
            f"- **Regression Risk**: `{report.get('current_regression_risk', 0)}`",
            f"- **Repository Health**: `{report.get('repository_health', 0)}`",
            f"- **Code Quality**: `{report.get('code_quality', 0)}`",
            f"- **Testing Health**: `{report.get('testing_health', 0)}`",
            f"- **Release Gate**: `{report.get('release_gate_status', '')}`",
            f"- **Active Alerts**: `{report.get('active_alerts', 0)}` (Critical: `{report.get('critical_alerts', 0)}`)",
            "",
            "## Top Engineering Risks",
        ]
        for risk in report.get("top_risks", []):
            md_lines.append(f"- **[{risk.get('priority', '')}] {risk.get('category', '')}** ({risk.get('repository', '')}) — {risk.get('explanation', '')} *(Action: {risk.get('recommended_action', '')})*")

        md_lines.extend(["", "## Prioritized Recommendations"])
        for rec in report.get("recommendations", []):
            md_lines.append(f"- **[{rec.get('priority', '')}] {rec.get('title', '')}** ({rec.get('category', '')}): {rec.get('action')}")

        md_lines.extend(["", "## Repository Leaderboard"])
        for lb in report.get("repository_leaderboard", []):
            md_lines.append(f"- **Rank {lb.get('rank', '-')}: {lb.get('full_name', lb.get('repo_name', ''))}** — Score: `{lb.get('benchmark_score', 0)}` (Gov: `{lb.get('governance_score', 0)}`, Health: `{lb.get('repository_health', 0)}`)")

        md_lines.extend(["", "## Trend Summary"])
        ts = report.get("trend_summary", {})
        md_lines.append(f"- **Risk Trend**: `{ts.get('risk_trend', 'STABLE')}`")
        md_lines.append(f"- **Governance Trend**: `{ts.get('governance_trend', 'STABLE')}`")
        md_lines.append(f"- **Health Trend**: `{ts.get('health_trend', 'STABLE')}`")
        md_lines.append(f"- **Testing Trend**: `{ts.get('testing_trend', 'STABLE')}`")
        md_lines.append(f"- **Release Trend**: `{ts.get('release_trend', 'STABLE')}`")

        md_lines.extend(["", "## Recent Engineering Events"])
        for ev in report.get("recent_events", []):
            md_lines.append(f"- **[{ev.get('severity', 'INFO')}] {ev.get('repository', '')}**: {ev.get('summary', '')}")

        md_content = "\n".join(md_lines)
        return {
            "status": "success",
            "format": "markdown",
            "filename": "engineering_command_center.md",
            "content_type": "text/markdown",
            "content": md_content,
        }
    elif fmt == "html":
        risks_html = []
        for risk in report.get("top_risks", []):
            risks_html.append(f"""
            <tr style="border-bottom: 1px solid #334155;">
              <td style="padding:0.75rem;font-weight:bold;color:#ef4444;">{html.escape(str(risk.get('priority', '')))}</td>
              <td style="padding:0.75rem;font-family:monospace;color:#38bdf8;">{html.escape(str(risk.get('repository', '')))}</td>
              <td style="padding:0.75rem;font-weight:bold;">{html.escape(str(risk.get('category', '')))}</td>
              <td style="padding:0.75rem;">{html.escape(str(risk.get('explanation', '')))}</td>
              <td style="padding:0.75rem;color:#38bdf8;">{html.escape(str(risk.get('recommended_action', '')))}</td>
            </tr>
            """)

        recs_html = []
        for rec in report.get("recommendations", []):
            recs_html.append(f"""
            <li style="margin-bottom:0.5rem;">
              <strong>[{html.escape(str(rec.get('priority', '')))}] {html.escape(str(rec.get('title', '')))}</strong>: {html.escape(str(rec.get('action', '')))}
            </li>
            """)

        lb_html = []
        for lb in report.get("repository_leaderboard", []):
            lb_html.append(f"""
            <tr style="border-bottom: 1px solid #334155;">
              <td style="padding:0.75rem;font-weight:bold;">{html.escape(str(lb.get('rank', '-')))}</td>
              <td style="padding:0.75rem;font-weight:bold;">{html.escape(str(lb.get('full_name', lb.get('repo_name', ''))))}</td>
              <td style="padding:0.75rem;color:#22c55e;font-weight:bold;">{html.escape(str(lb.get('benchmark_score', 0)))}</td>
              <td style="padding:0.75rem;">{html.escape(str(lb.get('governance_score', 0)))}</td>
              <td style="padding:0.75rem;">{html.escape(str(lb.get('repository_health', 0)))}</td>
            </tr>
            """)

        events_html = []
        for ev in report.get("recent_events", []):
            events_html.append(f"""
            <li style="margin-bottom:0.4rem;">
              <span style="font-weight:bold;color:#38bdf8;">[{html.escape(str(ev.get('severity', 'INFO')))}] {html.escape(str(ev.get('repository', '')))}:</span> {html.escape(str(ev.get('summary', '')))}
            </li>
            """)

        ts = report.get("trend_summary", {})

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Engineering Command Center Report</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; margin: 0; }}
    .container {{ max-width: 950px; margin: 0 auto; background: #0b1329; border: 1px solid #334155; border-radius: 12px; padding: 2rem; }}
    .header {{ border-bottom: 1px solid #334155; padding-bottom: 1rem; margin-bottom: 1.5rem; }}
    .badge {{ display: inline-block; padding: 0.4rem 0.8rem; border-radius: 6px; font-weight: bold; background: #0284c7; color: #ffffff; }}
    .summary {{ background: #1e293b; padding: 1rem; border-radius: 8px; border-left: 4px solid #38bdf8; margin-bottom: 1.5rem; font-size: 0.95rem; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 1rem; text-align: left; font-size: 0.85rem; }}
    th {{ background: #1e293b; padding: 0.75rem; color: #94a3b8; border-bottom: 1px solid #334155; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;color:#38bdf8;">🚀 Engineering Command Center Executive Report</h1>
      <p style="margin:0.5rem 0 0 0;color:#94a3b8;">Repository: {html.escape(str(report.get('full_name', '')))} | Generated: {html.escape(str(report.get('generated_at', '')))}</p>
      <div class="badge" style="margin-top:0.75rem;">Score: {html.escape(str(report.get('overall_engineering_score', 0)))}/100 ({html.escape(str(report.get('engineering_health', '')))}) | System Status: {html.escape(str(report.get('system_status', '')))}</div>
    </div>

    <div class="summary">
      <strong>Executive Summary:</strong><br>
      {html.escape(str(report.get('executive_summary', '')))}
    </div>

    <h3>Top Engineering Risks</h3>
    <table>
      <thead>
        <tr>
          <th>Priority</th>
          <th>Repository</th>
          <th>Category</th>
          <th>Explanation</th>
          <th>Recommended Action</th>
        </tr>
      </thead>
      <tbody>
        {''.join(risks_html)}
      </tbody>
    </table>

    <h3 style="margin-top:1.5rem;">Prioritized Recommendations</h3>
    <ul>
      {''.join(recs_html)}
    </ul>

    <h3 style="margin-top:1.5rem;">Repository Leaderboard</h3>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Repository</th>
          <th>Benchmark Score</th>
          <th>Gov Score</th>
          <th>Health</th>
        </tr>
      </thead>
      <tbody>
        {''.join(lb_html)}
      </tbody>
    </table>

    <h3 style="margin-top:1.5rem;">Engineering Trends</h3>
    <p>Risk Trend: <strong>{html.escape(str(ts.get('risk_trend', 'STABLE')))}</strong> | Health Trend: <strong>{html.escape(str(ts.get('health_trend', 'STABLE')))}</strong> | Release Trend: <strong>{html.escape(str(ts.get('release_trend', 'STABLE')))}</strong></p>

    <h3 style="margin-top:1.5rem;">Recent Engineering Events</h3>
    <ul>
      {''.join(events_html)}
    </ul>
  </div>
</body>
</html>"""

        return {
            "status": "success",
            "format": "html",
            "filename": "engineering_command_center.html",
            "content_type": "text/html",
            "content": html_content,
        }
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Unsupported export format '{export_format}'. Must be 'json', 'markdown', or 'html'.")
