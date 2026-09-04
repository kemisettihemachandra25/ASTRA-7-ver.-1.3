import React, { useState, useEffect } from 'react';
import { ActiveScreen } from '../types';
import { sound } from '../utils/audio';
import { getISTTimeString } from '../utils/time';
import {
  Orbit,
  Cpu,
  Flame,
  Activity,
  SlidersHorizontal,
  Clock,
  ChevronRight,
  ChevronLeft,
  PanelLeftClose,
  Wind,
  History,
  Rocket,
} from 'lucide-react';

interface SidebarProps {
  activeScreen: ActiveScreen;
  onSelectScreen: (screen: ActiveScreen) => void;
  onOpenOverrideDeck: () => void;
  isOpen: boolean;
  onClose: () => void;
  onOpenStartupRoutine?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeScreen,
  onSelectScreen,
  onOpenOverrideDeck,
  isOpen,
  onClose,
  onOpenStartupRoutine,
}) => {
  const menuItems: {
    id: ActiveScreen;
    title: string;
    subtitle: string;
    icon: React.ElementType;
    badge?: string;
  }[] = [
    {
      id: 'orbital-twin',
      title: '3D Orbital Twin',
      subtitle: 'Earth Globe & Bus Wireframe',
      icon: Orbit,
      badge: 'LIVE',
    },
    {
      id: 'agent-mesh',
      title: 'Agent Swarm Mesh',
      subtitle: '4-Node Consensus & CoT',
      icon: Cpu,
    },
    {
      id: 'anomaly-lab',
      title: 'Chaos Anomaly Lab',
      subtitle: 'Dynamic Trajectory Injection',
      icon: Flame,
      badge: 'TEST',
    },
    {
      id: 'propellantless',
      title: 'Propellantless Flight',
      subtitle: 'Solar Sail, EDT & Aerotrim',
      icon: Wind,
      badge: 'FUEL-0',
    },
    {
      id: 'orbital-cases',
      title: 'Orbital Case Simulator',
      subtitle: 'Simulate Ingested Flight Cases',
      icon: History,
      badge: 'SIM',
    },
    {
      id: 'analytics',
      title: 'Flight Analytics',
      subtitle: 'Oscilloscope Traces & HDF5',
      icon: Activity,
    },
  ];

  const [istTime, setIstTime] = useState<string>(() => getISTTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setIstTime(getISTTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {/* Backdrop for closing when open */}
      {isOpen && (
        <div
          id="sidebar-backdrop"
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 transition-opacity"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        id="mission-sidebar"
        className={`fixed top-16 bottom-0 left-0 w-72 bg-[#0a1120] border-r border-[#1e293b] p-4 flex flex-col justify-between z-40 transition-transform duration-300 ease-in-out shadow-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Retract Tab on Sidebar Edge */}
        <button
          id="sidebar-edge-retract-btn"
          onClick={() => {
            sound.playClick();
            onClose();
          }}
          className="absolute -right-8 top-5 w-8 h-10 bg-[#0a1120] border-y border-r border-[#1e293b] hover:border-amber-400/50 rounded-r-xl flex items-center justify-center text-slate-400 hover:text-amber-300 shadow-xl cursor-pointer transition-colors z-50 group"
          title="Retract sidebar"
        >
          <ChevronLeft size={16} className="text-amber-400 group-hover:-translate-x-0.5 transition-transform" />
        </button>

        <div className="flex flex-col gap-4">
          {/* Header Bar with Dedicated Retract Button */}
          <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <span className="text-[11px] font-mono font-bold tracking-wider text-slate-200 uppercase">
                CONSOLES DOCK
              </span>
            </div>
            <button
              id="sidebar-retract-btn"
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#0f172a] hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-[#1e293b] hover:border-amber-500/40 font-mono text-[10.5px] font-bold tracking-wider transition-all cursor-pointer group shadow-sm"
              title="Retract Navigation Sidebar"
            >
              <PanelLeftClose size={14} className="text-amber-400 group-hover:-translate-x-0.5 transition-transform" />
              <span>RETRACT</span>
            </button>
          </div>

          {/* Mission IST Clock */}
          <div className="bg-[#05070a] p-3 rounded-2xl border border-[#1e293b] flex items-center justify-between font-mono text-xs shadow-inner">
            <div className="flex items-center gap-2 text-slate-400">
              <Clock size={14} className="text-cyan-400" />
              <span className="text-[10px] uppercase font-bold text-slate-300">MISSION CLOCK (IST)</span>
            </div>
            <span className="text-cyan-400 font-bold tracking-wider">{istTime}</span>
          </div>

          {/* Navigation Items */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9.5px] font-mono font-bold text-slate-400 uppercase tracking-wider px-2">
              MISSION CONSOLES
            </span>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeScreen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    sound.playClick();
                    onSelectScreen(item.id);
                    onClose();
                  }}
                  className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-white shadow-sm'
                      : 'bg-[#05070a]/60 border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#05070a]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-xl border ${
                        isActive
                          ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                          : 'bg-[#0f172a] text-slate-400 border-[#1e293b]'
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-100">{item.title}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{item.subtitle}</span>
                    </div>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-full border ${
                        item.badge === 'LIVE'
                          ? 'bg-green-500/10 text-green-400 border-green-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Emergency Actuator Override Link */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2 shadow-sm">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <SlidersHorizontal size={14} />
              <span>HARDWARE ACTUATION</span>
            </div>
            <p className="text-[10px] text-slate-300 font-mono leading-tight">
              Direct Flight Director RCS thruster quad fire and PWM heater interlock.
            </p>
            <button
              onClick={() => {
                onOpenOverrideDeck();
                onClose();
              }}
              className="mt-1 w-full py-2 px-3 rounded-xl bg-amber-400 text-black hover:bg-amber-300 font-mono text-[10px] font-bold uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <span>OPEN OVERRIDE DECK</span>
              <ChevronRight size={12} />
            </button>
          </div>

          {/* ORION Startup Routine Diagnostic Sequence */}
          {onOpenStartupRoutine && (
            <button
              onClick={() => {
                sound.playClick();
                onOpenStartupRoutine();
                onClose();
              }}
              className="w-full p-2.5 rounded-2xl bg-[#0f172a] hover:bg-emerald-500/10 border border-[#1e293b] hover:border-emerald-500/40 text-slate-300 hover:text-emerald-300 font-mono text-[10px] font-bold uppercase flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <Rocket size={13} className="text-emerald-400" />
              <span>ORION STARTUP SEQUENCE</span>
            </button>
          )}
        </div>

        {/* Ephemeris Footer Summary */}
        <div className="pt-3 border-t border-[#1e293b] font-mono text-[10px] text-slate-400 flex flex-col gap-1.5">
          <div className="flex justify-between">
            <span>SATELLITE:</span>
            <span className="text-slate-200 font-bold">ORION</span>
          </div>
          <div className="flex justify-between">
            <span>NORAD ID:</span>
            <span className="text-cyan-400">59421</span>
          </div>
          <div className="flex justify-between">
            <span>INCLINATION:</span>
            <span className="text-slate-200">97.6° SSO</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-[#1e293b]/60">
            <span className="flex items-center gap-1.5 text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
              RF LINK LOCKED
            </span>
            <span className="text-slate-400">19.2 dB SNR</span>
          </div>
        </div>
      </aside>
    </>
  );
};
