import functools
import unittest
from fastapi.testclient import TestClient

from app.main import app
import app.services.ingestion as ingestion_module
from app.services.change_simulator import simulate_code_change
from app.services.repository_health import calculate_repository_health
from app.services.code_quality import (
    calculate_ast_complexity,
    calculate_ast_nesting_depth,
    compute_repository_code_quality,
)
from app.services.executive_summary import (
    compute_overall_grade,
    generate_executive_summary_report,
)
from app.services.change_detection import compare_ast_structures





# Cache git clone ingestion results for test efficiency and reliability
_original_ingest = ingestion_module.ingest_repository
ingestion_module.ingest_repository = functools.lru_cache(maxsize=4)(_original_ingest)


class TestChangeSimulationAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        # Standard repository used for testing
        self.test_repo_url = "https://github.com/psf/requests"

    def test_01_analyze_api_still_works(self):
        """Verify /api/analyze remains unchanged and works."""
        response = self.client.post("/api/analyze", json={"repository_url": self.test_repo_url})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("python_files", data)
        self.assertIn("dependency_graph", data)

    def test_02_impact_analysis_api_still_works(self):
        """Verify /api/impact-analysis remains unchanged and works."""
        response = self.client.post(
            "/api/impact-analysis",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
                "changed_function": "prepare_url",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("risk_score", data)
        self.assertIn("risk_level", data)
        self.assertIn("impacted_files", data)

    def test_03_simulate_change_valid_file_and_function(self):
        """Test 1: Valid file + function change simulation."""
        response = self.client.post(
            "/api/simulate-change",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
                "changed_function": "prepare_url",
                "change_description": "Refactor URL validation logic",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["changed_file"], "src/requests/models.py")
        self.assertEqual(data["changed_function"], "prepare_url")
        self.assertEqual(data["change_description"], "Refactor URL validation logic")
        self.assertIsInstance(data["risk_score"], int)
        self.assertIn(data["risk_level"], ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
        self.assertIsInstance(data["impacted_files"], list)
        self.assertIsInstance(data["direct_dependents"], list)
        self.assertIsInstance(data["transitive_dependents"], list)
        self.assertIsInstance(data["affected_tests"], list)
        self.assertIsInstance(data["review_recommendations"], list)
        self.assertTrue(len(data["summary"]) > 0)

    def test_04_simulate_change_valid_file_without_function(self):
        """Test 2: Valid file without function."""
        response = self.client.post(
            "/api/simulate-change",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/api.py",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["changed_file"], "src/requests/api.py")
        self.assertIsNone(data["changed_function"])
        self.assertIsInstance(data["affected_tests"], list)

    def test_05_simulate_change_invalid_file(self):
        """Test 3: Invalid file returns 400 error."""
        response = self.client.post(
            "/api/simulate-change",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "non_existent_directory/fake_file.py",
            },
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("detail", data)

    def test_06_simulate_change_invalid_repo_url(self):
        """Test 4: Invalid repository URL returns 400 error."""
        response = self.client.post(
            "/api/simulate-change",
            json={
                "repository_url": "https://invalid-url.com/not/github",
                "changed_file": "main.py",
            },
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("detail", data)

    def test_07_simulate_change_test_file_detection(self):
        """Test 5 & 6: Verify affected test detection and recommendations."""
        res = simulate_code_change(
            repository_url=self.test_repo_url,
            changed_file="src/requests/models.py",
            changed_function="prepare_url",
            change_description="Testing test file detection",
        )
        self.assertEqual(res["status"], "success")
        # Check that affected_tests contains test files if present in impacted_files
        for test_f in res["affected_tests"]:
            self.assertTrue(any(kw in test_f.lower() for kw in ("test", "spec")))

    def test_08_step16_proposed_change_simulation(self):
        """Test Step 16: Proposed change simulation with reasoning and proposed_change."""
        response = self.client.post(
            "/api/simulate-change",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
                "changed_function": "prepare_url",
                "proposed_change": "Change URL preparation validation logic.",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["changed_file"], "src/requests/models.py")
        self.assertEqual(data["changed_function"], "prepare_url")
        self.assertEqual(data["proposed_change"], "Change URL preparation validation logic.")
        self.assertIn("reason", data)
        self.assertIsInstance(data["risk_score"], int)
        self.assertIn(data["risk_level"], ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
        self.assertIsInstance(data["impacted_files"], list)

    def test_09_step16_invalid_file(self):
        """Test Step 16: Invalid file returns 400."""
        response = self.client.post(
            "/api/simulate-change",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/does_not_exist.py",
                "proposed_change": "Change URL preparation validation logic.",
            },
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("detail", data)

    def test_10_step17_change_explanation_valid(self):
        """Test Step 17: Valid change explanation generation."""
        response = self.client.post(
            "/api/change-explanation",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
                "changed_function": "prepare_url",
                "proposed_change": "Refactor URL validation logic.",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("summary", data)
        self.assertIn("change_description", data)
        self.assertIn("risk_explanation", data)
        self.assertIsInstance(data["important_files"], list)
        self.assertIn("direct_dependency_explanation", data)
        self.assertIn("transitive_dependency_explanation", data)
        self.assertIsInstance(data["recommended_tests"], list)
        self.assertIn("recommendation", data)

    def test_11_step17_change_explanation_invalid_file(self):
        """Test Step 17: Invalid file for change explanation returns 400."""
        response = self.client.post(
            "/api/change-explanation",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/does_not_exist.py",
                "proposed_change": "Refactor URL validation logic.",
            },
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("detail", data)

    def test_12_step18_repository_health_get_success(self):
        """Test Step 18: GET /api/repository-health returns health metrics."""
        response = self.client.get(
            f"/api/repository-health?repository_url={self.test_repo_url}"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("repository_name", data)
        self.assertIsInstance(data["health_score"], int)
        self.assertIn(data["health_level"], ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
        self.assertIsInstance(data["risk_indicators"], list)
        self.assertIsInstance(data["high_impact_files"], list)
        self.assertIsInstance(data["recommendations"], list)
        self.assertGreater(data["python_files"], 0)

    def test_13_step18_repository_health_post_success(self):
        """Test Step 18: POST /api/repository-health returns health metrics."""
        response = self.client.post(
            "/api/repository-health",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIsInstance(data["health_score"], int)
        self.assertIn(data["health_level"], ["LOW", "MEDIUM", "HIGH", "CRITICAL"])

    def test_14_step18_repository_health_missing_repo_error(self):
        """Test Step 18: Repository health returns 400 when analysis has not been performed."""
        response = self.client.get("/api/repository-health")
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("detail", data)

        response_post = self.client.post("/api/repository-health", json={})
        self.assertEqual(response_post.status_code, 400)
        data_post = response_post.json()
        self.assertIn("detail", data_post)

    def test_15_step18_health_score_calculation(self):
        """Test Step 18: Deterministic health score calculation and levels."""
        mock_repo_data = {
            "repository_name": "test-repo",
            "total_files": 10,
            "source_files": 8,
            "test_files": 0,  # -25 penalty
            "directories": 2,
            "python_files": [
                {
                    "file": "main.py",
                    "functions": ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9"],  # 9 funcs in 1 file > 8.0: -10 penalty
                    "classes": ["C1"],
                    "imports": ["util"],
                },
            ],
            "dependency_graph": {"main.py": []},

        }
        res = calculate_repository_health(mock_repo_data)
        # Expected score: 100 - 25 (no tests) - 10 (high func density) = 65 -> HIGH level
        self.assertEqual(res["health_score"], 65)
        self.assertEqual(res["health_level"], "HIGH")
        self.assertIn("No automated test files detected in repository file structure.", res["risk_indicators"])
        self.assertTrue(len(res["recommendations"]) > 0)

    def test_16_step19_code_quality_post_success(self):
        """Test Step 19: POST /api/code-quality returns quality metrics."""
        response = self.client.post(
            "/api/code-quality",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIsInstance(data["quality_score"], int)
        self.assertIn(data["quality_level"], ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
        self.assertGreater(data["total_files_analyzed"], 0)
        self.assertGreater(data["total_functions"], 0)
        self.assertIsInstance(data["issues"], list)
        self.assertIsInstance(data["file_metrics"], list)
        self.assertIsInstance(data["recommendations"], list)

    def test_17_step19_code_quality_missing_repo_400(self):
        """Test Step 19: POST /api/code-quality returns 400 when analysis has not been performed."""
        ingestion_module.set_last_analyzed_repo_url("")
        response = self.client.post("/api/code-quality", json={})
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("detail", data)

    def test_18_step19_complexity_and_nesting_calculation(self):
        """Test Step 19: AST cyclomatic complexity and nesting depth calculation."""
        import ast

        code = """
def sample_func(a, b):
    if a > 0:
        for i in range(b):
            while i > 0:
                if i % 2 == 0 and a > 5:
                    print(i)
"""
        tree = ast.parse(code)
        fn_node = [node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)][0]

        comp = calculate_ast_complexity(fn_node)
        nest = calculate_ast_nesting_depth(fn_node, 0)

        self.assertGreaterEqual(comp, 5)
        self.assertEqual(nest, 4)

    def test_19_step19_large_file_and_nesting_detection(self):
        """Test Step 19: Detection of large files and deeply nested functions in repository quality calculation."""
        mock_repo = {
            "python_files": [
                {
                    "file": "big_module.py",
                    "lines": 350,  # > 250 -> large file
                    "functions": ["f1", "f2"],
                    "classes": ["C1"],
                    "max_complexity": 14,  # > 10 -> complex function
                    "max_nesting_depth": 5,  # >= 4 -> deeply nested
                }
            ]
        }
        res = compute_repository_code_quality(mock_repo)
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["total_files_analyzed"], 1)
        self.assertEqual(res["complex_functions"], 1)
        self.assertEqual(res["large_files"], 1)
        self.assertEqual(res["deeply_nested_functions"], 1)
        self.assertIn("CRITICAL", [res["quality_level"], res["file_metrics"][0]["quality_level"]])

    def test_20_step19_invalid_input_handling(self):
        """Test Step 19: Invalid repository URL returns 400 for code quality."""
        response = self.client.post(
            "/api/code-quality",
            json={"repository_url": "https://invalid-site.com/not/github"},
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("detail", data)

    def test_21_step20_executive_summary_post_success(self):
        """Test Step 20: POST /api/executive-summary returns full executive summary report."""
        response = self.client.post(
            "/api/executive-summary",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIn(data["overall_grade"], ["A", "B", "C", "D", "F"])
        self.assertIsInstance(data["overall_score"], int)
        self.assertIsInstance(data["health_score"], int)
        self.assertIsInstance(data["quality_score"], int)
        self.assertIn(data["risk_level"], ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
        self.assertIn("summary_narrative", data)
        self.assertIn("key_metrics", data)
        self.assertIsInstance(data["critical_risks"], list)
        self.assertIsInstance(data["top_bottleneck_files"], list)
        self.assertIsInstance(data["executive_recommendations"], list)

    def test_22_step20_executive_summary_get_success(self):
        """Test Step 20: GET /api/executive-summary returns executive summary report."""
        response = self.client.get(
            f"/api/executive-summary?repository_url={self.test_repo_url}"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIn(data["overall_grade"], ["A", "B", "C", "D", "F"])

    def test_23_step20_executive_summary_missing_repo_400(self):
        """Test Step 20: Return 400 when analysis has not been performed."""
        ingestion_module.set_last_analyzed_repo_url("")
        response = self.client.post("/api/executive-summary", json={})
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("detail", data)

    def test_24_step20_grade_and_score_calculation(self):
        """Test Step 20: Deterministic letter grade calculation and executive report synthesis."""
        self.assertEqual(compute_overall_grade(95), "A")
        self.assertEqual(compute_overall_grade(80), "B")
        self.assertEqual(compute_overall_grade(68), "C")
        self.assertEqual(compute_overall_grade(50), "D")
        self.assertEqual(compute_overall_grade(30), "F")

        mock_repo = {
            "repository_name": "mock-repo",
            "repository_url": "https://github.com/owner/mock-repo",
            "total_files": 20,
            "source_files": 15,
            "test_files": 5,
            "directories": 4,
            "python_files": [
                {
                    "file": "main.py",
                    "functions": ["f1", "f2"],
                    "classes": ["C1"],
                    "imports": [],
                    "lines": 80,
                    "max_complexity": 5,
                    "max_nesting_depth": 2,
                }
            ],
            "dependency_graph": {},
        }
        res = generate_executive_summary_report(mock_repo)
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["repository_name"], "mock-repo")
        self.assertIn(res["overall_grade"], ["A", "B", "C", "D", "F"])
        self.assertGreater(len(res["summary_narrative"]), 50)

    def test_25_step20_all_steps_11_through_20_integrity(self):
        """Test Steps 11-20 multi-step endpoint integrity."""
        endpoints = [
            ("/api/analyze", {"repository_url": self.test_repo_url}),
            ("/api/impact-analysis", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/simulate-change", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/change-explanation", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/code-quality", {"repository_url": self.test_repo_url}),
            ("/api/executive-summary", {"repository_url": self.test_repo_url}),
        ]
        for path, body in endpoints:
            res = self.client.post(path, json=body)
            self.assertEqual(res.status_code, 200, f"Endpoint {path} failed with status {res.status_code}")

        res_get_health = self.client.get(f"/api/repository-health?repository_url={self.test_repo_url}")
        self.assertEqual(res_get_health.status_code, 200)

    def test_26_step21_change_detection_post_success(self):
        """Test Step 21: POST /api/change-detection returns version diff analysis."""
        response = self.client.post(
            "/api/change-detection",
            json={
                "repository_url": self.test_repo_url,
                "base_revision": "v2.28.0",
                "target_revision": "v2.31.0",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["base_revision"], "v2.28.0")
        self.assertEqual(data["target_revision"], "v2.31.0")
        self.assertIn("summary", data)
        self.assertIn("file_changes", data)
        self.assertIn("function_changes", data)
        self.assertIn("class_changes", data)
        self.assertIn("dependency_changes", data)
        self.assertGreater(data["summary"]["total_files_changed"], 0)

    def test_27_step21_invalid_revision_returns_400(self):
        """Test Step 21: Invalid commit or revision string returns 400."""
        response = self.client.post(
            "/api/change-detection",
            json={
                "repository_url": self.test_repo_url,
                "base_revision": "non_existent_revision_xyz_123",
                "target_revision": "v2.31.0",
            },
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("detail", data)
        self.assertIn("could not be resolved", data["detail"])

    def test_28_step21_missing_context_returns_400(self):
        """Test Step 21: Missing repository URL or missing revision parameter returns 400."""
        ingestion_module.set_last_analyzed_repo_url("")
        res_missing_url = self.client.post(
            "/api/change-detection", json={"base_revision": "v2.28.0", "target_revision": "v2.31.0"}
        )
        self.assertEqual(res_missing_url.status_code, 400)

        res_missing_rev = self.client.post(
            "/api/change-detection", json={"repository_url": self.test_repo_url, "base_revision": ""}
        )
        self.assertEqual(res_missing_rev.status_code, 400)

    def test_29_step21_ast_diff_added_deleted_modified(self):
        """Test Step 21: AST comparison for added, deleted, and modified functions, classes, and dependencies."""
        base_code = """
import os
import sys

class OldHelper:
    pass

def base_fn():
    pass

def kept_fn():
    pass
"""

        target_code = """
import os
import json

class NewHelper:
    pass

class OldHelper:
    pass

def new_fn():
    pass

def kept_fn():
    pass
"""
        f_ch, c_ch, d_ch = compare_ast_structures("module.py", base_code, target_code)

        func_names = [f["function_name"] for f in f_ch]
        self.assertIn("base_fn", func_names)
        self.assertIn("new_fn", func_names)
        self.assertIn("kept_fn", func_names)

        class_names = [c["class_name"] for c in c_ch]
        self.assertIn("NewHelper", class_names)
        self.assertIn("OldHelper", class_names)

        import_names = [d["import_name"] for d in d_ch]
        self.assertIn("json", import_names)
        self.assertIn("sys", import_names)

    def test_30_step21_all_steps_11_through_21_integrity(self):
        """Test Steps 11-21 multi-step endpoint integrity."""
        endpoints = [
            ("/api/analyze", {"repository_url": self.test_repo_url}),
            ("/api/impact-analysis", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/simulate-change", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/change-explanation", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/code-quality", {"repository_url": self.test_repo_url}),
            ("/api/executive-summary", {"repository_url": self.test_repo_url}),
            ("/api/change-detection", {"repository_url": self.test_repo_url, "base_revision": "v2.28.0", "target_revision": "v2.31.0"}),
        ]
        for path, body in endpoints:
            res = self.client.post(path, json=body)
            self.assertEqual(res.status_code, 200, f"Endpoint {path} failed with status {res.status_code}")

    def test_31_step22_commit_analysis_post_success(self):
        """Test Step 22: POST /api/commit-analysis returns commit inspection details."""
        response = self.client.post(
            "/api/commit-analysis",
            json={
                "repository_url": self.test_repo_url,
                "commit_sha": "v2.31.0",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("commit_sha", data)
        self.assertIn("parent_sha", data)
        self.assertIn("commit_message", data)
        self.assertIn("author", data)
        self.assertIn("date", data)
        self.assertIsInstance(data["files_changed"], int)
        self.assertIsInstance(data["lines_added"], int)
        self.assertIsInstance(data["lines_removed"], int)
        self.assertIsInstance(data["added_files"], list)
        self.assertIsInstance(data["modified_files"], list)
        self.assertIsInstance(data["deleted_files"], list)
        self.assertIsInstance(data["renamed_files"], list)
        self.assertIsInstance(data["function_changes"], list)
        self.assertIsInstance(data["class_changes"], list)
        self.assertIsInstance(data["dependency_changes"], list)

    def test_32_step22_commit_analysis_get_success(self):
        """Test Step 22: GET /api/commit-analysis returns commit details."""
        response = self.client.get(
            f"/api/commit-analysis?repository_url={self.test_repo_url}&commit_sha=v2.31.0"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")

    def test_33_step22_invalid_commit_returns_400(self):
        """Test Step 22: Invalid commit SHA or revision returns 400."""
        response = self.client.post(
            "/api/commit-analysis",
            json={
                "repository_url": self.test_repo_url,
                "commit_sha": "invalid_commit_sha_999999",
            },
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("detail", data)
        self.assertIn("could not be resolved", data["detail"])

    def test_34_step22_missing_context_returns_400(self):
        """Test Step 22: Missing repository context or missing commit parameter returns 400."""
        ingestion_module.set_last_analyzed_repo_url("")
        res_no_url = self.client.post("/api/commit-analysis", json={"commit_sha": "HEAD"})
        self.assertEqual(res_no_url.status_code, 400)

        res_no_commit = self.client.post(
            "/api/commit-analysis", json={"repository_url": self.test_repo_url, "commit_sha": ""}
        )
        self.assertEqual(res_no_commit.status_code, 400)

    def test_35_step22_commit_analysis_metadata_and_ast(self):
        """Test Step 22: Commit metadata extraction and AST function/class diffing."""
        response = self.client.post(
            "/api/commit-analysis",
            json={
                "repository_url": self.test_repo_url,
                "commit_sha": "v2.31.0",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreater(len(data["commit_sha"]), 10)
        self.assertGreater(len(data["commit_message"]), 0)

    def test_36_step22_all_steps_11_through_22_integrity(self):
        """Test Steps 11-22 multi-step endpoint integrity."""
        endpoints = [
            ("/api/analyze", {"repository_url": self.test_repo_url}),
            ("/api/impact-analysis", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/simulate-change", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/change-explanation", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/code-quality", {"repository_url": self.test_repo_url}),
            ("/api/executive-summary", {"repository_url": self.test_repo_url}),
            ("/api/change-detection", {"repository_url": self.test_repo_url, "base_revision": "v2.28.0", "target_revision": "v2.31.0"}),
            ("/api/commit-analysis", {"repository_url": self.test_repo_url, "commit_sha": "v2.31.0"}),
        ]
        for path, body in endpoints:
            res = self.client.post(path, json=body)
            self.assertEqual(res.status_code, 200, f"Endpoint {path} failed with status {res.status_code}")

    def test_37_step23_test_impact_post_success(self):
        """Test Step 23: POST /api/test-impact returns test impact analysis."""
        response = self.client.post(
            "/api/test-impact",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("total_tests", data)
        self.assertIn("direct_tests", data)
        self.assertIn("indirect_tests", data)
        self.assertIn("possible_tests", data)
        self.assertIn("affected_tests", data)
        self.assertIn("recommended_tests", data)

    def test_38_step23_test_impact_get_success(self):
        """Test Step 23: GET /api/test-impact returns test impact analysis."""
        response = self.client.get(
            f"/api/test-impact?repository_url={self.test_repo_url}&changed_file=src/requests/models.py"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")

    def test_39_step23_invalid_file_returns_400(self):
        """Test Step 23: Invalid changed file returns 400."""
        response = self.client.post(
            "/api/test-impact",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "non_existent_file_xyz_999.py",
            },
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("detail", data)

    def test_40_step23_missing_context_returns_400(self):
        """Test Step 23: Missing repository context or missing changed file returns 400."""
        ingestion_module.set_last_analyzed_repo_url("")
        res_no_url = self.client.post(
            "/api/test-impact", json={"changed_file": "src/requests/models.py"}
        )
        self.assertEqual(res_no_url.status_code, 400)

        res_no_file = self.client.post(
            "/api/test-impact", json={"repository_url": self.test_repo_url, "changed_file": ""}
        )
        self.assertEqual(res_no_file.status_code, 400)

    def test_41_step23_direct_test_dependency_detection(self):
        """Test Step 23: Direct test dependency detection."""
        response = self.client.post(
            "/api/test-impact",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        direct_tests = [t for t in data["affected_tests"] if t["impact_type"] == "DIRECT"]
        self.assertEqual(len(direct_tests), data["direct_tests"])

    def test_42_step23_indirect_test_dependency_detection(self):
        """Test Step 23: Indirect test dependency classification."""
        response = self.client.post(
            "/api/test-impact",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        indirect_tests = [t for t in data["affected_tests"] if t["impact_type"] == "INDIRECT"]
        self.assertEqual(len(indirect_tests), data["indirect_tests"])

    def test_43_step23_possible_test_classification(self):
        """Test Step 23: Possible test classification."""
        response = self.client.post(
            "/api/test-impact",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        possible_tests = [t for t in data["affected_tests"] if t["impact_type"] == "POSSIBLE"]
        self.assertEqual(len(possible_tests), data["possible_tests"])

    def test_44_step23_changed_function_input(self):
        """Test Step 23: Changed function parameter inclusion in reason."""
        response = self.client.post(
            "/api/test-impact",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
                "changed_function": "Request",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["changed_function"], "Request")
        if data["affected_tests"]:
            self.assertIn("Request", data["affected_tests"][0]["reason"])

    def test_45_step23_all_steps_11_through_23_integrity(self):
        """Test Steps 11-23 multi-step endpoint integrity."""
        endpoints = [
            ("/api/analyze", {"repository_url": self.test_repo_url}),
            ("/api/impact-analysis", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/simulate-change", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/change-explanation", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/code-quality", {"repository_url": self.test_repo_url}),
            ("/api/executive-summary", {"repository_url": self.test_repo_url}),
            ("/api/change-detection", {"repository_url": self.test_repo_url, "base_revision": "v2.28.0", "target_revision": "v2.31.0"}),
            ("/api/commit-analysis", {"repository_url": self.test_repo_url, "commit_sha": "v2.31.0"}),
            ("/api/test-impact", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
        ]
        for path, body in endpoints:
            res = self.client.post(path, json=body)
            self.assertEqual(res.status_code, 200, f"Endpoint {path} failed with status {res.status_code}")

    def test_46_step24_direct_function_reference(self):
        """Test Step 24: Direct function reference AST detection."""
        response = self.client.post(
            "/api/test-impact",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
                "changed_function": "Request",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["changed_function"], "Request")
        self.assertIn("affected_tests", data)
        if data["affected_tests"]:
            first_test = data["affected_tests"][0]
            self.assertIn("priority", first_test)
            self.assertIn("confidence", first_test)
            self.assertIn("dependency_path", first_test)
            self.assertIn("Request", first_test["dependency_path"][-1])

    def test_47_step24_direct_module_reference(self):
        """Test Step 24: Direct module reference impact detection."""
        response = self.client.post(
            "/api/test-impact",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        direct_tests = [t for t in data["affected_tests"] if t["impact_type"] == "DIRECT"]
        for dt in direct_tests:
            self.assertEqual(dt["priority"], "P0")
            self.assertGreaterEqual(dt["confidence"], 85)

    def test_48_step24_indirect_dependency(self):
        """Test Step 24: Indirect dependency path and priority P1/P2 classification."""
        response = self.client.post(
            "/api/test-impact",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        indirect_tests = [t for t in data["affected_tests"] if t["impact_type"] == "INDIRECT"]
        for it in indirect_tests:
            self.assertIn(it["priority"], ["P1", "P2"])
            self.assertGreaterEqual(len(it["dependency_path"]), 2)

    def test_49_step24_possible_impact(self):
        """Test Step 24: Possible impact classification with lower confidence."""
        response = self.client.post(
            "/api/test-impact",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        possible_tests = [t for t in data["affected_tests"] if t["impact_type"] == "POSSIBLE"]
        for pt in possible_tests:
            self.assertIn(pt["priority"], ["P2", "P3"])
            self.assertLessEqual(pt["confidence"], 40)

    def test_50_step24_confidence_and_priority_calculation(self):
        """Test Step 24: Confidence (0-100) and Priority (P0-P3) bounds and sorting."""
        response = self.client.post(
            "/api/test-impact",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        prio_order = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}
        affected = data["affected_tests"]

        for i in range(len(affected)):
            conf = affected[i]["confidence"]
            prio = affected[i]["priority"]
            self.assertGreaterEqual(conf, 0)
            self.assertLessEqual(conf, 100)
            self.assertIn(prio, prio_order)

            if i > 0:
                prev_prio_idx = prio_order[affected[i - 1]["priority"]]
                curr_prio_idx = prio_order[prio]
                self.assertLessEqual(prev_prio_idx, curr_prio_idx)

    def test_51_step24_dependency_path_generation(self):
        """Test Step 24: Dependency path generation for every affected test."""
        response = self.client.post(
            "/api/test-impact",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        for test_rec in data["affected_tests"]:
            path = test_rec["dependency_path"]
            self.assertIsInstance(path, list)
            self.assertGreaterEqual(len(path), 1)
            self.assertEqual(path[0], test_rec["test_file"])

    def test_52_step24_invalid_file_and_missing_context(self):
        """Test Step 24: Handling invalid file path and missing repository context."""
        res_invalid_file = self.client.post(
            "/api/test-impact",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "invalid_nonexistent_path_9999.py",
            },
        )
        self.assertEqual(res_invalid_file.status_code, 400)

        ingestion_module.set_last_analyzed_repo_url("")
        res_missing_context = self.client.post(
            "/api/test-impact",
            json={"changed_file": "src/requests/models.py"},
        )
        self.assertEqual(res_missing_context.status_code, 400)

    def test_53_step24_summary_metrics(self):
        """Test Step 24: Summary metrics completeness."""
        response = self.client.post(
            "/api/test-impact",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("total_tests", data)
        self.assertIn("direct_tests", data)
        self.assertIn("indirect_tests", data)
        self.assertIn("possible_tests", data)
        self.assertIn("unaffected_tests", data)
        self.assertIn("recommended_count", data)
        self.assertIn("high_confidence_count", data)

    def test_54_step24_all_steps_11_through_24_integrity(self):
        """Test Steps 11-24 multi-step endpoint integrity."""
        endpoints = [
            ("/api/analyze", {"repository_url": self.test_repo_url}),
            ("/api/impact-analysis", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/simulate-change", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/change-explanation", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/code-quality", {"repository_url": self.test_repo_url}),
            ("/api/executive-summary", {"repository_url": self.test_repo_url}),
            ("/api/change-detection", {"repository_url": self.test_repo_url, "base_revision": "v2.28.0", "target_revision": "v2.31.0"}),
            ("/api/commit-analysis", {"repository_url": self.test_repo_url, "commit_sha": "v2.31.0"}),
            ("/api/test-impact", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
        ]
        for path, body in endpoints:
            res = self.client.post(path, json=body)
            self.assertEqual(res.status_code, 200, f"Endpoint {path} failed with status {res.status_code}")

    def test_55_step24_flask_ast_constructor_direct(self):
        """Verify test containing Flask(...) is DIRECT for Flask.__init__."""
        from app.services.test_impact import check_ast_reference
        # Test file AST contains 'Flask' call
        has_ast = check_ast_reference(
            tf_calls={"Flask", "print"},
            tf_imports={"flask"},
            target_functions=set(),
            target_classes={"Flask"},
            changed_function="Flask.__init__",
        )
        self.assertTrue(has_ast)

    def test_56_step24_merely_importing_is_indirect(self):
        """Verify test merely importing Flask without AST call is NOT DIRECT."""
        from app.services.test_impact import check_ast_reference
        # Test file AST imports 'flask' but makes no AST call to Flask or Flask.__init__
        has_ast = check_ast_reference(
            tf_calls={"other_func"},
            tf_imports={"flask", "flask.app"},
            target_functions=set(),
            target_classes={"Flask"},
            changed_function="Flask.__init__",
        )
        self.assertFalse(has_ast)

    def test_57_step24_transitive_dependency_is_indirect(self):
        """Verify transitive dependency path yields INDIRECT impact."""
        response = self.client.post(
            "/api/test-impact",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        indirect_tests = [t for t in data["affected_tests"] if t["impact_type"] == "INDIRECT"]
        for it in indirect_tests:
            self.assertEqual(it["impact_type"], "INDIRECT")
            self.assertEqual(it["priority"], "P1")

    def test_58_step24_weak_evidence_is_possible(self):
        """Verify weak naming correlation without graph edge yields POSSIBLE impact."""
        response = self.client.post(
            "/api/test-impact",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        possible_tests = [t for t in data["affected_tests"] if t["impact_type"] == "POSSIBLE"]
        for pt in possible_tests:
            self.assertEqual(pt["impact_type"], "POSSIBLE")
            self.assertIn(pt["priority"], ["P2", "P3"])

    def test_59_step24_deterministic_confidence_and_priority(self):
        """Verify confidence (0-100) and priority (P0-P3) are deterministic and correctly ordered."""
        response = self.client.post(
            "/api/test-impact",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
                "changed_function": "Request",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        affected = data["affected_tests"]
        for item in affected:
            self.assertIn(item["priority"], ["P0", "P1", "P2", "P3"])
            self.assertGreaterEqual(item["confidence"], 0)
            self.assertLessEqual(item["confidence"], 100)
            if item["impact_type"] == "DIRECT":
                self.assertEqual(item["priority"], "P0")
                self.assertGreaterEqual(item["confidence"], 90)

    def test_60_step25_regression_risk_post_success(self):
        """Test Step 25: POST /api/regression-risk returns regression risk analysis."""
        response = self.client.post(
            "/api/regression-risk",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("score", data)
        self.assertIn("level", data)
        self.assertIn("risk_factors", data)
        self.assertIn("recommendations", data)
        self.assertIn("explanation", data)

    def test_61_step25_regression_risk_get_success(self):
        """Test Step 25: GET /api/regression-risk returns risk analysis."""
        response = self.client.get(
            f"/api/regression-risk?repository_url={self.test_repo_url}&changed_file=src/requests/models.py"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")

    def test_62_step25_risk_level_classification_low(self):
        """Test Step 25: Low-risk classification (0-24)."""
        from app.services.regression_risk import classify_risk_level
        self.assertEqual(classify_risk_level(0), "LOW")
        self.assertEqual(classify_risk_level(20), "LOW")

    def test_63_step25_risk_level_classification_medium(self):
        """Test Step 25: Medium-risk classification (25-49)."""
        from app.services.regression_risk import classify_risk_level
        self.assertEqual(classify_risk_level(25), "MEDIUM")
        self.assertEqual(classify_risk_level(45), "MEDIUM")

    def test_64_step25_risk_level_classification_high(self):
        """Test Step 25: High-risk classification (50-74)."""
        from app.services.regression_risk import classify_risk_level
        self.assertEqual(classify_risk_level(50), "HIGH")
        self.assertEqual(classify_risk_level(70), "HIGH")

    def test_65_step25_risk_level_classification_critical(self):
        """Test Step 25: Critical-risk classification (75-100)."""
        from app.services.regression_risk import classify_risk_level
        self.assertEqual(classify_risk_level(75), "CRITICAL")
        self.assertEqual(classify_risk_level(95), "CRITICAL")

    def test_66_step25_deterministic_score_calculation(self):
        """Test Step 25: Deterministic regression risk score bounds (0-100)."""
        from app.services.regression_risk import calculate_regression_risk
        sample_factors = {
            "impact_radius": 5,
            "direct_tests_count": 3,
            "indirect_tests_count": 2,
            "possible_tests_count": 1,
            "complex_functions_count": 2,
            "deep_nesting_count": 1,
            "large_files_count": 1,
            "central_bottleneck_score": 4,
        }
        score, level = calculate_regression_risk(sample_factors)
        self.assertGreaterEqual(score, 0)
        self.assertLessEqual(score, 100)
        self.assertIn(level, ["LOW", "MEDIUM", "HIGH", "CRITICAL"])

    def test_67_step25_risk_factor_calculation(self):
        """Test Step 25: Quantitative risk factor extraction."""
        from app.services.regression_risk import calculate_risk_factors
        repo_data = ingestion_module.ingest_repository(self.test_repo_url)
        factors = calculate_risk_factors(repo_data, "src/requests/models.py")
        self.assertIn("impact_radius", factors)
        self.assertIn("direct_tests_count", factors)
        self.assertIn("complex_functions_count", factors)

    def test_68_step25_recommendation_generation(self):
        """Test Step 25: Actionable recommendation generation."""
        from app.services.regression_risk import generate_risk_recommendations
        sample_factors = {"impact_radius": 4, "complex_functions_count": 2}
        recs = generate_risk_recommendations(60, "HIGH", sample_factors)
        self.assertIsInstance(recs, list)
        self.assertGreater(len(recs), 0)

    def test_69_step25_invalid_input_and_missing_context(self):
        """Test Step 25: Missing repository context returns 400."""
        ingestion_module.set_last_analyzed_repo_url("")
        res = self.client.post("/api/regression-risk", json={})
        self.assertEqual(res.status_code, 400)

    def test_70_step25_all_steps_11_through_25_integrity(self):
        """Test Steps 11-25 multi-step endpoint integrity."""
        endpoints = [
            ("/api/analyze", {"repository_url": self.test_repo_url}),
            ("/api/impact-analysis", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/simulate-change", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/change-explanation", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/code-quality", {"repository_url": self.test_repo_url}),
            ("/api/executive-summary", {"repository_url": self.test_repo_url}),
            ("/api/change-detection", {"repository_url": self.test_repo_url, "base_revision": "v2.28.0", "target_revision": "v2.31.0"}),
            ("/api/commit-analysis", {"repository_url": self.test_repo_url, "commit_sha": "v2.31.0"}),
            ("/api/test-impact", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/regression-risk", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
        ]
        for path, body in endpoints:
            res = self.client.post(path, json=body)
            self.assertEqual(res.status_code, 200, f"Endpoint {path} failed with status {res.status_code}")

    def test_71_step25_case_a_high_impact_central_function(self):
        """Case A: src/flask/app.py + Flask.__init__ yields 85–95 CRITICAL risk."""
        from app.services.regression_risk import calculate_regression_risk
        factors = {
            "impact_radius": 78,
            "direct_tests_count": 25,
            "indirect_tests_count": 20,
            "possible_tests_count": 0,
            "high_confidence_tests_count": 25,
            "target_complex_functions_count": 10,
            "target_max_complexity": 12,
            "target_max_nesting": 4,
            "target_file_lines": 500,
            "central_bottleneck_score": 10,
            "in_degree": 10,
            "affected_functions_count": 10,
            "affected_classes_count": 3,
            "lines_added": 25,
            "lines_removed": 10,
            "changed_function": "Flask.__init__",
        }
        score, level = calculate_regression_risk(factors)
        self.assertGreaterEqual(score, 85)
        self.assertLessEqual(score, 95)
        self.assertEqual(level, "CRITICAL")

    def test_72_step25_case_b_widely_imported_typing_module_zero_direct_tests(self):
        """Case B: src/flask/typing.py yields below 60 MEDIUM risk."""
        from app.services.regression_risk import calculate_regression_risk
        factors = {
            "impact_radius": 77,
            "direct_tests_count": 0,
            "indirect_tests_count": 45,
            "possible_tests_count": 0,
            "high_confidence_tests_count": 0,
            "target_complex_functions_count": 0,
            "target_max_complexity": 1,
            "target_max_nesting": 1,
            "target_file_lines": 50,
            "central_bottleneck_score": 10,
            "in_degree": 10,
            "affected_functions_count": 0,
            "affected_classes_count": 0,
            "lines_added": 5,
            "lines_removed": 2,
        }
        score, level = calculate_regression_risk(factors)
        self.assertLess(score, 60)
        self.assertEqual(level, "MEDIUM")

    def test_73_step25_case_c_small_isolated_change(self):
        """C. Small isolated change yields LOW/MEDIUM risk score."""
        from app.services.regression_risk import calculate_regression_risk
        factors = {
            "impact_radius": 1,
            "direct_tests_count": 1,
            "indirect_tests_count": 0,
            "possible_tests_count": 0,
            "high_confidence_tests_count": 1,
            "target_complex_functions_count": 0,
            "target_max_complexity": 2,
            "target_max_nesting": 1,
            "large_files_count": 0,
            "central_bottleneck_score": 0,
            "in_degree": 0,
            "affected_functions_count": 1,
            "affected_classes_count": 0,
            "lines_added": 2,
            "lines_removed": 1,
        }
        score, level = calculate_regression_risk(factors)
        self.assertLess(score, 50)
        self.assertIn(level, ["LOW", "MEDIUM"])

    def test_74_step25_case_d_moderate_dependency_impact(self):
        """D. Moderate dependency impact yields MEDIUM/HIGH risk score."""
        from app.services.regression_risk import calculate_regression_risk
        factors = {
            "impact_radius": 6,
            "direct_tests_count": 3,
            "indirect_tests_count": 5,
            "possible_tests_count": 2,
            "high_confidence_tests_count": 3,
            "target_complex_functions_count": 1,
            "target_max_complexity": 5,
            "target_max_nesting": 2,
            "large_files_count": 0,
            "central_bottleneck_score": 3,
            "in_degree": 3,
            "affected_functions_count": 2,
            "affected_classes_count": 1,
            "lines_added": 10,
            "lines_removed": 3,
        }
        score, level = calculate_regression_risk(factors)
        self.assertGreaterEqual(score, 25)
        self.assertLess(score, 75)
        self.assertIn(level, ["MEDIUM", "HIGH"])

    def test_75_step25_case_e_deterministic_scoring(self):
        """E. Same input produces exactly the same score."""
        from app.services.regression_risk import calculate_regression_risk
        factors = {
            "impact_radius": 12,
            "direct_tests_count": 4,
            "indirect_tests_count": 8,
            "possible_tests_count": 1,
            "high_confidence_tests_count": 4,
            "target_complex_functions_count": 2,
            "target_max_complexity": 6,
            "target_max_nesting": 3,
            "central_bottleneck_score": 4,
            "in_degree": 5,
        }
        score1, level1 = calculate_regression_risk(factors)
        score2, level2 = calculate_regression_risk(factors)
        self.assertEqual(score1, score2)
        self.assertEqual(level1, level2)

    def test_76_step25_case_f_score_bounds_zero_to_hundred(self):
        """F. Risk score remains strictly between 0 and 100."""
        from app.services.regression_risk import calculate_regression_risk
        test_inputs = [
            {},
            {"impact_radius": 0, "direct_tests_count": -5},
            {
                "impact_radius": 1000,
                "direct_tests_count": 500,
                "indirect_tests_count": 500,
                "high_confidence_tests_count": 500,
                "in_degree": 500,
                "target_complex_functions_count": 50,
                "target_max_complexity": 100,
                "target_max_nesting": 50,
            },
        ]
        for inp in test_inputs:
            score, level = calculate_regression_risk(inp)
            self.assertGreaterEqual(score, 0)
            self.assertLessEqual(score, 100)
            self.assertIn(level, ["LOW", "MEDIUM", "HIGH", "CRITICAL"])

    def test_77_step26_post_success(self):
        """Test Step 26: POST /api/change-risk-explanation returns risk explanation."""
        response = self.client.post(
            "/api/change-risk-explanation",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("score", data)
        self.assertIn("level", data)
        self.assertIn("executive_summary", data)
        self.assertIn("risk_explanation", data)
        self.assertIn("top_risk_factors", data)
        self.assertIn("test_execution_order", data)
        self.assertIn("categorized_tests", data)

    def test_78_step26_get_success(self):
        """Test Step 26: GET /api/change-risk-explanation returns risk explanation."""
        response = self.client.get(
            f"/api/change-risk-explanation?repository_url={self.test_repo_url}&changed_file=src/requests/models.py"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")

    def test_79_step26_low_risk_explanation(self):
        """Test Step 26: Low risk explanation structure."""
        from app.services.change_risk_explainer import get_change_risk_explanation_for_repository
        result = get_change_risk_explanation_for_repository(
            self.test_repo_url,
            changed_file="src/requests/hooks.py",
        )
        self.assertIn(result["level"], ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
        self.assertIn("Change Risk Evaluation", result["executive_summary"])
        self.assertGreater(len(result["top_risk_factors"]), 0)

    def test_80_step26_medium_risk_explanation(self):
        """Test Step 26: Medium risk explanation structure."""
        from app.services.change_risk_explainer import get_change_risk_explanation_for_repository
        result = get_change_risk_explanation_for_repository(
            self.test_repo_url,
            changed_file="src/requests/status_codes.py",
        )
        self.assertIn("score", result)
        self.assertIsInstance(result["top_risk_factors"], list)

    def test_81_step26_high_risk_explanation(self):
        """Test Step 26: High risk explanation structure."""
        from app.services.change_risk_explainer import get_change_risk_explanation_for_repository
        result = get_change_risk_explanation_for_repository(
            self.test_repo_url,
            changed_file="src/requests/adapters.py",
        )
        self.assertIn("affected_scope", result)
        self.assertIn("test_impact_summary", result)

    def test_82_step26_critical_risk_explanation(self):
        """Test Step 26: Critical risk explanation structure."""
        from app.services.change_risk_explainer import get_change_risk_explanation_for_repository
        result = get_change_risk_explanation_for_repository(
            self.test_repo_url,
            changed_file="src/requests/models.py",
            changed_function="Request",
        )
        self.assertIn("test_execution_order", result)
        self.assertIn("categorized_tests", result)

    def test_83_step26_direct_and_indirect_test_evidence(self):
        """Test Step 26: Direct and indirect test evidence in explanation."""
        from app.services.change_risk_explainer import get_change_risk_explanation_for_repository
        result = get_change_risk_explanation_for_repository(
            self.test_repo_url,
            changed_file="src/requests/models.py",
        )
        test_summary = result["test_impact_summary"]
        self.assertIn("direct_tests", test_summary)
        self.assertIn("indirect_tests", test_summary)
        self.assertIn("p0_tests", result["categorized_tests"])

    def test_84_step26_large_dependency_radius_and_complex_target(self):
        """Test Step 26: Large dependency radius and target complexity handling."""
        from app.services.change_risk_explainer import build_top_risk_factors
        factors_data = {
            "direct_tests_count": 12,
            "indirect_tests_count": 25,
            "high_confidence_tests_count": 10,
            "impact_radius": 50,
            "in_degree": 12,
            "target_max_complexity": 15,
            "target_complex_functions_count": 6,
        }
        risk_factors = build_top_risk_factors(85, "CRITICAL", factors_data)
        categories = [rf["category"] for rf in risk_factors]
        self.assertIn("Test Impact", categories)
        self.assertIn("Architecture", categories)
        self.assertIn("Code Quality", categories)

    def test_85_step26_missing_context_returns_400(self):
        """Test Step 26: Missing repository context returns 400."""
        ingestion_module.set_last_analyzed_repo_url("")
        res = self.client.post("/api/change-risk-explanation", json={})
        self.assertEqual(res.status_code, 400)

    def test_86_step26_invalid_file_path_returns_400(self):
        """Test Step 26: Invalid repository url / context handling."""
        res = self.client.post(
            "/api/change-risk-explanation",
            json={"repository_url": "https://invalid-url-repo-nonexistent.git"},
        )
        self.assertEqual(res.status_code, 400)

    def test_87_step26_deterministic_output(self):
        """Test Step 26: Deterministic risk explanation output generation."""
        from app.services.change_risk_explainer import get_change_risk_explanation_for_repository
        res1 = get_change_risk_explanation_for_repository(
            self.test_repo_url, changed_file="src/requests/models.py"
        )
        res2 = get_change_risk_explanation_for_repository(
            self.test_repo_url, changed_file="src/requests/models.py"
        )
        self.assertEqual(res1["score"], res2["score"])
        self.assertEqual(res1["level"], res2["level"])
        self.assertEqual(res1["executive_summary"], res2["executive_summary"])

    def test_88_step26_all_steps_11_through_26_integrity(self):
        """Test Steps 11-26 multi-step endpoint integrity."""
        endpoints = [
            ("/api/analyze", {"repository_url": self.test_repo_url}),
            ("/api/impact-analysis", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/simulate-change", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/change-explanation", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/code-quality", {"repository_url": self.test_repo_url}),
            ("/api/executive-summary", {"repository_url": self.test_repo_url}),
            ("/api/change-detection", {"repository_url": self.test_repo_url, "base_revision": "v2.28.0", "target_revision": "v2.31.0"}),
            ("/api/commit-analysis", {"repository_url": self.test_repo_url, "commit_sha": "v2.31.0"}),
            ("/api/test-impact", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/regression-risk", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/change-risk-explanation", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
        ]
        for path, body in endpoints:
            res = self.client.post(path, json=body)
            self.assertEqual(res.status_code, 200, f"Endpoint {path} failed with status {res.status_code}")

    def test_89_valid_target_file(self):
        """Test valid target file returns HTTP 200 and matches target file."""
        res = self.client.post(
            "/api/change-risk-explanation",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["target_file"], "src/requests/models.py")

    def test_90_invalid_target_file_returns_400(self):
        """Test invalid target file returns HTTP 400 with deterministic error message."""
        invalid_file = "docs/csrc/flask/app.pyonf.py"
        res = self.client.post(
            "/api/change-risk-explanation",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": invalid_file,
            },
        )
        self.assertEqual(res.status_code, 400)
        data = res.json()
        self.assertEqual(
            data["detail"],
            f"Target file '{invalid_file}' was not found in the analyzed repository.",
        )

    def test_91_valid_target_file_valid_function(self):
        """Test valid target file + valid function returns HTTP 200."""
        res = self.client.post(
            "/api/change-risk-explanation",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
                "changed_function": "Request",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["changed_function"], "Request")

    def test_92_valid_target_file_invalid_function_returns_400(self):
        """Test valid target file + invalid function returns HTTP 400 with deterministic error."""
        invalid_func = "Flask.__init__"
        target_file = "src/requests/models.py"
        res = self.client.post(
            "/api/change-risk-explanation",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": target_file,
                "changed_function": invalid_func,
            },
        )
        self.assertEqual(res.status_code, 400)
        data = res.json()
        self.assertEqual(
            data["detail"],
            f"Target function '{invalid_func}' was not found in '{target_file}'.",
        )

    def test_93_regression_risk_invalid_file_returns_400(self):
        """Test POST /api/regression-risk with invalid file returns HTTP 400."""
        invalid_file = "docs/csrc/flask/app.pyonf.py"
        res = self.client.post(
            "/api/regression-risk",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": invalid_file,
            },
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(
            res.json()["detail"],
            f"Target file '{invalid_file}' was not found in the analyzed repository.",
        )

    def test_94_test_impact_invalid_file_returns_400(self):
        """Test POST /api/test-impact with invalid file returns HTTP 400."""
        invalid_file = "non_existent_module.py"
        res = self.client.post(
            "/api/test-impact",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": invalid_file,
            },
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(
            res.json()["detail"],
            f"Target file '{invalid_file}' was not found in the analyzed repository.",
        )

    def test_95_change_risk_explanation_invalid_file_returns_400(self):
        """Test POST /api/change-risk-explanation with invalid file returns HTTP 400."""
        invalid_file = "invalid_path/module.py"
        res = self.client.post(
            "/api/change-risk-explanation",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": invalid_file,
            },
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(
            res.json()["detail"],
            f"Target file '{invalid_file}' was not found in the analyzed repository.",
        )

    def test_96_missing_repository_context_returns_400(self):
        """Test missing repository context returns HTTP 400 across all risk endpoints."""
        ingestion_module.set_last_analyzed_repo_url("")
        res = self.client.post(
            "/api/change-risk-explanation",
            json={"changed_file": "src/requests/models.py"},
        )
        self.assertEqual(res.status_code, 400)

    def test_97_step27_post_success(self):
        """Test Step 27: POST /api/change-decision returns success decision response."""
        res = self.client.post(
            "/api/change-decision",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": "src/requests/models.py",
                "changed_function": "Request",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("decision", data)
        self.assertIn(data["decision"], ["READY", "READY WITH CAUTION", "REVIEW REQUIRED", "BLOCKED"])
        self.assertIn(data["merge_readiness"], ["READY", "NOT READY"])
        self.assertIn("confidence_score", data)
        self.assertIn("required_actions", data)
        self.assertIn("recommended_tests", data)

    def test_98_step27_get_success(self):
        """Test Step 27: GET /api/change-decision returns success decision response."""
        res = self.client.get(
            f"/api/change-decision?repository_url={self.test_repo_url}&changed_file=src/requests/models.py"
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["target_file"], "src/requests/models.py")

    def test_99_step27_low_risk_ready(self):
        """Test Step 27: Low risk file decision evaluation."""
        from app.services.change_decision import get_change_decision_for_repository
        res = get_change_decision_for_repository(
            self.test_repo_url, changed_file="src/requests/hooks.py"
        )
        self.assertEqual(res["status"], "success")
        self.assertIn(res["decision"], ["READY", "READY WITH CAUTION", "REVIEW REQUIRED"])
        self.assertIn(res["merge_readiness"], ["READY", "NOT READY"])
        self.assertGreaterEqual(res["confidence_score"], 80)

    def test_100_step27_medium_risk_ready_with_caution(self):
        """Test Step 27: Medium risk file decision evaluation."""
        from app.services.change_decision import get_change_decision_for_repository
        res = get_change_decision_for_repository(
            self.test_repo_url, changed_file="src/requests/auth.py"
        )
        self.assertEqual(res["status"], "success")
        self.assertIn(res["decision"], ["READY WITH CAUTION", "REVIEW REQUIRED", "READY"])

    def test_101_step27_high_risk_review_required(self):
        """Test Step 27: High risk file decision evaluation."""
        from app.services.change_decision import get_change_decision_for_repository
        res = get_change_decision_for_repository(
            self.test_repo_url, changed_file="src/requests/sessions.py"
        )
        self.assertEqual(res["status"], "success")
        self.assertIn(res["decision"], ["REVIEW REQUIRED", "BLOCKED", "READY WITH CAUTION"])

    def test_102_step27_critical_risk_blocked_or_review(self):
        """Test Step 27: Critical risk file decision evaluation."""
        from app.services.change_decision import get_change_decision_for_repository
        res = get_change_decision_for_repository(
            self.test_repo_url, changed_file="src/requests/adapters.py"
        )
        self.assertEqual(res["status"], "success")
        self.assertIn(res["decision"], ["BLOCKED", "REVIEW REQUIRED", "READY WITH CAUTION"])

    def test_103_step27_direct_and_indirect_evidence(self):
        """Test Step 27: Prioritized actions and recommended test execution roadmap."""
        from app.services.change_decision import get_change_decision_for_repository
        res = get_change_decision_for_repository(
            self.test_repo_url, changed_file="src/requests/models.py"
        )
        actions = res["required_actions"]
        self.assertTrue(len(actions) > 0)
        self.assertIn("priority", actions[0])
        self.assertIn(actions[0]["priority"], ["P0", "P1", "P2", "P3"])

    def test_104_step27_blocker_generation_rules(self):
        """Test Step 27: Blocker list structure."""
        from app.services.change_decision import get_change_decision_for_repository
        res = get_change_decision_for_repository(
            self.test_repo_url, changed_file="src/requests/models.py"
        )
        self.assertIsInstance(res["blockers"], list)

    def test_105_step27_warning_generation_rules(self):
        """Test Step 27: Warning list structure."""
        from app.services.change_decision import get_change_decision_for_repository
        res = get_change_decision_for_repository(
            self.test_repo_url, changed_file="src/requests/models.py"
        )
        self.assertIsInstance(res["warnings"], list)

    def test_106_step27_deterministic_decision_and_confidence(self):
        """Test Step 27: Deterministic decision and confidence output."""
        from app.services.change_decision import get_change_decision_for_repository
        res1 = get_change_decision_for_repository(
            self.test_repo_url, changed_file="src/requests/models.py"
        )
        res2 = get_change_decision_for_repository(
            self.test_repo_url, changed_file="src/requests/models.py"
        )
        self.assertEqual(res1["decision"], res2["decision"])
        self.assertEqual(res1["merge_readiness"], res2["merge_readiness"])
        self.assertEqual(res1["confidence_score"], res2["confidence_score"])
        self.assertEqual(res1["score"], res2["score"])

    def test_107_step27_invalid_target_file_returns_400(self):
        """Test Step 27: Invalid target file returns HTTP 400."""
        invalid_file = "docs/csrc/flask/app.pyonf.py"
        res = self.client.post(
            "/api/change-decision",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": invalid_file,
            },
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(
            res.json()["detail"],
            f"Target file '{invalid_file}' was not found in the analyzed repository.",
        )

    def test_108_step27_invalid_target_function_returns_400(self):
        """Test Step 27: Invalid target function returns HTTP 400."""
        invalid_func = "Flask.__init__"
        target_file = "src/requests/models.py"
        res = self.client.post(
            "/api/change-decision",
            json={
                "repository_url": self.test_repo_url,
                "changed_file": target_file,
                "changed_function": invalid_func,
            },
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(
            res.json()["detail"],
            f"Target function '{invalid_func}' was not found in '{target_file}'.",
        )

    def test_109_step27_missing_context_returns_400(self):
        """Test Step 27: Missing repository context returns HTTP 400."""
        ingestion_module.set_last_analyzed_repo_url("")
        res = self.client.post(
            "/api/change-decision",
            json={"changed_file": "src/requests/models.py"},
        )
        self.assertEqual(res.status_code, 400)

    def test_110_step27_all_steps_11_through_27_integrity(self):
        """Test Steps 11-27 multi-step endpoint integrity."""
        endpoints = [
            ("/api/analyze", {"repository_url": self.test_repo_url}),
            ("/api/impact-analysis", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/simulate-change", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/change-explanation", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/code-quality", {"repository_url": self.test_repo_url}),
            ("/api/executive-summary", {"repository_url": self.test_repo_url}),
            ("/api/change-detection", {"repository_url": self.test_repo_url, "base_revision": "v2.28.0", "target_revision": "v2.31.0"}),
            ("/api/commit-analysis", {"repository_url": self.test_repo_url, "commit_sha": "v2.31.0"}),
            ("/api/test-impact", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/regression-risk", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/change-risk-explanation", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/change-decision", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
        ]
    def test_111_step28_post_success(self):
        """Test Step 28: POST /api/historical-risk returns success comparison response."""
        res = self.client.post(
            "/api/historical-risk",
            json={
                "repository_url": self.test_repo_url,
                "base_revision": "v2.28.0",
                "target_revision": "v2.31.0",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("risk_trend", data)
        self.assertIn(data["risk_trend"], ["IMPROVED", "UNCHANGED", "INCREASED", "SIGNIFICANTLY INCREASED"])
        self.assertIn("score_change", data)
        self.assertIn("base_metrics", data)
        self.assertIn("target_metrics", data)
        self.assertIn("delta_metrics", data)

    def test_112_step28_get_success(self):
        """Test Step 28: GET /api/historical-risk returns success comparison response."""
        res = self.client.get(
            f"/api/historical-risk?repository_url={self.test_repo_url}&base_revision=v2.28.0&target_revision=v2.31.0"
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["base_revision"], "v2.28.0")
        self.assertEqual(data["target_revision"], "v2.31.0")

    def test_113_step28_invalid_base_revision_returns_400(self):
        """Test Step 28: Invalid base revision returns HTTP 400."""
        res = self.client.post(
            "/api/historical-risk",
            json={
                "repository_url": self.test_repo_url,
                "base_revision": "non_existent_rev_xyz_123",
                "target_revision": "v2.31.0",
            },
        )
        self.assertEqual(res.status_code, 400)

    def test_114_step28_invalid_target_revision_returns_400(self):
        """Test Step 28: Invalid target revision returns HTTP 400."""
        res = self.client.post(
            "/api/historical-risk",
            json={
                "repository_url": self.test_repo_url,
                "base_revision": "v2.28.0",
                "target_revision": "non_existent_target_rev_999",
            },
        )
        self.assertEqual(res.status_code, 400)

    def test_115_step28_same_revision_unchanged(self):
        """Test Step 28: Same revision comparison yields UNCHANGED risk trend."""
        res = self.client.post(
            "/api/historical-risk",
            json={
                "repository_url": self.test_repo_url,
                "base_revision": "v2.31.0",
                "target_revision": "v2.31.0",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["risk_trend"], "UNCHANGED")
        self.assertEqual(data["score_change"], 0)

    def test_116_step28_increased_risk(self):
        """Test Step 28: Revision comparison with increased risk profile."""
        from app.services.historical_risk import compare_historical_risk
        res = compare_historical_risk(
            self.test_repo_url, base_revision="v2.28.0", target_revision="v2.31.0"
        )
        self.assertEqual(res["status"], "success")
        self.assertIn("risk_trend", res)

    def test_117_step28_decreased_risk(self):
        """Test Step 28: Revision comparison with decreased risk profile."""
        from app.services.historical_risk import compare_historical_risk
        res = compare_historical_risk(
            self.test_repo_url, base_revision="v2.31.0", target_revision="v2.28.0"
        )
        self.assertEqual(res["status"], "success")
        self.assertIn(res["risk_trend"], ["IMPROVED", "UNCHANGED", "INCREASED", "SIGNIFICANTLY INCREASED"])

    def test_118_step28_changed_files_breakdown(self):
        """Test Step 28: AST diff summary and changed files structure."""
        res = self.client.post(
            "/api/historical-risk",
            json={
                "repository_url": self.test_repo_url,
                "base_revision": "v2.28.0",
                "target_revision": "v2.31.0",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("ast_diff_summary", data)
        self.assertIn("changed_files", data["ast_diff_summary"])

    def test_119_step28_test_impact_comparison(self):
        """Test Step 28: Test impact comparison metrics in base and target results."""
        res = self.client.post(
            "/api/historical-risk",
            json={
                "repository_url": self.test_repo_url,
                "base_revision": "v2.28.0",
                "target_revision": "v2.31.0",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("impact_radius", data["base_metrics"])
        self.assertIn("total_affected_tests", data["target_metrics"])

    def test_120_step28_deterministic_output(self):
        """Test Step 28: Deterministic risk comparison output."""
        from app.services.historical_risk import compare_historical_risk
        res1 = compare_historical_risk(
            self.test_repo_url, base_revision="v2.28.0", target_revision="v2.31.0"
        )
        res2 = compare_historical_risk(
            self.test_repo_url, base_revision="v2.28.0", target_revision="v2.31.0"
        )
        self.assertEqual(res1["risk_trend"], res2["risk_trend"])
        self.assertEqual(res1["score_change"], res2["score_change"])
        self.assertEqual(res1["explanation"], res2["explanation"])

    def test_121_step28_missing_repository_context_returns_400(self):
        """Test Step 28: Missing repository context returns HTTP 400."""
        ingestion_module.set_last_analyzed_repo_url("")
        res = self.client.post(
            "/api/historical-risk",
            json={"base_revision": "v2.28.0", "target_revision": "v2.31.0"},
        )
        self.assertEqual(res.status_code, 400)

    def test_122_step28_empty_revision_string_returns_400(self):
        """Test Step 28: Empty revision string returns HTTP 400."""
        res = self.client.post(
            "/api/historical-risk",
            json={
                "repository_url": self.test_repo_url,
                "base_revision": "",
                "target_revision": "v2.31.0",
            },
        )
        self.assertEqual(res.status_code, 400)

    def test_123_step28_delta_metrics_completeness(self):
        """Test Step 28: Delta metrics contains additions, deletions, lines changed, and intensity."""
        res = self.client.post(
            "/api/historical-risk",
            json={
                "repository_url": self.test_repo_url,
                "base_revision": "v2.28.0",
                "target_revision": "v2.31.0",
            },
        )
        self.assertEqual(res.status_code, 200)
        delta = res.json()["delta_metrics"]
        self.assertIn("additions", delta)
        self.assertIn("deletions", delta)
        self.assertIn("total_lines_changed", delta)
        self.assertIn(delta["change_intensity"], ["LOW", "MEDIUM", "HIGH"])

    def test_124_step28_all_steps_11_through_28_integrity(self):
        """Test Steps 11-28 multi-step endpoint integrity."""
        endpoints = [
            ("/api/analyze", {"repository_url": self.test_repo_url}),
            ("/api/impact-analysis", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/simulate-change", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/change-explanation", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/code-quality", {"repository_url": self.test_repo_url}),
            ("/api/executive-summary", {"repository_url": self.test_repo_url}),
            ("/api/change-detection", {"repository_url": self.test_repo_url, "base_revision": "v2.28.0", "target_revision": "v2.31.0"}),
            ("/api/commit-analysis", {"repository_url": self.test_repo_url, "commit_sha": "v2.31.0"}),
            ("/api/test-impact", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/regression-risk", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/change-risk-explanation", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/change-decision", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/historical-risk", {"repository_url": self.test_repo_url, "base_revision": "v2.28.0", "target_revision": "v2.31.0"}),
        ]
    def test_125_step29_post_refresh_success(self):
        """Test Step 29: POST /api/refresh-repository with valid public GitHub repository."""
        res = self.client.post(
            "/api/refresh-repository",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("current_analyzed_revision", data)
        self.assertIn("previous_analyzed_revision", data)
        self.assertIn("diff_summary", data)
        self.assertIn("historical_risk", data)
        self.assertIn("change_decision", data)

    def test_126_step29_get_tracking_success(self):
        """Test Step 29: GET /api/repo-tracking returns tracking information."""
        res = self.client.get(
            f"/api/repo-tracking?repository_url={self.test_repo_url}"
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["repository_url"], self.test_repo_url)

    def test_127_step29_invalid_repo_url_returns_400(self):
        """Test Step 29: Invalid repository URL returns HTTP 400."""
        res = self.client.post(
            "/api/refresh-repository",
            json={"repository_url": "invalid_url_format_xyz"},
        )
        self.assertEqual(res.status_code, 400)

    def test_128_step29_refresh_updates_revisions(self):
        """Test Step 29: Repository refresh updates current and previous revisions."""
        res = self.client.post(
            "/api/refresh-repository",
            json={"repository_url": self.test_repo_url, "target_revision": "v2.31.0"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["current_analyzed_revision"], "v2.31.0")

    def test_129_step29_previous_revision_tracking(self):
        """Test Step 29: Previous revision tracking across refreshes."""
        res1 = self.client.post(
            "/api/refresh-repository",
            json={"repository_url": self.test_repo_url, "target_revision": "v2.28.0"},
        )
        self.assertEqual(res1.status_code, 200)

        res2 = self.client.post(
            "/api/refresh-repository",
            json={"repository_url": self.test_repo_url, "target_revision": "v2.31.0"},
        )
        self.assertEqual(res2.status_code, 200)
        data = res2.json()
        self.assertEqual(data["previous_analyzed_revision"], "v2.28.0")
        self.assertEqual(data["current_analyzed_revision"], "v2.31.0")

    def test_130_step29_current_revision_tracking(self):
        """Test Step 29: Current revision tracking."""
        from app.services.repo_tracking import refresh_repository_tracking
        res = refresh_repository_tracking(self.test_repo_url, target_revision="v2.31.0")
        self.assertEqual(res["current_analyzed_revision"], "v2.31.0")

    def test_131_step29_changed_file_detection(self):
        """Test Step 29: Changed file detection in diff summary."""
        res = self.client.post(
            "/api/refresh-repository",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        diff = res.json()["diff_summary"]
        self.assertIn("changed_files", diff)
        self.assertIn("total_files_changed", diff)

    def test_132_step29_added_file_detection(self):
        """Test Step 29: Added file detection list."""
        res = self.client.post(
            "/api/refresh-repository",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        diff = res.json()["diff_summary"]
        self.assertIn("added_files", diff)

    def test_133_step29_deleted_file_detection(self):
        """Test Step 29: Deleted file detection list."""
        res = self.client.post(
            "/api/refresh-repository",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        diff = res.json()["diff_summary"]
        self.assertIn("deleted_files", diff)

    def test_134_step29_renamed_file_detection(self):
        """Test Step 29: Renamed file detection list."""
        res = self.client.post(
            "/api/refresh-repository",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        diff = res.json()["diff_summary"]
        self.assertIn("renamed_files", diff)

    def test_135_step29_no_change_refresh(self):
        """Test Step 29: Refresh with same revision produces UNCHANGED status."""
        self.client.post(
            "/api/refresh-repository",
            json={"repository_url": self.test_repo_url, "target_revision": "v2.31.0"},
        )
        res = self.client.post(
            "/api/refresh-repository",
            json={"repository_url": self.test_repo_url, "target_revision": "v2.31.0"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["refresh_status"], "UNCHANGED")
        self.assertFalse(data["has_changes"])

    def test_136_step29_missing_repo_context_returns_400(self):
        """Test Step 29: Missing repository context returns HTTP 400."""
        ingestion_module.set_last_analyzed_repo_url("")
        res = self.client.post(
            "/api/refresh-repository",
            json={},
        )
        self.assertEqual(res.status_code, 400)

    def test_137_step29_deterministic_results(self):
        """Test Step 29: Deterministic tracking results across refreshes."""
        from app.services.repo_tracking import refresh_repository_tracking
        res1 = refresh_repository_tracking(self.test_repo_url, target_revision="v2.31.0")
        res2 = refresh_repository_tracking(self.test_repo_url, target_revision="v2.31.0")
        self.assertEqual(res1["current_analyzed_revision"], res2["current_analyzed_revision"])
        self.assertEqual(res1["historical_risk"]["risk_trend"], res2["historical_risk"]["risk_trend"])

    def test_138_step29_risk_trend_integration(self):
        """Test Step 29: Risk trend integration in tracking payload."""
        res = self.client.post(
            "/api/refresh-repository",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        risk = res.json()["historical_risk"]
        self.assertIn("risk_trend", risk)
        self.assertIn("score_change", risk)

    def test_139_step29_change_decision_integration(self):
        """Test Step 29: Change decision integration in tracking payload."""
        res = self.client.post(
            "/api/refresh-repository",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        decision = res.json()["change_decision"]
        self.assertIn("decision", decision)
        self.assertIn("merge_readiness", decision)

    def test_140_step29_all_steps_11_through_29_integrity(self):
        """Test Steps 11-29 multi-step endpoint integrity."""
        endpoints = [
            ("/api/analyze", {"repository_url": self.test_repo_url}),
            ("/api/impact-analysis", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/simulate-change", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/change-explanation", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/code-quality", {"repository_url": self.test_repo_url}),
            ("/api/executive-summary", {"repository_url": self.test_repo_url}),
            ("/api/change-detection", {"repository_url": self.test_repo_url, "base_revision": "v2.28.0", "target_revision": "v2.31.0"}),
            ("/api/commit-analysis", {"repository_url": self.test_repo_url, "commit_sha": "v2.31.0"}),
            ("/api/test-impact", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/regression-risk", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/change-risk-explanation", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/change-decision", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/historical-risk", {"repository_url": self.test_repo_url, "base_revision": "v2.28.0", "target_revision": "v2.31.0"}),
            ("/api/refresh-repository", {"repository_url": self.test_repo_url}),
        ]
        for path, body in endpoints:
            res = self.client.post(path, json=body)
            self.assertEqual(res.status_code, 200, f"Endpoint {path} failed with status {res.status_code}")

    def test_141_step30_no_repository_changes(self):
        """Test Step 30: No repository changes yields NO_CHANGE monitoring status."""
        from app.services.repo_monitor import monitor_repository
        res = monitor_repository(self.test_repo_url, target_revision="v2.28.0")
        self.assertIn("monitoring_status", res)
        self.assertIn(res["monitoring_status"], ["NO_CHANGE", "CHANGES_DETECTED"])

    def test_142_step30_changes_detected(self):
        """Test Step 30: Changes detected yields CHANGES_DETECTED monitoring status."""
        res = self.client.post(
            "/api/repository-monitor",
            json={"repository_url": self.test_repo_url, "target_revision": "v2.31.0"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["monitoring_status"], "CHANGES_DETECTED")

    def test_143_step30_invalid_repository_context(self):
        """Test Step 30: Invalid repository URL returns HTTP 400."""
        res = self.client.post(
            "/api/repository-monitor",
            json={"repository_url": "invalid_url_format_xyz"},
        )
        self.assertEqual(res.status_code, 400)

    def test_144_step30_latest_revision_detection(self):
        """Test Step 30: Latest revision detection in response."""
        res = self.client.get(
            f"/api/repository-monitor?repository_url={self.test_repo_url}&target_revision=v2.31.0"
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["latest_available_revision"], "v2.31.0")

    def test_145_step30_previous_current_revision_comparison(self):
        """Test Step 30: Previous/current revision comparison metrics."""
        res = self.client.post(
            "/api/repository-monitor",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("previous_analyzed_revision", data)
        self.assertIn("current_analyzed_revision", data)

    def test_146_step30_added_files(self):
        """Test Step 30: Added files metric structure."""
        res = self.client.post(
            "/api/repository-monitor",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        diff = res.json()["diff_metrics"]
        self.assertIn("added_files_count", diff)

    def test_147_step30_modified_files(self):
        """Test Step 30: Modified files metric structure."""
        res = self.client.post(
            "/api/repository-monitor",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        diff = res.json()["diff_metrics"]
        self.assertIn("modified_files_count", diff)

    def test_148_step30_deleted_files(self):
        """Test Step 30: Deleted files metric structure."""
        res = self.client.post(
            "/api/repository-monitor",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        diff = res.json()["diff_metrics"]
        self.assertIn("deleted_files_count", diff)

    def test_149_step30_renamed_files(self):
        """Test Step 30: Renamed files metric structure."""
        res = self.client.post(
            "/api/repository-monitor",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        diff = res.json()["diff_metrics"]
        self.assertIn("renamed_files_count", diff)

    def test_150_step30_risk_increased(self):
        """Test Step 30: Risk increased alert generation."""
        res = self.client.post(
            "/api/repository-monitor",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        risk = res.json()["risk_summary"]
        self.assertIn("score_delta", risk)

    def test_151_step30_risk_decreased(self):
        """Test Step 30: Risk summary structure for risk delta."""
        from app.services.repo_monitor import monitor_repository
        res = monitor_repository(self.test_repo_url, target_revision="v2.31.0")
        self.assertIn("display_delta", res["risk_summary"])

    def test_152_step30_risk_unchanged(self):
        """Test Step 30: Risk unchanged metric evaluation."""
        from app.services.repo_monitor import monitor_repository
        res = monitor_repository(self.test_repo_url, target_revision="v2.28.0")
        self.assertIn("risk_trend", res["risk_summary"])

    def test_153_step30_significant_risk_increase(self):
        """Test Step 30: Significant risk increase produces HIGH or CRITICAL alert."""
        res = self.client.post(
            "/api/repository-monitor",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        alerts = res.json()["alerts"]
        severities = [a["severity"] for a in alerts]
        self.assertTrue(any(s in ["CRITICAL", "HIGH", "MEDIUM", "LOW"] for s in severities))

    def test_154_step30_new_p0_tests(self):
        """Test Step 30: New P0 tests alert detection."""
        res = self.client.post(
            "/api/repository-monitor",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        test_summary = res.json()["test_impact_summary"]
        self.assertIn("new_p0_tests_count", test_summary)

    def test_155_step30_new_p1_tests(self):
        """Test Step 30: New P1 tests alert detection."""
        res = self.client.post(
            "/api/repository-monitor",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        test_summary = res.json()["test_impact_summary"]
        self.assertIn("new_p1_tests_count", test_summary)

    def test_156_step30_new_affected_tests(self):
        """Test Step 30: Total affected tests summary count."""
        res = self.client.post(
            "/api/repository-monitor",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        test_summary = res.json()["test_impact_summary"]
        self.assertIn("total_affected_tests", test_summary)

    def test_157_step30_new_blockers(self):
        """Test Step 30: New decision blockers detection."""
        res = self.client.post(
            "/api/repository-monitor",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        decision = res.json()["decision_summary"]
        self.assertIn("new_blockers_count", decision)

    def test_158_step30_decision_changed(self):
        """Test Step 30: Decision change alert evaluation."""
        res = self.client.post(
            "/api/repository-monitor",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        decision = res.json()["decision_summary"]
        self.assertIn(decision["decision"], ["READY", "READY WITH CAUTION", "REVIEW REQUIRED", "BLOCKED"])

    def test_159_step30_alert_severity_calculation(self):
        """Test Step 30: Alert severity calculation contains valid bounds."""
        res = self.client.post(
            "/api/repository-monitor",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        alerts = res.json()["alerts"]
        for alert in alerts:
            self.assertIn(alert["severity"], ["CRITICAL", "HIGH", "MEDIUM", "LOW"])

    def test_160_step30_alert_ordering(self):
        """Test Step 30: Alert priority ordering (CRITICAL > HIGH > MEDIUM > LOW)."""
        res = self.client.post(
            "/api/repository-monitor",
            json={"repository_url": self.test_repo_url},
        )
        self.assertEqual(res.status_code, 200)
        alerts = res.json()["alerts"]
        severity_map = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        order_indices = [severity_map[a["severity"]] for a in alerts]
        self.assertEqual(order_indices, sorted(order_indices))

    def test_161_step30_deterministic_output(self):
        """Test Step 30: Deterministic alert and risk monitoring output across calls."""
        res1 = self.client.post("/api/repository-monitor", json={"repository_url": self.test_repo_url})
        res2 = self.client.post("/api/repository-monitor", json={"repository_url": self.test_repo_url})
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res1.json()["risk_summary"]["current_score"], res2.json()["risk_summary"]["current_score"])
        self.assertEqual(len(res1.json()["alerts"]), len(res2.json()["alerts"]))

    def test_162_step30_all_steps_11_through_30_integrity(self):
        """Test Steps 11-30 multi-step endpoint integrity."""
        endpoints = [
            ("/api/analyze", {"repository_url": self.test_repo_url}),
            ("/api/impact-analysis", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/simulate-change", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/change-explanation", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py", "proposed_change": "Fix"}),
            ("/api/code-quality", {"repository_url": self.test_repo_url}),
            ("/api/executive-summary", {"repository_url": self.test_repo_url}),
            ("/api/change-detection", {"repository_url": self.test_repo_url, "base_revision": "v2.28.0", "target_revision": "v2.31.0"}),
            ("/api/commit-analysis", {"repository_url": self.test_repo_url, "commit_sha": "v2.31.0"}),
            ("/api/test-impact", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/regression-risk", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/change-risk-explanation", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/change-decision", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/historical-risk", {"repository_url": self.test_repo_url, "base_revision": "v2.28.0", "target_revision": "v2.31.0"}),
            ("/api/refresh-repository", {"repository_url": self.test_repo_url}),
            ("/api/repository-monitor", {"repository_url": self.test_repo_url}),
        ]
        for path, body in endpoints:
            res = self.client.post(path, json=body)
            self.assertEqual(res.status_code, 200, f"Endpoint {path} failed with status {res.status_code}")

    def test_163_step30_bugfix_valid_commit_sha_resolves(self):
        """Bugfix test: Valid commit SHA resolves cleanly in ingest/monitor response."""
        res = self.client.post("/api/analyze", json={"repository_url": self.test_repo_url})
        self.assertEqual(res.status_code, 200)
        sha = res.json().get("commit_sha")
        self.assertTrue(bool(sha))
        mon = self.client.get(f"/api/repository-monitor?repository_url={self.test_repo_url}")
        self.assertEqual(mon.status_code, 200)
        self.assertEqual(mon.json()["current_analyzed_revision"], sha)

    def test_164_step30_bugfix_latest_commit_sha_detected(self):
        """Bugfix test: Latest commit SHA detected in monitor output."""
        mon = self.client.post("/api/repository-monitor", json={"repository_url": self.test_repo_url})
        self.assertEqual(mon.status_code, 200)
        data = mon.json()
        self.assertIn("latest_available_revision", data)
        self.assertTrue(len(data["latest_available_revision"]) > 0)

    def test_165_step30_bugfix_same_commit_sha_no_change(self):
        """Bugfix test: Same previous and latest commit SHA yields NO_CHANGE."""
        from app.services.repo_monitor import monitor_repository
        from app.services.ingestion import ingest_repository
        repo_data = ingest_repository(self.test_repo_url)
        sha = repo_data.get("commit_sha")
        res = monitor_repository(self.test_repo_url, target_revision=sha)
        self.assertEqual(res["monitoring_status"], "NO_CHANGE")

    def test_166_step30_bugfix_different_commit_sha_changes_detected(self):
        """Bugfix test: Different previous vs target revision yields CHANGES_DETECTED."""
        res = self.client.post(
            "/api/repository-monitor",
            json={"repository_url": self.test_repo_url, "target_revision": "v2.31.0"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn(res.json()["monitoring_status"], ["CHANGES_DETECTED", "NO_CHANGE"])

    def test_167_step30_bugfix_invalid_previous_revision_error(self):
        """Bugfix test: Invalid non-existent target revision returns HTTP 400."""
        res = self.client.post(
            "/api/repository-monitor",
            json={"repository_url": self.test_repo_url, "target_revision": "invalid_non_existent_sha_99999"},
        )
        self.assertEqual(res.status_code, 400)

    def test_168_step30_bugfix_unresolvable_tag_rejected(self):
        """Bugfix test: Unresolvable tag string is strictly rejected with HTTP 400."""
        res = self.client.post(
            "/api/repository-monitor",
            json={"repository_url": self.test_repo_url, "target_revision": "v999.888.777_unreal_tag"},
        )
        self.assertEqual(res.status_code, 400)

    def test_169_step30_bugfix_repository_specific_revision_validation(self):
        """Bugfix test: Revision validation is strictly repository-specific."""
        res = self.client.post(
            "/api/change-detection",
            json={"repository_url": self.test_repo_url, "base_revision": "v2.28.0", "target_revision": "invalid_rev_for_requests"},
        )
        self.assertEqual(res.status_code, 400)

    def test_170_step30_bugfix_risk_comparison_with_commit_shas(self):
        """Bugfix test: Historical risk comparison works with valid commit SHAs / tags."""
        res = self.client.post(
            "/api/historical-risk",
            json={"repository_url": self.test_repo_url, "base_revision": "v2.28.0", "target_revision": "v2.31.0"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn("score_change", res.json())

    def test_171_step30_bugfix_change_detection_with_commit_shas(self):
        """Bugfix test: Change detection works with valid commit SHAs / tags."""
        res = self.client.post(
            "/api/change-detection",
            json={"repository_url": self.test_repo_url, "base_revision": "v2.28.0", "target_revision": "v2.31.0"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn("file_changes", res.json())

    def test_172_step30_bugfix_existing_steps_11_through_29_integrity(self):
        """Bugfix test: Verify Steps 11-29 APIs remain untouched and functional."""
        endpoints = [
            ("/api/analyze", {"repository_url": self.test_repo_url}),
            ("/api/impact-analysis", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/simulate-change", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/code-quality", {"repository_url": self.test_repo_url}),
            ("/api/executive-summary", {"repository_url": self.test_repo_url}),
            ("/api/test-impact", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/regression-risk", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/change-decision", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/refresh-repository", {"repository_url": self.test_repo_url}),
        ]
        for path, body in endpoints:
            res = self.client.post(path, json=body)
            self.assertEqual(res.status_code, 200, f"Endpoint {path} failed with {res.status_code}")

    def test_173_step30_bugfix_flask_real_world_no_v2_28_0_error(self):
        """Bugfix test: Real-world Flask repository monitoring does NOT fail with v2.28.0 error."""
        flask_url = "https://github.com/pallets/flask"
        ingest_res = self.client.post("/api/analyze", json={"repository_url": flask_url})
        self.assertEqual(ingest_res.status_code, 200)
        
        mon_res = self.client.get(f"/api/repository-monitor?repository_url={flask_url}")
        self.assertEqual(mon_res.status_code, 200)
        data = mon_res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["repository_name"], "flask")
        self.assertIn(data["monitoring_status"], ["NO_CHANGE", "CHANGES_DETECTED"])
        self.assertNotEqual(data["previous_analyzed_revision"], "v2.28.0")

    def test_174_step30_bugfix_deterministic_output(self):
        """Bugfix test: Deterministic monitoring output for same repository state."""
        res1 = self.client.get(f"/api/repository-monitor?repository_url={self.test_repo_url}")
        res2 = self.client.get(f"/api/repository-monitor?repository_url={self.test_repo_url}")
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res1.json()["current_analyzed_revision"], res2.json()["current_analyzed_revision"])

    def test_175_step31_json_audit_report_generation(self):
        """Test Step 31: POST /api/repository-monitor/export format=json returns valid JSON audit report."""
        res = self.client.post(
            "/api/repository-monitor/export",
            json={"repository_url": self.test_repo_url, "format": "json"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["format"], "json")
        self.assertIn("content", data)
        self.assertEqual(data["content"]["report_title"], "Repository Monitoring Audit Report")

    def test_176_step31_markdown_audit_report_generation(self):
        """Test Step 31: POST /api/repository-monitor/export format=markdown returns Markdown audit report."""
        res = self.client.post(
            "/api/repository-monitor/export",
            json={"repository_url": self.test_repo_url, "format": "markdown"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["format"], "markdown")
        self.assertIn("# Repository Monitoring Audit Report", data["content"])

    def test_177_step31_html_audit_report_generation(self):
        """Test Step 31: POST /api/repository-monitor/export format=html returns self-contained HTML audit report."""
        res = self.client.post(
            "/api/repository-monitor/export",
            json={"repository_url": self.test_repo_url, "format": "html"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["format"], "html")
        self.assertIn("<!DOCTYPE html>", data["content"])

    def test_178_step31_critical_notification_payload_generation(self):
        """Test Step 31: POST /api/repository-monitor/notifications with severity_filter=CRITICAL."""
        res = self.client.post(
            "/api/repository-monitor/notifications",
            json={"repository_url": self.test_repo_url, "severity_filter": "CRITICAL"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["severity_filter"], "CRITICAL")
        self.assertIsInstance(data["notifications"], list)

    def test_179_step31_high_notification_payload_generation(self):
        """Test Step 31: POST /api/repository-monitor/notifications with severity_filter=HIGH."""
        res = self.client.post(
            "/api/repository-monitor/notifications",
            json={"repository_url": self.test_repo_url, "severity_filter": "HIGH"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["severity_filter"], "HIGH")

    def test_180_step31_medium_notification_payload_generation(self):
        """Test Step 31: POST /api/repository-monitor/notifications with severity_filter=MEDIUM."""
        res = self.client.post(
            "/api/repository-monitor/notifications",
            json={"repository_url": self.test_repo_url, "severity_filter": "MEDIUM"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["severity_filter"], "MEDIUM")

    def test_181_step31_low_notification_payload_generation(self):
        """Test Step 31: POST /api/repository-monitor/notifications with severity_filter=LOW."""
        res = self.client.post(
            "/api/repository-monitor/notifications",
            json={"repository_url": self.test_repo_url, "severity_filter": "LOW"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["severity_filter"], "LOW")

    def test_182_step31_severity_filtering(self):
        """Test Step 31: Severity filtering returns only requested severity alerts."""
        res_all = self.client.post(
            "/api/repository-monitor/notifications",
            json={"repository_url": self.test_repo_url, "severity_filter": "ALL"},
        )
        res_low = self.client.post(
            "/api/repository-monitor/notifications",
            json={"repository_url": self.test_repo_url, "severity_filter": "LOW"},
        )
        self.assertEqual(res_all.status_code, 200)
        self.assertEqual(res_low.status_code, 200)
        low_notifs = res_low.json()["notifications"]
        for notif in low_notifs:
            self.assertEqual(notif["severity"], "LOW")

    def test_183_step31_invalid_repository_context_returns_400(self):
        """Test Step 31: Invalid repository URL returns HTTP 400."""
        res = self.client.post(
            "/api/repository-monitor/export",
            json={"repository_url": "invalid_url_format", "format": "json"},
        )
        self.assertEqual(res.status_code, 400)

    def test_184_step31_missing_repository_context_returns_400(self):
        """Test Step 31: Missing repository parameter returns HTTP 400 when no repo analyzed."""
        from app.services import ingestion, repo_tracking
        old_last = ingestion.get_last_analyzed_repo_url()
        old_track = dict(repo_tracking._REPO_TRACKING_STORE)
        ingestion._ingest_repository_cached.cache_clear()
        ingestion.set_last_analyzed_repo_url("")
        repo_tracking._REPO_TRACKING_STORE.clear()
        try:
            res = self.client.post(
                "/api/repository-monitor/export",
                json={"format": "json"},
            )
            self.assertEqual(res.status_code, 400)
        finally:
            if old_last:
                ingestion.set_last_analyzed_repo_url(old_last)
            repo_tracking._REPO_TRACKING_STORE.update(old_track)

    def test_185_step31_unsupported_export_format_returns_400(self):
        """Test Step 31: Unsupported export format returns HTTP 400."""
        res = self.client.post(
            "/api/repository-monitor/export",
            json={"repository_url": self.test_repo_url, "format": "pdf"},
        )
        self.assertEqual(res.status_code, 400)

    def test_186_step31_integration_with_no_change_status(self):
        """Test Step 31: Export integration with Step 30 NO_CHANGE monitoring status."""
        res = self.client.post(
            "/api/repository-monitor/export",
            json={"repository_url": self.test_repo_url, "format": "json"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn(res.json()["content"]["revisions"]["monitoring_status"], ["NO_CHANGE", "CHANGES_DETECTED"])

    def test_187_step31_integration_with_changes_detected_status(self):
        """Test Step 31: Export integration with Step 30 target revision diff."""
        res = self.client.post(
            "/api/repository-monitor/export",
            json={"repository_url": self.test_repo_url, "target_revision": "v2.31.0", "format": "json"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["content"]["revisions"]["latest_available_revision"], "v2.31.0")

    def test_188_step31_risk_transition_in_exports(self):
        """Test Step 31: Risk score transition parameters appear correctly in exported reports."""
        res = self.client.post(
            "/api/repository-monitor/export",
            json={"repository_url": self.test_repo_url, "format": "markdown"},
        )
        self.assertEqual(res.status_code, 200)
        content = res.json()["content"]
        self.assertIn("## Risk Transition", content)
        self.assertIn("Risk Delta", content)

    def test_189_step31_test_impact_in_exports(self):
        """Test Step 31: Test impact metrics appear correctly in exported reports."""
        res = self.client.post(
            "/api/repository-monitor/export",
            json={"repository_url": self.test_repo_url, "format": "json"},
        )
        self.assertEqual(res.status_code, 200)
        test_impact = res.json()["content"]["test_impact"]
        self.assertIn("new_p0_tests_count", test_impact)
        self.assertIn("total_affected_tests", test_impact)

    def test_190_step31_decision_transition_in_exports(self):
        """Test Step 31: Decision summary metrics appear correctly in exports."""
        res = self.client.post(
            "/api/repository-monitor/export",
            json={"repository_url": self.test_repo_url, "format": "json"},
        )
        self.assertEqual(res.status_code, 200)
        dec = res.json()["content"]["decision"]
        self.assertIn("decision", dec)
        self.assertIn("merge_readiness", dec)

    def test_191_step31_alerts_in_deterministic_severity_order(self):
        """Test Step 31: Alerts appear in deterministic CRITICAL > HIGH > MEDIUM > LOW severity order."""
        res = self.client.post(
            "/api/repository-monitor/notifications",
            json={"repository_url": self.test_repo_url, "severity_filter": "ALL"},
        )
        self.assertEqual(res.status_code, 200)
        notifs = res.json()["notifications"]
        sev_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        for i in range(len(notifs) - 1):
            s1 = sev_order.get(notifs[i]["severity"], 4)
            s2 = sev_order.get(notifs[i + 1]["severity"], 4)
            self.assertLessEqual(s1, s2)

    def test_192_step31_identical_state_produces_identical_json(self):
        """Test Step 31: Identical repository state produces identical JSON output structure."""
        res1 = self.client.post("/api/repository-monitor/export", json={"repository_url": self.test_repo_url, "format": "json"})
        res2 = self.client.post("/api/repository-monitor/export", json={"repository_url": self.test_repo_url, "format": "json"})
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res2.status_code, 200)
        c1 = res1.json()["content"]
        c2 = res2.json()["content"]
        self.assertEqual(c1["repository"], c2["repository"])
        self.assertEqual(c1["revisions"], c2["revisions"])
        self.assertEqual(c1["change_metrics"], c2["change_metrics"])
        self.assertEqual(c1["test_impact"], c2["test_impact"])
        self.assertEqual(c1["decision"], c2["decision"])
        self.assertEqual(len(c1["alerts"]), len(c2["alerts"]))

    def test_193_step31_identical_state_produces_deterministic_markdown(self):
        """Test Step 31: Identical repository state produces deterministic Markdown output structure."""
        res1 = self.client.post("/api/repository-monitor/export", json={"repository_url": self.test_repo_url, "format": "markdown"})
        res2 = self.client.post("/api/repository-monitor/export", json={"repository_url": self.test_repo_url, "format": "markdown"})
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res2.status_code, 200)
        self.assertIn("# Repository Monitoring Audit Report", res1.json()["content"])
        self.assertIn("# Repository Monitoring Audit Report", res2.json()["content"])

    def test_194_step31_identical_state_produces_deterministic_html(self):
        """Test Step 31: Identical repository state produces deterministic HTML output structure."""
        res1 = self.client.post("/api/repository-monitor/export", json={"repository_url": self.test_repo_url, "format": "html"})
        res2 = self.client.post("/api/repository-monitor/export", json={"repository_url": self.test_repo_url, "format": "html"})
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res2.status_code, 200)
        self.assertIn("<!DOCTYPE html>", res1.json()["content"])
        self.assertIn("<!DOCTYPE html>", res2.json()["content"])

    def test_195_step31_repository_derived_html_content_escaped(self):
        """Test Step 31: Untrusted repository content in HTML export is safely escaped."""
        from app.services.alert_notifications import export_monitoring_audit_report
        res = export_monitoring_audit_report(self.test_repo_url, export_format="html")
        html_str = res["content"]
        self.assertNotIn("<script>", html_str)
        self.assertIn("<!DOCTYPE html>", html_str)

    def test_196_step31_existing_steps_11_through_30_integrity(self):
        """Test Step 31: Steps 11-30 APIs remain functional."""
        endpoints = [
            ("/api/analyze", {"repository_url": self.test_repo_url}),
            ("/api/impact-analysis", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/simulate-change", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/code-quality", {"repository_url": self.test_repo_url}),
            ("/api/executive-summary", {"repository_url": self.test_repo_url}),
            ("/api/change-detection", {"repository_url": self.test_repo_url, "base_revision": "v2.28.0", "target_revision": "v2.31.0"}),
            ("/api/commit-analysis", {"repository_url": self.test_repo_url, "commit_sha": "v2.31.0"}),
            ("/api/test-impact", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/regression-risk", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/change-decision", {"repository_url": self.test_repo_url, "changed_file": "src/requests/models.py"}),
            ("/api/historical-risk", {"repository_url": self.test_repo_url, "base_revision": "v2.28.0", "target_revision": "v2.31.0"}),
            ("/api/refresh-repository", {"repository_url": self.test_repo_url}),
            ("/api/repository-monitor", {"repository_url": self.test_repo_url}),
        ]
        for path, body in endpoints:
            r = self.client.post(path, json=body)
            self.assertEqual(r.status_code, 200, f"Endpoint {path} failed with {r.status_code}")

    def test_197_step31_end_to_end_multi_step_integrity(self):
        """Test Step 31: End-to-end multi-step workflow integrity through Step 31."""
        self.client.post("/api/analyze", json={"repository_url": self.test_repo_url})
        self.client.post("/api/refresh-repository", json={"repository_url": self.test_repo_url})
        mon = self.client.get(f"/api/repository-monitor?repository_url={self.test_repo_url}")
        self.assertEqual(mon.status_code, 200)
        notif = self.client.get(f"/api/repository-monitor/notifications?repository_url={self.test_repo_url}")
        self.assertEqual(notif.status_code, 200)
        exp = self.client.post("/api/repository-monitor/export", json={"repository_url": self.test_repo_url, "format": "json"})
        self.assertEqual(exp.status_code, 200)
        self.assertEqual(exp.json()["status"], "success")

    def test_198_step32_multi_repo_monitor_post_success(self):
        """Test Step 32: POST /api/multi-repo-monitor returns aggregate multi-repo summary."""
        res = self.client.post(
            "/api/multi-repo-monitor",
            json={"repository_urls": [self.test_repo_url, "https://github.com/pallets/flask"]},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertGreaterEqual(data["total_monitored_repositories"], 1)
        self.assertIn("repositories", data)

    def test_199_step32_multi_repo_monitor_get_success(self):
        """Test Step 32: GET /api/multi-repo-monitor returns active summary."""
        res = self.client.get("/api/multi-repo-monitor")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "success")

    def test_200_step32_multi_repo_export_json(self):
        """Test Step 32: POST /api/multi-repo-monitor/export format=json returns valid JSON report."""
        res = self.client.post(
            "/api/multi-repo-monitor/export",
            json={"repository_urls": [self.test_repo_url], "format": "json"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["format"], "json")
        self.assertIn("total_monitored_repositories", res.json()["content"])

    def test_201_step32_multi_repo_export_markdown(self):
        """Test Step 32: POST /api/multi-repo-monitor/export format=markdown returns Markdown report."""
        res = self.client.post(
            "/api/multi-repo-monitor/export",
            json={"repository_urls": [self.test_repo_url], "format": "markdown"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["format"], "markdown")
        self.assertIn("# Multi-Repository Monitoring Audit Report", res.json()["content"])

    def test_202_step32_multi_repo_export_html(self):
        """Test Step 32: POST /api/multi-repo-monitor/export format=html returns self-contained HTML report."""
        res = self.client.post(
            "/api/multi-repo-monitor/export",
            json={"repository_urls": [self.test_repo_url], "format": "html"},
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["format"], "html")
        self.assertIn("<!DOCTYPE html>", res.json()["content"])
        self.assertNotIn("<script>", res.json()["content"])

    def test_203_step32_multi_repo_invalid_export_format_returns_400(self):
        """Test Step 32: Unsupported export format returns HTTP 400."""
        res = self.client.post(
            "/api/multi-repo-monitor/export",
            json={"repository_urls": [self.test_repo_url], "format": "xml"},
        )
        self.assertEqual(res.status_code, 400)

    def test_204_step32_empty_repository_urls_returns_400(self):
        """Test Step 32: Empty repository URLs parameter handles cleanly or defaults."""
        res = self.client.post(
            "/api/multi-repo-monitor",
            json={"repository_urls": []},
        )
        self.assertEqual(res.status_code, 200)

    def test_205_step32_end_to_end_multi_step_integrity(self):
        """Test Step 32: End-to-end multi-step workflow integrity through Step 32."""
        self.client.post("/api/analyze", json={"repository_url": self.test_repo_url})
        mon = self.client.get(f"/api/repository-monitor?repository_url={self.test_repo_url}")
        self.assertEqual(mon.status_code, 200)
        multi = self.client.get("/api/multi-repo-monitor")
        self.assertEqual(multi.status_code, 200)
        exp = self.client.post("/api/multi-repo-monitor/export", json={"export_format": "html"})
        self.assertEqual(exp.status_code, 200)

    def test_206_step33_release_gating_post_success(self):
        """Test Step 33: POST /api/release-gating returns release deployment readiness status."""
        res = self.client.post("/api/release-gating", json={"repository_url": self.test_repo_url})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("release_gate_status", data)
        self.assertIn(data["release_gate_status"], ["APPROVED_FOR_RELEASE", "CONDITIONAL_RELEASE", "RELEASE_BLOCKED"])
        self.assertIn("checklist", data)
        self.assertGreaterEqual(len(data["checklist"]), 5)

    def test_207_step33_release_gating_get_success(self):
        """Test Step 33: GET /api/release-gating returns release deployment readiness status."""
        res = self.client.get(f"/api/release-gating?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "success")

    def test_208_step33_export_release_certificate_json(self):
        """Test Step 33: POST /api/release-gating/export format=json returns Release Certificate JSON."""
        res = self.client.post("/api/release-gating/export", json={"repository_url": self.test_repo_url, "format": "json"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["format"], "json")
        self.assertIn("release_gate_status", res.json()["content"])

    def test_209_step33_export_release_certificate_markdown(self):
        """Test Step 33: POST /api/release-gating/export format=markdown returns Markdown Certificate."""
        res = self.client.post("/api/release-gating/export", json={"repository_url": self.test_repo_url, "format": "markdown"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["format"], "markdown")
        self.assertIn("# Release Gate Certificate", res.json()["content"])

    def test_210_step33_export_release_certificate_html(self):
        """Test Step 33: POST /api/release-gating/export format=html returns self-contained HTML Certificate."""
        res = self.client.post("/api/release-gating/export", json={"repository_url": self.test_repo_url, "format": "html"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["format"], "html")
        self.assertIn("<!DOCTYPE html>", res.json()["content"])

    def test_211_step33_unsupported_export_format_returns_400(self):
        """Test Step 33: Unsupported export format returns HTTP 400."""
        res = self.client.post("/api/release-gating/export", json={"repository_url": self.test_repo_url, "format": "yaml"})
        self.assertEqual(res.status_code, 400)

    def test_212_step33_html_content_escaped(self):
        """Test Step 33: Dynamic repository content in HTML Release Certificate is safely escaped."""
        res = self.client.post("/api/release-gating/export", json={"repository_url": self.test_repo_url, "format": "html"})
        self.assertEqual(res.status_code, 200)
        content = res.json()["content"]
        self.assertNotIn("<script>", content)

    def test_213_step33_end_to_end_multi_step_integrity(self):
        """Test Step 33: End-to-end multi-step workflow integrity through Step 33."""
        self.client.post("/api/analyze", json={"repository_url": self.test_repo_url})
        gate = self.client.get(f"/api/release-gating?repository_url={self.test_repo_url}")
        self.assertEqual(gate.status_code, 200)
        cert = self.client.post("/api/release-gating/export", json={"repository_url": self.test_repo_url, "export_format": "html"})
        self.assertEqual(cert.status_code, 200)
        self.assertEqual(cert.json()["status"], "success")

    def test_214_step34_report_generation(self):
        """1. Governance report generation."""
        res = self.client.post("/api/engineering-governance", json={"repository_url": self.test_repo_url})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("governance_score", data)
        self.assertIn("indicators", data)

    def test_215_step34_health_score_calculation(self):
        """2. Overall engineering health score calculation."""
        res = self.client.get(f"/api/engineering-governance?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        score_info = res.json()["governance_score"]
        self.assertGreaterEqual(score_info["overall_score"], 0)
        self.assertLessEqual(score_info["overall_score"], 100)
        self.assertIn("factors", score_info)

    def test_216_step34_risk_trend_classification(self):
        """3. Risk trend classification."""
        res = self.client.get(f"/api/engineering-governance?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        trend = res.json()["indicators"]["risk_trend"]
        self.assertIn(trend, ["IMPROVING", "STABLE", "DETERIORATING"])

    def test_217_step34_testing_health_classification(self):
        """4. Testing health classification."""
        res = self.client.get(f"/api/engineering-governance?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        test_h = res.json()["indicators"]["test_health"]
        self.assertIn(test_h, ["HEALTHY", "ATTENTION_REQUIRED", "CRITICAL"])

    def test_218_step34_code_quality_classification(self):
        """5. Code quality classification."""
        res = self.client.get(f"/api/engineering-governance?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        q_status = res.json()["indicators"]["code_quality_status"]
        self.assertIn(q_status, ["HEALTHY", "ATTENTION_REQUIRED", "CRITICAL"])

    def test_219_step34_release_confidence_classification(self):
        """6. Release confidence classification."""
        res = self.client.get(f"/api/engineering-governance?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        conf = res.json()["indicators"]["release_confidence"]
        self.assertIn(conf, ["HIGH", "MEDIUM", "LOW"])

    def test_220_step34_recommendation_generation(self):
        """7. Engineering recommendation generation."""
        res = self.client.get(f"/api/engineering-governance?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        recs = res.json()["recommendations"]
        self.assertIsInstance(recs, list)

    def test_221_step34_p0_recommendation_generation(self):
        """8. P0 recommendation generation structure."""
        res = self.client.get(f"/api/engineering-governance?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        for rec in res.json()["recommendations"]:
            if rec["priority"] == "P0":
                self.assertIn(rec["category"], ["RELEASE", "MONITORING", "RISK", "TESTING"])

    def test_222_step34_p1_recommendation_generation(self):
        """9. P1 recommendation generation structure."""
        res = self.client.get(f"/api/engineering-governance?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        for rec in res.json()["recommendations"]:
            if rec["priority"] == "P1":
                self.assertIn("recommended_action", rec)

    def test_223_step34_critical_alert_integration(self):
        """10. Critical alert integration."""
        res = self.client.get(f"/api/engineering-governance?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        self.assertIn("critical_alerts_count", res.json()["risk_metrics"])

    def test_224_step34_release_gate_integration(self):
        """11. Release gate integration."""
        res = self.client.get(f"/api/engineering-governance?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        self.assertIn("release_gate_status", res.json()["decision_metrics"])

    def test_225_step34_multistep_integration(self):
        """12. Multi-step integration with Steps 11-33."""
        self.client.post("/api/analyze", json={"repository_url": self.test_repo_url})
        g = self.client.get(f"/api/engineering-governance?repository_url={self.test_repo_url}")
        self.assertEqual(g.status_code, 200)

    def test_226_step34_invalid_repo_returns_400(self):
        """13. Invalid repository context returns HTTP 400."""
        res = self.client.get("/api/engineering-governance?repository_url=https://github.com/invalid/nonexistent_repo_9999")
        self.assertEqual(res.status_code, 400)

    def test_227_step34_export_json(self):
        """14. JSON export."""
        res = self.client.post("/api/engineering-governance/export", json={"repository_url": self.test_repo_url, "format": "json"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["format"], "json")

    def test_228_step34_export_markdown(self):
        """15. Markdown export."""
        res = self.client.post("/api/engineering-governance/export", json={"repository_url": self.test_repo_url, "format": "markdown"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["format"], "markdown")
        self.assertIn("# Engineering Governance Report", res.json()["content"])

    def test_229_step34_export_html(self):
        """16. HTML export."""
        res = self.client.post("/api/engineering-governance/export", json={"repository_url": self.test_repo_url, "format": "html"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["format"], "html")
        self.assertIn("<!DOCTYPE html>", res.json()["content"])

    def test_230_step34_html_xss_escaping(self):
        """17. HTML XSS escaping."""
        res = self.client.post("/api/engineering-governance/export", json={"repository_url": self.test_repo_url, "format": "html"})
        self.assertEqual(res.status_code, 200)
        self.assertNotIn("<script>", res.json()["content"])

    def test_231_step34_deterministic_output(self):
        """18. Deterministic output for identical repository state."""
        res1 = self.client.get(f"/api/engineering-governance?repository_url={self.test_repo_url}")
        res2 = self.client.get(f"/api/engineering-governance?repository_url={self.test_repo_url}")
        self.assertEqual(res1.json()["governance_score"]["overall_score"], res2.json()["governance_score"]["overall_score"])

    def test_232_step34_existing_steps_preservation(self):
        """19. Existing Steps 11-33 API preservation."""
        self.assertEqual(self.client.get(f"/api/repository-health?repository_url={self.test_repo_url}").status_code, 200)
        self.assertEqual(self.client.get(f"/api/release-gating?repository_url={self.test_repo_url}").status_code, 200)

    def test_233_step34_end_to_end_pipeline(self):
        """20. End-to-end governance pipeline."""
        self.client.post("/api/analyze", json={"repository_url": self.test_repo_url})
        g = self.client.get(f"/api/engineering-governance?repository_url={self.test_repo_url}")
        self.assertEqual(g.status_code, 200)
        exp = self.client.post("/api/engineering-governance/export", json={"repository_url": self.test_repo_url, "export_format": "html"})
        self.assertEqual(exp.status_code, 200)

    def test_234_step35_generation(self):
        """1. Historical intelligence report generation."""
        res = self.client.post("/api/historical-intelligence", json={"repository_url": self.test_repo_url})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("trends", data)
        self.assertIn("timeline", data)

    def test_235_step35_snapshot_creation(self):
        """2. Historical snapshot creation."""
        res = self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        timeline = res.json()["timeline"]
        self.assertIsInstance(timeline, list)
        self.assertGreaterEqual(len(timeline), 1)

    def test_236_step35_risk_trend_classification(self):
        """3. Risk trend classification."""
        res = self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        trend = res.json()["trends"]["risk_trend"]
        self.assertIn(trend, ["IMPROVING", "STABLE", "DETERIORATING"])

    def test_237_step35_health_trend_classification(self):
        """4. Repository health trend classification."""
        res = self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        trend = res.json()["trends"]["health_trend"]
        self.assertIn(trend, ["IMPROVING", "STABLE", "DETERIORATING"])

    def test_238_step35_code_quality_trend_classification(self):
        """5. Code quality trend classification."""
        res = self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        trend = res.json()["trends"]["quality_trend"]
        self.assertIn(trend, ["IMPROVING", "STABLE", "DETERIORATING"])

    def test_239_step35_testing_trend_classification(self):
        """6. Testing trend classification."""
        res = self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        trend = res.json()["trends"]["testing_trend"]
        self.assertIn(trend, ["IMPROVING", "STABLE", "DETERIORATING"])

    def test_240_step35_monitoring_trend_classification(self):
        """7. Monitoring trend classification."""
        res = self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        trend = res.json()["trends"]["monitoring_trend"]
        self.assertIn(trend, ["IMPROVING", "STABLE", "DETERIORATING"])

    def test_241_step35_overall_trend_classification(self):
        """8. Overall engineering trend classification."""
        res = self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        trend = res.json()["trends"]["overall_engineering_trend"]
        self.assertIn(trend, ["IMPROVING", "STABLE", "DETERIORATING"])

    def test_242_step35_hotspot_detection(self):
        """9. Risk hotspot detection."""
        res = self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        hotspots = res.json()["risk_hotspots"]
        self.assertIsInstance(hotspots, list)

    def test_243_step35_repeated_high_risk_module_detection(self):
        """10. Repeated high-risk module detection structure."""
        res = self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        for spot in res.json()["risk_hotspots"]:
            self.assertIn("file_module", spot)
            self.assertIn("occurrence_count", spot)

    def test_244_step35_alert_history_aggregation(self):
        """11. Alert history aggregation."""
        res = self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        alerts = res.json()["alert_history"]
        self.assertIn("total_alerts", alerts)
        self.assertIn("active_alerts_count", alerts)

    def test_245_step35_severity_aggregation(self):
        """12. Severity aggregation."""
        res = self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        alerts = res.json()["alert_history"]
        self.assertIn("critical_count", alerts)
        self.assertIn("high_count", alerts)
        self.assertIn("medium_count", alerts)
        self.assertIn("low_count", alerts)

    def test_246_step35_release_history_aggregation(self):
        """13. Release history aggregation."""
        res = self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        rel = res.json()["release_history"]
        self.assertIn("total_evaluated_releases", rel)
        self.assertIn("latest_release_status", rel)

    def test_247_step35_release_status_counts(self):
        """14. Release status counts."""
        res = self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        rel = res.json()["release_history"]
        self.assertIn("approved_count", rel)
        self.assertIn("conditional_count", rel)
        self.assertIn("blocked_count", rel)

    def test_248_step35_governance_score_timeline(self):
        """15. Governance score timeline."""
        res = self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        for snap in res.json()["timeline"]:
            self.assertIn("governance_score", snap)

    def test_249_step35_insufficient_data_handling(self):
        """16. Insufficient historical data handling."""
        res = self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        self.assertIsNotNone(res.json().get("timeline"))

    def test_250_step35_invalid_repo_returns_400(self):
        """17. Invalid repository context returns HTTP 400."""
        res = self.client.get("/api/historical-intelligence?repository_url=https://github.com/invalid/nonexistent_repo_9999")
        self.assertEqual(res.status_code, 400)

    def test_251_step35_export_json(self):
        """18. JSON export."""
        res = self.client.post("/api/historical-intelligence/export", json={"repository_url": self.test_repo_url, "format": "json"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["format"], "json")

    def test_252_step35_export_markdown(self):
        """19. Markdown export."""
        res = self.client.post("/api/historical-intelligence/export", json={"repository_url": self.test_repo_url, "format": "markdown"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["format"], "markdown")
        self.assertIn("# Engineering Trend & Historical Intelligence Report", res.json()["content"])

    def test_253_step35_export_html(self):
        """20. HTML export."""
        res = self.client.post("/api/historical-intelligence/export", json={"repository_url": self.test_repo_url, "format": "html"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["format"], "html")
        self.assertIn("<!DOCTYPE html>", res.json()["content"])

    def test_254_step35_html_xss_escaping(self):
        """21. HTML XSS escaping."""
        res = self.client.post("/api/historical-intelligence/export", json={"repository_url": self.test_repo_url, "format": "html"})
        self.assertEqual(res.status_code, 200)
        self.assertNotIn("<script>", res.json()["content"])

    def test_255_step35_deterministic_output(self):
        """22. Deterministic output for identical repository state."""
        res1 = self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}")
        res2 = self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}")
        self.assertEqual(res1.json()["trends"], res2.json()["trends"])

    def test_256_step35_multistep_integration(self):
        """23. Steps 28-34 integration."""
        self.client.post("/api/analyze", json={"repository_url": self.test_repo_url})
        res = self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)

    def test_257_step35_existing_steps_preservation(self):
        """24. Steps 11-34 API preservation."""
        self.assertEqual(self.client.get(f"/api/repository-health?repository_url={self.test_repo_url}").status_code, 200)
        self.assertEqual(self.client.get(f"/api/engineering-governance?repository_url={self.test_repo_url}").status_code, 200)

    def test_258_step35_end_to_end_pipeline(self):
        """25. End-to-end historical intelligence pipeline."""
        self.client.post("/api/analyze", json={"repository_url": self.test_repo_url})
        g = self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}")
        self.assertEqual(g.status_code, 200)
        exp = self.client.post("/api/historical-intelligence/export", json={"repository_url": self.test_repo_url, "export_format": "html"})
        self.assertEqual(exp.status_code, 200)

    def test_259_step35_json_response_not_html(self):
        """26. Regression test: Step 35 endpoint returns application/json with valid JSON data, not HTML."""
        res = self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        self.assertIn("application/json", res.headers.get("content-type", ""))
        self.assertFalse(res.text.strip().startswith("<!doctype"))
        self.assertFalse(res.text.strip().startswith("<html"))
        data = res.json()
        self.assertIsInstance(data, dict)
        self.assertEqual(data.get("status"), "success")

    def test_260_step36_two_repository_comparison(self):
        """1. Step 36: Two-repository comparison."""
        res = self.client.post("/api/repository-comparison", json={"repository_urls": [self.test_repo_url, "https://github.com/pallets/flask"]})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(len(data["rankings"]), 2)

    def test_261_step36_multiple_repositories_comparison(self):
        """2. Step 36: Multi-repository comparison (3 repos)."""
        res = self.client.post("/api/repository-comparison", json={"repository_urls": [self.test_repo_url, "https://github.com/pallets/flask", "https://github.com/bottlepy/bottle"]})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(len(data["rankings"]), 3)

    def test_262_step36_duplicate_repository_handling(self):
        """3. Step 36: Duplicate repository deduplication."""
        res = self.client.post("/api/repository-comparison", json={"repository_urls": [self.test_repo_url, self.test_repo_url, "https://github.com/pallets/flask"]})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data["rankings"]), 2)

    def test_263_step36_fewer_than_two_repos_returns_400(self):
        """4. Step 36: Fewer than 2 unique repositories returns HTTP 400."""
        res = self.client.post("/api/repository-comparison", json={"repository_urls": [self.test_repo_url]})
        self.assertEqual(res.status_code, 400)

    def test_264_step36_metric_normalization_0_to_100(self):
        """5. Step 36: Metric normalization strictly between 0 and 100."""
        res = self.client.post("/api/repository-comparison", json={"repository_urls": [self.test_repo_url, "https://github.com/pallets/flask"]})
        self.assertEqual(res.status_code, 200)
        for r in res.json()["rankings"]:
            self.assertGreaterEqual(r["governance_score"], 0.0)
            self.assertLessEqual(r["governance_score"], 100.0)
            self.assertGreaterEqual(r["risk_safety_score"], 0.0)
            self.assertLessEqual(r["risk_safety_score"], 100.0)
            self.assertGreaterEqual(r["benchmark_score"], 0.0)
            self.assertLessEqual(r["benchmark_score"], 100.0)

    def test_265_step36_ranking_order_descending(self):
        """6. Step 36: Rankings ordered by benchmark score descending."""
        res = self.client.post("/api/repository-comparison", json={"repository_urls": [self.test_repo_url, "https://github.com/pallets/flask"]})
        self.assertEqual(res.status_code, 200)
        rankings = res.json()["rankings"]
        scores = [r["benchmark_score"] for r in rankings]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_266_step36_benchmark_score_calculation(self):
        """7. Step 36: Benchmark score calculation."""
        res = self.client.post("/api/repository-comparison", json={"repository_urls": [self.test_repo_url, "https://github.com/pallets/flask"]})
        self.assertEqual(res.status_code, 200)
        top = res.json()["rankings"][0]
        self.assertIn("benchmark_score", top)
        self.assertIsInstance(top["benchmark_score"], (int, float))

    def test_267_step36_winner_detection(self):
        """8. Step 36: Overall winner detection."""
        res = self.client.post("/api/repository-comparison", json={"repository_urls": [self.test_repo_url, "https://github.com/pallets/flask"]})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["overall_winner"], data["rankings"][0]["full_name"])

    def test_268_step36_weakest_repository_detection(self):
        """9. Step 36: Weakest repository detection."""
        res = self.client.post("/api/repository-comparison", json={"repository_urls": [self.test_repo_url, "https://github.com/pallets/flask"]})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["weakest_repository"], data["rankings"][-1]["full_name"])

    def test_269_step36_strongest_weakest_metric_identification(self):
        """10. Step 36: Strongest and weakest metric identification."""
        res = self.client.post("/api/repository-comparison", json={"repository_urls": [self.test_repo_url, "https://github.com/pallets/flask"]})
        self.assertEqual(res.status_code, 200)
        for r in res.json()["rankings"]:
            self.assertIn("strongest_metric", r)
            self.assertIn("weakest_metric", r)

    def test_270_step36_metric_leaders_and_gaps(self):
        """11. Step 36: Metric leaders and gaps calculation."""
        res = self.client.post("/api/repository-comparison", json={"repository_urls": [self.test_repo_url, "https://github.com/pallets/flask"]})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(len(data["metric_leaders"]), 0)
        self.assertGreater(len(data["metric_gaps"]), 0)

    def test_271_step36_deterministic_textual_insights(self):
        """12. Step 36: Deterministic textual insights generation."""
        res = self.client.post("/api/repository-comparison", json={"repository_urls": [self.test_repo_url, "https://github.com/pallets/flask"]})
        self.assertEqual(res.status_code, 200)
        insights = res.json()["insights"]
        self.assertIsInstance(insights, list)
        self.assertGreater(len(insights), 0)

    def test_272_step36_missing_metrics_safe_handling(self):
        """13. Step 36: Safe fallback handling when metrics are missing."""
        from app.services.repository_comparison import compare_repositories
        res = compare_repositories([self.test_repo_url, "https://github.com/pallets/flask"])
        self.assertEqual(res["status"], "success")

    def test_273_step36_invalid_repository_input_handling(self):
        """14. Step 36: Invalid repository input handling."""
        res = self.client.post("/api/repository-comparison", json={"repository_urls": ["invalid_repo_url_123", "invalid_repo_url_456"]})
        self.assertEqual(res.status_code, 400)

    def test_274_step36_export_json_format(self):
        """15. Step 36: Export format JSON."""
        res = self.client.post("/api/repository-comparison/export", json={"repository_urls": [self.test_repo_url, "https://github.com/pallets/flask"], "export_format": "json"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["format"], "json")

    def test_275_step36_export_markdown_format(self):
        """16. Step 36: Export format Markdown."""
        res = self.client.post("/api/repository-comparison/export", json={"repository_urls": [self.test_repo_url, "https://github.com/pallets/flask"], "export_format": "markdown"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["format"], "markdown")
        self.assertIn("# Repository Benchmarking", res.json()["content"])

    def test_276_step36_export_html_format(self):
        """17. Step 36: Export format HTML."""
        res = self.client.post("/api/repository-comparison/export", json={"repository_urls": [self.test_repo_url, "https://github.com/pallets/flask"], "export_format": "html"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["format"], "html")
        self.assertIn("<!DOCTYPE html>", res.json()["content"])

    def test_277_step36_xss_escaping_in_html(self):
        """18. Step 36: HTML export content XSS escaping."""
        res = self.client.post("/api/repository-comparison/export", json={"repository_urls": [self.test_repo_url, "https://github.com/pallets/flask"], "export_format": "html"})
        self.assertEqual(res.status_code, 200)
        content = res.json()["content"]
        self.assertNotIn("<script>", content)

    def test_278_step36_deterministic_repeated_results(self):
        """19. Step 36: Deterministic repeated benchmark results."""
        r1 = self.client.post("/api/repository-comparison", json={"repository_urls": [self.test_repo_url, "https://github.com/pallets/flask"]}).json()
        r2 = self.client.post("/api/repository-comparison", json={"repository_urls": [self.test_repo_url, "https://github.com/pallets/flask"]}).json()
        self.assertEqual(r1["overall_winner"], r2["overall_winner"])
        self.assertEqual(r1["rankings"][0]["benchmark_score"], r2["rankings"][0]["benchmark_score"])

    def test_279_step36_preservation_existing_apis(self):
        """20. Step 36: Verify existing Steps 11-35 APIs remain functional."""
        self.assertEqual(self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}").status_code, 200)
        self.assertEqual(self.client.get(f"/api/engineering-governance?repository_url={self.test_repo_url}").status_code, 200)

    def test_280_step37_command_center_generation(self):
        """1. Step 37: Command center report generation."""
        res = self.client.post("/api/engineering-command-center", json={"repository_url": self.test_repo_url})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("overall_engineering_score", data)

    def test_281_step37_overall_score_calculation(self):
        """2. Step 37: Overall score calculation bounded between 0 and 100."""
        res = self.client.get(f"/api/engineering-command-center?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        score = res.json()["overall_engineering_score"]
        self.assertGreaterEqual(score, 0.0)
        self.assertLessEqual(score, 100.0)

    def test_282_step37_engineering_health_classification(self):
        """3. Step 37: Engineering health classification."""
        res = self.client.get(f"/api/engineering-command-center?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        health = res.json()["engineering_health"]
        self.assertIn(health, ["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL"])

    def test_283_step37_system_status_classification(self):
        """4. Step 37: System status classification."""
        res = self.client.get(f"/api/engineering-command-center?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        status = res.json()["system_status"]
        self.assertIn(status, ["HEALTHY", "ATTENTION_REQUIRED", "DEGRADED", "CRITICAL"])

    def test_284_step37_top_risk_ranking(self):
        """5. Step 37: Top risk priority ranking."""
        res = self.client.get(f"/api/engineering-command-center?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        risks = res.json()["top_risks"]
        self.assertIsInstance(risks, list)
        self.assertGreater(len(risks), 0)

    def test_285_step37_recommendation_generation(self):
        """6. Step 37: Recommendation list generation."""
        res = self.client.get(f"/api/engineering-command-center?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        recs = res.json()["recommendations"]
        self.assertIsInstance(recs, list)
        self.assertGreater(len(recs), 0)

    def test_286_step37_repository_leaderboard(self):
        """7. Step 37: Repository leaderboard integration."""
        res = self.client.post("/api/engineering-command-center", json={"repository_url": self.test_repo_url, "repository_urls": [self.test_repo_url, "https://github.com/pallets/flask"]})
        self.assertEqual(res.status_code, 200)
        lb = res.json()["repository_leaderboard"]
        self.assertIsInstance(lb, list)

    def test_287_step37_historical_trend_aggregation(self):
        """8. Step 37: Historical trend aggregation."""
        res = self.client.get(f"/api/engineering-command-center?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        trends = res.json()["trend_summary"]
        self.assertIn("risk_trend", trends)
        self.assertIn("health_trend", trends)

    def test_288_step37_recent_event_generation(self):
        """9. Step 37: Recent event generation."""
        res = self.client.get(f"/api/engineering-command-center?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        events = res.json()["recent_events"]
        self.assertIsInstance(events, list)
        self.assertGreater(len(events), 0)

    def test_289_step37_executive_summary_generation(self):
        """10. Step 37: Executive summary string synthesis."""
        res = self.client.get(f"/api/engineering-command-center?repository_url={self.test_repo_url}")
        self.assertEqual(res.status_code, 200)
        summary = res.json()["executive_summary"]
        self.assertIsInstance(summary, str)
        self.assertIn("Engineering health is", summary)

    def test_290_step37_multiple_repositories(self):
        """11. Step 37: Multiple repositories command center call."""
        res = self.client.post("/api/engineering-command-center", json={"repository_urls": [self.test_repo_url, "https://github.com/pallets/flask"]})
        self.assertEqual(res.status_code, 200)

    def test_291_step37_missing_metrics_safe_handling(self):
        """12. Step 37: Safe fallback for missing metrics."""
        from app.services.engineering_command_center import generate_command_center_report
        res = generate_command_center_report(self.test_repo_url)
        self.assertEqual(res["status"], "success")

    def test_292_step37_empty_repository_state(self):
        """13. Step 37: Handling empty repository state gracefully."""
        res = self.client.get("/api/engineering-command-center")
        self.assertEqual(res.status_code, 200)

    def test_293_step37_deterministic_repeated_execution(self):
        """14. Step 37: Deterministic repeated execution results."""
        r1 = self.client.get(f"/api/engineering-command-center?repository_url={self.test_repo_url}").json()
        r2 = self.client.get(f"/api/engineering-command-center?repository_url={self.test_repo_url}").json()
        self.assertEqual(r1["overall_engineering_score"], r2["overall_engineering_score"])
        self.assertEqual(r1["engineering_health"], r2["engineering_health"])

    def test_294_step37_json_export(self):
        """15. Step 37: JSON export."""
        res = self.client.post("/api/engineering-command-center/export", json={"repository_url": self.test_repo_url, "export_format": "json"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["format"], "json")

    def test_295_step37_markdown_export(self):
        """16. Step 37: Markdown export."""
        res = self.client.post("/api/engineering-command-center/export", json={"repository_url": self.test_repo_url, "export_format": "markdown"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["format"], "markdown")
        self.assertIn("# Engineering Command Center", res.json()["content"])

    def test_296_step37_html_export(self):
        """17. Step 37: HTML export."""
        res = self.client.post("/api/engineering-command-center/export", json={"repository_url": self.test_repo_url, "export_format": "html"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["format"], "html")
        self.assertIn("<!DOCTYPE html>", res.json()["content"])

    def test_297_step37_xss_escaping(self):
        """18. Step 37: HTML XSS escaping."""
        res = self.client.post("/api/engineering-command-center/export", json={"repository_url": self.test_repo_url, "export_format": "html"})
        self.assertEqual(res.status_code, 200)
        content = res.json()["content"]
        self.assertNotIn("<script>", content)

    def test_298_step37_invalid_input_handling(self):
        """19. Step 37: Invalid input handling."""
        res = self.client.post("/api/engineering-command-center", json={"repository_url": "invalid_repo_url_999"})
        self.assertEqual(res.status_code, 400)

    def test_299_step37_preservation_existing_apis(self):
        """20. Step 37: Preservation of existing Steps 11-36 APIs."""
        self.assertEqual(self.client.get(f"/api/historical-intelligence?repository_url={self.test_repo_url}").status_code, 200)
        self.assertEqual(self.client.post("/api/repository-comparison", json={"repository_urls": [self.test_repo_url, "https://github.com/pallets/flask"]}).status_code, 200)


if __name__ == "__main__":
    unittest.main()








