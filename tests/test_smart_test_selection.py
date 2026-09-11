import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.smart_test_selection import select_smart_tests, export_smart_test_selection
from app.services.pull_request_intelligence import generate_pull_request_intelligence
from app.services.engineering_ai_copilot import handle_impact_query
from app.services.rbac import seed_default_users_and_teams

client = TestClient(app)

TEST_REPO_URL = "https://github.com/psf/requests"


@pytest.fixture(autouse=True)
def reset_rbac_data():
    seed_default_users_and_teams()


def test_smart_test_selection_single_file():
    res = select_smart_tests(
        repository_url=TEST_REPO_URL,
        changed_files=["requests/api.py"],
        changed_function="get",
    )
    assert res["status"] == "success"
    assert "summary" in res
    assert "selected_tests" in res
    assert "pytest_command" in res
    assert len(res["selected_tests"]) > 0

    first_test = res["selected_tests"][0]
    assert "execution_tier" in first_test
    assert "confidence" in first_test
    assert "dependency_trace" in first_test
    assert "why_selected" in first_test


def test_smart_test_selection_pr():
    res = select_smart_tests(
        repository_url=TEST_REPO_URL,
        pr_id="pr-101",
    )
    assert res["status"] == "success"
    assert res["pr_id"] == "pr-101"
    assert isinstance(res["selected_tests"], list)


def test_minimal_test_set_reduction():
    res = select_smart_tests(
        repository_url=TEST_REPO_URL,
        changed_files=["requests/api.py"],
    )
    summary = res["summary"]
    assert summary["total_repository_tests"] >= summary["selected_test_count"]
    assert summary["test_reduction_percentage"] >= 0.0
    assert summary["estimated_time_saved_seconds"] >= 0.0


def test_execution_tiers_and_ranking():
    res = select_smart_tests(
        repository_url=TEST_REPO_URL,
        changed_files=["requests/api.py"],
    )
    selected = res["selected_tests"]
    if len(selected) > 1:
        # Tier order should be non-decreasing
        tier_orders = [t["tier_order"] for t in selected]
        assert tier_orders == sorted(tier_orders)


def test_exclusion_reasons():
    res = select_smart_tests(
        repository_url=TEST_REPO_URL,
        changed_files=["requests/api.py"],
    )
    omitted = res.get("omitted_tests", [])
    if omitted:
        first_omitted = omitted[0]
        assert "exclusion_reason" in first_omitted
        assert len(first_omitted["exclusion_reason"]) > 0


def test_export_smart_test_selection():
    sample_data = select_smart_tests(
        repository_url=TEST_REPO_URL,
        changed_files=["requests/api.py"],
    )

    json_export = export_smart_test_selection(sample_data, "json")
    assert json_export["status"] == "success"
    assert json_export["format"] == "json"

    md_export = export_smart_test_selection(sample_data, "markdown")
    assert md_export["status"] == "success"
    assert md_export["format"] == "markdown"
    assert "# 🎯 RepoMind Smart Test Selection Report" in md_export["content"]

    sh_export = export_smart_test_selection(sample_data, "shell")
    assert sh_export["status"] == "success"
    assert sh_export["format"] == "shell"
    assert "pytest" in sh_export["content"]


def test_pr_and_copilot_integrations():
    # Verify PR Intelligence includes smart test selection
    pr_res = generate_pull_request_intelligence(repository_url=TEST_REPO_URL, pr_id="101")
    assert pr_res["status"] == "success"
    assert "test_impact" in pr_res
    affected_tests = pr_res["test_impact"].get("affected_tests", [])
    assert len(affected_tests) > 0
    if affected_tests:
        assert "execution_tier" in affected_tests[0] or "priority" in affected_tests[0]

    # Verify Copilot impact query includes smart test selection
    copilot_res = handle_impact_query(repository_url=TEST_REPO_URL, file_path="requests/api.py")
    assert copilot_res["status"] == "success"
    assert "smart_test_selection" in copilot_res


def test_smart_test_selection_api_endpoints():
    headers = {"X-API-Key": "key_dev_secret_789"}

    # Test /api/smart-test-selection
    payload = {
        "repository_url": TEST_REPO_URL,
        "changed_files": ["requests/api.py"],
        "changed_function": "get",
    }
    resp = client.post("/api/smart-test-selection", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "pytest_command" in data

    # Test /api/smart-test-selection/export
    export_payload = {
        "selection_data": data,
        "export_format": "markdown",
    }
    exp_resp = client.post("/api/smart-test-selection/export", json=export_payload, headers=headers)
    assert exp_resp.status_code == 200
    exp_data = exp_resp.json()
    assert exp_data["status"] == "success"
    assert "smart_test_selection.md" in exp_data["filename"]


def test_docs_conf_does_not_match_conftest_or_config():
    res = select_smart_tests(
        repository_url=TEST_REPO_URL,
        changed_files=["docs/conf.py"],
    )
    assert res["status"] == "success"
    selected_files = [t["test_file"].replace("\\", "/").lower() for t in res["selected_tests"]]

    # Verify no false positive matches on conftest.py or test_config.py
    for s_file in selected_files:
        assert "conftest.py" not in s_file
        assert "test_config.py" not in s_file
        assert "test_instance_config.py" not in s_file

    assert len(selected_files) == 0


def test_legitimate_config_module_impact():
    from app.services.test_impact import compute_test_impact
    res = compute_test_impact(
        repository_url=TEST_REPO_URL,
        changed_file="requests/hooks.py",
    )
    assert res["status"] == "success"
    affected = [t["test_file"].replace("\\", "/").lower() for t in res["affected_tests"]]
    assert any("test_hooks.py" in f for f in affected)

