import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.notifications_engine import (
    generate_dedup_hash,
    is_duplicate_event,
    create_event,
    get_notification_events,
    get_notification_preferences,
    update_notification_preferences,
)
from app.services.notifications_integrations import (
    mask_secret,
    generate_hmac_signature,
    list_integrations,
    create_integration,
    get_integration_by_id,
    update_integration,
    delete_integration,
    dispatch_test_delivery,
    list_delivery_logs,
)


from app.services.rbac import seed_default_users_and_teams

client = TestClient(app)

DEV_HEADERS = {"X-API-Key": "key_dev_secret_789"}
ADMIN_HEADERS = {"X-API-Key": "key_admin_secret_123"}
VIEWER_HEADERS = {"X-API-Key": "key_viewer_secret_000"}



@pytest.fixture(autouse=True)
def reset_rbac():
    seed_default_users_and_teams()



def test_generate_dedup_hash_and_deduplication():
    url = "https://github.com/psf/requests"
    h1 = generate_dedup_hash(url, "PR_HIGH_RISK", "CRITICAL", "pr_101")
    h2 = generate_dedup_hash(url, "PR_HIGH_RISK", "CRITICAL", "pr_101")
    assert h1 == h2
    assert len(h1) == 64  # SHA256 length

    # Deduplication test
    unique_hash = "test_hash_" + h1[:10]
    assert not is_duplicate_event(unique_hash, window_seconds=900)
    assert is_duplicate_event(unique_hash, window_seconds=900)


def test_create_and_filter_events():
    evt = create_event(
        event_type="RELEASE_GATE_BLOCKED",
        severity="CRITICAL",
        repository_url="https://github.com/psf/requests",
        title="Test Critical Block",
        summary="Unit test mock event",
        payload={"blocker_count": 2},
        source_engine="test_notifications_integrations.py",
        key_detail="unique_key_001",
    )
    assert evt is not None
    assert evt["event_type"] == "RELEASE_GATE_BLOCKED"
    assert evt["severity"] == "CRITICAL"

    # Fetch events via engine
    events = get_notification_events("https://github.com/psf/requests", severity_filter="CRITICAL")
    assert len(events) >= 1
    assert any(e["title"] == "Test Critical Block" for e in events)


def test_notification_preferences():
    user_id = "test_usr_88"
    prefs = get_notification_preferences(user_id)
    assert prefs["user_id"] == user_id
    assert prefs["email_notifications_enabled"] is True

    updated = update_notification_preferences(user_id, {"digest_frequency": "DAILY", "min_severity": "CRITICAL"})
    assert updated["digest_frequency"] == "DAILY"
    assert updated["min_severity"] == "CRITICAL"


def test_secret_masking_and_hmac():
    secret = "wh_sec_super_secret_key_12345"
    masked = mask_secret(secret)
    assert masked.startswith("wh_sec")
    assert masked.endswith("****")
    assert "super_secret" not in masked

    sig = generate_hmac_signature('{"test": "payload"}', secret)
    assert sig.startswith("sha256=")
    assert len(sig) > 40


def test_integration_crud_and_delivery():
    created = create_integration(
        name="Unit Test Slack Target",
        integration_type="SLACK",
        url="https://example.com/webhook/slack-demo",
        secret="demo_slack_sec_999888",
    )
    assert created["id"].startswith("integ_slack_")
    assert created["secret"].endswith("****")

    fetched = get_integration_by_id(created["id"])
    assert fetched is not None
    assert fetched["name"] == "Unit Test Slack Target"

    # Test delivery
    res = dispatch_test_delivery(created["id"])
    assert res["success"] is True

    assert res["signature_header"].startswith("sha256=")

    # Delivery logs
    logs = list_delivery_logs(integration_id=created["id"])
    assert len(logs) >= 1
    assert logs[0]["integration_id"] == created["id"]

    # Delete
    deleted = delete_integration(created["id"])
    assert deleted is True
    assert get_integration_by_id(created["id"]) is None


# API Endpoint Tests
def test_api_get_events():
    res = client.get("/api/notifications/events?repository_url=https://github.com/psf/requests", headers=DEV_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "events" in data
    assert isinstance(data["events"], list)


def test_api_get_and_update_preferences():
    res = client.get("/api/notifications/preferences", headers=DEV_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "preferences" in data

    update_res = client.post(
        "/api/notifications/preferences",
        headers=DEV_HEADERS,
        json={"digest_frequency": "HOURLY", "email_notifications_enabled": False},
    )
    assert update_res.status_code == 200
    assert update_res.json()["preferences"]["digest_frequency"] == "HOURLY"


def test_api_list_integrations_secret_masking():
    res = client.get("/api/integrations", headers=DEV_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    for integ in data["integrations"]:
        assert "****" in integ["secret"]


def test_api_create_and_test_integration():
    # Admin creates integration
    create_res = client.post(
        "/api/integrations",
        headers=ADMIN_HEADERS,
        json={
            "name": "API Automated Webhook",
            "integration_type": "WEBHOOK",
            "url": "https://api.testcompany.internal/webhook",
            "secret": "wh_sec_api_test_secret_777",
        },
    )
    assert create_res.status_code == 200
    integ = create_res.json()["integration"]
    assert integ["secret"].endswith("****")
    integ_id = integ["id"]

    # Test delivery via API
    test_res = client.post(f"/api/integrations/{integ_id}/test", headers=ADMIN_HEADERS)
    assert test_res.status_code == 200
    assert test_res.json()["result"]["success"] is True

    # Audit logs via API
    logs_res = client.get("/api/integrations/delivery-logs", headers=ADMIN_HEADERS)
    assert logs_res.status_code == 200
    assert len(logs_res.json()["delivery_logs"]) > 0


def test_api_rbac_integration_management_denied():
    # Viewer tries to create an integration -> expect 403 Forbidden
    res = client.post(
        "/api/integrations",
        headers=VIEWER_HEADERS,
        json={
            "name": "Unauthorized Webhook",
            "integration_type": "WEBHOOK",
            "url": "https://unauthorized.org/hook",
        },
    )
    assert res.status_code == 403
