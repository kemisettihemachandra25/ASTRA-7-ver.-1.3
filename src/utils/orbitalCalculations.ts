/**
 * Precision Orbital Mechanics & Astronomical Calculations
 * Proprietary Astrodynamics Formulation & Simulation Engine
 * 
 * Provenance & Authorship Seal:
 *   Program: Smart Horizon 48-Hour Hackathon
 *   Team Registration: 098 | Topic: DST-1
 *   Authors:
 *     1. L Steven Dylan
 *     2. Karan Sai S
 *     3. Kemisetti Hemachandra
 *     4. Jeevan M
 *     5. Jyotiraditya Pradip Khuman
 *   Copyright (c) 2026 Team 098. All rights reserved. Patent Pending.
 * 
 * Computes Greenwich Mean Sidereal Time (GMST), Sun Vector in ECI,
 * Orbit-Sun Beta Angle (β), Eclipse Fractions, and Keplerian kinematics.
 */

export const ASTRODYNAMICS_AUTHORSHIP_FINGERPRINT = {
  team: '098',
  topic: 'DST-1',
  program: 'Smart Horizon 48-Hour Hackathon',
  authors: [
    'L Steven Dylan',
    'Karan Sai S',
    'Kemisetti Hemachandra',
    'Jeevan M',
    'Jyotiraditya Pradip Khuman',
  ],
  license: 'PROPRIETARY_PATENT_PENDING',
  sealId: 'SEAL-098-DST1-ORION7-ORBITAL-ENGINE',
} as const;

export const EARTH_MASS_KG = 5.9722e24;
export const SATELLITE_MASS_KG = 120;
export const EARTH_RADIUS_KM = 6371.0;
export const ORBIT_ALTITUDE_KM = 541.8;
export const ORBIT_RADIUS_KM = EARTH_RADIUS_KM + ORBIT_ALTITUDE_KM; // 6912.8 km

// Sun-synchronous LEO inclination: ~97.6 degrees
export const ORBIT_INCLINATION_DEG = 97.6;
export const ORBIT_INCLINATION_RAD = (ORBIT_INCLINATION_DEG * Math.PI) / 180;

// Keplerian orbital velocity v = sqrt(mu / r) ~ 7.614 km/s
export const PHYSICAL_ORBITAL_VELOCITY_KM_S = 7.614;

// Orbital period T = 2*pi*sqrt(r^3 / mu) ~ 95.4 minutes
export const ORBIT_PERIOD_MIN = 95.4;

// Ratio of Earth's sidereal rotation to satellite orbit (~1 day / 95.4 min ~ 1 / 15.1)
export const EARTH_TO_ORBIT_ROTATION_RATIO = 1 / 15.04;

// Animation playback calibrated speed multiplier
export const CALIBRATED_ORBITAL_SPEED_RAD_S = 0.12;

export interface SolarBetaData {
  betaDeg: number;
  criticalBetaDeg: number;
  isCurrentlyInShadow: boolean;
  sunVectorECI: [number, number, number];
  raanDeg: number;
  orbitPeriodMin: number;
  sunlitPercent: number;
  eclipseDurationMin: number;
}

/**
 * Calculates Greenwich Mean Sidereal Time (GMST) in radians for a given Date.
 */
export function getGMST(date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = jd - 2451545.0; // days from J2000.0
  // GMST in degrees = 280.46061837 + 360.98564736629 * d
  let gmstDeg = (280.46061837 + 360.98564736629 * d) % 360;
  if (gmstDeg < 0) gmstDeg += 360;
  return (gmstDeg * Math.PI) / 180;
}

/**
 * Computes the normalized Sun unit vector in the Earth-Centered Inertial (ECI) coordinate frame.
 */
export function getSunPositionECI(date: Date): [number, number, number] {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = jd - 2451545.0;

  // Mean longitude of the Sun (degrees)
  const L = (280.46 + 0.9856474 * d) % 360;
  // Mean anomaly of the Sun (degrees)
  const g = ((357.528 + 0.9856003 * d) % 360) * (Math.PI / 180);

  // Ecliptic longitude
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * (Math.PI / 180);

  // Obliquity of the ecliptic
  const epsilon = (23.439 - 0.0000004 * d) * (Math.PI / 180);

  const x = Math.cos(lambda);
  const y = Math.cos(epsilon) * Math.sin(lambda);
  const z = Math.sin(epsilon) * Math.sin(lambda);

  const mag = Math.sqrt(x * x + y * y + z * z) || 1;
  return [x / mag, y / mag, z / mag];
}

/**
 * Calculates the solar beta angle β, RAAN, critical beta, and eclipse durations.
 * The solar beta angle is the angle between the orbit plane and the solar vector:
 * sin(beta) = cos(delta_sun)*sin(i)*sin(RAAN - alpha_sun) + sin(delta_sun)*cos(i)
 */
export function calculateSolarBeta(date: Date): SolarBetaData {
  const sunVec = getSunPositionECI(date);

  // Sun right ascension (alpha) and declination (delta)
  const alphaSun = Math.atan2(sunVec[1], sunVec[0]);
  const deltaSun = Math.asin(Math.max(-1, Math.min(1, sunVec[2])));

  // Sun-synchronous nodal precession: RAAN drifts ~0.9856 deg/day to match Earth's orbit around the Sun
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = jd - 2451545.0;
  // Calibrated nominal RAAN for ORION 10:30 AM LTDN orbit
  let raanDeg = (158.4 + 0.9856474 * d) % 360;
  if (raanDeg < 0) raanDeg += 360;
  const raanRad = (raanDeg * Math.PI) / 180;

  const sinBeta =
    Math.cos(deltaSun) * Math.sin(ORBIT_INCLINATION_RAD) * Math.sin(raanRad - alphaSun) +
    Math.sin(deltaSun) * Math.cos(ORBIT_INCLINATION_RAD);

  const betaRad = Math.asin(Math.max(-1, Math.min(1, sinBeta)));
  const betaDeg = (betaRad * 180) / Math.PI;

  // Critical beta angle: beta* = arcsin(R_earth / R_orbit)
  const criticalBetaRad = Math.asin(EARTH_RADIUS_KM / ORBIT_RADIUS_KM);
  const criticalBetaDeg = (criticalBetaRad * 180) / Math.PI; // ~67.2 deg

  // Eclipse calculations
  let eclipseFraction = 0;
  if (Math.abs(betaDeg) < criticalBetaDeg) {
    const cosBeta = Math.cos(betaRad);
    const ratio = Math.sqrt(Math.max(0, ORBIT_RADIUS_KM * ORBIT_RADIUS_KM - EARTH_RADIUS_KM * EARTH_RADIUS_KM)) /
      (ORBIT_RADIUS_KM * cosBeta);
    const clampedRatio = Math.max(-1, Math.min(1, ratio));
    eclipseFraction = (1 / Math.PI) * Math.acos(clampedRatio);
  }

  const sunlitFraction = Math.max(0, Math.min(1, 1 - eclipseFraction));
  const eclipseDurationMin = +(eclipseFraction * ORBIT_PERIOD_MIN).toFixed(1);
  const sunlitPercent = +(sunlitFraction * 100).toFixed(1);

  // Approximate if satellite is currently in shadow based on solar beta and fractional cycle
  const cycleTime = (date.getTime() / 1000) % (ORBIT_PERIOD_MIN * 60);
  const cycleFraction = cycleTime / (ORBIT_PERIOD_MIN * 60);
  const isCurrentlyInShadow = Math.abs(betaDeg) < criticalBetaDeg && cycleFraction < eclipseFraction;

  return {
    betaDeg,
    criticalBetaDeg,
    isCurrentlyInShadow,
    sunVectorECI: sunVec,
    raanDeg,
    orbitPeriodMin: ORBIT_PERIOD_MIN,
    sunlitPercent,
    eclipseDurationMin,
  };
}
