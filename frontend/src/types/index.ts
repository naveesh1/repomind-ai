export interface PythonFileInfo {
  file: string;
  functions: string[];
  classes: string[];
  imports: string[];
}

export interface AnalyzeApiRequest {
  repository_url: string;
  github_token?: string;
}

export interface AnalyzeApiResponse {
  status: string;
  repository_url: string;
  repository_name: string;
  total_files: number;
  source_files: number;
  test_files: number;
  directories: number;
  python_files: PythonFileInfo[];
  dependency_graph: Record<string, string[]>;
  message?: string;
}

export interface ImpactAnalysisApiRequest {
  repository_url: string;
  changed_file: string;
  changed_function?: string;
}

export interface ImpactAnalysisApiResponse {
  status: string;
  changed_file: string;
  changed_function?: string;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impacted_files: string[];
  impacted_file_count: number;
  direct_dependents: string[];
  transitive_dependents: string[];
  reason: string;
  message?: string;
}

export type ImpactAnalysisResponse = ImpactAnalysisApiResponse;

export interface SimulateChangeApiRequest {
  repository_url: string;
  changed_file: string;
  changed_function?: string;
  change_description?: string;
}

export interface SimulateChangeApiResponse {
  status: string;
  changed_file: string;
  changed_function?: string;
  change_description?: string;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impacted_file_count: number;
  impacted_files: string[];
  direct_dependents: string[];
  transitive_dependents: string[];
  affected_tests: string[];
  review_recommendations: string[];
  summary: string;
  message?: string;
}

export type SimulateChangeResponse = SimulateChangeApiResponse;

export interface CodeChangeSimulationResponse {
  status: string;
  changed_file: string;
  changed_function?: string;
  proposed_change?: string;
  change_description?: string;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impacted_files: string[];
  impacted_file_count: number;
  direct_dependents: string[];
  transitive_dependents: string[];
  affected_tests?: string[];
  review_recommendations?: string[];
  reason: string;
  summary?: string;
  message?: string;
}

export interface ChangeExplanationApiRequest {
  repository_url?: string;
  changed_file: string;
  changed_function?: string;
  proposed_change?: string;
  change_description?: string;
}

export interface ChangeExplanationResponse {
  status: string;
  summary: string;
  change_description: string;
  risk_explanation: string;
  important_files: string[];
  direct_dependency_explanation: string;
  transitive_dependency_explanation: string;
  recommended_tests: string[];
  recommendation: string;
  message?: string;
}

export interface RepositoryHealthApiRequest {
  repository_url: string;
}

export interface HighImpactFileRecord {
  file: string;
  direct_dependents: number;
  imports: number;
}

export interface RepositoryHealthResponse {
  status: string;
  repository_name: string;
  total_files: number;
  source_files: number;
  test_files: number;
  directories: number;
  python_files: number;
  total_functions: number;
  total_classes: number;
  total_imports: number;
  dependency_connections: number;
  health_score: number;
  health_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_indicators: string[];
  high_impact_files: HighImpactFileRecord[];
  recommendations: string[];
  message?: string;
}

export interface FileMetricRecord {
  file: string;
  lines: number;
  functions: number;
  classes: number;
  max_complexity: number;
  max_nesting_depth: number;
  quality_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface CodeQualityResponse {
  status: string;
  quality_score: number;
  quality_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  total_files_analyzed: number;
  total_functions: number;
  complex_functions: number;
  large_files: number;
  deeply_nested_functions: number;
  issues: string[];
  file_metrics: FileMetricRecord[];
  recommendations: string[];
  message?: string;
}

export interface KeyMetricsRecord {
  total_files: number;
  source_files: number;
  test_files: number;
  directories: number;
  python_files: number;
  total_functions: number;
  total_classes: number;
  total_imports: number;
  dependency_connections: number;
  complex_functions: number;
  large_files: number;
  deeply_nested_functions: number;
}

export interface ExecutiveSummaryResponse {
  status: string;
  repository_name: string;
  repository_url: string;
  generated_at: string;
  overall_grade: 'A' | 'B' | 'C' | 'D' | 'F';
  overall_score: number;
  health_score: number;
  quality_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary_narrative: string;
  key_metrics: KeyMetricsRecord;
  critical_risks: string[];
  top_bottleneck_files: HighImpactFileRecord[];
  executive_recommendations: string[];
  message?: string;
}

export interface FileChangeRecord {
  file: string;
  change_type: 'ADDED' | 'MODIFIED' | 'DELETED' | 'RENAMED';
  old_path?: string | null;
  lines_added: number;
  lines_removed: number;
}

export interface FunctionChangeRecord {
  file: string;
  function_name: string;
  change_type: 'ADDED' | 'MODIFIED' | 'DELETED';
}

export interface ClassChangeRecord {
  file: string;
  class_name: string;
  change_type: 'ADDED' | 'MODIFIED' | 'DELETED';
}

export interface DependencyChangeRecord {
  file: string;
  import_name: string;
  change_type: 'ADDED' | 'DELETED';
}

export interface ChangeDetectionSummary {
  total_files_changed: number;
  added_files_count: number;
  modified_files_count: number;
  deleted_files_count: number;
  renamed_files_count: number;
  lines_added: number;
  lines_removed: number;
  python_files_changed: number;
  functions_changed: number;
  classes_changed: number;
  dependency_changes: number;
}

export interface ChangeDetectionResponse {
  status: string;
  repository_name: string;
  repository_url: string;
  base_revision: string;
  target_revision: string;
  summary: ChangeDetectionSummary;
  file_changes: FileChangeRecord[];
  function_changes: FunctionChangeRecord[];
  class_changes: ClassChangeRecord[];
  dependency_changes: DependencyChangeRecord[];
  message?: string;
}

export interface CommitAnalysisResponse {
  status: string;
  repository_name: string;
  repository_url: string;
  commit_sha: string;
  parent_sha: string;
  commit_message: string;
  author: string;
  date: string;
  files_changed: number;
  lines_added: number;
  lines_removed: number;
  added_files: FileChangeRecord[];
  modified_files: FileChangeRecord[];
  deleted_files: FileChangeRecord[];
  renamed_files: FileChangeRecord[];
  function_changes: FunctionChangeRecord[];
  class_changes: ClassChangeRecord[];
  dependency_changes: DependencyChangeRecord[];
  message?: string;
}

export interface TestImpactRecord {
  test_file: string;
  impact_type: 'DIRECT' | 'INDIRECT' | 'POSSIBLE' | 'UNAFFECTED';
  priority?: 'P0' | 'P1' | 'P2' | 'P3';
  confidence?: number;
  reason: string;
  dependency_path?: string[];
}

export interface TestImpactResponse {
  status: string;
  repository_name: string;
  repository_url: string;
  changed_file: string;
  changed_function?: string | null;
  total_tests: number;
  direct_tests: number;
  indirect_tests: number;
  possible_tests: number;
  unaffected_tests?: number;
  recommended_count?: number;
  high_confidence_count?: number;
  affected_tests: TestImpactRecord[];
  recommended_tests: string[];
  reason: string;
  message?: string;
}

export interface RegressionRiskFactors {
  target_file: string;
  changed_function?: string | null;
  changed_files_count: number;
  lines_added: number;
  lines_removed: number;
  affected_functions_count: number;
  affected_classes_count: number;
  affected_functions: string[];
  affected_classes: string[];
  impact_radius: number;
  affected_files: string[];
  direct_tests_count: number;
  indirect_tests_count: number;
  possible_tests_count: number;
  high_confidence_tests_count: number;
  affected_tests: TestImpactRecord[];
  recommended_tests: string[];
  complex_functions_count: number;
  large_files_count: number;
  deep_nesting_count: number;
  central_bottleneck_score: number;
  test_coverage_indicator: number;
  in_degree: number;
}

export interface RegressionRiskResponse {
  status: string;
  repository_name: string;
  repository_url: string;
  target_file: string;
  changed_function?: string | null;
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_factors: RegressionRiskFactors;
  affected_files: string[];
  affected_functions: string[];
  affected_classes: string[];
  affected_tests: TestImpactRecord[];
  direct_tests: number;
  indirect_tests: number;
  possible_tests: number;
  high_confidence_tests: number;
  recommended_tests: string[];
  recommendations: string[];
  explanation: string;
  message?: string;
}

export interface ChangeRiskFactorRecord {
  id: string;
  title: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  summary: string;
  details: string;
}

export interface AffectedScopeRecord {
  impact_radius: number;
  affected_files: string[];
  affected_functions: string[];
  affected_classes: string[];
  target_complex_functions_count: number;
  target_max_complexity: number;
}

export interface TestImpactSummaryRecord {
  direct_tests: number;
  indirect_tests: number;
  possible_tests: number;
  high_confidence_tests: number;
  total_affected_tests: number;
}

export interface CategorizedTestsRecord {
  p0_tests: string[];
  p1_tests: string[];
  p2_tests: string[];
  p3_tests: string[];
}

export interface ChangeRiskExplanationResponse {
  status: string;
  repository_name: string;
  repository_url: string;
  target_file: string;
  changed_function?: string | null;
  proposed_change?: string | null;
  change_description?: string | null;
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  executive_summary: string;
  risk_explanation: string;
  top_risk_factors: ChangeRiskFactorRecord[];
  affected_scope: AffectedScopeRecord;
  test_impact_summary: TestImpactSummaryRecord;
  test_execution_order: string[];
  categorized_tests: CategorizedTestsRecord;
  affected_tests: TestImpactRecord[];
  recommended_tests: string[];
  recommendations: string[];
  message?: string;
}

export interface ActionItemRecord {
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  action: string;
  description: string;
}

export interface ChangeDecisionResponse {
  status: string;
  repository_name: string;
  repository_url: string;
  target_file: string;
  changed_function?: string | null;
  proposed_change?: string | null;
  change_description?: string | null;
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  decision: 'READY' | 'READY WITH CAUTION' | 'REVIEW REQUIRED' | 'BLOCKED';
  merge_readiness: 'READY' | 'NOT READY';
  confidence_score: number;
  decision_explanation: string;
  blockers: string[];
  warnings: string[];
  required_actions: ActionItemRecord[];
  recommended_tests: string[];
  categorized_tests: CategorizedTestsRecord;
  affected_scope: AffectedScopeRecord;
  test_impact_summary: TestImpactSummaryRecord;
  recommendations: string[];
  message?: string;
}

export interface RevisionMetricsRecord {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impact_radius: number;
  direct_tests: number;
  indirect_tests: number;
  total_affected_tests: number;
}

export interface HistoricalRiskDeltaRecord {
  score_change: number;
  files_changed_count: number;
  added_files_count: number;
  deleted_files_count: number;
  modified_files_count: number;
  additions: number;
  deletions: number;
  total_lines_changed: number;
  change_intensity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface HistoricalRiskResponse {
  status: string;
  repository_name: string;
  repository_url: string;
  base_revision: string;
  target_revision: string;
  risk_trend: 'IMPROVED' | 'UNCHANGED' | 'INCREASED' | 'SIGNIFICANTLY INCREASED';
  score_change: number;
  explanation: string;
  base_metrics: RevisionMetricsRecord;
  target_metrics: RevisionMetricsRecord;
  delta_metrics: HistoricalRiskDeltaRecord;
  ast_diff_summary: {
    changed_files: string[];
    added_files: string[];
    deleted_files: string[];
    modified_files: string[];
    added_functions: string[];
    deleted_functions: string[];
    modified_functions: string[];
  };
  message?: string;
}

export interface RenamedFileRecord {
  old_path: string;
  new_path: string;
}

export interface RepoDiffSummaryRecord {
  changed_files: string[];
  added_files: string[];
  modified_files: string[];
  deleted_files: string[];
  renamed_files: (string | RenamedFileRecord)[];
  total_files_changed: number;
  additions: number;
  deletions: number;
}

export interface RepoTrackingResponse {
  status: string;
  repository_url: string;
  owner: string;
  repository_name: string;
  current_analyzed_revision: string;
  previous_analyzed_revision: string;
  branch: string;
  analysis_timestamp: string;
  refresh_status: 'INITIALIZED' | 'REFRESHED' | 'UNCHANGED';
  has_changes: boolean;
  diff_summary: RepoDiffSummaryRecord;
  historical_risk: {
    risk_trend: 'IMPROVED' | 'UNCHANGED' | 'INCREASED' | 'SIGNIFICANTLY INCREASED';
    score_change: number;
    explanation: string;
    base_score: number;
    target_score: number;
  };
  change_decision: {
    decision: 'READY' | 'READY WITH CAUTION' | 'REVIEW REQUIRED' | 'BLOCKED';
    merge_readiness: 'READY' | 'NOT READY';
    confidence_score: number;
    decision_explanation: string;
    blockers_count: number;
    warnings_count: number;
    required_actions: any[];
    recommended_tests: string[];
  };
  message?: string;
}

export interface AlertRecord {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  explanation: string;
  related_files: string[];
  related_info: string;
  timestamp: string;
  recommended_action: string;
}

export interface MonitoringMetricsRecord {
  previous_score: number;
  current_score: number;
  score_delta: number;
  previous_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  current_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_trend: 'IMPROVED' | 'UNCHANGED' | 'INCREASED' | 'SIGNIFICANTLY INCREASED';
  display_delta: string;
}

export interface RepoMonitorResponse {
  status: string;
  repository_url: string;
  owner: string;
  repository_name: string;
  previous_analyzed_revision: string;
  current_analyzed_revision: string;
  latest_available_revision: string;
  last_analysis_timestamp: string;
  monitoring_status: 'NO_CHANGE' | 'CHANGES_DETECTED' | 'ANALYSIS_REQUIRED' | 'ERROR';
  risk_summary: MonitoringMetricsRecord;
  diff_metrics: {
    changed_files_count: number;
    added_files_count: number;
    modified_files_count: number;
    deleted_files_count: number;
    renamed_files_count: number;
    additions: number;
    deletions: number;
    changed_files: string[];
    added_files: string[];
    modified_files: string[];
    deleted_files: string[];
    renamed_files: (string | RenamedFileRecord)[];
  };
  test_impact_summary: {
    new_p0_tests_count: number;
    new_p1_tests_count: number;
    total_affected_tests: number;
    new_p0_tests: string[];
    new_p1_tests: string[];
  };
  decision_summary: {
    decision: 'READY' | 'READY WITH CAUTION' | 'REVIEW REQUIRED' | 'BLOCKED';
    merge_readiness: 'READY' | 'NOT READY';
    new_blockers_count: number;
    new_warnings_count: number;
    blockers: string[];
    warnings: string[];
  };
  alerts: AlertRecord[];
  message?: string;
}

export interface NotificationPayloadRecord {
  id: string;
  repository_url: string;
  owner: string;
  repository_name: string;
  previous_revision: string;
  current_revision: string;
  latest_revision: string;
  monitoring_status: string;
  timestamp: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  explanation: string;
  related_files: string[];
  risk_information: string;
  previous_risk_score: number;
  current_risk_score: number;
  risk_delta: number;
  risk_trend: string;
  previous_risk_level: string;
  current_risk_level: string;
  affected_tests_count: number;
  new_p0_tests_count: number;
  new_p1_tests_count: number;
  decision: string;
  merge_readiness: string;
  blockers_count: number;
  blockers: string[];
  recommended_action: string;
}

export interface AlertNotificationsResponse {
  status: string;
  repository_url: string;
  owner: string;
  repository_name: string;
  monitoring_status: string;
  timestamp: string;
  severity_filter: 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;
  total_alerts_count: number;
  filtered_alerts_count: number;
  notifications: NotificationPayloadRecord[];
  message?: string;
}

export interface ExportAuditReportResponse {
  status: string;
  format: 'json' | 'markdown' | 'html';
  content_type: string;
  filename: string;
  content: any;
  message?: string;
}

export interface MonitoredRepoCardData {
  repository_url: string;
  owner: string;
  repo_name: string;
  previous_revision: string;
  latest_revision: string;
  monitoring_status: 'NO_CHANGE' | 'CHANGES_DETECTED' | 'ERROR' | string;
  risk_score: number;
  risk_delta: string;
  risk_level: string;
  decision: string;
  blockers_count: number;
  alerts_count: number;
  alerts?: any[];
}

export interface MultiRepoSummaryResponse {
  status: string;
  total_monitored_repositories: number;
  high_risk_repositories_count: number;
  total_new_blockers: number;
  total_alerts_count: number;
  status_distribution: Record<string, number>;
  repositories: MonitoredRepoCardData[];
}

export interface MultiRepoExportResponse {
  status: string;
  format: 'json' | 'markdown' | 'html';
  content_type: string;
  filename: string;
  content: any;
}

export interface ReleaseChecklistItem {
  id: string;
  title: string;
  description: string;
  passed: boolean;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  value: string;
}

export interface ReleaseGatingResponse {
  status: string;
  repository_url: string;
  owner: string;
  repo_name: string;
  release_gate_status: 'APPROVED_FOR_RELEASE' | 'CONDITIONAL_RELEASE' | 'RELEASE_BLOCKED' | string;
  gate_summary: string;
  regression_risk_score: number;
  risk_level: string;
  new_blockers_count: number;
  alerts_count: number;
  checklist: ReleaseChecklistItem[];
  passed_checks_count: number;
  total_checks_count: number;
}

export interface ReleaseCertificateExportResponse {
  status: string;
  format: 'json' | 'markdown' | 'html';
  content_type: string;
  filename: string;
  content: any;
}

export interface EngineeringRecommendation {
  id: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  category: 'RISK' | 'TESTING' | 'CODE_QUALITY' | 'RELEASE' | 'MONITORING' | 'MAINTAINABILITY';
  reason: string;
  affected_metric: string;
  recommended_action: string;
}

export interface GovernanceFactors {
  risk: number;
  testing: number;
  code_quality: number;
  monitoring: number;
  release: number;
}

export interface EngineeringGovernanceResponse {
  status: string;
  repository_url: string;
  owner: string;
  repo_name: string;
  current_revision: string;
  previous_revision: string;
  monitoring_status: string;
  governance_score: {
    overall_score: number;
    overall_health: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL' | string;
    factors: GovernanceFactors;
  };
  indicators: {
    risk_trend: 'IMPROVING' | 'STABLE' | 'DETERIORATING' | string;
    test_health: 'HEALTHY' | 'ATTENTION_REQUIRED' | 'CRITICAL' | string;
    code_quality_status: 'HEALTHY' | 'ATTENTION_REQUIRED' | 'CRITICAL' | string;
    release_confidence: 'HIGH' | 'MEDIUM' | 'LOW' | string;
    overall_engineering_health: string;
  };
  health_metrics: {
    repository_health_score: number;
    maintainability_classification: string;
    code_quality_score: number;
    test_to_source_ratio: number;
  };
  risk_metrics: {
    current_regression_risk: number;
    previous_regression_risk: number;
    risk_delta: number;
    risk_trend: string;
    critical_alerts_count: number;
    high_alerts_count: number;
    medium_alerts_count: number;
    low_alerts_count: number;
  };
  change_metrics: {
    changed_files_count: number;
    affected_test_count: number;
  };
  decision_metrics: {
    merge_decision: string;
    release_gate_status: string;
    new_blockers_count: number;
  };
  recommendations: EngineeringRecommendation[];
}

export interface GovernanceReportExportResponse {
  status: string;
  format: 'json' | 'markdown' | 'html';
  content_type: string;
  filename: string;
  content: any;
}

export interface HistoricalSnapshot {
  revision: string;
  risk_score: number;
  repository_health: number;
  code_quality: number;
  governance_score: number;
  affected_tests: number;
  critical_alerts: number;
  high_alerts: number;
  blockers: number;
  release_status: string;
  overall_trend: string;
}

export interface RiskHotspot {
  file_module: string;
  occurrence_count: number;
  average_risk_contribution: number;
  latest_risk_contribution: number;
  trend: 'IMPROVING' | 'STABLE' | 'DETERIORATING' | string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;
}

export interface AlertHistorySummary {
  total_alerts: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  active_alerts_count: number;
  alert_trend: string;
}

export interface ReleaseHistorySummary {
  total_evaluated_releases: number;
  approved_count: number;
  conditional_count: number;
  blocked_count: number;
  latest_release_status: string;
  release_trend: string;
}

export interface HistoricalIntelligenceReport {
  status: string;
  repository_url: string;
  owner: string;
  repo_name: string;
  current_revision: string;
  previous_revision: string;
  trends: {
    overall_engineering_trend: 'IMPROVING' | 'STABLE' | 'DETERIORATING' | string;
    risk_trend: 'IMPROVING' | 'STABLE' | 'DETERIORATING' | string;
    health_trend: 'IMPROVING' | 'STABLE' | 'DETERIORATING' | string;
    quality_trend: 'IMPROVING' | 'STABLE' | 'DETERIORATING' | string;
    testing_trend: 'IMPROVING' | 'STABLE' | 'DETERIORATING' | string;
    monitoring_trend: 'IMPROVING' | 'STABLE' | 'DETERIORATING' | string;
  };
  risk_summary: {
    current_risk_score: number;
    previous_risk_score: number;
    risk_delta: number;
    risk_trend: string;
  };
  governance_summary: {
    current_score: number;
    previous_score: number;
    delta: number;
    trend: string;
  };
  quality_summary: {
    repository_health: number;
    code_quality: number;
    maintainability: string;
  };
  testing_summary: {
    affected_tests_count: number;
    test_to_source_ratio: number;
    p0_tests_count: number;
    p1_tests_count: number;
    p2_tests_count: number;
    p3_tests_count: number;
  };
  alert_history: AlertHistorySummary;
  release_history: ReleaseHistorySummary;
  risk_hotspots: RiskHotspot[];
  timeline: HistoricalSnapshot[];
}

export interface HistoricalIntelligenceExportResponse {
  status: string;
  format: 'json' | 'markdown' | 'html';
  content_type: string;
  filename: string;
  content: any;
}

export interface RepoAnalysisFormState {
  repoUrl: string;
  githubToken?: string;
  showAdvancedAuth?: boolean;
  isSubmitting: boolean;
  error: string | null;
  apiResponse: AnalyzeApiResponse | null;
}

export interface FeatureCardItem {
  id: string;
  title: string;
  description: string;
  iconName: 'graph' | 'risk' | 'scope' | 'ci';
}

export interface StatusBadgeProps {
  label: string;
  online: boolean;
}

export interface ComparedRepoSummary {
  repository_url: string;
  owner: string;
  repo_name: string;
  full_name: string;
  rank: number;
  benchmark_score: number;
  governance_score: number;
  regression_risk_score: number;
  risk_safety_score: number;
  repository_health: number;
  code_quality: number;
  test_to_source_ratio: number;
  testing_health_score: number;
  monitoring_score: number;
  release_confidence_score: number;
  release_gate_status: string;
  total_alerts: number;
  strongest_metric: string;
  weakest_metric: string;
}

export interface MetricLeader {
  metric: string;
  leader: string;
  score: number;
}

export interface MetricGap {
  metric: string;
  leader: string;
  lagger: string;
  highest_score: number;
  lowest_score: number;
  gap: number;
}

export interface RepositoryComparisonResponse {
  status: string;
  repositories: ComparedRepoSummary[];
  rankings: ComparedRepoSummary[];
  comparison_metrics: MetricLeader[];
  overall_winner: string;
  weakest_repository: string;
  metric_leaders: MetricLeader[];
  metric_gaps: MetricGap[];
  insights: string[];
  generated_at: string;
}

export interface RepositoryComparisonExportResponse {
  status: string;
  format: 'json' | 'markdown' | 'html';
  content_type: string;
  filename: string;
  content: any;
}

export interface EngineeringRiskItem {
  priority: 'P0' | 'P1' | 'P2' | 'P3' | string;
  category: string;
  repository: string;
  metric: string;
  score: number;
  explanation: string;
  recommended_action: string;
}

export interface EngineeringRecommendationItem {
  priority: 'P0' | 'P1' | 'P2' | 'P3' | string;
  category: string;
  title: string;
  explanation: string;
  action: string;
}

export interface EngineeringEventItem {
  repository: string;
  event_type: string;
  severity: 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO' | string;
  summary: string;
}

export interface CommandCenterTrendSummary {
  risk_trend: string;
  governance_trend: string;
  health_trend: string;
  testing_trend: string;
  release_trend: string;
}

export interface EngineeringCommandCenterResponse {
  status: string;
  repository_url: string;
  owner: string;
  repo_name: string;
  full_name: string;
  executive_summary: string;
  overall_engineering_score: number;
  engineering_health: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL' | string;
  system_status: 'HEALTHY' | 'ATTENTION_REQUIRED' | 'DEGRADED' | 'CRITICAL' | string;
  current_regression_risk: number;
  governance_score: number;
  repository_health: number;
  architecture_health?: number;
  code_quality: number;
  testing_health: number;
  release_confidence: number;
  release_gate_status: string;
  monitoring_status: string;
  active_alerts: number;
  critical_alerts: number;
  high_alerts: number;
  high_risk_repositories: number;
  release_blockers: number;
  historical_risk_trend: string;
  engineering_health_trend: string;
  top_risks: EngineeringRiskItem[];
  recommendations: EngineeringRecommendationItem[];
  repository_leaderboard: ComparedRepoSummary[];
  trend_summary: CommandCenterTrendSummary;
  recent_events: EngineeringEventItem[];
  generated_at: string;
}

export interface EngineeringCommandCenterExportResponse {
  status: string;
  format: 'json' | 'markdown' | 'html';
  content_type: string;
  filename: string;
  content: any;
}

export interface InvestigationEvidenceItem {
  category: 'DEPENDENCY' | 'COMPLEXITY' | 'TESTING' | 'CHANGE' | 'HISTORY' | 'MONITORING' | 'GOVERNANCE' | 'RELEASE' | string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' | string;
  metric: string;
  current_value: any;
  threshold?: any;
  explanation: string;
  source: string;
}

export interface AffectedFileAnalysisItem {
  path: string;
  impact_type: 'DIRECT' | 'INDIRECT' | 'POSSIBLE' | string;
  dependency_depth: number;
  risk_level: string;
  reason: string;
}

export interface FunctionImpactAnalysisItem {
  file: string;
  function: string;
  complexity: number;
  nesting_depth: number;
  changed: boolean;
  affected: boolean;
  risk_level: string;
}

export interface DependencyPathAnalysisItem {
  source: string;
  intermediate_nodes: string[];
  target: string;
  depth: number;
  impact_level: string;
  formatted_path: string;
}

export interface InvestigatedTestItem {
  test_file: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3' | string;
  dependency_path: string;
  reason: string;
  recommended_execution_order: number;
}

export interface RiskFactorBreakdown {
  dependency_radius: number;
  target_complexity: number;
  module_fanout: number;
  test_coverage_gap: number;
  total_score: number;
  max_score: number;
}

export interface HistoricalContextData {
  previous_risk: number;
  current_risk: number;
  risk_delta: number;
  historical_trend: string;
  previous_release_status: string;
  recurring_hotspots: string[];
}

export interface ReleaseImpactData {
  release_status: string;
  blockers: any[];
  precautions: string[];
  release_confidence: number;
  affects_release_readiness: boolean;
}

export interface GovernanceImpactData {
  governance_score: number;
  affected_governance_category: string;
  governance_recommendation: string;
  engineering_health_impact: string;
}

export interface EngineeringInvestigationResponse {
  status: string;
  investigation_id: string;
  repository: string;
  owner: string;
  repo_name: string;
  full_name: string;
  target: string;
  target_type: string;
  overall_risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  risk_category: string;
  risk_score: number;
  investigation_status: string;
  summary: string;
  evidence: InvestigationEvidenceItem[];
  affected_files: AffectedFileAnalysisItem[];
  affected_functions: FunctionImpactAnalysisItem[];
  dependency_paths: DependencyPathAnalysisItem[];
  affected_tests: InvestigatedTestItem[];
  risk_factors: RiskFactorBreakdown;
  historical_context: HistoricalContextData;
  alerts: any[];
  release_impact: ReleaseImpactData;
  governance_impact: GovernanceImpactData;
  recommendations: EngineeringRecommendationItem[];
  next_actions: string[];
  generated_at: string;
}

export interface EngineeringInvestigationExportResponse {
  status: string;
  format: 'json' | 'markdown' | 'html';
  content_type: string;
  filename: string;
  content: any;
}

export interface RemediationDetails {
  problem: string;
  why_it_matters: string;
  recommended_remediation: string;
  verification_criteria: string;
}

export interface ActionHistoryItem {
  from_status: string;
  to_status: string;
  timestamp: string;
  reason: string;
}

export interface EngineeringAction {
  action_id: string;
  repository_url: string;
  repository_name: string;
  source: string;
  source_reference: string;
  title: string;
  description: string;
  category: 'RISK' | 'TESTING' | 'CODE_QUALITY' | 'DEPENDENCY' | 'MONITORING' | 'RELEASE' | 'GOVERNANCE' | 'MAINTAINABILITY' | string;
  priority: 'P0' | 'P1' | 'P2' | 'P3' | string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;
  affected_files: string[];
  affected_tests: string[];
  risk_score: number;
  governance_score: number;
  release_status: string;
  recommended_action: string;
  remediation_details: RemediationDetails;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'VERIFIED' | 'CLOSED' | string;
  created_at: string;
  updated_at: string;
  verification_status: 'PENDING' | 'VERIFIED' | 'VERIFICATION_FAILED' | string;
  verification_message: string;
  history: ActionHistoryItem[];
}

export interface EngineeringActionSummary {
  status: string;
  total_actions: number;
  open_actions: number;
  in_progress_actions: number;
  resolved_actions: number;
  verified_actions: number;
  closed_actions: number;
  p0_count: number;
  p1_count: number;
  p2_count: number;
  p3_count: number;
  overdue_or_stale_count: number;
  repositories_with_actions: number;
  resolution_rate: number;
  verification_rate: number;
  highest_priority_action: string;
  highest_risk_repository: string;
  most_common_category: string;
  most_common_issue: string;
  actions: EngineeringAction[];
}

export interface EngineeringActionTransitionRequest {
  new_status: string;
  reason?: string;
}

export interface EngineeringActionVerificationResponse {
  status: string;
  action: EngineeringAction;
}

export interface EngineeringActionExportResponse {
  status: string;
  format: 'json' | 'markdown' | 'html';
  content_type: string;
  filename: string;
  content: any;
}

export interface CanonicalMetrics {
  regression_risk: number;
  governance_score: number;
  repository_health: number;
  code_quality: number;
  testing_health: number;
  monitoring_score: number;
  release_confidence: number;
  maintainability: number;
  historical_risk_trend: string;
  engineering_health: 'EXCELLENT' | 'HEALTHY' | 'GOOD' | 'FAIR' | 'DEGRADED' | string;
  overall_engineering_score: number;
}

export interface MetricProvenanceItem {
  metric: string;
  value: any;
  source_engine: string;
  calculation_basis: string;
  status: string;
}

export interface ConsistencyCheckItem {
  component: string;
  service: string;
  displayed_risk: number;
  is_consistent: boolean;
}

export interface UnifiedIntelligenceResponse {
  status: string;
  repository_url: string;
  owner: string;
  repo_name: string;
  full_name: string;
  single_source_of_truth: boolean;
  consistency_status: 'CONSISTENT' | 'WARNING' | 'INCONSISTENT' | string;
  consistency_score: number;
  canonical_metrics: CanonicalMetrics;
  metric_provenance: MetricProvenanceItem[];
  consistency_checks: ConsistencyCheckItem[];
  validation_warnings: string[];
  generated_at: string;
}

export interface UnifiedIntelligenceExportResponse {
  status: string;
  format: 'json' | 'markdown' | 'html';
  content_type: string;
  filename: string;
  content: any;
}

export interface AuditEventItem {
  event_id: string;
  timestamp: string;
  repository_url: string;
  repository_name: string;
  event_type: string;
  source_step: string;
  target: string;
  target_type: string;
  risk_score: number;
  governance_score: number;
  engineering_score: number;
  release_status: string;
  action_id?: string;
  investigation_id?: string;
  previous_state?: string;
  new_state?: string;
  decision?: string;
  explanation: string;
  evidence: any;
  verification_status: string;
}

export interface EngineeringDecisionItem {
  decision_id: string;
  timestamp: string;
  repository_url: string;
  decision: string;
  reason: string;
  risk_score: number;
  evidence: any;
  related_action?: string;
  related_investigation?: string;
  release_status: string;
}

export interface MetricComparison {
  comparison_status: string;
  previous_risk_score: number | null;
  current_risk_score: number;
  risk_delta: number | null;
  previous_governance_score: number | null;
  current_governance_score: number;
  governance_delta: number | null;
  previous_engineering_score: number | null;
  current_engineering_score: number;
  engineering_delta: number | null;
  previous_release_status: string | null;
  current_release_status: string;
  outcome: string;
}

export interface AuditOverview {
  total_audit_events: number;
  open_decisions: number;
  completed_investigations: number;
  active_actions: number;
  verified_actions: number;
  release_decisions: number;
  successful_remediations: number;
}

export interface EngineeringAuditHistoryResponse {
  status: string;
  repository_url: string;
  repository_name: string;
  canonical_metrics: CanonicalMetrics;
  release_status: string;
  engineering_outcome: string;
  audit_overview: AuditOverview;
  metric_comparison: MetricComparison;
  audit_events: AuditEventItem[];
  decisions: EngineeringDecisionItem[];
  historical_intelligence?: any;
}

export interface EngineeringAuditHistoryExportResponse {
  status: string;
  format: 'json' | 'markdown' | 'html';
  content_type: string;
  filename: string;
  content: any;
}

export interface PRFileChangeDetail {
  file: string;
  change_type: 'ADDED' | 'MODIFIED' | 'DELETED' | 'RENAMED' | string;
  lines_added: number;
  lines_removed: number;
  net_lines: number;
  impact_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  complexity_delta: number;
}

export interface PRAffectedTestItem {
  test_file: string;
  test_type: 'DIRECT' | 'INDIRECT' | 'POSSIBLE' | string;
  priority: 'P0' | 'P1' | 'P2' | 'P3' | string;
  recommended_order: number;
  dependency_path: string;
}

export interface PRReviewSummary {
  what_changed: string;
  why_it_matters: string;
  highest_risks: string;
  affected_tests_summary: string;
  blockers_summary: string;
  recommended_actions_summary: string;
}

export interface PullRequestIntelligenceResponse {
  status: string;
  repository_url: string;
  repository_name: string;
  pr_id: string;
  pr_title: string;
  base_revision: string;
  head_revision: string;
  pr_decision: 'READY' | 'NEEDS_REVIEW' | 'BLOCKED' | string;
  decision_reason: string;
  change_intensity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  canonical_metrics: CanonicalMetrics;
  regression_risk: number;
  risk_level: string;
  governance_score: number;
  engineering_score: number;
  release_status: string;
  diff_summary: {
    total_files_changed: number;
    lines_added: number;
    lines_removed: number;
    added_files_count: number;
    modified_files_count: number;
    deleted_files_count: number;
    functions_changed_count: number;
    classes_changed_count: number;
    dependency_changes_count: number;
  };
  changed_files: PRFileChangeDetail[];
  added_files: string[];
  modified_files: string[];
  deleted_files: string[];
  ast_changes: {
    functions_changed: any[];
    classes_changed: any[];
    dependency_changes: any[];
  };
  dependency_impact: {
    dependency_radius: number;
    affected_modules: string[];
    dependency_paths: string[];
  };
  test_impact: {
    total_affected_tests: number;
    affected_tests: PRAffectedTestItem[];
    test_coverage_gap: number;
  };
  governance_and_release: {
    governance_score: number;
    release_status: string;
    policy_violations: string[];
    quality_concerns: string[];
    blockers: string[];
    precautions: string[];
  };
  review_summary: PRReviewSummary;
  integrations: {
    investigation_id: string;
    investigation_target: string;
    actions_count: number;
    actions: any[];
  };
}

export interface CopilotUserContext {
  user_id: string;
  role: string;
  permission_validated?: string;
}

export interface CopilotQueryRequest {
  query: string;
  repository_url?: string;
  pr_id?: string;
  file_path?: string;
  function_name?: string;
  base_revision?: string;
  head_revision?: string;
  github_token?: string;
}

export interface CopilotQueryResponse {
  status: string;
  intent: 'REPO_HEALTH' | 'PR_RISK_AND_DECISION' | 'CODE_AND_IMPACT' | 'REMEDIATION_AND_ACTION' | 'GENERAL_ENGINEERING' | string;
  repository_url: string;
  answer: string;
  canonical_metrics?: CanonicalMetrics;
  release_gate_evaluation?: any;
  impact_analysis?: any;
  test_impact?: any;
  audit_overview?: AuditOverview;
  active_actions?: any[];
  evidence: string[];
  source_services: string[];
  suggested_followups: string[];
  user_context?: CopilotUserContext;
  timestamp?: string;
  message?: string;
  error_code?: string;
}

export interface CopilotExportResponse {
  status: string;
  format: 'json' | 'markdown' | 'html';
  content_type: string;
  filename: string;
  data?: any;
  content?: any;
}

export interface SelectedTestItem {
  test_file: string;
  execution_tier: string;
  tier_order: number;
  priority: string;
  impact_type: string;
  confidence: number;
  origin_files: string[];
  dependency_trace: string;
  why_selected: string;
  estimated_duration_sec: number;
}

export interface OmittedTestItem {
  test_file: string;
  confidence: number;
  exclusion_reason: string;
}

export interface SmartTestSelectionSummary {
  total_repository_tests: number;
  selected_test_count: number;
  omitted_test_count: number;
  test_reduction_percentage: number;
  estimated_time_saved_seconds: number;
  tier_breakdown: {
    tier_1_critical_p0: number;
    tier_2_high_p1: number;
    tier_3_secondary_p2: number;
  };
}

export interface SmartTestSelectionResponse {
  status: string;
  repository_name: string;
  repository_url: string;
  pr_id?: string;
  changed_files: string[];
  changed_function?: string;
  summary: SmartTestSelectionSummary;
  pytest_command: string;
  selected_tests: SelectedTestItem[];
  omitted_tests: OmittedTestItem[];
  source_primitives: string[];
  generated_at: string;
  message?: string;
}

export interface SmartTestSelectionExportResponse {
  status: string;
  format: 'json' | 'markdown' | 'shell' | string;
  content_type: string;
  filename: string;
  data?: any;
  content?: any;
}

export interface LayerBreakdownItem {
  file_count: number;
  files: string[];
}

export interface ModuleCouplingMetric {
  file: string;
  layer: string;
  afferent_coupling_ca: number;
  efferent_coupling_ce: number;
  instability_index: number;
  coupling_risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  incoming_dependents: string[];
  outgoing_dependencies: string[];
}

export interface CyclicDependencyItem {
  cycle_length: number;
  cycle_path: string[];
  formatted_cycle: string;
}

export interface LayerViolationItem {
  source_file: string;
  source_layer: string;
  target_file: string;
  target_layer: string;
  severity: string;
  explanation: string;
}

export interface ArchitectureIntelligenceResponse {
  status: string;
  repository_name: string;
  repository_url: string;
  architecture_pattern: string;
  pattern_description: string;
  architectural_health_score: number;
  architectural_risk_level: 'HEALTHY' | 'MODERATE_RISK' | 'HIGH_RISK' | 'CRITICAL_RISK' | string;
  summary: string;
  metrics: {
    total_modules: number;
    total_dependency_edges: number;
    cyclic_dependencies_count: number;
    coupling_hotspots_count: number;
    layer_violations_count: number;
    hub_modules: string[];
  };
  layer_breakdown: Record<string, LayerBreakdownItem>;
  coupling_hotspots: ModuleCouplingMetric[];
  module_coupling_metrics: ModuleCouplingMetric[];
  cyclic_dependencies: CyclicDependencyItem[];
  layer_violations: LayerViolationItem[];
  recommendations: string[];
  source_engines: string[];
  generated_at: string;
  message?: string;
}

export interface PRArchitectureImpactResponse {
  status: string;
  repository_url: string;
  pr_id: string;
  changed_files: string[];
  pr_architectural_risk: string;
  hotspots_touched: string[];
  layer_violations_touched: LayerViolationItem[];
  architectural_health_score: number;
  recommendation: string;
}

export interface ArchitectureExportResponse {
  status: string;
  format: 'json' | 'markdown' | string;
  content_type: string;
  filename: string;
  data?: any;
  content?: any;
}

export interface ExecutiveSummaryAnalytics {
  overall_engineering_score: number;
  regression_risk: number;
  governance_score: number;
  code_quality: number;
  architecture_health_score: number;
  test_reduction_percentage: number;
  release_gate_status: string;
}

export interface TimeSeriesTrends {
  timestamps: string[];
  health_and_risk_trend: {
    timestamps: string[];
    overall_engineering_score: number[];
    regression_risk: number[];
    governance_score: number[];
    code_quality: number[];
  };
  pr_velocity_trend: {
    timestamps: string[];
    pr_volume: number[];
    average_pr_risk: number[];
    pr_approval_rate_pct: number[];
  };
  smart_test_effectiveness_trend: {
    timestamps: string[];
    total_repository_tests: number[];
    minimal_selected_tests: number[];
    test_reduction_percentage: number[];
    time_saved_seconds: number[];
  };
  architecture_health_trend: {
    timestamps: string[];
    architectural_health_score: number[];
    coupling_hotspots_count: number[];
    cyclic_dependencies_count: number[];
  };
  governance_and_release_trend: {
    timestamps: string[];
    release_gate_pass_rate_pct: number[];
    active_blockers_count: number[];
    policy_compliance_score: number[];
  };
}

export interface TestEffectivenessIndex {
  efficiency_score: number;
  average_suite_reduction_percentage: number;
  cumulative_ci_hours_saved_weekly: number;
  confidence_retention_rate_pct: number;
  effectiveness_rating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | string;
}

export interface ActionableInsightItem {
  category: 'RISK' | 'TESTING' | 'ARCHITECTURE' | 'GOVERNANCE' | 'GENERAL' | string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO' | string;
  title: string;
  explanation: string;
  recommendation: string;
}

export interface AdvancedAnalyticsResponse {
  status: string;
  repository_name: string;
  repository_url: string;
  time_horizon: '7d' | '30d' | '90d' | string;
  executive_summary: ExecutiveSummaryAnalytics;
  time_series_trends: TimeSeriesTrends;
  test_effectiveness_index: TestEffectivenessIndex;
  actionable_insights: ActionableInsightItem[];
  ssot_sources: string[];
  generated_at: string;
  message?: string;
}

export interface AnalyticsExportRequest {
  repository_url?: string;
  time_horizon?: string;
  export_format?: 'json' | 'markdown' | 'csv' | string;
}

export interface AnalyticsExportResponse {
  status: string;
  format: 'json' | 'markdown' | 'csv' | string;
  content_type: string;
  filename: string;
  data?: any;
  content?: any;
  message?: string;
}

// Step 49: Notifications & Integrations Interfaces

export interface RepoMindNotificationEvent {
  event_id: string;
  event_type: 'PR_HIGH_RISK' | 'RELEASE_GATE_BLOCKED' | 'GOVERNANCE_VIOLATION' | 'ARCH_CRITICAL_HEALTH' | 'REGRESSION_RISK_BREACH' | 'REPO_HEALTH_DEGRADED' | string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' | string;
  repository_url: string;
  title: string;
  summary: string;
  payload: any;
  source_engine: string;
  dedup_hash: string;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  email_notifications_enabled: boolean;
  webhook_notifications_enabled: boolean;
  min_severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;
  subscribed_event_types: string[];
  digest_frequency: 'REALTIME' | 'HOURLY' | 'DAILY' | 'NEVER' | string;
  updated_at?: string;
}

export interface IntegrationItem {
  id: string;
  name: string;
  integration_type: 'WEBHOOK' | 'SLACK' | 'TEAMS' | 'EMAIL' | string;
  url: string;
  secret: string; // Masked e.g. wh_sec_****
  is_enabled: boolean;
  events_subscribed: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DeliveryLogItem {
  id: string;
  integration_id: string;
  integration_name?: string;
  event_type: string;
  status: 'SUCCESS' | 'FAILED' | 'DISABLED' | string;
  http_status_code: number;
  signature_header: string;
  payload_snippet: string;
  response_body: string;
  retry_count: number;
  timestamp: string;
}

export interface NotificationEventsResponse {
  status: string;
  count: number;
  events: RepoMindNotificationEvent[];
}

export interface NotificationPreferencesResponse {
  status: string;
  preferences: NotificationPreferences;
  message?: string;
}

export interface IntegrationsResponse {
  status: string;
  count: number;
  integrations: IntegrationItem[];
  message?: string;
}

export interface DeliveryLogsResponse {
  status: string;
  count: number;
  delivery_logs: DeliveryLogItem[];
}

export interface IntegrationTestResponse {
  status: string;
  result: {
    success: boolean;
    message: string;
    http_status_code: number;
    signature_header: string;
    log_id: string;
  };
}
