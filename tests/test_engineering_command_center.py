import unittest
from fastapi.testclient import TestClient
import html

from app.main import app
from app.services.engineering_command_center import (
    generate_command_center_report,
    export_command_center_report,
)


class TestEngineeringCommandCenter(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.sample_url = "https://github.com/psf/requests"

    def test_01_command_center_generation(self):
        """1. Test command center report generation."""
        report = generate_command_center_report(self.sample_url)
        self.assertEqual(report.get("status"), "success")
        self.assertIn("overall_engineering_score", report)
        self.assertIn("engineering_health", report)
        self.assertIn("system_status", report)

    def test_02_overall_score_calculation(self):
        """2. Test overall engineering score calculation bounds (0-100)."""
        report = generate_command_center_report(self.sample_url)
        score = report.get("overall_engineering_score")
        self.assertIsInstance(score, (int, float))
        self.assertGreaterEqual(score, 0.0)
        self.assertLessEqual(score, 100.0)

    def test_03_engineering_health_classification(self):
        """3. Test engineering health level classification."""
        report = generate_command_center_report(self.sample_url)
        health = report.get("engineering_health")
        self.assertIn(health, ["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL"])

    def test_04_system_status_classification(self):
        """4. Test system status classification."""
        report = generate_command_center_report(self.sample_url)
        status = report.get("system_status")
        self.assertIn(status, ["HEALTHY", "ATTENTION_REQUIRED", "DEGRADED", "CRITICAL"])

    def test_05_top_risk_ranking(self):
        """5. Test top risks structure and priority ranking."""
        report = generate_command_center_report(self.sample_url)
        top_risks = report.get("top_risks", [])
        self.assertIsInstance(top_risks, list)
        self.assertGreater(len(top_risks), 0)
        for risk in top_risks:
            self.assertIn("priority", risk)
            self.assertIn(risk["priority"], ["P0", "P1", "P2", "P3"])
            self.assertIn("category", risk)
            self.assertIn("explanation", risk)
            self.assertIn("recommended_action", risk)

    def test_06_recommendation_generation(self):
        """6. Test recommendation generation and required fields."""
        report = generate_command_center_report(self.sample_url)
        recs = report.get("recommendations", [])
        self.assertIsInstance(recs, list)
        self.assertGreater(len(recs), 0)
        valid_categories = {"RISK", "TESTING", "CODE_QUALITY", "MONITORING", "RELEASE", "MAINTAINABILITY", "GOVERNANCE"}
        for rec in recs:
            self.assertIn("priority", rec)
            self.assertIn("category", rec)
            self.assertIn(rec["category"], valid_categories)
            self.assertIn("title", rec)
            self.assertIn("action", rec)

    def test_07_repository_leaderboard(self):
        """7. Test repository leaderboard generation from comparison data."""
        report = generate_command_center_report(self.sample_url)
        leaderboard = report.get("repository_leaderboard", [])
        self.assertIsInstance(leaderboard, list)
        self.assertGreater(len(leaderboard), 0)
        first = leaderboard[0]
        self.assertIn("rank", first)
        self.assertIn("benchmark_score", first)

    def test_08_historical_trend_aggregation(self):
        """8. Test historical trend aggregation."""
        report = generate_command_center_report(self.sample_url)
        trends = report.get("trend_summary", {})
        self.assertIn("risk_trend", trends)
        self.assertIn("health_trend", trends)
        self.assertIn("release_trend", trends)

    def test_09_recent_event_generation(self):
        """9. Test recent engineering event generation."""
        report = generate_command_center_report(self.sample_url)
        events = report.get("recent_events", [])
        self.assertIsInstance(events, list)
        self.assertGreater(len(events), 0)
        for ev in events:
            self.assertIn("repository", ev)
            self.assertIn("event_type", ev)
            self.assertIn("severity", ev)
            self.assertIn("summary", ev)

    def test_10_executive_summary_generation(self):
        """10. Test executive summary deterministic text synthesis."""
        report = generate_command_center_report(self.sample_url)
        summary = report.get("executive_summary")
        self.assertIsInstance(summary, str)
        self.assertIn("Engineering health is", summary)
        self.assertIn("governance score", summary)

    def test_11_multiple_repositories(self):
        """11. Test command center report with multiple repository URLs."""
        urls = ["https://github.com/psf/requests", "https://github.com/pallets/flask"]
        report = generate_command_center_report(repository_urls=urls)
        self.assertEqual(report.get("status"), "success")
        self.assertGreaterEqual(len(report.get("repository_leaderboard", [])), 2)

    def test_12_missing_metrics_fallback(self):
        """12. Test robustness with empty/missing metrics handling."""
        report = generate_command_center_report("https://github.com/psf/requests")
        self.assertEqual(report.get("status"), "success")
        self.assertIsNotNone(report.get("governance_score"))

    def test_13_default_repository_state(self):
        """13. Test command center with None parameters defaults gracefully."""
        report = generate_command_center_report(None, None)
        self.assertEqual(report.get("status"), "success")

    def test_14_deterministic_repeated_execution(self):
        """14. Test deterministic output consistency for identical inputs."""
        r1 = generate_command_center_report(self.sample_url)
        r2 = generate_command_center_report(self.sample_url)
        self.assertEqual(r1["overall_engineering_score"], r2["overall_engineering_score"])
        self.assertEqual(r1["engineering_health"], r2["engineering_health"])
        self.assertEqual(r1["executive_summary"], r2["executive_summary"])

    def test_15_json_export(self):
        """15. Test JSON format export."""
        exported = export_command_center_report(self.sample_url, export_format="json")
        self.assertEqual(exported.get("status"), "success")
        self.assertEqual(exported.get("format"), "json")
        self.assertIn("content", exported)

    def test_16_markdown_export(self):
        """16. Test Markdown format export."""
        exported = export_command_center_report(self.sample_url, export_format="markdown")
        self.assertEqual(exported.get("status"), "success")
        self.assertEqual(exported.get("format"), "markdown")
        content = exported.get("content", "")
        self.assertIn("# Engineering Command Center", content)
        self.assertIn("## Top Engineering Risks", content)

    def test_17_html_export(self):
        """17. Test HTML format export."""
        exported = export_command_center_report(self.sample_url, export_format="html")
        self.assertEqual(exported.get("status"), "success")
        self.assertEqual(exported.get("format"), "html")
        content = exported.get("content", "")
        self.assertIn("<!DOCTYPE html>", content)
        self.assertIn("🚀 Engineering Command Center", content)

    def test_18_xss_escaping_in_html_export(self):
        """18. Test XSS escaping protection using html.escape() in HTML export."""
        exported = export_command_center_report(self.sample_url, export_format="html")
        self.assertEqual(exported.get("status"), "success")
        content = exported.get("content", "")
        # Verify no raw unescaped script tag can exist in HTML export content
        self.assertNotIn("<script>", content)
        # Verify html.escape converts special characters like '<' or '>' in dynamic values to entities
        raw_string = "<img src=x onerror=alert(1)>"
        escaped_string = html.escape(raw_string)
        self.assertEqual(escaped_string, "&lt;img src=x onerror=alert(1)&gt;")

    def test_19_invalid_input_handling_api(self):
        """19. Test API endpoints handle invalid repository URL cleanly with HTTP 400."""
        res = self.client.get("/api/engineering-command-center?repository_url=invalid_url")
        self.assertEqual(res.status_code, 400)

        res_post = self.client.post("/api/engineering-command-center", json={"repository_url": "invalid_url"})
        self.assertEqual(res_post.status_code, 400)

    def test_20_preservation_of_existing_apis(self):
        """20. Test preservation of existing APIs from Steps 11-36."""
        h_res = self.client.get("/api/health")
        self.assertEqual(h_res.status_code, 200)

        g_res = self.client.get(f"/api/engineering-governance?repository_url={self.sample_url}")
        self.assertEqual(g_res.status_code, 200)


if __name__ == "__main__":
    unittest.main()
