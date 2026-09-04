import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { sound } from '../utils/audio';
import { VideogameLoadingSlider } from './VideogameLoadingSlider';
import {
  Wind,
  Sun,
  Zap,
  Gauge,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  ShieldCheck,
  Compass,
  Sparkles,
  ArrowUpRight,
  Orbit,
  Layers,
  CheckCircle2,
  Info,
  Maximize2,
  Minimize2,
  Flame,
  Activity,
  ZoomIn,
  ZoomOut,
  Eye,
  Crosshair,
} from 'lucide-react';

export type PropellantlessMethod = 'solar_sail' | 'electrodynamic' | 'aerodrag' | 'hybrid';

interface SimulationPoint {
  timeSec: number;
  thrustMn: number;
  deltaV: number;
  altitudeMeters: number;
  fuelSpent: number;
  inSunlight: boolean;
}

interface ScenarioPreset {
  id: string;
  name: string;
  method: PropellantlessMethod;
  description: string;
  targetOutcome: string;
  sailArea: number;
  sailAngle: number;
  tetherLength: number;
  tetherCurrent: number;
  featherAngle: number;
}

const PRESETS: ScenarioPreset[] = [
  {
    id: 'solar_orbit_raise',
    name: 'Solar Photon Orbit Raising',
    method: 'solar_sail',
    description: 'Continuous solar radiation pressure spires orbital semi-major axis upwards to counteract solar maximum atmospheric expansion.',
    targetOutcome: '+1,450 m Semi-Major Axis elevation per 10 days with 0.000g propellant.',
    sailArea: 120,
    sailAngle: 35,
    tetherLength: 1.0,
    tetherCurrent: 0.0,
    featherAngle: 0,
  },
  {
    id: 'edt_debris_avoidance',
    name: 'Electrodynamic Tether Debris Evasion',
    method: 'electrodynamic',
    description: 'Rapid Lorentz-force thrust generation across geomagnetic field lines to clear conjunction error ellipse without RCS fuel.',
    targetOutcome: '+380 m radial offset within 45 min, eliminating collision probability.',
    sailArea: 30,
    sailAngle: 0,
    tetherLength: 3.5,
    tetherCurrent: 3.8,
    featherAngle: 10,
  },
  {
    id: 'aerodrag_phasing',
    name: 'VLEO Aerodynamic Constellation Phasing',
    method: 'aerodrag',
    description: 'Modulating solar array cross-sectional area against upper thermospheric rarefied gas to slip along-track position into slot.',
    targetOutcome: '92 km along-track phasing maneuver with zero hydrazine consumption.',
    sailArea: 40,
    sailAngle: 0,
    tetherLength: 0.5,
    tetherCurrent: 0.0,
    featherAngle: 75,
  },
  {
    id: 'hybrid_sustainable',
    name: 'Autonomous Hybrid Swarm Optimization',
    method: 'hybrid',
    description: 'Synergistic co-optimization: Solar sail during sunlit apogee + Electrodynamic boost during geomagnetic equator transits.',
    targetOutcome: 'Continuous 48.2 mN non-chemical thrust vectoring with infinite Isp.',
    sailArea: 150,
    sailAngle: 28,
    tetherLength: 2.8,
    tetherCurrent: 2.5,
    featherAngle: 20,
  },
];

export const PropellantlessControlScreen: React.FC = () => {
  // Method selection
  const [selectedMethod, setSelectedMethod] = useState<PropellantlessMethod>('solar_sail');

  // Parameters (Sliders)
  const [sailAngle, setSailAngle] = useState<number>(35); // degrees
  const [sailArea, setSailArea] = useState<number>(100); // m^2
  const [sailReflectivity, setSailReflectivity] = useState<number>(92); // %

  const [tetherLength, setTetherLength] = useState<number>(2.5); // km
  const [tetherCurrent, setTetherCurrent] = useState<number>(2.0); // Amperes (+ is boost, - is drag)
  const [plasmaVoltage, setPlasmaVoltage] = useState<number>(350); // Volts

  const [featherAngle, setFeatherAngle] = useState<number>(25); // degrees (0 = edge on, 90 = flat)
  const [atmosphericDensityIdx, setAtmosphericDensityIdx] = useState<number>(50); // 0 = low solar act, 100 = solar storm

  // Simulation controls
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1); // 1x, 5x, 25x
  const [simTime, setSimTime] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'orbital_canvas' | 'oscilloscope'>('orbital_canvas');
  const [autoSteering, setAutoSteering] = useState<boolean>(true);

  // Accumulated metrics
  const [deltaVAccum, setDeltaVAccum] = useState<number>(42.85); // m/s
  const [fuelSavedKg, setFuelSavedKg] = useState<number>(1.285); // kg of hydrazine saved
  const [altDeltaMeters, setAltDeltaMeters] = useState<number>(340); // meters raised

  // History buffer for live oscilloscope
  const [history, setHistory] = useState<SimulationPoint[]>(() => {
    const initPts: SimulationPoint[] = [];
    for (let i = 0; i < 40; i++) {
      const t = i * 15;
      const inSun = (t % 900) < 540;
      initPts.push({
        timeSec: t,
        thrustMn: 15 + Math.sin(i * 0.2) * 8,
        deltaV: (i / 40) * 42.85,
        altitudeMeters: (i / 40) * 340,
        fuelSpent: 0,
        inSunlight: inSun,
      });
    }
    return initPts;
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Visual Clarity & Orbital Mechanics Simulation Controls
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [viewMode, setViewMode] = useState<'geocentric' | 'chase'>('geocentric');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showVectors, setShowVectors] = useState<boolean>(true);
  const [showPhotons, setShowPhotons] = useState<boolean>(true);
  const [showBField, setShowBField] = useState<boolean>(true);
  const [showAltitudeGrid, setShowAltitudeGrid] = useState<boolean>(true);
  const [showAttitudeHUD, setShowAttitudeHUD] = useState<boolean>(true);
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    rKm: number;
    altKm: number;
    speedKmS: number;
    anomalyDeg: number;
    inUmbra: boolean;
  } | null>(null);

  // Physics calculations based on active sliders and orbital position
  const orbitPeriodSec = 94 * 60; // 94-minute orbit
  const orbitProgress = (simTime % orbitPeriodSec) / orbitPeriodSec;
  const trueAnomalyDeg = orbitProgress * 360;
  const inSunlight = orbitProgress < 0.62; // 62% in sunlight, 38% in Earth umbra

  // 1. Solar Radiation Pressure Force
  // Solar constant Phi0 = 1361 W/m^2; c = 3e8 m/s; P0 = 4.54 uN/m^2 (absorbed) or 9.08 uN/m^2 (ideal mirror)
  const radPressure = (1361 / 3e8) * (1 + sailReflectivity / 100); // N/m^2
  const effectiveSailArea = sailArea * Math.cos((sailAngle * Math.PI) / 180);
  const srpThrustMn = inSunlight
    ? radPressure * effectiveSailArea * 1000 * Math.cos((sailAngle * Math.PI) / 180)
    : 0;

  // 2. Electrodynamic Tether Lorentz Force
  // F = I * (L x B); B_LEO ~ 3.5e-5 Tesla
  const bFieldTesla = 3.8e-5;
  const edtThrustMn = Math.abs(tetherCurrent) * (tetherLength * 1000) * bFieldTesla * 1000;
  const isEdtBoosting = tetherCurrent >= 0;

  // 3. Aerodynamic Drag Modulation
  // F_drag = 0.5 * rho * v^2 * Cd * A
  // v_LEO = 7660 m/s; rho ~ 1e-12 kg/m^3 scaled by slider
  const rhoBase = 1.2e-12 * (1 + atmosphericDensityIdx / 50);
  const vOrbital = 7660; // m/s
  const arrayArea = 12; // m^2 base solar array
  const effectiveAeroArea = 0.8 + arrayArea * Math.sin((featherAngle * Math.PI) / 180);
  const aeroDragMn = 0.5 * rhoBase * vOrbital * vOrbital * 2.2 * effectiveAeroArea * 1000;

  // Total instantaneous micro-thrust depending on selected method
  let netThrustMn = 0;
  if (selectedMethod === 'solar_sail') {
    netThrustMn = srpThrustMn;
  } else if (selectedMethod === 'electrodynamic') {
    netThrustMn = isEdtBoosting ? edtThrustMn : -edtThrustMn;
  } else if (selectedMethod === 'aerodrag') {
    netThrustMn = -aeroDragMn;
  } else {
    // Hybrid swarm
    netThrustMn = (inSunlight ? srpThrustMn : 0) + (isEdtBoosting ? edtThrustMn : -edtThrustMn) - aeroDragMn * 0.15;
  }

  // Dynamic live oscilloscope calculation: reacts instantly to all parameter slider adjustments
  // Computes a 600-second window spanning T-600s to T-0s (Live) modulated by active slider values and orbit phase
  const OSCILLOSCOPE_WINDOW_SEC = 600;
  const NUM_POINTS = 60;
  const oscilloscopePoints = useMemo(() => {
    const pts = [];
    const stepSec = OSCILLOSCOPE_WINDOW_SEC / (NUM_POINTS - 1);

    for (let i = 0; i < NUM_POINTS; i++) {
      const offsetSec = (i - (NUM_POINTS - 1)) * stepSec; // from -600s to 0s
      const t = simTime + offsetSec;
      const prog = (((t % orbitPeriodSec) + orbitPeriodSec) % orbitPeriodSec) / orbitPeriodSec;
      const ptSunlight = prog < 0.62;

      // 1. Solar Radiation Pressure component at this orbital station
      const ptRadPressure = (1361 / 3e8) * (1 + sailReflectivity / 100);
      const ptEffectiveSailArea = sailArea * Math.cos((sailAngle * Math.PI) / 180);
      const ptSrp = ptSunlight
        ? ptRadPressure * ptEffectiveSailArea * 1000 * Math.cos((sailAngle * Math.PI) / 180) * (0.92 + 0.08 * Math.cos(prog * Math.PI * 2))
        : 0;

      // 2. Electrodynamic Lorentz Force at this station (B-field dipole harmonic)
      const ptEdt =
        (tetherCurrent >= 0 ? 1 : -1) *
        Math.abs(tetherCurrent) *
        (tetherLength * 1000) *
        3.8e-5 *
        1000 *
        (0.93 + 0.07 * Math.sin(prog * Math.PI * 4));

      // 3. Aerodynamic Drag at this station
      const ptEffectiveAeroArea = 0.8 + arrayArea * Math.sin((featherAngle * Math.PI) / 180);
      const ptAero =
        -0.5 *
        rhoBase *
        (vOrbital * vOrbital) *
        2.2 *
        ptEffectiveAeroArea *
        1000 *
        (1 + 0.05 * Math.cos(prog * Math.PI * 2));

      let ptThrust = 0;
      if (selectedMethod === 'solar_sail') {
        ptThrust = ptSrp;
      } else if (selectedMethod === 'electrodynamic') {
        ptThrust = ptEdt;
      } else if (selectedMethod === 'aerodrag') {
        ptThrust = ptAero;
      } else {
        ptThrust = ptSrp + ptEdt + ptAero * 0.15;
      }

      // If at live now (i === NUM_POINTS - 1), lock directly to instantaneous netThrustMn
      if (i === NUM_POINTS - 1) {
        ptThrust = netThrustMn;
      }

      // Projected / accumulated altitude across the window
      const ptAlt = Math.max(0, altDeltaMeters + (offsetSec / 600) * Math.max(1, Math.abs(netThrustMn) * 4));

      pts.push({
        idx: i,
        timeSec: t,
        offsetSec,
        thrustMn: ptThrust,
        altitudeMeters: ptAlt,
        inSunlight: ptSunlight,
      });
    }
    return pts;
  }, [
    simTime,
    orbitPeriodSec,
    sailReflectivity,
    sailArea,
    sailAngle,
    tetherCurrent,
    tetherLength,
    arrayArea,
    featherAngle,
    rhoBase,
    vOrbital,
    selectedMethod,
    netThrustMn,
    altDeltaMeters,
  ]);

  // Interactive hover inspection state on live oscilloscope
  const [hoverOscillo, setHoverOscillo] = useState<{
    svgX: number;
    offsetSec: number;
    thrustMn: number;
    altMeters: number;
    inSunlight: boolean;
  } | null>(null);

  // Simulation tick loop with stable refs for smooth execution
  const netThrustRef = useRef(netThrustMn);
  netThrustRef.current = netThrustMn;
  const simSpeedRef = useRef(simSpeed);
  simSpeedRef.current = simSpeed;
  const inSunlightRef = useRef(inSunlight);
  inSunlightRef.current = inSunlight;

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      const speed = simSpeedRef.current;
      const currentNetThrust = netThrustRef.current;
      const sunlit = inSunlightRef.current;

      setSimTime((prev) => prev + speed);

      // Mass of ORION-7 satellite: ~450 kg
      const massKg = 450;
      // Acceleration in m/s^2: F (in N) / mass
      const accelMs2 = (currentNetThrust / 1000) / massKg;
      const stepDeltaV = Math.abs(accelMs2 * speed);
      const stepAlt = (accelMs2 * speed * speed * 0.5 + accelMs2 * 50 * speed);

      setDeltaVAccum((prev) => prev + stepDeltaV * 0.05);
      setAltDeltaMeters((prev) => prev + stepAlt * 0.02);
      // Hydrazine ISP ~ 220s => deltaV = Isp * g0 * ln(m0/m1) => fuel ~ mass * deltaV / (Isp * g0)
      const fuelPerMeterPerSec = (massKg * 1) / (220 * 9.80665); // kg per m/s
      setFuelSavedKg((prev) => prev + (stepDeltaV * 0.05 * fuelPerMeterPerSec) / 100);

      // Keep history telemetry buffer synced
      setHistory((prev) => {
        const nextTime = prev.length > 0 ? prev[prev.length - 1].timeSec + 15 : 0;
        const newPt: SimulationPoint = {
          timeSec: nextTime,
          thrustMn: currentNetThrust,
          deltaV: stepDeltaV,
          altitudeMeters: stepAlt,
          fuelSpent: 0,
          inSunlight: sunlit,
        };
        const trimmed = [...prev.slice(1), newPt];
        return trimmed;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isRunning]);

  // High-Clarity Canvas Renderer for Orbital Vector Mechanics
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width > 0 ? rect.width : 680;
      const height = rect.height > 0 ? rect.height : (isExpanded ? 580 : 440);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const targetWidth = Math.round(width * dpr);
      const targetHeight = Math.round(height * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      // Reset transform matrix cleanly every frame to prevent cumulative DPR scale compounding
      ctx.resetTransform();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      const cx = width / 2;
      const cy = height / 2;

      // 1. Space background with deep-space gradient
      const bgGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(width, height) * 0.8);
      bgGrad.addColorStop(0, '#091122');
      bgGrad.addColorStop(0.5, '#050a14');
      bgGrad.addColorStop(1, '#010307');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Deep space coordinate grid (tactical matrix)
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
      ctx.lineWidth = 0.5;
      const gridSize = 60;
      for (let gx = 0; gx < width; gx += gridSize) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      // Background stars
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      const starSeeds = [
        [35, 45], [90, 180], [140, 70], [280, 50], [420, 110], [520, 40], [600, 200],
        [80, 320], [190, 290], [380, 340], [510, 290], [620, 320], [40, 210],
        [720, 80], [780, 260], [840, 140], [300, 410], [460, 480], [670, 450],
      ];
      starSeeds.forEach(([sx, sy]) => {
        const x = (sx * (width / 650)) % width;
        const y = (sy * (height / 360)) % height;
        ctx.fillRect(x, y, 1.5, 1.5);
      });

      // 2. Physical Orbital Geometry Scale
      // Earth radius: 6,378 km -> baseline pixel radius
      const earthRadius = Math.min(width, height) * 0.22;
      const kmToPx = earthRadius / 6378; // px per km
      const orbitAltKm = 550; // Nominal LEO altitude
      const orbitR = earthRadius + orbitAltKm * kmToPx; // nominal circular orbit radius

      const orbitRx = orbitR * 1.02; // slight eccentricity for clear visualization
      const orbitRy = orbitR * 0.98;

      // Propellantless accumulated elevation (exaggerated by scale for visual clarity)
      const spiralOffsetPx = (altDeltaMeters / 1000) * (kmToPx * 400); // dynamic visualization scaling

      // Satellite position along the orbit
      const currentTheta = (trueAnomalyDeg * Math.PI) / 180;
      const currentRScale = 1 + (spiralOffsetPx / orbitR);
      const satX = cx + Math.cos(currentTheta) * (orbitRx * currentRScale);
      const satY = cy + Math.sin(currentTheta) * (orbitRy * currentRScale);

      // Camera view origin
      let camX = cx;
      let camY = cy;
      if (viewMode === 'chase') {
        camX = satX;
        camY = satY;
      }

      ctx.save();
      // Apply Camera Center & Zoom
      ctx.translate(cx, cy);
      ctx.scale(zoomLevel, zoomLevel);
      ctx.translate(-camX, -camY);

      // 3. Solar Radiation Stream (from Sun at +X direction towards -X)
      if (showPhotons) {
        const rayCount = 18;
        const photonSpeed = (simTime * 25) % 80;
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([12, 14]);
        ctx.lineDashOffset = -photonSpeed;

        for (let r = 0; r < rayCount; r++) {
          const ry = cy - height * 0.55 + (r / (rayCount - 1)) * (height * 1.1);
          const distToCenter = Math.abs(ry - cy);
          const strikesEarth = distToCenter < earthRadius;

          ctx.beginPath();
          ctx.moveTo(cx + width * 0.85, ry);
          if (strikesEarth) {
            // Stops at daylight Earth surface
            const surfaceX = cx + Math.sqrt(Math.max(0, earthRadius * earthRadius - distToCenter * distToCenter));
            ctx.lineTo(surfaceX, ry);
          } else {
            // Streams past Earth
            ctx.lineTo(cx - width * 0.85, ry);
          }
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // 4. Earth Umbra Shadow Cone (Semi-transparent shadow wedge opposite the Sun)
      ctx.save();
      const umbraGrad = ctx.createLinearGradient(cx, cy, cx - width * 0.8, cy);
      umbraGrad.addColorStop(0, 'rgba(2, 6, 23, 0.88)');
      umbraGrad.addColorStop(0.7, 'rgba(4, 10, 30, 0.82)');
      umbraGrad.addColorStop(1, 'rgba(2, 6, 23, 0.4)');

      ctx.fillStyle = umbraGrad;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      // Umbra shadow angle ~ 36 deg cone
      ctx.arc(cx, cy, Math.max(width, height) * 0.85, Math.PI - 0.52, Math.PI + 0.52);
      ctx.closePath();
      ctx.fill();

      // Umbra boundary lines
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(Math.PI - 0.52) * (width * 0.8), cy + Math.sin(Math.PI - 0.52) * (width * 0.8));
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(Math.PI + 0.52) * (width * 0.8), cy + Math.sin(Math.PI + 0.52) * (width * 0.8));
      ctx.stroke();
      ctx.setLineDash([]);

      // Umbra label
      ctx.font = '9px monospace';
      ctx.fillStyle = 'rgba(129, 140, 248, 0.7)';
      ctx.fillText('UMBRA ECLIPSE ZONE', cx - earthRadius * 2.2, cy - 6);
      ctx.fillText('(0.0 mN SOLAR FLUX)', cx - earthRadius * 2.2, cy + 8);
      ctx.restore();

      // 5. Geomagnetic Dipole Field Lines (if showBField)
      if (showBField) {
        ctx.save();
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.28)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 5]);

        // Dipole field loops
        for (let rFactor = 1.35; rFactor <= 2.1; rFactor += 0.25) {
          ctx.beginPath();
          ctx.ellipse(cx, cy, earthRadius * rFactor, earthRadius * (rFactor * 0.68), 0, 0, Math.PI * 2);
          ctx.stroke();

          // Field orientation arrow (Northward)
          const fx = cx;
          const fy = cy - earthRadius * (rFactor * 0.68);
          ctx.fillStyle = 'rgba(192, 132, 252, 0.7)';
          ctx.beginPath();
          ctx.moveTo(fx - 4, fy + 4);
          ctx.lineTo(fx, fy - 2);
          ctx.lineTo(fx + 4, fy + 4);
          ctx.fill();
        }
        ctx.setLineDash([]);
        ctx.restore();
      }

      // 6. Earth Body with Realistic Atmosphere & Day/Night Rim
      ctx.save();
      // Outer atmospheric Rayleigh scattering glow
      const atmoGrad = ctx.createRadialGradient(cx, cy, earthRadius * 0.95, cx, cy, earthRadius * 1.15);
      atmoGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
      atmoGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.18)');
      atmoGrad.addColorStop(1, 'rgba(2, 132, 199, 0)');
      ctx.fillStyle = atmoGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, earthRadius * 1.15, 0, Math.PI * 2);
      ctx.fill();

      // Earth body disk
      const earthGrad = ctx.createRadialGradient(
        cx + earthRadius * 0.45,
        cy - earthRadius * 0.2,
        earthRadius * 0.1,
        cx,
        cy,
        earthRadius
      );
      earthGrad.addColorStop(0, '#38bdf8');
      earthGrad.addColorStop(0.35, '#0284c7');
      earthGrad.addColorStop(0.7, '#075985');
      earthGrad.addColorStop(1, '#082f49');

      ctx.beginPath();
      ctx.arc(cx, cy, earthRadius, 0, Math.PI * 2);
      ctx.fillStyle = earthGrad;
      ctx.fill();

      // Earth latitude & longitude graticules for depth
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(cx, cy, earthRadius * 0.85, earthRadius * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cy, earthRadius * 0.45, earthRadius * 0.85, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Night-side shadow overlay over Earth's left hemisphere
      const nightGrad = ctx.createLinearGradient(cx - earthRadius, cy, cx + earthRadius * 0.2, cy);
      nightGrad.addColorStop(0, 'rgba(2, 6, 23, 0.92)');
      nightGrad.addColorStop(0.75, 'rgba(2, 6, 23, 0.7)');
      nightGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, earthRadius, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = nightGrad;
      ctx.fillRect(cx - earthRadius, cy - earthRadius, earthRadius * 2, earthRadius * 2);
      ctx.restore();

      // Earth crust perimeter border
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Center Geocenter crosshair
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy);
      ctx.lineTo(cx + 5, cy);
      ctx.moveTo(cx, cy - 5);
      ctx.lineTo(cx, cy + 5);
      ctx.stroke();
      ctx.restore();

      // 7. Concentric Altitude Distance Scale Rings (if showAltitudeGrid)
      if (showAltitudeGrid) {
        ctx.save();
        ctx.lineWidth = 1;

        // Kármán Line (+100 km)
        const karmanR = earthRadius + 100 * kmToPx;
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.35)';
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, karmanR, 0, Math.PI * 2);
        ctx.stroke();

        // Nominal LEO 550 km Reference (Unperturbed)
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, orbitRx, orbitRy, 0, 0, Math.PI * 2);
        ctx.stroke();

        // 1,000 km Upper Altitude Grid
        const highLeoR = earthRadius + 1000 * kmToPx;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        ctx.arc(cx, cy, highLeoR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Altitude Ring Badges
        ctx.font = '8.5px monospace';
        ctx.fillStyle = 'rgba(249, 115, 22, 0.8)';
        ctx.fillText('KÁRMÁN LINE (100 km)', cx + karmanR + 4, cy + 3);

        ctx.fillStyle = '#06b6d4';
        ctx.fillText('REF LEO (550 km)', cx + orbitRx + 4, cy + 3);

        ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.fillText('M-LEO (1,000 km)', cx + highLeoR + 4, cy + 3);

        // Cardinal Anomaly Axis Ticks (Periapsis, Apoapsis, Quadrature)
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.beginPath();
        ctx.moveTo(cx - highLeoR - 10, cy);
        ctx.lineTo(cx + highLeoR + 10, cy);
        ctx.moveTo(cx, cy - highLeoR - 10);
        ctx.lineTo(cx, cy + highLeoR + 10);
        ctx.stroke();

        ctx.fillStyle = 'rgba(203, 213, 225, 0.5)';
        ctx.fillText('ν = 0° (PERIAPSIS)', cx + orbitRx - 40, cy - 8);
        ctx.fillText('ν = 180° (APOAPSIS)', cx - orbitRx - 65, cy - 8);
        ctx.fillText('ν = 90°', cx + 6, cy + orbitRy + 12);
        ctx.fillText('ν = 270°', cx + 6, cy - orbitRy - 6);
        ctx.restore();
      }

      // 8. Propellantless Continuous Spiral Trajectory (Vibrant Yellow Arc)
      ctx.save();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      const points = 160;
      for (let i = 0; i <= points; i++) {
        const theta = (i / points) * Math.PI * 2;
        const currentRScaleTraj = 1 + (spiralOffsetPx / orbitR) * (i / points);
        const px = cx + Math.cos(theta) * (orbitRx * currentRScaleTraj);
        const py = cy + Math.sin(theta) * (orbitRy * currentRScaleTraj);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.restore();

      // Tangent velocity unit vector
      const vx = -Math.sin(currentTheta);
      const vy = Math.cos(currentTheta);
      const satDistToCenter = Math.hypot(satX - cx, satY - cy);

      // 9. Spacecraft Node & Actuation Subsystems
      ctx.save();
      ctx.translate(satX, satY);

      // (A) Solar Sail Gossamer Membrane
      if (selectedMethod === 'solar_sail' || selectedMethod === 'hybrid') {
        const sailRad = (sailAngle * Math.PI) / 180;
        ctx.save();
        ctx.rotate(sailRad);

        // Reflective reflective membrane diamond
        const sailSpan = 15 + (sailArea / 250) * 20;
        ctx.fillStyle = inSunlight ? 'rgba(250, 204, 21, 0.45)' : 'rgba(100, 116, 139, 0.25)';
        ctx.strokeStyle = inSunlight ? '#fde047' : '#64748b';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, -sailSpan);
        ctx.lineTo(sailSpan * 0.65, 0);
        ctx.lineTo(0, sailSpan);
        ctx.lineTo(-sailSpan * 0.65, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Membrane structural battens
        ctx.strokeStyle = inSunlight ? 'rgba(250, 204, 21, 0.8)' : 'rgba(148, 163, 184, 0.4)';
        ctx.beginPath();
        ctx.moveTo(0, -sailSpan);
        ctx.lineTo(0, sailSpan);
        ctx.moveTo(-sailSpan * 0.65, 0);
        ctx.lineTo(sailSpan * 0.65, 0);
        ctx.stroke();

        // Specular photon reflection bounce if illuminated
        if (inSunlight && showPhotons) {
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(18, 0);
          ctx.lineTo(32, -14);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
      }

      // (B) Electrodynamic Tether Line & Lorentz Current
      if (selectedMethod === 'electrodynamic' || selectedMethod === 'hybrid') {
        const tetherPx = 14 + (tetherLength / 5.0) * 36;
        ctx.strokeStyle = isEdtBoosting ? '#4ade80' : '#f87171'; // Green boost vs Red brake
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -tetherPx);
        ctx.stroke();

        // Animated current dots along tether
        const currentDotPos = ((simTime * 30) % tetherPx);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, isEdtBoosting ? -currentDotPos : -tetherPx + currentDotPos, 2, 0, Math.PI * 2);
        ctx.fill();

        // Tip Hollow-Cathode Plasma Contactor
        ctx.beginPath();
        ctx.arc(0, -tetherPx, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#c084fc';
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // (C) Feathered Solar Arrays (Aerodrag Mode)
      if (selectedMethod === 'aerodrag') {
        const fRad = (featherAngle * Math.PI) / 180;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-18 * Math.cos(fRad), -18 * Math.sin(fRad));
        ctx.lineTo(18 * Math.cos(fRad), 18 * Math.sin(fRad));
        ctx.stroke();

        // Aerodynamic wake streamlines
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(vx * -8, vy * -8);
        ctx.lineTo(vx * -24, vy * -24);
        ctx.stroke();
      }

      // (D) Central Satellite Bus Node
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0284c7';
      ctx.stroke();

      // Satellite bus solar wings
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(-10, -1.5, 4, 3);
      ctx.fillRect(6, -1.5, 4, 3);

      // (E) Comprehensive Annotated Force & Velocity Vectors (if showVectors)
      if (showVectors) {
        // 1. Orbital Velocity Vector v (Cyan)
        const vLen = 38;
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(vx * vLen, vy * vLen);
        ctx.stroke();

        // Arrowhead
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(vx * vLen, vy * vLen, 2.8, 0, Math.PI * 2);
        ctx.fill();

        // Label for velocity
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#22d3ee';
        ctx.fillText('v = 7.66 km/s', vx * (vLen + 10), vy * (vLen + 10));

        // 2. Net Propellantless Thrust Vector F_net (Bright Yellow)
        if (Math.abs(netThrustMn) > 0.4) {
          const fLen = Math.min(55, 14 + Math.abs(netThrustMn) * 0.8);
          const fAngle = netThrustMn >= 0 ? Math.atan2(vy, vx) : Math.atan2(-vy, -vx);
          const fx = Math.cos(fAngle) * fLen;
          const fy = Math.sin(fAngle) * fLen;

          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2.8;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(fx, fy);
          ctx.stroke();

          // Arrowhead
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
          ctx.fill();

          // Vector badge
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#fde047';
          ctx.fillText(`F = ${netThrustMn > 0 ? '+' : ''}${netThrustMn.toFixed(1)} mN`, fx + 6, fy);
        }

        // 3. Gravitational Vector g (Nadir direction towards Earth center)
        const toEarthX = (cx - satX) / satDistToCenter;
        const toEarthY = (cy - satY) / satDistToCenter;
        const gLen = 24;
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(toEarthX * gLen, toEarthY * gLen);
        ctx.stroke();

        ctx.fillStyle = '#60a5fa';
        ctx.beginPath();
        ctx.arc(toEarthX * gLen, toEarthY * gLen, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '8.5px monospace';
        ctx.fillText('g (nadir)', toEarthX * (gLen + 6), toEarthY * (gLen + 6));
      }

      ctx.restore(); // end satellite translation

      // Restore camera scale & translation
      ctx.restore();

      // 10. Sun Vector Indicator on Top Right (Screen Space)
      ctx.save();
      const sunX = width - 45;
      const sunY = 45;
      const sunPulse = 18 + Math.sin(simTime * 2) * 1.5;

      // Solar Corona Glow
      const sunCorona = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, sunPulse * 1.6);
      sunCorona.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
      sunCorona.addColorStop(0.5, 'rgba(250, 204, 21, 0.4)');
      sunCorona.addColorStop(1, 'rgba(234, 179, 8, 0)');
      ctx.fillStyle = sunCorona;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunPulse * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // Sun Disk
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#fef08a';
      ctx.fillText('SOLAR FLUX', width - 82, 75);
      ctx.font = '8px monospace';
      ctx.fillStyle = '#fde047';
      ctx.fillText('Φ = 1,361 W/m²', width - 88, 87);
      ctx.restore();

      // 11. Top-Left Live Trajectory & Eclipse Status Watermark
      ctx.save();
      ctx.fillStyle = 'rgba(5, 7, 10, 0.85)';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(14, 14, 280, 72, 10);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('LEO TRAJECTORY CORRECTION LAB', 24, 30);

      ctx.font = '9.5px monospace';
      ctx.fillStyle = '#facc15';
      ctx.fillText(`Δa (Semi-Major Axis): +${altDeltaMeters.toFixed(1)} m`, 24, 46);

      ctx.fillStyle = inSunlight ? '#4ade80' : '#f87171';
      ctx.fillText(
        inSunlight ? '● ILLUMINATED (HIGH PHOTON FLUX)' : '○ UMBRA OCCULTATION (ECLIPSE)',
        24,
        62
      );

      ctx.fillStyle = '#06b6d4';
      ctx.fillText(`ν (True Anomaly): ${trueAnomalyDeg.toFixed(1)}°`, 24, 76);
      ctx.restore();

      // 12. Interactive Hover Cursor Telemetry (if user hovering)
      if (hoveredPoint) {
        ctx.save();
        const { x: hx, y: hy, rKm, altKm, speedKmS, anomalyDeg, inUmbra: hUmbra } = hoveredPoint;

        // Draw crosshair reticle at hover position
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hx - 8, hy);
        ctx.lineTo(hx + 8, hy);
        ctx.moveTo(hx, hy - 8);
        ctx.lineTo(hx, hy + 8);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(hx, hy, 4, 0, Math.PI * 2);
        ctx.stroke();

        // Tooltip box
        const tipW = 165;
        const tipH = 68;
        const tipX = Math.min(width - tipW - 10, Math.max(10, hx + 12));
        const tipY = Math.min(height - tipH - 10, Math.max(10, hy - 35));

        ctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tipX, tipY, tipW, tipH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#facc15';
        ctx.fillText(`TARGET ORBIT INSPECT`, tipX + 8, tipY + 16);

        ctx.font = '8.5px monospace';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(`ALTITUDE: ${altKm.toFixed(1)} km`, tipX + 8, tipY + 30);
        ctx.fillText(`ORBITAL SPEED: ${speedKmS.toFixed(2)} km/s`, tipX + 8, tipY + 43);
        ctx.fillText(`TRUE ANOMALY: ${anomalyDeg.toFixed(1)}°`, tipX + 8, tipY + 56);
        ctx.restore();
      }

      ctx.restore(); // Balance top-level ctx.save() and DPR scaling
      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [
    trueAnomalyDeg,
    altDeltaMeters,
    selectedMethod,
    sailAngle,
    sailArea,
    sailReflectivity,
    tetherLength,
    tetherCurrent,
    featherAngle,
    netThrustMn,
    inSunlight,
    zoomLevel,
    viewMode,
    isExpanded,
    showVectors,
    showPhotons,
    showBField,
    showAltitudeGrid,
    hoveredPoint,
    simTime,
  ]);

  // Interactive mouse move inspector on canvas
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const earthRadius = Math.min(rect.width, rect.height) * 0.22;
    const kmToPx = earthRadius / 6378;

    const dx = x - cx;
    const dy = y - cy;
    const distPx = Math.hypot(dx, dy) / zoomLevel;
    const rKm = distPx / kmToPx;
    const altKm = rKm - 6378;

    // Keplerian circular speed v = sqrt(GM / r)
    const mu = 398600.4418; // km^3 / s^2
    const speedKmS = rKm > 6378 ? Math.sqrt(mu / rKm) : 0;

    let anomalyDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (anomalyDeg < 0) anomalyDeg += 360;

    const inUmbra = dx < 0 && Math.abs(dy) < earthRadius;

    setHoveredPoint({
      x,
      y,
      rKm,
      altKm,
      speedKmS,
      anomalyDeg,
      inUmbra,
    });
  };

  const handleCanvasMouseLeave = () => {
    setHoveredPoint(null);
  };

  const handleOscilloscopeMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const xPct = Math.max(0, Math.min(1, clientX / rect.width));
    const svgX = xPct * 400;

    const idx = Math.round(xPct * (oscilloscopePoints.length - 1));
    const pt = oscilloscopePoints[Math.max(0, Math.min(oscilloscopePoints.length - 1, idx))];
    if (pt) {
      setHoverOscillo({
        svgX,
        offsetSec: Math.round(pt.offsetSec),
        thrustMn: pt.thrustMn,
        altMeters: pt.altitudeMeters,
        inSunlight: pt.inSunlight,
      });
    }
  };

  const handleOscilloscopeMouseLeave = () => {
    setHoverOscillo(null);
  };

  const handleApplyPreset = (preset: ScenarioPreset) => {
    sound.playClick();
    setSelectedMethod(preset.method);
    setSailArea(preset.sailArea);
    setSailAngle(preset.sailAngle);
    setTetherLength(preset.tetherLength);
    setTetherCurrent(preset.tetherCurrent);
    setFeatherAngle(preset.featherAngle);
  };

  const handleResetSim = () => {
    sound.playClick();
    setSimTime(0);
    setDeltaVAccum(0);
    setAltDeltaMeters(0);
    setFuelSavedKg(0);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner & Zero-Fuel Metric HUD */}
      <div className="bg-[#0a1120] border border-[#1e293b] p-5 rounded-3xl flex flex-col gap-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1e293b] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center text-yellow-400 shadow-md">
              <Wind size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-wider font-mono">
                  PROPELLANTLESS TRAJECTORY CORRECTION LAB
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-yellow-400/15 text-yellow-300 border border-yellow-400/30">
                  Isp = ∞ // FUEL-FREE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Continuous non-chemical orbital maneuvers via Solar Radiation Pressure, Electrodynamic Lorentz Force, and Aerodynamic Feathering.
              </p>
            </div>
          </div>

          {/* Quick Simulation Run Controls */}
          <div className="flex items-center gap-2 self-start lg:self-auto font-mono text-xs">
            <button
              onClick={() => {
                sound.playClick();
                setIsRunning(!isRunning);
              }}
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                isRunning
                  ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400/50 shadow-sm'
                  : 'bg-[#0f172a] text-slate-300 border-[#1e293b] hover:bg-[#1e293b]'
              }`}
            >
              {isRunning ? <Pause size={14} /> : <Play size={14} />}
              <span>{isRunning ? 'PAUSE' : 'RUN'}</span>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                setSimSpeed((prev) => (prev === 1 ? 5 : prev === 5 ? 25 : 1));
              }}
              className="px-2.5 py-1.5 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] border border-[#1e293b] text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer font-bold"
              title="Cycle Simulation Speed"
            >
              <FastForward size={14} className="text-yellow-400" />
              <span>{simSpeed}x</span>
            </button>

            <button
              onClick={handleResetSim}
              className="p-1.5 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] border border-[#1e293b] text-slate-400 hover:text-white cursor-pointer"
              title="Reset Simulation Metrics"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* 4-Stat Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
          <div className="bg-[#05070a] p-3.5 rounded-2xl border border-[#1e293b] flex flex-col gap-1">
            <span className="text-[10px] text-slate-400 flex items-center gap-1.5">
              <Sparkles size={12} className="text-yellow-400" />
              ZERO-PROPEL ΔV ACCUMULATED:
            </span>
            <span className="text-lg font-bold text-yellow-400 tracking-wider">
              {deltaVAccum.toFixed(2)} m/s
            </span>
            <span className="text-[9px] text-slate-500">Continuous micro-thrust integral</span>
          </div>

          <div className="bg-[#05070a] p-3.5 rounded-2xl border border-[#1e293b] flex flex-col gap-1">
            <span className="text-[10px] text-slate-400 flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-green-400" />
              HYDRAZINE FUEL CONSERVED:
            </span>
            <span className="text-lg font-bold text-green-400 tracking-wider">
              {fuelSavedKg.toFixed(3)} kg
            </span>
            <span className="text-[9px] text-slate-500">Chemical reserve: 100.0% intact</span>
          </div>

          <div className="bg-[#05070a] p-3.5 rounded-2xl border border-[#1e293b] flex flex-col gap-1">
            <span className="text-[10px] text-slate-400 flex items-center gap-1.5">
              <ArrowUpRight size={12} className="text-cyan-400" />
              ORBITAL SEMI-MAJOR AXIS Δa:
            </span>
            <span className="text-lg font-bold text-cyan-400 tracking-wider">
              +{altDeltaMeters.toFixed(1)} m
            </span>
            <span className="text-[9px] text-slate-500">Apogee/Perigee spiral pumping</span>
          </div>

          <div className="bg-[#05070a] p-3.5 rounded-2xl border border-[#1e293b] flex flex-col gap-1">
            <span className="text-[10px] text-slate-400 flex items-center gap-1.5">
              <Gauge size={12} className="text-yellow-400" />
              INSTANTANEOUS NET THRUST:
            </span>
            <span className={`text-lg font-bold tracking-wider ${netThrustMn >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
              {netThrustMn >= 0 ? '+' : ''}{netThrustMn.toFixed(2)} mN
            </span>
            <span className="text-[9px] text-slate-500">
              {selectedMethod === 'solar_sail' ? 'Photon Radiation' : selectedMethod === 'electrodynamic' ? 'Lorentz I x B' : 'Upper Aero Drag'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Interactive Deck: Controls (Left) and Live Graph/Simulation (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Method Select & Videogame Loading Sliders */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Method Selector Tabs */}
          <div className="bg-[#0a1120] border border-[#1e293b] p-4 rounded-3xl flex flex-col gap-3 shadow-xl">
            <span className="text-[11px] font-mono font-bold text-slate-300 tracking-wider flex items-center gap-2">
              <Layers size={14} className="text-yellow-400" />
              PROPULSION METHODOLOGY
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                onClick={() => {
                  sound.playClick();
                  setSelectedMethod('solar_sail');
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  selectedMethod === 'solar_sail'
                    ? 'bg-yellow-400/15 border-yellow-400/60 text-yellow-300 shadow-md'
                    : 'bg-[#05070a] border-[#1e293b] text-slate-400 hover:text-white hover:bg-[#0f172a]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Sun size={14} className="text-yellow-400" />
                  <span>Solar Sailing</span>
                </div>
                <span className="text-[9.5px] text-slate-400">Solar Photon Momentum</span>
              </button>

              <button
                onClick={() => {
                  sound.playClick();
                  setSelectedMethod('electrodynamic');
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  selectedMethod === 'electrodynamic'
                    ? 'bg-yellow-400/15 border-yellow-400/60 text-yellow-300 shadow-md'
                    : 'bg-[#05070a] border-[#1e293b] text-slate-400 hover:text-white hover:bg-[#0f172a]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Zap size={14} className="text-cyan-400" />
                  <span>EDT Lorentz</span>
                </div>
                <span className="text-[9.5px] text-slate-400">Conductive Tether I x B</span>
              </button>

              <button
                onClick={() => {
                  sound.playClick();
                  setSelectedMethod('aerodrag');
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  selectedMethod === 'aerodrag'
                    ? 'bg-yellow-400/15 border-yellow-400/60 text-yellow-300 shadow-md'
                    : 'bg-[#05070a] border-[#1e293b] text-slate-400 hover:text-white hover:bg-[#0f172a]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Wind size={14} className="text-sky-400" />
                  <span>Aerotrim / Drag</span>
                </div>
                <span className="text-[9.5px] text-slate-400">VLEO Array Feathering</span>
              </button>

              <button
                onClick={() => {
                  sound.playClick();
                  setSelectedMethod('hybrid');
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  selectedMethod === 'hybrid'
                    ? 'bg-yellow-400/15 border-yellow-400/60 text-yellow-300 shadow-md'
                    : 'bg-[#05070a] border-[#1e293b] text-slate-400 hover:text-white hover:bg-[#0f172a]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <Sparkles size={14} className="text-amber-400" />
                  <span>Hybrid Swarm</span>
                </div>
                <span className="text-[9.5px] text-slate-400">Multi-Vector Optimization</span>
              </button>
            </div>
          </div>

          {/* Dynamic Sliders Control Deck */}
          <div className="bg-[#0a1120] border border-[#1e293b] p-5 rounded-3xl flex flex-col gap-4 shadow-xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <span className="font-bold text-slate-200 tracking-wider flex items-center gap-2">
                <Gauge size={14} className="text-yellow-400" />
                CONTROL PARAMETERS
              </span>
              <span className="text-[10px] text-yellow-400/80 bg-yellow-400/10 px-2 py-0.5 rounded-full border border-yellow-400/20">
                LIVE TUNING
              </span>
            </div>

            {/* Slider 1: Solar Sail Incidence Angle */}
            {(selectedMethod === 'solar_sail' || selectedMethod === 'hybrid') && (
              <div className="bg-[#05070a] p-3.5 rounded-2xl border border-[#1e293b] flex flex-col gap-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Sun size={13} className="text-yellow-400" />
                    SAIL SUN PITCH ANGLE θ:
                  </span>
                  <span className="text-yellow-400 font-bold">{sailAngle}° INCIDENCE</span>
                </div>
                <VideogameLoadingSlider
                  id="sail-angle-slider"
                  min={0}
                  max={85}
                  step={1}
                  value={sailAngle}
                  onChange={(val) => setSailAngle(val)}
                  ticks={[
                    { value: 0, label: '0° (Max Normal)' },
                    { value: 35, label: '35° (Optimal Orbit Raise)' },
                    { value: 85, label: '85° (Feathered Edge)' },
                  ]}
                  ariaLabel="Sail Sun Pitch Angle"
                />
              </div>
            )}

            {/* Slider 2: Sail Membrane Area */}
            {(selectedMethod === 'solar_sail' || selectedMethod === 'hybrid') && (
              <div className="bg-[#05070a] p-3.5 rounded-2xl border border-[#1e293b] flex flex-col gap-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Maximize2 size={13} className="text-yellow-400" />
                    GOSSAMER SAIL MEMBRANE AREA:
                  </span>
                  <span className="text-yellow-400 font-bold">{sailArea} m²</span>
                </div>
                <VideogameLoadingSlider
                  id="sail-area-slider"
                  min={10}
                  max={250}
                  step={5}
                  value={sailArea}
                  onChange={(val) => setSailArea(val)}
                  ticks={[
                    { value: 10, label: '10 m² (Deployable)' },
                    { value: 100, label: '100 m² (Standard)' },
                    { value: 250, label: '250 m² (Full Gossamer)' },
                  ]}
                  ariaLabel="Gossamer Sail Membrane Area"
                />
              </div>
            )}

            {/* Slider 3: Tether Length */}
            {(selectedMethod === 'electrodynamic' || selectedMethod === 'hybrid') && (
              <div className="bg-[#05070a] p-3.5 rounded-2xl border border-[#1e293b] flex flex-col gap-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Zap size={13} className="text-yellow-400" />
                    CONDUCTIVE TETHER LENGTH L:
                  </span>
                  <span className="text-yellow-400 font-bold">{tetherLength.toFixed(1)} km</span>
                </div>
                <VideogameLoadingSlider
                  id="tether-length-slider"
                  min={0.5}
                  max={5.0}
                  step={0.1}
                  value={tetherLength}
                  onChange={(val) => setTetherLength(val)}
                  ticks={[
                    { value: 0.5, label: '0.5 km' },
                    { value: 2.5, label: '2.5 km (Nominal)' },
                    { value: 5.0, label: '5.0 km (Deep L-Force)' },
                  ]}
                  ariaLabel="Conductive Tether Length"
                />
              </div>
            )}

            {/* Slider 4: Tether Current & Direction */}
            {(selectedMethod === 'electrodynamic' || selectedMethod === 'hybrid') && (
              <div className="bg-[#05070a] p-3.5 rounded-2xl border border-[#1e293b] flex flex-col gap-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Activity size={13} className="text-yellow-400" />
                    DRIVEN TETHER CURRENT I:
                  </span>
                  <span className="text-yellow-400 font-bold">
                    {tetherCurrent > 0 ? `+${tetherCurrent.toFixed(1)} A (BOOST)` : `${tetherCurrent.toFixed(1)} A (BRAKE)`}
                  </span>
                </div>
                <VideogameLoadingSlider
                  id="tether-current-slider"
                  min={-5.0}
                  max={5.0}
                  step={0.1}
                  value={tetherCurrent}
                  onChange={(val) => setTetherCurrent(val)}
                  ticks={[
                    { value: -5.0, label: '-5A (Max Drag)' },
                    { value: 0.0, label: '0A (Passive)' },
                    { value: 5.0, label: '+5A (Max Boost)' },
                  ]}
                  ariaLabel="Driven Tether Current"
                />
              </div>
            )}

            {/* Slider 5: Aerodynamic Feathering Angle */}
            {(selectedMethod === 'aerodrag' || selectedMethod === 'hybrid') && (
              <div className="bg-[#05070a] p-3.5 rounded-2xl border border-[#1e293b] flex flex-col gap-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Wind size={13} className="text-yellow-400" />
                    ARRAY FEATHER ANGLE α:
                  </span>
                  <span className="text-yellow-400 font-bold">{featherAngle}°</span>
                </div>
                <VideogameLoadingSlider
                  id="feather-angle-slider"
                  min={0}
                  max={90}
                  step={1}
                  value={featherAngle}
                  onChange={(val) => setFeatherAngle(val)}
                  ticks={[
                    { value: 0, label: '0° (Edge-On Min Drag)' },
                    { value: 45, label: '45° (Trim)' },
                    { value: 90, label: '90° (Ram-Face Max Drag)' },
                  ]}
                  ariaLabel="Array Feather Angle"
                />
              </div>
            )}

            {/* Toggle: Autonomous Heliotropic Steering */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#05070a] border border-[#1e293b]">
              <div className="flex flex-col">
                <span className="text-slate-300 font-bold flex items-center gap-1.5">
                  <Compass size={13} className="text-yellow-400" />
                  AUTONOMOUS ECLIPSE FEATHERING:
                </span>
                <span className="text-[10px] text-slate-500">Auto-aligns sail during Earth shadow passes</span>
              </div>
              <button
                onClick={() => {
                  sound.playClick();
                  setAutoSteering(!autoSteering);
                }}
                className={`px-3 py-1 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                  autoSteering
                    ? 'bg-green-500/20 text-green-300 border-green-500/40'
                    : 'bg-[#0f172a] text-slate-400 border-[#1e293b]'
                }`}
              >
                {autoSteering ? 'ENGAGED' : 'MANUAL'}
              </button>
            </div>
          </div>

          {/* Theoretical Physics Equations Callout */}
          <div className="bg-[#05070a] border border-[#1e293b] p-4 rounded-3xl flex flex-col gap-2 font-mono text-[11px]">
            <div className="flex items-center gap-1.5 text-yellow-400 font-bold">
              <Info size={13} />
              <span>ORBITAL PHYSICS EQUATIONS</span>
            </div>
            <div className="text-slate-400 flex flex-col gap-1.5 text-[10px] bg-[#020408] p-2.5 rounded-xl border border-[#1e293b]">
              <div>
                <span className="text-slate-200 font-bold">Solar Sail Force: </span>
                <span className="text-yellow-300">F_SRP = (1 + η) · (Φ / c) · A · cos²(θ)</span>
              </div>
              <div>
                <span className="text-slate-200 font-bold">Lorentz Force: </span>
                <span className="text-cyan-300">F_EDT = I · (L × B_geomag)</span>
              </div>
              <div>
                <span className="text-slate-200 font-bold">Aero Drag Force: </span>
                <span className="text-sky-300">F_D = 0.5 · ρ(h) · v² · C_D · A_eff</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Live Simulation Graph & Trajectory Canvas */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Main Visualizer Card */}
          <div className="bg-[#0a1120] border border-[#1e293b] p-5 rounded-3xl flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <div className="flex items-center gap-2">
                <Orbit size={16} className="text-yellow-400" />
                <span className="font-mono font-bold text-sm text-slate-200">
                  LIVE TRAJECTORY SIMULATION
                </span>
              </div>

              {/* View Switcher Tabs */}
              <div className="flex items-center gap-1.5 bg-[#05070a] p-1 rounded-2xl border border-[#1e293b] font-mono text-xs">
                <button
                  onClick={() => {
                    sound.playClick();
                    setActiveTab('orbital_canvas');
                  }}
                  className={`px-3 py-1 rounded-xl transition-all cursor-pointer font-bold ${
                    activeTab === 'orbital_canvas'
                      ? 'bg-yellow-400 text-black shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ORBITAL MECHANICS
                </button>
                <button
                  onClick={() => {
                    sound.playClick();
                    setActiveTab('oscilloscope');
                  }}
                  className={`px-3 py-1 rounded-xl transition-all cursor-pointer font-bold ${
                    activeTab === 'oscilloscope'
                      ? 'bg-yellow-400 text-black shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  LIVE OSCILLOSCOPE
                </button>
              </div>
            </div>

            {/* Render Tab 1: Orbital Vector Mechanics Canvas */}
            {activeTab === 'orbital_canvas' && (
              <div className="flex flex-col gap-3">
                {/* Visual Clarity Control Deck */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#05070a] p-2.5 rounded-2xl border border-[#1e293b] font-mono text-xs">
                  {/* Left: View Mode & Zoom */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* View mode toggle */}
                    <div className="flex items-center gap-1 bg-[#0a1120] p-1 rounded-xl border border-[#1e293b]">
                      <button
                        onClick={() => {
                          sound.playClick();
                          setViewMode('geocentric');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                          viewMode === 'geocentric'
                            ? 'bg-yellow-400 text-black shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        GEOCENTRIC ORBIT
                      </button>
                      <button
                        onClick={() => {
                          sound.playClick();
                          setViewMode('chase');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                          viewMode === 'chase'
                            ? 'bg-yellow-400 text-black shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        CHASE / SATELLITE
                      </button>
                    </div>

                    {/* Zoom controls */}
                    <div className="flex items-center gap-1 bg-[#0a1120] px-2 py-1 rounded-xl border border-[#1e293b]">
                      <button
                        onClick={() => {
                          sound.playClick();
                          setZoomLevel((z) => Math.max(0.7, +(z - 0.2).toFixed(1)));
                        }}
                        className="p-1 text-slate-400 hover:text-yellow-400 cursor-pointer rounded"
                        title="Zoom Out"
                      >
                        <ZoomOut size={13} />
                      </button>
                      <span className="text-[10.5px] font-bold text-yellow-400 min-w-[34px] text-center">
                        {zoomLevel.toFixed(1)}x
                      </span>
                      <button
                        onClick={() => {
                          sound.playClick();
                          setZoomLevel((z) => Math.min(3.5, +(z + 0.2).toFixed(1)));
                        }}
                        className="p-1 text-slate-400 hover:text-yellow-400 cursor-pointer rounded"
                        title="Zoom In"
                      >
                        <ZoomIn size={13} />
                      </button>
                      <button
                        onClick={() => {
                          sound.playClick();
                          setZoomLevel(1.0);
                        }}
                        className="text-[9.5px] text-slate-500 hover:text-slate-200 px-1 ml-1 cursor-pointer"
                        title="Reset Zoom"
                      >
                        1.0x
                      </button>
                    </div>

                    {/* Canvas Height toggle */}
                    <button
                      onClick={() => {
                        sound.playClick();
                        setIsExpanded(!isExpanded);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#0a1120] border border-[#1e293b] text-slate-300 hover:text-yellow-400 transition-all cursor-pointer text-[10.5px]"
                      title="Toggle Canvas Size"
                    >
                      {isExpanded ? (
                        <>
                          <Minimize2 size={13} />
                          <span>COMPACT</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 size={13} />
                          <span>EXPAND</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Right: Layer Clarity Toggles */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <button
                      onClick={() => {
                        sound.playClick();
                        setShowVectors(!showVectors);
                      }}
                      className={`px-2 py-1 rounded-lg border transition-all cursor-pointer font-bold ${
                        showVectors
                          ? 'bg-yellow-400/20 border-yellow-400/60 text-yellow-300'
                          : 'bg-[#0a1120] border-[#1e293b] text-slate-500'
                      }`}
                    >
                      VECTORS
                    </button>
                    <button
                      onClick={() => {
                        sound.playClick();
                        setShowPhotons(!showPhotons);
                      }}
                      className={`px-2 py-1 rounded-lg border transition-all cursor-pointer font-bold ${
                        showPhotons
                          ? 'bg-yellow-400/20 border-yellow-400/60 text-yellow-300'
                          : 'bg-[#0a1120] border-[#1e293b] text-slate-500'
                      }`}
                    >
                      PHOTONS
                    </button>
                    <button
                      onClick={() => {
                        sound.playClick();
                        setShowBField(!showBField);
                      }}
                      className={`px-2 py-1 rounded-lg border transition-all cursor-pointer font-bold ${
                        showBField
                          ? 'bg-purple-400/20 border-purple-400/60 text-purple-300'
                          : 'bg-[#0a1120] border-[#1e293b] text-slate-500'
                      }`}
                    >
                      B-FIELD
                    </button>
                    <button
                      onClick={() => {
                        sound.playClick();
                        setShowAltitudeGrid(!showAltitudeGrid);
                      }}
                      className={`px-2 py-1 rounded-lg border transition-all cursor-pointer font-bold ${
                        showAltitudeGrid
                          ? 'bg-cyan-400/20 border-cyan-400/60 text-cyan-300'
                          : 'bg-[#0a1120] border-[#1e293b] text-slate-500'
                      }`}
                    >
                      ALT RINGS
                    </button>
                    <button
                      onClick={() => {
                        sound.playClick();
                        setShowAttitudeHUD(!showAttitudeHUD);
                      }}
                      className={`px-2 py-1 rounded-lg border transition-all cursor-pointer font-bold ${
                        showAttitudeHUD
                          ? 'bg-yellow-400/20 border-yellow-400/60 text-yellow-300'
                          : 'bg-[#0a1120] border-[#1e293b] text-slate-500'
                      }`}
                    >
                      ATTITUDE HUD
                    </button>
                  </div>
                </div>

                {/* Canvas Simulation Stage */}
                <div
                  ref={containerRef}
                  className={`relative w-full ${
                    isExpanded ? 'h-[580px]' : 'h-[440px]'
                  } bg-[#020408] rounded-2xl overflow-hidden border border-[#1e293b] transition-all duration-300 shadow-inner`}
                >
                  <canvas
                    ref={canvasRef}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseLeave={handleCanvasMouseLeave}
                    className="w-full h-full block cursor-crosshair"
                  />

                  {/* Picture-in-Picture: Subsystem Attitude HUD (Bottom-Left) */}
                  {showAttitudeHUD && (
                    <div className="absolute bottom-3 left-3 bg-[#05070a]/90 backdrop-blur-md p-3 rounded-xl border border-[#1e293b] font-mono text-[10px] flex flex-col gap-1.5 text-slate-300 shadow-xl max-w-[240px]">
                      <div className="flex items-center justify-between border-b border-[#1e293b] pb-1.5">
                        <span className="font-bold text-yellow-400 flex items-center gap-1">
                          <Orbit size={12} />
                          SPACECRAFT ATTITUDE
                        </span>
                        <span className="text-[9px] text-slate-500">ORION</span>
                      </div>

                      <div className="flex flex-col gap-1 text-[9.5px]">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Sail Sun Pitch θ:</span>
                          <span className="text-yellow-300 font-bold">{sailAngle}°</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Tether Length / Current:</span>
                          <span className="text-cyan-300 font-bold">
                            {tetherLength.toFixed(1)} km / {tetherCurrent > 0 ? '+' : ''}{tetherCurrent.toFixed(1)}A
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Feather Angle α:</span>
                          <span className="text-sky-300 font-bold">{featherAngle}°</span>
                        </div>
                      </div>

                      <div className="border-t border-[#1e293b] pt-1.5 flex flex-col gap-1 text-[9px]">
                        <div className="flex justify-between">
                          <span className="text-slate-400">F_SRP (Photon):</span>
                          <span className="text-yellow-400">{srpThrustMn.toFixed(2)} mN</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">F_EDT (Lorentz):</span>
                          <span className="text-cyan-400">
                            {isEdtBoosting ? '+' : '-'}{edtThrustMn.toFixed(2)} mN
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">F_Drag (Aero):</span>
                          <span className="text-sky-400">-{aeroDragMn.toFixed(2)} mN</span>
                        </div>
                        <div className="flex justify-between border-t border-[#1e293b]/60 pt-0.5 font-bold">
                          <span className="text-white">Net Non-Chemical Thrust:</span>
                          <span className="text-yellow-400">
                            {netThrustMn >= 0 ? '+' : ''}{netThrustMn.toFixed(2)} mN
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tactical Legend (Bottom-Right) */}
                  <div className="absolute bottom-3 right-3 bg-[#05070a]/90 backdrop-blur-md p-2.5 rounded-xl border border-[#1e293b] font-mono text-[9.5px] flex flex-col gap-1 text-slate-300 shadow-xl">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-1 bg-yellow-400 inline-block shadow-[0_0_6px_#facc15] rounded-full" />
                      <span className="font-bold text-yellow-300">Propellantless Spiral (+{altDeltaMeters.toFixed(1)}m)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-0.5 bg-cyan-400 inline-block opacity-75" />
                      <span>Unperturbed Reference LEO (550 km)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-0.5 bg-orange-400 inline-block opacity-75" />
                      <span>Kármán Boundary (100 km)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                      <span>Geomagnetic Dipole Loop (B-Field)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                      <span>Velocity Vector v = 7.66 km/s</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Render Tab 2: Real-time SVG Oscilloscope Chart */}
            {activeTab === 'oscilloscope' && (
              <div className="w-full min-h-[400px] bg-[#020408] rounded-2xl p-4 flex flex-col justify-between gap-3 border border-[#1e293b] font-mono shadow-inner">
                {/* Channel Status Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-[#1e293b]/70 pb-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-[#0a1120] px-2.5 py-1 rounded-lg border border-[#1e293b]">
                      <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse inline-block shadow-[0_0_6px_#facc15]" />
                      <span className="text-yellow-400 font-bold text-[11px]">
                        CH1 (THRUST): {netThrustMn >= 0 ? '+' : ''}{netThrustMn.toFixed(2)} mN
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-[#0a1120] px-2.5 py-1 rounded-lg border border-[#1e293b]">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                      <span className="text-cyan-400 font-bold text-[11px]">
                        CH2 (ALTITUDE): +{altDeltaMeters.toFixed(1)} m
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-[#0a1120] px-2.5 py-1 rounded-lg border border-[#1e293b]">
                      <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                      <span className="text-green-400 font-bold text-[11px]">
                        CH3 (PROPELLANT): 0.000 g
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 hidden sm:inline">600s SLIDING WINDOW</span>
                    <span
                      className={`text-[9.5px] px-2 py-0.5 rounded-full font-bold border ${
                        isRunning
                          ? 'bg-yellow-400/10 text-yellow-300 border-yellow-400/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {isRunning ? 'SWEEPING' : 'HOLD (PAUSED)'}
                    </span>
                  </div>
                </div>

                {/* Sub-header Inspection / Marker Banner */}
                <div className="h-6 flex items-center justify-between text-[10.5px] px-2 bg-[#05070a] rounded-lg border border-[#1e293b]">
                  {hoverOscillo ? (
                    <div className="w-full flex items-center justify-between text-yellow-300">
                      <span className="font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
                        MARKER T {hoverOscillo.offsetSec >= 0 ? '+' : ''}{hoverOscillo.offsetSec}s
                      </span>
                      <span>
                        F_net: <strong className="text-white">{hoverOscillo.thrustMn >= 0 ? '+' : ''}{hoverOscillo.thrustMn.toFixed(2)} mN</strong>
                      </span>
                      <span>
                        Δh: <strong className="text-cyan-300">+{hoverOscillo.altMeters.toFixed(1)} m</strong>
                      </span>
                      <span className={hoverOscillo.inSunlight ? 'text-yellow-400' : 'text-purple-400'}>
                        {hoverOscillo.inSunlight ? '☀️ SUNLIT ARC' : '🌑 EARTH UMBRA (F_SRP = 0)'}
                      </span>
                    </div>
                  ) : (
                    <div className="w-full flex items-center justify-between text-slate-400 text-[10px]">
                      <span>INTERACTIVE TRACE — HOVER TO PROBE TIME SAMPLES</span>
                      <span className="text-yellow-400/80">
                        SLIDERS MODULATE LIVE WAVEFORM INSTANTLY
                      </span>
                    </div>
                  )}
                </div>

                {/* SVG Polyline Live Graph with Calibration Graticule */}
                <div className="relative w-full h-64 bg-[#05070a] rounded-xl border border-[#1e293b] overflow-hidden p-1">
                  <svg
                    className="w-full h-full overflow-visible cursor-crosshair select-none"
                    viewBox="0 0 400 200"
                    preserveAspectRatio="none"
                    onMouseMove={handleOscilloscopeMouseMove}
                    onMouseLeave={handleOscilloscopeMouseLeave}
                  >
                    {/* Background Umbra Eclipse Pass Shading */}
                    {oscilloscopePoints.map((pt, idx) => {
                      if (pt.inSunlight) return null;
                      const colW = 400 / (oscilloscopePoints.length - 1);
                      const x = (idx / (oscilloscopePoints.length - 1)) * 400 - colW / 2;
                      return (
                        <rect
                          key={`umbra-${idx}`}
                          x={Math.max(0, x)}
                          y="0"
                          width={colW + 0.5}
                          height="200"
                          fill="#312e81"
                          opacity="0.25"
                        />
                      );
                    })}

                    {/* Graticule Grid Lines & Calibration Marks */}
                    <line x1="38" y1="20" x2="390" y2="20" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,2" />
                    <text x="6" y="23" fill="#64748b" fontSize="7.5" fontFamily="monospace">+50 mN</text>

                    <line x1="38" y1="60" x2="390" y2="60" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,2" />
                    <text x="6" y="63" fill="#64748b" fontSize="7.5" fontFamily="monospace">+25 mN</text>

                    {/* Reference Zero Null Line */}
                    <line x1="38" y1="100" x2="390" y2="100" stroke="#475569" strokeWidth="1.2" strokeDasharray="3,3" />
                    <text x="6" y="103" fill="#e2e8f0" fontSize="8" fontWeight="bold" fontFamily="monospace">0 mN</text>

                    <line x1="38" y1="140" x2="390" y2="140" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,2" />
                    <text x="6" y="143" fill="#64748b" fontSize="7.5" fontFamily="monospace">-25 mN</text>

                    <line x1="38" y1="180" x2="390" y2="180" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,2" />
                    <text x="6" y="183" fill="#64748b" fontSize="7.5" fontFamily="monospace">-50 mN</text>

                    {/* Right-Side Altitude Scale Marks */}
                    <text x="395" y="23" fill="#38bdf8" fontSize="7" fontFamily="monospace" textAnchor="end">+400m</text>
                    <text x="395" y="103" fill="#38bdf8" fontSize="7" fontFamily="monospace" textAnchor="end">+200m</text>
                    <text x="395" y="183" fill="#38bdf8" fontSize="7" fontFamily="monospace" textAnchor="end">0m</text>

                    {/* Chemical Fuel spent line (strictly flat 0 at bottom) */}
                    <line x1="38" y1="195" x2="400" y2="195" stroke="#22c55e" strokeWidth="2" />

                    {/* Altitude Offset Polyline (Cyan dashed) */}
                    <polyline
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                      strokeDasharray="4,2"
                      opacity="0.8"
                      points={oscilloscopePoints
                        .map((pt, idx) => {
                          const x = (idx / (oscilloscopePoints.length - 1)) * 400;
                          const y = Math.max(15, Math.min(185, 180 - (pt.altitudeMeters / 400) * 150));
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join(' ')}
                    />

                    {/* Instantaneous Net Micro-Thrust Polyline (Yellow) */}
                    <polyline
                      fill="none"
                      stroke="#facc15"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]"
                      points={oscilloscopePoints
                        .map((pt, idx) => {
                          const x = (idx / (oscilloscopePoints.length - 1)) * 400;
                          // Scale thrust (-50mN to +50mN) to Y (180 to 20), 0mN at y=100
                          const y = Math.max(12, Math.min(188, 100 - (pt.thrustMn / 50) * 80));
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join(' ')}
                    />

                    {/* Live Probe Needle at T - 0s (Rightmost Point) */}
                    <g>
                      <circle
                        cx="400"
                        cy={Math.max(12, Math.min(188, 100 - (netThrustMn / 50) * 80))}
                        r="4.5"
                        fill="#facc15"
                        className="animate-pulse"
                      />
                      <circle
                        cx="400"
                        cy={Math.max(12, Math.min(188, 100 - (netThrustMn / 50) * 80))}
                        r="9"
                        fill="none"
                        stroke="#facc15"
                        strokeWidth="1.2"
                        opacity="0.6"
                      />
                    </g>

                    {/* Interactive Measurement Reticle when Hovered */}
                    {hoverOscillo && (
                      <g>
                        <line
                          x1={hoverOscillo.svgX}
                          y1="0"
                          x2={hoverOscillo.svgX}
                          y2="200"
                          stroke="#facc15"
                          strokeWidth="1.2"
                          strokeDasharray="3,2"
                          opacity="0.8"
                        />
                        <circle
                          cx={hoverOscillo.svgX}
                          cy={Math.max(12, Math.min(188, 100 - (hoverOscillo.thrustMn / 50) * 80))}
                          r="4"
                          fill="#facc15"
                          stroke="#020408"
                          strokeWidth="1.5"
                        />
                      </g>
                    )}
                  </svg>
                </div>

                {/* Horizontal Time Axis Scale */}
                <div className="flex justify-between text-[10px] text-slate-500 px-1 border-t border-[#1e293b]/60 pt-1.5">
                  <span>T - 600s</span>
                  <span>T - 450s</span>
                  <span>T - 300s</span>
                  <span>T - 150s</span>
                  <span className="text-yellow-400 font-bold">
                    T - 0s (LIVE NOW: {netThrustMn >= 0 ? '+' : ''}{netThrustMn.toFixed(2)} mN)
                  </span>
                </div>
              </div>
            )}

            {/* Bottom Trajectory Telemetry Readout */}
            <div className="grid grid-cols-3 gap-3 font-mono text-xs">
              <div className="bg-[#05070a] p-3 rounded-2xl border border-[#1e293b] flex flex-col">
                <span className="text-[10px] text-slate-400">BALLISTIC COEFF B:</span>
                <span className="text-slate-200 font-bold">142.8 kg/m²</span>
              </div>
              <div className="bg-[#05070a] p-3 rounded-2xl border border-[#1e293b] flex flex-col">
                <span className="text-[10px] text-slate-400">SOLAR BETA ANGLE:</span>
                <span className="text-yellow-400 font-bold">+28.4° (SUNLIT)</span>
              </div>
              <div className="bg-[#05070a] p-3 rounded-2xl border border-[#1e293b] flex flex-col">
                <span className="text-[10px] text-slate-400">SPECIFIC IMPULSE Isp:</span>
                <span className="text-green-400 font-bold">INFINITE (∞ s)</span>
              </div>
            </div>
          </div>

          {/* 4 Presets Bar for 1-Click Flight Demonstrations */}
          <div className="bg-[#0a1120] border border-[#1e293b] p-5 rounded-3xl flex flex-col gap-3 shadow-xl font-mono text-xs">
            <span className="font-bold text-slate-200 tracking-wider flex items-center gap-2">
              <Sparkles size={14} className="text-yellow-400" />
              MISSION SIMULATION PRESETS
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset)}
                  className="bg-[#05070a] hover:bg-[#0f172a] border border-[#1e293b] hover:border-yellow-400/50 p-3.5 rounded-2xl text-left flex flex-col gap-1.5 transition-all cursor-pointer group shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-yellow-400 font-bold group-hover:text-yellow-300">
                      {preset.name}
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-300 border border-yellow-400/20">
                      APPLY
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-2">
                    {preset.description}
                  </p>
                  <div className="text-[9.5px] text-cyan-400 font-semibold pt-1 border-t border-[#1e293b]">
                    Target: {preset.targetOutcome}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
