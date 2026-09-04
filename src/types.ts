/**
 * Aerospace Telemetry & Mission Control Types
 * Smart Horizon 48-Hour Hackathon | Team 098 | Topic: DST-1
 * Authors:
 *   1. L Steven Dylan
 *   2. Karan Sai S
 *   3. Kemisetti Hemachandra
 *   4. Jeevan M
 *   5. Jyotiraditya Pradip Khuman
 * (c) 2026 Team 098. All rights reserved. Patent Pending.
 */

export interface MissionAuthorshipSignature {
  teamNumber: '098';
  topicDesignator: 'DST-1';
  authors: readonly [
    'L Steven Dylan',
    'Karan Sai S',
    'Kemisetti Hemachandra',
    'Jeevan M',
    'Jyotiraditya Pradip Khuman'
  ];
  intellectualProperty: 'PROPRIETARY_PATENT_PENDING';
}

export type ActiveScreen = 'orbital-twin' | 'agent-mesh' | 'anomaly-lab' | 'propellantless' | 'orbital-cases' | 'analytics';

export type AutonomyMode = 'L4' | 'HITL' | 'OVERRIDE';

export type HITLThreshold = 'strict' | 'standard' | 'autonomous';

export type TwinLayer = 'wireframe' | 'thermal' | 'mag' | 'power';

export interface AnomalyPreset {
  id: string;
  presetNum: string;
  subsystem: string;
  title: string;
  description: string;
  severityDefault: number;
  severityLabel: string;
  detectionTime: number; // in seconds
  mitigationTime: number;
  recoveryTime: number;
  baselineMetric: string;
  faultMetric: string;
  remediatedMetric: string;
  deltaSummary: string;
  telemetryChannel: string;
  dependentAgents?: ('alpha' | 'beta' | 'gamma' | 'delta')[];
  failureScenarios?: {
    singleAgentOfflineMsg?: Record<string, string>;
    bothAgentsOfflineMsg?: string;
    bothOffline?: string;
    alphaOffline?: string;
    betaOffline?: string;
    gammaOffline?: string;
  };
  journalLogs: {
    time: string;
    agent: string;
    tag: string;
    tagColor: string;
    message: string;
  }[];
}

export interface CoTLogEntry {
  id: string;
  timestamp: string;
  agent: string;
  tag: string;
  tagColor: string;
  message: string;
}

export interface InterventionLedgerItem {
  id: string;
  timestamp: string;
  leadAgent: string;
  actionExecuted: string;
  resolutionTime: string;
  telemetryDelta: string;
  reverted?: boolean;
}

export interface TelemetryIncident {
  id: string;
  subsystem: string;
  type: 'REAL' | 'CHAOS';
  triggerRoot: string;
  responseTime: string;
  remediator: string;
  status: 'RESOLVED' | 'ACTIVE' | 'MITIGATING';
}

export interface HistoricalIncident {
  id: string;
  timestamp: string;
  subsystem: string;
  description: string;
  autonomyLevel: string;
  mttrSeconds: number;
  outcome: string;
}

export interface AgentStatus {
  id: 'alpha' | 'beta' | 'gamma' | 'delta';
  name: string;
  subsystem: string;
  role: string;
  state: 'nominal' | 'active_correction' | 'balancing' | 'standby' | 'isolated' | 'faulted';
  isolated: boolean;
  confidence: number;
  description: string;
}

export interface ManualPulseEvent {
  id: string;
  timestamp: number;
  timeStr: string;
  thruster: string;
  durationMs: number;
  deltaV: number;
  deltaAltMeters: number;
  angularRateDeg: number;
  fuelGrams: number;
}

// ============================================================================
// OrbitGuard External API & Hybrid AI Types
// ============================================================================

export interface OrbitGuardHealth {
  status: string;
  timestamp: string;
  version: string;
  services: {
    api: string;
    database: string;
    ai_provider: string;
  };
  latencyMs?: number;
  connected: boolean;
}

export interface OrbitGuardValidationCheck {
  check_name: string;
  passed: boolean;
  message: string;
}

export interface OrbitGuardValidationResult {
  validation_id: string;
  plan_id: string;
  is_valid: boolean;
  is_safe: boolean;
  violations: string[];
  warnings: string[];
  checks: OrbitGuardValidationCheck[];
  safety_score: number;
  validated_at: string;
}

export interface OrbitGuardRecoveryStep {
  step_number: number;
  action: string;
  subsystem: string;
  expected_outcome: string;
  rollback_action?: string | null;
}

export interface OrbitGuardRecoveryPlan {
  plan_id: string;
  title?: string | null;
  diagnosis_id: string;
  satellite_id: string;
  actions: string[];
  preconditions: string[];
  expected_effects: string[];
  steps: OrbitGuardRecoveryStep[];
  risk_level?: 'low' | 'medium' | 'high';
  risk_score?: number;
  rollback_plan?: string | null;
  estimated_duration_seconds?: number;
  requires_ground_approval?: boolean;
  validation_result?: OrbitGuardValidationResult | null;
  created_at: string;
}

export interface OrbitGuardTelemetryMetric {
  value: number;
  unit: string;
  subsystem: string;
}

export interface OrbitGuardTelemetryReading {
  satellite_id: string;
  timestamp: string;
  metrics: {
    battery_temperature?: OrbitGuardTelemetryMetric;
    battery_voltage?: OrbitGuardTelemetryMetric;
    solar_power?: OrbitGuardTelemetryMetric;
    wheel_speed?: OrbitGuardTelemetryMetric;
    attitude_error?: OrbitGuardTelemetryMetric;
    comm_snr?: OrbitGuardTelemetryMetric;
    [key: string]: OrbitGuardTelemetryMetric | undefined;
  };
}

export interface HybridDiagnosisResult {
  source: 'orbitguard_hybrid' | 'gemini_supervisor' | 'onboard_autonomous';
  timestamp: string;
  orbitGuardValidation?: OrbitGuardValidationResult | null;
  geminiAnalysis?: {
    supervisorAssessment: string;
    recommendedActions: string[];
    riskFactor: number;
    subsystemImpacts: { subsystem: string; impact: string; severity: 'low' | 'medium' | 'high' | 'critical' }[];
    consensusVerdict: string;
  };
  incidentId?: string;
  recoveryPlan?: OrbitGuardRecoveryPlan | null;
}

