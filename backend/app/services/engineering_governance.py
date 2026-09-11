import html
import json
from typing import Dict, Any, List, Optional

from app.services.ingestion import ingest_repository
from app.services.repository_health import get_repository_health_for_url
from app.services.code_quality import get_code_quality_for_url
from app.services.regression_risk import get_regression_risk_for_repository
from app.services.repo_monitor import monitor_repository
from app.services.change_decision import get_change_decision_for_repository
from app.services.release_gating import evaluate_release_readiness


def generate_engineering_governance_report(
    repository_url: Optional[str] = None,
    target_revision: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Consolidates intelligence from Steps 11-33 into a deterministic Engineering Governance Report.
    """
    repo_data = ingest_repository(repository_url)
    if repo_data.get("status") == "error":
        return repo_data

    url = repo_data.get("repository_url")
    owner = repo_data.get("owner", "unknown")
    repo_name = repo_data.get("repo_name", "unknown")

    health_res = get_repository_health_for_url(url)
    quality_res = get_code_quality_for_url(url)
    risk_res = get_regression_risk_for_repository(url)
    monitor_res = monitor_repository(url, target_revision)
    decision_res = get_change_decision_for_repository(url)
    gating_res = evaluate_release_readiness(url, target_revision)

    # 1. Extract Core Metrics
    health_score = health_res.get("health_score", 80.0)
    maintainability = health_res.get("maintainability_classification", "MAINTAINABLE")
    code_quality_score = quality_res.get("code_quality_score", 80.0)
    test_ratio = health_res.get("test_to_source_ratio", 0.5)

    regression_risk_score = risk_res.get("regression_risk_score", 0.0)
    previous_risk_score = risk_res.get("previous_regression_risk_score", regression_risk_score)
    risk_delta = round(regression_risk_score - previous_risk_score, 2)
    risk_level = risk_res.get("risk_level", "LOW")

    monitoring_status = monitor_res.get("monitoring_status", "NO_CHANGE")
    alerts = monitor_res.get("alerts", [])
    critical_alerts_count = sum(1 for a in alerts if a.get("severity") == "CRITICAL")
    high_alerts_count = sum(1 for a in alerts if a.get("severity") == "HIGH")
    medium_alerts_count = sum(1 for a in alerts if a.get("severity") == "MEDIUM")
    low_alerts_count = sum(1 for a in alerts if a.get("severity") == "LOW")

    new_blockers_count = monitor_res.get("new_blockers_count", 0)
    merge_decision = decision_res.get("decision", "READY")
    release_gate_status = gating_res.get("release_gate_status", "APPROVED_FOR_RELEASE")

    # 2. Compute Deterministic Governance Factors (0-100 each)
    factor_risk = max(0.0, round(100.0 - regression_risk_score, 1))
    factor_testing = min(100.0, round(test_ratio * 100.0 + 30.0, 1)) if test_ratio > 0 else 40.0
    factor_quality = round(code_quality_score, 1)
    factor_monitoring = max(0.0, round(100.0 - (critical_alerts_count * 25.0 + high_alerts_count * 10.0), 1))
    factor_release = 100.0 if release_gate_status == "APPROVED_FOR_RELEASE" else (60.0 if release_gate_status == "CONDITIONAL_RELEASE" else 0.0)

    overall_score = int(round(
        factor_risk * 0.25 +
        factor_testing * 0.20 +
        factor_quality * 0.20 +
        factor_monitoring * 0.15 +
        factor_release * 0.20
    ))

    # Overall Health Label
    if overall_score >= 85:
        overall_health = "EXCELLENT"
    elif overall_score >= 70:
        overall_health = "GOOD"
    elif overall_score >= 55:
        overall_health = "FAIR"
    elif overall_score >= 40:
        overall_health = "POOR"
    else:
        overall_health = "CRITICAL"

    # 3. Governance Indicators Classification
    # Risk Trend
    if risk_delta < -2.0:
        risk_trend = "IMPROVING"
    elif risk_delta > 2.0:
        risk_trend = "DETERIORATING"
    else:
        risk_trend = "STABLE"

    # Test Health
    if test_ratio >= 0.4 and risk_res.get("affected_tests_count", 0) > 0:
        test_health = "HEALTHY"
    elif test_ratio >= 0.15:
        test_health = "ATTENTION_REQUIRED"
    else:
        test_health = "CRITICAL"

    # Code Quality
    if code_quality_score >= 75.0:
        code_quality_status = "HEALTHY"
    elif code_quality_score >= 50.0:
        code_quality_status = "ATTENTION_REQUIRED"
    else:
        code_quality_status = "CRITICAL"

    # Release Confidence
    if release_gate_status == "APPROVED_FOR_RELEASE" and new_blockers_count == 0:
        release_confidence = "HIGH"
    elif release_gate_status == "CONDITIONAL_RELEASE":
        release_confidence = "MEDIUM"
    else:
        release_confidence = "LOW"

    # 4. Generate Deterministic Recommendations Engine
    recommendations: List[Dict[str, Any]] = []

    if release_gate_status == "RELEASE_BLOCKED":
        recommendations.append({
            "id": "REC_RELEASE_BLOCKED",
            "priority": "P0",
            "category": "RELEASE",
            "reason": "Release gate status is RELEASE_BLOCKED due to active critical blockers or high risk.",
            "affected_metric": "release_gate_status",
            "recommended_action": "Resolve release gate blockers and critical alerts prior to deployment."
        })

    if critical_alerts_count > 0:
        recommendations.append({
            "id": "REC_CRITICAL_ALERTS",
            "priority": "P0",
            "category": "MONITORING",
            "reason": f"Detected {critical_alerts_count} active CRITICAL risk alerts in monitored repository.",
            "affected_metric": "critical_alerts_count",
            "recommended_action": "Inspect critical alert traces and fix identified architectural risk factors."
        })

    if regression_risk_score >= 70.0:
        recommendations.append({
            "id": "REC_HIGH_REGRESSION_RISK",
            "priority": "P0",
            "category": "RISK",
            "reason": f"Regression risk score is {regression_risk_score} ({risk_level}).",
            "affected_metric": "regression_risk_score",
            "recommended_action": "Increase test coverage for modified central modules and run full regression suite."
        })

    if risk_trend == "DETERIORATING":
        recommendations.append({
            "id": "REC_DETERIORATING_RISK",
            "priority": "P1",
            "category": "RISK",
            "reason": f"Risk trend is DETERIORATING (+{risk_delta} risk delta).",
            "affected_metric": "risk_delta",
            "recommended_action": "Investigate modules contributing to recent historical risk increases."
        })

    if code_quality_score < 70.0:
        recommendations.append({
            "id": "REC_CODE_QUALITY",
            "priority": "P1",
            "category": "CODE_QUALITY",
            "reason": f"Code quality score is {code_quality_score}/100.",
            "affected_metric": "code_quality_score",
            "recommended_action": "Prioritize refactoring of high-complexity and deeply nested functions."
        })

    if test_ratio < 0.3:
        recommendations.append({
            "id": "REC_LOW_TEST_RATIO",
            "priority": "P2",
            "category": "TESTING",
            "reason": f"Test-to-source ratio is {test_ratio:.2f}.",
            "affected_metric": "test_to_source_ratio",
            "recommended_action": "Increase automated unit and integration test coverage across source files."
        })

    if maintainability != "MAINTAINABLE":
        recommendations.append({
            "id": "REC_MAINTAINABILITY",
            "priority": "P3",
            "category": "MAINTAINABILITY",
            "reason": f"Repository maintainability is classified as {maintainability}.",
            "affected_metric": "maintainability_classification",
            "recommended_action": "Simplify module dependency structures and decrease file nesting."
        })

    return {
        "status": "success",
        "repository_url": url,
        "owner": owner,
        "repo_name": repo_name,
        "current_revision": monitor_res.get("latest_revision", "HEAD"),
        "previous_revision": monitor_res.get("previous_revision", "HEAD~1"),
        "monitoring_status": monitoring_status,
        "governance_score": {
            "overall_score": overall_score,
            "overall_health": overall_health,
            "factors": {
                "risk": factor_risk,
                "testing": factor_testing,
                "code_quality": factor_quality,
                "monitoring": factor_monitoring,
                "release": factor_release,
            }
        },
        "indicators": {
            "risk_trend": risk_trend,
            "test_health": test_health,
            "code_quality_status": code_quality_status,
            "release_confidence": release_confidence,
            "overall_engineering_health": overall_health,
        },
        "health_metrics": {
            "repository_health_score": health_score,
            "maintainability_classification": maintainability,
            "code_quality_score": code_quality_score,
            "test_to_source_ratio": test_ratio,
        },
        "risk_metrics": {
            "current_regression_risk": regression_risk_score,
            "previous_regression_risk": previous_risk_score,
            "risk_delta": risk_delta,
            "risk_trend": risk_trend,
            "critical_alerts_count": critical_alerts_count,
            "high_alerts_count": high_alerts_count,
            "medium_alerts_count": medium_alerts_count,
            "low_alerts_count": low_alerts_count,
        },
        "change_metrics": {
            "changed_files_count": len(monitor_res.get("diff_summary", {}).get("modified_files", [])),
            "affected_test_count": risk_res.get("affected_tests_count", 0),
        },
        "decision_metrics": {
            "merge_decision": merge_decision,
            "release_gate_status": release_gate_status,
            "new_blockers_count": new_blockers_count,
        },
        "recommendations": recommendations,
    }


def export_governance_report(
    repository_url: Optional[str] = None,
    export_format: str = "json",
) -> Dict[str, Any]:
    """
    Exports the Engineering Governance Report in JSON, Markdown, or HTML format.
    """
    report = generate_engineering_governance_report(repository_url)
    if report.get("status") == "error":
        return report

    fmt = (export_format or "json").lower()
    repo_name = report.get("repo_name", "repo")

    if fmt == "json":
        return {
            "status": "success",
            "format": "json",
            "filename": f"engineering_governance_{repo_name}.json",
            "content_type": "application/json",
            "content": report,
        }
    elif fmt in ["markdown", "md"]:
        score_info = report["governance_score"]
        indicators = report["indicators"]
        md_lines = [
            f"# Engineering Governance Report — {report['owner']}/{report['repo_name']}",
            "",
            f"**Repository URL**: {report['repository_url']}",
            f"**Governance Health Score**: `{score_info['overall_score']} / 100 ({score_info['overall_health']})`",
            f"**Monitoring Status**: `{report['monitoring_status']}`",
            "",
            "## Governance Indicators",
            f"- **Overall Health**: `{indicators['overall_engineering_health']}`",
            f"- **Risk Trend**: `{indicators['risk_trend']}`",
            f"- **Test Health**: `{indicators['test_health']}`",
            f"- **Code Quality**: `{indicators['code_quality_status']}`",
            f"- **Release Confidence**: `{indicators['release_confidence']}`",
            "",
            "## Factor Breakdown",
            f"- Risk Factor: `{score_info['factors']['risk']}/100`",
            f"- Testing Factor: `{score_info['factors']['testing']}/100`",
            f"- Code Quality Factor: `{score_info['factors']['code_quality']}/100`",
            f"- Monitoring Factor: `{score_info['factors']['monitoring']}/100`",
            f"- Release Factor: `{score_info['factors']['release']}/100`",
            "",
            "## Actionable Recommendations",
            "",
        ]

        for rec in report.get("recommendations", []):
            md_lines.append(f"### `[{rec['priority']}]` {rec['category']} — {rec['id']}")
            md_lines.append(f"- **Reason**: {rec['reason']}")
            md_lines.append(f"- **Action**: {rec['recommended_action']}")
            md_lines.append("")

        md_content = "\n".join(md_lines)
        return {
            "status": "success",
            "format": "markdown",
            "filename": f"engineering_governance_{repo_name}.md",
            "content_type": "text/markdown",
            "content": md_content,
        }
    elif fmt == "html":
        score_info = report["governance_score"]
        indicators = report["indicators"]

        recs_html = []
        for rec in report.get("recommendations", []):
            prio_color = "#ef4444" if rec["priority"] == "P0" else ("#f97316" if rec["priority"] == "P1" else "#eab308")
            recs_html.append(f"""
            <div style="background:#1e293b;padding:0.75rem;margin-bottom:0.5rem;border-radius:6px;border-left:4px solid {prio_color};">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong style="color:#f8fafc;">[{html.escape(rec['priority'])}] {html.escape(rec['category'])}</strong>
                <span style="font-size:0.75rem;color:#94a3b8;font-family:monospace;">Metric: {html.escape(rec['affected_metric'])}</span>
              </div>
              <p style="margin:0.25rem 0;color:#cbd5e1;font-size:0.85rem;">{html.escape(rec['reason'])}</p>
              <div style="font-size:0.85rem;color:#38bdf8;font-weight:600;">Recommended Action: {html.escape(rec['recommended_action'])}</div>
            </div>
            """)

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Engineering Governance Report — {html.escape(report['repo_name'])}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; margin: 0; }}
    .container {{ max-width: 850px; margin: 0 auto; background: #0b1329; border: 1px solid #334155; border-radius: 12px; padding: 2rem; }}
    .header {{ border-bottom: 1px solid #334155; padding-bottom: 1rem; margin-bottom: 1.5rem; }}
    .score-badge {{ font-size: 2.2rem; font-weight: bold; color: #38bdf8; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;color:#38bdf8;">Engineering Governance Report</h1>
      <p style="margin:0.5rem 0 0 0;color:#94a3b8;">Repository: {html.escape(report['repository_url'])}</p>
      <div class="score-badge">{score_info['overall_score']} / 100 ({html.escape(score_info['overall_health'])})</div>
    </div>
    <h3>Governance Indicators</h3>
    <ul>
      <li>Overall Health: <strong>{html.escape(indicators['overall_engineering_health'])}</strong></li>
      <li>Risk Trend: <strong>{html.escape(indicators['risk_trend'])}</strong></li>
      <li>Test Health: <strong>{html.escape(indicators['test_health'])}</strong></li>
      <li>Code Quality: <strong>{html.escape(indicators['code_quality_status'])}</strong></li>
      <li>Release Confidence: <strong>{html.escape(indicators['release_confidence'])}</strong></li>
    </ul>
    <h3>Actionable Recommendations</h3>
    {''.join(recs_html)}
  </div>
</body>
</html>"""

        return {
            "status": "success",
            "format": "html",
            "filename": f"engineering_governance_{repo_name}.html",
            "content_type": "text/html",
            "content": html_content,
        }
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Unsupported export format '{export_format}'. Must be 'json', 'markdown', or 'html'.")
