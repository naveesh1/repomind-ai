import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.architecture_intelligence import (
    classify_file_layer,
    find_cyclic_dependencies,
    analyze_repository_architecture,
    evaluate_pr_architectural_impact,
    export_architecture_intelligence,
)
from app.services.engineering_ai_copilot import handle_architecture_query
from app.services.pull_request_intelligence import generate_pull_request_intelligence
from app.services.rbac import seed_default_users_and_teams

client = TestClient(app)

TEST_REPO_URL = "https://github.com/psf/requests"


@pytest.fixture(autouse=True)
def reset_rbac_data():
    seed_default_users_and_teams()


def test_file_layer_classification():
    assert classify_file_layer("backend/app/api/routes.py") == "API / Routes Layer"
    assert classify_file_layer("backend/app/services/architecture.py") == "Services / Domain Layer"
    assert classify_file_layer("backend/app/models/user.py") == "Data / Ingestion Layer"
    assert classify_file_layer("backend/app/utils/helpers.py") == "Utilities / Core Layer"
    assert classify_file_layer("tests/test_main.py") == "Tests Layer"


def test_flask_file_layer_classification():
    assert classify_file_layer("src/flask/app.py") == "API / Routes Layer"
    assert classify_file_layer("src/flask/views.py") == "API / Routes Layer"
    assert classify_file_layer("src/flask/blueprints.py") == "API / Routes Layer"
    assert classify_file_layer("src/flask/cli.py") == "API / Routes Layer"
    assert classify_file_layer("src/flask/ctx.py") == "Services / Domain Layer"
    assert classify_file_layer("src/flask/sessions.py") == "Services / Domain Layer"
    assert classify_file_layer("src/flask/templating.py") == "Services / Domain Layer"
    assert classify_file_layer("src/flask/signals.py") == "Services / Domain Layer"
    assert classify_file_layer("src/flask/json/tag.py") == "Utilities / Core Layer"
    assert classify_file_layer("tests/test_basic.py") == "Tests Layer"
    assert classify_file_layer("examples/tutorial/flaskr/db.py") == "Tests Layer"



def test_cyclic_dependency_detection():
    # Synthetic graph with cycle A -> B -> C -> A
    graph = {
        "A.py": ["B.py"],
        "B.py": ["C.py"],
        "C.py": ["A.py"],
        "D.py": ["B.py"],
    }
    cycles = find_cyclic_dependencies(graph)
    assert len(cycles) >= 1
    first_cycle = cycles[0]
    assert "A.py" in first_cycle and "B.py" in first_cycle and "C.py" in first_cycle


def test_analyze_repository_architecture():
    res = analyze_repository_architecture(TEST_REPO_URL)
    assert res["status"] == "success"
    assert "architectural_health_score" in res
    assert "architecture_pattern" in res
    assert "layer_breakdown" in res
    assert "module_coupling_metrics" in res
    assert res["architectural_health_score"] >= 0 and res["architectural_health_score"] <= 100

    metrics = res["metrics"]
    assert "total_modules" in metrics
    assert "cyclic_dependencies_count" in metrics


def test_evaluate_pr_architectural_impact():
    res = evaluate_pr_architectural_impact(TEST_REPO_URL, pr_id="101")
    assert res["status"] == "success"
    assert "pr_architectural_risk" in res
    assert "hotspots_touched" in res


def test_export_architecture_intelligence():
    sample_data = analyze_repository_architecture(TEST_REPO_URL)

    json_exp = export_architecture_intelligence(sample_data, "json")
    assert json_exp["status"] == "success"
    assert json_exp["format"] == "json"

    md_exp = export_architecture_intelligence(sample_data, "markdown")
    assert md_exp["status"] == "success"
    assert md_exp["format"] == "markdown"
    assert "# 🏛️ RepoMind Architecture Intelligence Report" in md_exp["content"]


def test_copilot_and_pr_integrations():
    # Verify Copilot architecture query
    copilot_res = handle_architecture_query(TEST_REPO_URL)
    assert copilot_res["status"] == "success"
    assert copilot_res["intent"] == "ARCHITECTURE_INTELLIGENCE"
    assert "architecture_intelligence" in copilot_res

    # Verify PR Intelligence includes architecture analysis
    pr_res = generate_pull_request_intelligence(TEST_REPO_URL, pr_id="101")
    assert pr_res["status"] == "success"


def test_architecture_api_endpoints():
    headers = {"X-API-Key": "key_dev_secret_789"}

    # GET /api/architecture-intelligence
    resp = client.get(f"/api/architecture-intelligence?repository_url={TEST_REPO_URL}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "architectural_health_score" in data

    # POST /api/architecture-intelligence/pr-impact
    pr_payload = {"repository_url": TEST_REPO_URL, "pr_id": "101"}
    pr_resp = client.post("/api/architecture-intelligence/pr-impact", json=pr_payload, headers=headers)
    assert pr_resp.status_code == 200
    assert pr_resp.json()["status"] == "success"

    # POST /api/architecture-intelligence/export
    export_payload = {"architecture_data": data, "export_format": "markdown"}
    exp_resp = client.post("/api/architecture-intelligence/export", json=export_payload, headers=headers)
    assert exp_resp.status_code == 200
    assert exp_resp.json()["status"] == "success"
