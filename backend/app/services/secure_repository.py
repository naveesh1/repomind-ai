import os
import re
import json
import subprocess
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional, Tuple
from fastapi import HTTPException

# In-memory secure repository token vault keyed by "owner/repo" in lowercase
_REPO_TOKENS_VAULT: Dict[str, str] = {}


def mask_token(token: Optional[str]) -> str:
    """
    Masks a secret token string (e.g. ghp_1234567890abcdef -> ghp_****cdef).
    """
    if not token or not isinstance(token, str):
        return ""
    clean = token.strip()
    if len(clean) <= 8:
        return "****"
    prefix = clean[:4]
    suffix = clean[-4:]
    return f"{prefix}****{suffix}"


def sanitize_credential_text(text: str) -> str:
    """
    Scrubs token strings or credentials embedded in text/URLs/errors.
    Matches forms like https://x-access-token:SECRET@github.com, ghp_..., or Bearer token.
    """
    if not text or not isinstance(text, str):
        return ""
    # Mask embedded user info in URLs (e.g. https://token@github.com)
    sanitized = re.sub(r"https?://([^:@\s]+)(?::([^@\s]+))?@github\.com", "https://****@github.com", text)
    # Mask GitHub Personal Access Tokens (ghp_, gho_, ghu_, ghr_, ghs_, github_pat_)
    sanitized = re.sub(r"(?:ghp|gho|ghu|ghr|ghs|github_pat)_[a-zA-Z0-9_]{16,255}", "ghp_****masked", sanitized)
    return sanitized


def store_repository_token(owner: str, repo: str, token: str) -> str:
    """
    Stores an in-memory authentication token for a given owner/repo.
    """
    if not owner or not repo or not token:
        raise HTTPException(status_code=400, detail="owner, repo, and token parameters are required.")
    key = f"{owner.strip().lower()}/{repo.strip().lower()}"
    _REPO_TOKENS_VAULT[key] = token.strip()
    return mask_token(token)


def get_repository_token(owner: str, repo: str) -> Optional[str]:
    """
    Retrieves stored in-memory token for a repository owner/repo.
    """
    if not owner or not repo:
        return None
    key = f"{owner.strip().lower()}/{repo.strip().lower()}"
    return _REPO_TOKENS_VAULT.get(key)


def remove_repository_token(owner: str, repo: str) -> bool:
    """
    Removes a stored token for a repository owner/repo.
    """
    if not owner or not repo:
        return False
    key = f"{owner.strip().lower()}/{repo.strip().lower()}"
    return _REPO_TOKENS_VAULT.pop(key, None) is not None


def clear_repository_tokens():
    """
    Clears all stored repository tokens in vault.
    """
    _REPO_TOKENS_VAULT.clear()


def normalize_token(token: Optional[str]) -> Optional[str]:
    """
    Normalizes a token value, treating missing, empty, or string "null"/"none"/"undefined" as None.
    """
    if not token or not isinstance(token, str):
        return None
    clean = token.strip()
    if not clean or clean.lower() in ("null", "none", "undefined"):
        return None
    return clean


def resolve_github_token(repo_url: Optional[str] = None, provided_token: Optional[str] = None) -> Optional[str]:
    """
    Resolves GitHub token in strict priority order:
    1. Explicitly provided token argument (if valid and not null/empty)
    2. Token stored in vault for owner/repo
    3. Environment variables GITHUB_TOKEN or GH_TOKEN
    """
    norm_provided = normalize_token(provided_token)
    if norm_provided:
        return norm_provided

    if repo_url and isinstance(repo_url, str):
        from app.services.ingestion import parse_github_url
        try:
            _, repo_name = parse_github_url(repo_url)
            parts = repo_url.strip().rstrip("/").split("/")
            if len(parts) >= 2:
                owner = parts[-2]
                repo = parts[-1].replace(".git", "")
                vault_token = normalize_token(get_repository_token(owner, repo))
                if vault_token:
                    return vault_token
        except Exception:
            pass

    env_token = normalize_token(os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN"))
    if env_token:
        return env_token

    return None


def validate_repository_access(repo_url: str, github_token: Optional[str] = None) -> Dict[str, Any]:
    """
    Validates GitHub repository access, visibility (public/private), and token permissions via GitHub REST API.
    Raises HTTP 400, 401, 403, or 404 with sanitized error details if access fails.
    """
    from app.services.ingestion import parse_github_url
    normalized_url, repo_name = parse_github_url(repo_url)

    parts = normalized_url.split("/")
    owner = parts[-2] if len(parts) >= 2 else "unknown"

    token = resolve_github_token(normalized_url, github_token)

    headers = {
        "User-Agent": "RepoMind-AI/1.0",
        "Accept": "application/vnd.github.v3+json",
    }
    if token:
        headers["Authorization"] = f"token {token}"

    api_url = f"https://api.github.com/repos/{owner}/{repo_name}"
    req = urllib.request.Request(api_url, headers=headers)

    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        headers_dict = dict(exc.headers) if hasattr(exc, "headers") and exc.headers else {}
        ratelimit_remaining = headers_dict.get("x-ratelimit-remaining") or headers_dict.get("X-RateLimit-Remaining")

        err_body = ""
        try:
            if hasattr(exc, "fp") and exc.fp:
                err_body = exc.fp.read().decode("utf-8", errors="ignore")
        except Exception:
            pass

        is_rate_limited = (
            ratelimit_remaining == "0"
            or "rate limit" in err_body.lower()
            or "api rate limit exceeded" in err_body.lower()
        )

        if exc.code == 401:
            raise HTTPException(status_code=401, detail="Invalid GitHub authentication token provided.")
        elif exc.code == 403:
            if is_rate_limited:
                if token:
                    raise HTTPException(
                        status_code=403,
                        detail="GitHub API rate limit exceeded for the provided token.",
                    )
                else:
                    raise HTTPException(
                        status_code=403,
                        detail="GitHub API rate limit exceeded for unauthenticated requests. Optional GitHub token can be configured to increase rate limits.",
                    )
            else:
                raise HTTPException(
                    status_code=403,
                    detail="Access forbidden. GitHub token has insufficient permissions or scope.",
                )
        elif exc.code == 404:
            if token:
                raise HTTPException(
                    status_code=404,
                    detail=f"Repository '{owner}/{repo_name}' not found or is private and inaccessible with the provided token.",
                )
            else:
                raise HTTPException(
                    status_code=404,
                    detail=f"Repository '{owner}/{repo_name}' not found or is a private repository requiring authentication.",
                )
        else:
            raise HTTPException(status_code=exc.code, detail=sanitize_credential_text(f"GitHub API error HTTP {exc.code}"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=sanitize_credential_text(f"Could not connect to GitHub API: {str(e)}"))

    is_private = data.get("private", False)
    visibility = data.get("visibility", "private" if is_private else "public")
    perms = data.get("permissions", {"pull": True, "push": False, "admin": False})

    return {
        "status": "valid",
        "repository_url": normalized_url,
        "owner": owner,
        "repo_name": repo_name,
        "full_name": data.get("full_name", f"{owner}/{repo_name}"),
        "is_private": is_private,
        "visibility": visibility,
        "default_branch": data.get("default_branch", "main"),
        "permissions": perms,
        "token_masked": mask_token(token),
        "has_token": bool(token),
        "requires_auth": is_private,
    }


def run_secure_git_command(
    cmd: List[str],
    cwd: Optional[str] = None,
    github_token: Optional[str] = None,
    repo_url: Optional[str] = None,
    timeout: int = 90,
) -> subprocess.CompletedProcess:
    """
    Executes git subprocesses securely using http.extraheader to prevent token leakage in process lists or URLs.
    Scrubs stdout and stderr output.
    """
    token = resolve_github_token(repo_url, github_token)

    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"
    env["GIT_ASKPASS"] = ""
    env["GCM_INTERACTIVE"] = "never"

    full_cmd = ["git"]
    if token:
        full_cmd.extend(["-c", f"http.extraheader=Authorization: token {token}"])
    else:
        full_cmd.extend(["-c", "credential.helper="])

    full_cmd.extend(cmd)

    try:
        res = subprocess.run(
            full_cmd,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=timeout,
            env=env,
        )
        res.stdout = sanitize_credential_text(res.stdout or "")
        res.stderr = sanitize_credential_text(res.stderr or "")
        return res
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=408,
            detail="Git operation timed out. Repository might be too large or network unresponsive.",
        )
