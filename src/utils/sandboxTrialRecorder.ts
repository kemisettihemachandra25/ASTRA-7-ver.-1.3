/**
 * ORION-7 Aerospace Digital Twin
 * Sandbox Anomaly Trial Journal Recorder & Exporter
 *
 * Records live Chain-of-Thought (CoT) and multi-agent diagnostic trace logs
 * during Chaos Anomaly Lab trials, persisting them for analytics and export
 * to standards-compliant CSV and aerospace text telemetry formats.
 */

export interface RecordedJournalLogEntry {
  id: string;
  simTime: string;
  realTimestamp: string;
  agent: string;
  tag: string;
  tagColor?: string;
  message: string;
}

export interface RecordedSandboxTrial {
  trialId: string;
  trialIndex: number;
  presetId: string;
  presetTitle: string;
  subsystem: string;
  telemetryChannel: string;
  severityLevel: number;
  severityPercent: number;
  autonomySetting: string;
  startTime: string;
  lastUpdated: string;
  outcome: 'IN_PROGRESS' | 'REMEDIATED' | 'CATASTROPHIC_FAILURE' | 'ABORTED';
  failureReason?: string | null;
  entries: RecordedJournalLogEntry[];
}

const STORAGE_KEY = 'orion7_sandbox_trial_logs_v2';
const EVENT_NAME = 'orion7_sandbox_trials_updated';

// Realistic pre-seeded baseline trials so the analytics tab has immediate verification data
const SEED_TRIALS: RecordedSandboxTrial[] = [
  {
    trialId: 'TRIAL-ORION7-001',
    trialIndex: 1,
    presetId: 'thermal',
    presetTitle: '01 // Cryo-Cooler Valve Degradation',
    subsystem: 'THERMAL',
    telemetryChannel: 'Thermal Loop Cryo Flow',
    severityLevel: 3,
    severityPercent: 75,
    autonomySetting: 'autonomous',
    startTime: new Date(Date.now() - 3600000 * 2).toISOString(),
    lastUpdated: new Date(Date.now() - 3600000 * 2 + 15000).toISOString(),
    outcome: 'REMEDIATED',
    entries: [
      {
        id: 'seed-1-1',
        simTime: '+00:00.00',
        realTimestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        agent: 'CHAOS_ENGINE',
        tag: 'FAULT_INJECT',
        tagColor: 'bg-amber-500/20 text-amber-300',
        message: '[INJECTION EVENT] Cryo-Cooler Valve Degradation injected at severity Level 3 (75%). Target: Thermal Loop Cryo Flow. All governing mesh nodes ONLINE.',
      },
      {
        id: 'seed-1-2',
        simTime: '+00:00.80',
        realTimestamp: new Date(Date.now() - 3600000 * 2 + 800).toISOString(),
        agent: 'Agent Alpha::Thermal',
        tag: 'DIAGNOSIS',
        tagColor: 'bg-rose-500/20 text-rose-300',
        message: 'Cryocooler mass flow rate dropped from nominal 14.2 g/s to 3.8 g/s. Thermal gradient delta accelerating at +0.82°C/sec across focal plane array.',
      },
      {
        id: 'seed-1-3',
        simTime: '+00:01.20',
        realTimestamp: new Date(Date.now() - 3600000 * 2 + 1200).toISOString(),
        agent: 'Agent Delta::FDIR',
        tag: 'CORRIDOR_EVAL',
        tagColor: 'bg-blue-500/20 text-blue-300',
        message: 'OrbitGuard safety corridor breach imminent. Cryo margin -2.4 kg/s below safe thermal equilibrium. Proposing compensatory bypass valve throttle.',
      },
      {
        id: 'seed-1-4',
        simTime: '+00:02.00',
        realTimestamp: new Date(Date.now() - 3600000 * 2 + 2000).toISOString(),
        agent: 'Agent Alpha::Thermal',
        tag: 'CONSENSUS',
        tagColor: 'bg-purple-500/20 text-purple-300',
        message: 'Swarm consensus quorum reached (3/4 nodes accept Plan PLAN-ORION7-TH01). OrbitGuard cryptographic verification seal granted.',
      },
      {
        id: 'seed-1-5',
        simTime: '+00:02.80',
        realTimestamp: new Date(Date.now() - 3600000 * 2 + 2800).toISOString(),
        agent: 'Agent Alpha::Thermal',
        tag: 'DISPATCH',
        tagColor: 'bg-cyan-500/20 text-cyan-300',
        message: 'Modulating secondary Peltier loop duty cycle to 88% and adjusting cryo radiator orientation vector toward deep space sink.',
      },
      {
        id: 'seed-1-6',
        simTime: '+00:04.50',
        realTimestamp: new Date(Date.now() - 3600000 * 2 + 4500).toISOString(),
        agent: 'Agent Delta::FDIR',
        tag: 'REMEDIATED',
        tagColor: 'bg-green-500/20 text-green-300 font-bold',
        message: 'Focal plane temperature stabilized at 68.1 K. Cryocooler valve back-pressure normalized. Anomaly successfully remediated without ground uplink intervention.',
      },
    ],
  },
  {
    trialId: 'TRIAL-ORION7-002',
    trialIndex: 2,
    presetId: 'adcs',
    presetTitle: '02 // Reaction Wheel RW-2 Tachometer Jitter',
    subsystem: 'AOCS',
    telemetryChannel: 'RW-2 Speed & Torque Jitter',
    severityLevel: 3,
    severityPercent: 75,
    autonomySetting: 'autonomous',
    startTime: new Date(Date.now() - 3600000).toISOString(),
    lastUpdated: new Date(Date.now() - 3600000 + 15000).toISOString(),
    outcome: 'REMEDIATED',
    entries: [
      {
        id: 'seed-2-1',
        simTime: '+00:00.00',
        realTimestamp: new Date(Date.now() - 3600000).toISOString(),
        agent: 'CHAOS_ENGINE',
        tag: 'FAULT_INJECT',
        tagColor: 'bg-amber-500/20 text-amber-300',
        message: '[INJECTION EVENT] Reaction Wheel RW-2 Tachometer Jitter injected at severity Level 3 (75%). Target: RW-2 Speed & Torque Jitter. All governing mesh nodes ONLINE.',
      },
      {
        id: 'seed-2-2',
        simTime: '+00:00.60',
        realTimestamp: new Date(Date.now() - 3600000 + 600).toISOString(),
        agent: 'Agent Beta::AOCS',
        tag: 'DIAGNOSIS',
        tagColor: 'bg-rose-500/20 text-rose-300',
        message: 'RW-2 Hall sensor frequency deviation detected. Ripple torque variance exceeds 0.015 Nm threshold. Star tracker optical jitter induced.',
      },
      {
        id: 'seed-2-3',
        simTime: '+00:01.80',
        realTimestamp: new Date(Date.now() - 3600000 + 1800).toISOString(),
        agent: 'Agent Delta::FDIR',
        tag: 'CONSENSUS',
        tagColor: 'bg-purple-500/20 text-purple-300',
        message: 'Raft consensus voting passes (4/4 online nodes confirm Plan PLAN-ORION7-ADCS02). OrbitGuard safety corridor verified.',
      },
      {
        id: 'seed-2-4',
        simTime: '+00:03.20',
        realTimestamp: new Date(Date.now() - 3600000 + 3200).toISOString(),
        agent: 'Agent Beta::AOCS',
        tag: 'REMEDIATED',
        tagColor: 'bg-green-500/20 text-green-300 font-bold',
        message: 'RW-2 torque offloaded to magnetic torque rods MTQ-X/Y and pyramid array rebalanced. Attitude pointing jitter reduced to 0.003° (nominal).',
      },
    ],
  },
];

class SandboxTrialRecorder {
  private trials: RecordedSandboxTrial[] = [];
  private activeTrialId: string | null = null;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.trials = parsed;
          return;
        }
      }
    } catch {
      // Ignore parse issues
    }
    this.trials = [...SEED_TRIALS];
    this.saveToStorage();
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.trials));
    } catch {
      // Ignore quota errors
    }
    this.notifyListeners();
  }

  private notifyListeners() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: this.trials }));
    }
  }

  public getTrials(): RecordedSandboxTrial[] {
    return this.trials;
  }

  public getActiveTrial(): RecordedSandboxTrial | null {
    if (!this.activeTrialId) return null;
    return this.trials.find((t) => t.trialId === this.activeTrialId) || null;
  }

  /**
   * Starts a new trial record whenever a simulation trial begins
   */
  public startTrial(params: {
    presetId: string;
    presetTitle: string;
    subsystem: string;
    telemetryChannel: string;
    severityLevel: number;
    autonomySetting: string;
  }): string {
    const nextIndex = this.trials.length + 1;
    const nowIso = new Date().toISOString();
    const trialId = `TRIAL-ORION7-${String(nextIndex).padStart(3, '0')}-${Date.now().toString(36).toUpperCase()}`;

    const newTrial: RecordedSandboxTrial = {
      trialId,
      trialIndex: nextIndex,
      presetId: params.presetId,
      presetTitle: params.presetTitle,
      subsystem: params.subsystem,
      telemetryChannel: params.telemetryChannel,
      severityLevel: params.severityLevel,
      severityPercent: Math.round((params.severityLevel / 4) * 100),
      autonomySetting: params.autonomySetting,
      startTime: nowIso,
      lastUpdated: nowIso,
      outcome: 'IN_PROGRESS',
      entries: [],
    };

    // Add to beginning of trials list for chronological priority
    this.trials = [newTrial, ...this.trials];
    this.activeTrialId = trialId;
    this.saveToStorage();
    return trialId;
  }

  /**
   * Appends a journal log entry to the active trial or a specified trial ID
   */
  public recordLog(
    log: {
      simTime: string;
      agent: string;
      tag: string;
      tagColor?: string;
      message: string;
    },
    targetTrialId?: string
  ) {
    const trialId = targetTrialId || this.activeTrialId;
    if (!trialId) return;

    const trial = this.trials.find((t) => t.trialId === trialId);
    if (!trial) return;

    // Deduplicate identical messages at same simTime
    if (trial.entries.some((e) => e.simTime === log.simTime && e.message === log.message)) {
      return;
    }

    const entry: RecordedJournalLogEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      simTime: log.simTime,
      realTimestamp: new Date().toISOString(),
      agent: log.agent,
      tag: log.tag,
      tagColor: log.tagColor,
      message: log.message,
    };

    trial.entries.push(entry);
    trial.lastUpdated = new Date().toISOString();
    this.saveToStorage();
  }

  /**
   * Concludes or updates the trial status (e.g. REMEDIATED or CATASTROPHIC_FAILURE)
   */
  public finishTrial(
    outcome: 'REMEDIATED' | 'CATASTROPHIC_FAILURE' | 'ABORTED',
    failureReason?: string | null,
    targetTrialId?: string
  ) {
    const trialId = targetTrialId || this.activeTrialId;
    if (!trialId) return;

    const trial = this.trials.find((t) => t.trialId === trialId);
    if (!trial) return;

    trial.outcome = outcome;
    trial.failureReason = failureReason;
    trial.lastUpdated = new Date().toISOString();
    this.saveToStorage();
  }

  public clearAll() {
    this.trials = [];
    this.activeTrialId = null;
    this.saveToStorage();
  }

  public resetToDefault() {
    this.trials = [...SEED_TRIALS];
    this.activeTrialId = null;
    this.saveToStorage();
  }
}

export const sandboxTrialRecorder = new SandboxTrialRecorder();

// ============================================================================
// File Export Utilities (Text & CSV)
// ============================================================================

/**
 * Exports recorded trials as a structured, comma-separated values (.csv) file
 */
export function exportTrialsToCsv(trials: RecordedSandboxTrial[], filename?: string) {
  const rows: string[] = [];

  // Header row
  rows.push(
    [
      'Trial_ID',
      'Trial_Number',
      'Preset_Title',
      'Subsystem',
      'Telemetry_Channel',
      'Severity_Level',
      'Severity_Percent',
      'Autonomy_Mode',
      'Trial_Outcome',
      'Trial_Start_UTC',
      'Log_Real_UTC',
      'Sim_Elapsed_Time',
      'Agent_Source',
      'Event_Tag',
      'Journal_Trace_Message',
    ].join(',')
  );

  for (const trial of trials) {
    if (trial.entries.length === 0) {
      rows.push(
        [
          escapeCsv(trial.trialId),
          trial.trialIndex,
          escapeCsv(trial.presetTitle),
          escapeCsv(trial.subsystem),
          escapeCsv(trial.telemetryChannel),
          trial.severityLevel,
          `${trial.severityPercent}%`,
          escapeCsv(trial.autonomySetting),
          escapeCsv(trial.outcome),
          escapeCsv(trial.startTime),
          escapeCsv(trial.startTime),
          '"+00:00.00"',
          '"SYSTEM"',
          '"TRIAL_START"',
          escapeCsv(`Trial initialized with 0 journal events. Reason: ${trial.failureReason || 'N/A'}`),
        ].join(',')
      );
    } else {
      for (const entry of trial.entries) {
        rows.push(
          [
            escapeCsv(trial.trialId),
            trial.trialIndex,
            escapeCsv(trial.presetTitle),
            escapeCsv(trial.subsystem),
            escapeCsv(trial.telemetryChannel),
            trial.severityLevel,
            `${trial.severityPercent}%`,
            escapeCsv(trial.autonomySetting),
            escapeCsv(trial.outcome),
            escapeCsv(trial.startTime),
            escapeCsv(entry.realTimestamp),
            escapeCsv(entry.simTime),
            escapeCsv(entry.agent),
            escapeCsv(entry.tag),
            escapeCsv(entry.message),
          ].join(',')
        );
      }
    }
  }

  const csvContent = rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename || `ORION7-Sandbox-Trial-TraceLogs-${formatTimestampForFilename()}.csv`);
}

/**
 * Exports recorded trials as an aerospace mission journal text (.txt) file
 */
export function exportTrialsToText(trials: RecordedSandboxTrial[], filename?: string) {
  const lines: string[] = [];

  const totalEntries = trials.reduce((acc, t) => acc + t.entries.length, 0);

  lines.push('================================================================================');
  lines.push('ORION-7 AUTONOMOUS SATELLITE DIGITAL TWIN — SANDBOX ANOMALY JOURNAL TRACE LOGS');
  lines.push('MISSION CONTROL TELEMETRY RECORD | NORAD ID: 59124 | 541.8 km SUN-SYNCHRONOUS LEO');
  lines.push('================================================================================');
  lines.push(`Generated:                   ${new Date().toISOString()}`);
  lines.push(`Total Trials Recorded:       ${trials.length}`);
  lines.push(`Total Journal Trace Events:  ${totalEntries}`);
  lines.push(`Spacecraft Platform:         ORION-7 Flight Avionics Architecture`);
  lines.push(`Safety Engine:               OrbitGuard Deterministic Interlocks & Multi-Agent Mesh`);
  lines.push('================================================================================\n');

  if (trials.length === 0) {
    lines.push('No sandbox trials recorded yet. Conduct anomaly injection runs in the Chaos Anomaly Lab.');
  } else {
    trials.forEach((trial, idx) => {
      lines.push('--------------------------------------------------------------------------------');
      lines.push(`TRIAL #${String(trial.trialIndex).padStart(2, '0')} // ${trial.presetTitle}`);
      lines.push('--------------------------------------------------------------------------------');
      lines.push(`Trial ID:          ${trial.trialId}`);
      lines.push(`Subsystem:         ${trial.subsystem}`);
      lines.push(`Telemetry Target:  ${trial.telemetryChannel}`);
      lines.push(`Severity:          Level ${trial.severityLevel} (${trial.severityPercent}%)`);
      lines.push(`Autonomy Setting:  ${trial.autonomySetting.toUpperCase()}`);
      lines.push(`Start Epoch (UTC): ${trial.startTime}`);
      lines.push(`Last Update (UTC): ${trial.lastUpdated}`);
      lines.push(`Final Outcome:     ${trial.outcome}${trial.failureReason ? ` (Reason: ${trial.failureReason})` : ''}`);
      lines.push(`Recorded Events:   ${trial.entries.length} log lines`);
      lines.push('--------------------------------------------------------------------------------');
      lines.push('CHRONOLOGICAL JOURNAL TRACE:');

      if (trial.entries.length === 0) {
        lines.push('  [No journal events recorded for this trial run]');
      } else {
        trial.entries.forEach((entry) => {
          lines.push(
            `  [${entry.simTime}] [${entry.agent}] [${entry.tag}]`
          );
          lines.push(`    >> ${entry.message}`);
          lines.push('');
        });
      }
      lines.push('\n');
    });
  }

  lines.push('================================================================================');
  lines.push('END OF ORION-7 SANDBOX TRIAL TELEMETRY TRACE JOURNAL RECORD');
  lines.push('================================================================================');

  const textContent = lines.join('\n');
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
  triggerDownload(blob, filename || `ORION7-Sandbox-Trial-TraceLogs-${formatTimestampForFilename()}.txt`);
}

function escapeCsv(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '""';
  const str = String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatTimestampForFilename(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}
