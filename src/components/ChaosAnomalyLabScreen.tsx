import React, { useState, useEffect, useRef } from 'react';
import { AnomalyPreset, CoTLogEntry, AgentStatus, HybridDiagnosisResult } from '../types';
import { ANOMALY_PRESETS, INITIAL_AGENTS } from '../data/mockFlightData';
import { sound } from '../utils/audio';
import { getISTTimeWithMs } from '../utils/time';
import { orbitGuardApi } from '../services/orbitGuardApi';
import { VideogameLoadingSlider } from './VideogameLoadingSlider';
import { sandboxTrialRecorder } from '../utils/sandboxTrialRecorder';
import {
  Play,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Flame,
  Gauge,
  Send,
  Zap,
  ShieldAlert,
  ShieldCheck,
  Power,
  Radio,
  XCircle,
  Activity,
  Server,
  Sparkles,
  RefreshCw,
  Sliders,
} from 'lucide-react';

export interface DomainMapping {
  agentId: 'alpha' | 'beta' | 'gamma' | 'delta';
  agentName: string;
  governedParameter: string;
  telemetryMetric: string;
  catastrophicMechanism: string;
}

export const SUBSYSTEM_DOMAIN_MAP: Record<string, DomainMapping> = {
  thermal: {
    agentId: 'alpha',
    agentName: 'Agent Alpha::Thermal',
    governedParameter: 'Thermal Gradients & Cryo-Radiator Loop',
    telemetryMetric: 'Battery Pack Temperature (EPS_BATT_TEMP_CELL04)',
    catastrophicMechanism:
      'Thermal runaway: Battery core exceeds 85°C critical limit, resulting in cell pouch rupture, catastrophic outgassing, and total power bus collapse.',
  },
  sada: {
    agentId: 'alpha',
    agentName: 'Agent Alpha::Thermal',
    governedParameter: 'Solar Array Drive Assembly & Bus Voltage',
    telemetryMetric: 'Solar Power Generation (EPS_SOLAR_HARVEST_W)',
    catastrophicMechanism:
      'Deep bus undervoltage: SADA drive stall uncorrected, vehicle bus collapses below 18V shutdown threshold leading to permanent battery death.',
  },
  adcs: {
    agentId: 'beta',
    agentName: 'Agent Beta::AOCS',
    governedParameter: 'Attitude Determination & Control (AOCS) & Reaction Wheels',
    telemetryMetric: 'Z-Axis Angular Drift Rate (ADCS_GYRO_Z_RATE)',
    catastrophicMechanism:
      'Uncontrolled flat-spin tumble: Reaction wheel saturation uncompensated by magnetorquers, angular rates exceed 15°/s, destroying star-tracker lock and solar pointing.',
  },
  collision: {
    agentId: 'gamma',
    agentName: 'Agent Gamma::Prop',
    governedParameter: 'Orbital Semi-Major Axis & RCS Delta-V Injection',
    telemetryMetric: 'Semi-Major Axis Altitude (ORBIT_SEMI_MAJOR_AXIS)',
    catastrophicMechanism:
      'Runaway perigee decay: Space object collision impulse unmitigated by RCS burn, vehicle descends past 530km re-entry hazard line into dense mesosphere.',
  },
  drag: {
    agentId: 'gamma',
    agentName: 'Agent Gamma::Prop',
    governedParameter: 'Atmospheric Drag Resistance & Orbit Circularization',
    telemetryMetric: 'LEO GPS Altitude (GPS_LEO_ALTITUDE_MSL)',
    catastrophicMechanism:
      'Thermospheric drag plunge: Solar storm density surge uncompensated by station-keeping burn, leading to irreversible orbital re-entry.',
  },
  thruster: {
    agentId: 'gamma',
    agentName: 'Agent Gamma::Prop',
    governedParameter: 'RCS Hydrazine Manifold & Solenoid Pulse Control',
    telemetryMetric: 'Valve #3 Manifold Pressure (PROP_RCS_VALVE_03_PRESSURE)',
    catastrophicMechanism:
      'Hydrazine blowdown & wild tumble: Solenoid valve #3 stuck open dumps remaining fuel supply, causing unrecoverable rotational velocity.',
  },
  thermal_attitude_coupling: {
    agentId: 'alpha',
    agentName: 'Agent Alpha::Thermal & Agent Beta::AOCS',
    governedParameter: 'Cryo-Radiator Shade Vector & AOCS Sun-Pointing Attitude',
    telemetryMetric: 'Radiator Surface Gradient (EPS_CRYO_LOOP_GRADIENT_C)',
    catastrophicMechanism:
      'Multi-agent thermal/attitude divergence: Cryo-loop overheat and reaction wheel desaturation collapse vehicle stability.',
  },
  orbit_attitude_burn: {
    agentId: 'gamma',
    agentName: 'Agent Gamma::Prop & Agent Beta::AOCS',
    governedParameter: 'In-Plane RCS Delta-V Vector & Star-Tracker 3-Axis Slew',
    telemetryMetric: 'Perigee Altitude Deviation (ORBIT_PERIGEE_ERROR_KM)',
    catastrophicMechanism:
      'Multi-agent orbital burn vector anomaly: Slew vector misalignment causes cross-axis thrust impulse or ballistic atmospheric plunge.',
  },
};

interface ChaosAnomalyLabScreenProps {
  selectedPresetId?: string;
  onPresetChange?: (presetId: string) => void;
  onUpdateAlertCount?: (crit: number, warn: number) => void;
  agents?: AgentStatus[];
  onToggleAgentIsolation?: (agentId: string) => void;
}

export const ChaosAnomalyLabScreen: React.FC<ChaosAnomalyLabScreenProps> = ({
  selectedPresetId = 'thermal',
  onPresetChange,
  onUpdateAlertCount,
  agents = INITIAL_AGENTS,
  onToggleAgentIsolation,
}) => {
  const [activePreset, setActivePreset] = useState<AnomalyPreset>(
    ANOMALY_PRESETS.find((p) => p.id === selectedPresetId) || ANOMALY_PRESETS[0]
  );

  const [severityLevel, setSeverityLevel] = useState<number>(activePreset.severityDefault);
  const [noiseLevel, setNoiseLevel] = useState<number>(25);
  const [autonomySetting, setAutonomySetting] = useState<'closed-loop' | 'hitl' | 'suppressed'>('closed-loop');
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 5>(1);

  const [simRunning, setSimRunning] = useState<boolean>(false);
  const [simTime, setSimTime] = useState<number>(0);
  const [simStage, setSimStage] = useState<
    'idle' | 'injected' | 'detected' | 'mitigating' | 'remediated' | 'catastrophic_failure'
  >('idle');

  const simTimeRef = useRef<number>(0);
  const simStageRef = useRef<
    'idle' | 'injected' | 'detected' | 'mitigating' | 'remediated' | 'catastrophic_failure'
  >('idle');
  const simRunningRef = useRef<boolean>(false);
  const initialMountRef = useRef<boolean>(true);

  const [journalLogs, setJournalLogs] = useState<CoTLogEntry[]>([]);
  const [customOverrideInput, setCustomOverrideInput] = useState<string>('');
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hybridResult, setHybridResult] = useState<HybridDiagnosisResult | null>(null);
  const [ogApiStatus, setOgApiStatus] = useState<'idle' | 'calling' | 'validated' | 'error'>('idle');
  const [ogResetting, setOgResetting] = useState<boolean>(false);
  const journalContainerRef = useRef<HTMLDivElement>(null);

  // Determine domain agent responsibilities and offline status
  const domainInfo = SUBSYSTEM_DOMAIN_MAP[activePreset.id] || {
    agentId: 'gamma' as const,
    agentName: 'Agent Gamma::Prop',
    governedParameter: activePreset.subsystem,
    telemetryMetric: activePreset.telemetryChannel,
    catastrophicMechanism: 'Subsystem parameters breach flight safety limits.',
  };

  const governingAgent = agents.find((a) => a.id === domainInfo.agentId);
  const deltaAgent = agents.find((a) => a.id === 'delta');

  // Multi-agent dependency resolution
  const dependentAgentIds: string[] = activePreset.dependentAgents && activePreset.dependentAgents.length > 0
    ? activePreset.dependentAgents
    : [domainInfo.agentId];

  const dependentAgentsList = agents.filter((a) => dependentAgentIds.includes(a.id));
  const offlineDependentAgents = dependentAgentsList.filter((a) => a.isolated);
  const isAnyDependentAgentOffline = offlineDependentAgents.length > 0;
  const isAllDependentAgentsOffline = dependentAgentsList.length > 0 && offlineDependentAgents.length === dependentAgentsList.length;

  const isGoverningAgentOffline = isAnyDependentAgentOffline;
  const isFdirOffline = (deltaAgent?.isolated ?? false) && !dependentAgentIds.includes('delta');
  const isCatastrophic = isGoverningAgentOffline || isFdirOffline || autonomySetting === 'suppressed';

  // Dynamic failure reason resolving single, multiple, or FDIR offline states
  const getDynamicFailureReason = (): string | null => {
    if (activePreset.failureScenarios) {
      const fs = activePreset.failureScenarios;
      const bothMsg = fs.bothOffline || fs.bothAgentsOfflineMsg;
      const singleMsgs = fs.singleAgentOfflineMsg || {};

      if (activePreset.id === 'thermal_attitude_coupling') {
        const isAlphaOff = agents.find((a) => a.id === 'alpha')?.isolated;
        const isBetaOff = agents.find((a) => a.id === 'beta')?.isolated;
        if (isAlphaOff && isBetaOff && bothMsg) {
          return bothMsg;
        }
        if (isAlphaOff && (fs.alphaOffline || singleMsgs.alpha)) {
          return fs.alphaOffline || singleMsgs.alpha;
        }
        if (isBetaOff && (fs.betaOffline || singleMsgs.beta)) {
          return fs.betaOffline || singleMsgs.beta;
        }
      }
      if (activePreset.id === 'orbit_attitude_burn') {
        const isBetaOff = agents.find((a) => a.id === 'beta')?.isolated;
        const isGammaOff = agents.find((a) => a.id === 'gamma')?.isolated;
        if (isBetaOff && isGammaOff && bothMsg) {
          return bothMsg;
        }
        if (isBetaOff && (fs.betaOffline || singleMsgs.beta)) {
          return fs.betaOffline || singleMsgs.beta;
        }
        if (isGammaOff && (fs.gammaOffline || singleMsgs.gamma)) {
          return fs.gammaOffline || singleMsgs.gamma;
        }
      }
    }

    if (isGoverningAgentOffline) {
      const names = offlineDependentAgents.map((a) => a.name).join(' & ');
      return `Governing domain agent(s) [${names}] OFFLINE / ISOLATED. Inter-agent closed-loop coordination severed.`;
    }
    if (isFdirOffline) {
      return `Supervisory agent [Agent Delta::FDIR] is OFFLINE. Raft-BFT consensus quorum lost (0/4 nodes signed).`;
    }
    if (autonomySetting === 'suppressed') {
      return 'Swarm autonomy is SUPPRESSED (open-loop mode).';
    }
    return null;
  };

  const failureReason = getDynamicFailureReason();

  const effectiveMitigationTime =
    autonomySetting === 'hitl'
      ? activePreset.mitigationTime + 2.2
      : activePreset.mitigationTime;
  const effectiveRecoveryTime =
    autonomySetting === 'hitl'
      ? activePreset.recoveryTime + 2.8
      : activePreset.recoveryTime;

  const resetSim = async () => {
    if (simRunningRef.current) {
      sandboxTrialRecorder.finishTrial('ABORTED', 'Simulation reset by operator');
    }
    simRunningRef.current = false;
    simTimeRef.current = 0;
    simStageRef.current = 'idle';
    setSimRunning(false);
    setSimTime(0);
    setSimStage('idle');
    setJournalLogs([]);
    setHybridResult(null);
    setOgApiStatus('idle');
    if (onUpdateAlertCount) {
      setTimeout(() => onUpdateAlertCount(0, 0), 0);
    }
    // Also reset OrbitGuard digital twin asynchronously
    try {
      setOgResetting(true);
      await orbitGuardApi.resetSimulation();
    } catch (e) {
      console.log('OrbitGuard reset notice (using local twin state).');
    } finally {
      setOgResetting(false);
    }
  };

  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    const found = ANOMALY_PRESETS.find((p) => p.id === selectedPresetId);
    if (found && found.id !== activePreset.id) {
      setActivePreset(found);
      setSeverityLevel(found.severityDefault);
      resetSim();
    }
  }, [selectedPresetId, activePreset.id]);

  const handleStartSim = () => {
    sound.playWarning();
    resetSim();
    simRunningRef.current = true;
    simTimeRef.current = 0;
    simStageRef.current = 'injected';
    setSimRunning(true);
    setSimStage('injected');

    if (onUpdateAlertCount) {
      const crit = isCatastrophic || severityLevel >= 3 ? 1 : 0;
      const warn = severityLevel <= 2 && !isCatastrophic ? 1 : 0;
      setTimeout(() => onUpdateAlertCount(crit, warn), 0);
    }

    const initialOfflineMsg = isGoverningAgentOffline
      ? `⚠️ CRITICAL: Domain agent(s) [${offlineDependentAgents.map((a) => a.name).join(' & ')}] OFFLINE! Anomaly cannot be corrected and will trigger catastrophic failure.`
      : isFdirOffline
      ? '⚠️ CRITICAL: Consensus node Agent Delta::FDIR is OFFLINE! Byzantine consensus cannot form.'
      : 'All governing mesh nodes ONLINE.';

    const initialEntry: CoTLogEntry = {
      id: `log-${Date.now()}-0`,
      timestamp: '+00:00.00',
      agent: 'CHAOS_ENGINE',
      tag: 'FAULT_INJECT',
      tagColor: 'bg-amber-500/20 text-amber-300',
      message: `[INJECTION EVENT] ${activePreset.title} injected at severity Level ${severityLevel} (${Math.round(
        (severityLevel / 4) * 100
      )}%). Target: ${activePreset.telemetryChannel}. ${initialOfflineMsg}`,
    };
    setJournalLogs([initialEntry]);

    // Record new trial in persistent sandbox recorder
    const activeTrialId = sandboxTrialRecorder.startTrial({
      presetId: activePreset.id,
      presetTitle: activePreset.title,
      subsystem: activePreset.subsystem,
      telemetryChannel: activePreset.telemetryChannel,
      severityLevel,
      autonomySetting,
    });
    sandboxTrialRecorder.recordLog({
      simTime: initialEntry.timestamp,
      agent: initialEntry.agent,
      tag: initialEntry.tag,
      tagColor: initialEntry.tagColor,
      message: initialEntry.message,
    }, activeTrialId);

    // Map active preset to OrbitGuard supported anomaly types
    const ogAnomalyType =
      activePreset.id === 'adcs'
        ? 'wheel_degradation'
        : 'battery_overheat';

    // Asynchronously call OrbitGuard simulate/inject and Gemini hybrid diagnosis
    setOgApiStatus('calling');
    orbitGuardApi.injectAnomaly('SAT-01', ogAnomalyType).catch((err) => {
      console.log('OrbitGuard injection acknowledged.');
    });

    orbitGuardApi
      .runHybridDiagnosis({
        satelliteId: 'SAT-01',
        subsystem: activePreset.subsystem,
        telemetryChannel: activePreset.telemetryChannel,
        baselineMetric: activePreset.baselineMetric,
        faultMetric: activePreset.faultMetric,
        remediatedMetric: activePreset.remediatedMetric,
        presetTitle: activePreset.title,
        presetDescription: activePreset.description,
        severityLevel: Math.round((severityLevel / 4) * 100),
        anomalyType: ogAnomalyType,
      })
      .then((res) => {
        setHybridResult(res);
        setOgApiStatus('validated');

        const istTime = getISTTimeWithMs();

        const logsToAdd: CoTLogEntry[] = [];

        if (res.orbitGuardValidation) {
          const val = res.orbitGuardValidation;
          const checks = val.checks || [];
          const warnings = val.warnings || [];
          const passedCount = checks.filter((c) => c?.passed).length;
          const totalCount = checks.length;
          logsToAdd.push({
            id: `log-og-${Date.now()}`,
            timestamp: istTime,
            agent: 'OrbitGuard::SafetyEngine',
            tag: val.is_safe ? 'CORRIDOR_VERIFIED' : 'SAFETY_VIOLATION',
            tagColor: val.is_safe ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300',
            message: `OrbitGuard Check: Score ${((val.safety_score || 0.9) * 100).toFixed(0)}% | Passed: ${passedCount}/${totalCount} constraints. ${warnings[0] || 'Envelopes nominal.'}`,
          });
        }

        if (res.geminiAnalysis) {
          const ga = res.geminiAnalysis;
          logsToAdd.push({
            id: `log-gemini-${Date.now()}`,
            timestamp: istTime,
            agent: 'Gemini::AgentDelta',
            tag: 'SUPERVISOR_AI',
            tagColor: 'bg-purple-500/20 text-purple-300',
            message: `${ga.supervisorAssessment} [Consensus: ${ga.consensusVerdict}]`,
          });
        }

        if (logsToAdd.length > 0) {
          setJournalLogs((prev) => [...prev, ...logsToAdd]);
          logsToAdd.forEach((l) => {
            sandboxTrialRecorder.recordLog({
              simTime: '+00:01.20',
              agent: l.agent,
              tag: l.tag,
              tagColor: l.tagColor,
              message: l.message,
            }, activeTrialId);
          });
        }
      })
      .catch((err) => {
        console.log('Hybrid diagnosis status updated to local state.');
        setOgApiStatus('error');
      });
  };

  useEffect(() => {
    if (!simRunning) return;

    const intervalMs = 100 / playbackSpeed;
    const timer = setInterval(() => {
      const nextTime = Math.round((simTimeRef.current + 0.1) * 10) / 10;
      simTimeRef.current = nextTime;
      setSimTime(nextTime);

      const curStage = simStageRef.current;

      if (isCatastrophic) {
        if (nextTime >= activePreset.detectionTime && curStage === 'injected') {
          simStageRef.current = 'detected';
          setSimStage('detected');
          sound.playWarning();
          if (onUpdateAlertCount) {
            setTimeout(() => onUpdateAlertCount(1, 0), 0);
          }
        } else if (
          nextTime >= effectiveMitigationTime &&
          curStage !== 'catastrophic_failure'
        ) {
          simStageRef.current = 'catastrophic_failure';
          setSimStage('catastrophic_failure');
          sound.playAlarm();
          if (onUpdateAlertCount) {
            setTimeout(() => onUpdateAlertCount(1, 0), 0);
          }

          // Inject immediate catastrophic failure logs
          const fatalTimeStr = `+00:${String(Math.floor(nextTime)).padStart(2, '0')}.${String(
            Math.floor((nextTime % 1) * 100)
          ).padStart(2, '0')}`;

          const fatalEntry: CoTLogEntry = {
            id: `log-${Date.now()}-fatal1`,
            timestamp: fatalTimeStr,
            agent: isGoverningAgentOffline
              ? (offlineDependentAgents.map((a) => a.name).join(' & ') || 'SWARM_GOVERNOR')
              : isFdirOffline
              ? 'Agent Delta::FDIR'
              : 'FLIGHT_SAFETY',
            tag: 'CATASTROPHIC_FAIL',
            tagColor: 'bg-rose-600 text-white font-black animate-pulse',
            message: `🚨 REMEDIATION FAILED: ${failureReason || 'Autonomous mitigation disabled.'} Parameter diverging into unrecoverable catastrophic failure!`,
          };

          const fatalEntry2: CoTLogEntry = {
            id: `log-${Date.now()}-fatal2`,
            timestamp: fatalTimeStr,
            agent: 'MISSION_CONTROL',
            tag: 'RUNAWAY_BREACH',
            tagColor: 'bg-rose-950 text-rose-300 border border-rose-500',
            message: `FATAL BREACH: ${domainInfo.catastrophicMechanism}`,
          };

          setJournalLogs((prev) => [...prev, fatalEntry, fatalEntry2]);
          sandboxTrialRecorder.recordLog({
            simTime: fatalEntry.timestamp,
            agent: fatalEntry.agent,
            tag: fatalEntry.tag,
            tagColor: fatalEntry.tagColor,
            message: fatalEntry.message,
          });
          sandboxTrialRecorder.recordLog({
            simTime: fatalEntry2.timestamp,
            agent: fatalEntry2.agent,
            tag: fatalEntry2.tag,
            tagColor: fatalEntry2.tagColor,
            message: fatalEntry2.message,
          });
          sandboxTrialRecorder.finishTrial('CATASTROPHIC_FAILURE', failureReason);
        }
      } else {
        if (nextTime >= effectiveRecoveryTime && curStage !== 'remediated') {
          simStageRef.current = 'remediated';
          setSimStage('remediated');
          sound.playRemediated();
          sandboxTrialRecorder.finishTrial('REMEDIATED');
          if (onUpdateAlertCount) {
            setTimeout(() => onUpdateAlertCount(0, 0), 0);
          }
        } else if (
          nextTime >= effectiveMitigationTime &&
          curStage !== 'mitigating' &&
          curStage !== 'remediated'
        ) {
          simStageRef.current = 'mitigating';
          setSimStage('mitigating');
          sound.playThruster();
        } else if (nextTime >= activePreset.detectionTime && curStage === 'injected') {
          simStageRef.current = 'detected';
          setSimStage('detected');
          sound.playWarning();
        }
      }

      const matchingLog = activePreset.journalLogs.find((log) => {
        const logSec = parseFloat(log.time.replace('+', '').replace('00:', ''));
        return Math.abs(logSec - nextTime) < 0.08;
      });

      if (matchingLog) {
        if (
          isCatastrophic &&
          (matchingLog.tag === 'CONSENSUS' ||
            matchingLog.tag === 'DISPATCH' ||
            matchingLog.tag === 'REMEDIATED')
        ) {
          // Suppress successful consensus/remediation logs when failure condition is active
        } else {
          const simTimeFormatted = `+00:${String(Math.floor(nextTime)).padStart(2, '0')}.${String(
            Math.floor((nextTime % 1) * 100)
          ).padStart(2, '0')}`;
          sandboxTrialRecorder.recordLog({
            simTime: simTimeFormatted,
            agent: matchingLog.agent,
            tag: matchingLog.tag,
            tagColor: matchingLog.tagColor,
            message: matchingLog.message,
          });
          setJournalLogs((current) => {
            if (current.some((e) => e.message === matchingLog.message)) return current;
            return [
              ...current,
              {
                id: `log-${Date.now()}-${Math.random()}`,
                timestamp: simTimeFormatted,
                agent: matchingLog.agent,
                tag: matchingLog.tag,
                tagColor: matchingLog.tagColor,
                message: matchingLog.message,
              },
            ];
          });
        }
      }

      if (nextTime >= 15.0) {
        simRunningRef.current = false;
        setSimRunning(false);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [
    simRunning,
    activePreset,
    playbackSpeed,
    onUpdateAlertCount,
    severityLevel,
    autonomySetting,
    effectiveMitigationTime,
    effectiveRecoveryTime,
    isCatastrophic,
    isGoverningAgentOffline,
    isFdirOffline,
    governingAgent,
    domainInfo,
    failureReason,
    offlineDependentAgents,
  ]);

  useEffect(() => {
    if (journalContainerRef.current) {
      journalContainerRef.current.scrollTop = journalContainerRef.current.scrollHeight;
    }
  }, [journalLogs]);

  const handleTransmitOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customOverrideInput.trim()) return;

    sound.playClick();
    const newEntry: CoTLogEntry = {
      id: `log-custom-${Date.now()}`,
      timestamp: `+00:${String(Math.floor(simTime)).padStart(2, '0')}.${String(
        Math.floor((simTime % 1) * 100)
      ).padStart(2, '0')}`,
      agent: 'FLIGHT_DIRECTOR_KEY',
      tag: 'SYNTHETIC_OVERRIDE',
      tagColor: 'bg-cyan-500 text-black font-bold',
      message: `>> UPLINK INJECTED: "${customOverrideInput.trim()}" -- Commanded to swarm bus.`,
    };

    setJournalLogs((prev) => [...prev, newEntry]);
    sandboxTrialRecorder.recordLog({
      simTime: newEntry.timestamp,
      agent: newEntry.agent,
      tag: newEntry.tag,
      tagColor: newEntry.tagColor,
      message: newEntry.message,
    });
    setCustomOverrideInput('');
  };

  const getXForTime = (t: number) => {
    return 60 + (Math.max(0, Math.min(15, t)) / 15.0) * 700;
  };

  const getYForTime = (t: number, isUncorrected = false) => {
    const noiseScale = (noiseLevel / 100) * 6.0;
    const jitter =
      t > 0
        ? (Math.sin(t * 22.3 + 0.5) * 0.6 + Math.cos(t * 43.1 + 1.2) * 0.4) * noiseScale
        : 0;

    const isFailureRun = isUncorrected || isCatastrophic;

    if (activePreset.id === 'collision') {
      const nominalAltY = 60;
      const impactDrop = 45 + (severityLevel - 1) * 20;

      if (t < 1.6) {
        return nominalAltY + jitter * 0.2;
      }

      const timeSinceImpact = t - 1.6;

      if (isFailureRun) {
        const dropProgress = Math.min(1.0, timeSinceImpact / 0.4);
        const continuousDecay = (timeSinceImpact / 13.4) * 48;
        return nominalAltY + impactDrop * dropProgress + continuousDecay + jitter;
      }

      if (t <= effectiveMitigationTime) {
        const dropProgress = Math.min(1.0, timeSinceImpact / 0.4);
        return nominalAltY + impactDrop * dropProgress + jitter * 0.6;
      } else if (t <= effectiveRecoveryTime) {
        const burnDuration = effectiveRecoveryTime - effectiveMitigationTime;
        const burnProgress = (t - effectiveMitigationTime) / burnDuration;
        const burnCurve = Math.sin(burnProgress * Math.PI * 0.5);
        const remainingDeficit = impactDrop * (1.0 - burnCurve);
        return nominalAltY + remainingDeficit + jitter * 0.4;
      } else {
        return nominalAltY + Math.sin(t * 2.0) * 0.8 + jitter * 0.15;
      }
    }

    const baselineY = 150;
    const sFactor = severityLevel / 4;
    const maxDeflection = 60 * sFactor + (severityLevel === 4 ? 35 : 0);

    if (isFailureRun) {
      if (t <= 0) return baselineY;
      const progress = Math.min(1.0, t / 10.0);

      // Multi-agent custom failure graph profiles
      if (activePreset.id === 'thermal_attitude_coupling') {
        const isAlphaOff = agents.find((a) => a.id === 'alpha')?.isolated;
        const isBetaOff = agents.find((a) => a.id === 'beta')?.isolated;

        if (isAlphaOff && isBetaOff) {
          // Both offline: Rapid exponential runaway + high frequency oscillation
          const runaway = Math.min(142, maxDeflection * 1.8 * Math.pow(progress, 1.45));
          const violentOsc = t > 2 ? Math.sin(t * 14.5) * 8.5 : 0;
          return Math.max(10, baselineY - runaway + violentOsc + jitter * 1.4);
        } else if (isAlphaOff) {
          // Alpha offline: Thermal runaway parabolic climb
          const thermalClimb = Math.min(135, maxDeflection * 1.5 * Math.pow(progress, 1.3));
          return Math.max(12, baselineY - thermalClimb + jitter * 0.8);
        } else if (isBetaOff) {
          // Beta offline: Reaction wheel saturation sawtooth oscillatory instability
          const attitudeOsc = Math.sin(t * 5.2) * (20 + progress * 40);
          const drift = Math.min(125, maxDeflection * 1.25 * progress);
          return Math.max(15, Math.min(270, baselineY - drift + attitudeOsc + jitter));
        }
      }

      if (activePreset.id === 'orbit_attitude_burn') {
        const isBetaOff = agents.find((a) => a.id === 'beta')?.isolated;
        const isGammaOff = agents.find((a) => a.id === 'gamma')?.isolated;

        if (isBetaOff && isGammaOff) {
          // Both offline: Uncontrolled tumble + full thrust burn = wild spirals & steep re-entry plunge
          const dive = Math.min(140, maxDeflection * 1.75 * Math.pow(progress, 1.5));
          const tumbleVortex = Math.sin(t * 11.2) * (15 * progress) + Math.cos(t * 7.4) * (10 * progress);
          return Math.max(10, baselineY - dive + tumbleVortex + jitter * 1.5);
        } else if (isBetaOff) {
          // Beta offline: Misaligned cross-axis impulse with oscillating orbital eccentricity
          const lateralWobble = Math.sin(t * 4.8) * 32 * Math.min(1.0, t / 4.0);
          const offAxisImpulse = Math.min(120, maxDeflection * 1.3 * progress);
          return Math.max(15, baselineY - offAxisImpulse + lateralWobble + jitter);
        } else if (isGammaOff) {
          // Gamma offline: Zero thrust compensation under continuous atmospheric ballistic decay
          const ballisticPlunge = Math.min(138, maxDeflection * 1.6 * Math.pow(progress, 1.35));
          return Math.max(12, baselineY - ballisticPlunge + jitter * 0.7);
        }
      }

      const unmitigated = Math.min(140, maxDeflection * 1.55 * Math.pow(progress, 1.25));
      return Math.max(12, baselineY - unmitigated + jitter);
    }

    if (t <= 0) return baselineY;

    if (t <= effectiveMitigationTime) {
      const p = t / effectiveMitigationTime;
      const def = maxDeflection * Math.sin(p * Math.PI * 0.5);
      return Math.max(15, baselineY - def + jitter);
    } else if (t <= effectiveRecoveryTime) {
      const p = (t - effectiveMitigationTime) / (effectiveRecoveryTime - effectiveMitigationTime);
      const damp = Math.cos(p * Math.PI * 0.5);
      const settle = Math.sin(p * Math.PI * 2) * 3.5 * (1 - p);
      return baselineY - maxDeflection * damp + settle + jitter;
    } else {
      return baselineY - 1.5 + Math.sin(t * 2.5) * 1.0 + jitter * 0.3;
    }
  };

  const getFormattedMetric = (t: number) => {
    if (t <= 0) return activePreset.baselineMetric;

    if (activePreset.id === 'collision') {
      if (t < 1.6) {
        return '541.80 km (Nominal Orbit)';
      }
      const currentY = getYForTime(t, false);
      const dropPx = Math.max(0, currentY - 60);
      const dropKm = (dropPx * 0.0894).toFixed(2);
      const currentAlt = (541.80 - parseFloat(dropKm)).toFixed(2);

      if (isCatastrophic && t > 1.6) {
        return `${currentAlt} km (-${dropKm} km RUNAWAY RE-ENTRY DECAY)`;
      }
      if (t < effectiveMitigationTime) {
        return `${currentAlt} km (-${dropKm} km drop)`;
      } else if (t < effectiveRecoveryTime) {
        return `${currentAlt} km (+ΔV burn recovering)`;
      } else {
        return `${currentAlt} km (Orbit circularized)`;
      }
    }

    const currentY = getYForTime(t, false);
    const deflection = Math.max(0, 150 - currentY);
    const maxPossible = 95;
    const norm = Math.min(1.0, deflection / maxPossible);

    if (activePreset.id === 'thermal') {
      const base = 21.2;
      const peak = base + (48.9 - base) * (severityLevel / 3) * norm;
      return isCatastrophic && t >= effectiveMitigationTime
        ? `${peak.toFixed(1)} °C (THERMAL RUNAWAY)`
        : `${peak.toFixed(1)} °C`;
    }
    if (activePreset.id === 'adcs') {
      const peak = 14.2 * (severityLevel / 2) * norm;
      return isCatastrophic && t >= effectiveMitigationTime
        ? `+${peak.toFixed(2)}°/s (UNCONTROLLED TUMBLE)`
        : `+${peak.toFixed(2)}°/s drift`;
    }
    if (activePreset.id === 'drag') {
      const lossM = Math.round(128 * (severityLevel / 3) * norm);
      const altKm = (541.8 - lossM / 1000).toFixed(2);
      return isCatastrophic && t >= effectiveMitigationTime
        ? `${altKm} km (TERMINAL RE-ENTRY)`
        : `${altKm} km (-${lossM}m)`;
    }
    if (activePreset.id === 'thruster') {
      const thrust = (3.8 * (severityLevel / 4) * norm).toFixed(1);
      return isCatastrophic && t >= effectiveMitigationTime
        ? `+${thrust} N (PROPELLANT VENTING RUNAWAY)`
        : `+${thrust} N continuous`;
    }
    if (activePreset.id === 'sada') {
      const lossW = Math.round(930 * (severityLevel / 2) * norm);
      return isCatastrophic && t >= effectiveMitigationTime
        ? `${2420 - lossW} W (BUS BROWNOUT HAZARD)`
        : `${2420 - lossW} W`;
    }
    if (activePreset.id === 'thermal_attitude_coupling') {
      const isAlphaOff = agents.find((a) => a.id === 'alpha')?.isolated;
      const isBetaOff = agents.find((a) => a.id === 'beta')?.isolated;
      const grad = (1.4 + 48.2 * norm * (severityLevel / 4)).toFixed(1);

      if (isCatastrophic && t >= effectiveMitigationTime) {
        if (isAlphaOff && isBetaOff) {
          return `+${grad} °C (DUAL-AGENT COLLAPSE: BOIL-OFF + TUMBLE)`;
        } else if (isAlphaOff) {
          return `+${grad} °C (ALPHA OFFLINE: CRYO LOOP BOIL-OFF)`;
        } else if (isBetaOff) {
          return `+${grad} °C (BETA OFFLINE: ATTITUDE DRIFT DESAT)`;
        }
        return `+${grad} °C (CRYO GRADIENT RUNAWAY)`;
      }
      return `+${grad} °C`;
    }
    if (activePreset.id === 'orbit_attitude_burn') {
      const isBetaOff = agents.find((a) => a.id === 'beta')?.isolated;
      const isGammaOff = agents.find((a) => a.id === 'gamma')?.isolated;
      const errKm = (0.2 + 82.5 * norm * (severityLevel / 4)).toFixed(1);

      if (isCatastrophic && t >= effectiveMitigationTime) {
        if (isBetaOff && isGammaOff) {
          return `-${errKm} km (DUAL-AGENT FAILURE: SPIRAL PLUNGE)`;
        } else if (isBetaOff) {
          return `±${errKm} km (BETA OFFLINE: CROSS-AXIS IMPULSE)`;
        } else if (isGammaOff) {
          return `-${errKm} km (GAMMA OFFLINE: BALLISTIC RE-ENTRY)`;
        }
        return `-${errKm} km (PERIGEE ANOMALY RUNAWAY)`;
      }
      return `±${errKm} km`;
    }
    return activePreset.faultMetric;
  };

  const liveValueText = simTime === 0 ? activePreset.baselineMetric : getFormattedMetric(simTime);
  const currentProbeY = getYForTime(simTime, false);

  let liveStatusColor = 'text-green-400 font-bold';
  let dynamicAuraIntensity = 0;

  if (simStage === 'catastrophic_failure' || (isCatastrophic && simTime >= effectiveMitigationTime)) {
    liveStatusColor = 'text-rose-500 font-extrabold animate-pulse';
    dynamicAuraIntensity = 0.85;
  } else if (autonomySetting === 'suppressed' && simTime > activePreset.detectionTime) {
    liveStatusColor = 'text-rose-500 font-bold animate-pulse';
    dynamicAuraIntensity = 0.6;
  } else if (simStage === 'injected' || simStage === 'detected') {
    liveStatusColor = 'text-rose-400 font-bold animate-pulse';
    dynamicAuraIntensity = severityLevel * 0.22;
  } else if (simStage === 'mitigating') {
    liveStatusColor = 'text-amber-400 font-bold';
    dynamicAuraIntensity = 0.25;
  } else if (simStage === 'remediated') {
    liveStatusColor = 'text-green-400 font-bold';
    dynamicAuraIntensity = 0;
  }

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Top Sandbox Control Ribbon */}
      <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-sm">
            <AlertTriangle size={20} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm text-white font-semibold uppercase tracking-wide">
                CHAOS & ANOMALY INJECTION SANDBOX
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] bg-green-500/10 text-green-400 font-mono font-bold border border-green-500/30">
                HIL BUS 100Hz RT-SYNC
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-400">
              REAL-TIME TRAJECTORY DIVERGENCE & CLOSED-LOOP HEALING BENCHMARK
            </span>
          </div>
        </div>

        {/* Real-time simulation clock & Execution Actions */}
        <div className="flex items-center flex-wrap gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-[#05070a] border border-[#1e293b] font-mono text-xs flex items-center gap-2 shadow-xs">
            <span className="text-slate-400 text-[10px]">SIM TIME:</span>
            <span
              className={`font-bold tracking-wider ${
                simRunning ? 'text-cyan-400 animate-pulse' : 'text-slate-200'
              }`}
            >
              T+{String(Math.floor(simTime)).padStart(2, '0')}:
              {String(Math.floor((simTime % 1) * 100)).padStart(2, '0')}s
            </span>
          </div>

          <div className="flex items-center bg-[#05070a] p-1 rounded-xl border border-[#1e293b] text-[10px] font-mono">
            {([1, 2, 5] as const).map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  playbackSpeed === spd
                    ? 'bg-cyan-500 text-black font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {spd}X
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              sound.playClick();
              resetSim();
            }}
            className="px-3.5 py-2 rounded-xl bg-[#05070a] border border-[#1e293b] hover:border-slate-400 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <RotateCcw size={13} />
            RESET
          </button>

          <button
            onClick={handleStartSim}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
              simRunning
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-amber-400 text-black hover:bg-amber-300'
            }`}
          >
            <Play size={13} fill="currentColor" />
            {simRunning ? 'TEST RUNNING...' : 'RUN TEST HARNESS'}
          </button>
        </div>
      </div>

      {/* Preset Selector Strip */}
      <div className="bg-[#0f172a] border border-[#1e293b] p-5 rounded-3xl flex flex-col gap-3 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
            PRE-CONFIGURED ANOMALY VECTORS (CLICK TO LOAD)
          </span>
          <span className="text-[10px] font-mono text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
            ACTIVE PRESET: {activePreset.title}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ANOMALY_PRESETS.map((preset) => {
            const isSelected = activePreset.id === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => {
                  sound.playClick();
                  setActivePreset(preset);
                  setSeverityLevel(preset.severityDefault);
                  resetSim();
                  if (onPresetChange) onPresetChange(preset.id);
                }}
                className={`p-3.5 text-left rounded-2xl border transition-all cursor-pointer flex flex-col justify-between shadow-sm ${
                  isSelected
                    ? 'bg-[#05070a] border-amber-400/80 text-white ring-1 ring-amber-400/40'
                    : 'bg-[#05070a] border-[#1e293b] text-slate-400 hover:border-cyan-500/40 hover:text-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[9px] font-mono font-bold ${
                        isSelected ? 'text-amber-400' : 'text-cyan-400'
                      }`}
                    >
                      {preset.presetNum}
                    </span>
                    <span className="text-[8px] font-mono text-slate-400">
                      {preset.recoveryTime}s
                    </span>
                  </div>
                  <div className="text-xs font-semibold mt-1 text-slate-100 truncate">
                    {preset.title}
                  </div>
                </div>
                <div className="text-[9px] text-slate-400 mt-1.5 line-clamp-1">
                  {preset.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Swarm Agent Governance & Kill-Switch Matrix */}
      <div className="bg-[#0f172a] border border-[#1e293b] p-5 rounded-3xl flex flex-col gap-3 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e293b]/60 pb-3">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-cyan-400" />
            <span className="text-xs uppercase text-slate-200 font-semibold tracking-wide">
              SWARM AGENT GOVERNANCE & DOMAIN KILL-SWITCH MATRIX
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              (ISOLATE AGENTS TO SIMULATE CATASTROPHIC FAILURE)
            </span>
          </div>
          {isCatastrophic ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50 animate-pulse flex items-center gap-1.5">
              <ShieldAlert size={12} />
              CATASTROPHIC FAILURE ARMED
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-green-500/10 text-green-400 border border-green-500/30 flex items-center gap-1.5">
              <CheckCircle2 size={12} />
              ALL DOMAIN AGENTS ONLINE // CLOSED-LOOP ARMED
            </span>
          )}
        </div>

        {/* Warning Callout when failure condition exists */}
        {isCatastrophic && (
          <div className="bg-rose-950/40 border border-rose-500/60 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2 text-rose-200">
              <ShieldAlert size={16} className="text-rose-400 shrink-0 animate-pulse" />
              <span>
                <strong>CRITICAL INTERDEPENDENCY WARNING:</strong> {failureReason} Any anomaly injected under this domain will <strong>FAIL TO BE CORRECTED</strong> and trigger <strong>CATASTROPHIC FAILURE</strong>.
              </span>
            </div>
          </div>
        )}

        {/* 4 Agent Nodes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
          {agents.map((agent) => {
            const isDomainGovernor = dependentAgentIds.includes(agent.id);
            const isOffline = agent.isolated;

            return (
              <div
                key={agent.id}
                className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-2 shadow-sm ${
                  isOffline
                    ? 'bg-rose-950/25 border-rose-500/70 text-rose-200 ring-1 ring-rose-500/40'
                    : isDomainGovernor
                    ? 'bg-[#05070a] border-cyan-500/70 text-white ring-1 ring-cyan-500/25'
                    : 'bg-[#05070a] border-[#1e293b] text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-cyan-400 truncate">
                      {agent.name}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                        isOffline
                          ? 'bg-rose-600 text-white animate-pulse'
                          : 'bg-green-500/20 text-green-400 border border-green-500/30'
                      }`}
                    >
                      {isOffline ? 'OFFLINE' : 'ONLINE'}
                    </span>
                  </div>

                  <div className="text-[11px] font-semibold text-slate-100 mt-1">
                    {agent.subsystem}
                  </div>

                  <div className="text-[9px] text-slate-400 mt-0.5">
                    {agent.id === 'alpha' && 'Governs: Thermal loop & Solar power harvesting'}
                    {agent.id === 'beta' && 'Governs: Attitude rates & Reaction wheels (AOCS)'}
                    {agent.id === 'gamma' && 'Governs: Orbital altitude, Drag & RCS thrust'}
                    {agent.id === 'delta' && 'Governs: FDIR diagnosis & Swarm BFT consensus'}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#1e293b]/60 flex flex-col gap-1.5">
                  {isDomainGovernor && (
                    <div
                      className={`text-[9px] font-bold flex items-center gap-1 ${
                        isOffline ? 'text-rose-400 animate-pulse' : 'text-amber-400'
                      }`}
                    >
                      <span>🎯 {dependentAgentIds.length > 1 ? 'CO-GOVERNS FAULT' : 'GOVERNS ACTIVE FAULT'}</span>
                      {isOffline && <span>(DISABLED)</span>}
                    </div>
                  )}

                  {agent.id === 'delta' && !isDomainGovernor && (
                    <div
                      className={`text-[9px] font-bold ${
                        isOffline ? 'text-rose-400 animate-pulse' : 'text-slate-400'
                      }`}
                    >
                      {isOffline ? '⚠️ QUORUM SEVERED (ALL FAIL)' : 'BFT CONSENSUS SUPERVISOR'}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      sound.playClick();
                      if (onToggleAgentIsolation) {
                        onToggleAgentIsolation(agent.id);
                      }
                    }}
                    className={`w-full py-1.5 px-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isOffline
                        ? 'bg-green-500 hover:bg-green-400 text-black font-extrabold shadow-sm'
                        : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    <Power size={11} />
                    {isOffline ? 'RESTORE AGENT' : 'DISABLE / ISOLATE'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Catastrophic Failure Active Banner */}
      {simStage === 'catastrophic_failure' && (
        <div className="bg-rose-950/90 border-2 border-rose-500 p-4 rounded-3xl flex flex-wrap items-center justify-between gap-4 shadow-[0_0_35px_rgba(244,63,94,0.45)] animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-rose-600 text-white font-black shadow-md">
              <ShieldAlert size={26} />
            </div>
            <div className="flex flex-col">
              <div className="text-sm font-bold font-mono text-white tracking-wider flex items-center gap-2">
                <span>🚨 CATASTROPHIC FAILURE // VEHICLE LOSS CONFIRMED</span>
                <span className="px-2 py-0.5 rounded-md bg-rose-500 text-white text-[9px] font-black uppercase">
                  UNRECOVERABLE RUNAWAY
                </span>
              </div>
              <div className="text-xs font-mono text-rose-200 mt-1">
                {failureReason || `Remediation failed: Governing agent offline. Closed-loop control severed.`}
              </div>
              <div className="text-[10px] font-mono text-rose-300/80 mt-0.5">
                {domainInfo.catastrophicMechanism}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sound.playClick();
                resetSim();
              }}
              className="px-3.5 py-2 rounded-xl bg-rose-900/80 hover:bg-rose-800 text-white border border-rose-400 font-mono text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              RESET SIMULATION
            </button>
          </div>
        </div>
      )}

      {/* Real-time Sandbox Controls Bar */}
      <div className="bg-[#0f172a] border border-[#1e293b] p-5 rounded-3xl grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono shadow-xl">
        {/* Videogame Loading Bar: Fault Severity Vector */}
        <div className="bg-[#05070a] p-4 rounded-2xl border border-[#1e293b] flex flex-col gap-2.5 shadow-sm group">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Flame size={13} className="text-yellow-400 animate-pulse" />
              FAULT SEVERITY VECTOR:
            </span>
            <span className="text-yellow-400 font-bold tracking-wider">
              LVL {severityLevel} // {severityLevel === 1 ? '25% MILD' : severityLevel === 2 ? '50% MOD' : severityLevel === 3 ? '78% CRIT' : '100% CATASTROPHIC'}
            </span>
          </div>
          <VideogameLoadingSlider
            id="fault-severity-slider"
            min={1}
            max={4}
            step={1}
            value={severityLevel}
            onChange={(val) => setSeverityLevel(val)}
            fillPercentage={(severityLevel / 4) * 100}
            ticks={[
              { value: 1, label: 'L1 (25% Mild)' },
              { value: 2, label: 'L2 (50% Mod)' },
              { value: 3, label: 'L3 (75% Crit)' },
              { value: 4, label: 'L4 (100% Catastrophic)' },
            ]}
            ariaLabel="Fault Severity Vector"
          />
        </div>

        {/* Videogame Loading Bar: Telemetry Gaussian Noise */}
        <div className="bg-[#05070a] p-4 rounded-2xl border border-[#1e293b] flex flex-col gap-2.5 shadow-sm group">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Gauge size={13} className="text-yellow-400" />
              TELEMETRY GAUSSIAN NOISE:
            </span>
            <span className="text-yellow-400 font-bold tracking-wider">{noiseLevel}% JITTER</span>
          </div>
          <VideogameLoadingSlider
            id="telemetry-noise-slider"
            min={0}
            max={100}
            step={1}
            value={noiseLevel}
            onChange={(val) => setNoiseLevel(val)}
            fillPercentage={noiseLevel}
            ticks={[
              { value: 0, label: '0% Clean HIL' },
              { value: 50, label: '50% Orbital Jitter' },
              { value: 100, label: '100% Ionospheric Storm' },
            ]}
            ariaLabel="Telemetry Gaussian Noise"
          />
        </div>

        <div className="bg-[#05070a] p-4 rounded-2xl border border-[#1e293b] flex flex-col gap-1.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Cpu size={13} className="text-green-400" />
              SWARM AUTONOMY MODE:
            </span>
            <span className="text-green-400 font-bold uppercase">{autonomySetting}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-1">
            {(
              [
                { id: 'closed-loop', label: 'CLOSED-LOOP' },
                { id: 'hitl', label: 'HITL (GATE)' },
                { id: 'suppressed', label: 'SUPPRESSED' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  sound.playClick();
                  setAutonomySetting(opt.id);
                }}
                className={`py-1.5 text-[9px] rounded-lg border transition-all cursor-pointer text-center ${
                  autonomySetting === opt.id
                    ? 'bg-green-500 text-black font-bold border-green-400 shadow-xs'
                    : 'bg-[#0f172a] text-slate-400 border-[#1e293b] hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pictorial Digital Twin Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Card: Nominal Baseline Twin */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-3xl flex flex-col overflow-hidden shadow-xl hover:border-cyan-500/30 transition-all">
          <div className="p-4 border-b border-[#1e293b] flex items-center justify-between bg-[#0a1120]/80">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-green-400 font-bold">TWIN-01 //</span>
              <span className="text-xs uppercase text-slate-200 font-semibold tracking-wide">
                Nominal Baseline Twin (Ground Control Model)
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-green-500/10 text-green-400 font-bold border border-green-500/30">
              STEADY STATE
            </span>
          </div>

          <div className="relative h-56 bg-[#05070a] flex items-center justify-center p-4 overflow-hidden">
            {/* Functional Vector Wireframe: Nominal Baseline Satellite Digital Twin */}
            <svg viewBox="0 0 380 180" className="w-full h-full max-h-48 drop-shadow-[0_0_16px_rgba(16,185,129,0.15)]">
              <defs>
                <linearGradient id="nominal-bus" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0f172a" />
                  <stop offset="100%" stopColor="#1e293b" />
                </linearGradient>
                <linearGradient id="solar-cell-nom" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#0369a1" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.8" />
                </linearGradient>
              </defs>

              {/* Orbital Horizon Reference Line */}
              <line x1="20" y1="90" x2="360" y2="90" stroke="#1e293b" strokeDasharray="3 3" strokeWidth="0.8" />
              <line x1="190" y1="20" x2="190" y2="160" stroke="#1e293b" strokeDasharray="3 3" strokeWidth="0.8" />

              {/* Port Solar Array Wing */}
              <g transform="translate(45, 65)">
                <rect x="0" y="0" width="85" height="50" rx="3" fill="url(#solar-cell-nom)" stroke="#38bdf8" strokeWidth="1" />
                {/* Solar Cell Grid Lines */}
                <line x1="28" y1="0" x2="28" y2="50" stroke="#0c4a6e" strokeWidth="1" />
                <line x1="56" y1="0" x2="56" y2="50" stroke="#0c4a6e" strokeWidth="1" />
                <line x1="0" y1="25" x2="85" y2="25" stroke="#0c4a6e" strokeWidth="1" />
                {/* Solar Wing Boom */}
                <line x1="85" y1="25" x2="110" y2="25" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
              </g>

              {/* Starboard Solar Array Wing */}
              <g transform="translate(250, 65)">
                {/* Solar Wing Boom */}
                <line x1="-25" y1="25" x2="0" y2="25" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
                <rect x="0" y="0" width="85" height="50" rx="3" fill="url(#solar-cell-nom)" stroke="#38bdf8" strokeWidth="1" />
                {/* Solar Cell Grid Lines */}
                <line x1="28" y1="0" x2="28" y2="50" stroke="#0c4a6e" strokeWidth="1" />
                <line x1="56" y1="0" x2="56" y2="50" stroke="#0c4a6e" strokeWidth="1" />
                <line x1="0" y1="25" x2="85" y2="25" stroke="#0c4a6e" strokeWidth="1" />
              </g>

              {/* Spacecraft Main Hex Bus Core */}
              <polygon
                points="160,50 220,50 240,90 220,130 160,130 140,90"
                fill="url(#nominal-bus)"
                stroke="#10b981"
                strokeWidth="1.5"
              />

              {/* Nadir Earth Antenna Boom */}
              <line x1="190" y1="130" x2="190" y2="155" stroke="#64748b" strokeWidth="2" />
              <path d="M 175,155 Q 190,145 205,155" fill="none" stroke="#38bdf8" strokeWidth="2" />
              <circle cx="190" cy="150" r="2.5" fill="#38bdf8" />

              {/* Internal Avionics & ADCS Reaction Wheel Cluster */}
              <circle cx="190" cy="90" r="16" fill="#0b1329" stroke="#10b981" strokeWidth="1" strokeDasharray="3 2" />
              <circle cx="190" cy="90" r="6" fill="#10b981" className="animate-pulse" />
              
              {/* Telemetry Annotation Vectors */}
              <circle cx="160" cy="72" r="3" fill="#10b981" />
              <line x1="160" y1="72" x2="135" y2="45" stroke="#10b981" strokeWidth="0.8" />
              <text x="75" y="42" fill="#10b981" fontSize="8" fontFamily="monospace" fontWeight="bold">EPS: 28.2V NOM</text>

              <circle cx="220" cy="72" r="3" fill="#38bdf8" />
              <line x1="220" y1="72" x2="245" y2="45" stroke="#38bdf8" strokeWidth="0.8" />
              <text x="250" y="42" fill="#38bdf8" fontSize="8" fontFamily="monospace" fontWeight="bold">ADCS: 0.00° STABLE</text>
            </svg>

            <div className="absolute top-3 left-3 bg-[#05070a]/90 px-2.5 py-1 rounded-xl border border-[#1e293b] text-[9px] font-mono text-slate-300 backdrop-blur-md">
              PARAM: <span className="text-green-400 font-bold">{activePreset.baselineMetric}</span>
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[9px] font-mono text-slate-300 bg-[#05070a]/90 px-3 py-1.5 rounded-xl border border-[#1e293b] backdrop-blur-md">
              <span>ATTITUDE: 0.00° ERROR</span>
              <span>ORBIT: 541.80 KM</span>
              <span className="text-green-400">POWER: 2,420W</span>
            </div>
          </div>
        </div>

        {/* Right Card: Faulted Twin + Agentic Remediation */}
        <div
          className={`bg-[#0f172a] border rounded-3xl flex flex-col overflow-hidden shadow-xl transition-all duration-300 ${
            simStage === 'catastrophic_failure'
              ? 'border-rose-600 shadow-[0_0_35px_rgba(244,63,94,0.4)] ring-2 ring-rose-500/50'
              : simStage === 'injected' || simStage === 'detected'
              ? 'border-rose-500/70 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
              : simStage === 'mitigating'
              ? 'border-amber-500/70 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
              : simStage === 'remediated'
              ? 'border-green-500/70 shadow-[0_0_20px_rgba(34,197,94,0.15)]'
              : 'border-[#1e293b]'
          }`}
        >
          <div className="p-4 border-b border-[#1e293b] flex items-center justify-between bg-[#0a1120]/80">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-cyan-400 font-bold">TWIN-02 //</span>
              <span className="text-xs uppercase text-slate-200 font-semibold tracking-wide">
                Faulted Twin + Agentic Remediation
              </span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase ${
                simStage === 'catastrophic_failure'
                  ? 'bg-rose-600 text-white font-black animate-pulse shadow-md'
                  : simStage === 'injected' || simStage === 'detected'
                  ? 'bg-rose-500 text-white animate-pulse'
                  : simStage === 'mitigating'
                  ? 'bg-amber-400 text-black'
                  : simStage === 'remediated'
                  ? 'bg-green-500 text-black'
                  : 'bg-[#05070a] text-slate-400 border border-[#1e293b]'
              }`}
            >
              {simStage === 'idle'
                ? 'STANDBY'
                : simStage === 'catastrophic_failure'
                ? 'CATASTROPHIC FAILURE'
                : simStage}
            </span>
          </div>

          <div className="relative h-56 bg-[#05070a] flex items-center justify-center p-4 overflow-hidden">
            {dynamicAuraIntensity > 0 && (
              <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-300 animate-pulse"
                style={{
                  background: `radial-gradient(circle, rgba(244,63,94,${dynamicAuraIntensity}) 0%, transparent 70%)`,
                }}
              />
            )}

            {/* Functional Reactive Vector Wireframe: Faulted & Remediated Digital Twin */}
            <svg viewBox="0 0 380 180" className="w-full h-full max-h-48 drop-shadow-[0_0_16px_rgba(239,68,68,0.2)]">
              <defs>
                <linearGradient id="fault-bus" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e1122" />
                  <stop offset="100%" stopColor="#0f172a" />
                </linearGradient>
              </defs>

              {/* Orbital Horizon Reference Line with Attitude Drift */}
              <line
                x1="20"
                y1={simStage === 'injected' || simStage === 'detected' ? '82' : '90'}
                x2="360"
                y2={simStage === 'injected' || simStage === 'detected' ? '98' : '90'}
                stroke={
                  simStage === 'catastrophic_failure'
                    ? '#f43f5e'
                    : simStage === 'injected' || simStage === 'detected'
                    ? '#fb7185'
                    : '#1e293b'
                }
                strokeDasharray="3 3"
                strokeWidth="0.8"
              />

              {/* Port Solar Array Wing */}
              <g
                transform={
                  simStage === 'catastrophic_failure'
                    ? 'translate(45, 58) rotate(-6 42 25)'
                    : simStage === 'injected'
                    ? 'translate(45, 62) rotate(-3 42 25)'
                    : 'translate(45, 65)'
                }
                className="transition-transform duration-500"
              >
                <rect
                  x="0"
                  y="0"
                  width="85"
                  height="50"
                  rx="3"
                  fill="#0369a1"
                  stroke={
                    simStage === 'catastrophic_failure'
                      ? '#e11d48'
                      : simStage === 'injected'
                      ? '#f59e0b'
                      : '#38bdf8'
                  }
                  strokeWidth="1"
                />
                <line x1="28" y1="0" x2="28" y2="50" stroke="#0c4a6e" strokeWidth="1" />
                <line x1="56" y1="0" x2="56" y2="50" stroke="#0c4a6e" strokeWidth="1" />
                <line x1="0" y1="25" x2="85" y2="25" stroke="#0c4a6e" strokeWidth="1" />
                <line x1="85" y1="25" x2="110" y2="25" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
              </g>

              {/* Starboard Solar Array Wing */}
              <g
                transform={
                  simStage === 'catastrophic_failure'
                    ? 'translate(250, 72) rotate(6 42 25)'
                    : simStage === 'injected'
                    ? 'translate(250, 68) rotate(3 42 25)'
                    : 'translate(250, 65)'
                }
                className="transition-transform duration-500"
              >
                <line x1="-25" y1="25" x2="0" y2="25" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
                <rect
                  x="0"
                  y="0"
                  width="85"
                  height="50"
                  rx="3"
                  fill="#0369a1"
                  stroke={
                    simStage === 'catastrophic_failure'
                      ? '#e11d48'
                      : simStage === 'injected'
                      ? '#f59e0b'
                      : '#38bdf8'
                  }
                  strokeWidth="1"
                />
                <line x1="28" y1="0" x2="28" y2="50" stroke="#0c4a6e" strokeWidth="1" />
                <line x1="56" y1="0" x2="56" y2="50" stroke="#0c4a6e" strokeWidth="1" />
                <line x1="0" y1="25" x2="85" y2="25" stroke="#0c4a6e" strokeWidth="1" />
              </g>

              {/* Spacecraft Main Bus Core (Reactive Color by Stage) */}
              <polygon
                points="160,50 220,50 240,90 220,130 160,130 140,90"
                fill="url(#fault-bus)"
                stroke={
                  simStage === 'catastrophic_failure'
                    ? '#e11d48'
                    : simStage === 'injected' || simStage === 'detected'
                    ? '#f43f5e'
                    : simStage === 'mitigating'
                    ? '#f59e0b'
                    : simStage === 'remediated'
                    ? '#10b981'
                    : '#0ea5e9'
                }
                strokeWidth="1.8"
                className="transition-colors duration-300"
              />

              {/* Nadir Earth Antenna Boom */}
              <line x1="190" y1="130" x2="190" y2="155" stroke="#64748b" strokeWidth="2" />
              <path d="M 175,155 Q 190,145 205,155" fill="none" stroke="#38bdf8" strokeWidth="2" />
              <circle
                cx="190"
                cy="150"
                r="2.5"
                fill={simStage === 'catastrophic_failure' ? '#e11d48' : '#38bdf8'}
              />

              {/* Fault Zone / Active Remediation Reticle */}
              <circle
                cx="190"
                cy="90"
                r="18"
                fill="none"
                stroke={
                  simStage === 'catastrophic_failure'
                    ? '#e11d48'
                    : simStage === 'injected' || simStage === 'detected'
                    ? '#f43f5e'
                    : simStage === 'mitigating'
                    ? '#f59e0b'
                    : '#10b981'
                }
                strokeWidth="1.2"
                strokeDasharray="4 2"
                className={simStage !== 'idle' ? 'animate-spin' : ''}
              />
              <circle
                cx="190"
                cy="90"
                r="6"
                fill={
                  simStage === 'catastrophic_failure'
                    ? '#e11d48'
                    : simStage === 'injected' || simStage === 'detected'
                    ? '#f43f5e'
                    : simStage === 'mitigating'
                    ? '#f59e0b'
                    : '#10b981'
                }
                className="animate-ping"
              />

              {/* Dynamic Fault Vector Pointer */}
              {simStage !== 'idle' && (
                <g>
                  <circle cx="160" cy="72" r="3" fill="#f43f5e" />
                  <line x1="160" y1="72" x2="130" y2="35" stroke="#f43f5e" strokeWidth="1" />
                  <rect x="55" y="24" width="75" height="15" rx="3" fill="#0f172a" stroke="#f43f5e" strokeWidth="0.8" />
                  <text x="60" y="35" fill="#f43f5e" fontSize="7.5" fontFamily="monospace" fontWeight="bold">
                    {simStage === 'catastrophic_failure'
                      ? 'FATAL BREACH'
                      : simStage === 'remediated'
                      ? 'SAFE ENVELOPE'
                      : `${activePreset.subsystem} FAULT`}
                  </text>
                </g>
              )}
            </svg>

            <div className="absolute top-3 left-3 bg-[#05070a]/90 px-2.5 py-1 rounded-xl border border-[#1e293b] text-[9px] font-mono backdrop-blur-md">
              LIVE SENSOR: <span className={liveStatusColor}>{liveValueText}</span>
            </div>

            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[9px] font-mono text-slate-300 bg-[#05070a]/90 px-3 py-1.5 rounded-xl border border-[#1e293b] backdrop-blur-md">
              <span className={simStage === 'catastrophic_failure' ? 'text-rose-400 font-bold' : 'text-cyan-400 font-bold'}>
                {simStage === 'catastrophic_failure'
                  ? `FATAL: ${domainInfo.catastrophicMechanism}`
                  : `DELTA: ${activePreset.deltaSummary}`}
              </span>
              <span className={simStage === 'catastrophic_failure' ? 'text-rose-500 font-black animate-pulse' : 'text-green-400 font-bold'}>
                {simStage === 'catastrophic_failure'
                  ? 'TERMINAL LOSS'
                  : simStage === 'remediated'
                  ? '99.4% SAVED'
                  : 'MONITORING'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Trajectory Chart */}
      <div className="bg-[#0f172a] border border-[#1e293b] p-5 rounded-3xl flex flex-col gap-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e293b]/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-cyan-400">GRAPH-01 //</span>
            <span className="text-xs uppercase text-slate-200 font-semibold tracking-wide">
              Real-Time Dynamic Trajectory & Fault Remediation Vector
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-4 text-[10px] font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-green-400 inline-block rounded-full"></span>
              <span className="text-slate-400">Nominal Baseline ({activePreset.baselineMetric})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-rose-400 border-b border-dashed border-rose-400 inline-block"></span>
              <span className="text-rose-400">Catastrophic Uncorrected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-cyan-400 inline-block rounded-full"></span>
              <span className="text-cyan-400 font-bold">
                {autonomySetting === 'suppressed' ? 'Unmitigated Open-Loop' : 'Closed-Loop Remediated'}
              </span>
            </div>
            <div className="px-2 py-0.5 rounded-lg bg-[#05070a] border border-[#1e293b] text-slate-300 font-bold">
              LIVE: <span className={liveStatusColor}>{liveValueText}</span>
            </div>
          </div>
        </div>

        <div className="relative h-68 w-full bg-[#05070a] rounded-2xl border border-[#1e293b] p-2 overflow-hidden select-none shadow-inner">
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(to right, #22d3ee 1px, transparent 1px), linear-gradient(to bottom, #22d3ee 1px, transparent 1px)',
              backgroundSize: '40px 30px',
            }}
          />

          {simTime === 0 && !simRunning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="bg-[#0f172a]/80 backdrop-blur-md px-4 py-2 rounded-xl border border-cyan-500/30 text-xs font-mono text-cyan-300 shadow-xl flex items-center gap-2">
                <Play size={12} className="text-amber-400" />
                <span>CLICK <strong>"RUN TEST HARNESS"</strong> TO STREAM LIVE ERROR TRAJECTORY</span>
              </div>
            </div>
          )}

          <svg
            className="w-full h-full overflow-visible cursor-crosshair"
            viewBox="0 0 800 200"
            preserveAspectRatio="none"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clientX = e.clientX - rect.left;
              const ratio = Math.max(
                0,
                Math.min(1, (clientX - (60 / 800) * rect.width) / ((700 / 800) * rect.width))
              );
              setHoverTime(Math.round(ratio * 15.0 * 10) / 10);
            }}
            onMouseLeave={() => setHoverTime(null)}
          >
            <defs>
              <linearGradient id="liveAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={
                    autonomySetting === 'suppressed' && simTime > activePreset.detectionTime
                      ? '#f43f5e'
                      : currentProbeY < 65
                      ? '#f43f5e'
                      : '#22d3ee'
                  }
                  stopOpacity="0.28"
                />
                <stop
                  offset="100%"
                  stopColor={
                    autonomySetting === 'suppressed' && simTime > activePreset.detectionTime
                      ? '#f43f5e'
                      : currentProbeY < 65
                      ? '#f43f5e'
                      : '#22d3ee'
                  }
                  stopOpacity="0.0"
                />
              </linearGradient>
            </defs>

            {activePreset.id === 'collision' ? (
              <g>
                <line x1="50" y1="60" x2="60" y2="60" stroke="#22c55e" strokeWidth="1.2" />
                <text x="10" y="63" fill="#22c55e" fontSize="8" fontFamily="monospace" fontWeight="bold">
                  542 km
                </text>
                <line x1="54" y1="95" x2="60" y2="95" stroke="#475569" strokeWidth="1" />
                <text x="10" y="98" fill="#94a3b8" fontSize="8" fontFamily="monospace">
                  538 km
                </text>
                <line x1="52" y1="130" x2="60" y2="130" stroke="#fbbf24" strokeWidth="1" />
                <text x="10" y="133" fill="#fbbf24" fontSize="8" fontFamily="monospace" fontWeight="bold">
                  534 km
                </text>
                <line x1="50" y1="165" x2="60" y2="165" stroke="#f43f5e" strokeWidth="1.2" />
                <text x="10" y="168" fill="#f43f5e" fontSize="8" fontFamily="monospace" fontWeight="bold">
                  530 km
                </text>

                <rect x="60" y="50" width="700" height="20" fill="#22c55e" fillOpacity="0.08" />
                <line
                  x1="60"
                  y1="60"
                  x2="760"
                  y2="60"
                  stroke="#22c55e"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.75"
                />
                <text x="65" y="56" fill="#22c55e" fontSize="8" fontFamily="monospace" opacity="0.9">
                  NOMINAL CIRCULAR LEO ORBIT // 541.80 km (TARGET ALTITUDE)
                </text>

                <line
                  x1="60"
                  y1="165"
                  x2="760"
                  y2="165"
                  stroke="#f43f5e"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  opacity="0.8"
                />
                <text x="65" y="177" fill="#f43f5e" fontSize="8" fontFamily="monospace" fontWeight="bold">
                  CRITICAL RE-ENTRY HAZARD THRESHOLD (&lt; 530.0 km) // RUNAWAY AERODYNAMIC DECAY
                </text>
              </g>
            ) : (
              <g>
                <rect x="60" y="130" width="700" height="40" fill="#22c55e" fillOpacity="0.06" />
                <line
                  x1="60"
                  y1="150"
                  x2="760"
                  y2="150"
                  stroke="#22c55e"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.6"
                />
                <text x="65" y="165" fill="#22c55e" fontSize="8" fontFamily="monospace" opacity="0.8">
                  NOMINAL BAND // {activePreset.baselineMetric}
                </text>

                <line
                  x1="60"
                  y1="50"
                  x2="760"
                  y2="50"
                  stroke="#f43f5e"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  opacity="0.6"
                />
                <text x="65" y="44" fill="#f43f5e" fontSize="8" fontFamily="monospace">
                  CRITICAL DAMAGE LIMIT (LVL 4 THRESHOLD) // {activePreset.telemetryChannel}
                </text>
              </g>
            )}

            {/* Uncorrected Catastrophic Projection Curve */}
            {(() => {
              const uncorrectedPoints: string[] = [];
              for (let t = 0; t <= 15.0; t += 0.1) {
                uncorrectedPoints.push(`${getXForTime(t).toFixed(1)},${getYForTime(t, true).toFixed(1)}`);
              }
              const uncorrectedPathD = `M ${uncorrectedPoints.join(' L ')}`;
              return (
                <path
                  d={uncorrectedPathD}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="1.6"
                  strokeDasharray="4 3"
                  opacity="0.65"
                />
              );
            })()}

            {/* Ghost Trajectory */}
            {(() => {
              const ghostPoints: string[] = [];
              for (let t = 0; t <= 15.0; t += 0.1) {
                ghostPoints.push(`${getXForTime(t).toFixed(1)},${getYForTime(t, false).toFixed(1)}`);
              }
              const ghostPathD = `M ${ghostPoints.join(' L ')}`;
              return (
                <path
                  d={ghostPathD}
                  fill="none"
                  stroke={autonomySetting === 'suppressed' ? '#f43f5e' : '#22d3ee'}
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  opacity={simTime > 0 ? 0.35 : 0.6}
                />
              );
            })()}

            {/* Specific Space Object Collision Pin */}
            {activePreset.id === 'collision' && (
              <g>
                {(() => {
                  const impactX = getXForTime(1.6);
                  const impactY = 60;
                  const isImpactPassed = simTime >= 1.6;
                  const altitudeLossKm = ((45 + (severityLevel - 1) * 20) * 0.0894).toFixed(2);
                  const postImpactAltKm = (541.8 - parseFloat(altitudeLossKm)).toFixed(2);
                  const postImpactY = 60 + 45 + (severityLevel - 1) * 20;

                  return (
                    <g>
                      <line
                        x1={impactX}
                        y1={24}
                        x2={impactX}
                        y2={impactY}
                        stroke="#f43f5e"
                        strokeWidth="1.6"
                        strokeDasharray="2 2"
                        opacity={0.85}
                      />

                      <g transform={`translate(${impactX}, 18)`}>
                        <rect
                          x="-88"
                          y="-15"
                          width="176"
                          height="23"
                          rx="5"
                          fill="#0b0f19"
                          stroke="#f43f5e"
                          strokeWidth="1.2"
                          filter="drop-shadow(0 0 8px rgba(244,63,94,0.35))"
                        />
                        <polygon points="0,8 -5,13 5,13" fill="#f43f5e" />
                        <circle cx="-74" cy="-4" r="5" fill="#f43f5e" fillOpacity="0.25" />
                        <circle cx="-74" cy="-4" r="2.5" fill="#f43f5e" />

                        <text
                          x="-64"
                          y="-7"
                          fill="#fda4af"
                          fontSize="7.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          SPACE OBJECT COLLISION PIN
                        </text>
                        <text
                          x="-64"
                          y="3"
                          fill="#94a3b8"
                          fontSize="6.5"
                          fontFamily="monospace"
                        >
                          OBJ-49211 (2.4cm @ 11.2 km/s)
                        </text>
                      </g>

                      <g transform={`translate(${impactX}, ${impactY})`}>
                        <circle
                          r="6"
                          fill="#f43f5e"
                          fillOpacity={isImpactPassed ? 0.95 : 0.4}
                          stroke="#ffffff"
                          strokeWidth="1"
                        />
                        <circle
                          r="12"
                          fill="none"
                          stroke="#f43f5e"
                          strokeWidth="1.2"
                          strokeDasharray="3 2"
                          opacity={isImpactPassed ? 0.85 : 0.3}
                          className={isImpactPassed ? 'animate-ping' : ''}
                        />
                        <circle
                          r="18"
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth="0.8"
                          opacity={0.4}
                        />
                        <text
                          x="9"
                          y="13"
                          fill="#f43f5e"
                          fontSize="7.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          T+1.6s IMPACT POINT
                        </text>
                      </g>

                      <g transform={`translate(${impactX + 45}, 0)`}>
                        <line x1="-8" y1={impactY} x2="8" y2={impactY} stroke="#f43f5e" strokeWidth="1" />
                        <line
                          x1="0"
                          y1={impactY}
                          x2="0"
                          y2={postImpactY}
                          stroke="#f43f5e"
                          strokeWidth="1.2"
                          strokeDasharray="2 2"
                        />
                        <line
                          x1="-8"
                          y1={postImpactY}
                          x2="8"
                          y2={postImpactY}
                          stroke="#f43f5e"
                          strokeWidth="1"
                        />
                        <polygon
                          points={`0,${postImpactY} -4,${postImpactY - 7} 4,${postImpactY - 7}`}
                          fill="#f43f5e"
                        />

                        <g transform={`translate(12, ${(impactY + postImpactY) / 2 - 12})`}>
                          <rect
                            x="0"
                            y="0"
                            width="144"
                            height="25"
                            rx="5"
                            fill="#05070a"
                            stroke="#f43f5e"
                            strokeWidth="1"
                            filter="drop-shadow(0 0 6px rgba(244,63,94,0.25))"
                          />
                          <text
                            x="6"
                            y="10"
                            fill="#fb7185"
                            fontSize="8"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            ▼ ALTITUDE DROP: -{altitudeLossKm} km
                          </text>
                          <text
                            x="6"
                            y="20"
                            fill="#94a3b8"
                            fontSize="7"
                            fontFamily="monospace"
                          >
                            Perigee post-impact: {postImpactAltKm} km
                          </text>
                        </g>
                      </g>

                      {autonomySetting !== 'suppressed' && (
                        <g transform={`translate(${getXForTime(effectiveMitigationTime)}, ${postImpactY})`}>
                          <line
                            x1="0"
                            y1="0"
                            x2="0"
                            y2={impactY - postImpactY + 12}
                            stroke="#22d3ee"
                            strokeWidth="1.2"
                            strokeDasharray="2 2"
                          />
                          <polygon
                            points={`0,${impactY - postImpactY + 10} -4,${impactY - postImpactY + 17} 4,${impactY - postImpactY + 17}`}
                            fill="#22d3ee"
                          />
                          <g transform="translate(8, -16)">
                            <rect
                              x="0"
                              y="-8"
                              width="134"
                              height="22"
                              rx="4"
                              fill="#05070a"
                              stroke="#22d3ee"
                              strokeWidth="0.8"
                            />
                            <text
                              x="6"
                              y="2"
                              fill="#38bdf8"
                              fontSize="7.5"
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              ▲ PROGRADE ΔV BURN
                            </text>
                            <text
                              x="6"
                              y="10"
                              fill="#94a3b8"
                              fontSize="6.5"
                              fontFamily="monospace"
                            >
                              +4.2 m/s · Restoring 541.8 km
                            </text>
                          </g>
                        </g>
                      )}
                    </g>
                  );
                })()}
              </g>
            )}

            {/* Dynamic Live Streamed Trajectory */}
            {simTime > 0 &&
              (() => {
                const livePoints: string[] = [];
                const maxSampleT = Math.min(15.0, simTime);
                for (let t = 0; t <= maxSampleT; t += 0.05) {
                  livePoints.push(`${getXForTime(t).toFixed(1)},${getYForTime(t, false).toFixed(1)}`);
                }
                if (maxSampleT % 0.05 !== 0) {
                  livePoints.push(
                    `${getXForTime(maxSampleT).toFixed(1)},${getYForTime(maxSampleT, false).toFixed(1)}`
                  );
                }
                const livePathD = livePoints.length > 1 ? `M ${livePoints.join(' L ')}` : '';
                const baselineFillY = activePreset.id === 'collision' ? 60 : 150;
                const liveAreaD =
                  livePoints.length > 1
                    ? `M ${getXForTime(0).toFixed(1)},${baselineFillY} L ${livePoints.join(' L ')} L ${getXForTime(
                        maxSampleT
                      ).toFixed(1)},${baselineFillY} Z`
                    : '';

                let strokeColor = '#22d3ee';
                if ((autonomySetting === 'suppressed' || isCatastrophic) && simTime > activePreset.detectionTime) {
                  strokeColor = '#f43f5e';
                } else if (activePreset.id === 'collision') {
                  if (simTime < 1.6) strokeColor = '#22c55e';
                  else if (currentProbeY > 115) strokeColor = '#f43f5e';
                  else if (currentProbeY > 75) strokeColor = '#fbbf24';
                  else strokeColor = '#22c55e';
                } else {
                  if (currentProbeY < 65) strokeColor = '#f43f5e';
                  else if (currentProbeY < 120) strokeColor = '#fbbf24';
                  else strokeColor = '#22d3ee';
                }

                return (
                  <g>
                    <path d={liveAreaD} fill="url(#liveAreaGradient)" />
                    <path
                      d={livePathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="2.8"
                      strokeLinecap="round"
                    />
                  </g>
                );
              })()}

            {/* Stage Event Points on Curve */}
            {(() => {
              const pInject = {
                t: 0,
                x: getXForTime(0),
                y: getYForTime(0, false),
                label: 'T+0s FAULT INJECT',
                color: '#fbbf24',
              };
              const pDetect = {
                t: activePreset.detectionTime,
                x: getXForTime(activePreset.detectionTime),
                y: getYForTime(activePreset.detectionTime, false),
                label: `T+${activePreset.detectionTime}s DETECTED (${(severityLevel * 1.1 + 1.2).toFixed(1)}σ)`,
                color: '#22d3ee',
              };
              const pMitigate = {
                t: effectiveMitigationTime,
                x: getXForTime(effectiveMitigationTime),
                y: getYForTime(effectiveMitigationTime, false),
                label: isCatastrophic
                  ? `T+${effectiveMitigationTime.toFixed(1)}s MITIGATION FAILED (${isGoverningAgentOffline ? offlineDependentAgents.map(a => a.name).join(' & ') : 'QUORUM'} OFFLINE)`
                  : autonomySetting === 'suppressed'
                  ? 'AUTONOMY OFF (NO MITIGATION)'
                  : autonomySetting === 'hitl'
                  ? `T+${effectiveMitigationTime.toFixed(1)}s HITL MITIGATE`
                  : `T+${effectiveMitigationTime.toFixed(1)}s MITIGATION`,
                color: isCatastrophic || autonomySetting === 'suppressed' ? '#f43f5e' : '#22c55e',
              };
              const pRecover = {
                t: effectiveRecoveryTime,
                x: getXForTime(effectiveRecoveryTime),
                y: getYForTime(effectiveRecoveryTime, false),
                label: isCatastrophic
                  ? `T+${effectiveRecoveryTime.toFixed(1)}s CATASTROPHIC FAILURE`
                  : autonomySetting === 'suppressed'
                  ? 'TERMINAL CATASTROPHE'
                  : `T+${effectiveRecoveryTime.toFixed(1)}s NOMINAL ENVELOPE`,
                color: isCatastrophic || autonomySetting === 'suppressed' ? '#f43f5e' : '#22c55e',
              };

              return [pInject, pDetect, pMitigate, pRecover].map((pt, idx) => {
                const isPassed = simTime >= pt.t;
                return (
                  <g key={idx} transform={`translate(${pt.x}, ${pt.y})`}>
                    <circle
                      r={isPassed ? 4.5 : 3}
                      fill={pt.color}
                      opacity={isPassed ? 1 : 0.4}
                    />
                    {isPassed && simRunning && Math.abs(simTime - pt.t) < 0.6 && (
                      <circle r="9" fill={pt.color} fillOpacity="0.3" className="animate-ping" />
                    )}
                    <text
                      x={idx === 3 ? -100 : 8}
                      y={idx % 2 === 0 ? -9 : 14}
                      fill={pt.color}
                      fontSize="8"
                      fontFamily="monospace"
                      opacity={isPassed ? 1 : 0.5}
                      fontWeight={isPassed ? 'bold' : 'normal'}
                    >
                      {pt.label}
                    </text>
                  </g>
                );
              });
            })()}

            {/* Live Streaming Probe Cursor */}
            {simTime > 0 && (
              <g transform={`translate(${getXForTime(simTime)}, ${currentProbeY})`}>
                <line
                  x1="0"
                  y1={-currentProbeY}
                  x2="0"
                  y2={200 - currentProbeY}
                  stroke="#ffffff"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity="0.4"
                />
                <circle
                  r="9"
                  fill={
                    autonomySetting === 'suppressed' && simTime > activePreset.detectionTime
                      ? '#f43f5e'
                      : activePreset.id === 'collision'
                      ? currentProbeY > 115
                        ? '#f43f5e'
                        : currentProbeY > 75
                        ? '#fbbf24'
                        : '#22c55e'
                      : currentProbeY < 65
                      ? '#f43f5e'
                      : currentProbeY < 120
                      ? '#fbbf24'
                      : '#22d3ee'
                  }
                  fillOpacity="0.3"
                  className="animate-ping"
                />
                <circle
                  r="4.5"
                  fill={
                    autonomySetting === 'suppressed' && simTime > activePreset.detectionTime
                      ? '#f43f5e'
                      : activePreset.id === 'collision'
                      ? currentProbeY > 115
                        ? '#f43f5e'
                        : currentProbeY > 75
                        ? '#fbbf24'
                        : '#22c55e'
                      : currentProbeY < 65
                      ? '#f43f5e'
                      : currentProbeY < 120
                      ? '#fbbf24'
                      : '#22d3ee'
                  }
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />

                <g transform="translate(0, -18)">
                  <rect
                    x="-56"
                    y="-10"
                    width="112"
                    height="16"
                    rx="4"
                    fill="#05070a"
                    stroke={
                      autonomySetting === 'suppressed' && simTime > activePreset.detectionTime
                        ? '#f43f5e'
                        : activePreset.id === 'collision'
                        ? currentProbeY > 115
                          ? '#f43f5e'
                          : currentProbeY > 75
                          ? '#fbbf24'
                          : '#22c55e'
                        : currentProbeY < 65
                        ? '#f43f5e'
                        : '#22d3ee'
                    }
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="2"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="7.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {liveValueText}
                  </text>
                </g>
              </g>
            )}

            {/* Hover Tooltip Probe */}
            {hoverTime !== null && (
              <g transform={`translate(${getXForTime(hoverTime)}, 0)`}>
                <line x1="0" y1="0" x2="0" y2="200" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
                <circle cx="0" cy={getYForTime(hoverTime, false)} r="4" fill="#38bdf8" />
                <g transform={`translate(0, ${Math.max(25, getYForTime(hoverTime, false) - 20)})`}>
                  <rect
                    x="-45"
                    y="-12"
                    width="90"
                    height="18"
                    rx="4"
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="1"
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize="8"
                    fontFamily="monospace"
                  >
                    T+{hoverTime.toFixed(1)}s: {getFormattedMetric(hoverTime)}
                  </text>
                </g>
              </g>
            )}
          </svg>

          <div className="absolute bottom-1 left-3 right-3 flex justify-between text-[8px] font-mono text-slate-400">
            <span>T+00:00s (Inject)</span>
            <span>
              T+{activePreset.detectionTime.toFixed(1)}s (
              {activePreset.id === 'collision' ? 'Impact / Detect' : 'Detect'})
            </span>
            <span>
              T+{effectiveMitigationTime.toFixed(1)}s (
              {autonomySetting === 'suppressed' ? 'Off' : autonomySetting === 'hitl' ? 'HITL' : 'Mitigate'})
            </span>
            <span>
              T+{effectiveRecoveryTime.toFixed(1)}s (
              {autonomySetting === 'suppressed' ? 'Runaway' : 'Recovered'})
            </span>
            <span>T+15:00s</span>
          </div>
        </div>
      </div>

      {/* 4-Stage Autonomous Self-Healing Pipeline */}
      <div className="bg-[#0f172a] border border-[#1e293b] p-5 rounded-3xl flex flex-col gap-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#1e293b]/60 pb-3">
          <span className="text-xs uppercase text-slate-200 font-semibold tracking-wide">
            Autonomous 4-Stage Self-Healing Execution Pipeline
          </span>
          <span className="text-[10px] font-mono text-green-400 font-semibold bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/30">
            EST. RECOVERY TIME: {autonomySetting === 'suppressed' ? 'UNRECOVERED' : `${effectiveRecoveryTime.toFixed(1)}s`}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
          <div
            className={`p-4 rounded-2xl border flex flex-col justify-between transition-all shadow-sm ${
              simTime >= activePreset.detectionTime
                ? 'bg-[#05070a] border-green-400/60 text-white ring-1 ring-green-400/20'
                : 'bg-[#05070a] border-[#1e293b] text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-cyan-400 font-bold">01 // DETECTION</span>
              {simTime >= activePreset.detectionTime ? (
                <CheckCircle2 size={14} className="text-green-400" />
              ) : (
                <span className="text-[9px] text-slate-400">T+{activePreset.detectionTime}s</span>
              )}
            </div>
            <div className="text-xs font-semibold my-1 text-slate-100">
              Sensor Variance &gt; {(severityLevel * 1.1 + 1.2).toFixed(1)}σ
            </div>
            <div className="text-[9px] text-slate-400">
              Agent-Alpha identified rate spike above statistical noise floor.
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border flex flex-col justify-between transition-all shadow-sm ${
              isFdirOffline
                ? 'bg-[#05070a] border-rose-500/50 text-rose-300'
                : simTime >= activePreset.detectionTime + 1.0
                ? 'bg-[#05070a] border-green-400/60 text-white ring-1 ring-green-400/20'
                : 'bg-[#05070a] border-[#1e293b] text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-cyan-400 font-bold">02 // ISOLATION & RCA</span>
              {isFdirOffline ? (
                <span className="text-[9px] text-rose-400 font-bold">FDIR OFFLINE</span>
              ) : simTime >= activePreset.detectionTime + 1.0 ? (
                <CheckCircle2 size={14} className="text-green-400" />
              ) : (
                <span className="text-[9px] text-slate-400">
                  T+{(activePreset.detectionTime + 1.0).toFixed(1)}s
                </span>
              )}
            </div>
            <div className="text-xs font-semibold my-1 text-slate-100">
              {isFdirOffline ? 'FDIR Supervisor Isolated' : 'Bayesian Root Cause'}
            </div>
            <div className="text-[9px] text-slate-400">
              {isFdirOffline
                ? 'Agent-Delta offline: telemetry correlation & fault matrix unavailable.'
                : `Agent-Delta FDIR isolated ${activePreset.subsystem.toLowerCase()} fault via telemetry correlation.`}
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border flex flex-col justify-between transition-all shadow-sm ${
              isCatastrophic
                ? 'bg-[#05070a] border-rose-500/50 text-rose-300'
                : autonomySetting === 'suppressed'
                ? 'bg-[#05070a] border-rose-500/50 text-rose-300'
                : simTime >= effectiveMitigationTime
                ? 'bg-[#05070a] border-green-400/60 text-white ring-1 ring-green-400/20'
                : 'bg-[#05070a] border-[#1e293b] text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-cyan-400 font-bold">03 // SWARM CONSENSUS</span>
              {isCatastrophic ? (
                <span className="text-[9px] text-rose-400 font-bold">SEVERED (OFFLINE)</span>
              ) : autonomySetting === 'suppressed' ? (
                <span className="text-[9px] text-rose-400 font-bold">SUPPRESSED</span>
              ) : simTime >= effectiveMitigationTime ? (
                <CheckCircle2 size={14} className="text-green-400" />
              ) : (
                <span className="text-[9px] text-slate-400">T+{effectiveMitigationTime.toFixed(1)}s</span>
              )}
            </div>
            <div className="text-xs font-semibold my-1 text-slate-100">
              {isCatastrophic
                ? isGoverningAgentOffline
                  ? `Governor [${offlineDependentAgents.map(a => a.name).join(' & ')}] Offline`
                  : 'FDIR Supervisor Offline'
                : autonomySetting === 'suppressed'
                ? 'Autonomous Mitigation Disabled'
                : autonomySetting === 'hitl'
                ? 'HITL Gate Approved'
                : 'Raft-BFT 4/4 Quorum'}
            </div>
            <div className="text-[9px] text-slate-400">
              {isCatastrophic
                ? 'Autonomous actuation uncommanded: responsible agent node is isolated from mesh.'
                : autonomySetting === 'suppressed'
                ? 'Open-loop mode: no mitigation commands dispatched.'
                : 'Mesh signed remediation plan without ground station uplink.'}
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border flex flex-col justify-between transition-all shadow-sm ${
              (isCatastrophic || autonomySetting === 'suppressed') && simTime >= activePreset.detectionTime
                ? 'bg-[#05070a] border-rose-500/50 text-rose-400'
                : simTime >= effectiveRecoveryTime
                ? 'bg-[#05070a] border-green-400/60 text-white ring-1 ring-green-400/20'
                : 'bg-[#05070a] border-[#1e293b] text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-cyan-400 font-bold">04 // VERIFY & RESTORE</span>
              {(isCatastrophic || autonomySetting === 'suppressed') && simTime >= activePreset.detectionTime ? (
                <span className="text-[9px] text-rose-400 font-bold animate-pulse">FAILURE</span>
              ) : simTime >= effectiveRecoveryTime ? (
                <CheckCircle2 size={14} className="text-green-400" />
              ) : (
                <span className="text-[9px] text-slate-400">T+{effectiveRecoveryTime.toFixed(1)}s</span>
              )}
            </div>
            <div className="text-xs font-semibold my-1 text-slate-100">
              {(isCatastrophic || autonomySetting === 'suppressed') && simTime >= activePreset.detectionTime
                ? 'Catastrophic Runaway'
                : 'Flight Envelope Nominal'}
            </div>
            <div className="text-[9px] text-slate-400">
              {(isCatastrophic || autonomySetting === 'suppressed') && simTime >= activePreset.detectionTime
                ? `${domainInfo.catastrophicMechanism}`
                : 'Secondary cooling engaged, attitude stabilized, thermal drift arrested.'}
            </div>
          </div>
        </div>
      </div>

      {/* OrbitGuard Deterministic Safety Validator & Gemini AI Consensus */}
      <div className="bg-[#0f172a] border border-cyan-500/30 p-5 rounded-3xl flex flex-col gap-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#1e293b]/60 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <ShieldCheck size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase text-white font-bold tracking-wide">
                  OrbitGuard Safety Verification & Gemini 3.8 Flash Consensus
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] bg-cyan-500/10 text-cyan-400 font-mono font-bold border border-cyan-500/30">
                  HYBRID DIGITAL TWIN
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-400">
                Deterministic constraint satisfaction (OrbitGuard) + Generative reasoning (Gemini Agent Delta)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            {ogApiStatus === 'calling' ? (
              <span className="text-amber-400 flex items-center gap-1.5 text-[11px] bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/30">
                <RefreshCw size={12} className="animate-spin" />
                VERIFYING ENVELOPES...
              </span>
            ) : hybridResult ? (
              <span className="text-emerald-400 flex items-center gap-1.5 text-[11px] bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/30">
                <CheckCircle2 size={12} />
                SAFETY SCORE: {((hybridResult.orbitGuardValidation?.safety_score ?? 0.9) * 100).toFixed(0)}%
              </span>
            ) : (
              <span className="text-slate-400 text-[11px] bg-[#05070a] px-2.5 py-1 rounded-xl border border-[#1e293b]">
                STATUS: STANDBY (RUN TEST TO ENGAGE)
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 font-mono">
          {/* Left Column: OrbitGuard Deterministic Constraint Validation */}
          <div className="bg-[#05070a] p-4 rounded-2xl border border-[#1e293b] flex flex-col justify-between gap-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server size={14} className="text-cyan-400" />
                  <span className="text-xs text-white font-bold uppercase">OrbitGuard Constraints Engine</span>
                </div>
                <span className="text-[10px] text-slate-400">SAT-01 TWIN</span>
              </div>

              {/* Safety Score Meter */}
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-400">DETERMINISTIC SAFETY SCORE</span>
                  <span className="text-cyan-400 font-bold">
                    {hybridResult?.orbitGuardValidation
                      ? `${(hybridResult.orbitGuardValidation.safety_score * 100).toFixed(0)}% / 100%`
                      : '90% (NOMINAL CORRIDOR)'}
                  </span>
                </div>
                <div className="w-full bg-[#0a1120] h-2 rounded-full overflow-hidden border border-[#1e293b]">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
                    style={{
                      width: `${
                        hybridResult?.orbitGuardValidation
                          ? hybridResult.orbitGuardValidation.safety_score * 100
                          : 90
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Checks list */}
              <div className="space-y-2 text-[11px]">
                {(
                  hybridResult?.orbitGuardValidation?.checks || [
                    { check_name: 'Thermal Mode Payload Interlock', passed: true, details: 'Payload power throttled below 35W' },
                    { check_name: 'ADCS Wheel Stability Interlock', passed: true, details: 'Reaction wheel speed < 4800 RPM' },
                    { check_name: 'Battery SoC Safety Margin', passed: true, details: 'State of charge preserved > 45%' },
                    { check_name: 'Contingency Rollback Definition', passed: true, details: 'Safe-hold pointing vector indexed' },
                  ]
                ).map((chk, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between p-2 rounded-xl bg-[#0a1120] border border-[#1e293b]/80 gap-2"
                  >
                    <div className="flex items-start gap-2">
                      {chk.passed ? (
                        <CheckCircle2 size={13} className="text-emerald-400 mt-0.5 shrink-0" />
                      ) : (
                        <AlertTriangle size={13} className="text-rose-400 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <div className="font-semibold text-slate-200">{chk.check_name}</div>
                        <div className="text-[10px] text-slate-400">{chk.details}</div>
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                        chk.passed
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {chk.passed ? 'PASSED' : 'FLAGGED'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-[#1e293b] flex items-center justify-between text-[10px]">
              <span className="text-slate-400">ENDPOINT: /api/plans/validate</span>
              <button
                onClick={() => {
                  sound.playClick();
                  resetSim();
                }}
                disabled={ogResetting}
                className="px-2.5 py-1 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] border border-[#1e293b] text-slate-300 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw size={10} className={ogResetting ? 'animate-spin' : ''} />
                Reset OrbitGuard Twin
              </button>
            </div>
          </div>

          {/* Right Column: Gemini 3.8 Flash Agent Delta Reasoning */}
          <div className="bg-[#05070a] p-4 rounded-2xl border border-[#1e293b] flex flex-col justify-between gap-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-400" />
                  <span className="text-xs text-white font-bold uppercase">Gemini 3.8 Flash Supervisor</span>
                </div>
                <span className="text-[9px] bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30 font-bold">
                  AGENT DELTA (FDIR)
                </span>
              </div>

              {/* Assessment Card */}
              <div className="p-3 rounded-xl bg-[#0a1120] border border-[#1e293b] space-y-1.5">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Cognitive Diagnostics Assessment</div>
                <div className="text-slate-200 text-xs leading-relaxed font-sans">
                  {hybridResult?.geminiAnalysis?.supervisorAssessment ||
                    `Swarm supervisor actively synthesizing physical telemetry envelopes with mathematical flight rule constraints. Anomaly signature correlated to ${activePreset.subsystem} domain.`}
                </div>
              </div>

              {/* Action Plan & Consensus */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2.5 rounded-xl bg-[#0a1120] border border-[#1e293b]">
                  <span className="text-slate-400 uppercase text-[9px]">Root Cause Classification</span>
                  <div className="font-bold text-cyan-300 mt-0.5 truncate">
                    {hybridResult?.geminiAnalysis?.rootCause || `${activePreset.title} Transient`}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#0a1120] border border-[#1e293b]">
                  <span className="text-slate-400 uppercase text-[9px]">Raft-BFT Swarm Consensus</span>
                  <div className="font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
                    <ShieldCheck size={12} />
                    {hybridResult?.geminiAnalysis?.consensusVerdict || '4/4 Quorum Signed'}
                  </div>
                </div>
              </div>

              {/* Recommended Steps */}
              <div className="p-2.5 rounded-xl bg-[#0a1120] border border-[#1e293b] space-y-1">
                <span className="text-slate-400 uppercase text-[9px] font-semibold">Recommended Recovery Actions</span>
                <div className="space-y-1 text-[11px] text-slate-300">
                  {(
                    hybridResult?.geminiAnalysis?.recommendedActions || [
                      '1. Divert non-critical power bus loads',
                      '2. Trim reaction wheel momentum via magnetic torquers',
                      '3. Commit signed mitigation vector to telemetry log',
                    ]
                  ).map((act, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                      <span className="truncate">{act}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#1e293b] flex items-center justify-between text-[10px] text-slate-400">
              <span>LATENCY: ~210ms</span>
              <span className="text-emerald-400 font-semibold">STATUS: NOMINAL SYNC</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Multi-Agent Diagnostic Command Journal */}
      <div className="bg-[#0f172a] border border-[#1e293b] p-5 rounded-3xl flex flex-col gap-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e293b]/60 pb-3">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-cyan-400" />
            <span className="text-xs uppercase text-slate-200 font-semibold tracking-wide">
              Live Diagnostic Command Journal & Trace Log
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[9px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              RECORDING TO TRIAL LOG (DOWNLOADABLE IN ANALYTICS)
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {journalLogs.length} LOG EVENTS STREAMING
            </span>
          </div>
        </div>

        <div
          ref={journalContainerRef}
          className="h-48 overflow-y-auto bg-[#05070a] p-4 rounded-2xl border border-[#1e293b] flex flex-col gap-2 font-mono text-xs shadow-inner"
        >
          {journalLogs.length === 0 ? (
            <div className="text-slate-500 italic text-center my-auto py-8">
              No active anomaly running. Click "RUN TEST HARNESS" above to inject a fault and observe live multi-agent reasoning traces.
            </div>
          ) : (
            journalLogs.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2.5 py-1 border-b border-[#1e293b]/40 last:border-0 hover:bg-[#0f172a]/60 rounded px-1.5 transition-colors"
              >
                <span className="text-slate-400 text-[10px] shrink-0">{entry.timestamp}</span>
                <span className="text-cyan-400 font-semibold shrink-0 text-[11px]">{entry.agent}</span>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase shrink-0 ${entry.tagColor}`}>
                  {entry.tag}
                </span>
                <span className="text-slate-200 text-[11px] leading-tight break-all">{entry.message}</span>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleTransmitOverride} className="flex gap-2.5">
          <input
            type="text"
            value={customOverrideInput}
            onChange={(e) => setCustomOverrideInput(e.target.value)}
            placeholder="Inject live synthetic parameter or agent prompt override (e.g., SET_VALVE_PWM=40, SLEW_ROLL=-10)..."
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#05070a] border border-[#1e293b] text-xs font-mono text-white placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-400 shadow-inner"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-cyan-500 text-black font-mono text-xs font-bold uppercase hover:bg-cyan-400 transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Send size={13} />
            TRANSMIT OVERRIDE
          </button>
        </form>
      </div>
    </div>
  );
};
