import os
import json
import hmac
import hashlib
import datetime
from typing import Dict, Any, List, Optional

# In-memory store for integrations and delivery audit logs
_INTEGRATIONS_STORE: List[Dict[str, Any]] = [
    {
        "id": "integ_wh_prod_01",
        "name": "Production Webhook Dispatcher",
        "integration_type": "WEBHOOK",
        "url": "https://example.com/webhook/demo",
        "secret": "demo-secret-not-for-production",
        "is_enabled": True,
        "events_subscribed": ["PR_HIGH_RISK", "RELEASE_GATE_BLOCKED", "GOVERNANCE_VIOLATION"],
        "created_by": "user_admin_1",
        "created_at": "2026-09-01T10:00:00Z",
        "updated_at": "2026-09-01T10:00:00Z",
    },
    {
        "id": "integ_slack_devops",
        "name": "DevOps Alerts Channel",
        "integration_type": "SLACK",
        "url": "https://example.com/webhook/slack-demo",
        "secret": "demo-slack-secret-not-for-production",
        "is_enabled": True,
        "events_subscribed": ["RELEASE_GATE_BLOCKED", "ARCH_CRITICAL_HEALTH", "REGRESSION_RISK_BREACH"],
        "created_by": "user_lead_1",
        "created_at": "2026-09-02T11:30:00Z",
        "updated_at": "2026-09-02T11:30:00Z",
    },
]

_DELIVERY_LOGS_STORE: List[Dict[str, Any]] = [
    {
        "id": "del_log_1001",
        "integration_id": "integ_wh_prod_01",
        "event_type": "RELEASE_GATE_BLOCKED",
        "status": "SUCCESS",
        "http_status_code": 200,
        "signature_header": "sha256=demo_signature_hash_placeholder_00000000000000000000000000000000",
        "payload_snippet": '{"event_type": "RELEASE_GATE_BLOCKED", "severity": "CRITICAL"}',
        "response_body": '{"status": "received", "delivery_id": "dlv_9921"}',
        "retry_count": 0,
        "timestamp": "2026-09-10T18:30:00Z",
    }
]


def mask_secret(secret_val: str) -> str:
    """Masks secrets and tokens for safe display in UI/API responses."""
    if not secret_val:
        return ""
    if len(secret_val) <= 8:
        return "****"
    prefix = secret_val[:6]
    return f"{prefix}****"


def mask_integration(integ: Dict[str, Any]) -> Dict[str, Any]:
    """Returns a copy of the integration dictionary with sensitive attributes masked."""
    masked = dict(integ)
    masked["secret"] = mask_secret(integ.get("secret", ""))
    url_val = integ.get("url", "")
    if "example.com/webhook/" in url_val and len(url_val) > 30:
        masked["url"] = f"{url_val[:28]}****"
    return masked


def generate_hmac_signature(payload_json: str, secret: str) -> str:
    """Generates SHA256 HMAC signature for webhook authentication."""
    if not secret:
        secret = "demo-repomind-secret"
    mac = hmac.new(secret.encode("utf-8"), payload_json.encode("utf-8"), hashlib.sha256)
    return f"sha256={mac.hexdigest()}"


def list_integrations() -> List[Dict[str, Any]]:
    """Lists all registered integrations with masked secrets."""
    return [mask_integration(i) for i in _INTEGRATIONS_STORE]


def get_integration_by_id(integration_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves an integration by ID with masked secret."""
    for i in _INTEGRATIONS_STORE:
        if i["id"] == integration_id:
            return mask_integration(i)
    return None


def get_raw_integration(integration_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves the unmasked integration object for internal delivery dispatch."""
    for i in _INTEGRATIONS_STORE:
        if i["id"] == integration_id:
            return i
    return None


def create_integration(
    name: str,
    integration_type: str,
    url: str,
    secret: Optional[str] = None,
    events_subscribed: Optional[List[str]] = None,
    created_by: str = "user_admin_1",
) -> Dict[str, Any]:
    """Creates a new integration configuration."""
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    integ_id = f"integ_{integration_type.lower()}_{hashlib.md5(f'{name}{url}{now_iso}'.encode()).hexdigest()[:8]}"
    
    sec_val = secret if secret else f"demo_sec_{hashlib.sha256(now_iso.encode()).hexdigest()[:16]}"
    events = events_subscribed if events_subscribed is not None else ["PR_HIGH_RISK", "RELEASE_GATE_BLOCKED"]

    new_integ = {
        "id": integ_id,
        "name": name.strip(),
        "integration_type": integration_type.strip().upper(),
        "url": url.strip(),
        "secret": sec_val.strip(),
        "is_enabled": True,
        "events_subscribed": events,
        "created_by": created_by,
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    _INTEGRATIONS_STORE.append(new_integ)
    return mask_integration(new_integ)


def update_integration(integration_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Updates an existing integration configuration."""
    raw = get_raw_integration(integration_id)
    if not raw:
        return None

    if "name" in updates and updates["name"]:
        raw["name"] = updates["name"].strip()
    if "integration_type" in updates and updates["integration_type"]:
        raw["integration_type"] = updates["integration_type"].strip().upper()
    if "url" in updates and updates["url"]:
        raw["url"] = updates["url"].strip()
    if "secret" in updates and updates["secret"] and not updates["secret"].startswith("****") and not "...." in updates["secret"]:
        raw["secret"] = updates["secret"].strip()
    if "is_enabled" in updates and isinstance(updates["is_enabled"], bool):
        raw["is_enabled"] = updates["is_enabled"]
    if "events_subscribed" in updates and isinstance(updates["events_subscribed"], list):
        raw["events_subscribed"] = updates["events_subscribed"]

    raw["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    return mask_integration(raw)


def delete_integration(integration_id: str) -> bool:
    """Deletes an integration configuration by ID."""
    global _INTEGRATIONS_STORE
    initial_count = len(_INTEGRATIONS_STORE)
    _INTEGRATIONS_STORE = [i for i in _INTEGRATIONS_STORE if i["id"] != integration_id]
    return len(_INTEGRATIONS_STORE) < initial_count


def dispatch_test_delivery(integration_id: str) -> Dict[str, Any]:
    """
    Executes a test payload delivery for an integration, generates HMAC signature header,
    simulates/records delivery audit status, and returns execution result.
    """

    raw = get_raw_integration(integration_id)
    if not raw:
        return {
            "success": False,
            "message": f"Integration ID {integration_id} not found",
            "http_status_code": 404,
        }

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    sample_payload = {
        "event_id": "evt_test_delivery_999",
        "event_type": "TEST_WEBHOOK_PING",
        "severity": "INFO",
        "repository_url": "https://github.com/psf/requests",
        "title": "RepoMind AI Webhook Verification Ping",
        "summary": f"Test payload dispatched to {raw['name']} ({raw['integration_type']})",
        "source_engine": "notifications_integrations.py (Step 49)",
        "timestamp": now_iso,
    }

    payload_str = json.dumps(sample_payload, sort_keys=True)
    sig_header = generate_hmac_signature(payload_str, raw.get("secret", ""))

    # Simulate webhook delivery result
    http_code = 200 if raw.get("is_enabled", True) else 400
    status_str = "SUCCESS" if http_code == 200 else "DISABLED"

    log_entry = {
        "id": f"del_log_{hashlib.md5((now_iso + integration_id).encode()).hexdigest()[:8]}",
        "integration_id": integration_id,
        "integration_name": raw["name"],
        "event_type": "TEST_WEBHOOK_PING",
        "status": status_str,
        "http_status_code": http_code,
        "signature_header": sig_header,
        "payload_snippet": payload_str[:150] + "...",
        "response_body": json.dumps({"status": "delivered", "message": "Signature verified ok"}),
        "retry_count": 0,
        "timestamp": now_iso,
    }

    _DELIVERY_LOGS_STORE.append(log_entry)
    if len(_DELIVERY_LOGS_STORE) > 100:
        _DELIVERY_LOGS_STORE.pop(0)

    return {
        "success": http_code == 200,
        "message": f"Test notification delivered successfully to {raw['name']}",
        "http_status_code": http_code,
        "signature_header": sig_header,
        "log_id": log_entry["id"],
    }


def list_delivery_logs(integration_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Lists recent notification delivery audit logs."""
    logs = list(_DELIVERY_LOGS_STORE)
    if integration_id:
        logs = [l for l in logs if l.get("integration_id") == integration_id]
    logs.reverse()
    return logs[:limit]
