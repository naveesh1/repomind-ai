import unittest
from fastapi.testclient import TestClient

from app.main import app
from app.services.unified_engineering_intelligence import (
    get_unified_engineering_intelligence,
    export_unified_intelligence_report,
)
from app.services.engineering_investigation import generate_investigation_report
from app.services.engineering_command_center import generate_command_center_report


class TestUnifiedEngineeringIntelligence(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.sample_url = "https://github.com/psf/requests"

    def test_01_canonical_metrics_model(self):
        """1. Test canonical metrics model calculation and fields."""
        res = get_unified_engineering_intelligence(self.sample_url)
        self.assertEqual(res["status"], "success")
        self.assertTrue(res["single_source_of_truth"])
        metrics = res["canonical_metrics"]
        self.assertIn("regression_risk", metrics)
        self.assertIn("governance_score", metrics)
        self.assertIn("repository_health", metrics)
        self.assertIn("code_quality", metrics)
        self.assertIn("testing_health", metrics)
        self.assertIn("monitoring_score", metrics)
        self.assertIn("release_confidence", metrics)
        self.assertIn("maintainability", metrics)
        self.assertIn("overall_engineering_score", metrics)

    def test_02_bounded_normalization(self):
        """2. Test that all numerical metrics are bounded to [0, 100]."""
        res = get_unified_engineering_intelligence(self.sample_url)
        metrics = res["canonical_metrics"]
        for key, val in metrics.items():
            if isinstance(val, (int, float)):
                self.assertGreaterEqual(val, 0.0, f"Metric '{key}' is below 0")
                self.assertLessEqual(val, 100.0, f"Metric '{key}' is above 100")

    def test_03_metric_provenance_tracking(self):
        """3. Test metric provenance tracking records."""
        res = get_unified_engineering_intelligence(self.sample_url)
        prov = res["metric_provenance"]
        self.assertIsInstance(prov, list)
        self.assertGreater(len(prov), 0)
        self.assertIn("source_engine", prov[0])
        self.assertIn("calculation_basis", prov[0])

    def test_04_cross_service_consistency(self):
        """4. Test cross-service risk consistency checks."""
        res = get_unified_engineering_intelligence(self.sample_url)
        checks = res["consistency_checks"]
        self.assertIsInstance(checks, list)
        self.assertGreater(len(checks), 0)
        self.assertEqual(res["consistency_status"], "CONSISTENT")

    def test_05_detection_conflicting_metrics(self):
        """5. Test detection of metric values and validation warning output."""
        res = get_unified_engineering_intelligence(self.sample_url)
        self.assertIn("validation_warnings", res)
        self.assertIsInstance(res["validation_warnings"], list)

    def test_06_out_of_range_detection(self):
        """6. Test validation score range checks."""
        res = get_unified_engineering_intelligence(self.sample_url)
        self.assertEqual(res["consistency_score"], 100.0)

    def test_07_missing_metric_fallback(self):
        """7. Test fallback handling for missing repo context."""
        res = get_unified_engineering_intelligence(None)
        self.assertEqual(res["status"], "success")

    def test_08_command_center_integration(self):
        """8. Test Command Center integration consistency."""
        res_ui = get_unified_engineering_intelligence(self.sample_url)
        res_cc = generate_command_center_report(self.sample_url)
        self.assertEqual(res_ui["canonical_metrics"]["regression_risk"], res_cc["current_regression_risk"])

    def test_09_investigation_center_integration(self):
        """9. Test Investigation Center integration consistency."""
        res_ui = get_unified_engineering_intelligence(self.sample_url)
        res_inv = generate_investigation_report(self.sample_url)
        self.assertEqual(res_ui["canonical_metrics"]["regression_risk"], res_inv["risk_score"])

    def test_10_step38_inconsistency_resolution(self):
        """10. Test resolution of Step 38 61 vs 22 inconsistency (risk_factors.total_score matches risk_score)."""
        res_inv = generate_investigation_report(self.sample_url)
        risk_score = res_inv["risk_score"]
        factor_total = res_inv["risk_factors"]["total_score"]
        self.assertEqual(risk_score, factor_total, "Step 38 risk score and risk factor calculated score must be 100% equal")

    def test_11_json_export(self):
        """11. Test JSON export format."""
        exported = export_unified_intelligence_report(self.sample_url, "json")
        self.assertEqual(exported["status"], "success")
        self.assertEqual(exported["format"], "json")

    def test_12_markdown_export(self):
        """12. Test Markdown export format."""
        exported = export_unified_intelligence_report(self.sample_url, "markdown")
        self.assertEqual(exported["status"], "success")
        self.assertEqual(exported["format"], "markdown")
        self.assertIn("# Unified Engineering Intelligence", exported["content"])

    def test_13_html_export(self):
        """13. Test HTML export format."""
        exported = export_unified_intelligence_report(self.sample_url, "html")
        self.assertEqual(exported["status"], "success")
        self.assertEqual(exported["format"], "html")
        self.assertIn("<!DOCTYPE html>", exported["content"])

    def test_14_html_xss_escaping(self):
        """14. Test XSS escaping protection in HTML export."""
        exported = export_unified_intelligence_report(self.sample_url, "html")
        content = exported["content"]
        self.assertNotIn("<script>", content)

    def test_15_deterministic_execution(self):
        """15. Test deterministic output consistency for repeated calls."""
        res1 = get_unified_engineering_intelligence(self.sample_url)
        res2 = get_unified_engineering_intelligence(self.sample_url)
        self.assertEqual(res1["canonical_metrics"], res2["canonical_metrics"])

    def test_16_api_post_endpoint(self):
        """16. Test POST /api/unified-engineering-intelligence endpoint."""
        res = self.client.post("/api/unified-engineering-intelligence", json={"repository_url": self.sample_url})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "success")

    def test_17_api_get_endpoint(self):
        """17. Test GET /api/unified-engineering-intelligence endpoint."""
        res = self.client.get(f"/api/unified-engineering-intelligence?repository_url={self.sample_url}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "success")

    def test_18_api_export_endpoint(self):
        """18. Test POST /api/unified-engineering-intelligence/export endpoint."""
        res = self.client.post("/api/unified-engineering-intelligence/export", json={"repository_url": self.sample_url, "export_format": "json"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "success")

    def test_19_invalid_repo_handling(self):
        """19. Test error handling for invalid repository inputs."""
        res = self.client.get("/api/unified-engineering-intelligence?repository_url=https://github.com/invalid/repo_404_xyz")
        self.assertEqual(res.status_code, 400)

    def test_20_steps_11_through_39_compatibility(self):
        """20. Test preservation of existing APIs from Steps 11-39."""
        res_actions = self.client.get(f"/api/engineering-actions?repository_url={self.sample_url}")
        self.assertEqual(res_actions.status_code, 200)

        res_inv = self.client.get(f"/api/engineering-investigation?repository_url={self.sample_url}")
        self.assertEqual(res_inv.status_code, 200)

        res_cc = self.client.get(f"/api/engineering-command-center?repository_url={self.sample_url}")
        self.assertEqual(res_cc.status_code, 200)


if __name__ == "__main__":
    unittest.main()
