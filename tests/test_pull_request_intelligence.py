import unittest
import html
import json
from unittest.mock import patch
from app.services.pull_request_intelligence import (
    generate_pull_request_intelligence,
    export_pull_request_intelligence,
    parse_github_pr_info,
    fetch_github_pr_details,
)
from app.services.unified_engineering_intelligence import get_unified_engineering_intelligence
from app.services.engineering_audit_history import _AUDIT_EVENTS_STORE, _DECISIONS_STORE


class TestPullRequestIntelligence(unittest.TestCase):
    def setUp(self):
        """Reset global stores before each test."""
        _AUDIT_EVENTS_STORE.clear()
        _DECISIONS_STORE.clear()
        self.repo_url = "https://github.com/psf/requests"

    # 1. Valid PR analysis
    def test_01_valid_pr_analysis(self):
        res = generate_pull_request_intelligence(self.repo_url, base_revision="main", head_revision="HEAD", pr_id="PR-101")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["repository_url"], self.repo_url)
        self.assertEqual(res["pr_id"], "PR-101")
        self.assertIn("pr_decision", res)

    # 2. Invalid repository URL
    def test_02_invalid_repository_url(self):
        res = generate_pull_request_intelligence("https://github.com/nonexistent/invalid_repo_12345")
        self.assertEqual(res["status"], "success")
        self.assertIn("canonical_metrics", res)

    # 3. Missing revision parameters default gracefully
    def test_03_missing_revision_defaults(self):
        res = generate_pull_request_intelligence(self.repo_url, base_revision=None, head_revision=None)
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["base_revision"], "main")
        self.assertEqual(res["head_revision"], "HEAD")

    # 4. Identical base/head revisions
    def test_04_identical_base_head(self):
        res = generate_pull_request_intelligence(self.repo_url, base_revision="v1.0.0", head_revision="v1.0.0")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["pr_decision"], "READY")
        self.assertEqual(res["diff_summary"]["total_files_changed"], 0)

    # 5. Added files
    def test_05_added_files(self):
        res = generate_pull_request_intelligence(self.repo_url)
        self.assertIn("added_files", res)
        self.assertIsInstance(res["added_files"], list)

    # 6. Modified files
    def test_06_modified_files(self):
        res = generate_pull_request_intelligence(self.repo_url)
        self.assertIn("modified_files", res)
        self.assertIsInstance(res["modified_files"], list)

    # 7. Deleted files
    def test_07_deleted_files(self):
        res = generate_pull_request_intelligence(self.repo_url)
        self.assertIn("deleted_files", res)
        self.assertIsInstance(res["deleted_files"], list)

    # 8. AST changes
    def test_08_ast_changes(self):
        res = generate_pull_request_intelligence(self.repo_url)
        ast_ch = res.get("ast_changes", {})
        self.assertIn("functions_changed", ast_ch)
        self.assertIn("classes_changed", ast_ch)
        self.assertIn("dependency_changes", ast_ch)

    # 9. Dependency impact
    def test_09_dependency_impact(self):
        res = generate_pull_request_intelligence(self.repo_url)
        dep_imp = res.get("dependency_impact", {})
        self.assertIn("dependency_radius", dep_imp)
        self.assertIn("affected_modules", dep_imp)
        self.assertIn("dependency_paths", dep_imp)

    # 10. Test classification
    def test_10_test_classification(self):
        res = generate_pull_request_intelligence(self.repo_url)
        t_imp = res.get("test_impact", {})
        tests = t_imp.get("affected_tests", [])
        self.assertGreaterEqual(len(tests), 1)
        self.assertIn(tests[0]["test_type"], ["DIRECT", "INDIRECT", "POSSIBLE"])

    # 11. Test priority
    def test_11_test_priority(self):
        res = generate_pull_request_intelligence(self.repo_url)
        tests = res["test_impact"]["affected_tests"]
        priorities = [t["priority"] for t in tests]
        self.assertIn("P0", priorities)

    # 12. Regression risk
    def test_12_regression_risk(self):
        res = generate_pull_request_intelligence(self.repo_url)
        self.assertIn("regression_risk", res)
        self.assertGreaterEqual(res["regression_risk"], 0.0)
        self.assertLessEqual(res["regression_risk"], 100.0)

    # 13. Governance evaluation
    def test_13_governance_evaluation(self):
        res = generate_pull_request_intelligence(self.repo_url)
        gov_rel = res.get("governance_and_release", {})
        self.assertIn("governance_score", gov_rel)
        self.assertIn("policy_violations", gov_rel)

    # 14. Release gate evaluation
    def test_14_release_gate(self):
        res = generate_pull_request_intelligence(self.repo_url)
        gov_rel = res.get("governance_and_release", {})
        self.assertIn("release_status", gov_rel)
        self.assertIn("blockers", gov_rel)

    # 15. READY decision
    def test_15_ready_decision(self):
        res = generate_pull_request_intelligence(self.repo_url, base_revision="v1.0", head_revision="v1.0")
        self.assertEqual(res["pr_decision"], "READY")

    # 16. NEEDS_REVIEW decision
    def test_16_needs_review_decision(self):
        res = generate_pull_request_intelligence(self.repo_url, base_revision="v1.0", head_revision="v2.0")
        self.assertIn(res["pr_decision"], ["READY", "NEEDS_REVIEW", "BLOCKED"])

    # 17. BLOCKED decision
    def test_17_blocked_decision(self):
        res = generate_pull_request_intelligence(self.repo_url)
        self.assertIn(res["pr_decision"], ["READY", "NEEDS_REVIEW", "BLOCKED"])

    # 18. Deterministic output
    def test_18_deterministic_output(self):
        res1 = generate_pull_request_intelligence(self.repo_url, base_revision="main", head_revision="HEAD")
        res2 = generate_pull_request_intelligence(self.repo_url, base_revision="main", head_revision="HEAD")
        self.assertEqual(res1["regression_risk"], res2["regression_risk"])
        self.assertEqual(res1["pr_decision"], res2["pr_decision"])

    # 19. Repeated invocation consistency
    def test_19_repeated_invocation_consistency(self):
        res1 = generate_pull_request_intelligence(self.repo_url)
        res2 = generate_pull_request_intelligence(self.repo_url)
        self.assertEqual(res1["diff_summary"], res2["diff_summary"])

    # 20. Export JSON
    def test_20_export_json(self):
        res = export_pull_request_intelligence(self.repo_url, export_format="json")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["format"], "json")
        self.assertIn("data", res)

    # 21. Export Markdown
    def test_21_export_markdown(self):
        res = export_pull_request_intelligence(self.repo_url, export_format="markdown")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["format"], "markdown")
        self.assertIn("Pull Request Intelligence Review", res["content"])

    # 22. Export HTML
    def test_22_export_html(self):
        res = export_pull_request_intelligence(self.repo_url, export_format="html")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["format"], "html")
        self.assertIn("<!DOCTYPE html>", res["content"])

    # 23. HTML XSS escaping
    def test_23_html_xss_escaping(self):
        xss_repo = "https://github.com/owner/<script>alert('xss')</script>"
        res = export_pull_request_intelligence(xss_repo, export_format="html")
        content = res["content"]
        self.assertNotIn("<script>alert('xss')</script>", content)
        self.assertIn(html.escape("<script>alert('xss')</script>"), content)

    # 24. Step 40 risk consistency
    def test_24_step_40_risk_consistency(self):
        step40 = get_unified_engineering_intelligence(self.repo_url)
        pr_intel = generate_pull_request_intelligence(self.repo_url)
        self.assertEqual(step40["canonical_metrics"]["regression_risk"], pr_intel["regression_risk"])

    # 25. Integration with Investigation
    def test_25_integration_investigation(self):
        res = generate_pull_request_intelligence(self.repo_url)
        integrations = res.get("integrations", {})
        self.assertIn("investigation_id", integrations)
        self.assertIn("investigation_target", integrations)

    # 26. Integration with Action Center
    def test_26_integration_action_center(self):
        res = generate_pull_request_intelligence(self.repo_url)
        integrations = res.get("integrations", {})
        self.assertIn("actions_count", integrations)

    # 27. Integration with Audit History
    def test_27_integration_audit_history(self):
        generate_pull_request_intelligence(self.repo_url)
        self.assertGreaterEqual(len(_DECISIONS_STORE), 1)
        self.assertGreaterEqual(len(_AUDIT_EVENTS_STORE), 1)

    # 28. Step 42.1: Parse GitHub PR identifier and URL forms
    def test_28_parse_github_pr_info(self):
        info1 = parse_github_pr_info("https://github.com/psf/requests/pull/6700", None)
        self.assertEqual(info1["owner"], "psf")
        self.assertEqual(info1["repo"], "requests")
        self.assertEqual(info1["pr_number"], 6700)
        self.assertEqual(info1["canonical_repo_url"], "https://github.com/psf/requests")

        info2 = parse_github_pr_info("https://github.com/psf/requests", "PR-6700")
        self.assertEqual(info2["owner"], "psf")
        self.assertEqual(info2["repo"], "requests")
        self.assertEqual(info2["pr_number"], 6700)

        info3 = parse_github_pr_info("https://github.com/psf/requests", "#6700")
        self.assertEqual(info3["pr_number"], 6700)

        info4 = parse_github_pr_info("https://github.com/psf/requests", "https://github.com/psf/requests/pull/6700")
        self.assertEqual(info4["pr_number"], 6700)

    # 29. Step 42.1: Real/Mocked GitHub PR diff retrieval with changes
    @patch("app.services.pull_request_intelligence.fetch_github_pr_details")
    def test_29_real_github_pr_diff_retrieval(self, mock_fetch):
        mock_fetch.return_value = {
            "pr_number": 42,
            "title": "Feature: Add OAuth2 Authentication Handler",
            "base_sha": "base12345",
            "head_sha": "head67890",
            "files": [
                {
                    "filename": "requests/auth.py",
                    "status": "modified",
                    "additions": 45,
                    "deletions": 10,
                    "patch": "@@ -10,3 +10,12 @@\n+def authenticate_oauth2(token):\n+    return {'status': 'ok'}\n",
                },
                {
                    "filename": "requests/models.py",
                    "status": "added",
                    "additions": 120,
                    "deletions": 0,
                    "patch": "@@ -0,0 +1,15 @@\n+class OAuthTokenModel:\n+    pass\n",
                },
            ],
        }

        res = generate_pull_request_intelligence(self.repo_url, pr_id="42")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["pr_id"], "#42")
        self.assertEqual(res["base_revision"], "base12345")
        self.assertEqual(res["head_revision"], "head67890")
        self.assertEqual(res["pr_title"], "Feature: Add OAuth2 Authentication Handler")

        summary = res["diff_summary"]
        self.assertEqual(summary["total_files_changed"], 2)
        self.assertEqual(summary["lines_added"], 165)
        self.assertEqual(summary["lines_removed"], 10)

        changed_files = res["changed_files"]
        self.assertEqual(len(changed_files), 2)
        filenames = [f["file"] for f in changed_files]
        self.assertIn("requests/auth.py", filenames)
        self.assertIn("requests/models.py", filenames)

    # 30. Step 42.1: Zero change PR correctly reports zero changes
    @patch("app.services.pull_request_intelligence.fetch_github_pr_details")
    def test_30_zero_change_pr_reporting(self, mock_fetch):
        mock_fetch.return_value = {
            "pr_number": 99,
            "title": "Empty PR",
            "base_sha": "sha_same",
            "head_sha": "sha_same",
            "files": [],
        }

        res = generate_pull_request_intelligence(self.repo_url, pr_id="99")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["diff_summary"]["total_files_changed"], 0)
        self.assertEqual(res["diff_summary"]["lines_added"], 0)
        self.assertEqual(res["diff_summary"]["lines_removed"], 0)
        self.assertEqual(res["changed_files"], [])
        self.assertEqual(res["pr_decision"], "READY")
        self.assertIn("no code changes detected", res["decision_reason"].lower())

    # 31. Step 42.1: Different PR diffs produce different analysis results
    @patch("app.services.pull_request_intelligence.fetch_github_pr_details")
    def test_31_different_pr_diffs_produce_different_analysis_results(self, mock_fetch):
        # PR Diff A: Minor tweak in requests/api.py
        mock_fetch.return_value = {
            "pr_number": 1001,
            "title": "Minor Refactor",
            "base_sha": "shaA_base",
            "head_sha": "shaA_head",
            "files": [
                {
                    "filename": "requests/api.py",
                    "status": "modified",
                    "additions": 5,
                    "deletions": 1,
                    "patch": "@@ -1,2 +1,3 @@\n+def get_session():\n+    pass\n",
                }
            ],
        }
        resA = generate_pull_request_intelligence(self.repo_url, pr_id="1001")

        # PR Diff B: Major changes in requests/sessions.py and deletion of requests/hooks.py
        mock_fetch.return_value = {
            "pr_number": 1002,
            "title": "Major Architectural Refactor",
            "base_sha": "shaB_base",
            "head_sha": "shaB_head",
            "files": [
                {
                    "filename": "requests/sessions.py",
                    "status": "modified",
                    "additions": 350,
                    "deletions": 120,
                    "patch": "@@ -50,5 +50,40 @@\n+class SessionManager:\n+    def rebuild_auth(self):\n+        pass\n",
                },
                {
                    "filename": "requests/hooks.py",
                    "status": "removed",
                    "additions": 0,
                    "deletions": 95,
                    "patch": "@@ -1,10 +0,0 @@\n-def dispatch_hook():\n-    pass\n",
                },
            ],
        }
        resB = generate_pull_request_intelligence(self.repo_url, pr_id="1002")

        # Assert total files changed differ
        self.assertNotEqual(resA["diff_summary"]["total_files_changed"], resB["diff_summary"]["total_files_changed"])
        self.assertEqual(resA["diff_summary"]["total_files_changed"], 1)
        self.assertEqual(resB["diff_summary"]["total_files_changed"], 2)

        # Assert lines added/removed differ
        self.assertNotEqual(resA["diff_summary"]["lines_added"], resB["diff_summary"]["lines_added"])
        self.assertNotEqual(resA["diff_summary"]["lines_removed"], resB["diff_summary"]["lines_removed"])

        # Assert changed file names differ
        filesA = [f["file"] for f in resA["changed_files"]]
        filesB = [f["file"] for f in resB["changed_files"]]
        self.assertNotEqual(filesA, filesB)
        self.assertIn("requests/api.py", filesA)
        self.assertIn("requests/sessions.py", filesB)

        # Assert investigation target reflects primary changed file
        self.assertEqual(resA["integrations"]["investigation_target"], "requests/api.py")
        self.assertEqual(resB["integrations"]["investigation_target"], "requests/sessions.py")

        # Assert AST changes differ
        self.assertNotEqual(resA["ast_changes"], resB["ast_changes"])

    # 32. Step 42.1: PR URL passed as repository_url
    @patch("app.services.pull_request_intelligence.fetch_github_pr_details")
    def test_32_github_pr_url_as_repository_url(self, mock_fetch):
        mock_fetch.return_value = {
            "pr_number": 6700,
            "title": "PR from URL",
            "base_sha": "base_url_sha",
            "head_sha": "head_url_sha",
            "files": [
                {"filename": "src/core.py", "status": "modified", "additions": 10, "deletions": 2, "patch": ""}
            ],
        }
        res = generate_pull_request_intelligence("https://github.com/psf/requests/pull/6700")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["repository_url"], "https://github.com/psf/requests")
        self.assertEqual(res["pr_id"], "#6700")
        self.assertEqual(res["diff_summary"]["total_files_changed"], 1)


if __name__ == "__main__":
    unittest.main()

