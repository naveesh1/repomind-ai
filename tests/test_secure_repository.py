import unittest
import os
import json
import urllib.error
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

from app.services.secure_repository import (
    mask_token,
    sanitize_credential_text,
    store_repository_token,
    get_repository_token,
    remove_repository_token,
    clear_repository_tokens,
    normalize_token,
    resolve_github_token,
    validate_repository_access,
    run_secure_git_command,
)
from app.services.ingestion import ingest_repository
from app.services.pull_request_intelligence import generate_pull_request_intelligence


class TestSecureRepositoryManagement(unittest.TestCase):
    def setUp(self):
        clear_repository_tokens()
        self.public_repo = "https://github.com/psf/requests"
        self.private_repo = "https://github.com/myorg/private-repo"
        self.test_token = "ghp_1234567890abcdef1234567890abcdef"

    def tearDown(self):
        clear_repository_tokens()

    # 1. Token masking utility
    def test_01_token_masking(self):
        self.assertEqual(mask_token(""), "")
        self.assertEqual(mask_token(None), "")
        self.assertEqual(mask_token("short"), "****")
        masked = mask_token(self.test_token)
        self.assertTrue(masked.startswith("ghp_"))
        self.assertTrue(masked.endswith("cdef"))
        self.assertNotIn("1234567890", masked)

    # 2. String & URL credential sanitization
    def test_02_credential_sanitization(self):
        raw_str = "Error cloning https://x-access-token:ghp_secrettoken1234567890123@github.com/myorg/repo.git"
        sanitized = sanitize_credential_text(raw_str)
        self.assertNotIn("ghp_secrettoken1234567890123", sanitized)
        self.assertIn("https://****@github.com", sanitized)

        pat_str = "Authenticated with token ghp_abcdef1234567890abcdef"
        sanitized_pat = sanitize_credential_text(pat_str)
        self.assertNotIn("ghp_abcdef1234567890abcdef", sanitized_pat)
        self.assertIn("ghp_****masked", sanitized_pat)

    # 3. Secure in-memory token vault registration
    def test_03_token_vault_storage_and_lookup(self):
        masked = store_repository_token("myorg", "private-repo", self.test_token)
        self.assertTrue(masked.startswith("ghp_"))

        retrieved = get_repository_token("myorg", "private-repo")
        self.assertEqual(retrieved, self.test_token)

        # Case insensitivity lookup
        retrieved_case = get_repository_token("MYORG", "PRIVATE-REPO")
        self.assertEqual(retrieved_case, self.test_token)

        removed = remove_repository_token("myorg", "private-repo")
        self.assertTrue(removed)
        self.assertIsNone(get_repository_token("myorg", "private-repo"))

    # 4. Token resolution hierarchy
    def test_04_token_resolution_order(self):
        # 1) Provided argument takes top priority
        token1 = resolve_github_token(self.private_repo, provided_token="ghp_explicit123456789")
        self.assertEqual(token1, "ghp_explicit123456789")

        # 2) Vault token takes second priority
        store_repository_token("myorg", "private-repo", "ghp_vault123456789")
        token2 = resolve_github_token(self.private_repo)
        self.assertEqual(token2, "ghp_vault123456789")

        # 3) Environment variable fallback
        clear_repository_tokens()
        with patch.dict(os.environ, {"GITHUB_TOKEN": "ghp_env123456789"}):
            token3 = resolve_github_token(self.private_repo)
            self.assertEqual(token3, "ghp_env123456789")

    # 5. Public repository access validation
    @patch("urllib.request.urlopen")
    def test_05_validate_public_repository_access(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps({
            "full_name": "psf/requests",
            "private": False,
            "visibility": "public",
            "default_branch": "main",
            "permissions": {"pull": True, "push": False, "admin": False},
        }).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        res = validate_repository_access(self.public_repo)
        self.assertEqual(res["status"], "valid")
        self.assertFalse(res["is_private"])
        self.assertEqual(res["visibility"], "public")
        self.assertEqual(res["owner"], "psf")
        self.assertEqual(res["repo_name"], "requests")
        self.assertFalse(res["requires_auth"])

    # 6. Private repository access validation with token
    @patch("urllib.request.urlopen")
    def test_06_validate_private_repository_access(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps({
            "full_name": "myorg/private-repo",
            "private": True,
            "visibility": "private",
            "default_branch": "main",
            "permissions": {"pull": True, "push": True, "admin": False},
        }).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        res = validate_repository_access(self.private_repo, github_token=self.test_token)
        self.assertEqual(res["status"], "valid")
        self.assertTrue(res["is_private"])
        self.assertEqual(res["visibility"], "private")
        self.assertTrue(res["has_token"])
        self.assertTrue(res["token_masked"].startswith("ghp_"))
        self.assertTrue(res["requires_auth"])

    # 7. Invalid token (HTTP 401) error handling
    @patch("urllib.request.urlopen")
    def test_07_invalid_token_401_error(self, mock_urlopen):
        mock_err = urllib.error.HTTPError(
            url="https://api.github.com/repos/myorg/private-repo",
            code=401,
            msg="Unauthorized",
            hdrs={},
            fp=None,
        )
        mock_urlopen.side_effect = mock_err

        with self.assertRaises(HTTPException) as ctx:
            validate_repository_access(self.private_repo, github_token="invalid_token")
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("Invalid GitHub authentication token", ctx.exception.detail)

    # 8. Private repository not found / forbidden (HTTP 404) error handling
    @patch("urllib.request.urlopen")
    def test_08_private_repository_404_error(self, mock_urlopen):
        mock_err = urllib.error.HTTPError(
            url="https://api.github.com/repos/myorg/private-repo",
            code=404,
            msg="Not Found",
            hdrs={},
            fp=None,
        )
        mock_urlopen.side_effect = mock_err

        with self.assertRaises(HTTPException) as ctx:
            validate_repository_access(self.private_repo, github_token=self.test_token)
        self.assertEqual(ctx.exception.status_code, 404)
        self.assertIn("private and inaccessible", ctx.exception.detail)

    # 9. Secure git command execution uses http.extraheader
    @patch("subprocess.run")
    def test_09_secure_git_command_execution(self, mock_run):
        mock_proc = MagicMock()
        mock_proc.returncode = 0
        mock_proc.stdout = "OK"
        mock_proc.stderr = ""
        mock_run.return_value = mock_proc

        res = run_secure_git_command(["clone", "https://github.com/myorg/private-repo"], github_token=self.test_token)
        self.assertEqual(res.returncode, 0)

        # Assert git was called with http.extraheader instead of embedding token in URL
        called_cmd = mock_run.call_args[0][0]
        self.assertIn("-c", called_cmd)
        self.assertIn(f"http.extraheader=Authorization: token {self.test_token}", called_cmd)

    # 10. End-to-end ingestion of private repository using token
    @patch("app.services.secure_repository.run_secure_git_command")
    def test_10_ingest_private_repository(self, mock_git):
        mock_rev = MagicMock()
        mock_rev.returncode = 0
        mock_rev.stdout = "sha123456789"
        mock_rev.stderr = ""

        mock_clone = MagicMock()
        mock_clone.returncode = 0
        mock_clone.stdout = ""
        mock_clone.stderr = ""

        mock_git.side_effect = lambda cmd, **kwargs: mock_rev if "rev-parse" in cmd else mock_clone

        res = ingest_repository(self.private_repo, github_token=self.test_token)
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["repository_url"], self.private_repo)

    # 11. PR intelligence analysis with private repo token
    @patch("app.services.pull_request_intelligence.fetch_github_pr_details")
    def test_11_pr_intelligence_private_repo(self, mock_fetch):
        mock_fetch.return_value = {
            "pr_number": 55,
            "title": "Private Feature PR",
            "base_sha": "base_sha",
            "head_sha": "head_sha",
            "files": [
                {"filename": "src/core.py", "status": "modified", "additions": 10, "deletions": 2, "patch": ""}
            ],
        }

        res = generate_pull_request_intelligence(self.private_repo, pr_id="55", github_token=self.test_token)
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["pr_id"], "#55")
        self.assertEqual(res["diff_summary"]["total_files_changed"], 1)

    # 12. Token normalization: null, None, undefined, and empty string handling
    def test_12_null_and_empty_token_normalization(self):
        self.assertIsNone(normalize_token(None))
        self.assertIsNone(normalize_token(""))
        self.assertIsNone(normalize_token("   "))
        self.assertIsNone(normalize_token("null"))
        self.assertIsNone(normalize_token("NULL"))
        self.assertIsNone(normalize_token("None"))
        self.assertIsNone(normalize_token("undefined"))
        self.assertEqual(normalize_token(" ghp_12345 "), "ghp_12345")

        with patch.dict(os.environ, {}, clear=True):
            resolved = resolve_github_token(self.public_repo, provided_token="null")
            self.assertIsNone(resolved)

    # 13. Unauthenticated rate limit (HTTP 403) handling
    @patch("urllib.request.urlopen")
    def test_13_unauthenticated_rate_limit_403(self, mock_urlopen):
        mock_err = urllib.error.HTTPError(
            url="https://api.github.com/repos/psf/requests",
            code=403,
            msg="Forbidden",
            hdrs={"x-ratelimit-remaining": "0"},
            fp=None,
        )
        mock_urlopen.side_effect = mock_err

        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(HTTPException) as ctx:
                validate_repository_access(self.public_repo)
            self.assertEqual(ctx.exception.status_code, 403)
            self.assertIn("rate limit exceeded for unauthenticated requests", ctx.exception.detail.lower())

    # 14. Authenticated rate limit (HTTP 403) handling
    @patch("urllib.request.urlopen")
    def test_14_authenticated_rate_limit_403(self, mock_urlopen):
        mock_err = urllib.error.HTTPError(
            url="https://api.github.com/repos/myorg/private-repo",
            code=403,
            msg="Forbidden",
            hdrs={"X-RateLimit-Remaining": "0"},
            fp=None,
        )
        mock_urlopen.side_effect = mock_err

        with self.assertRaises(HTTPException) as ctx:
            validate_repository_access(self.private_repo, github_token=self.test_token)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("rate limit exceeded for the provided token", ctx.exception.detail.lower())

    # 15. Insufficient permissions/scope (HTTP 403) handling
    @patch("urllib.request.urlopen")
    def test_15_insufficient_permissions_403(self, mock_urlopen):
        mock_err = urllib.error.HTTPError(
            url="https://api.github.com/repos/myorg/private-repo",
            code=403,
            msg="Forbidden",
            hdrs={"x-ratelimit-remaining": "100"},
            fp=None,
        )
        mock_urlopen.side_effect = mock_err

        with self.assertRaises(HTTPException) as ctx:
            validate_repository_access(self.private_repo, github_token=self.test_token)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("insufficient permissions or scope", ctx.exception.detail.lower())

    # 16. Private repository unauthenticated access (HTTP 404) handling
    @patch("urllib.request.urlopen")
    def test_16_private_repository_unauthenticated_404(self, mock_urlopen):
        mock_err = urllib.error.HTTPError(
            url="https://api.github.com/repos/myorg/private-repo",
            code=404,
            msg="Not Found",
            hdrs={},
            fp=None,
        )
        mock_urlopen.side_effect = mock_err

        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(HTTPException) as ctx:
                validate_repository_access(self.private_repo)
            self.assertEqual(ctx.exception.status_code, 404)
            self.assertIn("requiring authentication", ctx.exception.detail.lower())


if __name__ == "__main__":
    unittest.main()

