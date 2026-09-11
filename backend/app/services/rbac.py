import os
import json
import datetime
import secrets
from typing import Dict, Any, List, Optional, Set
from fastapi import HTTPException, Request, Header, Depends

# Roles Enum
class Role:
    ADMIN = "ADMIN"
    LEAD = "LEAD"
    DEVELOPER = "DEVELOPER"
    VIEWER = "VIEWER"

# Supported granular permissions
ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    Role.ADMIN: {"*"},
    Role.LEAD: {
        "repo:read", "repo:write", "repo:admin",
        "pr:analyze", "pr:export",
        "investigation:read", "investigation:create",
        "action:read", "action:create", "action:update",
        "governance:read", "governance:override",
        "audit:read", "audit:export",
        "team:read", "team:manage",
        "user:read",
    },
    Role.DEVELOPER: {
        "repo:read", "repo:write",
        "pr:analyze", "pr:export",
        "investigation:read",
        "action:read", "action:create",
        "governance:read",
        "audit:read",
        "team:read",
    },
    Role.VIEWER: {
        "repo:read",
        "pr:analyze", "pr:export",
        "investigation:read",
        "action:read",
        "governance:read",
        "audit:read",
    },
}

# Global In-Memory Stores
_USERS_STORE: Dict[str, Dict[str, Any]] = {}
_TEAMS_STORE: Dict[str, Dict[str, Any]] = {}
_API_KEY_MAP: Dict[str, str] = {}  # api_key -> user_id


def seed_default_users_and_teams():
    """Seeds system with default users and teams for standalone/testing use."""
    _USERS_STORE.clear()
    _TEAMS_STORE.clear()
    _API_KEY_MAP.clear()

    default_users = [
        {
            "user_id": "usr_admin",
            "username": "admin",
            "email": "admin@repomind.ai",
            "full_name": "System Administrator",
            "role": Role.ADMIN,
            "team_ids": ["team_core"],
            "api_key": "key_admin_secret_123",
            "status": "ACTIVE",
            "created_at": "2026-01-01T00:00:00Z",
        },
        {
            "user_id": "usr_lead",
            "username": "lead",
            "email": "lead@repomind.ai",
            "full_name": "Engineering Tech Lead",
            "role": Role.LEAD,
            "team_ids": ["team_core"],
            "api_key": "key_lead_secret_456",
            "status": "ACTIVE",
            "created_at": "2026-01-01T00:00:00Z",
        },
        {
            "user_id": "usr_developer",
            "username": "developer",
            "email": "developer@repomind.ai",
            "full_name": "Software Engineer",
            "role": Role.DEVELOPER,
            "team_ids": ["team_core"],
            "api_key": "key_dev_secret_789",
            "status": "ACTIVE",
            "created_at": "2026-01-01T00:00:00Z",
        },
        {
            "user_id": "usr_viewer",
            "username": "viewer",
            "email": "viewer@repomind.ai",
            "full_name": "Read-Only Stakeholder",
            "role": Role.VIEWER,
            "team_ids": ["team_guest"],
            "api_key": "key_viewer_secret_000",
            "status": "ACTIVE",
            "created_at": "2026-01-01T00:00:00Z",
        },
    ]

    for u in default_users:
        _USERS_STORE[u["user_id"]] = u
        _API_KEY_MAP[u["api_key"]] = u["user_id"]

    default_teams = [
        {
            "team_id": "team_core",
            "name": "Core Engineering Team",
            "description": "Primary development team with write access to all core repositories.",
            "owner_id": "usr_admin",
            "member_ids": ["usr_admin", "usr_lead", "usr_developer"],
            "repository_access": {
                "*": "admin",
                "https://github.com/psf/requests": "admin",
            },
            "created_at": "2026-01-01T00:00:00Z",
        },
        {
            "team_id": "team_guest",
            "name": "Guest Stakeholders",
            "description": "Read-only access for external audit.",
            "owner_id": "usr_admin",
            "member_ids": ["usr_viewer"],
            "repository_access": {
                "https://github.com/psf/requests": "read",
            },
            "created_at": "2026-01-01T00:00:00Z",
        },
    ]

    for t in default_teams:
        _TEAMS_STORE[t["team_id"]] = t


# Initialize seed data
seed_default_users_and_teams()


def create_user(
    username: str,
    email: str,
    full_name: str,
    role: str = Role.DEVELOPER,
    team_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Creates a new user record with a generated API key."""
    if not username or not email:
        raise HTTPException(status_code=400, detail="username and email parameters are required.")

    if role not in [Role.ADMIN, Role.LEAD, Role.DEVELOPER, Role.VIEWER]:
        raise HTTPException(status_code=400, detail=f"Invalid role '{role}'. Must be ADMIN, LEAD, DEVELOPER, or VIEWER.")

    user_id = f"usr_{secrets.token_hex(6)}"
    api_key = f"key_{secrets.token_hex(16)}"
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    user_data = {
        "user_id": user_id,
        "username": username.strip().lower(),
        "email": email.strip().lower(),
        "full_name": full_name.strip(),
        "role": role,
        "team_ids": team_ids or [],
        "api_key": api_key,
        "status": "ACTIVE",
        "created_at": now_iso,
    }

    _USERS_STORE[user_id] = user_data
    _API_KEY_MAP[api_key] = user_id

    # Add user to teams
    if team_ids:
        for tid in team_ids:
            if tid in _TEAMS_STORE:
                if user_id not in _TEAMS_STORE[tid]["member_ids"]:
                    _TEAMS_STORE[tid]["member_ids"].append(user_id)

    return user_data


def sanitize_user(user: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Returns a copy of the user record stripped of sensitive API keys,
    replacing it with a safe metadata boolean `has_api_key`.
    """
    if not user or not isinstance(user, dict):
        return None
    user_copy = dict(user)
    raw_key = user_copy.pop("api_key", None)
    if "has_api_key" not in user_copy:
        user_copy["has_api_key"] = bool(raw_key)
    elif bool(raw_key):
        user_copy["has_api_key"] = True
    return user_copy


def get_user(user_id: str) -> Optional[Dict[str, Any]]:
    return sanitize_user(_USERS_STORE.get(user_id))


def get_user_by_api_key(api_key: str) -> Optional[Dict[str, Any]]:
    if not api_key:
        return None
    clean_key = api_key.replace("Bearer ", "").strip()
    user_id = _API_KEY_MAP.get(clean_key)
    if user_id:
        return sanitize_user(_USERS_STORE.get(user_id))
    return None


def list_users() -> List[Dict[str, Any]]:
    return [sanitize_user(u) for u in _USERS_STORE.values()]


def create_team(
    name: str,
    description: str = "",
    owner_id: str = "usr_admin",
    member_ids: Optional[List[str]] = None,
    repository_access: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Creates a new engineering team with repository entitlements."""
    if not name or not name.strip():
        raise HTTPException(status_code=400, detail="Team name is required.")

    team_id = f"team_{secrets.token_hex(6)}"
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    team_data = {
        "team_id": team_id,
        "name": name.strip(),
        "description": description.strip(),
        "owner_id": owner_id,
        "member_ids": member_ids or [owner_id],
        "repository_access": repository_access or {},
        "created_at": now_iso,
    }

    _TEAMS_STORE[team_id] = team_data

    # Update team_ids for members
    for uid in team_data["member_ids"]:
        if uid in _USERS_STORE:
            if team_id not in _USERS_STORE[uid]["team_ids"]:
                _USERS_STORE[uid]["team_ids"].append(team_id)

    return team_data


def get_team(team_id: str) -> Optional[Dict[str, Any]]:
    return _TEAMS_STORE.get(team_id)


def list_teams() -> List[Dict[str, Any]]:
    return list(_TEAMS_STORE.values())


def assign_team_repository_access(team_id: str, repository_url: str, access_level: str) -> Dict[str, Any]:
    """Assigns repository entitlement level ('read', 'write', 'admin') to a team."""
    team = get_team(team_id)
    if not team:
        raise HTTPException(status_code=404, detail=f"Team '{team_id}' not found.")

    level = access_level.lower().strip()
    if level not in ["read", "write", "admin"]:
        raise HTTPException(status_code=400, detail="access_level must be 'read', 'write', or 'admin'.")

    team["repository_access"][repository_url.strip()] = level
    return team


def check_user_permission(user: Dict[str, Any], permission: str) -> bool:
    """
    Checks if user's Role grants the requested granular permission.
    ADMIN role has wildcard ('*') permission.
    """
    if not user or user.get("status") != "ACTIVE":
        return False

    role = user.get("role", Role.VIEWER)
    perms = ROLE_PERMISSIONS.get(role, set())

    if "*" in perms or permission in perms:
        return True

    return False


def check_user_repository_access(
    user: Dict[str, Any], repository_url: str, required_access: str = "read"
) -> bool:
    """
    Validates if user (or user's teams) has sufficient access level for target repository.
    Levels: admin > write > read.
    ADMIN role bypasses repository restrictions.
    """
    if not user or user.get("status") != "ACTIVE":
        return False

    # ADMIN role has global repository access
    if user.get("role") == Role.ADMIN:
        return True

    access_hierarchy = {"read": 1, "write": 2, "admin": 3}
    required_rank = access_hierarchy.get(required_access.lower(), 1)

    clean_url = (repository_url or "").strip()

    # Check across all user's teams
    user_team_ids = user.get("team_ids", [])
    max_user_rank = 0
    has_explicit_restrictions = False

    for tid in user_team_ids:
        team = get_team(tid)
        if not team:
            continue
        repo_access = team.get("repository_access", {})
        if repo_access:
            has_explicit_restrictions = True

        # Check exact repo match or wildcard repo match
        access_str = repo_access.get(clean_url) or repo_access.get("*")
        if access_str:
            rank = access_hierarchy.get(access_str.lower(), 0)
            if rank > max_user_rank:
                max_user_rank = rank

    # If no team restriction exists for unlisted public repo, grant read access by default
    if max_user_rank == 0 and not has_explicit_restrictions and required_access == "read":
        return True

    return max_user_rank >= required_rank


def get_current_user_from_headers(
    x_api_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """
    FastAPI dependency that resolves current user from headers.
    Defaults to 'developer' system account if unauthenticated for standalone compatibility.
    """
    api_key = x_api_key or authorization
    if api_key:
        user = get_user_by_api_key(api_key)
        if user:
            return user
        raise HTTPException(status_code=401, detail="Invalid API Key or authorization token provided.")

    # Default identity for unauthenticated requests
    return sanitize_user(_USERS_STORE.get("usr_developer", {
        "user_id": "usr_developer",
        "username": "developer",
        "email": "developer@repomind.ai",
        "full_name": "Software Engineer",
        "role": Role.DEVELOPER,
        "team_ids": ["team_core"],
        "status": "ACTIVE",
    }))
