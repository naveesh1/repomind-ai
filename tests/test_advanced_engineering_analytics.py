import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.advanced_engineering_analytics import (
    generate_time_series_data,
    generate_advanced_engineering_analytics,
    get_analytics_trends,
    export_advanced_engineering_analytics,
)
from app.services.engineering_ai_copilot import handle_analytics_query
from app.services.rbac import seed_default_users_and_teams

client = TestClient(app)

TEST_REPO_URL = "https://github.com/psf/requests"


@pytest.fixture(autouse=True)
def reset_rbac_data():
    seed_default_users_and_teams()


def test_generate_time_series_data():
    ts = generate_time_series_data(75.0, 45.0, 80.0, 80.0, horizon_days=30)
    assert "timestamps" in ts
    assert "health_and_risk_trend" in ts
    assert "pr_velocity_trend" in ts
    assert "smart_test_effectiveness_trend" in ts
    assert "architecture_health_trend" in ts
    assert "governance_and_release_trend" in ts
    assert len(ts["timestamps"]) > 0


def test_generate_advanced_engineering_analytics():
    res = generate_advanced_engineering_analytics(TEST_REPO_URL, time_horizon="30d")
    assert res["status"] == "success"
    assert "executive_summary" in res
    assert "time_series_trends" in res
    assert "test_effectiveness_index" in res
    assert "actionable_insights" in res
    assert "ssot_sources" in res

    exec_sum = res["executive_summary"]
    assert "overall_engineering_score" in exec_sum
    assert "regression_risk" in exec_sum
    assert "architecture_health_score" in exec_sum


def test_get_analytics_trends():
    res = get_analytics_trends(TEST_REPO_URL, time_horizon="7d")
    assert res["status"] == "success"
    assert res["time_horizon"] == "7d"
    assert "trends" in res


def test_export_advanced_engineering_analytics():
    sample_data = generate_advanced_engineering_analytics(TEST_REPO_URL, time_horizon="30d")

    # JSON export
    json_exp = export_advanced_engineering_analytics(sample_data, export_format="json")
    assert json_exp["status"] == "success"
    assert json_exp["format"] == "json"

    # Markdown export
    md_exp = export_advanced_engineering_analytics(sample_data, export_format="markdown")
    assert md_exp["status"] == "success"
    assert md_exp["format"] == "markdown"
    assert "# 📈 RepoMind Advanced Engineering Analytics Report" in md_exp["content"]

    # CSV export
    csv_exp = export_advanced_engineering_analytics(sample_data, export_format="csv")
    assert csv_exp["status"] == "success"
    assert csv_exp["format"] == "csv"
    assert "overall_engineering_score" in csv_exp["content"]


def test_copilot_analytics_integration():
    res = handle_analytics_query(TEST_REPO_URL, time_horizon="30d")
    assert res["status"] == "success"
    assert res["intent"] == "ADVANCED_ENGINEERING_ANALYTICS"
    assert "analytics_data" in res
    assert "executive_summary" in res["analytics_data"]


def test_analytics_api_endpoints():
    headers = {"X-API-Key": "key_dev_secret_789"}

    # GET /api/advanced-engineering-analytics
    resp = client.get(
        f"/api/advanced-engineering-analytics?repository_url={TEST_REPO_URL}&time_horizon=30d",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "executive_summary" in data

    # GET /api/advanced-engineering-analytics/trends
    resp_trends = client.get(
        f"/api/advanced-engineering-analytics/trends?repository_url={TEST_REPO_URL}&time_horizon=7d",
        headers=headers,
    )
    assert resp_trends.status_code == 200
    data_trends = resp_trends.json()
    assert data_trends["status"] == "success"
    assert "trends" in data_trends

    # POST /api/advanced-engineering-analytics/export
    payload = {
        "repository_url": TEST_REPO_URL,
        "time_horizon": "30d",
        "export_format": "markdown",
    }
    resp_export = client.post(
        "/api/advanced-engineering-analytics/export",
        json=payload,
        headers=headers,
    )
    assert resp_export.status_code == 200
    data_export = resp_export.json()
    assert data_export["status"] == "success"
    assert data_export["format"] == "markdown"
