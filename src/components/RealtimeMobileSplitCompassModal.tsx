import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import {
  Compass,
  Smartphone,
  Lock,
  Unlock,
  Check,
  X,
  Sliders,
  ShieldCheck,
  Eye,
  Gauge,
  RotateCcw,
  ArrowDown,
} from 'lucide-react';

export type RealtimeCompassDomainMode =
  | 'TUNNEL'
  | 'SHAFT'
  | 'SURFACE_SLOPE'
  | 'SURFACE_TRENCH'
  | 'SURFACE_OUTCROP'
  | 'MINING_STOPE'
  | 'MINING_BENCH';

export interface RealtimeCompassPoint2D {
  x: number;
  y: number;
  xM?: number;
  yM?: number;
}

export interface RealtimeCompassConfirmOptions {
  /** Whether to update ONLY the orientation data or ALSO rotate/align the 2D joint trace geometry */
  applyMode: 'DATA_ONLY' | 'TRACE_AND_DATA';
  /** 2D trace points rotated around their centroid to match the compass Dip Direction & Dip Amount */
  alignedPoints2D?: RealtimeCompassPoint2D[];
  /** Rotation angle delta (in radians, SVG clockwise) applied to align the 2D trace */
  rotationDeltaRad?: number;
}

export interface RealtimeMobileSplitCompassModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional reference azimuth (tunnel drive direction in degrees, default 0) */
  tunnelDriveAzimuthDeg?: number;
  /** Current Dip Direction (0..360 deg from North) of the traced joint/feature */
  initialDipDirectionDeg: number;
  /** Current Dip Amount (0..90 deg from horizontal) of the traced joint/feature */
  initialDipAmountDeg: number;
  /** Label of the traced joint or geological feature (e.g., "J1 #3", "Fault FP-NF", "Bedding S0") */
  featureLabel?: string;
  /** Active excavation panel where the trace was drawn ('face' | 'left_wall' | 'right_wall' | 'crown') */
  activePanel?: string;
  /** Normalised or SVG 0..1000 2D trace points drawn on the face canvas */
  tracePoints2D?: RealtimeCompassPoint2D[];
  /** Excavation / mapping domain ('TUNNEL' | 'SHAFT' | 'SURFACE_SLOPE' | 'MINING_STOPE' etc.) */
  domainMode?: RealtimeCompassDomainMode;
  /** Tunnel / Stope width in meters for exact 3D shape rendering */
  excavationWidthM?: number;
  /** Tunnel / Stope total height in meters for exact 3D shape rendering */
  excavationHeightM?: number;
  /** Tunnel wall height to springline in meters */
  excavationWallHeightM?: number;
  /** Tunnel round Pull Length (advance length) in meters */
  excavationPullLengthM?: number;
  /** Tunnel cross-section profile shape */
  excavationShape?:
    | 'horseshoe'
    | 'modified_horseshoe'
    | 'circular'
    | 'd_shaped'
    | 'rectangular'
    | 'slope'
    | 'bench'
    | string;
  /** Called when user clicks OK: supports updating ONLY data or BOTH joint trace geometry + data */
  onConfirmOrientation: (
    dipDirectionDeg: number,
    dipAmountDeg: number,
    strikeDeg: number,
    options?: RealtimeCompassConfirmOptions
  ) => void;
}

/**
 * Helper: Detect whether the app is running inside an Android APK / WebView / Mobile Device
 */
export function detectAndroidApkOrMobileSensorEnv(): {
  isAndroid: boolean;
  isAndroidApkWebView: boolean;
  isMobileOrTablet: boolean;
} {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isAndroid: false, isAndroidApkWebView: false, isMobileOrTablet: false };
  }
  const win = window as any;
  const ua = navigator.userAgent || '';
  const hasNativeApkBridge = Boolean(
    win.__ESWA_NATIVE_ANDROID_APK__ ||
      win.AndroidNativeApp ||
      win.Capacitor ||
      win.AndroidBridge
  );
  const isAndroid = /Android/i.test(ua) || hasNativeApkBridge;
  const isWv = /; wv\)/i.test(ua) || hasNativeApkBridge;
  const isMobileOrTablet =
    isAndroid ||
    /iPhone|iPad|iPod|Mobile|Tablet/i.test(ua) ||
    Boolean(navigator.maxTouchPoints && navigator.maxTouchPoints > 1 && window.innerWidth <= 1366);
  return {
    isAndroid,
    isAndroidApkWebView: isAndroid && isWv,
    isMobileOrTablet: Boolean(isMobileOrTablet),
  };
}

const REALTIME_COMPASS_ENABLED_STORAGE_KEY = 'eswa_realtime_mobile_compass_enabled_v1';
const REALTIME_COMPASS_AUTOPROMPT_STORAGE_KEY = 'eswa_realtime_mobile_compass_autoprompt_v1';
const REALTIME_COMPASS_NORTH_OFFSET_STORAGE_KEY = 'eswa_realtime_compass_north_offset_deg_v1';

export function loadRealtimeCompassEnabledSetting(): boolean {
  try {
    const raw = localStorage.getItem(REALTIME_COMPASS_ENABLED_STORAGE_KEY);
    if (raw !== null) return raw === 'true';
  } catch {}
  return true;
}

export function saveRealtimeCompassEnabledSetting(enabled: boolean): void {
  try {
    localStorage.setItem(REALTIME_COMPASS_ENABLED_STORAGE_KEY, String(enabled));
  } catch {}
}

export function loadRealtimeCompassAutoPromptSetting(): boolean {
  try {
    const raw = localStorage.getItem(REALTIME_COMPASS_AUTOPROMPT_STORAGE_KEY);
    if (raw !== null) return raw === 'true';
  } catch {}
  return false;
}

export function saveRealtimeCompassAutoPromptSetting(autoPrompt: boolean): void {
  try {
    localStorage.setItem(REALTIME_COMPASS_AUTOPROMPT_STORAGE_KEY, String(autoPrompt));
  } catch {}
}

function loadNorthCalibrationOffsetDeg(): number {
  try {
    const raw = localStorage.getItem(REALTIME_COMPASS_NORTH_OFFSET_STORAGE_KEY);
    if (raw !== null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  } catch {}
  return 0;
}

function saveNorthCalibrationOffsetDeg(offsetDeg: number): void {
  try {
    localStorage.setItem(REALTIME_COMPASS_NORTH_OFFSET_STORAGE_KEY, String(offsetDeg));
  } catch {}
}

/**
 * Convert 0..360° azimuth into standard 16-point compass cardinal label (N, NE, E, SE, S, SW, W, NW, etc.)
 */
function getCardinalDirectionLabel(deg: number): string {
  const dirs = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  const norm = ((deg % 360) + 360) % 360;
  const idx = Math.round(norm / 22.5) % 16;
  return dirs[idx];
}

/**
 * Describe dip steepness from 0..90° inclinometer angle
 */
function getInclinometerSteepnessLabel(dipDeg: number): string {
  if (dipDeg <= 5) return 'Horizontal / Sub-Horizontal (0°–5°)';
  if (dipDeg <= 20) return 'Shallow Dip (6°–20°)';
  if (dipDeg <= 45) return 'Moderate Dip (21°–45°)';
  if (dipDeg <= 70) return 'Steep Dip (46°–70°)';
  if (dipDeg < 88) return 'Very Steep Dip (71°–87°)';
  return 'Vertical / Sub-Vertical (88°–90°)';
}

/**
 * Build exact 2D cross-section profile points (x in [-W/2, +W/2], y in [-H/2, +H/2])
 * for the selected tunnel shape ('d_shaped' | 'horseshoe' | 'modified_horseshoe' | 'circular' | 'rectangular')
 */
function buildTunnelCrossSectionProfilePoints(
  widthM: number,
  heightM: number,
  wallHeightM: number | undefined,
  shapeType: string
): THREE.Vector2[] {
  const halfW = widthM / 2;
  const halfH = heightM / 2;
  const cleanShape = (shapeType || 'horseshoe').toLowerCase();

  if (cleanShape === 'circular') {
    const r = Math.min(halfW, halfH);
    const pts: THREE.Vector2[] = [];
    const segs = 48;
    for (let i = 0; i <= segs; i++) {
      const a = -Math.PI / 2 + (i / segs) * Math.PI * 2;
      pts.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)));
    }
    return pts;
  }

  if (cleanShape === 'rectangular') {
    return [
      new THREE.Vector2(-halfW, -halfH),
      new THREE.Vector2(-halfW, halfH),
      new THREE.Vector2(halfW, halfH),
      new THREE.Vector2(halfW, -halfH),
      new THREE.Vector2(-halfW, -halfH),
    ];
  }

  // D-Shaped, Horseshoe, or Modified Horseshoe with exact wallHeightM + Crown Arch
  const effectiveWallH =
    typeof wallHeightM === 'number' && wallHeightM > 0.2 && wallHeightM < heightM * 0.9
      ? wallHeightM
      : cleanShape === 'd_shaped'
      ? heightM * 0.5
      : heightM * 0.54;
  const archH = Math.max(0.5, heightM - effectiveWallH);
  const springY = -halfH + effectiveWallH;
  const numArchPts = 36;
  const pts: THREE.Vector2[] = [];

  if (cleanShape === 'horseshoe' || cleanShape === 'modified_horseshoe') {
    // Slightly curved inward walls for horseshoe
    const invertW = halfW * 0.92;
    pts.push(new THREE.Vector2(-invertW, -halfH));
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const wx = -invertW - (halfW - invertW) * Math.sin((t * Math.PI) / 2);
      const wy = -halfH + t * effectiveWallH;
      pts.push(new THREE.Vector2(wx, wy));
    }
    for (let i = 0; i <= numArchPts; i++) {
      const theta = Math.PI - (i / numArchPts) * Math.PI;
      const x = halfW * Math.cos(theta);
      const y = springY + archH * Math.sin(theta);
      pts.push(new THREE.Vector2(x, y));
    }
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const wx = halfW - (halfW - invertW) * (1 - Math.cos((t * Math.PI) / 2));
      const wy = springY - t * effectiveWallH;
      pts.push(new THREE.Vector2(wx, wy));
    }
    pts.push(new THREE.Vector2(-invertW, -halfH));
    return pts;
  }

  // Standard D-Shaped (Vertical Left Wall & Right Wall + Arch Crown)
  pts.push(new THREE.Vector2(-halfW, -halfH));
  pts.push(new THREE.Vector2(-halfW, springY));
  for (let i = 0; i <= numArchPts; i++) {
    const theta = Math.PI - (i / numArchPts) * Math.PI;
    const x = halfW * Math.cos(theta);
    const y = springY + archH * Math.sin(theta);
    pts.push(new THREE.Vector2(x, y));
  }
  pts.push(new THREE.Vector2(halfW, -halfH));
  pts.push(new THREE.Vector2(-halfW, -halfH));
  return pts;
}

/**
 * FieldMove Clino 3D Plane Clinometer + Tilt-Invariant True/Magnetic North Compass Engine:
 *
 * 1. True/Magnetic Compass Heading (`compassHeadingDeg`, 000°..360°):
 *    Uses the horizontal projection perpendicular to the Visual Screen Right vector `u_right × Up = (-N_R, E_R)`.
 *    This is 100% immune to pitch gimbal lock from 0° (flat) to 90° (vertical) so the rotating
 *    Compass Rose Red "N 000°" needle ALWAYS points to Real Physical North in the room!
 *
 * 2. FieldMove Clino 3D Plane Mode (`FIELDMOVE_PLANE`):
 *    Treats the entire phone screen as the geological plane with outward normal `n = (rEz, rNz, rUz)` in Earth ENU:
 *    - True Dip Amount (00°..90°) = arccos(|rUz|) (works in Portrait, Landscape, or any angle on the rock face!)
 *    - True Dip Direction (000°..360°) = steepest downhill azimuth of the 3D screen plane
 *    - Bullseye Spirit Bubble `(bubbleX, bubbleY)` in [-1, +1]
 */
function computeFieldMoveClinoAndCompassOrientation(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
  effectiveScreenAngleDeg: number,
  northCalibrationOffsetDeg: number,
  measureMode: 'FIELDMOVE_PLANE' | 'SCREEN_AXIS'
): {
  compassHeadingDeg: number;
  dipDirectionDeg: number;
  dipAmountDeg: number;
  strikeRhrDeg: number;
  screenTopAzimuthDeg: number;
  bubbleX: number;
  bubbleY: number;
} {
  const deg2rad = Math.PI / 180;
  const rad2deg = 180 / Math.PI;

  const alpha = (alphaDeg || 0) * deg2rad;
  const beta = (betaDeg || 0) * deg2rad;
  const gamma = (gammaDeg || 0) * deg2rad;

  const cA = Math.cos(alpha);
  const sA = Math.sin(alpha);
  const cB = Math.cos(beta);
  const sB = Math.sin(beta);
  const cG = Math.cos(gamma);
  const sG = Math.sin(gamma);

  // W3C Intrinsic Z(alpha) * X'(beta) * Y''(gamma) Rotation Matrix mapping Device (x,y,z) -> Earth (East, North, Up)
  // Column 1: Device +X in Earth (East, North, Up)
  const rEx = cA * cG - sA * sB * sG;
  const rNx = sA * cG + cA * sB * sG;
  const rUx = -cB * sG;

  // Column 2: Device +Y in Earth (East, North, Up)
  const rEy = -sA * cB;
  const rNy = cA * cB;
  const rUy = sB;

  // Column 3: Device +Z (outward screen normal) in Earth (East, North, Up)
  const rEz = cA * sG + sA * sB * cG;
  const rNz = sA * sG - cA * sB * cG;
  const rUz = cB * cG;

  return computeFieldMoveFromEnuColumns(
    rEx,
    rNx,
    rUx,
    rEy,
    rNy,
    rUy,
    rEz,
    rNz,
    rUz,
    effectiveScreenAngleDeg,
    northCalibrationOffsetDeg,
    measureMode
  );
}

function computeFieldMoveFromEnuColumns(
  rEx: number,
  rNx: number,
  rUx: number,
  rEy: number,
  rNy: number,
  rUy: number,
  rEz: number,
  rNz: number,
  rUz: number,
  effectiveScreenAngleDeg: number,
  northCalibrationOffsetDeg: number,
  measureMode: 'FIELDMOVE_PLANE' | 'SCREEN_AXIS'
): {
  compassHeadingDeg: number;
  dipDirectionDeg: number;
  dipAmountDeg: number;
  strikeRhrDeg: number;
  screenTopAzimuthDeg: number;
  bubbleX: number;
  bubbleY: number;
} {
  const deg2rad = Math.PI / 180;
  const rad2deg = 180 / Math.PI;
  const scrRad = (effectiveScreenAngleDeg || 0) * deg2rad;
  const cosS = Math.cos(scrRad);
  const sinS = Math.sin(scrRad);

  // Visual Screen Right (+X_vis) & Top (+Y_vis) unit vectors in Device coordinates:
  // Angle = 0 (Portrait): Right = (1, 0), Top = (0, 1)
  // Angle = 90 (Landscape CCW): Right = (0, -1), Top = (1, 0)
  // Angle = 270 / -90 (Landscape CW): Right = (0, 1), Top = (-1, 0)
  const uxRight = cosS;
  const uyRight = -sinS;
  const uxTop = sinS;
  const uyTop = cosS;

  // Transform Visual Screen Right into Earth (East, North, Up):
  const rightEast = rEx * uxRight + rEy * uyRight;
  const rightNorth = rNx * uxRight + rNy * uyRight;
  const rightUp = rUx * uxRight + rUy * uyRight;

  // Transform Visual Screen Top into Earth (East, North, Up):
  const topEast = rEx * uxTop + rEy * uyTop;
  const topNorth = rNx * uxTop + rNy * uyTop;
  const topUp = rUx * uxTop + rUy * uyTop;

  // 1. TILT-INVARIANT TRUE/MAGNETIC COMPASS HEADING OF PHONE SIGHTING AXIS (000°..360°):
  // Cross product `u_right × Earth_Up = (-rightNorth, rightEast)` is horizontal and completely free of pitch gimbal lock!
  const headingEast = -rightNorth;
  const headingNorth = rightEast;
  let rawHeadingDeg = 0;
  if (Math.hypot(headingEast, headingNorth) > 1e-4) {
    rawHeadingDeg = ((Math.atan2(headingEast, headingNorth) * rad2deg) % 360 + 360) % 360;
  }
  const compassHeadingDeg =
    Math.round(((rawHeadingDeg + northCalibrationOffsetDeg) % 360 + 360) % 360) % 360;

  // 2. BULLSEYE SPIRIT LEVEL BUBBLE OFFSET IN VISUAL SCREEN [-1, +1]:
  // Uphill vector on visual screen is (rightUp, topUp)
  const bubbleX = Math.max(-1, Math.min(1, rightUp));
  const bubbleY = Math.max(-1, Math.min(1, -topUp));

  // 3. FIELDMOVE CLINO 3D PLANE CLINOMETER vs SCREEN TOP-TO-BOTTOM AXIS MODE:
  if (measureMode === 'FIELDMOVE_PLANE') {
    // Upper-hemisphere normal of the 3D phone screen plane (nU >= 0):
    const signZ = rUz >= 0 ? 1 : -1;
    const nE = signZ * rEz;
    const nN = signZ * rNz;
    const nU = Math.min(1, Math.max(0, Math.abs(rUz)));

    // True 3D Plane Dip Amount (00°..90°):
    const planeDipAmountDeg = Math.round(
      Math.max(0, Math.min(90, Math.atan2(Math.hypot(nE, nN), nU) * rad2deg))
    );

    // True 3D Plane Down-Dip Azimuth (000°..360°):
    // When tilted >= 5°, use the steepest downhill direction of the 3D plane (nE, nN).
    // When flat (< 5°), smoothly use the phone's compass heading so the compass needle is rock-steady on a table.
    let dipDirectionDeg = compassHeadingDeg;
    if (planeDipAmountDeg >= 5 && Math.hypot(nE, nN) > 0.06) {
      const rawPlaneDipDir = ((Math.atan2(nE, nN) * rad2deg) % 360 + 360) % 360;
      dipDirectionDeg =
        Math.round(((rawPlaneDipDir + northCalibrationOffsetDeg) % 360 + 360) % 360) % 360;
    }

    const strikeRhrDeg = Math.round(((dipDirectionDeg - 90) % 360 + 360) % 360) % 360;
    return {
      compassHeadingDeg,
      dipDirectionDeg,
      dipAmountDeg: planeDipAmountDeg,
      strikeRhrDeg,
      screenTopAzimuthDeg: compassHeadingDeg,
      bubbleX,
      bubbleY,
    };
  }

  // SCREEN TOP-TO-BOTTOM AXIS MODE:
  const clampedAbsTopUp = Math.min(1, Math.max(0, Math.abs(topUp)));
  const axisDipAmountDeg = Math.round(
    Math.max(0, Math.min(90, Math.asin(clampedAbsTopUp) * rad2deg))
  );
  // Downhill along the visual screen top-to-bottom axis:
  // If top edge is higher than bottom edge (topUp >= 0), downhill is toward the bottom edge (compassHeadingDeg + 180)
  const axisDipDirectionDeg =
    topUp >= -0.05
      ? Math.round(((compassHeadingDeg + 180) % 360 + 360) % 360) % 360
      : compassHeadingDeg;
  const strikeRhrDeg = Math.round(((axisDipDirectionDeg - 90) % 360 + 360) % 360) % 360;

  return {
    compassHeadingDeg,
    dipDirectionDeg: axisDipDirectionDeg,
    dipAmountDeg: axisDipAmountDeg,
    strikeRhrDeg,
    screenTopAzimuthDeg: compassHeadingDeg,
    bubbleX,
    bubbleY,
  };
}

/**
 * Compute the 2D trace points rotated around their 2D centroid so the trace angle on the active panel
 * aligns with the true geological apparent trace angle of (dipDirectionDeg, dipAmountDeg).
 * Preserves the exact traced length and curvature profile.
 */
export function computeCompassAlignedTracePoints2D(
  tracePoints2D: RealtimeCompassPoint2D[],
  activePanel: string | undefined,
  dipDirectionDeg: number,
  dipAmountDeg: number,
  tunnelDriveAzimuthDeg: number = 0
): {
  alignedPoints2D: RealtimeCompassPoint2D[];
  rotationDeltaRad: number;
  targetAngleDeg: number;
} {
  if (!tracePoints2D || tracePoints2D.length < 2) {
    return { alignedPoints2D: tracePoints2D || [], rotationDeltaRad: 0, targetAngleDeg: 0 };
  }

  const panelClean = (activePanel || 'face').toLowerCase();
  const azDeg = ((dipDirectionDeg % 360) + 360) % 360;
  const azRad = (azDeg * Math.PI) / 180;
  const dipRad = (Math.max(0, Math.min(90, dipAmountDeg)) * Math.PI) / 180;

  // Target 2D SVG trace direction (dxSvg right, dySvg down) on the active panel:
  // Dip Amount (0°..90°) directly sets the slope steepness (0° = horizontal, 90° = vertical),
  // and Dip Direction (000°..360°) sets the compass hemisphere / strike direction.
  let dxSvg = 1;
  let dySvg = 0;

  if (panelClean === 'crown') {
    dxSvg = Math.cos(azRad);
    dySvg = Math.sin(azRad);
  } else {
    const slopeSign = azDeg > 180 ? -1 : 1;
    dxSvg = Math.cos(dipRad);
    dySvg = Math.sin(dipRad) * slopeSign;
  }

  const targetTheta = Math.atan2(dySvg, dxSvg);
  const pFirst = tracePoints2D[0];
  const pLast = tracePoints2D[tracePoints2D.length - 1];
  const origTheta = Math.atan2(pLast.y - pFirst.y, pLast.x - pFirst.x);

  // Choose the orientation along the target line closest to the drawn chord so endpoints don't flip 180°
  let deltaRad = Math.atan2(
    Math.sin(targetTheta - origTheta),
    Math.cos(targetTheta - origTheta)
  );
  if (deltaRad > Math.PI / 2) deltaRad -= Math.PI;
  if (deltaRad < -Math.PI / 2) deltaRad += Math.PI;

  const n = tracePoints2D.length;
  const cx = tracePoints2D.reduce((s, p) => s + p.x, 0) / n;
  const cy = tracePoints2D.reduce((s, p) => s + p.y, 0) / n;

  const hasMetric = tracePoints2D.every(
    (p) => typeof p.xM === 'number' && typeof p.yM === 'number'
  );
  const cxM = hasMetric
    ? tracePoints2D.reduce((s, p) => s + (p.xM || 0), 0) / n
    : 0;
  const cyM = hasMetric
    ? tracePoints2D.reduce((s, p) => s + (p.yM || 0), 0) / n
    : 0;

  const cosD = Math.cos(deltaRad);
  const sinD = Math.sin(deltaRad);
  const cosM = Math.cos(-deltaRad);
  const sinM = Math.sin(-deltaRad);

  const alignedPoints2D: RealtimeCompassPoint2D[] = tracePoints2D.map((pt) => {
    const rx = pt.x - cx;
    const ry = pt.y - cy;
    const nextPt: RealtimeCompassPoint2D = {
      ...pt,
      x: Number((cx + rx * cosD - ry * sinD).toFixed(2)),
      y: Number((cy + rx * sinD + ry * cosD).toFixed(2)),
    };
    if (hasMetric && typeof pt.xM === 'number' && typeof pt.yM === 'number') {
      const rxM = pt.xM - cxM;
      const ryM = pt.yM - cyM;
      nextPt.xM = Number((cxM + rxM * cosM - ryM * sinM).toFixed(3));
      nextPt.yM = Number((cyM + rxM * sinM + ryM * cosM).toFixed(3));
    }
    return nextPt;
  });

  const targetAngleDeg = Math.round(((targetTheta * 180) / Math.PI + 360) % 360);
  return { alignedPoints2D, rotationDeltaRad: deltaRad, targetAngleDeg };
}

export const RealtimeMobileSplitCompassModal: React.FC<RealtimeMobileSplitCompassModalProps> = ({
  isOpen,
  onClose,
  tunnelDriveAzimuthDeg = 0,
  initialDipDirectionDeg = 135,
  initialDipAmountDeg = 62,
  featureLabel = 'Traced Joint Plane',
  activePanel = 'face',
  tracePoints2D = [],
  domainMode = 'TUNNEL',
  excavationWidthM = 8.5,
  excavationHeightM = 7.5,
  excavationWallHeightM,
  excavationPullLengthM = 4.0,
  excavationShape = 'horseshoe',
  onConfirmOrientation,
}) => {
  // Live or Locked Dip Direction (0..360°) & Dip Amount (0..90°)
  const [dipDirectionDeg, setDipDirectionDeg] = useState<number>(
    Math.round(((initialDipDirectionDeg % 360) + 360) % 360)
  );
  const [dipAmountDeg, setDipAmountDeg] = useState<number>(
    Math.round(Math.max(0, Math.min(90, initialDipAmountDeg)))
  );

  // Live True/Magnetic Compass Heading of the phone (000°..360°) for rotating the FieldMove Clino Compass Rose
  const [compassHeadingDeg, setCompassHeadingDeg] = useState<number>(
    Math.round(((initialDipDirectionDeg % 360) + 360) % 360)
  );

  // FieldMove Clino Bullseye Spirit Level Bubble position in [-1, +1]
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Measurement Mode: FieldMove Clino 3D Plane Mode (default) vs Screen Top-to-Bottom Axis Mode
  const [clinoMeasureMode, setClinoMeasureMode] = useState<'FIELDMOVE_PLANE' | 'SCREEN_AXIS'>(
    'FIELDMOVE_PLANE'
  );

  // Pull Length in meters for the 3D Tunnel (with Left Wall, Right Wall, Crown, and Face behind them)
  const [pullLengthM, setPullLengthM] = useState<number>(
    Math.max(1.5, Math.min(20, Number(excavationPullLengthM) || 4.0))
  );

  // Whether the compass & inclinometer reading is LOCKED (HOLD)
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // Screen rotation lock status & Visual Screen Mode
  const [rotationLockStatus, setRotationLockStatus] = useState<'LOCKED' | 'ACTIVE_CSS_LOCK' | 'UNLOCKED'>('LOCKED');
  const [visualScreenAxisMode, setVisualScreenAxisMode] = useState<'AUTO' | 'PORTRAIT' | 'LANDSCAPE'>('AUTO');
  const [detectedScreenAngleDeg, setDetectedScreenAngleDeg] = useState<number>(0);

  // True North Calibration Offset (persisted so user can match physical compass 1:1)
  const [northOffsetDeg, setNorthOffsetDeg] = useState<number>(() => loadNorthCalibrationOffsetDeg());

  // Hardware sensor status: tracks whether True Absolute Magnetometer is active
  const [sensorSourceType, setSensorSourceType] = useState<'ABSOLUTE_MAGNETOMETER' | 'RELATIVE_GYRO' | 'MANUAL'>('MANUAL');
  const hasAbsoluteMagnetometerRef = useRef<boolean>(false);
  const hasGenericQuaternionSensorRef = useRef<boolean>(false);

  // Smoothing circular buffers for hardware sensor readings
  const sinAzBufferRef = useRef<number[]>([]);
  const cosAzBufferRef = useRef<number[]>([]);
  const sinHeadBufferRef = useRef<number[]>([]);
  const cosHeadBufferRef = useRef<number[]>([]);
  const dipBufferRef = useRef<number[]>([]);

  // Interactive pointer drag on the right-side Compass dial or Inclinometer gauge
  const compassSvgRef = useRef<SVGSVGElement | null>(null);
  const inclinometerSvgRef = useRef<SVGSVGElement | null>(null);
  const [isDraggingCompassDial, setIsDraggingCompassDial] = useState<boolean>(false);
  const [isDraggingInclinometer, setIsDraggingInclinometer] = useState<boolean>(false);

  // Camera reset trigger for Ideal 3D Tunnel Position (Face Behind Wall & Crown)
  const [cameraResetCounter, setCameraResetCounter] = useState<number>(0);

  // Sync initial orientation & pull length when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const initDir = Math.round(((initialDipDirectionDeg % 360) + 360) % 360);
    setDipDirectionDeg(initDir);
    setCompassHeadingDeg(initDir);
    setDipAmountDeg(Math.round(Math.max(0, Math.min(90, initialDipAmountDeg))));
    setPullLengthM(Math.max(1.5, Math.min(20, Number(excavationPullLengthM) || 4.0)));
    setIsLocked(false);
    hasAbsoluteMagnetometerRef.current = false;
    hasGenericQuaternionSensorRef.current = false;
    sinAzBufferRef.current = [];
    cosAzBufferRef.current = [];
    sinHeadBufferRef.current = [];
    cosHeadBufferRef.current = [];
    dipBufferRef.current = [];
  }, [isOpen, initialDipDirectionDeg, initialDipAmountDeg, excavationPullLengthM]);

  // 1. STRICT SCREEN ROTATION LOCK ON ANDROID APK / MOBILE
  useEffect(() => {
    if (!isOpen) return;
    let unlocked = false;

    const lockScreenOrientation = async () => {
      try {
        if ((window as any).AndroidBridge?.lockOrientation) {
          (window as any).AndroidBridge.lockOrientation('current');
          if (!unlocked) setRotationLockStatus('LOCKED');
          return;
        }
        const scrOri = (window.screen as any)?.orientation;
        if (scrOri && typeof scrOri.lock === 'function') {
          const currentType = scrOri.type || (window.innerWidth > window.innerHeight ? 'landscape-primary' : 'portrait-primary');
          await scrOri.lock(currentType);
          if (!unlocked) setRotationLockStatus('LOCKED');
          return;
        }
      } catch {}
      if (!unlocked) setRotationLockStatus('ACTIVE_CSS_LOCK');
    };

    lockScreenOrientation();

    return () => {
      unlocked = true;
      try {
        if ((window as any).AndroidBridge?.unlockOrientation) {
          (window as any).AndroidBridge.unlockOrientation();
        }
        const scrOri = (window.screen as any)?.orientation;
        if (scrOri && typeof scrOri.unlock === 'function') {
          scrOri.unlock();
        }
      } catch {}
    };
  }, [isOpen]);

  // 2. FIELDMOVE CLINO TRUE-NORTH HARDWARE MAGNETOMETER ENGINE
  //    Supports both Android Generic Sensor API (`AbsoluteOrientationSensor` quaternion)
  //    and W3C `deviceorientationabsolute` with tilt-invariant North compensation
  useEffect(() => {
    if (!isOpen || isLocked) return;

    const resolveEffectiveScreenAngle = (): number => {
      if (visualScreenAxisMode === 'PORTRAIT') return 0;
      if (visualScreenAxisMode === 'LANDSCAPE') return 90;
      if (typeof window !== 'undefined') {
        const scrAngle = window.screen?.orientation?.angle;
        if (typeof scrAngle === 'number') return scrAngle;
        const winOri = (window as any).orientation;
        if (typeof winOri === 'number') return winOri;
        if (window.innerWidth > window.innerHeight) return 90;
      }
      return 0;
    };

    const applySmoothedReading = (computed: {
      compassHeadingDeg: number;
      dipDirectionDeg: number;
      dipAmountDeg: number;
      bubbleX: number;
      bubbleY: number;
    }) => {
      const azRad = (computed.dipDirectionDeg * Math.PI) / 180;
      const headRad = (computed.compassHeadingDeg * Math.PI) / 180;

      sinAzBufferRef.current.push(Math.sin(azRad));
      cosAzBufferRef.current.push(Math.cos(azRad));
      sinHeadBufferRef.current.push(Math.sin(headRad));
      cosHeadBufferRef.current.push(Math.cos(headRad));
      dipBufferRef.current.push(computed.dipAmountDeg);

      if (sinAzBufferRef.current.length > 6) {
        sinAzBufferRef.current.shift();
        cosAzBufferRef.current.shift();
      }
      if (sinHeadBufferRef.current.length > 6) {
        sinHeadBufferRef.current.shift();
        cosHeadBufferRef.current.shift();
      }
      if (dipBufferRef.current.length > 6) {
        dipBufferRef.current.shift();
      }

      const avgSinAz =
        sinAzBufferRef.current.reduce((a, b) => a + b, 0) / sinAzBufferRef.current.length;
      const avgCosAz =
        cosAzBufferRef.current.reduce((a, b) => a + b, 0) / cosAzBufferRef.current.length;
      const smoothedDipDir =
        Math.round(((Math.atan2(avgSinAz, avgCosAz) * 180) / Math.PI + 360) % 360) % 360;

      const avgSinHead =
        sinHeadBufferRef.current.reduce((a, b) => a + b, 0) / sinHeadBufferRef.current.length;
      const avgCosHead =
        cosHeadBufferRef.current.reduce((a, b) => a + b, 0) / cosHeadBufferRef.current.length;
      const smoothedHeading =
        Math.round(((Math.atan2(avgSinHead, avgCosHead) * 180) / Math.PI + 360) % 360) % 360;

      const smoothedDipAmt = Math.round(
        dipBufferRef.current.reduce((a, b) => a + b, 0) / dipBufferRef.current.length
      );

      setCompassHeadingDeg(smoothedHeading);
      setDipDirectionDeg(smoothedDipDir);
      setDipAmountDeg(Math.max(0, Math.min(90, smoothedDipAmt)));
      setBubblePos({ x: computed.bubbleX, y: computed.bubbleY });
    };

    // A. Try Android Hardware Quaternion Sensor (`AbsoluteOrientationSensor`) first for highest North accuracy
    let absQuatSensor: any = null;
    try {
      const AbsSensorCtor = (window as any).AbsoluteOrientationSensor;
      if (typeof AbsSensorCtor === 'function') {
        absQuatSensor = new AbsSensorCtor({ frequency: 30, referenceFrame: 'device' });
        absQuatSensor.addEventListener('reading', () => {
          const q = absQuatSensor?.quaternion;
          if (!q || q.length < 4) return;
          const [qx, qy, qz, qw] = q;
          hasGenericQuaternionSensorRef.current = true;
          hasAbsoluteMagnetometerRef.current = true;
          setSensorSourceType('ABSOLUTE_MAGNETOMETER');

          // Convert quaternion (qx, qy, qz, qw) directly to 3x3 ENU rotation matrix columns
          const rEx = 1 - 2 * (qy * qy + qz * qz);
          const rNx = 2 * (qx * qy + qz * qw);
          const rUx = 2 * (qx * qz - qy * qw);

          const rEy = 2 * (qx * qy - qz * qw);
          const rNy = 1 - 2 * (qx * qx + qz * qz);
          const rUy = 2 * (qy * qz + qx * qw);

          const rEz = 2 * (qx * qz + qy * qw);
          const rNz = 2 * (qy * qz - qx * qw);
          const rUz = 1 - 2 * (qx * qx + qy * qy);

          const scrAngle = resolveEffectiveScreenAngle();
          setDetectedScreenAngleDeg(scrAngle);

          const computed = computeFieldMoveFromEnuColumns(
            rEx,
            rNx,
            rUx,
            rEy,
            rNy,
            rUy,
            rEz,
            rNz,
            rUz,
            scrAngle,
            northOffsetDeg,
            clinoMeasureMode
          );
          applySmoothedReading(computed);
        });
        absQuatSensor.addEventListener('error', () => {
          hasGenericQuaternionSensorRef.current = false;
        });
        absQuatSensor.start();
      }
    } catch {}

    // B. W3C `deviceorientationabsolute` + `deviceorientation` fallback
    const processSensorEvent = (e: DeviceOrientationEvent, isFromAbsoluteListener: boolean) => {
      if (hasGenericQuaternionSensorRef.current) return;
      if (e.alpha === null && e.beta === null && e.gamma === null) return;

      const webkitHeading = (e as any).webkitCompassHeading;
      const isTrueAbsolute =
        isFromAbsoluteListener || e.absolute === true || typeof webkitHeading === 'number';

      if (isTrueAbsolute) {
        hasAbsoluteMagnetometerRef.current = true;
        setSensorSourceType('ABSOLUTE_MAGNETOMETER');
      } else {
        if (hasAbsoluteMagnetometerRef.current) {
          return;
        }
        setSensorSourceType('RELATIVE_GYRO');
      }

      const rawAlpha = e.alpha ?? 0;
      const rawBeta = e.beta ?? 0;
      const rawGamma = e.gamma ?? 0;
      const effectiveAlpha =
        typeof webkitHeading === 'number' ? (360 - webkitHeading + 360) % 360 : rawAlpha;

      const scrAngle = resolveEffectiveScreenAngle();
      setDetectedScreenAngleDeg(scrAngle);

      const computed = computeFieldMoveClinoAndCompassOrientation(
        effectiveAlpha,
        rawBeta,
        rawGamma,
        scrAngle,
        northOffsetDeg,
        clinoMeasureMode
      );

      applySmoothedReading(computed);
    };

    const onAbsoluteOrientation = (e: DeviceOrientationEvent) => processSensorEvent(e, true);
    const onRelativeOrientation = (e: DeviceOrientationEvent) => processSensorEvent(e, false);

    window.addEventListener('deviceorientationabsolute' as any, onAbsoluteOrientation, true);
    window.addEventListener('deviceorientation', onRelativeOrientation, true);

    return () => {
      try {
        if (absQuatSensor && typeof absQuatSensor.stop === 'function') {
          absQuatSensor.stop();
        }
      } catch {}
      window.removeEventListener('deviceorientationabsolute' as any, onAbsoluteOrientation, true);
      window.removeEventListener('deviceorientation', onRelativeOrientation, true);
    };
  }, [isOpen, isLocked, visualScreenAxisMode, northOffsetDeg, clinoMeasureMode]);

  // Derived Strike (Right-Hand Rule = Dip Direction - 90°), Screen Top Azimuth, and Cardinal Label
  const strikeRhrDeg = useMemo(
    () => Math.round(((dipDirectionDeg - 90) % 360 + 360) % 360),
    [dipDirectionDeg]
  );
  const screenTopDeg = useMemo(
    () => Math.round(((compassHeadingDeg) % 360 + 360) % 360),
    [compassHeadingDeg]
  );
  const cardinalLabel = useMemo(() => getCardinalDirectionLabel(dipDirectionDeg), [dipDirectionDeg]);
  const headingCardinalLabel = useMemo(
    () => getCardinalDirectionLabel(compassHeadingDeg),
    [compassHeadingDeg]
  );
  const steepnessLabel = useMemo(() => getInclinometerSteepnessLabel(dipAmountDeg), [dipAmountDeg]);

  // ============================================================================
  // LEFT SCREEN: 3D TUNNEL WITH EXACT SHAPE, SIZE, WALLS, CROWN & PULL LENGTH
  //              (IDEAL POSITION: FACE BEHIND WALL & CROWN)
  //              + FREE-ORIENTING 3D JOINT PLANE & LIVE TRACE BY REAL COMPASS
  // ============================================================================
  const mount3DRef = useRef<HTMLDivElement | null>(null);
  const innerJointRibbonGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const outerJointRibbonGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const innerJointBorderGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const outerJointBorderGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const dipTickLinesGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const liveTraceRibbonGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const liveTraceCenterLineGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const mappedTracePts3DRef = useRef<THREE.Vector3[]>([]);
  const inwardSurfaceNormalRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 1));
  const traceArcLengthMRef = useRef<number>(3.0);
  const [tracedLengthMeters, setTracedLengthMeters] = useState<number>(3.0);
  const [showOkChoiceModal, setShowOkChoiceModal] = useState<boolean>(false);

  // Stable string signature for tracePoints2D so parent array literals ([] or .map()) never trigger infinite WebGL recreation
  const tracePointsSignature = useMemo(() => {
    if (!tracePoints2D || tracePoints2D.length === 0) return 'default';
    return tracePoints2D
      .map(
        (p) =>
          `${Math.round(p.x * 10)}:${Math.round(p.y * 10)}:${
            typeof p.xM === 'number' ? p.xM.toFixed(2) : ''
          }:${typeof p.yM === 'number' ? p.yM.toFixed(2) : ''}`
      )
      .join('|');
  }, [tracePoints2D]);

  // Compute the 2D trace points aligned to the current real compass Dip Direction & Dip Amount
  const compassAligned2D = useMemo(
    () =>
      computeCompassAlignedTracePoints2D(
        tracePoints2D,
        activePanel,
        dipDirectionDeg,
        dipAmountDeg,
        tunnelDriveAzimuthDeg
      ),
    [tracePointsSignature, activePanel, dipDirectionDeg, dipAmountDeg, tunnelDriveAzimuthDeg]
  );

  const handleConfirmWithMode = (applyMode: 'DATA_ONLY' | 'TRACE_AND_DATA') => {
    setShowOkChoiceModal(false);
    onConfirmOrientation(dipDirectionDeg, dipAmountDeg, strikeRhrDeg, {
      applyMode,
      alignedPoints2D: compassAligned2D.alignedPoints2D,
      rotationDeltaRad: compassAligned2D.rotationDeltaRad,
    });
    onClose();
  };

  const updateTracedLengthRibbonBuffers = React.useCallback(
    (currDipDirDeg: number, currDipAmtDeg: number, currPullLenM: number) => {
      const pts = mappedTracePts3DRef.current;
      const innerGeo = innerJointRibbonGeoRef.current;
      const outerGeo = outerJointRibbonGeoRef.current;
      const innerBorderGeo = innerJointBorderGeoRef.current;
      const outerBorderGeo = outerJointBorderGeoRef.current;
      const dipTicksGeo = dipTickLinesGeoRef.current;
      const liveTraceRibbonGeo = liveTraceRibbonGeoRef.current;
      const liveTraceLineGeo = liveTraceCenterLineGeoRef.current;
      if (
        !pts ||
        pts.length < 2 ||
        !innerGeo ||
        !outerGeo ||
        !innerBorderGeo ||
        !outerBorderGeo ||
        !dipTicksGeo
      ) {
        return;
      }

      const normAzDeg = ((currDipDirDeg % 360) + 360) % 360;
      const azRad = (normAzDeg * Math.PI) / 180;
      const dipRad = (Math.max(0, Math.min(90, currDipAmtDeg)) * Math.PI) / 180;

      // 1. True 3D Joint Plane Normal from Real Compass (Dip Direction = currDipDirDeg, Dip Amount = currDipAmtDeg)
      const planeNormal = new THREE.Vector3(
        Math.sin(dipRad) * Math.sin(azRad),
        Math.cos(dipRad),
        -Math.sin(dipRad) * Math.cos(azRad)
      ).normalize();

      const inwardNormal = inwardSurfaceNormalRef.current;
      const nPts = pts.length;

      // 2. Compute 3D Centroid & Original Drawn Chord Frame on the Active Tunnel Panel
      const centroid = new THREE.Vector3();
      for (let i = 0; i < nPts; i++) {
        centroid.add(pts[i]);
      }
      centroid.divideScalar(nPts);

      const origTangent = new THREE.Vector3().subVectors(pts[nPts - 1], pts[0]);
      if (origTangent.lengthSq() < 1e-5) {
        origTangent.set(1, 0, 0);
      } else {
        origTangent.normalize();
      }
      const origBitangent = new THREE.Vector3()
        .crossVectors(inwardNormal, origTangent)
        .normalize();

      // 3. Compute Free-Orienting Live 3D Trace Tangent on the Active Panel from Real Compass (currDipDirDeg, currDipAmtDeg)
      // Dip Amount (0°..90°) directly tilts the trace from 0° (horizontal) to 90° (vertical) at all compass directions,
      // and Dip Direction (000°..360°) controls the compass direction and left/right slope orientation.
      const slopeSign = normAzDeg > 180 ? -1 : 1;
      const liveTraceTangent = new THREE.Vector3();
      if (Math.abs(inwardNormal.y) > 0.7) {
        // Crown panel: trace rotates full 360° with compass Dip Direction
        liveTraceTangent.set(Math.cos(azRad), 0, Math.sin(azRad));
      } else if (Math.abs(inwardNormal.x) > 0.7) {
        // Left or Right Wall panel: trace tilts by dipRad along Z-Y wall plane
        liveTraceTangent.set(0, -Math.sin(dipRad) * slopeSign, Math.cos(dipRad));
      } else {
        // Tunnel Face panel: trace tilts directly by dipRad (0° horizontal .. 90° vertical)
        liveTraceTangent.set(Math.cos(dipRad), -Math.sin(dipRad) * slopeSign, 0);
      }
      liveTraceTangent.normalize();

      const liveBitangent = new THREE.Vector3()
        .crossVectors(inwardNormal, liveTraceTangent)
        .normalize();

      // 4. Construct Live-Oriented 3D Trace Points centered at `centroid` with exact traced length & curve offsets
      const livePts: THREE.Vector3[] = [];
      for (let i = 0; i < nPts; i++) {
        const rel = new THREE.Vector3().subVectors(pts[i], centroid);
        const u = rel.dot(origTangent);
        const v = rel.dot(origBitangent);
        const pLive = new THREE.Vector3()
          .copy(centroid)
          .addScaledVector(liveTraceTangent, u)
          .addScaledVector(liveBitangent, v);
        livePts.push(pLive);
      }

      // 5. 3D Dip Extension Vector (50% inside tunnel / 50% outside tunnel) driven by Dip Direction & Dip Amount
      let extDir = new THREE.Vector3().crossVectors(planeNormal, liveTraceTangent);
      const compassHorizDir = new THREE.Vector3(
        Math.sin(azRad),
        -Math.sin(dipRad) * 0.5,
        -Math.cos(azRad)
      ).normalize();
      extDir.addScaledVector(compassHorizDir, 0.45);
      if (extDir.lengthSq() < 1e-4) {
        extDir.set(Math.sin(azRad), -Math.sin(dipRad), -Math.cos(azRad));
      }
      extDir.normalize();

      if (extDir.dot(inwardNormal) < 0) {
        extDir.negate();
      }

      const traceLen = traceArcLengthMRef.current || 3.0;
      const halfDepth = Math.max(0.9, Math.min(currPullLenM * 0.55, traceLen * 0.55));

      const innerPositions: number[] = [];
      const outerPositions: number[] = [];
      const traceStripPositions: number[] = [];
      const indices: number[] = [];
      const traceHalfW = 0.09;

      for (let i = 0; i < nPts; i++) {
        const p = livePts[i];
        const pIn = new THREE.Vector3().copy(p).addScaledVector(extDir, halfDepth);
        const pOut = new THREE.Vector3().copy(p).addScaledVector(extDir, -halfDepth);

        innerPositions.push(p.x, p.y, p.z);
        innerPositions.push(pIn.x, pIn.y, pIn.z);

        outerPositions.push(p.x, p.y, p.z);
        outerPositions.push(pOut.x, pOut.y, pOut.z);

        const pT1 = new THREE.Vector3()
          .copy(p)
          .addScaledVector(liveBitangent, traceHalfW)
          .addScaledVector(inwardNormal, 0.02);
        const pT2 = new THREE.Vector3()
          .copy(p)
          .addScaledVector(liveBitangent, -traceHalfW)
          .addScaledVector(inwardNormal, 0.02);
        traceStripPositions.push(pT1.x, pT1.y, pT1.z);
        traceStripPositions.push(pT2.x, pT2.y, pT2.z);

        if (i < nPts - 1) {
          const a = i * 2;
          const b = a + 1;
          const c = (i + 1) * 2;
          const d = c + 1;
          indices.push(a, b, d);
          indices.push(a, d, c);
        }
      }

      innerGeo.setAttribute('position', new THREE.Float32BufferAttribute(innerPositions, 3));
      innerGeo.setIndex(indices);
      innerGeo.computeVertexNormals();

      outerGeo.setAttribute('position', new THREE.Float32BufferAttribute(outerPositions, 3));
      outerGeo.setIndex(indices);
      outerGeo.computeVertexNormals();

      if (liveTraceRibbonGeo) {
        liveTraceRibbonGeo.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(traceStripPositions, 3)
        );
        liveTraceRibbonGeo.setIndex(indices);
        liveTraceRibbonGeo.computeVertexNormals();
      }
      if (liveTraceLineGeo) {
        liveTraceLineGeo.setFromPoints(livePts);
      }

      const innerBorderPts: THREE.Vector3[] = [];
      for (let i = 0; i < nPts; i++) innerBorderPts.push(livePts[i]);
      for (let i = nPts - 1; i >= 0; i--) {
        innerBorderPts.push(new THREE.Vector3().copy(livePts[i]).addScaledVector(extDir, halfDepth));
      }
      innerBorderPts.push(livePts[0]);
      innerBorderGeo.setFromPoints(innerBorderPts);

      const outerBorderPts: THREE.Vector3[] = [];
      for (let i = 0; i < nPts; i++) outerBorderPts.push(livePts[i]);
      for (let i = nPts - 1; i >= 0; i--) {
        outerBorderPts.push(new THREE.Vector3().copy(livePts[i]).addScaledVector(extDir, -halfDepth));
      }
      outerBorderPts.push(livePts[0]);
      outerBorderGeo.setFromPoints(outerBorderPts);

      const tickPts: THREE.Vector3[] = [];
      const tickIndices = [
        0,
        Math.floor(nPts * 0.25),
        Math.floor(nPts * 0.5),
        Math.floor(nPts * 0.75),
        nPts - 1,
      ];
      tickIndices.forEach((idx) => {
        const p = livePts[idx];
        if (!p) return;
        tickPts.push(new THREE.Vector3().copy(p).addScaledVector(extDir, -halfDepth));
        tickPts.push(new THREE.Vector3().copy(p).addScaledVector(extDir, halfDepth));
      });
      dipTicksGeo.setFromPoints(tickPts);
    },
    [tunnelDriveAzimuthDeg]
  );

  // Build 3D Tunnel Scene (Exact Shape, Width, Height, Wall, Crown, Pull Length, Face behind Wall & Crown)
  useEffect(() => {
    if (!isOpen || !mount3DRef.current) return;
    const container = mount3DRef.current;
    const width = Math.max(280, container.clientWidth || 540);
    const height = Math.max(280, container.clientHeight || 480);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060a12);

    const spanW = Math.max(2.5, Number(excavationWidthM) || 8.5);
    const spanH = Math.max(2.5, Number(excavationHeightM) || 7.5);
    const pullL = Math.max(1.5, Number(pullLengthM) || 4.0);
    const halfW = spanW / 2;
    const halfH = spanH / 2;
    const halfPull = pullL / 2;

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 250);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
    } catch {
      return;
    }

    // Three-point studio lighting
    scene.add(new THREE.AmbientLight(0xe2e8f0, 0.85));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
    keyLight.position.set(spanW * 1.2, spanH * 1.6, pullL * 1.8);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rimLight.position.set(-spanW * 1.2, spanH * 0.8, -pullL * 1.5);
    scene.add(rimLight);

    // Reference Floor Grid beneath tunnel invert
    const gridSpan = Math.max(spanW, pullL) * 2.4;
    const gridHelper = new THREE.GridHelper(gridSpan, 18, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -halfH - 0.02;
    scene.add(gridHelper);

    const tunnelGroup = new THREE.Group();

    // 1. Construct Exact 2D Tunnel Cross-Section Profile (Left Wall + Crown Arch + Right Wall)
    const profilePts = buildTunnelCrossSectionProfilePoints(
      spanW,
      spanH,
      excavationWallHeightM,
      excavationShape || 'horseshoe'
    );

    const openArchPts = profilePts.slice(0, profilePts.length - 1);

    const wallCrownVertices: number[] = [];
    const wallCrownIndices: number[] = [];
    const numSegs = openArchPts.length - 1;
    const pullSteps = Math.max(4, Math.round(pullL));

    for (let j = 0; j <= pullSteps; j++) {
      const z = -halfPull + (j / pullSteps) * pullL;
      for (let i = 0; i <= numSegs; i++) {
        const pt = openArchPts[i];
        wallCrownVertices.push(pt.x, pt.y, z);
      }
    }

    const rowStride = numSegs + 1;
    for (let j = 0; j < pullSteps; j++) {
      for (let i = 0; i < numSegs; i++) {
        const a = j * rowStride + i;
        const b = a + 1;
        const c = (j + 1) * rowStride + i;
        const d = c + 1;
        wallCrownIndices.push(a, b, d);
        wallCrownIndices.push(a, d, c);
      }
    }

    const wallCrownGeo = new THREE.BufferGeometry();
    wallCrownGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallCrownVertices, 3));
    wallCrownGeo.setIndex(wallCrownIndices);
    wallCrownGeo.computeVertexNormals();

    const wallCrownMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.65,
      metalness: 0.15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    tunnelGroup.add(new THREE.Mesh(wallCrownGeo, wallCrownMat));

    for (let j = 0; j <= pullSteps; j++) {
      const z = -halfPull + (j / pullSteps) * pullL;
      const isFaceArch = j === 0;
      const isFrontArch = j === pullSteps;
      const ribPts3D = openArchPts.map((p) => new THREE.Vector3(p.x, p.y, z));
      const ribGeo = new THREE.BufferGeometry().setFromPoints(ribPts3D);
      const ribMat = new THREE.LineBasicMaterial({
        color: isFaceArch ? 0x22d3ee : isFrontArch ? 0x38bdf8 : 0x334155,
        transparent: true,
        opacity: isFaceArch || isFrontArch ? 0.95 : 0.55,
      });
      tunnelGroup.add(new THREE.Line(ribGeo, ribMat));
    }

    const effectiveWallH =
      typeof excavationWallHeightM === 'number' && excavationWallHeightM > 0.2
        ? excavationWallHeightM
        : spanH * 0.52;
    const springY = -halfH + effectiveWallH;
    const keySectionPoints: { x: number; y: number; color: number }[] = [
      { x: -halfW, y: -halfH, color: 0x475569 },
      { x: -halfW, y: springY, color: 0x38bdf8 },
      { x: 0, y: halfH, color: 0x38bdf8 },
      { x: halfW, y: springY, color: 0x38bdf8 },
      { x: halfW, y: -halfH, color: 0x475569 },
    ];
    keySectionPoints.forEach((kp) => {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(kp.x, kp.y, -halfPull),
        new THREE.Vector3(kp.x, kp.y, halfPull),
      ]);
      tunnelGroup.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: kp.color })));
    });

    // 2. TUNNEL FACE AT THE BACK OF THE PULL LENGTH (z = -halfPull, positioned BEHIND Left Wall, Right Wall & Crown!)
    const faceShape = new THREE.Shape(profilePts);
    const faceGeo = new THREE.ShapeGeometry(faceShape);
    faceGeo.translate(0, 0, -halfPull);
    const faceMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.75,
      metalness: 0.1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    tunnelGroup.add(new THREE.Mesh(faceGeo, faceMat));

    const faceGridPts: THREE.Vector3[] = [];
    for (let gx = -Math.floor(halfW); gx <= Math.floor(halfW); gx += 1) {
      faceGridPts.push(new THREE.Vector3(gx, -halfH, -halfPull + 0.01));
      faceGridPts.push(new THREE.Vector3(gx, halfH * 0.85, -halfPull + 0.01));
    }
    for (let gy = -Math.floor(halfH); gy <= Math.floor(halfH); gy += 1) {
      faceGridPts.push(new THREE.Vector3(-halfW * 0.92, gy, -halfPull + 0.01));
      faceGridPts.push(new THREE.Vector3(halfW * 0.92, gy, -halfPull + 0.01));
    }
    const faceGridGeo = new THREE.BufferGeometry().setFromPoints(faceGridPts);
    tunnelGroup.add(
      new THREE.LineSegments(
        faceGridGeo,
        new THREE.LineBasicMaterial({ color: 0x1e3a8a, transparent: true, opacity: 0.45 })
      )
    );

    // 3. Map User's Drawn 2D Trace onto the Active 3D Surface
    const panelClean = (activePanel || 'face').toLowerCase();
    const tracePts3D: THREE.Vector3[] = [];

    if (panelClean === 'left_wall' || panelClean === 'leftwall') {
      inwardSurfaceNormalRef.current.set(1, 0, 0);
      if (tracePoints2D && tracePoints2D.length >= 2) {
        tracePoints2D.forEach((pt) => {
          const nz = ((pt.x - 500) / 360) * halfPull;
          const ny = ((500 - pt.y) / 360) * (effectiveWallH / 2);
          const wz = Math.max(-halfPull * 0.95, Math.min(halfPull * 0.95, nz));
          const wy = Math.max(-halfH, Math.min(springY, -halfH + effectiveWallH / 2 + ny));
          tracePts3D.push(new THREE.Vector3(-halfW, wy, wz));
        });
      } else {
        tracePts3D.push(
          new THREE.Vector3(-halfW, -halfH + effectiveWallH * 0.25, -halfPull * 0.4),
          new THREE.Vector3(-halfW, -halfH + effectiveWallH * 0.75, halfPull * 0.4)
        );
      }
    } else if (panelClean === 'right_wall' || panelClean === 'rightwall') {
      inwardSurfaceNormalRef.current.set(-1, 0, 0);
      if (tracePoints2D && tracePoints2D.length >= 2) {
        tracePoints2D.forEach((pt) => {
          const nz = ((pt.x - 500) / 360) * halfPull;
          const ny = ((500 - pt.y) / 360) * (effectiveWallH / 2);
          const wz = Math.max(-halfPull * 0.95, Math.min(halfPull * 0.95, nz));
          const wy = Math.max(-halfH, Math.min(springY, -halfH + effectiveWallH / 2 + ny));
          tracePts3D.push(new THREE.Vector3(halfW, wy, wz));
        });
      } else {
        tracePts3D.push(
          new THREE.Vector3(halfW, -halfH + effectiveWallH * 0.25, -halfPull * 0.4),
          new THREE.Vector3(halfW, -halfH + effectiveWallH * 0.75, halfPull * 0.4)
        );
      }
    } else if (panelClean === 'crown') {
      inwardSurfaceNormalRef.current.set(0, -1, 0);
      const archH = Math.max(0.5, spanH - effectiveWallH);
      if (tracePoints2D && tracePoints2D.length >= 2) {
        tracePoints2D.forEach((pt) => {
          const nx = Math.max(-0.92, Math.min(0.92, (pt.x - 500) / 360));
          const nz = Math.max(-0.92, Math.min(0.92, (500 - pt.y) / 360));
          const wx = nx * halfW;
          const wz = -nz * halfPull;
          const wy = springY + archH * Math.sqrt(Math.max(0, 1 - nx * nx));
          tracePts3D.push(new THREE.Vector3(wx, wy, wz));
        });
      } else {
        tracePts3D.push(
          new THREE.Vector3(-halfW * 0.45, springY + archH * 0.88, -halfPull * 0.35),
          new THREE.Vector3(0, halfH, 0),
          new THREE.Vector3(halfW * 0.45, springY + archH * 0.88, halfPull * 0.35)
        );
      }
    } else {
      inwardSurfaceNormalRef.current.set(0, 0, 1);
      if (tracePoints2D && tracePoints2D.length >= 2) {
        tracePoints2D.forEach((pt) => {
          let wx: number;
          let wy: number;
          if (typeof pt.xM === 'number' && typeof pt.yM === 'number') {
            wx = Math.max(-halfW * 0.95, Math.min(halfW * 0.95, pt.xM));
            wy = Math.max(-halfH * 0.95, Math.min(halfH * 0.95, pt.yM - halfH));
          } else {
            const nx = (pt.x - 500) / 360;
            const ny = (500 - pt.y) / 360;
            wx = Math.max(-halfW * 0.92, Math.min(halfW * 0.92, nx * halfW));
            wy = Math.max(-halfH * 0.92, Math.min(halfH * 0.92, ny * halfH));
          }
          tracePts3D.push(new THREE.Vector3(wx, wy, -halfPull));
        });
      } else {
        tracePts3D.push(
          new THREE.Vector3(-halfW * 0.42, -halfH * 0.18, -halfPull),
          new THREE.Vector3(0, halfH * 0.06, -halfPull),
          new THREE.Vector3(halfW * 0.42, halfH * 0.28, -halfPull)
        );
      }
    }

    const traceCurve = new THREE.CatmullRomCurve3(tracePts3D);
    const sampledPts = traceCurve.getPoints(24);
    mappedTracePts3DRef.current = sampledPts;
    const totalLen = Number(traceCurve.getLength().toFixed(2));
    const clampedLen = Number(Math.max(0.5, totalLen).toFixed(2));
    traceArcLengthMRef.current = clampedLen;
    setTracedLengthMeters((prev) => (prev === clampedLen ? prev : clampedLen));

    // Subtle reference line showing the original drawn trace position on the 3D surface
    const origDrawnLineGeo = new THREE.BufferGeometry().setFromPoints(sampledPts);
    const origDrawnLineMat = new THREE.LineDashedMaterial({
      color: 0x94a3b8,
      dashSize: 0.22,
      gapSize: 0.14,
      transparent: true,
      opacity: 0.65,
    });
    const origDrawnLine = new THREE.Line(origDrawnLineGeo, origDrawnLineMat);
    origDrawnLine.computeLineDistances();
    tunnelGroup.add(origDrawnLine);

    // Live-orienting 3D Joint Trace Ribbon & Center Line (rotates freely with real compass Dip Direction & Dip Amount!)
    const liveTraceRibbonGeo = new THREE.BufferGeometry();
    const liveTraceLineGeo = new THREE.BufferGeometry();
    liveTraceRibbonGeoRef.current = liveTraceRibbonGeo;
    liveTraceCenterLineGeoRef.current = liveTraceLineGeo;

    const liveTraceRibbonMesh = new THREE.Mesh(
      liveTraceRibbonGeo,
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.9,
        roughness: 0.2,
        side: THREE.DoubleSide,
      })
    );
    const liveTraceCenterLine = new THREE.Line(
      liveTraceLineGeo,
      new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 })
    );
    tunnelGroup.add(liveTraceRibbonMesh);
    tunnelGroup.add(liveTraceCenterLine);

    const innerGeo = new THREE.BufferGeometry();
    const outerGeo = new THREE.BufferGeometry();
    const innerBorderGeo = new THREE.BufferGeometry();
    const outerBorderGeo = new THREE.BufferGeometry();
    const dipTicksGeo = new THREE.BufferGeometry();

    innerJointRibbonGeoRef.current = innerGeo;
    outerJointRibbonGeoRef.current = outerGeo;
    innerJointBorderGeoRef.current = innerBorderGeo;
    outerJointBorderGeoRef.current = outerBorderGeo;
    dipTickLinesGeoRef.current = dipTicksGeo;

    const innerMesh = new THREE.Mesh(
      innerGeo,
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.3,
        metalness: 0.1,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
      })
    );
    const outerMesh = new THREE.Mesh(
      outerGeo,
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        roughness: 0.35,
        metalness: 0.1,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.46,
      })
    );
    const innerBorderLine = new THREE.Line(
      innerBorderGeo,
      new THREE.LineBasicMaterial({ color: 0xfef08a, linewidth: 2 })
    );
    const outerBorderLine = new THREE.Line(
      outerBorderGeo,
      new THREE.LineBasicMaterial({ color: 0x22d3ee, linewidth: 2 })
    );
    const dipTickLines = new THREE.LineSegments(
      dipTicksGeo,
      new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 })
    );

    tunnelGroup.add(innerMesh);
    tunnelGroup.add(outerMesh);
    tunnelGroup.add(innerBorderLine);
    tunnelGroup.add(outerBorderLine);
    tunnelGroup.add(dipTickLines);

    scene.add(tunnelGroup);

    // Populate initial 3D joint plane ribbon immediately
    updateTracedLengthRibbonBuffers(dipDirectionDeg, dipAmountDeg, pullL);

    let isOrbitDragging = false;
    let prevX = 0;
    let prevY = 0;
    let sphericalTheta = 0.22;
    let sphericalPhi = 1.34;
    const orbitRadius = Math.max(spanW, spanH) * 1.65 + pullL * 0.65;

    const updateCameraOrbit = () => {
      camera.position.x = orbitRadius * Math.sin(sphericalPhi) * Math.sin(sphericalTheta);
      camera.position.y = orbitRadius * Math.cos(sphericalPhi);
      camera.position.z = orbitRadius * Math.sin(sphericalPhi) * Math.cos(sphericalTheta);
      camera.lookAt(0, 0, -halfPull * 0.25);
    };
    updateCameraOrbit();

    const domEl = renderer.domElement;
    const onPointerDown = (ev: PointerEvent) => {
      isOrbitDragging = true;
      prevX = ev.clientX;
      prevY = ev.clientY;
    };
    const onPointerMove = (ev: PointerEvent) => {
      if (!isOrbitDragging) return;
      const dx = ev.clientX - prevX;
      const dy = ev.clientY - prevY;
      prevX = ev.clientX;
      prevY = ev.clientY;
      sphericalTheta -= dx * 0.008;
      sphericalPhi = Math.max(0.25, Math.min(Math.PI - 0.25, sphericalPhi - dy * 0.008));
      updateCameraOrbit();
    };
    const onPointerUp = () => {
      isOrbitDragging = false;
    };

    domEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    let animFrameId = 0;
    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = Math.max(260, container.clientWidth);
      const h = Math.max(260, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameId);
      domEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [
    isOpen,
    domainMode,
    excavationWidthM,
    excavationHeightM,
    excavationWallHeightM,
    pullLengthM,
    excavationShape,
    activePanel,
    tracePointsSignature,
    cameraResetCounter,
    updateTracedLengthRibbonBuffers,
  ]);

  // Dynamically update the Traced-Length-Only 3D Joint Plane (50% Inside Tunnel / 50% Outside Tunnel)
  useEffect(() => {
    if (!isOpen) return;
    updateTracedLengthRibbonBuffers(dipDirectionDeg, dipAmountDeg, pullLengthM);
  }, [
    isOpen,
    dipDirectionDeg,
    dipAmountDeg,
    pullLengthM,
    tracePointsSignature,
    activePanel,
    updateTracedLengthRibbonBuffers,
  ]);

  // ============================================================================
  // RIGHT SCREEN: FIELDMOVE CLINO COMPASS & CLINOMETER HANDLERS
  // ============================================================================
  const updateDipDirectionFromCompassPointer = (clientX: number, clientY: number) => {
    const svg = compassSvgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    // Account for the rotated compass rose (-compassHeadingDeg) so touching a degree on the ring selects that exact degree
    const screenAngleDeg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    const degFromNorth = Math.round((screenAngleDeg + compassHeadingDeg) % 360) % 360;
    setDipDirectionDeg(degFromNorth);
  };

  const updateDipAmountFromInclinometerPointer = (clientX: number, clientY: number) => {
    const svg = inclinometerSvgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const pivotX = rect.left + rect.width * 0.16;
    const pivotY = rect.top + rect.height * 0.18;
    const dx = Math.max(1, clientX - pivotX);
    const dy = Math.max(0, clientY - pivotY);
    const deg = Math.round(Math.max(0, Math.min(90, (Math.atan2(dy, dx) * 180) / Math.PI)));
    setDipAmountDeg(deg);
  };

  if (!isOpen) return null;

  // FieldMove Clino Dial Geometry:
  // The entire Compass Rose ring (N 000°, E 090°, S 180°, W 270°, degree ticks, and Red/White North-South needle)
  // rotates by `-compassHeadingDeg` so Red "N 000°" on screen ALWAYS points to Real Physical North in the room!
  // Inside that rotating ring, the Strike line & Down-Dip tick are drawn at `dipDirectionDeg` and `strikeRhrDeg`.
  const cx = 130;
  const cy = 130;
  const dipRadInRose = ((dipDirectionDeg - 90) * Math.PI) / 180;
  const strikeRadInRose = dipRadInRose + Math.PI / 2;

  const strikeLx = cx + 86 * Math.cos(strikeRadInRose);
  const strikeLy = cy + 86 * Math.sin(strikeRadInRose);
  const strikeRx = cx - 86 * Math.cos(strikeRadInRose);
  const strikeRy = cy - 86 * Math.sin(strikeRadInRose);

  // Down-dip tick triangle & line (FieldMove Clino style) extending from center in dipDirectionDeg
  const dipTickTipX = cx + 76 * Math.cos(dipRadInRose);
  const dipTickTipY = cy + 76 * Math.sin(dipRadInRose);
  const dipTriBaseLx = cx + 22 * Math.cos(strikeRadInRose);
  const dipTriBaseLy = cy + 22 * Math.sin(strikeRadInRose);
  const dipTriBaseRx = cx - 22 * Math.cos(strikeRadInRose);
  const dipTriBaseRy = cy - 22 * Math.sin(strikeRadInRose);
  const dipTriApexX = cx + 48 * Math.cos(dipRadInRose);
  const dipTriApexY = cy + 48 * Math.sin(dipRadInRose);

  // Bullseye Spirit Bubble coordinates in SVG space (center = 130, 130, max radius = 28px)
  const bubbleSvgX = cx + bubblePos.x * 28;
  const bubbleSvgY = cy + bubblePos.y * 28;

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-md flex flex-col select-none overflow-hidden safe-area-inset-box"
      data-window="realtime-mobile-split-compass-modal"
    >
      {/* TOP INSTRUMENT BAR (Single-row horizontally scrollable on Android Portrait & Landscape) */}
      <div className="min-h-12 sm:h-14 py-1 sm:py-0 shrink-0 bg-slate-900 border-b border-slate-800 px-2 sm:px-4 flex items-center justify-between gap-2 sm:gap-3 overflow-x-auto no-scrollbar whitespace-nowrap">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
            <Smartphone className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white truncate">
                FieldMove Clino 3D Compass &amp; 3D Tunnel
              </h2>
              <span className="text-[11px] sm:text-xs font-mono text-amber-300 font-bold shrink-0">
                · {featureLabel} ({(activePanel || 'face').replace('_', ' ').toUpperCase()})
              </span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1.5 sm:gap-2 truncate">
              <span>
                Heading:{' '}
                <strong className="text-red-400 font-mono">
                  {String(compassHeadingDeg).padStart(3, '0')}° {headingCardinalLabel}
                </strong>
              </span>
              <span>·</span>
              <span>
                Dip Dir / Dip:{' '}
                <strong className="text-amber-300 font-mono">
                  {String(dipDirectionDeg).padStart(3, '0')}° / {String(dipAmountDeg).padStart(2, '0')}°
                </strong>
              </span>
              <span className="hidden md:inline">·</span>
              <span className="hidden md:inline">
                Sensor:{' '}
                <strong className="text-cyan-300">
                  {sensorSourceType === 'ABSOLUTE_MAGNETOMETER'
                    ? 'True-North Hardware Magnetometer'
                    : sensorSourceType === 'RELATIVE_GYRO'
                    ? 'Gyro Sensor (Use North Calibration if needed)'
                    : 'Interactive / Ready'}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Right Top Controls: Lock/Unlock + Confirm OK Options (Only Data vs Change Trace + Data) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsLocked((prev) => !prev)}
            className={`min-h-[34px] sm:min-h-[40px] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer border transition-all shrink-0 ${
              isLocked
                ? 'bg-red-500 text-white border-red-300 shadow-lg'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/50'
            }`}
          >
            {isLocked ? <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Unlock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            <span>
              {isLocked ? 'HOLD (Unlock)' : 'LIVE (Hold)'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleConfirmWithMode('DATA_ONLY')}
            className="min-h-[34px] sm:min-h-[40px] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer shadow-lg shrink-0"
            title="Apply Dip Direction & Dip Amount data only (keep original drawn 2D joint trace unchanged)"
          >
            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
            <span>OK: Data Only</span>
          </button>

          <button
            type="button"
            onClick={() => handleConfirmWithMode('TRACE_AND_DATA')}
            className="min-h-[34px] sm:min-h-[40px] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer shadow-lg shrink-0"
            title="Align/rotate the 2D joint trace to match real compass orientation AND update Dip Direction & Dip Amount data"
          >
            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
            <span>OK: Trace + Data</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[34px] min-w-[34px] sm:min-h-[40px] sm:min-w-[40px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer shrink-0"
            title="Close without saving"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ============================================================================
          TWO-SCREEN SPLIT WORKSPACE (Adapts to Portrait 2-row or Landscape 2-column):
          LEFT/TOP SIDE: 3D TUNNEL (EXACT SHAPE, SIZE, WALLS, CROWN & PULL LENGTH)
          RIGHT/BOTTOM SIDE: FIELDMOVE CLINO 3D COMPASS-CLINOMETER & SPIRIT LEVEL
         ============================================================================ */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 overflow-y-auto md:overflow-hidden">
        {/* LEFT SCREEN: 3D TUNNEL SHAPE + PULL LENGTH + HALF-IN / HALF-OUT TRACED JOINT PLANE */}
        <div className="relative w-full h-[42dvh] md:h-full min-h-[220px] flex flex-col bg-slate-950 overflow-hidden">
          <div ref={mount3DRef} className="w-full h-full flex-1 cursor-grab active:cursor-grabbing" />

          {/* Top Overlay on Left 3D Viewport */}
          <div className="absolute top-3 left-3 right-3 flex flex-wrap items-start justify-between gap-2 pointer-events-none z-10">
            <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl px-3 py-2 space-y-1 shadow-lg pointer-events-auto">
              <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                <span>
                  3D Tunnel ({String(excavationShape || 'Horseshoe').replace('_', ' ').toUpperCase()} ·{' '}
                  {excavationWidthM}m W × {excavationHeightM}m H × {pullLengthM}m Pull)
                </span>
              </div>
              <div className="text-xs font-mono font-bold text-white">
                Traced Joint Length: {tracedLengthMeters}m · Plane: {String(dipDirectionDeg).padStart(3, '0')}° /{' '}
                {String(dipAmountDeg).padStart(2, '0')}°
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-[10px] text-slate-300 font-mono">Pull Length:</span>
                {[2.5, 4.0, 6.0].map((pLen) => (
                  <button
                    key={pLen}
                    type="button"
                    onClick={() => setPullLengthM(pLen)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                      Math.abs(pullLengthM - pLen) < 0.2
                        ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {pLen}m
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCameraResetCounter((c) => c + 1)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[10px] font-mono text-amber-300 flex items-center gap-1 cursor-pointer"
                  title="Reset 3D camera to ideal position (Face behind Left Wall, Right Wall, and Crown)"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Ideal Position</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl px-3 py-2 text-[10px] font-mono text-slate-300 space-y-1 shadow-lg">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 inline-block" />
                <span>50% Inside Tunnel (Inner Joint Plane)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-cyan-400 inline-block" />
                <span>50% Outside Tunnel (Outer Rock Plane)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-yellow-200 inline-block" />
                <span>Live Compass-Oriented Trace ({tracedLengthMeters}m)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-slate-400 inline-block" />
                <span>Original Drawn Trace Reference</span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
            <div className="bg-slate-900/85 backdrop-blur-sm border border-slate-800 rounded-lg px-2.5 py-1 text-[10px] text-slate-300">
              Ideal 3D View: Tunnel Face positioned behind Left Wall, Right Wall &amp; Crown ({pullLengthM}m Pull) · Traced-length joint plane shown 50% inside &amp; 50% outside tunnel
            </div>
          </div>
        </div>

        {/* RIGHT SCREEN: FIELDMOVE CLINO 3D PLANE CLINOMETER + ROTATING TRUE-NORTH COMPASS ROSE */}
        <div className="w-full h-full flex flex-col justify-between p-4 bg-slate-900/90 overflow-y-auto gap-3">
          {/* FieldMove Clino Mode Selector + Live Digital Readout Banner */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black uppercase tracking-wider text-white">
                  Clinometer Mode:
                </span>
                <button
                  type="button"
                  onClick={() => setClinoMeasureMode('FIELDMOVE_PLANE')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border cursor-pointer transition-all ${
                    clinoMeasureMode === 'FIELDMOVE_PLANE'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  FieldMove 3D Plane (Whole Screen)
                </button>
                <button
                  type="button"
                  onClick={() => setClinoMeasureMode('SCREEN_AXIS')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border cursor-pointer transition-all ${
                    clinoMeasureMode === 'SCREEN_AXIS'
                      ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  Screen Top→Bottom Axis
                </button>
              </div>
              <div className="text-[11px] text-slate-300">
                {clinoMeasureMode === 'FIELDMOVE_PLANE' ? (
                  <span>
                    Place phone <strong className="text-emerald-300">flat against the rock joint</strong> (any screen rotation). Tap the compass circle to <strong className="text-amber-300">HOLD / LOCK</strong>.
                  </span>
                ) : (
                  <span>
                    Point <strong className="text-amber-300">Screen Bottom</strong> down-dip (<strong className="text-amber-300">{String(dipDirectionDeg).padStart(3, '0')}°</strong>); Screen Top-to-Bottom tilt = <strong className="text-emerald-300">Dip ({String(dipAmountDeg).padStart(2, '0')}°)</strong>.
                  </span>
                )}
              </div>
            </div>

            {/* Live Readout Badges (FieldMove Clino format: Dip Dir / Dip + Strike + Heading) */}
            <div className="flex items-center gap-2 font-mono tabular-nums">
              <div className="bg-slate-900 border border-red-500/40 rounded-xl px-2.5 py-1.5 text-center">
                <div className="text-[9px] uppercase text-slate-400 font-sans font-bold">
                  North Heading
                </div>
                <div className="text-base font-black text-red-400">
                  {String(compassHeadingDeg).padStart(3, '0')}°{' '}
                  <span className="text-[10px] text-red-200">{headingCardinalLabel}</span>
                </div>
              </div>
              <div className="bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-1.5 text-center">
                <div className="text-[9px] uppercase text-slate-400 font-sans font-bold">
                  Dip Dir
                </div>
                <div className="text-xl font-black text-amber-400">
                  {String(dipDirectionDeg).padStart(3, '0')}°{' '}
                  <span className="text-xs text-amber-200">{cardinalLabel}</span>
                </div>
              </div>
              <div className="bg-slate-900 border border-emerald-500/40 rounded-xl px-3 py-1.5 text-center">
                <div className="text-[9px] uppercase text-slate-400 font-sans font-bold">
                  Dip Angle
                </div>
                <div className="text-xl font-black text-emerald-400">
                  {String(dipAmountDeg).padStart(2, '0')}°
                </div>
              </div>
              <div className="bg-slate-900 border border-cyan-500/40 rounded-xl px-2.5 py-1.5 text-center">
                <div className="text-[9px] uppercase text-slate-400 font-sans font-bold">
                  Strike (RHR)
                </div>
                <div className="text-base font-black text-cyan-300">
                  {String(strikeRhrDeg).padStart(3, '0')}°
                </div>
              </div>
            </div>
          </div>

          {/* Center Instruments: FieldMove Clino Rotating True-North Dial (Left) + 0°–90° Clinometer Quadrant (Right) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch my-auto">
            {/* 1. FIELDMOVE CLINO ROTATING COMPASS ROSE + STRIKE/DIP TICK + SPIRIT BUBBLE LEVEL */}
            <div className="md:col-span-6 flex flex-col items-center justify-between bg-slate-950 border border-slate-800 rounded-2xl p-3 relative">
              <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                <span className="flex items-center gap-1 text-amber-300 font-bold">
                  <Compass className="w-3.5 h-3.5" />
                  <span>FIELDMOVE CLINO (TAP DIAL TO {isLocked ? 'UNLOCK' : 'HOLD'})</span>
                </span>
                <span className={isLocked ? 'text-red-400 font-black' : 'text-emerald-400 font-bold'}>
                  {isLocked ? 'HOLD / LOCKED' : 'LIVE NORTH'}
                </span>
              </div>

              <svg
                ref={compassSvgRef}
                viewBox="0 0 260 260"
                className="w-56 h-56 sm:w-60 sm:h-60 touch-none cursor-pointer"
                onClick={() => {
                  if (!isDraggingCompassDial) {
                    setIsLocked((prev) => !prev);
                  }
                }}
                onPointerDown={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const distFromCenter = Math.hypot(
                    e.clientX - (rect.left + rect.width / 2),
                    e.clientY - (rect.top + rect.height / 2)
                  );
                  // Dragging near the outer bezel (> 75px) allows manual azimuth adjustment
                  if (distFromCenter > rect.width * 0.34) {
                    setIsLocked(true);
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setIsDraggingCompassDial(true);
                    updateDipDirectionFromCompassPointer(e.clientX, e.clientY);
                  }
                }}
                onPointerMove={(e) => {
                  if (!isDraggingCompassDial) return;
                  updateDipDirectionFromCompassPointer(e.clientX, e.clientY);
                }}
                onPointerUp={() => {
                  setTimeout(() => setIsDraggingCompassDial(false), 50);
                }}
              >
                {/* Fixed Lubber Line (Sighting Index) at Top 12 o'clock of Phone */}
                <polygon points={`${cx},2 ${cx - 6},13 ${cx + 6},13`} fill="#f59e0b" />
                <line x1={cx} y1="12" x2={cx} y2="24" stroke="#f59e0b" strokeWidth="2.5" />

                {/* Outer Bezel (Green/Cyan when LIVE, Red/Amber when HOLD/LOCKED like FieldMove Clino) */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="116"
                  fill="#090d16"
                  stroke={isLocked ? '#ef4444' : '#10b981'}
                  strokeWidth="3.5"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r="90"
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1.2"
                  strokeDasharray="3,3"
                />

                {/* =======================================================================
                    ROTATING COMPASS ROSE GROUP:
                    Rotates by `-compassHeadingDeg` so Red "N 000°" ALWAYS points toward
                    Real Physical Magnetic North in the room!
                   ======================================================================= */}
                <g transform={`rotate(${-compassHeadingDeg} ${cx} ${cy})`}>
                  {/* 10° & 30° Degree Graduation Ticks around the Rotating Compass Ring */}
                  {Array.from({ length: 36 }, (_, i) => i * 10).map((degAngle) => {
                    const rad = ((degAngle - 90) * Math.PI) / 180;
                    const isCardinal = degAngle % 90 === 0;
                    const isMajor30 = degAngle % 30 === 0 && !isCardinal;
                    const r1 = isCardinal ? 98 : isMajor30 ? 103 : 108;
                    const r2 = 115;
                    return (
                      <line
                        key={degAngle}
                        x1={cx + r1 * Math.cos(rad)}
                        y1={cy + r1 * Math.sin(rad)}
                        x2={cx + r2 * Math.cos(rad)}
                        y2={cy + r2 * Math.sin(rad)}
                        stroke={
                          degAngle === 0
                            ? '#ef4444'
                            : isCardinal
                            ? '#f8fafc'
                            : isMajor30
                            ? '#94a3b8'
                            : '#475569'
                        }
                        strokeWidth={isCardinal ? '2.5' : isMajor30 ? '1.6' : '1'}
                      />
                    );
                  })}

                  {/* Magnetic North / South Compass Needle inside Rotating Rose */}
                  {/* North Half-Needle (Red pointing to N 000°) */}
                  <polygon
                    points={`${cx},${cy - 88} ${cx - 7},${cy} ${cx + 7},${cy}`}
                    fill="#ef4444"
                    fillOpacity="0.85"
                    stroke="#fecaca"
                    strokeWidth="1"
                  />
                  {/* South Half-Needle (White/Slate pointing to S 180°) */}
                  <polygon
                    points={`${cx},${cy + 82} ${cx - 6},${cy} ${cx + 6},${cy}`}
                    fill="#cbd5e1"
                    fillOpacity="0.45"
                    stroke="#475569"
                    strokeWidth="1"
                  />

                  {/* Cardinal Labels on Rotating Ring: N (000°), E (090°), S (180°), W (270°) */}
                  <polygon points={`${cx},15 ${cx - 7},28 ${cx + 7},28`} fill="#ef4444" />
                  <text
                    x={cx}
                    y="41"
                    textAnchor="middle"
                    fill="#ef4444"
                    fontSize="13"
                    fontWeight="900"
                    fontFamily="monospace"
                  >
                    N
                  </text>
                  <text
                    x="222"
                    y={cy + 4}
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize="12"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    E
                  </text>
                  <text
                    x={cx}
                    y="230"
                    textAnchor="middle"
                    fill="#cbd5e1"
                    fontSize="12"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    S
                  </text>
                  <text
                    x="38"
                    y={cy + 4}
                    textAnchor="middle"
                    fill="#cbd5e1"
                    fontSize="12"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    W
                  </text>

                  {/* Degree Numbers every 30° around Rotating Compass Rose */}
                  {[30, 60, 120, 150, 210, 240, 300, 330].map((deg) => {
                    const rad = ((deg - 90) * Math.PI) / 180;
                    const r = 84;
                    return (
                      <text
                        key={deg}
                        x={cx + r * Math.cos(rad)}
                        y={cy + r * Math.sin(rad) + 3}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="8.5"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {String(deg).padStart(3, '0')}
                      </text>
                    );
                  })}

                  {/* FIELDMOVE CLINO STRIKE LINE + DOWN-DIP TRIANGLE TICK */}
                  <line
                    x1={strikeLx}
                    y1={strikeLy}
                    x2={strikeRx}
                    y2={strikeRy}
                    stroke="#38bdf8"
                    strokeWidth="2.8"
                  />
                  {/* Filled Down-Dip Tick Triangle */}
                  <polygon
                    points={`${dipTriBaseLx},${dipTriBaseLy} ${dipTriBaseRx},${dipTriBaseRy} ${dipTriApexX},${dipTriApexY}`}
                    fill="#f59e0b"
                    fillOpacity="0.85"
                    stroke="#fef08a"
                    strokeWidth="1.5"
                  />
                  <line
                    x1={cx}
                    y1={cy}
                    x2={dipTickTipX}
                    y2={dipTickTipY}
                    stroke="#f59e0b"
                    strokeWidth="3"
                  />
                  <circle
                    cx={dipTickTipX}
                    cy={dipTickTipY}
                    r="6"
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                </g>

                {/* =======================================================================
                    CENTER BULLSEYE SPIRIT LEVEL (GREEN BUBBLE LEVEL LIKE FIELDMOVE CLINO)
                   ======================================================================= */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="34"
                  fill="#0f172a"
                  fillOpacity="0.9"
                  stroke="#334155"
                  strokeWidth="1.5"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r="14"
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
                <line x1={cx - 34} y1={cy} x2={cx + 34} y2={cy} stroke="#1e293b" strokeWidth="1" />
                <line x1={cx} y1={cy - 34} x2={cx} y2={cy + 34} stroke="#1e293b" strokeWidth="1" />

                {/* Live Spirit Bubble */}
                <circle
                  cx={bubbleSvgX}
                  cy={bubbleSvgY}
                  r="9"
                  fill="#10b981"
                  fillOpacity="0.85"
                  stroke="#a7f3d0"
                  strokeWidth="1.5"
                />
                <circle cx={bubbleSvgX - 2.5} cy={bubbleSvgY - 2.5} r="2.5" fill="#ecfdf5" />
              </svg>

              {/* Quick Cardinal Buttons + True-North Calibration Control */}
              <div className="w-full space-y-1.5 mt-1">
                <div className="grid grid-cols-8 gap-1">
                  {[
                    { lbl: 'N', deg: 0 },
                    { lbl: 'NE', deg: 45 },
                    { lbl: 'E', deg: 90 },
                    { lbl: 'SE', deg: 135 },
                    { lbl: 'S', deg: 180 },
                    { lbl: 'SW', deg: 225 },
                    { lbl: 'W', deg: 270 },
                    { lbl: 'NW', deg: 315 },
                  ].map((item) => (
                    <button
                      key={item.lbl}
                      type="button"
                      onClick={() => {
                        setIsLocked(true);
                        setDipDirectionDeg(item.deg);
                        setCompassHeadingDeg(item.deg);
                      }}
                      className={`min-h-[28px] rounded-lg text-[10px] font-mono font-bold border cursor-pointer transition-colors ${
                        dipDirectionDeg === item.deg
                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                      }`}
                    >
                      {item.lbl}
                    </button>
                  ))}
                </div>

                {/* True North Calibration & Declination Offset Bar */}
                <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80 text-[10px] font-mono">
                  <span className="text-slate-400">North Declination / Trim:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const next = ((northOffsetDeg - 5 + 540) % 360) - 180;
                        setNorthOffsetDeg(next);
                        saveNorthCalibrationOffsetDeg(next);
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
                    >
                      -5°
                    </button>
                    <span className="text-cyan-300 font-bold px-1">
                      {northOffsetDeg >= 0 ? `+${northOffsetDeg}°` : `${northOffsetDeg}°`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = ((northOffsetDeg + 5 + 540) % 360) - 180;
                        setNorthOffsetDeg(next);
                        saveNorthCalibrationOffsetDeg(next);
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
                    >
                      +5°
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = ((northOffsetDeg + 90 + 540) % 360) - 180;
                        setNorthOffsetDeg(next);
                        saveNorthCalibrationOffsetDeg(next);
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 cursor-pointer"
                      title="Rotate North +90°"
                    >
                      +90°
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = ((northOffsetDeg + 180 + 540) % 360) - 180;
                        setNorthOffsetDeg(next);
                        saveNorthCalibrationOffsetDeg(next);
                      }}
                      className="px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 cursor-pointer"
                      title="Flip 180° if your device sensor reports inverted North/South"
                    >
                      180°
                    </button>
                    {northOffsetDeg !== 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setNorthOffsetDeg(0);
                          saveNorthCalibrationOffsetDeg(0);
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                      >
                        0°
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. VISUAL SCREEN TOP-TO-BOTTOM INCLINOMETER (Shows Dip Amount 0°..90°) */}
            <div className="md:col-span-6 flex flex-col items-center justify-between bg-slate-950 border border-slate-800 rounded-2xl p-3">
              <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <Gauge className="w-3.5 h-3.5" />
                  <span>TOP-TO-BOTTOM INCLINOMETER (DIP)</span>
                </span>
                <span className="text-emerald-400 font-bold">{dipAmountDeg}° (0°–90°)</span>
              </div>

              <svg
                ref={inclinometerSvgRef}
                viewBox="0 0 220 185"
                className="w-56 h-48 sm:w-60 sm:h-52 touch-none cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => {
                  setIsLocked(true);
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setIsDraggingInclinometer(true);
                  updateDipAmountFromInclinometerPointer(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (!isDraggingInclinometer) return;
                  updateDipAmountFromInclinometerPointer(e.clientX, e.clientY);
                }}
                onPointerUp={() => setIsDraggingInclinometer(false)}
              >
                {(() => {
                  const px = 34;
                  const py = 28;
                  const r = 128;
                  const rad = (dipAmountDeg * Math.PI) / 180;
                  const tx = px + r * Math.cos(rad);
                  const ty = py + r * Math.sin(rad);
                  return (
                    <>
                      {/* Inclinometer 0°–90° Quadrant Body */}
                      <path
                        d={`M ${px} ${py} L ${px + r} ${py} A ${r} ${r} 0 0 1 ${px} ${py + r} Z`}
                        fill="#090d16"
                        stroke="#10b981"
                        strokeWidth="2.5"
                      />

                      {/* Filled Top-to-Bottom Dip Angle Wedge */}
                      <path
                        d={`M ${px} ${py} L ${px + r * 0.72} ${py} A ${r * 0.72} ${r * 0.72} 0 0 1 ${
                          px + r * 0.72 * Math.cos(rad)
                        } ${py + r * 0.72 * Math.sin(rad)} Z`}
                        fill="#10b981"
                        fillOpacity="0.18"
                      />

                      {/* Visual Screen Top (Pivot) to Visual Screen Bottom (Tip) Labels */}
                      <text
                        x={px + r * 0.52}
                        y={py - 8}
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize="8.5"
                        fontFamily="monospace"
                      >
                        0° FLAT (TOP = BOTTOM LEVEL)
                      </text>
                      <text
                        x={px - 10}
                        y={py + r * 0.55}
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize="8.5"
                        fontFamily="monospace"
                        transform={`rotate(-90 ${px - 10} ${py + r * 0.55})`}
                      >
                        90° VERTICAL SCREEN
                      </text>

                      {/* 5° Minor Ticks & 15° Major Degree Ticks */}
                      {Array.from({ length: 19 }, (_, i) => i * 5).map((deg) => {
                        const a = (deg * Math.PI) / 180;
                        const isMajor = deg % 15 === 0;
                        const x1 = px + (r - (isMajor ? 10 : 5)) * Math.cos(a);
                        const y1 = py + (r - (isMajor ? 10 : 5)) * Math.sin(a);
                        const x2 = px + r * Math.cos(a);
                        const y2 = py + r * Math.sin(a);
                        const lx = px + (r + 16) * Math.cos(a);
                        const ly = py + (r + 16) * Math.sin(a);
                        return (
                          <g key={deg}>
                            <line
                              x1={x1}
                              y1={y1}
                              x2={x2}
                              y2={y2}
                              stroke={isMajor ? '#e2e8f0' : '#475569'}
                              strokeWidth={isMajor ? '1.8' : '1'}
                            />
                            {isMajor && (
                              <text
                                x={lx}
                                y={ly + 3}
                                textAnchor="middle"
                                fill="#cbd5e1"
                                fontSize="10"
                                fontWeight="bold"
                                fontFamily="monospace"
                              >
                                {deg}°
                              </text>
                            )}
                          </g>
                        );
                      })}

                      {/* Screen Top -> Screen Bottom Slope Line */}
                      <line
                        x1={px}
                        y1={py}
                        x2={tx}
                        y2={ty}
                        stroke="#10b981"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                      />
                      <circle
                        cx={tx}
                        cy={ty}
                        r="7"
                        fill="#10b981"
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                      <circle
                        cx={px}
                        cy={py}
                        r="6"
                        fill="#f59e0b"
                        stroke="#090d16"
                        strokeWidth="2"
                      />

                      {/* Digital Readout Box inside Inclinometer */}
                      <rect
                        x="114"
                        y="138"
                        width="96"
                        height="36"
                        rx="8"
                        fill="#0f172a"
                        stroke="#10b981"
                        strokeWidth="1.5"
                      />
                      <text
                        x="162"
                        y="161"
                        textAnchor="middle"
                        fill="#34d399"
                        fontSize="15"
                        fontWeight="900"
                        fontFamily="monospace"
                      >
                        DIP {String(dipAmountDeg).padStart(2, '0')}°
                      </text>
                    </>
                  );
                })()}
              </svg>

              {/* Quick Inclinometer Dip Angle Presets + Visual Screen Axis Selector */}
              <div className="w-full space-y-1.5 mt-1">
                <div className="grid grid-cols-7 gap-1">
                  {[0, 15, 30, 45, 60, 75, 90].map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => {
                        setIsLocked(true);
                        setDipAmountDeg(deg);
                      }}
                      className={`min-h-[28px] rounded-lg text-[10px] font-mono font-bold border cursor-pointer transition-colors ${
                        dipAmountDeg === deg
                          ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/80 text-[10px] font-mono">
                  <span className="text-slate-400">Screen Top→Bottom Axis:</span>
                  <div className="flex items-center gap-1">
                    {(
                      [
                        { id: 'AUTO', lbl: 'Auto' },
                        { id: 'PORTRAIT', lbl: 'Portrait' },
                        { id: 'LANDSCAPE', lbl: 'Horizontal' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setVisualScreenAxisMode(m.id)}
                        className={`px-2 py-0.5 rounded border cursor-pointer ${
                          visualScreenAxisMode === m.id
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {m.lbl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fine-Tune Sliders & Step Buttons for Both Compass Direction & Inclinometer Dip Amount */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Fine-Tune: Visual Screen Bottom = Dip Direction (0°–360°) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>Screen Bottom = Dip Dir (0°–360°):</span>
                </span>
                <span className="text-amber-400 font-bold">
                  {String(dipDirectionDeg).padStart(3, '0')}° ({cardinalLabel})
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={dipDirectionDeg}
                onChange={(e) => {
                  setIsLocked(true);
                  setDipDirectionDeg(Number(e.target.value) % 360);
                }}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  [-5, '-5°'],
                  [-1, '-1°'],
                  [1, '+1°'],
                  [5, '+5°'],
                ].map(([step, lbl]) => (
                  <button
                    key={String(lbl)}
                    type="button"
                    onClick={() => {
                      setIsLocked(true);
                      setDipDirectionDeg((prev) => ((prev + Number(step)) % 360 + 360) % 360);
                    }}
                    className="min-h-[34px] rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-mono font-bold text-amber-300 cursor-pointer"
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Fine-Tune: Angle Top-to-Bottom = Dip Amount (0°–90°) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Top-to-Bottom Angle = Dip (0°–90°):</span>
                </span>
                <span className="text-emerald-400 font-bold">{dipAmountDeg}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={90}
                step={1}
                value={dipAmountDeg}
                onChange={(e) => {
                  setIsLocked(true);
                  setDipAmountDeg(Math.max(0, Math.min(90, Number(e.target.value))));
                }}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  [-5, '-5°'],
                  [-1, '-1°'],
                  [1, '+1°'],
                  [5, '+5°'],
                ].map(([step, lbl]) => (
                  <button
                    key={String(lbl)}
                    type="button"
                    onClick={() => {
                      setIsLocked(true);
                      setDipAmountDeg((prev) => Math.max(0, Math.min(90, prev + Number(step))));
                    }}
                    className="min-h-[34px] rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-mono font-bold text-emerald-300 cursor-pointer"
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Confirmation Footer with Two Explicit OK Options ("Only Data" vs "Change Joint Trace + Data") */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Compass Oriented:{' '}
                <strong className="font-mono text-amber-300">
                  {String(dipDirectionDeg).padStart(3, '0')}°/{String(dipAmountDeg).padStart(2, '0')}°
                </strong>{' '}
                — Choose <strong className="text-emerald-300">Only Data</strong> (keep drawn trace) or{' '}
                <strong className="text-amber-300">Change Joint Trace + Data</strong> (align trace to compass).
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsLocked((prev) => !prev)}
                className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border ${
                  isLocked
                    ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-200'
                }`}
              >
                {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                <span>{isLocked ? 'Unlock Sensor' : 'Lock Reading'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmWithMode('DATA_ONLY')}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-lg"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>
                  OK — Only Data ({String(dipDirectionDeg).padStart(3, '0')}°/{String(dipAmountDeg).padStart(2, '0')}°)
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleConfirmWithMode('TRACE_AND_DATA')}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-lg"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>
                  OK — Change Joint Trace + Data
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Optional Confirmation Modal if opened via showOkChoiceModal */}
      {showOkChoiceModal && (
        <div className="fixed inset-0 z-[130] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Apply Real-Time Compass Orientation ({String(dipDirectionDeg).padStart(3, '0')}° / {String(dipAmountDeg).padStart(2, '0')}°)
              </h3>
              <button
                type="button"
                onClick={() => setShowOkChoiceModal(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300">
              How would you like to apply this compass reading to <strong className="text-amber-300">{featureLabel}</strong>?
            </p>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleConfirmWithMode('DATA_ONLY')}
                className="w-full p-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-left flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="text-xs font-black uppercase text-emerald-300">
                    1. Only Data (Keep Drawn Joint Trace)
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Updates Dip Direction ({String(dipDirectionDeg).padStart(3, '0')}°) &amp; Dip Amount ({String(dipAmountDeg).padStart(2, '0')}°) text only.
                  </div>
                </div>
                <Check className="w-5 h-5 text-emerald-400 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => handleConfirmWithMode('TRACE_AND_DATA')}
                className="w-full p-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-left flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="text-xs font-black uppercase text-amber-300">
                    2. Change Joint Trace + Data
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Rotates/aligns the drawn 2D joint trace to match the compass plane AND updates Dip Direction &amp; Dip Amount.
                  </div>
                </div>
                <Check className="w-5 h-5 text-amber-400 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
