import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.rbac import (
    Role,
    create_user,
    get_user,
    get_user_by_api_key,
    list_users,
    create_team,
    get_team,
    list_teams,
    assign_team_repository_access,
    check_user_permission,
    check_user_repository_access,
    seed_default_users_and_teams,
)
from app.services.engineering_audit_history import create_audit_event, create_engineering_decision

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_rbac_state():
    """Resets seed users and teams before each test."""
    seed_default_users_and_teams()


def test_seed_users_and_teams():
    users = list_users()
    teams = list_teams()

    assert len(users) >= 4
    assert len(teams) >= 2

    admin_user = get_user("usr_admin")
    assert admin_user is not None
    assert admin_user["role"] == Role.ADMIN
    assert admin_user["email"] == "admin@repomind.ai"


def test_create_user_and_lookup():
    new_user = create_user(
        username="alice",
        email="alice@example.com",
        full_name="Alice Developer",
        role=Role.DEVELOPER,
        team_ids=["team_core"],
    )

    assert new_user["user_id"].startswith("usr_")
    assert new_user["username"] == "alice"
    assert new_user["role"] == Role.DEVELOPER
    assert "key_" in new_user["api_key"]

    retrieved = get_user(new_user["user_id"])
    assert "api_key" not in retrieved
    assert retrieved["has_api_key"] is True
    assert retrieved["user_id"] == new_user["user_id"]

    key_user = get_user_by_api_key(new_user["api_key"])
    assert key_user == retrieved
    assert "api_key" not in key_user
    assert key_user["has_api_key"] is True


def test_role_permission_hierarchies():
    admin = get_user("usr_admin")
    lead = get_user("usr_lead")
    dev = get_user("usr_developer")
    viewer = get_user("usr_viewer")

    # Admin has wildcard permission
    assert check_user_permission(admin, "repo:admin") is True
    assert check_user_permission(admin, "any:custom:perm") is True

    # Lead has governance override and team manage
    assert check_user_permission(lead, "governance:override") is True
    assert check_user_permission(lead, "team:manage") is True

    # Developer has action create but not governance override
    assert check_user_permission(dev, "action:create") is True
    assert check_user_permission(dev, "governance:override") is False

    # Viewer has read permissions only
    assert check_user_permission(viewer, "repo:read") is True
    assert check_user_permission(viewer, "action:create") is False


def test_team_repository_access_control():
    admin = get_user("usr_admin")
    dev = get_user("usr_developer")
    viewer = get_user("usr_viewer")

    # Admin bypasses repo checks
    assert check_user_repository_access(admin, "https://github.com/secret/repo", "admin") is True

    # Dev is in team_core which has wildcard '*' admin access
    assert check_user_repository_access(dev, "https://github.com/psf/requests", "write") is True

    # Viewer is in team_guest which has read access to requests repo only
    assert check_user_repository_access(viewer, "https://github.com/psf/requests", "read") is True
    assert check_user_repository_access(viewer, "https://github.com/psf/requests", "write") is False


def test_assign_team_repository_access():
    team = create_team(name="Backend Squad", owner_id="usr_lead")
    assert team["team_id"].startswith("team_")

    updated = assign_team_repository_access(
        team_id=team["team_id"],
        repository_url="https://github.com/org/private-repo",
        access_level="write",
    )

    assert updated["repository_access"]["https://github.com/org/private-repo"] == "write"


def test_audit_event_and_decision_rbac_identity():
    evt = create_audit_event(
        repository_url="https://github.com/psf/requests",
        event_type="REPOSITORY_ANALYZED",
        target="requests",
        actor_id="usr_lead",
        team_id="team_core",
    )

    assert evt["actor_id"] == "usr_lead"
    assert evt["team_id"] == "team_core"

    dec = create_engineering_decision(
        repository_url="https://github.com/psf/requests",
        decision="APPROVE_RELEASE",
        reason="Governance checks passed",
        actor_id="usr_lead",
        team_id="team_core",
    )

    assert dec["actor_id"] == "usr_lead"
    assert dec["team_id"] == "team_core"


def test_auth_me_endpoint():
    response = client.get("/api/users/me", headers={"x-api-key": "key_admin_secret_123"})
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["status"] == "success"
    assert res_data["user"]["user_id"] == "usr_admin"
    assert "api_key" not in res_data["user"]
    assert res_data["user"]["has_api_key"] is True


def test_login_endpoint():
    response = client.post("/api/auth/login", json={"api_key": "key_lead_secret_456"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["user"]["user_id"] == "usr_lead"
    assert "api_key" not in data["user"]
    assert data["user"]["has_api_key"] is True


def test_users_and_teams_crud_endpoints():
    # List users
    res_users = client.get("/api/users", headers={"x-api-key": "key_admin_secret_123"})
    assert res_users.status_code == 200
    users_data = res_users.json()["users"]
    assert len(users_data) >= 4
    for u in users_data:
        assert "api_key" not in u
        assert u["has_api_key"] is True

    # Create user as ADMIN
    res_create = client.post(
        "/api/users",
        json={
            "username": "bob",
            "email": "bob@repomind.ai",
            "full_name": "Bob Security",
            "role": "LEAD",
        },
        headers={"x-api-key": "key_admin_secret_123"},
    )
    assert res_create.status_code == 200
    created_user = res_create.json()["user"]
    assert created_user["username"] == "bob"
    assert "api_key" not in created_user
    assert created_user["has_api_key"] is True

    # Create team
    res_team = client.post(
        "/api/teams",
        json={"name": "Security Ops", "description": "SecOps Team"},
        headers={"x-api-key": "key_admin_secret_123"},
    )
    assert res_team.status_code == 200
    assert res_team.json()["team"]["name"] == "Security Ops"


def test_check_permission_endpoint():
    res = client.post(
        "/api/auth/check-permission",
        json={
            "permission": "governance:override",
            "repository_url": "https://github.com/psf/requests",
            "required_access": "read",
        },
        headers={"x-api-key": "key_lead_secret_456"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["allowed"] is True
    assert data["permission_granted"] is True
    assert data["repository_access_granted"] is True


def test_users_me_never_exposes_api_key():
    keys = [
        "key_admin_secret_123",
        "key_lead_secret_456",
        "key_dev_secret_789",
        "key_viewer_secret_000",
    ]
    for k in keys:
        response = client.get("/api/users/me", headers={"x-api-key": k})
        assert response.status_code == 200
        user_dict = response.json().get("user", {})
        assert "api_key" not in user_dict
        assert user_dict.get("has_api_key") is True

