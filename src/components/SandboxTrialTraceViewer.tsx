import React, { useState } from 'react';
import {
  RecordedSandboxTrial,
  exportTrialsToCsv,
  exportTrialsToText,
  sandboxTrialRecorder,
} from '../utils/sandboxTrialRecorder';
import { sound } from '../utils/audio';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
} from 'lucide-react';

interface SandboxTrialTraceViewerProps {
  trials: RecordedSandboxTrial[];
  onRefresh: () => void;
}

export const SandboxTrialTraceViewer: React.FC<SandboxTrialTraceViewerProps> = ({
  trials,
  onRefresh,
}) => {
  const [selectedTrialId, setSelectedTrialId] = useState<string>('ALL');
  const [subsystemFilter, setSubsystemFilter] = useState<string>('ALL');
  const [expandedTrialIds, setExpandedTrialIds] = useState<Record<string, boolean>>(() => {
    // Expand the first 2 by default
    const init: Record<string, boolean> = {};
    trials.slice(0, 2).forEach((t) => {
      init[t.trialId] = true;
    });
    return init;
  });

  const toggleExpand = (trialId: string) => {
    sound.playClick();
    setExpandedTrialIds((prev) => ({
      ...prev,
      [trialId]: !prev[trialId],
    }));
  };

  const handleExpandAll = () => {
    sound.playClick();
    const all: Record<string, boolean> = {};
    trials.forEach((t) => {
      all[t.trialId] = true;
    });
    setExpandedTrialIds(all);
  };

  const handleCollapseAll = () => {
    sound.playClick();
    setExpandedTrialIds({});
  };

  const filteredTrials = trials.filter((t) => {
    if (selectedTrialId !== 'ALL' && t.trialId !== selectedTrialId) return false;
    if (subsystemFilter !== 'ALL' && !t.subsystem.toUpperCase().includes(subsystemFilter))
      return false;
    return true;
  });

  const totalLogsCount = trials.reduce((acc, t) => acc + t.entries.length, 0);
  const remediatedCount = trials.filter((t) => t.outcome === 'REMEDIATED').length;
  const failureCount = trials.filter((t) => t.outcome === 'CATASTROPHIC_FAILURE').length;

  const handleDownloadCsv = (targetTrials?: RecordedSandboxTrial[]) => {
    sound.playClick();
    const target = targetTrials || filteredTrials;
    exportTrialsToCsv(target);
  };

  const handleDownloadText = (targetTrials?: RecordedSandboxTrial[]) => {
    sound.playClick();
    const target = targetTrials || filteredTrials;
    exportTrialsToText(target);
  };

  const handleClearAll = () => {
    sound.playClick();
    if (window.confirm('Clear all recorded sandbox trial traces from local storage?')) {
      sandboxTrialRecorder.clearAll();
      onRefresh();
    }
  };

  const handleResetSeed = () => {
    sound.playClick();
    sandboxTrialRecorder.resetToDefault();
    onRefresh();
  };

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Header Banner */}
      <div className="bg-[#0f172a] border border-[#1e293b] p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shadow-sm">
            <Terminal size={22} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm text-white font-semibold uppercase tracking-wide">
                SANDBOX TRIAL JOURNAL TRACES & REASONING LOGS
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/30">
                ORION-7 TELEMETRY PIPELINE
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-400">
              REAL-TIME CAPTURE OF SIMULATION HARNESS TRACES, BYZANTINE CONSENSUS AUDITS & OPERATOR OVERRIDES
            </span>
          </div>
        </div>

        {/* Global Export Actions */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <button
            onClick={() => handleDownloadText()}
            className="px-3 py-2 rounded-xl bg-[#05070a] border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-sm font-semibold"
            title="Download formatted text file of all recorded sandbox trials"
          >
            <FileText size={14} className="text-cyan-400" />
            DOWNLOAD TRACE (TXT)
          </button>

          <button
            onClick={() => handleDownloadCsv()}
            className="px-3 py-2 rounded-xl bg-[#05070a] border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-sm font-semibold"
            title="Download CSV table of all recorded sandbox trial logs"
          >
            <FileSpreadsheet size={14} className="text-emerald-400" />
            DOWNLOAD TRACE (CSV)
          </button>

          <button
            onClick={handleResetSeed}
            className="px-3 py-2 rounded-xl bg-[#05070a] border border-[#1e293b] hover:border-slate-400 text-slate-400 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Reload baseline benchmark simulation trials"
          >
            <RotateCcw size={13} />
            RESET BENCHMARKS
          </button>

          <button
            onClick={handleClearAll}
            className="p-2 rounded-xl bg-[#05070a] border border-rose-900/40 hover:border-rose-500 text-rose-400 hover:text-rose-200 transition-all cursor-pointer shadow-sm"
            title="Clear all recorded trials"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-2xl flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400 font-mono text-xs">
            <span>RECORDED TRIALS</span>
            <Activity size={15} className="text-cyan-400" />
          </div>
          <div className="my-1.5 font-mono text-2xl font-bold text-white">
            {trials.length}
            <span className="text-xs text-slate-400 font-normal ml-2">Sandbox Runs</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Persistent in ORION-7 local session
          </span>
        </div>

        <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-2xl flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400 font-mono text-xs">
            <span>TOTAL JOURNAL LOG ENTRIES</span>
            <Terminal size={15} className="text-indigo-400" />
          </div>
          <div className="my-1.5 font-mono text-2xl font-bold text-indigo-400">
            {totalLogsCount}
            <span className="text-xs text-slate-400 font-normal ml-2">Trace Events</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Average {(totalLogsCount / Math.max(1, trials.length)).toFixed(1)} events/trial
          </span>
        </div>

        <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-2xl flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400 font-mono text-xs">
            <span>AUTONOMOUS MITIGATED</span>
            <CheckCircle2 size={15} className="text-emerald-400" />
          </div>
          <div className="my-1.5 font-mono text-2xl font-bold text-emerald-400">
            {remediatedCount}
            <span className="text-xs text-slate-400 font-normal ml-2">
              ({trials.length > 0 ? Math.round((remediatedCount / trials.length) * 100) : 0}%)
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Full Swarm Quorum & Remediation
          </span>
        </div>

        <div className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-2xl flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400 font-mono text-xs">
            <span>CATASTROPHIC / FAILED</span>
            <AlertTriangle size={15} className="text-rose-400" />
          </div>
          <div className="my-1.5 font-mono text-2xl font-bold text-rose-400">
            {failureCount}
            <span className="text-xs text-slate-400 font-normal ml-2">Breaches</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Safety Corridor / Agent Offline Triggers
          </span>
        </div>
      </div>

      {/* Filter & View Bar */}
      <div className="bg-[#0f172a] border border-[#1e293b] p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] uppercase">Trial Filter:</span>
            <select
              value={selectedTrialId}
              onChange={(e) => setSelectedTrialId(e.target.value)}
              className="bg-[#05070a] border border-[#1e293b] text-slate-200 text-xs px-2.5 py-1.5 rounded-xl outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value="ALL">All Recorded Trials ({trials.length})</option>
              {trials.map((t) => (
                <option key={t.trialId} value={t.trialId}>
                  {t.trialId} - {t.presetTitle} ({t.outcome})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[11px] uppercase mr-1">Subsystem:</span>
            {(['ALL', 'THERMAL', 'AOCS', 'PROPULSION', 'POWER', 'FDIR'] as const).map((sub) => (
              <button
                key={sub}
                onClick={() => {
                  sound.playClick();
                  setSubsystemFilter(sub);
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] uppercase cursor-pointer transition-all ${
                  subsystemFilter === sub
                    ? 'bg-cyan-500 text-black font-bold'
                    : 'bg-[#05070a] text-slate-400 hover:text-white border border-[#1e293b]'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={handleExpandAll}
            className="px-2.5 py-1 text-[10px] text-slate-400 hover:text-white border border-[#1e293b] hover:border-slate-500 rounded-lg cursor-pointer transition-colors"
          >
            EXPAND ALL
          </button>
          <button
            onClick={handleCollapseAll}
            className="px-2.5 py-1 text-[10px] text-slate-400 hover:text-white border border-[#1e293b] hover:border-slate-500 rounded-lg cursor-pointer transition-colors"
          >
            COLLAPSE ALL
          </button>
        </div>
      </div>

      {/* Trial Cards Stream */}
      {filteredTrials.length === 0 ? (
        <div className="bg-[#0f172a] border border-[#1e293b] p-8 rounded-2xl text-center flex flex-col items-center justify-center gap-3 text-slate-400 font-mono text-xs">
          <Terminal size={32} className="text-slate-600" />
          <p>No sandbox trial traces found matching the selected filters.</p>
          <button
            onClick={handleResetSeed}
            className="px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-xl hover:bg-cyan-500/20 cursor-pointer transition-all"
          >
            Load Benchmark Seed Trials
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredTrials.map((trial) => {
            const isExpanded = !!expandedTrialIds[trial.trialId];
            return (
              <div
                key={trial.trialId}
                className="bg-[#0f172a] border border-[#1e293b] rounded-2xl overflow-hidden shadow-lg transition-all hover:border-slate-700"
              >
                {/* Trial Header Bar */}
                <div
                  onClick={() => toggleExpand(trial.trialId)}
                  className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none bg-[#0a101f] hover:bg-[#0f172a] transition-colors border-b border-[#1e293b]/60"
                >
                  <div className="flex items-center gap-3">
                    <button
                      className="p-1 text-slate-400 hover:text-cyan-400 transition-colors"
                      aria-label={isExpanded ? 'Collapse trial' : 'Expand trial'}
                    >
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    <div className="flex flex-col">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-cyan-400 font-bold text-xs">
                          {trial.trialId}
                        </span>
                        <span className="text-white font-semibold text-xs">
                          {trial.presetTitle}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-[#1e293b] text-slate-300 uppercase">
                          {trial.subsystem}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-cyan-950/60 border border-cyan-500/30 text-cyan-300">
                          SEV {trial.severityLevel}/4 ({Math.round((trial.severityLevel / 4) * 100)}%)
                        </span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-300 uppercase">
                          {trial.autonomySetting === 'hitl' ? 'HITL (GROUND IN THE LOOP)' : 'AUTONOMOUS (L4)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-slate-400">
                        <span>Started: {new Date(trial.startTime).toLocaleTimeString()}</span>
                        <span>Telemetry: {trial.telemetryChannel}</span>
                        <span>Trace Count: {trial.entries.length} events</span>
                      </div>
                    </div>
                  </div>

                  {/* Outcome Badge & Quick Export */}
                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 ${
                        trial.outcome === 'REMEDIATED'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : trial.outcome === 'CATASTROPHIC_FAILURE'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : trial.outcome === 'IN_PROGRESS'
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse'
                          : 'bg-slate-700/50 text-slate-300 border border-slate-600'
                      }`}
                    >
                      {trial.outcome === 'REMEDIATED' ? (
                        <CheckCircle2 size={12} />
                      ) : trial.outcome === 'CATASTROPHIC_FAILURE' ? (
                        <AlertTriangle size={12} />
                      ) : (
                        <Activity size={12} />
                      )}
                      {trial.outcome}
                    </span>

                    {/* Quick export single trial */}
                    <button
                      onClick={() => handleDownloadText([trial])}
                      className="px-2.5 py-1 rounded-lg bg-[#05070a] border border-[#1e293b] hover:border-cyan-400 text-cyan-300 text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-all"
                      title="Download this trial as .txt"
                    >
                      <FileText size={11} />
                      .TXT
                    </button>

                    <button
                      onClick={() => handleDownloadCsv([trial])}
                      className="px-2.5 py-1 rounded-lg bg-[#05070a] border border-[#1e293b] hover:border-emerald-400 text-emerald-300 text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-all"
                      title="Download this trial as .csv"
                    >
                      <FileSpreadsheet size={11} />
                      .CSV
                    </button>
                  </div>
                </div>

                {/* Expanded Log Table */}
                {isExpanded && (
                  <div className="p-4 bg-[#05070a] flex flex-col gap-2">
                    {trial.failureReason && (
                      <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 font-mono text-xs flex items-center gap-2">
                        <AlertTriangle size={14} className="shrink-0 text-rose-400" />
                        <span>FAILURE ROOT CAUSE: {trial.failureReason}</span>
                      </div>
                    )}

                    <div className="overflow-x-auto rounded-xl border border-[#1e293b]">
                      <table className="w-full text-left font-mono text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#0f172a] text-slate-400 text-[10px] uppercase border-b border-[#1e293b]">
                            <th className="py-2 px-3">SIM TIME</th>
                            <th className="py-2 px-3">TIMESTAMP</th>
                            <th className="py-2 px-3">AGENT / SOURCE</th>
                            <th className="py-2 px-3">EVENT TAG</th>
                            <th className="py-2 px-3">JOURNAL TRACE MESSAGE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1e293b]/40">
                          {trial.entries.map((log) => (
                            <tr
                              key={log.id}
                              className="hover:bg-[#0f172a]/60 transition-colors"
                            >
                              <td className="py-2 px-3 text-slate-400 font-bold whitespace-nowrap text-[11px]">
                                {log.simTime}
                              </td>
                              <td className="py-2 px-3 text-slate-500 text-[10px] whitespace-nowrap">
                                {new Date(log.realTimestamp).toLocaleTimeString()}
                              </td>
                              <td className="py-2 px-3 text-cyan-300 font-semibold whitespace-nowrap text-[11px]">
                                {log.agent}
                              </td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                    log.tagColor || 'bg-slate-700 text-slate-300'
                                  }`}
                                >
                                  {log.tag}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-200 text-[11px] leading-relaxed break-words">
                                {log.message}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
