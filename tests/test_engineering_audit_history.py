import unittest
import html
import json
import datetime
from app.services.engineering_audit_history import (
    generate_engineering_audit_history,
    create_audit_event,
    create_engineering_decision,
    generate_deterministic_event_id,
    generate_deterministic_decision_id,
    compare_metric_snapshots,
    classify_remediation_outcome,
    export_engineering_audit_history,
    record_metric_snapshot,
    _AUDIT_EVENTS_STORE,
    _DECISIONS_STORE,
    _METRIC_SNAPSHOTS,
)


class TestEngineeringAuditHistory(unittest.TestCase):
    def setUp(self):
        """Reset global stores before each test."""
        _AUDIT_EVENTS_STORE.clear()
        _DECISIONS_STORE.clear()
        _METRIC_SNAPSHOTS.clear()
        self.repo_url = "https://github.com/psf/requests"

    # 1. Audit event creation
    def test_01_audit_event_creation(self):
        event = create_audit_event(
            repository_url=self.repo_url,
            event_type="REPOSITORY_ANALYZED",
            target="psf/requests",
            source_step="Step 40",
            risk_score=45.0,
            governance_score=80.0,
            engineering_score=75.0,
            release_status="APPROVED_FOR_RELEASE",
            explanation="Initial analysis completed.",
        )
        self.assertIn("event_id", event)
        self.assertTrue(event["event_id"].startswith("audit_"))
        self.toEqual = self.assertEqual(event["event_type"], "REPOSITORY_ANALYZED")
        self.assertEqual(event["target"], "psf/requests")

    # 2. Deterministic event IDs
    def test_02_deterministic_event_ids(self):
        id1 = generate_deterministic_event_id(self.repo_url, "RISK_DETECTED", "src/main.py", "act_123", "OPEN")
        id2 = generate_deterministic_event_id(self.repo_url, "RISK_DETECTED", "src/main.py", "act_123", "OPEN")
        self.assertEqual(id1, id2)
        self.assertTrue(id1.startswith("audit_"))
        self.assertEqual(len(id1), 18)  # audit_ + 12 hex chars

    # 3. Duplicate event prevention
    def test_03_duplicate_event_prevention(self):
        evt1 = create_audit_event(
            repository_url=self.repo_url,
            event_type="ACTION_CREATED",
            target="Action Title",
            action_id="act_123",
            new_state="OPEN",
        )
        initial_count = len(_AUDIT_EVENTS_STORE)
        evt2 = create_audit_event(
            repository_url=self.repo_url,
            event_type="ACTION_CREATED",
            target="Action Title",
            action_id="act_123",
            new_state="OPEN",
        )
        self.assertEqual(evt1["event_id"], evt2["event_id"])
        self.assertEqual(len(_AUDIT_EVENTS_STORE), initial_count)

    # 4. Repository filtering
    def test_04_repository_filtering(self):
        create_audit_event("https://github.com/owner/repoA", "REPOSITORY_ANALYZED", "repoA")
        create_audit_event("https://github.com/owner/repoB", "REPOSITORY_ANALYZED", "repoB")
        res = generate_engineering_audit_history("https://github.com/owner/repoA")
        self.assertEqual(res["repository_url"], "https://github.com/owner/repoA")
        for e in res["audit_events"]:
            self.assertEqual(e["repository_url"], "https://github.com/owner/repoA")

    # 5. Event filtering
    def test_05_event_filtering(self):
        create_audit_event(self.repo_url, "REPOSITORY_ANALYZED", "requests")
        create_audit_event(self.repo_url, "RISK_DETECTED", "requests")
        res = generate_engineering_audit_history(self.repo_url, event_type_filter="RISK_DETECTED")
        self.assertTrue(all(e["event_type"] == "RISK_DETECTED" for e in res["audit_events"]))

    # 6. Risk filtering
    def test_06_risk_filtering(self):
        create_audit_event(self.repo_url, "RISK_DETECTED", "high_risk", risk_score=85.0)
        create_audit_event(self.repo_url, "RISK_DETECTED", "low_risk", risk_score=20.0)
        res = generate_engineering_audit_history(self.repo_url, risk_level_filter="HIGH")
        self.assertTrue(all(e["risk_score"] >= 70.0 for e in res["audit_events"]))

    # 7. Decision creation
    def test_07_decision_creation(self):
        dec = create_engineering_decision(
            repository_url=self.repo_url,
            decision="APPROVE_RELEASE",
            reason="All risk scores within bounds.",
            risk_score=25.0,
            release_status="APPROVED_FOR_RELEASE",
        )
        self.assertIn("decision_id", dec)
        self.assertTrue(dec["decision_id"].startswith("dec_"))
        self.assertEqual(dec["decision"], "APPROVE_RELEASE")

    # 8. Decision history
    def test_08_decision_history(self):
        create_engineering_decision(self.repo_url, "INVESTIGATE", "High complexity")
        create_engineering_decision(self.repo_url, "START_REMEDIATION", "Fixing complexity")
        res = generate_engineering_audit_history(self.repo_url)
        self.assertGreaterEqual(len(res["decisions"]), 2)

    # 9. Investigation integration
    def test_09_investigation_integration(self):
        res = generate_engineering_audit_history(self.repo_url)
        event_types = [e["event_type"] for e in res["audit_events"]]
        self.assertIn("INVESTIGATION_COMPLETED", event_types)

    # 10. Action integration
    def test_10_action_integration(self):
        res = generate_engineering_audit_history(self.repo_url)
        event_types = [e["event_type"] for e in res["audit_events"]]
        self.assertIn("ACTION_CREATED", event_types)

    # 11. Action state transitions
    def test_11_action_state_transitions(self):
        create_audit_event(
            self.repo_url,
            "ACTION_STARTED",
            "Action Title",
            action_id="act_01",
            previous_state="OPEN",
            new_state="IN_PROGRESS",
        )
        create_audit_event(
            self.repo_url,
            "ACTION_RESOLVED",
            "Action Title",
            action_id="act_01",
            previous_state="IN_PROGRESS",
            new_state="RESOLVED",
        )
        res = generate_engineering_audit_history(self.repo_url)
        events = [e for e in res["audit_events"] if e.get("action_id") == "act_01"]
        self.assertGreaterEqual(len(events), 2)

    # 12. Verification events
    def test_12_verification_events(self):
        evt = create_audit_event(
            self.repo_url,
            "ACTION_VERIFIED",
            "Action Title",
            action_id="act_01",
            verification_status="VERIFIED",
        )
        self.assertEqual(evt["verification_status"], "VERIFIED")

    # 13. Release decision events
    def test_13_release_decision_events(self):
        res = generate_engineering_audit_history(self.repo_url)
        event_types = [e["event_type"] for e in res["audit_events"]]
        self.assertTrue(any("RELEASE_" in et for et in event_types))

    # 14. Step 40 canonical metric integration
    def test_14_step_40_canonical_metric_integration(self):
        res = generate_engineering_audit_history(self.repo_url)
        metrics = res["canonical_metrics"]
        self.assertIn("regression_risk", metrics)
        self.assertIn("governance_score", metrics)
        self.assertIn("overall_engineering_score", metrics)

    # 15. Before/after risk comparison
    def test_15_before_after_risk_comparison(self):
        prev = {"risk_score": 75.0, "governance_score": 60.0, "engineering_score": 50.0, "release_status": "RELEASE_BLOCKED"}
        curr = {"risk_score": 40.0, "governance_score": 85.0, "engineering_score": 80.0, "release_status": "APPROVED_FOR_RELEASE"}
        comp = compare_metric_snapshots(prev, curr)
        self.assertEqual(comp["previous_risk_score"], 75.0)
        self.assertEqual(comp["current_risk_score"], 40.0)
        self.assertEqual(comp["risk_delta"], -35.0)

    # 16. Governance comparison
    def test_16_governance_comparison(self):
        prev = {"risk_score": 50.0, "governance_score": 60.0, "engineering_score": 70.0, "release_status": "APPROVED_FOR_RELEASE"}
        curr = {"risk_score": 50.0, "governance_score": 80.0, "engineering_score": 75.0, "release_status": "APPROVED_FOR_RELEASE"}
        comp = compare_metric_snapshots(prev, curr)
        self.assertEqual(comp["governance_delta"], 20.0)

    # 17. Engineering score comparison
    def test_17_engineering_score_comparison(self):
        prev = {"risk_score": 50.0, "governance_score": 70.0, "engineering_score": 60.0, "release_status": "APPROVED_FOR_RELEASE"}
        curr = {"risk_score": 50.0, "governance_score": 70.0, "engineering_score": 85.0, "release_status": "APPROVED_FOR_RELEASE"}
        comp = compare_metric_snapshots(prev, curr)
        self.assertEqual(comp["engineering_delta"], 25.0)

    # 18. IMPROVED outcome
    def test_18_improved_outcome(self):
        prev = {"risk_score": 80.0, "governance_score": 60.0, "engineering_score": 55.0, "release_status": "RELEASE_BLOCKED"}
        curr = {"risk_score": 30.0, "governance_score": 90.0, "engineering_score": 85.0, "release_status": "APPROVED_FOR_RELEASE"}
        comp = compare_metric_snapshots(prev, curr)
        self.assertEqual(comp["outcome"], "IMPROVED")

    # 19. UNCHANGED outcome
    def test_19_unchanged_outcome(self):
        prev = {"risk_score": 45.0, "governance_score": 80.0, "engineering_score": 75.0, "release_status": "APPROVED_FOR_RELEASE"}
        curr = {"risk_score": 45.0, "governance_score": 80.0, "engineering_score": 75.0, "release_status": "APPROVED_FOR_RELEASE"}
        comp = compare_metric_snapshots(prev, curr)
        self.assertEqual(comp["outcome"], "UNCHANGED")

    # 20. DETERIORATED outcome
    def test_20_deteriorated_outcome(self):
        prev = {"risk_score": 30.0, "governance_score": 90.0, "engineering_score": 85.0, "release_status": "APPROVED_FOR_RELEASE"}
        curr = {"risk_score": 85.0, "governance_score": 50.0, "engineering_score": 45.0, "release_status": "RELEASE_BLOCKED"}
        comp = compare_metric_snapshots(prev, curr)
        self.assertEqual(comp["outcome"], "DETERIORATED")

    # 21. NO_PREVIOUS_SNAPSHOT
    def test_21_no_previous_snapshot(self):
        curr = {"risk_score": 45.0, "governance_score": 80.0, "engineering_score": 75.0, "release_status": "APPROVED_FOR_RELEASE"}
        comp = compare_metric_snapshots(None, curr)
        self.assertEqual(comp["comparison_status"], "NO_PREVIOUS_SNAPSHOT")
        self.assertEqual(comp["outcome"], "NO_PREVIOUS_SNAPSHOT")

    # 22. JSON export
    def test_22_json_export(self):
        res = export_engineering_audit_history(self.repo_url, export_format="json")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["format"], "json")
        self.assertIn("data", res)

    # 23. Markdown export
    def test_23_markdown_export(self):
        res = export_engineering_audit_history(self.repo_url, export_format="markdown")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["format"], "markdown")
        self.assertIn("Engineering Audit History", res["content"])

    # 24. HTML export
    def test_24_html_export(self):
        res = export_engineering_audit_history(self.repo_url, export_format="html")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["format"], "html")
        self.assertIn("<!DOCTYPE html>", res["content"])

    # 25. XSS escaping
    def test_25_xss_escaping(self):
        xss_repo = "https://github.com/owner/<script>alert('xss')</script>"
        res = export_engineering_audit_history(xss_repo, export_format="html")
        content = res["content"]
        self.assertNotIn("<script>alert('xss')</script>", content)
        self.assertIn(html.escape("<script>alert('xss')</script>"), content)

    # 26. Deterministic repeated execution
    def test_26_deterministic_repeated_execution(self):
        res1 = generate_engineering_audit_history(self.repo_url)
        res2 = generate_engineering_audit_history(self.repo_url)
        self.assertEqual(len(res1["audit_events"]), len(res2["audit_events"]))
        self.assertEqual(res1["engineering_outcome"], res2["engineering_outcome"])

    # 27. Multiple repositories
    def test_27_multiple_repositories(self):
        repo1 = "https://github.com/owner/repo1"
        repo2 = "https://github.com/owner/repo2"
        create_audit_event(repo1, "REPOSITORY_ANALYZED", "target1")
        create_audit_event(repo2, "REPOSITORY_ANALYZED", "target2")
        res1 = generate_engineering_audit_history(repo1)
        res2 = generate_engineering_audit_history(repo2)
        self.assertEqual(res1["repository_url"], repo1)
        self.assertEqual(res2["repository_url"], repo2)

    # 28. Event ordering
    def test_28_event_ordering(self):
        t1 = "2026-08-26T10:00:00Z"
        t2 = "2026-08-26T12:00:00Z"
        create_audit_event(self.repo_url, "REPOSITORY_ANALYZED", "t1", timestamp=t1)
        create_audit_event(self.repo_url, "RISK_DETECTED", "t2", timestamp=t2)
        res = generate_engineering_audit_history(self.repo_url)
        events = res["audit_events"]
        if len(events) >= 2:
            self.assertGreaterEqual(events[0]["timestamp"], events[1]["timestamp"])

    # 29. Missing optional relationships
    def test_29_missing_optional_relationships(self):
        evt = create_audit_event(
            self.repo_url,
            "REPOSITORY_ANALYZED",
            "requests",
            action_id=None,
            investigation_id=None,
            previous_state=None,
            new_state=None,
        )
        self.assertIsNone(evt["action_id"])
        self.assertIsNone(evt["investigation_id"])

    # 30. Invalid event rejection
    def test_30_invalid_event_rejection(self):
        res = create_audit_event(
            self.repo_url,
            "INVALID_EVENT_TYPE_123",
            "target",
        )
        self.assertEqual(res.get("status"), "error")
        self.assertIn("Unsupported event type", res.get("message", ""))


if __name__ == "__main__":
    unittest.main()
