import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ManualPulseEvent } from '../types';
import { sound } from '../utils/audio';
import {
  Activity,
  Flame,
  RotateCw,
  TrendingUp,
  Compass,
  RotateCcw,
  Zap,
  Play,
  Pause,
  Trash2,
  Crosshair,
  ShieldCheck,
  Radio,
  Sliders,
} from 'lucide-react';

interface PulseTrajectoryGraphProps {
  pulses: ManualPulseEvent[];
  onFirePulse: (thruster: string, durationMs: number) => void;
  onClearPulses: () => void;
  onAutonomousCounterBurn?: () => void;
  autonomyMode?: string;
  isInterlockArmed?: boolean;
}

type GraphMode = 'ALTITUDE' | 'VELOCITY' | 'ATTITUDE' | 'ORBITAL_PLANE';

export const PulseTrajectoryGraph: React.FC<PulseTrajectoryGraphProps> = ({
  pulses,
  onFirePulse,
  onClearPulses,
  onAutonomousCounterBurn,
  autonomyMode = 'L4',
  isInterlockArmed = true,
}) => {
  const [graphMode, setGraphMode] = useState<GraphMode>('ALTITUDE');
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [streamTime, setStreamTime] = useState<number>(10); // current live time offset
  const [quickDuration, setQuickDuration] = useState<number>(100);
  const [hoverCrosshair, setHoverCrosshair] = useState<{ x: number; y: number; time: number; val: number } | null>(null);
  const [activePulsePinId, setActivePulsePinId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Time advancement for live streaming
  useEffect(() => {
    if (!isLiveStreaming) return;
    const interval = setInterval(() => {
      setStreamTime((prev) => +(prev + 0.1).toFixed(1));
    }, 100);
    return () => clearInterval(interval);
  }, [isLiveStreaming]);

  // If new pulse fired, auto-select it and ensure live stream is running
  useEffect(() => {
    if (pulses.length > 0) {
      const last = pulses[pulses.length - 1];
      setActivePulsePinId(last.id);
      // Advance streamTime to show recent pulse if behind
      if (last.timestamp > streamTime - 2) {
        setStreamTime(last.timestamp + 3);
      }
    }
  }, [pulses.length]);

  // Window range: shows a rolling 25-second window around streamTime
  const windowDuration = 24; // seconds visible on screen
  const startTime = Math.max(0, streamTime - 18);
  const endTime = startTime + windowDuration;

  // Compute trajectory curves based on accumulated pulses
  // Base constants:
  const NOMINAL_ALT_KM = 541.8;
  const NOMINAL_VEL_MS = 7589.2;

  // Calculate cumulative state at any timestamp t
  const getTrajectoryStateAtTime = (t: number) => {
    let deltaAltMeters = 0;
    let deltaVMs = 0;
    let angularRate = 0;
    let crossTrackM = 0;

    pulses.forEach((p) => {
      if (t >= p.timestamp) {
        const dt = t - p.timestamp;
        if (p.thruster === '+X') {
          // Prograde: raises apogee altitude, adds positive velocity
          deltaVMs += p.deltaV;
          const altRise = p.deltaAltMeters * (1 - Math.exp(-dt / 4.0));
          deltaAltMeters += altRise;
        } else if (p.thruster === '-X') {
          // Retrograde: lowers perigee altitude, negative velocity
          deltaVMs += p.deltaV;
          const altDrop = p.deltaAltMeters * (1 - Math.exp(-dt / 4.0));
          deltaAltMeters += altDrop;
        } else if (p.thruster === '+Y' || p.thruster === '-Y') {
          // Cross-track: lateral oscillation
          const sign = p.thruster === '+Y' ? 1 : -1;
          crossTrackM += sign * Math.sin(dt * 0.8) * (p.durationMs * 0.6) * Math.exp(-dt / 12);
        } else if (p.thruster.includes('Roll')) {
          // Roll torque: initial rate spike, damped by AOCS wheels
          const sign = p.thruster.includes('↺') ? 1 : -1;
          const dampFactor = Math.exp(-dt / 2.5); // Reaction wheels damp within ~5s
          angularRate += sign * p.angularRateDeg * dampFactor;
        }
      }
    });

    // Add slight realistic sensor micro-jitter
    const microJitter = Math.sin(t * 7.1) * 0.4 + Math.cos(t * 13.3) * 0.2;

    return {
      altitudeM: deltaAltMeters + microJitter,
      altitudeKm: NOMINAL_ALT_KM + (deltaAltMeters + microJitter) / 1000,
      velocityMs: NOMINAL_VEL_MS + deltaVMs + (microJitter * 0.005),
      deltaVMs: deltaVMs + (microJitter * 0.005),
      angularRate: angularRate + (microJitter * 0.02),
      crossTrackM: crossTrackM + microJitter,
    };
  };

  // SVG Geometry Dimensions
  const svgWidth = 800;
  const svgHeight = 260;
  const margin = { top: 35, right: 40, bottom: 35, left: 65 };
  const graphWidth = svgWidth - margin.left - margin.right;
  const graphHeight = svgHeight - margin.top - margin.bottom;

  // Coordinate transforms
  const timeToX = (t: number) => {
    return margin.left + ((t - startTime) / windowDuration) * graphWidth;
  };

  const xToTime = (x: number) => {
    return startTime + ((x - margin.left) / graphWidth) * windowDuration;
  };

  // Y-axis value bounds based on mode
  const yBounds = useMemo(() => {
    if (graphMode === 'ALTITUDE') {
      // Find max excursion
      let maxAbsAlt = 500; // minimum scale ±500 meters
      pulses.forEach((p) => {
        maxAbsAlt = Math.max(maxAbsAlt, Math.abs(p.deltaAltMeters) * 1.3);
      });
      return { min: -maxAbsAlt, max: maxAbsAlt, unit: 'm', label: 'Altitude Delta (Δh)' };
    } else if (graphMode === 'VELOCITY') {
      let maxAbsV = 0.15; // m/s
      pulses.forEach((p) => {
        maxAbsV = Math.max(maxAbsV, Math.abs(p.deltaV) * 1.5);
      });
      return { min: -maxAbsV, max: maxAbsV, unit: 'm/s', label: 'Orbital Velocity Delta (ΔV)' };
    } else if (graphMode === 'ATTITUDE') {
      let maxRate = 2.5; // deg/s
      pulses.forEach((p) => {
        maxRate = Math.max(maxRate, Math.abs(p.angularRateDeg) * 1.4);
      });
      return { min: -maxRate, max: maxRate, unit: '°/s', label: 'Roll Rate Drift (ω)' };
    } else {
      // ORBITAL_PLANE (Cross-Track vs Radial)
      return { min: -250, max: 250, unit: 'm', label: 'In-Plane / Cross-Track Offset' };
    }
  }, [graphMode, pulses]);

  const valueToY = (val: number) => {
    const range = yBounds.max - yBounds.min;
    const norm = (val - yBounds.min) / range;
    return margin.top + graphHeight * (1 - norm);
  };

  const yToValue = (y: number) => {
    const norm = 1 - (y - margin.top) / graphHeight;
    return yBounds.min + norm * (yBounds.max - yBounds.min);
  };

  // Sample points for rendering SVG path
  const sampleSteps = 120;
  const pathPoints: [number, number][] = [];
  const areaPoints: [number, number][] = [];

  for (let i = 0; i <= sampleSteps; i++) {
    const t = startTime + (i / sampleSteps) * windowDuration;
    const state = getTrajectoryStateAtTime(t);
    let val = 0;
    if (graphMode === 'ALTITUDE') val = state.altitudeM;
    else if (graphMode === 'VELOCITY') val = state.deltaVMs;
    else if (graphMode === 'ATTITUDE') val = state.angularRate;
    else val = state.crossTrackM;

    const x = timeToX(t);
    const y = valueToY(val);
    pathPoints.push([x, y]);
  }

  const zeroY = valueToY(0);
  const pathD = pathPoints.length > 0 ? `M ${pathPoints.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L ')}` : '';
  const areaD = pathPoints.length > 0
    ? `M ${pathPoints[0][0].toFixed(1)},${zeroY.toFixed(1)} L ${pathPoints
        .map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`)
        .join(' L ')} L ${pathPoints[pathPoints.length - 1][0].toFixed(1)},${zeroY.toFixed(1)} Z`
    : '';

  // Current live probe coordinate
  const currentLiveX = timeToX(streamTime);
  const currentLiveState = getTrajectoryStateAtTime(streamTime);
  let currentVal = 0;
  if (graphMode === 'ALTITUDE') currentVal = currentLiveState.altitudeM;
  else if (graphMode === 'VELOCITY') currentVal = currentLiveState.deltaVMs;
  else if (graphMode === 'ATTITUDE') currentVal = currentLiveState.angularRate;
  else currentVal = currentLiveState.crossTrackM;
  const currentLiveY = valueToY(currentVal);

  // Cumulative Metrics
  const totalFuelGrams = pulses.reduce((acc, p) => acc + p.fuelGrams, 0);
  const totalDeltaVMs = pulses.reduce((acc, p) => acc + Math.abs(p.deltaV), 0);
  const netAltitudeShiftM = currentLiveState.altitudeM;

  // Handle graph mouse move
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * svgWidth;
    const y = ((e.clientY - rect.top) / rect.height) * svgHeight;

    if (x >= margin.left && x <= svgWidth - margin.right && y >= margin.top && y <= svgHeight - margin.bottom) {
      const t = xToTime(x);
      const state = getTrajectoryStateAtTime(t);
      let v = 0;
      if (graphMode === 'ALTITUDE') v = state.altitudeM;
      else if (graphMode === 'VELOCITY') v = state.deltaVMs;
      else if (graphMode === 'ATTITUDE') v = state.angularRate;
      else v = state.crossTrackM;

      setHoverCrosshair({ x, y: valueToY(v), time: t, val: v });
    } else {
      setHoverCrosshair(null);
    }
  };

  // Quick fire helper
  const handleQuickFire = (thruster: string) => {
    sound.playThruster();
    onFirePulse(thruster, quickDuration);
  };

  return (
    <div
      ref={containerRef}
      className="bg-[#13161c] border border-[#272d38] rounded-3xl p-5 flex flex-col gap-4 shadow-xl hover:border-amber-500/30 transition-all"
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#272d38] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <TrendingUp size={18} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-amber-400">
                POST-ACTUATION TRAJECTORY DYNAMICS //
              </span>
              <span className="text-xs uppercase text-slate-100 font-semibold">
                Live Kinetic Telemetry After Thruster Pulses
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                STREAMING 50Hz
              </span>
            </div>
            <span className="font-mono text-[10.5px] text-slate-400">
              REAL-TIME ORBITAL PERTURBATION · ACCELEROMETER INTEGRATION · ΔV REACTION DYNAMICS
            </span>
          </div>
        </div>

        {/* View Mode Selector Tabs */}
        <div className="flex items-center gap-1.5 bg-[#0c0e12] p-1 rounded-xl border border-[#272d38] font-mono text-xs">
          {(
            [
              { id: 'ALTITUDE' as GraphMode, label: 'ALTITUDE (Δh)', icon: TrendingUp },
              { id: 'VELOCITY' as GraphMode, label: 'VELOCITY (ΔV)', icon: Activity },
              { id: 'ATTITUDE' as GraphMode, label: 'ROLL RATE (ω)', icon: RotateCw },
              { id: 'ORBITAL_PLANE' as GraphMode, label: 'CROSS-TRACK (Δy)', icon: Compass },
            ] as const
          ).map((mode) => {
            const Icon = mode.icon;
            const isSelected = graphMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => {
                  sound.playClick();
                  setGraphMode(mode.id);
                }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon size={12} />
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 font-mono text-xs">
        {/* Instantaneous Altitude */}
        <div className="bg-[#05070a] p-3 rounded-2xl border border-[#1e293b] flex flex-col justify-between shadow-xs">
          <span className="text-[9.5px] text-slate-400">ORBITAL ALTITUDE</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-sm font-bold text-slate-100">
              {currentLiveState.altitudeKm.toFixed(3)}
            </span>
            <span className="text-[10px] text-slate-400">km</span>
          </div>
          <span
            className={`text-[9.5px] font-semibold mt-0.5 ${
              netAltitudeShiftM >= 0 ? 'text-green-400' : 'text-rose-400'
            }`}
          >
            {netAltitudeShiftM >= 0 ? '+' : ''}
            {netAltitudeShiftM.toFixed(1)} m shift
          </span>
        </div>

        {/* Along-Track Velocity */}
        <div className="bg-[#05070a] p-3 rounded-2xl border border-[#1e293b] flex flex-col justify-between shadow-xs">
          <span className="text-[9.5px] text-slate-400">INERTIAL VELOCITY</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-sm font-bold text-cyan-300">
              {currentLiveState.velocityMs.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400">m/s</span>
          </div>
          <span className="text-[9.5px] text-slate-400 mt-0.5">
            Nominal 7,589.20 m/s
          </span>
        </div>

        {/* Cumulative ΔV */}
        <div className="bg-[#05070a] p-3 rounded-2xl border border-[#1e293b] flex flex-col justify-between shadow-xs">
          <span className="text-[9.5px] text-slate-400">CUMULATIVE ΔV</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-sm font-bold text-amber-400">
              {totalDeltaVMs.toFixed(3)}
            </span>
            <span className="text-[10px] text-slate-400">m/s</span>
          </div>
          <span className="text-[9.5px] text-slate-400 mt-0.5">
            {pulses.length} total pulses fired
          </span>
        </div>

        {/* Angular Slew Rate */}
        <div className="bg-[#05070a] p-3 rounded-2xl border border-[#1e293b] flex flex-col justify-between shadow-xs">
          <span className="text-[9.5px] text-slate-400">ATTITUDE DRIFT RATE</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span
              className={`text-sm font-bold ${
                Math.abs(currentLiveState.angularRate) > 0.5 ? 'text-rose-400' : 'text-green-400'
              }`}
            >
              {currentLiveState.angularRate.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400">°/s</span>
          </div>
          <span className="text-[9.5px] text-slate-400 mt-0.5">
            RW reaction damping
          </span>
        </div>

        {/* Propellant Used */}
        <div className="bg-[#05070a] p-3 rounded-2xl border border-[#1e293b] flex flex-col justify-between shadow-xs">
          <span className="text-[9.5px] text-slate-400">PROPELLANT USED</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-sm font-bold text-slate-200">
              {totalFuelGrams.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-400">g N₂H₄</span>
          </div>
          <span className="text-[9.5px] text-slate-400 mt-0.5">
            18.4 kg reserve
          </span>
        </div>

        {/* Autonomy AOCS Status */}
        <div className="bg-[#05070a] p-3 rounded-2xl border border-[#1e293b] flex flex-col justify-between shadow-xs">
          <span className="text-[9.5px] text-slate-400">SWARM AOCS STATUS</span>
          <div className="flex items-center gap-1.5 mt-1">
            <ShieldCheck size={14} className="text-cyan-400" />
            <span className="text-xs font-bold text-cyan-300">
              {autonomyMode === 'OVERRIDE' ? 'MANUAL OVERRIDE' : 'ACTIVE DAMPING'}
            </span>
          </div>
          <span className="text-[9.5px] text-slate-400 mt-0.5">
            Raft Consensus Valid
          </span>
        </div>
      </div>

      {/* Main Interactive SVG Trajectory Graph */}
      <div className="relative w-full bg-[#05070a] rounded-2xl border border-[#1e293b] overflow-hidden shadow-inner select-none">
        {/* Graph Header Legend & Units */}
        <div className="absolute top-2 left-4 right-4 flex items-center justify-between pointer-events-none z-10 text-[10px] font-mono">
          <div className="flex items-center gap-3">
            <span className="text-slate-400">
              TRACE: <strong className="text-cyan-400 font-bold">{yBounds.label}</strong>
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">
              SCALE: <strong className="text-slate-200">±{yBounds.max.toFixed(graphMode === 'VELOCITY' ? 2 : 0)} {yBounds.unit}</strong>
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-green-400 flex items-center gap-1">
              <span className="w-2 h-0.5 bg-green-400"></span> 0.00 Nominal Horizon
            </span>
          </div>

          <div className="flex items-center gap-3 bg-[#0f172a]/90 px-2.5 py-1 rounded-lg border border-[#1e293b] backdrop-blur-xs">
            <span className="text-slate-400">
              TIMELINE: <strong className="text-slate-200">T+{startTime.toFixed(1)}s → T+{endTime.toFixed(1)}s</strong>
            </span>
            {hoverCrosshair && (
              <span className="text-cyan-300 font-bold">
                CURSOR: T+{hoverCrosshair.time.toFixed(1)}s · {hoverCrosshair.val.toFixed(2)} {yBounds.unit}
              </span>
            )}
          </div>
        </div>

        <svg
          className="w-full h-72 sm:h-80 cursor-crosshair"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverCrosshair(null)}
        >
          <defs>
            {/* Trajectory Area Fill Gradient */}
            <linearGradient id="trajAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.22" />
              <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>

            {/* Negative area gradient if trajectory dips below baseline */}
            <linearGradient id="trajAreaNegativeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.18" />
            </linearGradient>

            {/* Thruster Flame Marker */}
            <radialGradient id="plumeGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="1" />
              <stop offset="60%" stopColor="#ef4444" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background Coordinate Grid */}
          <g stroke="#1e293b" strokeWidth="0.8" opacity="0.6">
            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
              const y = margin.top + graphHeight * pct;
              const val = yToValue(y);
              return (
                <g key={`h-${idx}`}>
                  <line x1={margin.left} y1={y} x2={svgWidth - margin.right} y2={y} strokeDasharray="3 3" />
                  <text
                    x={margin.left - 8}
                    y={y + 3}
                    fill="#64748b"
                    fontSize="8.5"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    {val >= 0 ? `+${val.toFixed(graphMode === 'VELOCITY' ? 2 : 0)}` : val.toFixed(graphMode === 'VELOCITY' ? 2 : 0)}
                  </text>
                </g>
              );
            })}

            {/* Vertical Time Grid lines */}
            {Array.from({ length: 9 }).map((_, idx) => {
              const t = startTime + (idx / 8) * windowDuration;
              const x = timeToX(t);
              return (
                <g key={`v-${idx}`}>
                  <line x1={x} y1={margin.top} x2={x} y2={svgHeight - margin.bottom} strokeDasharray="2 2" />
                  <text
                    x={x}
                    y={svgHeight - margin.bottom + 14}
                    fill="#64748b"
                    fontSize="8.5"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    T+{t.toFixed(0)}s
                  </text>
                </g>
              );
            })}
          </g>

          {/* Zero Nominal Reference Axis */}
          <line
            x1={margin.left}
            y1={zeroY}
            x2={svgWidth - margin.right}
            y2={zeroY}
            stroke="#22c55e"
            strokeWidth="1.2"
            strokeDasharray="4 3"
            opacity="0.75"
          />

          {/* Safe Nominal Tolerance Band */}
          <rect
            x={margin.left}
            y={zeroY - 14}
            width={graphWidth}
            height={28}
            fill="#22c55e"
            fillOpacity="0.04"
          />

          {/* Trajectory Area Fill */}
          {areaD && <path d={areaD} fill="url(#trajAreaGrad)" />}

          {/* Live Trajectory Stroke Path */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Individual Pulse Pin Markers on the Trajectory Curve */}
          {pulses.map((pulse) => {
            if (pulse.timestamp < startTime - 2 || pulse.timestamp > endTime + 2) return null;

            const pinX = timeToX(pulse.timestamp);
            const pState = getTrajectoryStateAtTime(pulse.timestamp);
            let pVal = 0;
            if (graphMode === 'ALTITUDE') pVal = pState.altitudeM;
            else if (graphMode === 'VELOCITY') pVal = pState.deltaVMs;
            else if (graphMode === 'ATTITUDE') pVal = pState.angularRate;
            else pVal = pState.crossTrackM;

            const pinY = valueToY(pVal);
            const isSelectedPin = activePulsePinId === pulse.id;
            const isPrograde = pulse.thruster === '+X';
            const isRetrograde = pulse.thruster === '-X';
            const pinColor = isPrograde ? '#22c55e' : isRetrograde ? '#f43f5e' : '#fbbf24';

            return (
              <g
                key={pulse.id}
                className="cursor-pointer transition-transform"
                onClick={() => setActivePulsePinId(pulse.id)}
              >
                {/* Vertical Flagpole Line */}
                <line
                  x1={pinX}
                  y1={margin.top + 10}
                  x2={pinX}
                  y2={pinY}
                  stroke={pinColor}
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                  opacity="0.8"
                />

                {/* Pulse Pin Flag Header */}
                <g transform={`translate(${pinX}, ${margin.top + 10})`}>
                  <rect
                    x="-48"
                    y="-14"
                    width="96"
                    height="18"
                    rx="4"
                    fill="#05070a"
                    stroke={pinColor}
                    strokeWidth={isSelectedPin ? '1.8' : '1'}
                    filter="drop-shadow(0 0 6px rgba(0,0,0,0.8))"
                  />
                  {/* Pin Downward Pointer */}
                  <polygon points="0,4 -4,8 4,8" fill={pinColor} />

                  {/* Icon indicator */}
                  <circle cx="-38" cy="-5" r="3" fill={pinColor} />

                  <text
                    x="-30"
                    y="-4"
                    fill="#ffffff"
                    fontSize="7.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {pulse.thruster} // {pulse.durationMs}ms
                  </text>
                </g>

                {/* Concentric Impact / Firing Ring on Curve */}
                <g transform={`translate(${pinX}, ${pinY})`}>
                  <circle r="5" fill={pinColor} stroke="#ffffff" strokeWidth="1" />
                  <circle
                    r="10"
                    fill="none"
                    stroke={pinColor}
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    className="animate-ping"
                    opacity="0.6"
                  />
                  {/* Thruster Plume directional arrow */}
                  <polygon
                    points={isPrograde ? '6,0 12,-3 12,3' : '-6,0 -12,-3 -12,3'}
                    fill={pinColor}
                    opacity="0.8"
                  />
                </g>
              </g>
            );
          })}

          {/* Live Progress Head Probe (pulsing cursor at streamTime) */}
          {currentLiveX >= margin.left && currentLiveX <= svgWidth - margin.right && (
            <g transform={`translate(${currentLiveX}, ${currentLiveY})`}>
              {/* Radar pulse ripples */}
              <circle r="12" fill="none" stroke="#22d3ee" strokeWidth="1" strokeDasharray="3 2" opacity="0.6" className="animate-ping" />
              <circle r="6" fill="#22d3ee" stroke="#ffffff" strokeWidth="1.5" />

              {/* Floating coordinate pill readout */}
              <g transform="translate(0, -18)">
                <rect
                  x="-42"
                  y="-9"
                  width="84"
                  height="16"
                  rx="4"
                  fill="#05070a"
                  stroke="#22d3ee"
                  strokeWidth="1"
                  filter="drop-shadow(0 0 8px rgba(34,211,238,0.4))"
                />
                <text
                  x="0"
                  y="2"
                  textAnchor="middle"
                  fill="#22d3ee"
                  fontSize="8"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {currentVal >= 0 ? `+${currentVal.toFixed(1)}` : currentVal.toFixed(1)} {yBounds.unit}
                </text>
              </g>
            </g>
          )}

          {/* Interactive Mouse Hover Crosshair */}
          {hoverCrosshair && (
            <g>
              {/* Vertical Guide */}
              <line
                x1={hoverCrosshair.x}
                y1={margin.top}
                x2={hoverCrosshair.x}
                y2={svgHeight - margin.bottom}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.7"
              />
              {/* Horizontal Guide */}
              <line
                x1={margin.left}
                y1={hoverCrosshair.y}
                x2={svgWidth - margin.right}
                y2={hoverCrosshair.y}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.7"
              />
              {/* Crosshair Target Point */}
              <circle cx={hoverCrosshair.x} cy={hoverCrosshair.y} r="4" fill="#ffffff" stroke="#0ea5e9" strokeWidth="1.5" />
            </g>
          )}
        </svg>

        {/* Empty State Banner if no pulses fired yet */}
        {pulses.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#05070a]/70 backdrop-blur-xs pointer-events-none p-4 text-center">
            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-2">
              <Crosshair size={24} className="animate-pulse" />
            </div>
            <span className="text-sm font-bold text-slate-100 uppercase tracking-wide">
              Awaiting Manual Thruster Pulse Input
            </span>
            <p className="text-xs text-slate-400 font-mono max-w-md mt-1">
              Fire a pulse using the manual actuation deck above or use the quick pulse buttons below to view live trajectory changes in real time.
            </p>
          </div>
        )}
      </div>

      {/* Action Controls & Quick Pulse Dispatch Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#05070a] p-3 rounded-2xl border border-[#1e293b] font-mono text-xs">
        {/* Left: Quick-Fire Thruster Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10.5px] text-slate-400 font-bold flex items-center gap-1.5">
            <Flame size={13} className="text-amber-400" />
            QUICK PULSE:
          </span>

          {/* Duration Selector */}
          <div className="flex items-center gap-1 bg-[#0f172a] px-2 py-1 rounded-xl border border-[#1e293b]">
            {[50, 100, 250, 500].map((ms) => (
              <button
                key={ms}
                onClick={() => setQuickDuration(ms)}
                className={`px-1.5 py-0.5 rounded text-[9px] cursor-pointer transition-all ${
                  quickDuration === ms
                    ? 'bg-green-500 text-black font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {ms}ms
              </button>
            ))}
          </div>

          {/* Thruster Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleQuickFire('+X')}
              className="px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 border border-green-500/40 hover:bg-green-500 hover:text-black font-bold text-[10px] cursor-pointer transition-all flex items-center gap-1"
              title="Prograde (+X): Raises orbital altitude"
            >
              <TrendingUp size={11} />
              +X (PROGRADE)
            </button>
            <button
              onClick={() => handleQuickFire('-X')}
              className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/40 hover:bg-rose-500 hover:text-white font-bold text-[10px] cursor-pointer transition-all flex items-center gap-1"
              title="Retrograde (-X): Lowers orbital altitude"
            >
              <TrendingUp size={11} className="rotate-180" />
              -X (RETROGRADE)
            </button>
            <button
              onClick={() => handleQuickFire('+Y')}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/40 hover:bg-cyan-500 hover:text-black font-bold text-[10px] cursor-pointer transition-all flex items-center gap-1"
              title="Cross-Track (+Y): Lateral inclination perturbation"
            >
              <Compass size={11} />
              +Y (CROSS-TRACK)
            </button>
            <button
              onClick={() => handleQuickFire('Roll ↺')}
              className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/40 hover:bg-amber-500 hover:text-black font-bold text-[10px] cursor-pointer transition-all flex items-center gap-1"
              title="Roll ↺: Induces roll torque"
            >
              <RotateCcw size={11} />
              ROLL ↺
            </button>
          </div>
        </div>

        {/* Right: Management & Swarm Remediation Actions */}
        <div className="flex items-center gap-2">
          {onAutonomousCounterBurn && pulses.length > 0 && (
            <button
              onClick={() => {
                sound.playRemediated();
                onAutonomousCounterBurn();
              }}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500 hover:text-black font-bold text-[10px] cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
              title="Dispatches Swarm consensus counter-burn to neutralize perturbation"
            >
              <ShieldCheck size={13} />
              AUTO RE-CIRCULARIZE ORBIT
            </button>
          )}

          {/* Live Play/Pause */}
          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className="p-1.5 rounded-lg bg-[#0f172a] text-slate-400 hover:text-white border border-[#1e293b] cursor-pointer transition-colors"
            title={isLiveStreaming ? 'Pause Time Stream' : 'Resume Live Stream'}
          >
            {isLiveStreaming ? <Pause size={13} className="text-green-400" /> : <Play size={13} />}
          </button>

          {/* Reset / Clear */}
          <button
            onClick={() => {
              sound.playClick();
              onClearPulses();
            }}
            disabled={pulses.length === 0}
            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${
              pulses.length === 0
                ? 'bg-transparent text-slate-600 cursor-not-allowed'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/40 hover:bg-rose-500 hover:text-white cursor-pointer'
            }`}
            title="Clear all manual pulses and restore nominal trajectory"
          >
            <Trash2 size={12} />
            CLEAR TRAJECTORY
          </button>
        </div>
      </div>
    </div>
  );
};
