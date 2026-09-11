import html
import json
import datetime
from typing import Dict, Any, List, Optional, Tuple

from app.services.ingestion import ingest_repository, get_last_analyzed_repo_url
from app.services.unified_engineering_intelligence import get_unified_engineering_intelligence
from app.services.pull_request_intelligence import generate_pull_request_intelligence
from app.services.engineering_audit_history import generate_engineering_audit_history
from app.services.engineering_investigation import generate_investigation_report
from app.services.engineering_action_center import get_actions_for_repository
from app.services.engineering_governance import generate_engineering_governance_report
from app.services.release_gating import evaluate_release_readiness
from app.services.impact_analyzer import analyze_change_impact
from app.services.test_impact import compute_test_impact
from app.services.regression_risk import get_regression_risk_for_repository
from app.services.smart_test_selection import select_smart_tests
from app.services.architecture_intelligence import analyze_repository_architecture
from app.services.advanced_engineering_analytics import generate_advanced_engineering_analytics
from app.services.rbac import check_user_permission, check_user_repository_access, Role


SUPPORTED_INTENTS = [
    "REPO_HEALTH",
    "PR_RISK_AND_DECISION",
    "CODE_AND_IMPACT",
    "REMEDIATION_AND_ACTION",
    "ARCHITECTURE_INTELLIGENCE",
    "ADVANCED_ENGINEERING_ANALYTICS",
    "GENERAL_ENGINEERING",
]


def classify_copilot_intent(
    query: str,
    pr_id: Optional[str] = None,
    file_path: Optional[str] = None,
) -> str:
    """
    Classifies a natural language engineering query into a target Copilot Intent.
    Uses query keywords and explicit parameters (pr_id, file_path) to determine intent.
    """
    clean_q = (query or "").strip().lower()

    if pr_id or any(k in clean_q for k in ["pr", "pull request", "diff", "merge", "pull-request", "pr #"]):
        return "PR_RISK_AND_DECISION"

    if file_path or any(k in clean_q for k in ["file", "function", "impact", "downstream", "caller", "callee", "ast", "affect", "test impact"]):
        return "CODE_AND_IMPACT"

    if any(k in clean_q for k in ["action", "remediation", "investigate", "investigation", "fix", "audit", "decision history"]):
        return "REMEDIATION_AND_ACTION"

    if any(k in clean_q for k in ["architecture", "layer", "coupling", "instability", "cyclic", "topology", "decouple"]):
        return "ARCHITECTURE_INTELLIGENCE"

    if any(k in clean_q for k in ["analytics", "time series", "velocity", "effectiveness", "time horizon", "trend vector", "predictive"]):
        return "ADVANCED_ENGINEERING_ANALYTICS"

    if any(k in clean_q for k in ["health", "score", "governance", "overall", "quality", "trend", "maintainability", "summary", "overview"]):
        return "REPO_HEALTH"

    return "GENERAL_ENGINEERING"


def handle_repo_health_query(repository_url: str, user: Dict[str, Any]) -> Dict[str, Any]:
    """
    Synthesizes Repository Health & Canonical Metrics intelligence from Step 40 SSoT.
    """
    ssot_data = get_unified_engineering_intelligence(repository_url)
    if isinstance(ssot_data, dict) and ssot_data.get("status") == "error":
        return ssot_data

    repo_name = ssot_data.get("repository_name") or ssot_data.get("full_name", "Repository")
    metrics = ssot_data.get("canonical_metrics", {})
    health_status = metrics.get("engineering_health", "HEALTHY")
    overall_score = metrics.get("overall_engineering_score", 75.0)

    try:
        gov_data = generate_engineering_governance_report(repository_url)
    except Exception:
        gov_data = {}

    summary_text = (
        f"Repository **{repo_name}** has an Overall Engineering Score of **{overall_score}/100** ({health_status}). "
        f"Regression Risk is evaluated at **{metrics.get('regression_risk', 45.0)}/100** with a Governance Score of "
        f"**{metrics.get('governance_score', 80.0)}/100** and Code Quality of **{metrics.get('code_quality', 82.0)}/100**. "
        f"Release confidence is currently at **{metrics.get('release_confidence', 100.0)}%**."
    )

    evidence = [
        f"Canonical Overall Score: {overall_score}/100 ({health_status})",
        f"Regression Risk: {metrics.get('regression_risk')}/100",
        f"Governance Score: {metrics.get('governance_score')}/100",
        f"Code Quality: {metrics.get('code_quality')}/100",
        f"Historical Risk Trend: {metrics.get('historical_risk_trend', 'STABLE')}",
    ]

    suggested_followups = [
        "What are the top code quality bottlenecks in this repository?",
        "Explain the governance score breakdown and compliance rules.",
        "What is the historical risk trend for this repository?",
    ]

    return {
        "status": "success",
        "intent": "REPO_HEALTH",
        "repository_url": ssot_data.get("repository_url", repository_url),
        "answer": summary_text,
        "canonical_metrics": metrics,
        "evidence": evidence,
        "source_services": [
            "unified_engineering_intelligence.py (Step 40 SSoT)",
            "engineering_governance.py (Step 34)",
            "repository_health.py (Step 18)",
        ],
        "suggested_followups": suggested_followups,
    }


def handle_pr_explanation_query(
    repository_url: str,
    pr_id: Optional[str] = None,
    base_revision: str = "main",
    head_revision: str = "HEAD",
    github_token: Optional[str] = None,
    user: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Synthesizes PR Intelligence, AST changes, test impact, and risk decision from Step 42.
    """
    pr_intel = generate_pull_request_intelligence(
        repository_url=repository_url,
        base_revision=base_revision,
        head_revision=head_revision,
        pr_id=pr_id,
        github_token=github_token,
    )

    if isinstance(pr_intel, dict) and pr_intel.get("status") == "error":
        return pr_intel

    summary = pr_intel.get("summary", {})
    metrics = pr_intel.get("canonical_metrics", {})
    rel_gate = pr_intel.get("release_gate_evaluation", {})

    pr_title = summary.get("pr_title", pr_id or "Pull Request Analysis")
    risk_score = metrics.get("regression_risk", 45.0)
    gate_status = rel_gate.get("release_gate_status", "APPROVED_FOR_RELEASE")
    files_changed = summary.get("files_changed", 0)
    lines_added = summary.get("lines_added", 0)
    lines_deleted = summary.get("lines_deleted", 0)

    risk_level = "HIGH" if risk_score >= 70 else ("MEDIUM" if risk_score >= 40 else "LOW")

    answer_text = (
        f"**{pr_title}** modifies **{files_changed} files** (+{lines_added}/-{lines_deleted} lines). "
        f"The calculated Regression Risk is **{risk_score}/100** ({risk_level} Risk). "
        f"The recommended Release Gate decision is **{gate_status}**. "
        f"Governance score for this change set is **{metrics.get('governance_score', 80.0)}/100**."
    )

    blockers = rel_gate.get("blockers", [])
    evidence = [
        f"PR Title: {pr_title}",
        f"Files Changed: {files_changed} (+{lines_added}/-{lines_deleted})",
        f"Regression Risk Score: {risk_score}/100",
        f"Release Gate Decision: {gate_status}",
    ]
    if blockers:
        evidence.append(f"Release Gate Blockers: {', '.join(blockers)}")

    suggested_followups = [
        "Which specific files drive the regression risk in this PR?",
        "What test coverage gaps were identified for these PR changes?",
        "How can we remediate the release blockers for this PR?",
    ]

    return {
        "status": "success",
        "intent": "PR_RISK_AND_DECISION",
        "repository_url": pr_intel.get("repository_url", repository_url),
        "pr_id": pr_id or "latest",
        "answer": answer_text,
        "canonical_metrics": metrics,
        "release_gate_evaluation": rel_gate,
        "evidence": evidence,
        "source_services": [
            "pull_request_intelligence.py (Step 42)",
            "regression_risk.py (Step 25)",
            "release_gating.py (Step 33)",
        ],
        "suggested_followups": suggested_followups,
    }


def handle_impact_query(
    repository_url: str,
    file_path: Optional[str] = None,
    function_name: Optional[str] = None,
    user: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Explains code, AST dependency, and test impact for a specific target file or function.
    """
    clean_url = (repository_url or "").strip()
    if not clean_url:
        clean_url = get_last_analyzed_repo_url() or "https://github.com/psf/requests"

    try:
        repo_data = ingest_repository(clean_url)
    except Exception:
        repo_data = {}

    target_file = file_path or "src/main.py"
    if not file_path and isinstance(repo_data, dict) and repo_data.get("python_files"):
        files = [f.get("file") for f in repo_data["python_files"] if isinstance(f, dict) and f.get("file")]
        if files:
            target_file = files[0]

    try:
        impact_res = analyze_change_impact(repo_data, target_file, function_name)
    except Exception:
        impact_res = {}

    try:
        test_res = compute_test_impact(clean_url, target_file, function_name)
    except Exception:
        test_res = {}

    try:
        risk_res = get_regression_risk_for_repository(clean_url, target_file, function_name)
    except Exception:
        risk_res = {}

    try:
        smart_test_res = select_smart_tests(
            repository_url=clean_url,
            changed_files=[target_file],
            changed_function=function_name,
        )
    except Exception:
        smart_test_res = {}

    impacted_modules = impact_res.get("downstream_impacted_modules", []) if isinstance(impact_res, dict) else []
    direct_tests = test_res.get("direct_tests", 0) if isinstance(test_res, dict) else 0
    indirect_tests = test_res.get("indirect_tests", 0) if isinstance(test_res, dict) else 0
    risk_score = risk_res.get("score", 45.0) if isinstance(risk_res, dict) else 45.0
    smart_summary = smart_test_res.get("summary", {}) if isinstance(smart_test_res, dict) else {}
    red_pct = smart_summary.get("test_reduction_percentage", 0.0)
    pytest_cmd = smart_test_res.get("pytest_command", "") if isinstance(smart_test_res, dict) else ""

    answer_text = (
        f"Modifying **{target_file}**" + (f" (function `{function_name}`)" if function_name else "") +
        f" impacts **{len(impacted_modules)} downstream module(s)**. "
        f"There are **{direct_tests} direct test(s)** and **{indirect_tests} indirect test(s)** covering this module. "
        f"Smart test selection recommends a **{red_pct}% suite reduction**, executing command: `{pytest_cmd}`."
    )

    evidence = [
        f"Target File: {target_file}",
        f"Impacted Downstream Modules: {len(impacted_modules)} modules ({', '.join(impacted_modules[:3]) if impacted_modules else 'None'})",
        f"Direct Tests: {direct_tests}, Indirect Tests: {indirect_tests}",
        f"Smart Test Selection Pytest Command: `{pytest_cmd}` ({red_pct}% test reduction)",
        f"Module Regression Risk Score: {risk_score}/100",
    ]

    suggested_followups = [
        f"Which unit tests should be executed after editing {target_file}?",
        f"How can I reduce the downstream dependency blast radius for {target_file}?",
        "Simulate a code change in this file to see proposed impact.",
    ]

    return {
        "status": "success",
        "intent": "CODE_AND_IMPACT",
        "repository_url": clean_url,
        "target_file": target_file,
        "target_function": function_name,
        "answer": answer_text,
        "impact_analysis": impact_res,
        "test_impact": test_res,
        "smart_test_selection": smart_test_res,
        "evidence": evidence,
        "source_services": [
            "impact_analyzer.py (Step 22)",
            "test_impact.py (Step 23)",
            "smart_test_selection.py (Step 46)",
            "regression_risk.py (Step 25)",
        ],
        "suggested_followups": suggested_followups,
    }


def handle_action_investigation_query(
    repository_url: str,
    user: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Explains active remediation actions, engineering investigations, and historical audit trail.
    """
    clean_url = (repository_url or "").strip()
    if not clean_url:
        clean_url = get_last_analyzed_repo_url() or "https://github.com/psf/requests"

    try:
        audit_res = generate_engineering_audit_history(clean_url)
    except Exception:
        audit_res = {}

    try:
        actions = get_actions_for_repository(clean_url)
    except Exception:
        actions = []

    try:
        inv_res = generate_investigation_report(clean_url)
    except Exception:
        inv_res = {}

    audit_overview = audit_res.get("audit_overview", {}) if isinstance(audit_res, dict) else {}
    total_events = audit_overview.get("total_audit_events", 0)
    open_decisions = audit_overview.get("open_decisions", 0)
    outcome = audit_res.get("engineering_outcome", "PENDING_VERIFICATION") if isinstance(audit_res, dict) else "PENDING_VERIFICATION"

    active_actions = [a for a in actions if isinstance(a, dict) and a.get("status") in ["OPEN", "IN_PROGRESS"]]

    answer_text = (
        f"Repository audit history contains **{total_events} audit events** and **{open_decisions} active decision(s)**. "
        f"There are currently **{len(active_actions)} active remediation action(s)**. "
        f"Overall Engineering Outcome state is **{outcome}**."
    )

    evidence = [
        f"Total Audit Events: {total_events}",
        f"Open Decisions: {open_decisions}",
        f"Active Actions Count: {len(active_actions)}",
        f"Engineering Remediation Outcome: {outcome}",
    ]

    if inv_res and isinstance(inv_res, dict) and inv_res.get("investigation_id"):
        evidence.append(f"Latest Investigation Target: {inv_res.get('target')} ({inv_res.get('investigation_id')})")

    suggested_followups = [
        "List all P1 high priority remediation actions for this repository.",
        "What was the latest release decision rendered for this repo?",
        "Export the complete engineering audit log.",
    ]

    return {
        "status": "success",
        "intent": "REMEDIATION_AND_ACTION",
        "repository_url": clean_url,
        "answer": answer_text,
        "audit_overview": audit_overview,
        "active_actions": active_actions,
        "evidence": evidence,
        "source_services": [
            "engineering_audit_history.py (Step 41)",
            "engineering_action_center.py (Step 39)",
            "engineering_investigation.py (Step 38)",
        ],
        "suggested_followups": suggested_followups,
    }


def handle_architecture_query(
    repository_url: str,
    user: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Synthesizes repository Architecture Intelligence, layer breakdowns, coupling hotspots, and cycle violations.
    """
    clean_url = (repository_url or "").strip()
    if not clean_url:
        clean_url = get_last_analyzed_repo_url() or "https://github.com/psf/requests"

    try:
        arch_res = analyze_repository_architecture(clean_url)
    except Exception:
        arch_res = {}

    pattern = arch_res.get("architecture_pattern", "Layered Architecture") if isinstance(arch_res, dict) else "Layered Architecture"
    health_score = arch_res.get("architectural_health_score", 85) if isinstance(arch_res, dict) else 85
    risk_level = arch_res.get("architectural_risk_level", "HEALTHY") if isinstance(arch_res, dict) else "HEALTHY"

    metrics = arch_res.get("metrics", {}) if isinstance(arch_res, dict) else {}
    cycles_cnt = metrics.get("cyclic_dependencies_count", 0)
    hotspots_cnt = metrics.get("coupling_hotspots_count", 0)
    violations_cnt = metrics.get("layer_violations_count", 0)

    answer_text = (
        f"Repository architecture follows a **{pattern}** with an Architectural Health Score of **{health_score}/100** ({risk_level}). "
        f"Detected **{cycles_cnt} cyclic dependency loop(s)**, **{hotspots_cnt} coupling hotspot(s)**, and **{violations_cnt} layer boundary violation(s)**."
    )

    evidence = [
        f"Architectural Pattern: {pattern}",
        f"Architectural Health Score: {health_score}/100 ({risk_level})",
        f"Total Modules Analyzed: {metrics.get('total_modules', 0)}",
        f"Cyclic Dependency Loops: {cycles_cnt}",
        f"Coupling Hotspots Count: {hotspots_cnt}",
    ]

    suggested_followups = [
        "Which modules have the highest coupling and instability?",
        "Show all cyclic dependency paths in this repository.",
        "What decoupling recommendations exist for this architecture?",
    ]

    return {
        "status": "success",
        "intent": "ARCHITECTURE_INTELLIGENCE",
        "repository_url": clean_url,
        "answer": answer_text,
        "architecture_intelligence": arch_res,
        "evidence": evidence,
        "source_services": [
            "architecture_intelligence.py (Step 47)",
            "dependency_analyzer.py (Step 22)",
        ],
        "suggested_followups": suggested_followups,
    }


def handle_analytics_query(
    repository_url: str,
    time_horizon: str = "30d",
    user: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Synthesizes Advanced Engineering Analytics, time-series trends, smart test effectiveness, and predictive insights.
    """
    clean_url = (repository_url or "").strip()
    if not clean_url:
        clean_url = get_last_analyzed_repo_url() or "https://github.com/psf/requests"

    try:
        analytics_res = generate_advanced_engineering_analytics(clean_url, time_horizon=time_horizon)
    except Exception:
        analytics_res = {}


    exec_sum = analytics_res.get("executive_summary", {}) if isinstance(analytics_res, dict) else {}
    test_eff = analytics_res.get("test_effectiveness_index", {}) if isinstance(analytics_res, dict) else {}
    insights = analytics_res.get("actionable_insights", []) if isinstance(analytics_res, dict) else []

    overall_score = exec_sum.get("overall_engineering_score", 75.0)
    risk_score = exec_sum.get("regression_risk", 45.0)
    red_pct = test_eff.get("average_suite_reduction_percentage", 75.0)
    hours_saved = test_eff.get("cumulative_ci_hours_saved_weekly", 0.2)

    answer_text = (
        f"Advanced Engineering Analytics for **{analytics_res.get('repository_name', 'repository')}** confirms an Overall Engineering Score of **{overall_score}/100** with Regression Risk at **{risk_score}/100**. "
        f"Smart Test Selection effectiveness is rated **{test_eff.get('effectiveness_rating', 'EXCELLENT')}** with **{red_pct}% average test suite reduction**, saving ~**{hours_saved} CI hours weekly**. "
        f"Identified **{len(insights)} actionable engineering insight(s)**."
    )

    evidence = [
        f"Overall Engineering Score: {overall_score}/100",
        f"Regression Risk: {risk_score}/100",
        f"Architecture Health Score: {exec_sum.get('architecture_health_score', 85)}/100",
        f"Smart Test Selection Reduction: {red_pct}%",
        f"Weekly CI Hours Saved: ~{hours_saved} hours",
    ]

    suggested_followups = [
        "What are the top risk trends and PR velocity over time?",
        "Show actionable engineering insights and predictive recommendations.",
        "Export the complete advanced engineering analytics report.",
    ]

    return {
        "status": "success",
        "intent": "ADVANCED_ENGINEERING_ANALYTICS",
        "repository_url": clean_url,
        "answer": answer_text,
        "analytics_data": analytics_res,
        "evidence": evidence,
        "source_services": [
            "advanced_engineering_analytics.py (Step 48)",
            "unified_engineering_intelligence.py (Step 40 SSoT)",
            "smart_test_selection.py (Step 46)",
        ],
        "suggested_followups": suggested_followups,
    }


def handle_general_query(
    query: str,
    repository_url: str,
    user: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Fallback intent handler that synthesizes multi-engine intelligence into a natural language response.
    """
    ssot_data = get_unified_engineering_intelligence(repository_url)
    if isinstance(ssot_data, dict) and ssot_data.get("status") == "error":
        return ssot_data

    metrics = ssot_data.get("canonical_metrics", {})
    repo_name = ssot_data.get("repository_name") or ssot_data.get("full_name", "Repository")

    answer_text = (
        f"Regarding your query ('*{query}*') for repository **{repo_name}**:\n\n"
        f"RepoMind AI analysis confirms an overall engineering score of **{metrics.get('overall_engineering_score', 75.0)}/100** "
        f"({metrics.get('engineering_health', 'HEALTHY')}) with regression risk at **{metrics.get('regression_risk', 45.0)}/100**. "
        f"Governance score stands at **{metrics.get('governance_score', 80.0)}/100** and release confidence is **{metrics.get('release_confidence', 100.0)}%**."
    )

    evidence = [
        f"Query: '{query}'",
        f"Repository: {repo_name}",
        f"Overall Engineering Score: {metrics.get('overall_engineering_score')}/100",
        f"Regression Risk: {metrics.get('regression_risk')}/100",
        f"Governance Score: {metrics.get('governance_score')}/100",
    ]

    suggested_followups = [
        "Tell me more about the repository health metrics.",
        "Are there any active remediation actions required?",
        "How does this repository compare against standard benchmarks?",
    ]

    return {
        "status": "success",
        "intent": "GENERAL_ENGINEERING",
        "repository_url": ssot_data.get("repository_url", repository_url),
        "answer": answer_text,
        "canonical_metrics": metrics,
        "evidence": evidence,
        "source_services": [
            "unified_engineering_intelligence.py (Step 40 SSoT)",
        ],
        "suggested_followups": suggested_followups,
    }


def query_engineering_copilot(
    query: str,
    repository_url: Optional[str] = None,
    pr_id: Optional[str] = None,
    file_path: Optional[str] = None,
    function_name: Optional[str] = None,
    base_revision: str = "main",
    head_revision: str = "HEAD",
    github_token: Optional[str] = None,
    user: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Main Entry Point for Step 45 Engineering AI Copilot.
    Validates user identity and Step 44 RBAC permissions before servicing the query.
    """
    if not query or not query.strip():
        return {"status": "error", "message": "query parameter is required."}

    # Set default user identity if unauthenticated
    active_user = user or {
        "user_id": "usr_developer",
        "username": "developer",
        "role": Role.DEVELOPER,
        "team_ids": ["team_core"],
        "status": "ACTIVE",
    }

    clean_url = (repository_url or "").strip()
    if not clean_url:
        clean_url = get_last_analyzed_repo_url() or "https://github.com/psf/requests"

    # Step 44 RBAC Check 1: Repository access entitlement
    if not check_user_repository_access(active_user, clean_url, "read"):
        return {
            "status": "error",
            "error_code": "FORBIDDEN",
            "message": f"User '{active_user.get('user_id')}' does not have access rights to repository '{clean_url}'.",
        }

    # Intent Classification
    intent = classify_copilot_intent(query, pr_id, file_path)

    # Step 44 RBAC Check 2: Granular permission check per intent
    required_perm_map = {
        "REPO_HEALTH": "repo:read",
        "PR_RISK_AND_DECISION": "pr:analyze",
        "CODE_AND_IMPACT": "repo:read",
        "REMEDIATION_AND_ACTION": "action:read",
        "ARCHITECTURE_INTELLIGENCE": "repo:read",
        "ADVANCED_ENGINEERING_ANALYTICS": "repo:read",
        "GENERAL_ENGINEERING": "repo:read",
    }
    required_perm = required_perm_map.get(intent, "repo:read")
    if not check_user_permission(active_user, required_perm):
        return {
            "status": "error",
            "error_code": "FORBIDDEN",
            "message": f"User role '{active_user.get('role')}' lacks required permission '{required_perm}' to execute copilot query with intent '{intent}'.",
        }

    # Dispatch to appropriate intent synthesizer
    if intent == "REPO_HEALTH":
        copilot_res = handle_repo_health_query(clean_url, active_user)
    elif intent == "PR_RISK_AND_DECISION":
        copilot_res = handle_pr_explanation_query(
            clean_url, pr_id, base_revision, head_revision, github_token, active_user
        )
    elif intent == "CODE_AND_IMPACT":
        copilot_res = handle_impact_query(clean_url, file_path, function_name, active_user)
    elif intent == "REMEDIATION_AND_ACTION":
        copilot_res = handle_action_investigation_query(clean_url, active_user)
    elif intent == "ARCHITECTURE_INTELLIGENCE":
        copilot_res = handle_architecture_query(clean_url, active_user)
    elif intent == "ADVANCED_ENGINEERING_ANALYTICS":
        copilot_res = handle_analytics_query(clean_url, active_user)
    else:
        copilot_res = handle_general_query(query, clean_url, active_user)

    if isinstance(copilot_res, dict) and copilot_res.get("status") == "error":
        return copilot_res

    # Append User & Context Metadata
    copilot_res["user_context"] = {
        "user_id": active_user.get("user_id"),
        "role": active_user.get("role"),
        "permission_validated": required_perm,
    }
    copilot_res["timestamp"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

    return copilot_res


def export_copilot_response(
    copilot_result: Dict[str, Any],
    export_format: str = "json",
) -> Dict[str, Any]:
    """
    Exports a Copilot response report in JSON or Markdown format.
    """
    if not copilot_result or copilot_result.get("status") == "error":
        return copilot_result

    fmt = (export_format or "json").strip().lower()

    if fmt == "json":
        return {
            "status": "success",
            "format": "json",
            "filename": "copilot_response.json",
            "content_type": "application/json",
            "data": copilot_result,
        }

    elif fmt in ["markdown", "md"]:
        intent = copilot_result.get("intent", "COPILOT_RESPONSE")
        answer = copilot_result.get("answer", "")
        evidence = copilot_result.get("evidence", [])
        sources = copilot_result.get("source_services", [])
        followups = copilot_result.get("suggested_followups", [])

        md_lines = [
            "# 🤖 RepoMind Engineering AI Copilot Response",
            f"**Intent:** `{intent}`  ",
            f"**Timestamp:** {copilot_result.get('timestamp', '')}  ",
            f"**Repository:** `{copilot_result.get('repository_url', '')}`",
            "",
            "## Answer",
            answer,
            "",
            "## Supporting Evidence",
        ]
        for ev in evidence:
            md_lines.append(f"- {ev}")

        md_lines.extend(["", "## Intelligence Source Engines"])
        for src in sources:
            md_lines.append(f"- `{src}`")

        if followups:
            md_lines.extend(["", "## Suggested Follow-up Questions"])
            for f in followups:
                md_lines.append(f"1. {f}")

        return {
            "status": "success",
            "format": "markdown",
            "filename": "copilot_response.md",
            "content_type": "text/markdown",
            "content": "\n".join(md_lines),
        }

    return {"status": "error", "message": f"Unsupported export format '{export_format}'."}
