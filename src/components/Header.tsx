import React, { useState, useEffect } from 'react';
import { ActiveScreen, AutonomyMode, OrbitGuardHealth } from '../types';
import { sound } from '../utils/audio';
import { orbitGuardApi } from '../services/orbitGuardApi';
import {
  Satellite,
  ShieldCheck,
  AlertTriangle,
  Volume2,
  VolumeX,
  Menu,
  X,
  Orbit,
  Cpu,
  Flame,
  Activity,
  PanelLeftClose,
  Wind,
  History,
  Server,
  Sparkles,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Rocket,
} from 'lucide-react';

interface HeaderProps {
  activeScreen: ActiveScreen;
  onSelectScreen: (screen: ActiveScreen) => void;
  autonomyMode: AutonomyMode;
  agentAlertCount: { crit: number; warn: number };
  isolatedAgentCount: number;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onOpenStartupRoutine?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeScreen,
  onSelectScreen,
  autonomyMode,
  agentAlertCount,
  isolatedAgentCount,
  onToggleSidebar,
  sidebarOpen,
  onOpenStartupRoutine,
}) => {
  const [audioEnabled, setAudioEnabled] = useState(sound.enabled);
  const [ogHealth, setOgHealth] = useState<OrbitGuardHealth | null>(null);
  const [ogModalOpen, setOgModalOpen] = useState<boolean>(false);
  const [ogChecking, setOgChecking] = useState<boolean>(false);

  const fetchOgHealth = async () => {
    setOgChecking(true);
    try {
      const health = await orbitGuardApi.checkHealth();
      setOgHealth(health);
    } catch {
      setOgHealth(null);
    } finally {
      setOgChecking(false);
    }
  };

  useEffect(() => {
    fetchOgHealth();
    const interval = setInterval(fetchOgHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const toggleAudio = () => {
    const next = !audioEnabled;
    sound.enabled = next;
    setAudioEnabled(next);
    if (next) sound.playClick();
  };

  const navItems: { id: ActiveScreen; label: string; icon: React.ElementType }[] = [
    { id: 'orbital-twin', label: 'Orbital Twin', icon: Orbit },
    { id: 'agent-mesh', label: 'Agent Mesh', icon: Cpu },
    { id: 'anomaly-lab', label: 'Chaos Lab', icon: Flame },
    { id: 'propellantless', label: 'Propellantless', icon: Wind },
    { id: 'orbital-cases', label: 'Case Simulator', icon: History },
    { id: 'analytics', label: 'Analytics', icon: Activity },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-[#0a1120]/90 border-b border-[#1e293b] backdrop-blur-md z-40 px-4 flex items-center justify-between">
      {/* Left: Branding & Mobile/Desktop Nav Dock Toggle */}
      <div className="flex items-center gap-3">
        <button
          id="header-toggle-sidebar"
          onClick={() => {
            sound.playClick();
            onToggleSidebar();
          }}
          className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2 font-mono text-xs ${
            sidebarOpen
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-xs'
              : 'bg-[#0f172a] border-[#1e293b] text-slate-300 hover:text-white hover:bg-[#1e293b]'
          }`}
          title={sidebarOpen ? "Retract navigation sidebar" : "Open navigation sidebar"}
        >
          {sidebarOpen ? (
            <PanelLeftClose size={18} className="text-amber-400" />
          ) : (
            <Menu size={18} className="text-cyan-400" />
          )}
          <span className="hidden md:inline text-[11px] font-bold tracking-wider">
            {sidebarOpen ? 'RETRACT DOCK' : 'CONSOLES'}
          </span>
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
            <Satellite size={20} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white tracking-wider font-display-hero">
                ORION
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                title="Smart Horizon Hackathon Team 098 (DST-1) | L Steven Dylan, Karan Sai S, Kemisetti Hemachandra, Jeevan M, Jyotiraditya Pradip Khuman"
                data-consortium="Team-098-DST1:LSD-KSS-KH-JM-JPK"
              >
                TWIN-OPS
              </span>
            </div>
            <span
              className="text-[10px] font-mono text-slate-400 hidden sm:inline"
              title="Developed by Team 098 (DST-1): L Steven Dylan, Karan Sai S, Kemisetti Hemachandra, Jeevan M, Jyotiraditya Pradip Khuman"
            >
              AUTONOMOUS DIGITAL TWIN & SWARM MESH
            </span>
          </div>
        </div>
      </div>

      {/* Center: Top Screen Navigation (Desktop) */}
      <nav className="hidden md:flex items-center gap-1.5 bg-[#05070a] p-1 rounded-2xl border border-[#1e293b]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                sound.playClick();
                onSelectScreen(item.id);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-cyan-500 text-black shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-[#0f172a]'
              }`}
            >
              <Icon size={14} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Right: Autonomy Badge, Alert Pill & Audio Switch */}
      <div className="flex items-center gap-3 text-xs font-mono">
        {/* Swarm Status Indicator */}
        <div className="hidden sm:flex items-center gap-2 bg-[#05070a] px-3 py-1.5 rounded-xl border border-[#1e293b]">
          <span className="text-slate-400 text-[10px]">SWARM:</span>
          {isolatedAgentCount > 0 ? (
            <span className="text-amber-400 font-bold flex items-center gap-1">
              <AlertTriangle size={12} />
              {isolatedAgentCount} ISOLATED
            </span>
          ) : (
            <span className="text-green-400 font-bold flex items-center gap-1">
              <ShieldCheck size={12} />
              4/4 QUORUM
            </span>
          )}
        </div>

        {/* OrbitGuard API & Gemini Link Pill */}
        <button
          onClick={() => {
            sound.playClick();
            setOgModalOpen(true);
          }}
          className={`px-2.5 py-1 rounded-xl text-[10px] font-bold tracking-wide border flex items-center gap-1.5 transition-all cursor-pointer ${
            ogHealth?.connected
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25'
              : 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
          }`}
          title="OrbitGuard Cloud API & Gemini 3.8 Flash Hybrid Bridge"
        >
          <Server size={12} className={ogHealth?.connected ? 'text-emerald-400' : 'text-amber-400'} />
          <span className="hidden xl:inline">ORBITGUARD API:</span>
          <span>{ogHealth?.connected ? `${ogHealth.latencyMs || 0}ms` : 'STANDALONE'}</span>
          <span className={`w-1.5 h-1.5 rounded-full ${ogHealth?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
        </button>

        {/* Autonomy Mode Badge */}
        <span
          className={`px-2.5 py-1 rounded-xl text-[10px] font-bold tracking-wide uppercase border flex items-center gap-1.5 ${
            autonomyMode === 'OVERRIDE'
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
              : autonomyMode === 'HITL'
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
          {autonomyMode === 'OVERRIDE' ? 'MANUAL' : autonomyMode}
        </span>

        {/* Startup Diagnostics Launcher Button */}
        {onOpenStartupRoutine && (
          <button
            onClick={() => {
              sound.playClick();
              onOpenStartupRoutine();
            }}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#05070a] hover:bg-emerald-500/10 border border-[#1e293b] hover:border-emerald-500/40 text-slate-300 hover:text-emerald-300 text-[10px] font-bold tracking-wide transition-all cursor-pointer shadow-xs"
            title="Open ORION Autonomous Startup & Diagnostics Sequence"
          >
            <Rocket size={12} className="text-emerald-400" />
            <span>STARTUP LOGS</span>
          </button>
        )}

        {/* Audio FX Toggle */}
        <button
          onClick={toggleAudio}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            audioEnabled
              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20'
              : 'bg-[#05070a] text-slate-500 border-[#1e293b] hover:text-slate-300'
          }`}
          title={audioEnabled ? 'Mute Audio Effects' : 'Enable Mission Control Sound Effects'}
        >
          {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </div>

      {/* OrbitGuard API & Gemini Bridge Inspect Modal */}
      {ogModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 font-mono">
          <div className="bg-[#0b1329] border border-cyan-500/40 rounded-2xl w-full max-w-xl shadow-2xl p-6 text-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#1e293b]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
                  <Server size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base font-display-hero">OrbitGuard Hybrid AI Bridge</h3>
                  <p className="text-[11px] text-slate-400">OrbitGuard REST Endpoints + Gemini 3.8 Flash Agent Mesh</p>
                </div>
              </div>
              <button
                onClick={() => setOgModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e293b] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              {/* Endpoint Card */}
              <div className="p-3 rounded-xl bg-[#05070a] border border-[#1e293b] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">TARGET API ENDPOINT:</span>
                  <a
                    href="https://orbitguard-kt7a.onrender.com/docs"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    Open API Docs <ExternalLink size={12} />
                  </a>
                </div>
                <div className="bg-[#0a1120] p-2 rounded-lg font-mono text-[11px] text-slate-300 border border-[#1e293b] break-all">
                  https://orbitguard-kt7a.onrender.com
                </div>
              </div>

              {/* Status Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#05070a] border border-[#1e293b]">
                  <span className="text-[10px] text-slate-400 uppercase">OrbitGuard Status</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        ogHealth?.connected ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                    />
                    <span className="font-bold text-white uppercase text-xs">
                      {ogHealth?.connected ? 'OPERATIONAL' : 'STANDALONE MODE'}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    Latency: <span className="text-cyan-400 font-bold">{ogHealth?.latencyMs || 0}ms</span> | Ver: {ogHealth?.version || '0.1.0'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#05070a] border border-[#1e293b]">
                  <span className="text-[10px] text-slate-400 uppercase">Cognitive Copilot</span>
                  <div className="mt-1 flex items-center gap-1.5 text-cyan-400 font-bold text-xs">
                    <Sparkles size={14} className="text-amber-300" />
                    <span>Gemini 3.8 Flash</span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    Role: <span className="text-emerald-400">Agent Delta Supervisor</span>
                  </div>
                </div>
              </div>

              {/* Integrated Services Pipeline */}
              <div className="p-3 rounded-xl bg-[#05070a] border border-[#1e293b] space-y-1.5">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Connected REST Endpoints:</span>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <span>POST /api/simulate/inject</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <span>POST /api/plans/validate</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <span>GET /api/telemetry/SAT-01</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <span>POST /api/plans/approve (HITL)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#1e293b] flex items-center justify-between">
              <button
                onClick={fetchOgHealth}
                disabled={ogChecking}
                className="px-3 py-1.5 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] border border-[#1e293b] text-slate-300 text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={12} className={ogChecking ? 'animate-spin text-cyan-400' : ''} />
                Ping Health
              </button>
              <button
                onClick={() => setOgModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
