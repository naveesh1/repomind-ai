import html
import json
import datetime
from typing import Dict, Any, List, Optional

from app.services.ingestion import ingest_repository
from app.services.repository_health import get_repository_health_for_url
from app.services.code_quality import get_code_quality_for_url
from app.services.regression_risk import get_regression_risk_for_repository
from app.services.repo_monitor import monitor_repository
from app.services.engineering_governance import generate_engineering_governance_report


def compare_repositories(
    repository_urls: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Step 36: Multi-repository Comparison & Benchmarking Engine.
    Analyzes 2+ public GitHub repositories, normalizes metrics (0-100), computes benchmark scores,
    ranks repositories, identifies leaders & gaps, and generates deterministic comparison insights.
    """
    if not repository_urls:
        return {
            "status": "error",
            "message": "At least 2 unique repositories are required for comparison.",
        }

    # Clean & Deduplicate Repository URLs while preserving order
    clean_urls = []
    seen = set()
    for u in repository_urls:
        if isinstance(u, str):
            stripped = u.strip()
            if stripped and stripped not in seen:
                seen.add(stripped)
                clean_urls.append(stripped)

    if len(clean_urls) < 2:
        return {
            "status": "error",
            "message": "At least 2 unique repositories are required for comparison.",
        }

    analyzed_repos = []
    comparison_metrics = []

    for url in clean_urls:
        repo_data = ingest_repository(url)
        if repo_data.get("status") == "error":
            return repo_data

        canonical_url = repo_data.get("repository_url", url)
        owner = repo_data.get("owner", "unknown")
        repo_name = repo_data.get("repo_name", "unknown")
        full_name = f"{owner}/{repo_name}"

        # Fetch underlying component reports
        gov_report = generate_engineering_governance_report(canonical_url)
        risk_res = get_regression_risk_for_repository(canonical_url)
        health_res = get_repository_health_for_url(canonical_url)
        quality_res = get_code_quality_for_url(canonical_url)
        monitor_res = monitor_repository(canonical_url)

        # Raw metrics extraction
        gov_score = gov_report["governance_score"]["overall_score"] if isinstance(gov_report, dict) and "governance_score" in gov_report else 75.0
        risk_score = risk_res.get("score", risk_res.get("regression_risk_score", 45.0)) if isinstance(risk_res, dict) else 45.0
        health_score = health_res.get("health_score", 80.0) if isinstance(health_res, dict) else 80.0
        quality_score = quality_res.get("code_quality_score", 80.0) if isinstance(quality_res, dict) else 80.0
        test_ratio = health_res.get("test_to_source_ratio", 0.5) if isinstance(health_res, dict) else 0.5
        alerts = monitor_res.get("alerts", []) if isinstance(monitor_res, dict) else []
        critical_alerts = sum(1 for a in alerts if a.get("severity") == "CRITICAL")
        release_status = gov_report["decision_metrics"]["release_gate_status"] if isinstance(gov_report, dict) and "decision_metrics" in gov_report else "APPROVED_FOR_RELEASE"

        # 0-100 Normalized Metric Scores
        norm_gov = float(gov_score)
        norm_risk_safety = max(0.0, min(100.0, round(100.0 - risk_score, 1)))
        norm_health = float(health_score)
        norm_quality = float(quality_score)
        norm_testing = min(100.0, round(test_ratio * 100.0 + 30.0, 1)) if test_ratio > 0 else 40.0
        norm_monitoring = max(0.0, round(100.0 - critical_alerts * 25.0 - len(alerts) * 5.0, 1))
        norm_release = 100.0 if release_status == "APPROVED_FOR_RELEASE" else (65.0 if release_status == "CONDITIONAL_RELEASE" else 30.0)

        # Weighted Engineering Benchmark Score
        benchmark_score = round(
            norm_gov * 0.25 +
            norm_risk_safety * 0.20 +
            norm_quality * 0.20 +
            norm_health * 0.15 +
            norm_testing * 0.10 +
            norm_release * 0.10,
            1
        )
        benchmark_score = max(0.0, min(100.0, benchmark_score))

        metrics_dict = {
            "governance_score": norm_gov,
            "risk_safety_score": norm_risk_safety,
            "health_score": norm_health,
            "code_quality_score": norm_quality,
            "testing_health_score": norm_testing,
            "monitoring_score": norm_monitoring,
            "release_confidence_score": norm_release,
        }

        # Identify Strongest & Weakest Metric for this repo
        sorted_repo_metrics = sorted(metrics_dict.items(), key=lambda x: x[1], reverse=True)
        strongest_metric = sorted_repo_metrics[0][0].replace("_", " ").title()
        weakest_metric = sorted_repo_metrics[-1][0].replace("_", " ").title()

        repo_summary = {
            "repository_url": canonical_url,
            "owner": owner,
            "repo_name": repo_name,
            "full_name": full_name,
            "benchmark_score": benchmark_score,
            "governance_score": norm_gov,
            "regression_risk_score": risk_score,
            "risk_safety_score": norm_risk_safety,
            "repository_health": norm_health,
            "code_quality": norm_quality,
            "test_to_source_ratio": test_ratio,
            "testing_health_score": norm_testing,
            "monitoring_score": norm_monitoring,
            "release_confidence_score": norm_release,
            "release_gate_status": release_status,
            "total_alerts": len(alerts),
            "strongest_metric": strongest_metric,
            "weakest_metric": weakest_metric,
        }
        analyzed_repos.append(repo_summary)

    # Rank Repositories by benchmark score descending
    ranked_repos = sorted(analyzed_repos, key=lambda r: r["benchmark_score"], reverse=True)
    rankings = []
    for idx, repo in enumerate(ranked_repos, 1):
        repo_copy = dict(repo)
        repo_copy["rank"] = idx
        rankings.append(repo_copy)

    overall_winner = rankings[0]["full_name"]
    weakest_repository = rankings[-1]["full_name"]

    # Calculate Metric Leaders & Gaps across repositories
    metric_keys = [
        ("governance_score", "Governance Score"),
        ("risk_safety_score", "Risk Safety"),
        ("repository_health", "Repository Health"),
        ("code_quality", "Code Quality"),
        ("testing_health_score", "Testing Health"),
        ("monitoring_score", "Monitoring Score"),
        ("release_confidence_score", "Release Confidence"),
    ]

    metric_leaders = []
    metric_gaps = []

    for key, label in metric_keys:
        highest_repo = max(rankings, key=lambda r: r[key])
        lowest_repo = min(rankings, key=lambda r: r[key])
        max_val = highest_repo[key]
        min_val = lowest_repo[key]
        gap = round(max_val - min_val, 1)

        metric_leaders.append({
            "metric": label,
            "leader": highest_repo["full_name"],
            "score": max_val,
        })
        metric_gaps.append({
            "metric": label,
            "leader": highest_repo["full_name"],
            "lagger": lowest_repo["full_name"],
            "highest_score": max_val,
            "lowest_score": min_val,
            "gap": gap,
        })

    # Generate Deterministic Textual Insights
    winner_repo = rankings[0]
    insights = [
        f"🏆 {winner_repo['full_name']} leads overall with an Engineering Benchmark Score of {winner_repo['benchmark_score']}/100.",
        f"⭐ Strongest performance for {winner_repo['full_name']} is in {winner_repo['strongest_metric']}.",
    ]

    if len(rankings) > 1:
        runner_up = rankings[1]
        score_diff = round(winner_repo['benchmark_score'] - runner_up['benchmark_score'], 1)
        insights.append(f"📊 Benchmark margin between #1 {winner_repo['full_name']} and #2 {runner_up['full_name']} is {score_diff} points.")

    large_gaps = [g for g in metric_gaps if g["gap"] >= 15.0]
    if large_gaps:
        g_labels = ", ".join(g["metric"] for g in large_gaps)
        insights.append(f"⚠️ Significant engineering divergence detected in {g_labels} (gaps ≥ 15 points).")
    else:
        insights.append("⚖️ Repositories exhibit balanced performance with minor metric divergence.")

    generated_at = datetime.datetime.utcnow().isoformat() + "Z"

    return {
        "status": "success",
        "repositories": rankings,
        "rankings": rankings,
        "comparison_metrics": metric_leaders,
        "overall_winner": overall_winner,
        "weakest_repository": weakest_repository,
        "metric_leaders": metric_leaders,
        "metric_gaps": metric_gaps,
        "insights": insights,
        "generated_at": generated_at,
    }


def export_repository_comparison_report(
    repository_urls: Optional[List[str]] = None,
    export_format: str = "json",
) -> Dict[str, Any]:
    """
    Exports the Multi-Repository Comparison & Benchmarking Report in JSON, Markdown, or HTML format.
    HTML export uses html.escape() for XSS safety.
    """
    report = compare_repositories(repository_urls)
    if report.get("status") == "error":
        return report

    fmt = (export_format or "json").lower()

    if fmt == "json":
        return {
            "status": "success",
            "format": "json",
            "filename": "repository_comparison_report.json",
            "content_type": "application/json",
            "content": report,
        }
    elif fmt in ["markdown", "md"]:
        md_lines = [
            "# Repository Benchmarking & Comparison Report",
            "",
            f"**Generated At**: `{report['generated_at']}`",
            f"**Overall Winner**: `{report['overall_winner']}`",
            "",
            "## Repository Rankings",
            "",
            "| Rank | Repository | Benchmark Score | Gov Score | Risk Safety | Health | Quality | Testing | Status |",
            "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
        ]

        for repo in report.get("rankings", []):
            md_lines.append(
                f"| #{repo['rank']} | **{repo['full_name']}** | `{repo['benchmark_score']}` | `{repo['governance_score']}` | `{repo['risk_safety_score']}` | `{repo['repository_health']}` | `{repo['code_quality']}` | `{repo['testing_health_score']}` | `{repo['release_gate_status']}` |"
            )

        md_lines.extend([
            "",
            "## Metric Leaders",
            "",
        ])
        for leader in report.get("metric_leaders", []):
            md_lines.append(f"- **{leader['metric']}**: `{leader['leader']}` ({leader['score']}/100)")

        md_lines.extend([
            "",
            "## Comparison Insights",
            "",
        ])
        for ins in report.get("insights", []):
            md_lines.append(f"- {ins}")

        md_content = "\n".join(md_lines)
        return {
            "status": "success",
            "format": "markdown",
            "filename": "repository_comparison_report.md",
            "content_type": "text/markdown",
            "content": md_content,
        }
    elif fmt == "html":
        rankings_html = []
        for repo in report.get("rankings", []):
            rankings_html.append(f"""
            <tr style="border-bottom: 1px solid #334155;">
              <td style="padding:0.75rem;font-weight:bold;color:#38bdf8;">#{repo['rank']}</td>
              <td style="padding:0.75rem;font-weight:bold;color:#f8fafc;">{html.escape(repo['full_name'])}</td>
              <td style="padding:0.75rem;font-weight:bold;color:#22c55e;">{repo['benchmark_score']}</td>
              <td style="padding:0.75rem;">{repo['governance_score']}</td>
              <td style="padding:0.75rem;">{repo['risk_safety_score']}</td>
              <td style="padding:0.75rem;">{repo['repository_health']}</td>
              <td style="padding:0.75rem;">{repo['code_quality']}</td>
              <td style="padding:0.75rem;">{repo['testing_health_score']}</td>
              <td style="padding:0.75rem;"><span style="color:#22c55e;font-weight:bold;">{html.escape(repo['release_gate_status'])}</span></td>
            </tr>
            """)

        insights_html = []
        for ins in report.get("insights", []):
            insights_html.append(f"<li style='margin-bottom:0.4rem;color:#f1f5f9;'>{html.escape(ins)}</li>")

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Repository Comparison & Benchmarking Report</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; margin: 0; }}
    .container {{ max-width: 950px; margin: 0 auto; background: #0b1329; border: 1px solid #334155; border-radius: 12px; padding: 2rem; }}
    .header {{ border-bottom: 1px solid #334155; padding-bottom: 1rem; margin-bottom: 1.5rem; }}
    .badge {{ display: inline-block; padding: 0.4rem 0.8rem; border-radius: 6px; font-weight: bold; background: #0284c7; color: #ffffff; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 1rem; text-align: left; font-size: 0.85rem; }}
    th {{ background: #1e293b; padding: 0.75rem; color: #94a3b8; border-bottom: 1px solid #334155; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;color:#38bdf8;">Repository Benchmarking & Comparison Report</h1>
      <p style="margin:0.5rem 0 0 0;color:#94a3b8;">Generated At: {html.escape(report['generated_at'])}</p>
      <div class="badge" style="margin-top:0.75rem;">Winner: {html.escape(report['overall_winner'])}</div>
    </div>
    <h3>Rankings Summary</h3>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Repository</th>
          <th>Benchmark</th>
          <th>Gov Score</th>
          <th>Risk Safety</th>
          <th>Health</th>
          <th>Quality</th>
          <th>Testing</th>
          <th>Release Gate</th>
        </tr>
      </thead>
      <tbody>
        {''.join(rankings_html)}
      </tbody>
    </table>
    <h3 style="margin-top:1.5rem;">Comparison Insights</h3>
    <ul>
      {''.join(insights_html)}
    </ul>
  </div>
</body>
</html>"""

        return {
            "status": "success",
            "format": "html",
            "filename": "repository_comparison_report.html",
            "content_type": "text/html",
            "content": html_content,
        }
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Unsupported export format '{export_format}'. Must be 'json', 'markdown', or 'html'.")
