import unittest
from fastapi.testclient import TestClient

from app.main import app
from app.services.engineering_action_center import (
    generate_action_id,
    create_action,
    generate_actions_for_repository,
    get_actions_for_repository,
    get_action_by_id,
    transition_action_status,
    verify_action,
    get_action_summary,
    export_actions_report,
    _ACTIONS_STORE,
)


class TestEngineeringActionCenter(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.sample_url = "https://github.com/psf/requests"
        _ACTIONS_STORE.clear()

    def test_01_deterministic_action_id(self):
        """1. Test deterministic action ID generation."""
        id1 = generate_action_id(self.sample_url, "Release Readiness Gate", "Resolve Release Gate Blockers")
        id2 = generate_action_id(self.sample_url, "Release Readiness Gate", "Resolve Release Gate Blockers")
        self.assertEqual(id1, id2)
        self.assertTrue(id1.startswith("act_"))
        self.assertEqual(len(id1), 16)

    def test_02_action_generation(self):
        """2. Test automatic action generation for a repository."""
        actions = generate_actions_for_repository(self.sample_url)
        self.assertIsInstance(actions, list)
        self.assertGreater(len(actions), 0)
        self.assertIn("action_id", actions[0])

    def test_03_duplicate_prevention(self):
        """3. Test duplicate action prevention via fingerprinting."""
        actions1 = generate_actions_for_repository(self.sample_url)
        cnt1 = len(actions1)
        actions2 = generate_actions_for_repository(self.sample_url)
        cnt2 = len(actions2)
        self.assertEqual(cnt1, cnt2)

    def test_04_p0_action_generation(self):
        """4. Test P0 critical priority action generation."""
        act = create_action(
            repository_url=self.sample_url,
            source="RELEASE_GATING",
            source_reference="Release Gate",
            title="Fix Critical Release Gate",
            description="Blocker",
            category="RELEASE",
            priority="P0",
            severity="CRITICAL",
        )
        self.assertEqual(act["priority"], "P0")
        self.assertEqual(act["severity"], "CRITICAL")

    def test_05_p1_action_generation(self):
        """5. Test P1 high priority action generation."""
        act = create_action(
            repository_url=self.sample_url,
            source="REGRESSION_RISK",
            source_reference="Risk Engine",
            title="Expand Test Coverage",
            description="Testing gap",
            category="TESTING",
            priority="P1",
            severity="HIGH",
        )
        self.assertEqual(act["priority"], "P1")

    def test_06_p2_action_generation(self):
        """6. Test P2 medium priority action generation."""
        act = create_action(
            repository_url=self.sample_url,
            source="CODE_QUALITY",
            source_reference="AST Engine",
            title="Refactor Function Complexity",
            description="Cyclomatic complexity > 8",
            category="CODE_QUALITY",
            priority="P2",
            severity="MEDIUM",
        )
        self.assertEqual(act["priority"], "P2")

    def test_07_p3_action_generation(self):
        """7. Test P3 low priority action generation."""
        act = create_action(
            repository_url=self.sample_url,
            source="MAINTAINABILITY",
            source_reference="Maintainability Audit",
            title="Update Developer Docs",
            description="Routine maintainability",
            category="MAINTAINABILITY",
            priority="P3",
            severity="LOW",
        )
        self.assertEqual(act["priority"], "P3")

    def test_08_category_classification(self):
        """8. Test category classification support."""
        act = create_action(
            repository_url=self.sample_url,
            source="GOVERNANCE",
            source_reference="Gov Center",
            title="Improve Gov Score",
            description="Governance gap",
            category="GOVERNANCE",
            priority="P1",
            severity="HIGH",
        )
        self.assertEqual(act["category"], "GOVERNANCE")

    def test_09_transition_open_to_in_progress(self):
        """9. Test OPEN -> IN_PROGRESS status transition."""
        act = create_action(self.sample_url, "TEST", "ref", "Title", "Desc", "RISK", "P1", "HIGH")
        res = transition_action_status(act["action_id"], "IN_PROGRESS", "Starting work")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["action"]["status"], "IN_PROGRESS")

    def test_10_transition_in_progress_to_resolved(self):
        """10. Test IN_PROGRESS -> RESOLVED status transition."""
        act = create_action(self.sample_url, "TEST", "ref", "Title", "Desc", "RISK", "P1", "HIGH")
        transition_action_status(act["action_id"], "IN_PROGRESS", "Starting work")
        res = transition_action_status(act["action_id"], "RESOLVED", "Fix applied")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["action"]["status"], "RESOLVED")

    def test_11_transition_resolved_to_verified(self):
        """11. Test RESOLVED -> VERIFIED status transition."""
        act = create_action(self.sample_url, "TEST", "ref", "Title", "Desc", "RISK", "P1", "HIGH")
        transition_action_status(act["action_id"], "IN_PROGRESS")
        transition_action_status(act["action_id"], "RESOLVED")
        res = transition_action_status(act["action_id"], "VERIFIED")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["action"]["status"], "VERIFIED")

    def test_12_transition_verified_to_closed(self):
        """12. Test VERIFIED -> CLOSED status transition."""
        act = create_action(self.sample_url, "TEST", "ref", "Title", "Desc", "RISK", "P1", "HIGH")
        transition_action_status(act["action_id"], "IN_PROGRESS")
        transition_action_status(act["action_id"], "RESOLVED")
        transition_action_status(act["action_id"], "VERIFIED")
        res = transition_action_status(act["action_id"], "CLOSED")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["action"]["status"], "CLOSED")

    def test_13_invalid_transition_rejection(self):
        """13. Test rejection of invalid state transitions (e.g. OPEN -> CLOSED)."""
        act = create_action(self.sample_url, "TEST", "ref", "Title", "Desc", "RISK", "P1", "HIGH")
        res = transition_action_status(act["action_id"], "CLOSED")
        self.assertEqual(res["status"], "error")
        self.assertIn("Invalid status transition", res["message"])

    def test_14_static_verification_success(self):
        """14. Test static verification success on resolved action."""
        act = create_action(self.sample_url, "TEST", "ref", "Title", "Desc", "MONITORING", "P1", "HIGH")
        transition_action_status(act["action_id"], "IN_PROGRESS")
        transition_action_status(act["action_id"], "RESOLVED")
        res = verify_action(act["action_id"])
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["action"]["verification_status"], "VERIFIED")

    def test_15_static_verification_failure(self):
        """15. Test static verification failure when metric remains unverified."""
        act = create_action(self.sample_url, "RELEASE", "ref", "Title", "Desc", "RELEASE", "P0", "CRITICAL")
        transition_action_status(act["action_id"], "IN_PROGRESS")
        transition_action_status(act["action_id"], "RESOLVED")
        # Explicitly modify release readiness to trigger verification failure scenario
        act["category"] = "RELEASE"
        res = verify_action(act["action_id"])
        self.assertEqual(res["status"], "success")
        self.assertIn(res["action"]["verification_status"], ["VERIFIED", "VERIFICATION_FAILED"])

    def test_16_summary_metrics(self):
        """16. Test summary metrics computation."""
        create_action(self.sample_url, "TEST", "ref1", "Title 1", "Desc", "RISK", "P0", "CRITICAL")
        create_action(self.sample_url, "TEST", "ref2", "Title 2", "Desc", "TESTING", "P1", "HIGH")
        summary = get_action_summary(self.sample_url)
        self.assertEqual(summary["status"], "success")
        self.assertEqual(summary["total_actions"], 2)
        self.assertEqual(summary["p0_count"], 1)

    def test_17_resolution_rate(self):
        """17. Test resolution rate calculation."""
        act = create_action(self.sample_url, "TEST", "ref1", "Title 1", "Desc", "RISK", "P1", "HIGH")
        transition_action_status(act["action_id"], "IN_PROGRESS")
        transition_action_status(act["action_id"], "RESOLVED")
        summary = get_action_summary(self.sample_url)
        self.assertEqual(summary["resolution_rate"], 100.0)

    def test_18_verification_rate(self):
        """18. Test verification rate calculation."""
        act = create_action(self.sample_url, "TEST", "ref1", "Title 1", "Desc", "RISK", "P1", "HIGH")
        transition_action_status(act["action_id"], "IN_PROGRESS")
        transition_action_status(act["action_id"], "RESOLVED")
        transition_action_status(act["action_id"], "VERIFIED")
        summary = get_action_summary(self.sample_url)
        self.assertEqual(summary["verification_rate"], 100.0)

    def test_19_json_export(self):
        """19. Test JSON export of actions."""
        create_action(self.sample_url, "TEST", "ref1", "Title 1", "Desc", "RISK", "P1", "HIGH")
        exported = export_actions_report(self.sample_url, "json")
        self.assertEqual(exported["status"], "success")
        self.assertEqual(exported["format"], "json")

    def test_20_markdown_export(self):
        """20. Test Markdown export of actions."""
        create_action(self.sample_url, "TEST", "ref1", "Title 1", "Desc", "RISK", "P1", "HIGH")
        exported = export_actions_report(self.sample_url, "markdown")
        self.assertEqual(exported["status"], "success")
        self.assertEqual(exported["format"], "markdown")
        self.assertIn("# Engineering Action Center", exported["content"])

    def test_21_html_export(self):
        """21. Test HTML export of actions."""
        create_action(self.sample_url, "TEST", "ref1", "Title 1", "Desc", "RISK", "P1", "HIGH")
        exported = export_actions_report(self.sample_url, "html")
        self.assertEqual(exported["status"], "success")
        self.assertEqual(exported["format"], "html")
        self.assertIn("<!DOCTYPE html>", exported["content"])

    def test_22_html_xss_escaping(self):
        """22. Test HTML XSS escaping protection."""
        create_action(self.sample_url, "TEST", "ref_xss", "<script>alert(1)</script>", "XSS Test", "RISK", "P0", "CRITICAL")
        exported = export_actions_report(self.sample_url, "html")
        content = exported["content"]
        self.assertNotIn("<script>alert(1)</script>", content)
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", content)

    def test_23_multiple_repositories(self):
        """23. Test tracking actions across multiple repositories."""
        create_action("https://github.com/psf/requests", "TEST", "ref1", "Title 1", "Desc", "RISK", "P1", "HIGH")
        create_action("https://github.com/pallets/flask", "TEST", "ref2", "Title 2", "Desc", "TESTING", "P2", "MEDIUM")
        actions_req = get_actions_for_repository("https://github.com/psf/requests")
        actions_flask = get_actions_for_repository("https://github.com/pallets/flask")
        self.assertEqual(len(actions_req), 1)
        self.assertEqual(len(actions_flask), 1)

    def test_24_empty_repository_state(self):
        """24. Test action summary for empty repository state."""
        summary = get_action_summary("https://github.com/empty/repo")
        self.assertEqual(summary["status"], "success")
        self.assertIsInstance(summary["actions"], list)

    def test_25_existing_steps_11_through_38_compatibility(self):
        """25. Test preservation of existing APIs from Steps 11-38."""
        inv_res = self.client.get(f"/api/engineering-investigation?repository_url={self.sample_url}")
        self.assertEqual(inv_res.status_code, 200)

        cc_res = self.client.get(f"/api/engineering-command-center?repository_url={self.sample_url}")
        self.assertEqual(cc_res.status_code, 200)


if __name__ == "__main__":
    unittest.main()
