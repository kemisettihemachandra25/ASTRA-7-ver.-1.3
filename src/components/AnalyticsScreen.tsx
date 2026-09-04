import React, { useState, useEffect } from 'react';
import { AgentStatus, HistoricalIncident } from '../types';
import { HISTORICAL_INCIDENTS } from '../data/mockFlightData';
import { DatabaseExplorerView } from './DatabaseExplorerView';
import { SandboxTrialTraceViewer } from './SandboxTrialTraceViewer';
import {
  sandboxTrialRecorder,
  exportTrialsToCsv,
  exportTrialsToText,
  RecordedSandboxTrial,
} from '../utils/sandboxTrialRecorder';
import { sound } from '../utils/audio';
import {
  Download,
  CheckCircle2,
  TrendingUp,
  Clock,
  ShieldCheck,
  Zap,
  BatteryCharging,
  Flame,
  FileSpreadsheet,
  FileText,
  Terminal,
  Database,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface AnalyticsScreenProps {
  agents: AgentStatus[];
}

export const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ agents }) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'database' | 'sandbox-trials'>('analytics');
  const [incidentFilter, setIncidentFilter] = useState<string>('ALL');
  const [incidents] = useState<HistoricalIncident[]>(HISTORICAL_INCIDENTS);
  const [telemetryTimeframe, setTelemetryTimeframe] = useState<'30D' | '60D' | '90D'>('90D');
  const [sandboxTrials, setSandboxTrials] = useState<RecordedSandboxTrial[]>(() =>
    sandboxTrialRecorder.getTrials()
  );

  useEffect(() => {
    const handleUpdate = () => {
      setSandboxTrials([...sandboxTrialRecorder.getTrials()]);
    };
    window.addEventListener('orion7_sandbox_trials_updated', handleUpdate);
    return () => window.removeEventListener('orion7_sandbox_trials_updated', handleUpdate);
  }, []);

  const handleDownloadTrialCsv = () => {
    sound.playClick();
    exportTrialsToCsv(sandboxTrials);
  };

  const handleDownloadTrialText = () => {
    sound.playClick();
    exportTrialsToText(sandboxTrials);
  };

  const filteredIncidents =
    incidentFilter === 'ALL'
      ? incidents
      : incidents.filter((inc) => inc.subsystem.toUpperCase().includes(incidentFilter));

  const handleExportCsv = () => {
    sound.playClick();
    const csvRows = [
      ['ID', 'Timestamp', 'Subsystem', 'Description', 'Autonomy Level', 'MTTR (sec)', 'Outcome'].join(','),
      ...incidents.map((i) =>
        [
          i.id,
          `"${i.timestamp}"`,
          i.subsystem,
          `"${i.description}"`,
          i.autonomyLevel,
          i.mttrSeconds,
          i.outcome,
        ].join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ORION-Mission-Telemetry-Log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    sound.playClick();
    const exportData = {
      mission: 'ORION Autonomous Satellite Digital Twin',
      spacecraftId: 'ORION-NORAD-49211',
      epochTime: new Date().toISOString(),
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        subsystem: a.subsystem,
        confidence: a.confidence,
        state: a.state,
      })),
      incidents,
      telemetrySummary: {
        totalAnomaliesMitigated: 142,
        unassistedResolutionRate: '98.6%',
        meanTimeToRemediate: '3.42 seconds',
        propellantRemainingKg: 18.4,
        batteryStateOfHealth: '97.2%',
      },
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ORION-DigitalTwin-Dataset-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Top Mode Switcher */}
      <div className="flex items-center gap-2 border-b border-[#1e293b] pb-2 font-mono text-xs">
        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('analytics');
          }}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-cyan-500 text-black font-bold shadow-md'
              : 'bg-[#0f172a] text-slate-400 hover:text-white border border-[#1e293b]'
          }`}
        >
          <TrendingUp size={14} />
          OPERATIONAL ANALYTICS & MTTR
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('sandbox-trials');
          }}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'sandbox-trials'
              ? 'bg-cyan-500 text-black font-bold shadow-md'
              : 'bg-[#0f172a] text-slate-400 hover:text-white border border-[#1e293b]'
          }`}
        >
          <Terminal size={14} />
          SANDBOX TRIAL JOURNAL TRACES ({sandboxTrials.length})
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('database');
          }}
          className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'database'
              ? 'bg-cyan-500 text-black font-bold shadow-md'
              : 'bg-[#0f172a] text-slate-400 hover:text-white border border-[#1e293b]'
          }`}
        >
          <Database size={14} />
          INGESTED FLIGHT DATABASE (17 TABLES)
        </button>
      </div>

      {activeTab === 'database' ? (
        <DatabaseExplorerView />
      ) : activeTab === 'sandbox-trials' ? (
        <SandboxTrialTraceViewer
          trials={sandboxTrials}
          onRefresh={() => setSandboxTrials([...sandboxTrialRecorder.getTrials()])}
        />
      ) : (
        <>
          {/* Header Bar with Export Options */}
          <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shadow-sm">
            <TrendingUp size={20} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm text-white font-semibold uppercase tracking-wide">
                FLIGHT OPERATIONS ANALYTICS & MTTR METRICS
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/30">
                MISSION DAY 412 // ON-ORBIT ARCHIVE
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-400">
              HISTORICAL TELEMETRY VERIFICATION, DEGRADATION PROJECTIONS & HITL AUDIT TRAIL
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <button
            onClick={handleDownloadTrialText}
            className="px-3 py-2 rounded-xl bg-[#05070a] border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-sm font-semibold"
            title="Download formatted text trace of all recorded sandbox trials"
          >
            <FileText size={13} className="text-cyan-400" />
            DOWNLOAD TRIAL TRACE (TXT)
          </button>
          <button
            onClick={handleDownloadTrialCsv}
            className="px-3 py-2 rounded-xl bg-[#05070a] border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-sm font-semibold"
            title="Download CSV trace of all recorded sandbox trials"
          >
            <FileSpreadsheet size={13} className="text-emerald-400" />
            DOWNLOAD TRIAL TRACE (CSV)
          </button>
          <button
            onClick={handleExportCsv}
            className="px-3 py-2 rounded-xl bg-[#05070a] border border-[#1e293b] hover:border-cyan-400 text-slate-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <FileSpreadsheet size={13} className="text-green-400" />
            EXPORT CSV
          </button>
          <button
            onClick={handleExportJson}
            className="px-3.5 py-2 rounded-xl bg-cyan-500 text-black font-bold uppercase hover:bg-cyan-400 flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
          >
            <Download size={13} />
            EXPORT JSON DATASET
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0f172a] border border-[#1e293b] p-5 rounded-3xl flex flex-col justify-between shadow-xl hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 font-mono text-xs">
            <span>MEAN TIME TO REMEDIATE</span>
            <Clock size={16} className="text-cyan-400" />
          </div>
          <div className="my-2">
            <span className="font-mono text-3xl font-bold text-cyan-400">3.42s</span>
            <span className="text-[11px] font-mono text-green-400 ml-2">(-82% vs Ground Uplink)</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Autonomous onboard resolution vs 18-minute Svalbard pass latency window.
          </span>
        </div>

        <div className="bg-[#0f172a] border border-[#1e293b] p-5 rounded-3xl flex flex-col justify-between shadow-xl hover:border-green-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 font-mono text-xs">
            <span>UNASSISTED RESOLUTION RATE</span>
            <ShieldCheck size={16} className="text-green-400" />
          </div>
          <div className="my-2">
            <span className="font-mono text-3xl font-bold text-green-400">98.6%</span>
            <span className="text-[11px] font-mono text-slate-400 ml-2">(140/142 Incidents)</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Only 2 events escalated to Flight Director HITL authorization gate.
          </span>
        </div>

        <div className="bg-[#0f172a] border border-[#1e293b] p-5 rounded-3xl flex flex-col justify-between shadow-xl hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 font-mono text-xs">
            <span>BATTERY STATE OF HEALTH</span>
            <BatteryCharging size={16} className="text-cyan-400" />
          </div>
          <div className="my-2">
            <span className="font-mono text-3xl font-bold text-slate-100">97.2%</span>
            <span className="text-[11px] font-mono text-cyan-400 ml-2">(6,420 Cycles)</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Li-Ion chemistry degradation model predicts 11.2 years remaining orbital lifespan.
          </span>
        </div>

        <div className="bg-[#0f172a] border border-[#1e293b] p-5 rounded-3xl flex flex-col justify-between shadow-xl hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 font-mono text-xs">
            <span>HYDRAZINE PROPELLANT RESERVE</span>
            <Flame size={16} className="text-amber-400" />
          </div>
          <div className="my-2">
            <span className="font-mono text-3xl font-bold text-amber-400">18.4 kg</span>
            <span className="text-[11px] font-mono text-slate-400 ml-2">/ 24.0 kg initial</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Current burn rate: 1.2 kg/year. Station-keeping margin: +8.4 years.
          </span>
        </div>
      </div>

      {/* Degradation Trends & Subsystem Reliability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hardware Degradation & Capacity Trends */}
        <div className="bg-[#0f172a] border border-[#1e293b] p-5 rounded-3xl flex flex-col gap-4 shadow-xl hover:border-cyan-500/30 transition-all">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-cyan-400" />
              <span className="text-xs uppercase text-slate-200 font-semibold tracking-wide">
                Hardware Health & Capacity Degradation Trends
              </span>
            </div>
            <div className="flex items-center gap-1 bg-[#05070a] p-1 rounded-xl border border-[#1e293b] text-[9px] font-mono">
              {(['30D', '60D', '90D'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => {
                    sound.playClick();
                    setTelemetryTimeframe(tf);
                  }}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                    telemetryTimeframe === tf
                      ? 'bg-cyan-500 text-black font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div className="h-56 bg-[#05070a] rounded-2xl border border-[#1e293b] p-3 flex flex-col justify-between font-mono text-xs shadow-inner">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400 inline-block"></span>
                <span>Solar Array Power Generation (Watts)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block"></span>
                <span>Battery SOH (%)</span>
              </div>
            </div>

            {/* SVG Trend Line */}
            <svg className="w-full h-36" viewBox="0 0 400 120">
              <line x1="20" y1="20" x2="390" y2="20" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="20" y1="60" x2="390" y2="60" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="20" y1="100" x2="390" y2="100" stroke="#1e293b" strokeDasharray="3 3" />

              {/* Solar curve (nominal 2,420W, tiny drop) */}
              <polyline
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2"
                points="20,28 60,30 100,29 140,32 180,31 220,34 260,33 300,36 340,35 390,37"
              />
              {/* Battery SOH (gentle slope from 98.4% to 97.2%) */}
              <polyline
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
                points="20,65 60,66 100,66 140,68 180,69 220,70 260,71 300,72 340,73 390,74"
              />
            </svg>

            <div className="flex justify-between text-[9px] text-slate-400 pt-1 border-t border-[#1e293b]">
              <span>Epoch -90 Days</span>
              <span>Epoch -60 Days</span>
              <span>Epoch -30 Days</span>
              <span>Present Orbit (Day 412)</span>
            </div>
          </div>
        </div>

        {/* Subsystem MTTR Breakdown */}
        <div className="bg-[#0f172a] border border-[#1e293b] p-5 rounded-3xl flex flex-col gap-4 shadow-xl hover:border-cyan-500/30 transition-all">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
            <span className="text-xs uppercase text-slate-200 font-semibold tracking-wide">
              Subsystem Autonomous Resolution Efficiency
            </span>
            <span className="text-[10px] font-mono text-cyan-400">
              4 AGENT SPECIALIZATIONS
            </span>
          </div>

          <div className="flex flex-col gap-3 font-mono text-xs">
            {agents.map((agent) => {
              const mttrMap: Record<string, { mttr: number; rate: number; count: number }> = {
                alpha: { mttr: 3.2, rate: 99.1, count: 46 },
                beta: { mttr: 2.1, rate: 99.8, count: 52 },
                gamma: { mttr: 4.8, rate: 96.4, count: 24 },
                delta: { mttr: 3.6, rate: 98.2, count: 20 },
              };
              const stats = mttrMap[agent.id] || { mttr: 3.4, rate: 98.0, count: 10 };

              return (
                <div
                  key={agent.id}
                  className="bg-[#05070a] p-3 rounded-2xl border border-[#1e293b] flex flex-col gap-1.5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-cyan-400">{agent.name}</span>
                      <span className="text-slate-400 text-[10px]">[{agent.subsystem}]</span>
                    </div>
                    <span className="text-green-400 font-bold">{stats.rate}% Auto</span>
                  </div>

                  <div className="w-full bg-[#1e293b] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-cyan-400 h-full rounded-full"
                      style={{ width: `${stats.rate}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Incidents Handled: {stats.count}</span>
                    <span>Avg MTTR: {stats.mttr}s</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sandbox Trial Journal Trace Summary & Download Card */}
      <div className="bg-[#0f172a] border border-cyan-500/30 p-5 rounded-3xl flex flex-col gap-4 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1e293b] pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shadow-sm">
              <Terminal size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase text-white font-bold tracking-wide">
                  Sandbox Trial Journal Logs & Telemetry Trace Records
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">
                  {sandboxTrials.length} RUNS ARCHIVED
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Real-time multi-agent reasoning trace logs captured during Chaos Anomaly Lab benchmark trials
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <button
              onClick={handleDownloadTrialText}
              className="px-3 py-2 rounded-xl bg-[#05070a] border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-sm font-semibold"
            >
              <FileText size={13} className="text-cyan-400" />
              DOWNLOAD ALL TRACES (.TXT)
            </button>
            <button
              onClick={handleDownloadTrialCsv}
              className="px-3 py-2 rounded-xl bg-[#05070a] border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-sm font-semibold"
            >
              <FileSpreadsheet size={13} className="text-emerald-400" />
              DOWNLOAD ALL TRACES (.CSV)
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setActiveTab('sandbox-trials');
              }}
              className="px-3.5 py-2 rounded-xl bg-cyan-500 text-black font-bold uppercase hover:bg-cyan-400 flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              INSPECT FULL JOURNAL TRACES
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Quick Summary of the latest sandbox trial */}
        {sandboxTrials.length > 0 && (
          <div className="bg-[#05070a] border border-[#1e293b] p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-[10px]">LATEST TEST RUN:</span>
              <span className="text-cyan-400 font-bold">{sandboxTrials[0].trialId}</span>
              <span className="text-slate-300 font-semibold">{sandboxTrials[0].presetTitle}</span>
              <span className="text-slate-500 text-[10px]">
                ({sandboxTrials[0].entries.length} trace events recorded)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                  sandboxTrials[0].outcome === 'REMEDIATED'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {sandboxTrials[0].outcome}
              </span>
              <button
                onClick={() => {
                  sound.playClick();
                  exportTrialsToText([sandboxTrials[0]]);
                }}
                className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
              >
                Download Latest (.txt)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Historical Incidents Archive Table */}
      <div className="bg-[#0f172a] border border-[#1e293b] p-5 rounded-3xl flex flex-col gap-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e293b] pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase text-slate-200 font-semibold tracking-wide">
              Historical Anomaly Archive & Autonomous Resolution Ledger
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs">
            {(['ALL', 'THERMAL', 'AOCS', 'PROPULSION', 'FDIR', 'POWER'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  sound.playClick();
                  setIncidentFilter(filter);
                }}
                className={`px-2.5 py-1 rounded-lg text-[9px] uppercase cursor-pointer transition-all ${
                  incidentFilter === filter
                    ? 'bg-cyan-500 text-black font-bold shadow-xs'
                    : 'bg-[#05070a] text-slate-400 hover:text-white border border-[#1e293b]'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1e293b] text-slate-400 text-[10px] uppercase">
                <th className="pb-2.5">INCIDENT ID</th>
                <th className="pb-2.5">EPOCH TIMESTAMP</th>
                <th className="pb-2.5">SUBSYSTEM</th>
                <th className="pb-2.5">ANOMALY DESCRIPTION</th>
                <th className="pb-2.5">AUTONOMY LEVEL</th>
                <th className="pb-2.5">MTTR</th>
                <th className="pb-2.5 text-right">OUTCOME</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncidents.map((inc) => (
                <tr
                  key={inc.id}
                  className="border-b border-[#1e293b]/40 hover:bg-[#05070a]/60 transition-colors"
                >
                  <td className="py-2.5 text-cyan-400 font-semibold">{inc.id}</td>
                  <td className="py-2.5 text-slate-400 text-[10px]">{inc.timestamp}</td>
                  <td className="py-2.5 text-slate-300">
                    <span className="px-2 py-0.5 rounded-full text-[9px] bg-[#1e293b] text-slate-200">
                      {inc.subsystem}
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-200">{inc.description}</td>
                  <td className="py-2.5 text-slate-400">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] ${
                        inc.autonomyLevel.includes('L4')
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {inc.autonomyLevel}
                    </span>
                  </td>
                  <td className="py-2.5 text-cyan-400 font-bold">{inc.mttrSeconds}s</td>
                  <td className="py-2.5 text-right">
                    <span className="inline-flex items-center gap-1 text-green-400 text-[10px] font-bold">
                      <CheckCircle2 size={12} />
                      {inc.outcome}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
