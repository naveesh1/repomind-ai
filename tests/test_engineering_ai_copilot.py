import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.engineering_ai_copilot import (
    classify_copilot_intent,
    handle_repo_health_query,
    handle_pr_explanation_query,
    handle_impact_query,
    handle_action_investigation_query,
    handle_general_query,
    query_engineering_copilot,
    export_copilot_response,
    SUPPORTED_INTENTS,
)
from app.services.rbac import Role, seed_default_users_and_teams, create_user, create_team

client = TestClient(app)

TEST_REPO_URL = "https://github.com/psf/requests"


@pytest.fixture(autouse=True)
def reset_rbac_data():
    seed_default_users_and_teams()


def test_classify_copilot_intent():
    assert classify_copilot_intent("What is the PR risk for pr 42?", pr_id="42") == "PR_RISK_AND_DECISION"
    assert classify_copilot_intent("Explain the diff for merge request") == "PR_RISK_AND_DECISION"
    assert classify_copilot_intent("What downstream functions break if I edit file?", file_path="src/main.py") == "CODE_AND_IMPACT"
    assert classify_copilot_intent("Show caller callee dependency AST impact") == "CODE_AND_IMPACT"
    assert classify_copilot_intent("List active remediation actions and audit history") == "REMEDIATION_AND_ACTION"
    assert classify_copilot_intent("What is the overall engineering health score?") == "REPO_HEALTH"
    assert classify_copilot_intent("How does the architecture work?") == "ARCHITECTURE_INTELLIGENCE"


def test_handle_repo_health_query():
    dev_user = {
        "user_id": "usr_developer",
        "username": "developer",
        "role": Role.DEVELOPER,
        "team_ids": ["team_core"],
        "status": "ACTIVE",
    }
    result = handle_repo_health_query(TEST_REPO_URL, dev_user)
    assert result["status"] == "success"
    assert result["intent"] == "REPO_HEALTH"
    assert "Overall Engineering Score" in result["answer"]
    assert "canonical_metrics" in result
    assert len(result["evidence"]) >= 3
    assert len(result["suggested_followups"]) >= 1


def test_handle_pr_explanation_query():
    dev_user = {
        "user_id": "usr_developer",
        "username": "developer",
        "role": Role.DEVELOPER,
        "team_ids": ["team_core"],
        "status": "ACTIVE",
    }
    result = handle_pr_explanation_query(TEST_REPO_URL, pr_id="101", user=dev_user)
    assert result["status"] == "success"
    assert result["intent"] == "PR_RISK_AND_DECISION"
    assert "Regression Risk" in result["answer"]
    assert "release_gate_evaluation" in result
    assert len(result["evidence"]) >= 2


def test_handle_impact_query():
    dev_user = {
        "user_id": "usr_developer",
        "username": "developer",
        "role": Role.DEVELOPER,
        "team_ids": ["team_core"],
        "status": "ACTIVE",
    }
    result = handle_impact_query(TEST_REPO_URL, file_path="requests/api.py", function_name="get", user=dev_user)
    assert result["status"] == "success"
    assert result["intent"] == "CODE_AND_IMPACT"
    assert "requests/api.py" in result["target_file"]
    assert "impact_analysis" in result
    assert "test_impact" in result


def test_handle_action_investigation_query():
    dev_user = {
        "user_id": "usr_developer",
        "username": "developer",
        "role": Role.DEVELOPER,
        "team_ids": ["team_core"],
        "status": "ACTIVE",
    }
    result = handle_action_investigation_query(TEST_REPO_URL, dev_user)
    assert result["status"] == "success"
    assert result["intent"] == "REMEDIATION_AND_ACTION"
    assert "audit events" in result["answer"]
    assert "audit_overview" in result
    assert isinstance(result["active_actions"], list)


def test_query_engineering_copilot_rbac_allowed():
    dev_user = {
        "user_id": "usr_developer",
        "username": "developer",
        "role": Role.DEVELOPER,
        "team_ids": ["team_core"],
        "status": "ACTIVE",
    }
    res = query_engineering_copilot("What is the health of this repository?", TEST_REPO_URL, user=dev_user)
    assert res["status"] == "success"
    assert res["intent"] == "REPO_HEALTH"
    assert res["user_context"]["role"] == Role.DEVELOPER


def test_query_engineering_copilot_rbac_denied_repo_access():
    # Create a team restricted to private repo and a user in that team
    restricted_team = create_team(
        name="Restricted Team",
        repository_access={"https://github.com/private/repo": "read"}
    )
    restricted_user = create_user(
        username="restricted_user",
        email="restricted@domain.com",
        full_name="Restricted User",
        role=Role.DEVELOPER,
        team_ids=[restricted_team["team_id"]],
    )

    res = query_engineering_copilot(
        query="What is the health score?",
        repository_url="https://github.com/unauthorized/secret-repo",
        user=restricted_user,
    )
    assert res["status"] == "error"
    assert res["error_code"] == "FORBIDDEN"
    assert "does not have access rights" in res["message"]


def test_query_engineering_copilot_rbac_denied_permission():
    # User with a role that has no permissions
    custom_user = {
        "user_id": "usr_unprivileged",
        "username": "unprivileged",
        "role": "GUEST_NO_PERM",
        "team_ids": ["team_core"],
        "status": "ACTIVE",
    }

    res = query_engineering_copilot(
        query="What is the PR risk?",
        repository_url=TEST_REPO_URL,
        pr_id="pr_99",
        user=custom_user,
    )
    assert res["status"] == "error"
    assert res["error_code"] == "FORBIDDEN"
    assert "lacks required permission" in res["message"]


def test_export_copilot_response():
    sample_result = {
        "status": "success",
        "intent": "REPO_HEALTH",
        "repository_url": TEST_REPO_URL,
        "answer": "Repository has score 85/100.",
        "evidence": ["Score: 85/100"],
        "source_services": ["unified_engineering_intelligence.py"],
        "suggested_followups": ["What is code quality?"],
        "timestamp": "2026-09-10T12:00:00Z",
    }

    json_export = export_copilot_response(sample_result, "json")
    assert json_export["status"] == "success"
    assert json_export["format"] == "json"
    assert json_export["data"] == sample_result

    md_export = export_copilot_response(sample_result, "markdown")
    assert md_export["status"] == "success"
    assert md_export["format"] == "markdown"
    assert "# 🤖 RepoMind Engineering AI Copilot Response" in md_export["content"]


def test_copilot_api_endpoints():
    headers = {"X-API-Key": "key_dev_secret_789"}

    # Test /api/copilot/intents
    intents_resp = client.get("/api/copilot/intents", headers=headers)
    assert intents_resp.status_code == 200
    intents_data = intents_resp.json()
    assert intents_data["status"] == "success"
    assert "PR_RISK_AND_DECISION" in intents_data["supported_intents"]

    # Test /api/copilot/query
    query_payload = {
        "query": "What is the overall engineering health of this repository?",
        "repository_url": TEST_REPO_URL,
    }
    query_resp = client.post("/api/copilot/query", json=query_payload, headers=headers)
    assert query_resp.status_code == 200
    copilot_res = query_resp.json()
    assert copilot_res["status"] == "success"
    assert copilot_res["intent"] == "REPO_HEALTH"

    # Test /api/copilot/export
    export_payload = {
        "copilot_result": copilot_res,
        "export_format": "markdown",
    }
    export_resp = client.post("/api/copilot/export", json=export_payload, headers=headers)
    assert export_resp.status_code == 200
    export_data = export_resp.json()
    assert export_data["status"] == "success"
    assert "copilot_response.md" in export_data["filename"]


def test_copilot_api_forbidden():
    # Test forbidden user via invalid header / unprivileged team
    restricted_team = create_team(
        name="Forbidden Team",
        repository_access={"https://github.com/allowed/repo": "read"}
    )
    user = create_user(
        username="blocked_user",
        email="blocked@domain.com",
        full_name="Blocked User",
        role=Role.DEVELOPER,
        team_ids=[restricted_team["team_id"]],
    )
    headers = {"X-API-Key": user["api_key"]}

    query_payload = {
        "query": "What is health?",
        "repository_url": "https://github.com/forbidden/secret-repo",
    }
    query_resp = client.post("/api/copilot/query", json=query_payload, headers=headers)
    assert query_resp.status_code == 403
    assert "does not have access rights" in query_resp.json()["detail"]
