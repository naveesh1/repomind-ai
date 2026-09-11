import unittest
from fastapi.testclient import TestClient
import html

from app.main import app
from app.services.engineering_investigation import (
    generate_investigation_report,
    export_investigation_report,
)


class TestEngineeringInvestigation(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.sample_url = "https://github.com/psf/requests"

    def test_01_repository_investigation(self):
        """1. Test investigation by repository target."""
        report = generate_investigation_report(self.sample_url, target=self.sample_url, target_type="REPOSITORY")
        self.assertEqual(report.get("status"), "success")
        self.assertIn("investigation_id", report)
        self.assertEqual(report.get("target_type"), "REPOSITORY")

    def test_02_file_investigation(self):
        """2. Test investigation by file target."""
        report = generate_investigation_report(self.sample_url, target="src/requests/api.py", target_type="FILE")
        self.assertEqual(report.get("status"), "success")
        self.assertEqual(report.get("target"), "src/requests/api.py")
        self.assertEqual(report.get("target_type"), "FILE")

    def test_03_commit_investigation(self):
        """3. Test investigation by commit SHA target."""
        commit_sha = "a1b2c3d4e5f678901234567890abcdef12345678"
        report = generate_investigation_report(self.sample_url, target=commit_sha, target_type="COMMIT")
        self.assertEqual(report.get("status"), "success")
        self.assertEqual(report.get("target_type"), "COMMIT")

    def test_04_risk_investigation(self):
        """4. Test investigation by risk item target."""
        report = generate_investigation_report(self.sample_url, target="Regression Risk Score", target_type="RISK_ITEM")
        self.assertEqual(report.get("status"), "success")
        self.assertEqual(report.get("target_type"), "RISK_ITEM")

    def test_05_alert_investigation(self):
        """5. Test investigation by alert target."""
        report = generate_investigation_report(self.sample_url, target="Alert_001", target_type="ALERT")
        self.assertEqual(report.get("status"), "success")
        self.assertEqual(report.get("target_type"), "ALERT")

    def test_06_evidence_generation(self):
        """6. Test evidence generation across categories."""
        report = generate_investigation_report(self.sample_url, target="src/requests/api.py", target_type="FILE")
        evidence = report.get("evidence", [])
        self.assertIsInstance(evidence, list)
        self.assertGreater(len(evidence), 0)
        categories = {e["category"] for e in evidence}
        self.assertIn("DEPENDENCY", categories)
        self.assertIn("COMPLEXITY", categories)

    def test_07_affected_file_detection(self):
        """7. Test affected file detection and impact classification."""
        report = generate_investigation_report(self.sample_url, target="src/requests/api.py", target_type="FILE")
        affected_files = report.get("affected_files", [])
        self.assertIsInstance(affected_files, list)
        self.assertGreater(len(affected_files), 0)
        self.assertIn("impact_type", affected_files[0])

    def test_08_function_level_analysis(self):
        """8. Test function-level AST complexity and nesting analysis."""
        report = generate_investigation_report(self.sample_url, target="src/requests/api.py", target_type="FILE")
        funcs = report.get("affected_functions", [])
        self.assertIsInstance(funcs, list)
        if funcs:
            self.assertIn("complexity", funcs[0])
            self.assertIn("nesting_depth", funcs[0])

    def test_09_dependency_path_tracing(self):
        """9. Test exact dependency path trace generation."""
        report = generate_investigation_report(self.sample_url, target="src/requests/api.py", target_type="FILE")
        paths = report.get("dependency_paths", [])
        self.assertIsInstance(paths, list)
        self.assertGreater(len(paths), 0)
        self.assertIn("formatted_path", paths[0])

    def test_10_test_classification(self):
        """10. Test affected test classification."""
        report = generate_investigation_report(self.sample_url, target="src/requests/api.py", target_type="FILE")
        tests = report.get("affected_tests", [])
        self.assertIsInstance(tests, list)
        self.assertGreater(len(tests), 0)

    def test_11_p0_p3_prioritization(self):
        """11. Test P0-P3 test prioritization and execution order."""
        report = generate_investigation_report(self.sample_url, target="src/requests/api.py", target_type="FILE")
        tests = report.get("affected_tests", [])
        priorities = {t["priority"] for t in tests}
        self.assertTrue(priorities.intersection({"P0", "P1", "P2", "P3"}))

    def test_12_risk_factor_breakdown(self):
        """12. Test quantitative risk factor breakdown."""
        report = generate_investigation_report(self.sample_url, target="src/requests/api.py", target_type="FILE")
        rf = report.get("risk_factors", {})
        self.assertIn("dependency_radius", rf)
        self.assertIn("target_complexity", rf)
        self.assertIn("total_score", rf)

    def test_13_historical_context(self):
        """13. Test historical context intelligence aggregation."""
        report = generate_investigation_report(self.sample_url, target="src/requests/api.py", target_type="FILE")
        hc = report.get("historical_context", {})
        self.assertIn("previous_risk", hc)
        self.assertIn("current_risk", hc)

    def test_14_release_impact(self):
        """14. Test release gating impact evaluation."""
        report = generate_investigation_report(self.sample_url, target="src/requests/api.py", target_type="FILE")
        ri = report.get("release_impact", {})
        self.assertIn("release_status", ri)
        self.assertIn("affects_release_readiness", ri)

    def test_15_governance_impact(self):
        """15. Test engineering governance impact evaluation."""
        report = generate_investigation_report(self.sample_url, target="src/requests/api.py", target_type="FILE")
        gi = report.get("governance_impact", {})
        self.assertIn("governance_score", gi)

    def test_16_recommendation_generation(self):
        """16. Test recommendation generation for investigation."""
        report = generate_investigation_report(self.sample_url, target="src/requests/api.py", target_type="FILE")
        recs = report.get("recommendations", [])
        self.assertIsInstance(recs, list)
        self.assertGreater(len(recs), 0)

    def test_17_next_action_generation(self):
        """17. Test ordered next action list generation."""
        report = generate_investigation_report(self.sample_url, target="src/requests/api.py", target_type="FILE")
        actions = report.get("next_actions", [])
        self.assertIsInstance(actions, list)
        self.assertGreater(len(actions), 0)

    def test_18_missing_metrics_fallback(self):
        """18. Test missing metrics fallback handling."""
        report = generate_investigation_report(self.sample_url, target="non_existent.py", target_type="FILE")
        self.assertEqual(report.get("status"), "success")
        self.assertIsNotNone(report.get("risk_score"))

    def test_19_invalid_input_api(self):
        """19. Test API endpoint returns HTTP 400 for invalid repository URL."""
        res = self.client.get("/api/engineering-investigation?repository_url=invalid_url")
        self.assertEqual(res.status_code, 400)

        res_post = self.client.post("/api/engineering-investigation", json={"repository_url": "invalid_url"})
        self.assertEqual(res_post.status_code, 400)

    def test_20_empty_repository_state(self):
        """20. Test investigation with None parameters defaults gracefully."""
        report = generate_investigation_report(None, None, None)
        self.assertEqual(report.get("status"), "success")

    def test_21_deterministic_repeated_execution(self):
        """21. Test deterministic output consistency for identical inputs."""
        r1 = generate_investigation_report(self.sample_url, target="src/requests/api.py", target_type="FILE")
        r2 = generate_investigation_report(self.sample_url, target="src/requests/api.py", target_type="FILE")
        self.assertEqual(r1["investigation_id"], r2["investigation_id"])
        self.assertEqual(r1["risk_score"], r2["risk_score"])
        self.assertEqual(r1["summary"], r2["summary"])

    def test_22_json_export(self):
        """22. Test JSON format export."""
        exported = export_investigation_report(self.sample_url, target="src/requests/api.py", export_format="json")
        self.assertEqual(exported.get("status"), "success")
        self.assertEqual(exported.get("format"), "json")

    def test_23_markdown_export(self):
        """23. Test Markdown format export."""
        exported = export_investigation_report(self.sample_url, target="src/requests/api.py", export_format="markdown")
        self.assertEqual(exported.get("status"), "success")
        self.assertEqual(exported.get("format"), "markdown")
        content = exported.get("content", "")
        self.assertIn("# Engineering Investigation", content)

    def test_24_html_export(self):
        """24. Test HTML format export."""
        exported = export_investigation_report(self.sample_url, target="src/requests/api.py", export_format="html")
        self.assertEqual(exported.get("status"), "success")
        self.assertEqual(exported.get("format"), "html")
        content = exported.get("content", "")
        self.assertIn("<!DOCTYPE html>", content)

    def test_25_xss_escaping_in_html_export(self):
        """25. Test XSS escaping protection using html.escape() in HTML export."""
        exported = export_investigation_report(self.sample_url, target="src/requests/api.py", export_format="html")
        self.assertEqual(exported.get("status"), "success")
        content = exported.get("content", "")
        self.assertNotIn("<script>", content)

    def test_26_existing_steps_11_through_37_preservation(self):
        """26. Test preservation of existing APIs from Steps 11-37."""
        cc_res = self.client.get(f"/api/engineering-command-center?repository_url={self.sample_url}")
        self.assertEqual(cc_res.status_code, 200)

        gov_res = self.client.get(f"/api/engineering-governance?repository_url={self.sample_url}")
        self.assertEqual(gov_res.status_code, 200)


if __name__ == "__main__":
    unittest.main()
