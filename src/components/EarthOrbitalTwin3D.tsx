import React, { useRef, useEffect, useState } from 'react';
import { EARTH_CONTINENTS } from '../utils/earthCoastlines';
import {
  getGMST,
  ORBIT_INCLINATION_RAD,
  SolarBetaData,
  PHYSICAL_ORBITAL_VELOCITY_KM_S,
  EARTH_TO_ORBIT_ROTATION_RATIO,
  CALIBRATED_ORBITAL_SPEED_RAD_S,
} from '../utils/orbitalCalculations';
import {
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Sun,
  Play,
  Pause,
  Compass,
  Radio,
} from 'lucide-react';
import { sound } from '../utils/audio';

interface EarthOrbitalTwin3DProps {
  currentDate: Date;
  onDateChange?: (date: Date) => void;
  speedMultiplier?: number;
  onSelectSubsystem?: (subsystem: string) => void;
  solarBetaData: SolarBetaData;
  activeAnomalyPresetId?: string | null;
  activeAnomalySeverity?: number;
}

type CameraMode = 'orbit-overview' | 'chase-sat' | 'solar-beta' | 'polar-top';

export const EarthOrbitalTwin3D: React.FC<EarthOrbitalTwin3DProps> = ({
  currentDate,
  solarBetaData,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 3D Camera Orientation (Euler angles in radians)
  const [yaw, setYaw] = useState<number>(0.65); // azimuth
  const [pitch, setPitch] = useState<number>(-0.42); // elevation
  const [zoom, setZoom] = useState<number>(1.0);
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit-overview');

  // Animation playback
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [animSpeed, setAnimSpeed] = useState<number>(1); // calibrated 1x orbital velocity multiplier

  // Toggles for visual HUD layers
  const [showContinents, setShowContinents] = useState<boolean>(true);
  const [showOrbitRings, setShowOrbitRings] = useState<boolean>(true);
  const [showSunVector, setShowSunVector] = useState<boolean>(true);
  const [showTerminator, setShowTerminator] = useState<boolean>(true);
  const [showNadirBeam, setShowNadirBeam] = useState<boolean>(true);

  // Drag interaction state
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Simulation time ref for smooth 60fps animation
  const animTimeRef = useRef<number>(0);
  const requestRef = useRef<number | null>(null);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    setYaw((prev) => (prev + dx * 0.008) % (2 * Math.PI));
    setPitch((prev) => Math.max(-1.45, Math.min(1.45, prev - dy * 0.008)));
    if (cameraMode !== 'orbit-overview') {
      setCameraMode('orbit-overview');
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.max(0.5, Math.min(2.4, prev - e.deltaY * 0.0015)));
  };

  // Reset View
  const handleResetCamera = (mode: CameraMode = 'orbit-overview') => {
    sound.playClick();
    setCameraMode(mode);
    setZoom(1.0);
    if (mode === 'orbit-overview') {
      setYaw(0.65);
      setPitch(-0.42);
    } else if (mode === 'solar-beta') {
      // Look from the Sun's viewpoint towards Earth
      const sunVec = solarBetaData.sunVectorECI;
      const sunYaw = Math.atan2(sunVec[1], sunVec[0]);
      const sunPitch = Math.asin(sunVec[2]);
      setYaw(sunYaw);
      setPitch(sunPitch);
      setZoom(1.15);
    } else if (mode === 'polar-top') {
      setYaw(0);
      setPitch(-1.42);
      setZoom(0.95);
    } else if (mode === 'chase-sat') {
      setZoom(1.45);
    }
  };

  // 3D Rendering Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTimestamp = performance.now();

    const render = (now: number) => {
      const dt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      if (isPlaying) {
        animTimeRef.current += dt * (CALIBRATED_ORBITAL_SPEED_RAD_S * animSpeed);
      }

      // Handle canvas high-DPI scaling
      const rawWidth = canvas.clientWidth || 0;
      const rawHeight = canvas.clientHeight || 0;
      const width = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : 600;
      const height = Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : 460;

      // Skip frame if container has collapsed to zero during layout transitions
      if (width < 20 || height < 20) {
        requestRef.current = requestAnimationFrame(render);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      ctx.resetTransform();
      ctx.scale(dpr, dpr);

      // Safe helper for Canvas Radial Gradients to guarantee finite numbers and valid radii
      const safeRadialGradient = (
        x0: number,
        y0: number,
        r0: number,
        x1: number,
        y1: number,
        r1: number
      ): CanvasGradient | null => {
        const sx0 = Number.isFinite(x0) ? x0 : cx;
        const sy0 = Number.isFinite(y0) ? y0 : cy;
        const sr0 = Number.isFinite(r0) && r0 >= 0 ? r0 : 0;
        const sx1 = Number.isFinite(x1) ? x1 : cx;
        const sy1 = Number.isFinite(y1) ? y1 : cy;
        const sr1 = Number.isFinite(r1) && r1 >= 0 ? r1 : sr0 + 1;
        try {
          return ctx.createRadialGradient(sx0, sy0, sr0, sx1, sy1, sr1);
        } catch {
          return null;
        }
      };

      // Clear dark aerospace background
      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, width, height);

      // Draw subtle starry background / grid
      ctx.save();
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();

      const cx = width / 2;
      const cy = height / 2;
      const safeZoom = Number.isFinite(zoom) && zoom > 0.05 ? zoom : 1.0;
      const earthRadius = Math.max(20, Math.min(width, height) * 0.23 * safeZoom);
      const orbitRadius = earthRadius * 1.34; // Proportional LEO altitude

      // Current astronomical state
      const gmst = getGMST(currentDate) + (isPlaying ? animTimeRef.current * EARTH_TO_ORBIT_ROTATION_RATIO : 0);
      const rawSunVec = solarBetaData?.sunVectorECI || [1, 0, 0];
      const sunVec: [number, number, number] = [
        Number.isFinite(rawSunVec[0]) ? rawSunVec[0] : 1,
        Number.isFinite(rawSunVec[1]) ? rawSunVec[1] : 0,
        Number.isFinite(rawSunVec[2]) ? rawSunVec[2] : 0,
      ];
      const raanRad = ((Number.isFinite(solarBetaData?.raanDeg) ? solarBetaData.raanDeg : 0) * Math.PI) / 180;
      const inclination = ORBIT_INCLINATION_RAD;

      // Satellite true anomaly along orbit (0 to 2*PI)
      const u = (animTimeRef.current % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

      const pOx = Math.cos(u);
      const pOy = Math.sin(u);
      const satEciX =
        orbitRadius * (pOx * Math.cos(raanRad) - pOy * Math.sin(raanRad) * Math.cos(inclination));
      const satEciY =
        orbitRadius * (pOx * Math.sin(raanRad) + pOy * Math.cos(raanRad) * Math.cos(inclination));
      const satEciZ = orbitRadius * (pOy * Math.sin(inclination));

      // Chase camera tracking
      let activeYaw = Number.isFinite(yaw) ? yaw : 0.65;
      let activePitch = Number.isFinite(pitch) ? pitch : -0.42;
      if (cameraMode === 'chase-sat') {
        const satAngle = Math.atan2(satEciY, satEciX);
        activeYaw = Number.isFinite(satAngle) ? satAngle - 0.4 : 0.65;
        const normZ = satEciZ / Math.max(orbitRadius, 1);
        activePitch = Math.max(-1.1, Math.min(1.1, -(Number.isFinite(normZ) ? normZ : 0) * 0.5 - 0.2));
      }

      // Camera Transformation Matrix: rotate around Y (yaw) then X (pitch)
      const cosY = Math.cos(activeYaw);
      const sinY = Math.sin(activeYaw);
      const cosP = Math.cos(activePitch);
      const sinP = Math.sin(activePitch);

      // Transform ECI vector [x, y, z] to View/Screen coords
      const project = (x: number, y: number, z: number): { sx: number; sy: number; depth: number } => {
        const safeX = Number.isFinite(x) ? x : 0;
        const safeY = Number.isFinite(y) ? y : 0;
        const safeZ = Number.isFinite(z) ? z : 0;

        const x1 = safeX * cosY - safeY * sinY;
        const y1 = safeX * sinY + safeY * cosY;
        const z1 = safeZ;

        const x2 = x1;
        const y2 = y1 * cosP - z1 * sinP;
        const z2 = y1 * sinP + z1 * cosP;

        const denom = Math.max(earthRadius * 12, 100);
        let persp = 1 + (y2 / denom);
        if (!Number.isFinite(persp) || persp <= 0.05) {
          persp = 0.05;
        }

        const rawSx = cx + x2 * persp;
        const rawSy = cy - z2 * persp;

        return {
          sx: Number.isFinite(rawSx) ? rawSx : cx,
          sy: Number.isFinite(rawSy) ? rawSy : cy,
          depth: Number.isFinite(y2) ? y2 : 0,
        };
      };

      // Project Sun Vector in view coords
      const sunProj = project(sunVec[0] * 300, sunVec[1] * 300, sunVec[2] * 300);

      // 1. Draw Earth Atmospheric Rim Glow (Behind Earth)
      ctx.save();
      const atmoGrad = safeRadialGradient(
        cx,
        cy,
        Math.max(0, earthRadius * 0.85),
        cx,
        cy,
        Math.max(1, earthRadius * 1.15)
      );
      if (atmoGrad) {
        atmoGrad.addColorStop(0, 'rgba(34, 211, 238, 0.25)');
        atmoGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.08)');
        atmoGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
        ctx.fillStyle = atmoGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, earthRadius * 1.15, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 2. Draw Back-Half of Orbital Ring (Behind Earth, depth < 0)
      if (showOrbitRings) {
        ctx.save();
        const numSegments = 90;
        for (let i = 0; i < numSegments; i++) {
          const u0 = (i / numSegments) * Math.PI * 2;
          const u1 = ((i + 1) / numSegments) * Math.PI * 2;

          const p0x =
            orbitRadius * (Math.cos(u0) * Math.cos(raanRad) - Math.sin(u0) * Math.sin(raanRad) * Math.cos(inclination));
          const p0y =
            orbitRadius * (Math.cos(u0) * Math.sin(raanRad) + Math.sin(u0) * Math.cos(raanRad) * Math.cos(inclination));
          const p0z = orbitRadius * (Math.sin(u0) * Math.sin(inclination));

          const p1x =
            orbitRadius * (Math.cos(u1) * Math.cos(raanRad) - Math.sin(u1) * Math.sin(raanRad) * Math.cos(inclination));
          const p1y =
            orbitRadius * (Math.cos(u1) * Math.sin(raanRad) + Math.sin(u1) * Math.cos(raanRad) * Math.cos(inclination));
          const p1z = orbitRadius * (Math.sin(u1) * Math.sin(inclination));

          const pt0 = project(p0x, p0y, p0z);
          const pt1 = project(p1x, p1y, p1z);

          if (pt0.depth < 0 && pt1.depth < 0) {
            const dotSun = (p0x * sunVec[0] + p0y * sunVec[1] + p0z * sunVec[2]) / orbitRadius;
            const inShadow = dotSun < -0.15 && Math.abs(solarBetaData.betaDeg) < solarBetaData.criticalBetaDeg;

            ctx.beginPath();
            ctx.moveTo(pt0.sx, pt0.sy);
            ctx.lineTo(pt1.sx, pt1.sy);
            ctx.strokeStyle = inShadow ? 'rgba(244, 63, 94, 0.45)' : 'rgba(34, 211, 238, 0.35)';
            ctx.lineWidth = inShadow ? 1.5 : 1.2;
            if (inShadow) ctx.setLineDash([4, 4]);
            else ctx.setLineDash([]);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // 3. Draw Earth Wireframe Sphere
      ctx.save();
      const sunProjSx = Number.isFinite(sunProj.sx) ? sunProj.sx : cx;
      const sunProjSy = Number.isFinite(sunProj.sy) ? sunProj.sy : cy;
      const globeGrad = safeRadialGradient(
        cx + (sunProjSx - cx) * 0.25,
        cy + (sunProjSy - cy) * 0.25,
        Math.max(0, earthRadius * 0.2),
        cx,
        cy,
        Math.max(1, earthRadius)
      );
      if (globeGrad) {
        globeGrad.addColorStop(0, '#0b192e');
        globeGrad.addColorStop(0.7, '#07101e');
        globeGrad.addColorStop(1, '#020610');
        ctx.fillStyle = globeGrad;
      } else {
        ctx.fillStyle = '#0b192e';
      }
      ctx.beginPath();
      ctx.arc(cx, cy, earthRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      // Clip continents and grid inside Earth disk
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, earthRadius, 0, Math.PI * 2);
      ctx.clip();

      // 3a. Latitude Rings
      ctx.save();
      const parallels = [-66.5, -45, -23.44, 0, 23.44, 45, 66.5];
      parallels.forEach((latDeg) => {
        const latRad = (latDeg * Math.PI) / 180;
        const rRing = earthRadius * Math.cos(latRad);
        const zRing = earthRadius * Math.sin(latRad);

        ctx.beginPath();
        const steps = 64;
        let started = false;
        for (let i = 0; i <= steps; i++) {
          const lon = (i / steps) * Math.PI * 2 + gmst;
          const gx = rRing * Math.cos(lon);
          const gy = rRing * Math.sin(lon);
          const gz = zRing;
          const p = project(gx, gy, gz);

          if (p.depth >= -earthRadius * 0.1) {
            if (!started) {
              ctx.moveTo(p.sx, p.sy);
              started = true;
            } else {
              ctx.lineTo(p.sx, p.sy);
            }
          } else {
            started = false;
          }
        }
        ctx.strokeStyle = latDeg === 0 ? 'rgba(34, 211, 238, 0.45)' : 'rgba(56, 189, 248, 0.18)';
        ctx.lineWidth = latDeg === 0 ? 1.5 : 0.8;
        ctx.stroke();
      });
      ctx.restore();

      // 3b. Longitude Meridians
      ctx.save();
      for (let m = 0; m < 12; m++) {
        const mAngle = (m / 12) * Math.PI * 2 + gmst;
        ctx.beginPath();
        let started = false;
        for (let j = -16; j <= 16; j++) {
          const lat = (j / 16) * (Math.PI / 2);
          const gx = earthRadius * Math.cos(lat) * Math.cos(mAngle);
          const gy = earthRadius * Math.cos(lat) * Math.sin(mAngle);
          const gz = earthRadius * Math.sin(lat);
          const p = project(gx, gy, gz);

          if (p.depth >= -earthRadius * 0.1) {
            if (!started) {
              ctx.moveTo(p.sx, p.sy);
              started = true;
            } else {
              ctx.lineTo(p.sx, p.sy);
            }
          } else {
            started = false;
          }
        }
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.restore();

      // 3c. Continental Coastlines
      if (showContinents) {
        ctx.save();
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.65)';
        ctx.lineWidth = 1.3;
        ctx.shadowColor = 'rgba(74, 222, 128, 0.5)';
        ctx.shadowBlur = 3;

        EARTH_CONTINENTS.forEach((poly) => {
          ctx.beginPath();
          let drawing = false;

          poly.forEach(([lonDeg, latDeg]) => {
            const lonRad = (lonDeg * Math.PI) / 180 + gmst;
            const latRad = (latDeg * Math.PI) / 180;

            const gx = earthRadius * Math.cos(latRad) * Math.cos(lonRad);
            const gy = earthRadius * Math.cos(latRad) * Math.sin(lonRad);
            const gz = earthRadius * Math.sin(latRad);

            const p = project(gx, gy, gz);
            if (p.depth >= -earthRadius * 0.15) {
              if (!drawing) {
                ctx.moveTo(p.sx, p.sy);
                drawing = true;
              } else {
                ctx.lineTo(p.sx, p.sy);
              }
            } else {
              drawing = false;
            }
          });
          ctx.stroke();
        });
        ctx.restore();
      }

      // 3d. Day/Night Terminator Shading
      if (showTerminator) {
        ctx.save();
        const sunDotView = project(sunVec[0] * earthRadius, sunVec[1] * earthRadius, sunVec[2] * earthRadius);
        const sdvX = Number.isFinite(sunDotView.sx) ? sunDotView.sx : cx;
        const sdvY = Number.isFinite(sunDotView.sy) ? sunDotView.sy : cy;
        const rawSunAngle = Math.atan2(sdvY - cy, sdvX - cx);
        const sunAngle = Number.isFinite(rawSunAngle) ? rawSunAngle : 0;

        const termGrad = safeRadialGradient(
          cx + Math.cos(sunAngle) * earthRadius * 0.4,
          cy + Math.sin(sunAngle) * earthRadius * 0.4,
          Math.max(0, earthRadius * 0.1),
          cx - Math.cos(sunAngle) * earthRadius * 0.5,
          cy - Math.sin(sunAngle) * earthRadius * 0.5,
          Math.max(1, earthRadius * 1.05)
        );
        if (termGrad) {
          termGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          termGrad.addColorStop(0.48, 'rgba(2, 6, 23, 0.1)');
          termGrad.addColorStop(0.55, 'rgba(2, 6, 23, 0.65)');
          termGrad.addColorStop(1, 'rgba(1, 4, 15, 0.88)');

          ctx.fillStyle = termGrad;
          ctx.fillRect(cx - earthRadius, cy - earthRadius, earthRadius * 2, earthRadius * 2);
        }
        ctx.restore();
      }

      // Sub-satellite Ground Footprint
      const satSubLon = Math.atan2(satEciY, satEciX);
      const satSubLat = Math.asin(satEciZ / orbitRadius);
      const subGndX = earthRadius * Math.cos(satSubLat) * Math.cos(satSubLon);
      const subGndY = earthRadius * Math.cos(satSubLat) * Math.sin(satSubLon);
      const subGndZ = earthRadius * Math.sin(satSubLat);
      const subGndProj = project(subGndX, subGndY, subGndZ);

      if (subGndProj.depth >= -earthRadius * 0.1) {
        ctx.save();
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.8)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.arc(subGndProj.sx, subGndProj.sy, 8 * zoom, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(34, 211, 238, 0.9)';
        ctx.beginPath();
        ctx.arc(subGndProj.sx, subGndProj.sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore(); // Restore clipping of Earth disk

      // 4. Draw Front-Half of Orbital Ring
      if (showOrbitRings) {
        ctx.save();
        const numSegments = 90;
        for (let i = 0; i < numSegments; i++) {
          const u0 = (i / numSegments) * Math.PI * 2;
          const u1 = ((i + 1) / numSegments) * Math.PI * 2;

          const p0x =
            orbitRadius * (Math.cos(u0) * Math.cos(raanRad) - Math.sin(u0) * Math.sin(raanRad) * Math.cos(inclination));
          const p0y =
            orbitRadius * (Math.cos(u0) * Math.sin(raanRad) + Math.sin(u0) * Math.cos(raanRad) * Math.cos(inclination));
          const p0z = orbitRadius * (Math.sin(u0) * Math.sin(inclination));

          const p1x =
            orbitRadius * (Math.cos(u1) * Math.cos(raanRad) - Math.sin(u1) * Math.sin(raanRad) * Math.cos(inclination));
          const p1y =
            orbitRadius * (Math.cos(u1) * Math.sin(raanRad) + Math.sin(u1) * Math.cos(raanRad) * Math.cos(inclination));
          const p1z = orbitRadius * (Math.sin(u1) * Math.sin(inclination));

          const pt0 = project(p0x, p0y, p0z);
          const pt1 = project(p1x, p1y, p1z);

          if (pt0.depth >= 0 || pt1.depth >= 0) {
            const dotSun = (p0x * sunVec[0] + p0y * sunVec[1] + p0z * sunVec[2]) / orbitRadius;
            const inShadow = dotSun < -0.15 && Math.abs(solarBetaData.betaDeg) < solarBetaData.criticalBetaDeg;

            ctx.beginPath();
            ctx.moveTo(pt0.sx, pt0.sy);
            ctx.lineTo(pt1.sx, pt1.sy);
            ctx.strokeStyle = inShadow ? 'rgba(244, 63, 94, 0.75)' : 'rgba(34, 211, 238, 0.85)';
            ctx.lineWidth = inShadow ? 1.8 : 1.4;
            if (inShadow) ctx.setLineDash([4, 4]);
            else ctx.setLineDash([]);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // 5. Draw Sun Vector Arrow & Solar Beta Angle Arc
      if (showSunVector) {
        ctx.save();
        const sunLen = earthRadius * 1.55;
        const sunTip = project(sunVec[0] * sunLen, sunVec[1] * sunLen, sunVec[2] * sunLen);

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(sunTip.sx, sunTip.sy);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(sunTip.sx, sunTip.sy, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(
          `SOLAR VECTOR ☉ [β = ${solarBetaData.betaDeg > 0 ? '+' : ''}${solarBetaData.betaDeg.toFixed(1)}°]`,
          sunTip.sx + 10,
          sunTip.sy - 4
        );
        ctx.restore();
      }

      // 6. Draw Nadir Beam from Satellite to Sub-Satellite Point
      const satProj = project(satEciX, satEciY, satEciZ);

      if (showNadirBeam && subGndProj) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(satProj.sx, satProj.sy);
        ctx.lineTo(subGndProj.sx, subGndProj.sy);
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.restore();
      }

      // 7. Draw Satellite Wireframe
      ctx.save();
      const inShadow = solarBetaData.isCurrentlyInShadow;

      const vOx = -Math.sin(u);
      const vOy = Math.cos(u);
      const vx = vOx * Math.cos(raanRad) - vOy * Math.sin(raanRad) * Math.cos(inclination);
      const vy = vOx * Math.sin(raanRad) + vOy * Math.cos(raanRad) * Math.cos(inclination);
      const vz = vOy * Math.sin(inclination);
      const velTip = project(satEciX + vx * 28, satEciY + vy * 28, satEciZ + vz * 28);

      ctx.beginPath();
      ctx.moveTo(satProj.sx, satProj.sy);
      ctx.lineTo(velTip.sx, velTip.sy);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const scale = Math.max(12, 18 * zoom);
      const primaryColor = inShadow ? '#fb7185' : '#38bdf8';

      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 1.6;

      ctx.strokeRect(satProj.sx - scale * 0.45, satProj.sy - scale * 0.45, scale * 0.9, scale * 0.9);
      ctx.fillStyle = inShadow ? 'rgba(244, 63, 94, 0.3)' : 'rgba(14, 165, 233, 0.25)';
      ctx.fillRect(satProj.sx - scale * 0.45, satProj.sy - scale * 0.45, scale * 0.9, scale * 0.9);

      ctx.beginPath();
      ctx.moveTo(satProj.sx - scale * 0.45, satProj.sy - scale * 0.45);
      ctx.lineTo(satProj.sx + scale * 0.45, satProj.sy + scale * 0.45);
      ctx.moveTo(satProj.sx + scale * 0.45, satProj.sy - scale * 0.45);
      ctx.lineTo(satProj.sx - scale * 0.45, satProj.sy + scale * 0.45);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      const wingW = scale * 1.4;
      const wingH = scale * 0.6;
      ctx.fillStyle = inShadow ? 'rgba(51, 65, 85, 0.6)' : 'rgba(6, 182, 212, 0.4)';
      ctx.strokeStyle = inShadow ? '#94a3b8' : '#22d3ee';
      ctx.lineWidth = 1.2;

      ctx.strokeRect(satProj.sx - scale * 0.45 - wingW, satProj.sy - wingH / 2, wingW, wingH);
      ctx.fillRect(satProj.sx - scale * 0.45 - wingW, satProj.sy - wingH / 2, wingW, wingH);
      ctx.beginPath();
      ctx.moveTo(satProj.sx - scale * 0.45 - wingW / 2, satProj.sy - wingH / 2);
      ctx.lineTo(satProj.sx - scale * 0.45 - wingW / 2, satProj.sy + wingH / 2);
      ctx.stroke();

      ctx.strokeRect(satProj.sx + scale * 0.45, satProj.sy - wingH / 2, wingW, wingH);
      ctx.fillRect(satProj.sx + scale * 0.45, satProj.sy - wingH / 2, wingW, wingH);
      ctx.beginPath();
      ctx.moveTo(satProj.sx + scale * 0.45 + wingW / 2, satProj.sy - wingH / 2);
      ctx.lineTo(satProj.sx + scale * 0.45 + wingW / 2, satProj.sy + wingH / 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(satProj.sx, satProj.sy + scale * 0.65, scale * 0.35, Math.PI, Math.PI * 2);
      ctx.strokeStyle = '#acedff';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.fillStyle = inShadow ? '#f43f5e' : '#4edea3';
      ctx.beginPath();
      ctx.arc(satProj.sx, satProj.sy, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Live HUD Tag
      ctx.shadowBlur = 0;
      const tagX = satProj.sx + scale * 1.5 + 8;
      const tagY = satProj.sy - 12;

      ctx.fillStyle = 'rgba(5, 7, 10, 0.85)';
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(tagX, tagY, 130, 36);
      ctx.fillRect(tagX, tagY, 130, 36);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('ORION // LEO', tagX + 6, tagY + 12);

      ctx.fillStyle = inShadow ? '#f43f5e' : '#4edea3';
      ctx.font = '8px monospace';
      ctx.fillText(inShadow ? '● IN UMBRA (BATTERY)' : '● SUNLIT (2,420W)', tagX + 6, tagY + 22);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '8px monospace';
      ctx.fillText(`ALT: 541.8km · V: ${PHYSICAL_ORBITAL_VELOCITY_KM_S.toFixed(2)}km/s`, tagX + 6, tagY + 31);

      ctx.restore();

      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [
    yaw,
    pitch,
    zoom,
    isPlaying,
    animSpeed,
    cameraMode,
    currentDate,
    solarBetaData,
    showContinents,
    showOrbitRings,
    showSunVector,
    showTerminator,
    showNadirBeam,
  ]);

  return (
    <div className="relative w-full h-[460px] sm:h-[500px] bg-[#05070a] overflow-hidden rounded-2xl flex items-center justify-center select-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Top Left: Perspective Controls */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 z-10">
        {(
          [
            { id: 'orbit-overview', label: '3D ORBIT', icon: GlobeIcon },
            { id: 'chase-sat', label: 'CHASE CAM', icon: Radio },
            { id: 'solar-beta', label: 'SOLAR β VIEW', icon: Sun },
            { id: 'polar-top', label: 'NORTH POLE', icon: Compass },
          ] as const
        ).map((cam) => (
          <button
            key={cam.id}
            onClick={() => handleResetCamera(cam.id)}
            className={`px-2.5 py-1 text-[10px] font-mono uppercase rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
              cameraMode === cam.id
                ? 'bg-cyan-500 text-black font-bold border-cyan-400 shadow-md shadow-cyan-500/20'
                : 'bg-[#0f172a]/85 text-slate-300 border-[#1e293b] hover:text-white hover:border-cyan-500/50'
            }`}
          >
            {cam.label}
          </button>
        ))}
      </div>

      {/* Top Right: Live HUD Overlay Badge */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
        <div className="bg-[#0f172a]/90 border border-[#1e293b] px-3 py-1.5 rounded-xl flex items-center gap-2 backdrop-blur-md text-xs font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              solarBetaData.isCurrentlyInShadow ? 'bg-rose-500 animate-pulse' : 'bg-green-400 animate-ping'
            }`}
          />
          <span className="text-slate-300 font-semibold">
            {solarBetaData.isCurrentlyInShadow ? (
              <span className="text-rose-400 font-bold">UMBRA [ECLIPSE]</span>
            ) : (
              <span className="text-green-400 font-bold">SUNLIT [DIRECT]</span>
            )}
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-amber-400 font-bold">
            β {solarBetaData.betaDeg > 0 ? '+' : ''}{solarBetaData.betaDeg.toFixed(1)}°
          </span>
          <span className="text-slate-500 hidden sm:inline">|</span>
          <span className="text-cyan-400 font-mono hidden sm:inline">
            v = {PHYSICAL_ORBITAL_VELOCITY_KM_S.toFixed(2)} km/s
          </span>
        </div>
      </div>

      {/* Bottom Left: Visual Layer Toggles */}
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-1.5 text-[9px] font-mono z-10">
        <button
          onClick={() => setShowContinents(!showContinents)}
          className={`px-2 py-1 rounded-lg border transition-all cursor-pointer ${
            showContinents
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
              : 'bg-[#0f172a]/80 text-slate-400 border-[#1e293b]'
          }`}
        >
          CONTINENTS
        </button>
        <button
          onClick={() => setShowOrbitRings(!showOrbitRings)}
          className={`px-2 py-1 rounded-lg border transition-all cursor-pointer ${
            showOrbitRings
              ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
              : 'bg-[#0f172a]/80 text-slate-400 border-[#1e293b]'
          }`}
        >
          ORBIT RING
        </button>
        <button
          onClick={() => setShowSunVector(!showSunVector)}
          className={`px-2 py-1 rounded-lg border transition-all cursor-pointer ${
            showSunVector
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              : 'bg-[#0f172a]/80 text-slate-400 border-[#1e293b]'
          }`}
        >
          SUN VECTOR
        </button>
        <button
          onClick={() => setShowTerminator(!showTerminator)}
          className={`px-2 py-1 rounded-lg border transition-all cursor-pointer ${
            showTerminator
              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
              : 'bg-[#0f172a]/80 text-slate-400 border-[#1e293b]'
          }`}
        >
          TERMINATOR
        </button>
        <button
          onClick={() => setShowNadirBeam(!showNadirBeam)}
          className={`px-2 py-1 rounded-lg border transition-all cursor-pointer ${
            showNadirBeam
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              : 'bg-[#0f172a]/80 text-slate-400 border-[#1e293b]'
          }`}
        >
          NADIR BEAM
        </button>
      </div>

      {/* Bottom Right: Playback Speed & Zoom Controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-[#0f172a]/90 p-1.5 rounded-xl border border-[#1e293b] backdrop-blur-md z-10">
        <button
          onClick={() => {
            sound.playClick();
            setIsPlaying(!isPlaying);
          }}
          className="p-1 text-slate-300 hover:text-white transition-colors cursor-pointer"
          title={isPlaying ? 'Pause Animation' : 'Play Animation'}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} className="text-cyan-400" />}
        </button>

        <div className="flex items-center gap-1 px-1">
          {([0.5, 1, 2, 4] as const).map((spd) => (
            <button
              key={spd}
              onClick={() => {
                sound.playClick();
                setAnimSpeed(spd);
                if (!isPlaying) setIsPlaying(true);
              }}
              className={`px-1.5 py-0.5 text-[9px] font-mono rounded cursor-pointer ${
                animSpeed === spd && isPlaying
                  ? 'bg-cyan-500 text-black font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {spd === 1 ? '1x (CAL)' : `${spd}x`}
            </button>
          ))}
        </div>

        <div className="w-px h-3.5 bg-slate-700"></div>

        <button
          onClick={() => {
            sound.playClick();
            setZoom((prev) => Math.min(2.2, prev + 0.15));
          }}
          title="Zoom In"
          className="p-1 text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={() => {
            sound.playClick();
            setZoom((prev) => Math.max(0.5, prev - 0.15));
          }}
          title="Zoom Out"
          className="p-1 text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
        >
          <ZoomOut size={14} />
        </button>

        <div className="w-px h-3.5 bg-slate-700"></div>

        <button
          onClick={() => handleResetCamera('orbit-overview')}
          title="Reset Orbit Orientation"
          className="p-1 text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
        >
          <RefreshCw size={13} />
        </button>
      </div>
    </div>
  );
};

const GlobeIcon: React.FC<{ size?: number; className?: string }> = ({ size = 12, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);
