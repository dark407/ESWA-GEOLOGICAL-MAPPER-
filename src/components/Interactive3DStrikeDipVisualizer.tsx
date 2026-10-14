import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Joint,
  JointSet,
  StrikeDip3DSnapshotAppendix,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import { JOINT_SET_PALETTE, normalizeAzimuth } from '../engine/orientationEngine';
import {
  Box,
  Camera,
  CheckCircle2,
  Compass,
  Eye,
  FileSpreadsheet,
  Maximize2,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

interface Vec3 {
  x: number; // East (+X)
  y: number; // Up (+Y)
  z: number; // North (+Z)
}

/**
 * Projects a 3D world point (x = East, y = Up, z = North) into 2D SVG coordinates
 * given camera yaw (azimuth deg), pitch (elevation deg), zoom, and SVG center.
 */
function project3DPoint(
  pt: Vec3,
  yawDeg: number,
  pitchDeg: number,
  scale: number,
  cx: number,
  cy: number
): { u: number; v: number; depth: number } {
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;

  // Rotate around Y (Up) axis by yaw
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const x1 = pt.x * cosY - pt.z * sinY;
  const z1 = pt.x * sinY + pt.z * cosY;
  const y1 = pt.y;

  // Rotate around X axis by pitch
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const y2 = y1 * cosP - z1 * sinP;
  const z2 = y1 * sinP + z1 * cosP;

  // Mild perspective foreshortening for natural 3D depth perception
  const camDist = 28;
  const persp = camDist / Math.max(8, camDist - z2 * 0.35);

  return {
    u: Number((cx + x1 * scale * persp).toFixed(2)),
    v: Number((cy - y2 * scale * persp).toFixed(2)),
    depth: z2,
  };
}

/**
 * Converts tunnel-local coordinates:
 * - localRight: across tunnel width (-W/2 .. +W/2)
 * - localUp: height above invert (0 .. H)
 * - localChainage: distance along tunnel drive direction (-L/2 .. +L/2)
 * into World (East = +X, Up = +Y, North = +Z) rotated by tunnel driveDirection azimuth (0° = North, 90° = East).
 */
function tunnelLocalToWorldENU(
  localRight: number,
  localUp: number,
  localAlongDrive: number,
  driveAzimuthDeg: number,
  centerHeightOffset: number
): Vec3 {
  const azRad = (normalizeAzimuth(driveAzimuthDeg) * Math.PI) / 180;
  // Drive unit vector in (East, North): (sin(az), cos(az))
  const dEast = Math.sin(azRad);
  const dNorth = Math.cos(azRad);
  // Right-hand perpendicular vector in (East, North): (cos(az), -sin(az))
  const rEast = Math.cos(azRad);
  const rNorth = -Math.sin(azRad);

  return {
    x: localRight * rEast + localAlongDrive * dEast,
    y: localUp - centerHeightOffset,
    z: localRight * rNorth + localAlongDrive * dNorth,
  };
}

/**
 * Computes the 3D basis vectors of a geological plane in World (East = +X, Up = +Y, North = +Z)
 * from Dip Direction (0-360° clockwise from North) and Dip (0-90° from horizontal).
 */
export function computeJointPlane3DVectors(dipDirectionDeg: number, dipDeg: number) {
  const dd = normalizeAzimuth(dipDirectionDeg);
  const strike = normalizeAzimuth(dd - 90); // Right-Hand Rule strike
  const dip = Math.max(0, Math.min(90, dipDeg));

  const strikeRad = (strike * Math.PI) / 180;
  const ddRad = (dd * Math.PI) / 180;
  const dipRad = (dip * Math.PI) / 180;

  // Horizontal unit Strike vector (pointing along strike azimuth)
  const strikeVec: Vec3 = {
    x: Math.sin(strikeRad),
    y: 0,
    z: Math.cos(strikeRad),
  };

  // Steepest Down-Dip unit vector (plunging at angle `dip` toward `dipDirection`)
  const dipVec: Vec3 = {
    x: Math.cos(dipRad) * Math.sin(ddRad),
    y: -Math.sin(dipRad),
    z: Math.cos(dipRad) * Math.cos(ddRad),
  };

  // Upward-hemisphere Unit Normal vector to the plane
  const normalVec: Vec3 = {
    x: Math.sin(dipRad) * Math.sin(ddRad),
    y: Math.cos(dipRad),
    z: Math.sin(dipRad) * Math.cos(ddRad),
  };

  return {
    strikeDeg: Math.round(strike),
    dipDirectionDeg: Math.round(dd),
    dipDeg: Math.round(dip),
    strikeVec,
    dipVec,
    normalVec,
  };
}

/**
 * Evaluates Bieniawski (1989) RMR Tunnel Drive Direction vs. Joint Strike & Dip Favorability
 */
export function evaluateStrikeDipRelativeToDrive(
  strikeDeg: number,
  dipDirectionDeg: number,
  dipDeg: number,
  driveAzimuthDeg: number
): {
  acuteStrikeToDriveAngleDeg: number;
  dipRelativeRelation: 'DRIVE_WITH_DIP' | 'DRIVE_AGAINST_DIP' | 'STRIKE_PARALLEL' | 'FLAT_DIP';
  favorabilityLabel:
    | 'Very Favorable'
    | 'Favorable'
    | 'Fair'
    | 'Unfavorable'
    | 'Very Unfavorable';
  rmrAdjustmentRating: number;
  explanation: string;
} {
  const drive = normalizeAzimuth(driveAzimuthDeg);
  const strike = normalizeAzimuth(strikeDeg);
  const dd = normalizeAzimuth(dipDirectionDeg);

  // Acute angle (0°..90°) between Strike line and Tunnel Drive axis
  const rawDiff = Math.abs(strike - drive) % 180;
  const acuteStrikeToDrive = Math.round(rawDiff > 90 ? 180 - rawDiff : rawDiff);

  // Check if Dip Direction is roughly with drive (<90° difference) or against drive (>90°)
  const ddToDriveDiff = Math.abs(((dd - drive + 540) % 360) - 180);
  const isWithDip = ddToDriveDiff <= 90;

  if (dipDeg < 20) {
    return {
      acuteStrikeToDriveAngleDeg: acuteStrikeToDrive,
      dipRelativeRelation: 'FLAT_DIP',
      favorabilityLabel: 'Fair',
      rmrAdjustmentRating: -5,
      explanation: `Sub-horizontal / flat dipping plane (${Math.round(dipDeg)}° < 20°) creates roof slabbing potential regardless of drive azimuth.`,
    };
  }

  // Strike roughly perpendicular to tunnel axis (60° - 90°)
  if (acuteStrikeToDrive >= 60) {
    if (isWithDip) {
      if (dipDeg >= 45) {
        return {
          acuteStrikeToDriveAngleDeg: acuteStrikeToDrive,
          dipRelativeRelation: 'DRIVE_WITH_DIP',
          favorabilityLabel: 'Very Favorable',
          rmrAdjustmentRating: 0,
          explanation: `Strike is perpendicular to tunnel axis (${acuteStrikeToDrive}°), driving WITH steep dip (${Math.round(dipDeg)}°).`,
        };
      }
      return {
        acuteStrikeToDriveAngleDeg: acuteStrikeToDrive,
        dipRelativeRelation: 'DRIVE_WITH_DIP',
        favorabilityLabel: 'Favorable',
        rmrAdjustmentRating: -2,
        explanation: `Strike is perpendicular to tunnel axis (${acuteStrikeToDrive}°), driving WITH moderate dip (${Math.round(dipDeg)}°).`,
      };
    } else {
      if (dipDeg >= 45) {
        return {
          acuteStrikeToDriveAngleDeg: acuteStrikeToDrive,
          dipRelativeRelation: 'DRIVE_AGAINST_DIP',
          favorabilityLabel: 'Fair',
          rmrAdjustmentRating: -5,
          explanation: `Strike is perpendicular to tunnel axis (${acuteStrikeToDrive}°), driving AGAINST steep dip (${Math.round(dipDeg)}°).`,
        };
      }
      return {
        acuteStrikeToDriveAngleDeg: acuteStrikeToDrive,
        dipRelativeRelation: 'DRIVE_AGAINST_DIP',
        favorabilityLabel: 'Unfavorable',
        rmrAdjustmentRating: -10,
        explanation: `Strike is perpendicular to tunnel axis (${acuteStrikeToDrive}°), driving AGAINST shallow/moderate dip (${Math.round(dipDeg)}°).`,
      };
    }
  }

  // Strike parallel to tunnel axis (0° - 30°)
  if (acuteStrikeToDrive <= 30) {
    if (dipDeg >= 45) {
      return {
        acuteStrikeToDriveAngleDeg: acuteStrikeToDrive,
        dipRelativeRelation: 'STRIKE_PARALLEL',
        favorabilityLabel: 'Very Unfavorable',
        rmrAdjustmentRating: -12,
        explanation: `Strike is nearly parallel to tunnel drive (${acuteStrikeToDrive}° ≤ 30°) with steep dip (${Math.round(dipDeg)}°), causing sidewall sliding blocks.`,
      };
    }
    return {
      acuteStrikeToDriveAngleDeg: acuteStrikeToDrive,
      dipRelativeRelation: 'STRIKE_PARALLEL',
      favorabilityLabel: 'Fair',
      rmrAdjustmentRating: -5,
      explanation: `Strike is parallel to tunnel drive (${acuteStrikeToDrive}°) with moderate dip (${Math.round(dipDeg)}°).`,
    };
  }

  // Oblique angle (30° - 60°)
  return {
    acuteStrikeToDriveAngleDeg: acuteStrikeToDrive,
    dipRelativeRelation: isWithDip ? 'DRIVE_WITH_DIP' : 'DRIVE_AGAINST_DIP',
    favorabilityLabel: isWithDip ? 'Favorable' : 'Fair',
    rmrAdjustmentRating: isWithDip ? -2 : -5,
    explanation: `Strike intersects tunnel drive at an oblique angle (${acuteStrikeToDrive}°), driving ${
      isWithDip ? 'with' : 'against'
    } dip (${Math.round(dipDeg)}°).`,
  };
}

// ============================================================================
// COMPACT MINI 3D STRIKE & DIP PREVIEW FOR THE PROPERTY SIDEBAR
// ============================================================================
interface Mini3DStrikeDipPreviewProps {
  joint: Joint;
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  onOpenFull3DModal: () => void;
}

export const Mini3DStrikeDipPreview: React.FC<Mini3DStrikeDipPreviewProps> = ({
  joint,
  geometry,
  settings,
  onOpenFull3DModal,
}) => {
  const [yaw, setYaw] = useState<number>(-38);
  const [pitch, setPitch] = useState<number>(24);
  const dragRef = useRef<{ startX: number; startY: number; yaw0: number; pitch0: number } | null>(
    null
  );

  const driveAz = settings.driveDirection || 0;
  const planeInfo = useMemo(
    () => computeJointPlane3DVectors(joint.dipDirection, joint.dip),
    [joint.dipDirection, joint.dip]
  );
  const driveEval = useMemo(
    () =>
      evaluateStrikeDipRelativeToDrive(
        planeInfo.strikeDeg,
        planeInfo.dipDirectionDeg,
        planeInfo.dipDeg,
        driveAz
      ),
    [planeInfo, driveAz]
  );

  const color = JOINT_SET_PALETTE[joint.set]?.color || '#0EA5E9';
  const cx = 130;
  const cy = 92;
  const scale = 11.5;

  // Build simplified tunnel arch wireframe for mini preview
  const halfW = Math.min(4.5, geometry.width / 2);
  const wallH = Math.min(3.2, (geometry.wallHeight / geometry.height) * 5.2);
  const totalH = 5.2;
  const centerH = totalH / 2;
  const halfLen = 3.2;

  const archProfile: { r: number; u: number }[] = [
    { r: -halfW, u: 0 },
    { r: -halfW, u: wallH },
    { r: -halfW * 0.7, u: wallH + (totalH - wallH) * 0.72 },
    { r: 0, u: totalH },
    { r: halfW * 0.7, u: wallH + (totalH - wallH) * 0.72 },
    { r: halfW, u: wallH },
    { r: halfW, u: 0 },
  ];

  const frontRing = archProfile.map((p) =>
    project3DPoint(
      tunnelLocalToWorldENU(p.r, p.u, halfLen, driveAz, centerH),
      yaw,
      pitch,
      scale,
      cx,
      cy
    )
  );
  const backRing = archProfile.map((p) =>
    project3DPoint(
      tunnelLocalToWorldENU(p.r, p.u, -halfLen, driveAz, centerH),
      yaw,
      pitch,
      scale,
      cx,
      cy
    )
  );

  // 3D Joint Plane corners (centered at origin)
  const planeRadius = 3.6;
  const planeCorners3D: Vec3[] = [
    {
      x: (-planeInfo.strikeVec.x - planeInfo.dipVec.x) * planeRadius,
      y: (-planeInfo.strikeVec.y - planeInfo.dipVec.y) * planeRadius,
      z: (-planeInfo.strikeVec.z - planeInfo.dipVec.z) * planeRadius,
    },
    {
      x: (planeInfo.strikeVec.x - planeInfo.dipVec.x) * planeRadius,
      y: (planeInfo.strikeVec.y - planeInfo.dipVec.y) * planeRadius,
      z: (planeInfo.strikeVec.z - planeInfo.dipVec.z) * planeRadius,
    },
    {
      x: (planeInfo.strikeVec.x + planeInfo.dipVec.x) * planeRadius,
      y: (planeInfo.strikeVec.y + planeInfo.dipVec.y) * planeRadius,
      z: (planeInfo.strikeVec.z + planeInfo.dipVec.z) * planeRadius,
    },
    {
      x: (-planeInfo.strikeVec.x + planeInfo.dipVec.x) * planeRadius,
      y: (-planeInfo.strikeVec.y + planeInfo.dipVec.y) * planeRadius,
      z: (-planeInfo.strikeVec.z + planeInfo.dipVec.z) * planeRadius,
    },
  ];
  const planeCorners2D = planeCorners3D.map((p) => project3DPoint(p, yaw, pitch, scale, cx, cy));

  // Strike Line endpoints
  const s1 = project3DPoint(
    {
      x: -planeInfo.strikeVec.x * planeRadius,
      y: 0,
      z: -planeInfo.strikeVec.z * planeRadius,
    },
    yaw,
    pitch,
    scale,
    cx,
    cy
  );
  const s2 = project3DPoint(
    {
      x: planeInfo.strikeVec.x * planeRadius,
      y: 0,
      z: planeInfo.strikeVec.z * planeRadius,
    },
    yaw,
    pitch,
    scale,
    cx,
    cy
  );

  // Down-Dip Vector from center
  const origin2D = project3DPoint({ x: 0, y: 0, z: 0 }, yaw, pitch, scale, cx, cy);
  const dipTip2D = project3DPoint(
    {
      x: planeInfo.dipVec.x * planeRadius * 0.95,
      y: planeInfo.dipVec.y * planeRadius * 0.95,
      z: planeInfo.dipVec.z * planeRadius * 0.95,
    },
    yaw,
    pitch,
    scale,
    cx,
    cy
  );

  // Tunnel Drive Direction Vector along floor
  const driveStart2D = project3DPoint(
    tunnelLocalToWorldENU(0, 0, -halfLen * 0.85, driveAz, centerH),
    yaw,
    pitch,
    scale,
    cx,
    cy
  );
  const driveEnd2D = project3DPoint(
    tunnelLocalToWorldENU(0, 0, halfLen * 1.15, driveAz, centerH),
    yaw,
    pitch,
    scale,
    cx,
    cy
  );

  return (
    <div className="p-2.5 bg-slate-950 text-white rounded-xl border border-slate-800 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono font-bold text-cyan-400 flex items-center gap-1">
          <Box className="w-3.5 h-3.5" />
          3D STRIKE &amp; DIP vs. DRIVE ({driveAz}°)
        </span>
        <button
          type="button"
          onClick={onOpenFull3DModal}
          className="px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-mono font-bold cursor-pointer flex items-center gap-1"
        >
          <Maximize2 className="w-2.5 h-2.5" />
          Full 3D View
        </button>
      </div>

      <svg
        viewBox="0 0 260 175"
        className="w-full h-40 bg-slate-900/90 rounded-lg border border-slate-800 cursor-grab active:cursor-grabbing select-none touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            yaw0: yaw,
            pitch0: pitch,
          };
        }}
        onPointerMove={(e) => {
          if (!dragRef.current) return;
          const dx = e.clientX - dragRef.current.startX;
          const dy = e.clientY - dragRef.current.startY;
          setYaw(dragRef.current.yaw0 + dx * 0.6);
          setPitch(Math.max(-65, Math.min(75, dragRef.current.pitch0 + dy * 0.5)));
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
      >
        <defs>
          <marker
            id="mini-drive-arrow"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8" />
          </marker>
          <marker
            id="mini-dip-arrow"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#FACC15" />
          </marker>
        </defs>

        {/* Back Tunnel Arch */}
        <path
          d={
            backRing.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.u} ${p.v}`).join(' ') + ' Z'
          }
          fill="rgba(30, 41, 59, 0.35)"
          stroke="#475569"
          strokeWidth="1.2"
          strokeDasharray="3,3"
        />

        {/* Longitudinal Tunnel Edges */}
        {frontRing.map((fp, i) => (
          <line
            key={i}
            x1={backRing[i].u}
            y1={backRing[i].v}
            x2={fp.u}
            y2={fp.v}
            stroke="#475569"
            strokeWidth="1"
          />
        ))}

        {/* Tunnel Drive Direction Vector Arrow */}
        <line
          x1={driveStart2D.u}
          y1={driveStart2D.v}
          x2={driveEnd2D.u}
          y2={driveEnd2D.v}
          stroke="#38BDF8"
          strokeWidth="2.2"
          markerEnd="url(#mini-drive-arrow)"
        />
        <text
          x={driveEnd2D.u}
          y={driveEnd2D.v - 6}
          fill="#38BDF8"
          fontSize="9"
          fontFamily="IBM Plex Mono, monospace"
          fontWeight="bold"
          textAnchor="middle"
        >
          DRIVE {driveAz}°
        </text>

        {/* 3D Joint Discontinuity Plane */}
        <polygon
          points={planeCorners2D.map((p) => `${p.u},${p.v}`).join(' ')}
          fill={color}
          fillOpacity="0.34"
          stroke={color}
          strokeWidth="2"
        />

        {/* Horizontal Strike Line across Plane */}
        <line
          x1={s1.u}
          y1={s1.v}
          x2={s2.u}
          y2={s2.v}
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeDasharray="4,3"
        />
        <text
          x={s2.u}
          y={s2.v - 4}
          fill="#FFFFFF"
          fontSize="8.5"
          fontFamily="IBM Plex Mono, monospace"
          fontWeight="bold"
          textAnchor="middle"
        >
          STRIKE {planeInfo.strikeDeg}°
        </text>

        {/* Steepest Down-Dip Vector Arrow */}
        <line
          x1={origin2D.u}
          y1={origin2D.v}
          x2={dipTip2D.u}
          y2={dipTip2D.v}
          stroke="#FACC15"
          strokeWidth="2.5"
          markerEnd="url(#mini-dip-arrow)"
        />
        <text
          x={dipTip2D.u}
          y={dipTip2D.v + 10}
          fill="#FACC15"
          fontSize="9"
          fontFamily="IBM Plex Mono, monospace"
          fontWeight="bold"
          textAnchor="middle"
        >
          DIP {planeInfo.dipDeg}°→{planeInfo.dipDirectionDeg}°
        </text>

        {/* Front Tunnel Arch (Face) */}
        <path
          d={
            frontRing.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.u} ${p.v}`).join(' ') + ' Z'
          }
          fill="none"
          stroke="#94A3B8"
          strokeWidth="1.8"
        />

        <text
          x="8"
          y="167"
          fill="#94A3B8"
          fontSize="8.5"
          fontFamily="IBM Plex Mono, monospace"
        >
          Drag to orbit 3D · ΔStrike-Drive: {driveEval.acuteStrikeToDriveAngleDeg}°
        </text>
      </svg>

      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-slate-300">
          Strike <strong className="text-white">{planeInfo.strikeDeg}°</strong> · Dip{' '}
          <strong className="text-amber-300">
            {planeInfo.dipDeg}°/{planeInfo.dipDirectionDeg}°
          </strong>
        </span>
        <span
          className={`px-1.5 py-0.5 rounded font-bold ${
            driveEval.rmrAdjustmentRating >= -2
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
              : driveEval.rmrAdjustmentRating >= -5
              ? 'bg-amber-950 text-amber-300 border border-amber-700'
              : 'bg-rose-950 text-rose-300 border border-rose-700'
          }`}
        >
          {driveEval.favorabilityLabel} (RMR {driveEval.rmrAdjustmentRating})
        </span>
      </div>
    </div>
  );
};

// ============================================================================
// FULL INTERACTIVE 3D STRIKE & DIP VISUALIZER MODAL
// ============================================================================
interface Interactive3DStrikeDipVisualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  joints: Joint[];
  jointSets: JointSet[];
  initialSelectedJointId?: string | null;
  onUpdateJointOrientation?: (jointId: string, dipDirection: number, dip: number) => void;
  onCaptureSnapshotToSheetAppendix?: (snapshot: StrikeDip3DSnapshotAppendix) => void;
  onDeleteSnapshotFromSheetAppendix?: (snapshotId: string) => void;
  onOpenEngineeringSheet?: () => void;
  onOpenUnwrapped3DStrip?: () => void;
}

export const Interactive3DStrikeDipVisualizerModal: React.FC<
  Interactive3DStrikeDipVisualizerModalProps
> = ({
  isOpen,
  onClose,
  geometry,
  settings,
  joints: rawAllJoints,
  jointSets: rawAllJointSets,
  initialSelectedJointId,
  onUpdateJointOrientation,
  onCaptureSnapshotToSheetAppendix,
  onDeleteSnapshotFromSheetAppendix,
  onOpenEngineeringSheet,
  onOpenUnwrapped3DStrip,
}) => {
  // 3D is strictly based on Left Wall, Crown, and Right Wall only (Face traces excluded)
  const joints = useMemo(
    () =>
      rawAllJoints.filter(
        (j) =>
          j.surface === 'leftWall' ||
          j.surface === 'crown' ||
          j.surface === 'rightWall'
      ),
    [rawAllJoints]
  );
  const jointSets = useMemo(
    () =>
      rawAllJointSets.filter((s) =>
        joints.some((j) => j.set === s.id)
      ),
    [rawAllJointSets, joints]
  );

  // Camera Orbit State
  const [yaw, setYaw] = useState<number>(-36);
  const [pitch, setPitch] = useState<number>(25);
  const [zoom, setZoom] = useState<number>(1.0);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);

  // Mode: 'ALL_SETS' | 'SINGLE_JOINT' | 'SANDBOX'
  const [viewMode, setViewMode] = useState<'ALL_SETS' | 'SINGLE_JOINT' | 'SANDBOX'>(() =>
    initialSelectedJointId ? 'SINGLE_JOINT' : jointSets.length > 0 ? 'ALL_SETS' : 'SANDBOX'
  );
  const [selectedJointId, setSelectedJointId] = useState<string>(
    initialSelectedJointId || joints[0]?.id || ''
  );
  const [visibleSets, setVisibleSets] = useState<Record<string, boolean>>({
    J0: true,
    J1: true,
    J2: true,
    J3: true,
    J4: true,
    J5: true,
    F1: true,
  });

  // Display Toggles
  const [showStrikeLines, setShowStrikeLines] = useState<boolean>(true);
  const [showDipVectors, setShowDipVectors] = useState<boolean>(true);
  const [showNormalPoles, setShowNormalPoles] = useState<boolean>(false);
  const [showCompassGrid, setShowCompassGrid] = useState<boolean>(true);
  const [showGeometricPlanes, setShowGeometricPlanes] = useState<boolean>(false);

  // Sandbox / Interactive Override Sliders
  const [sandboxDipDir, setSandboxDipDir] = useState<number>(135);
  const [sandboxDip, setSandboxDip] = useState<number>(65);
  const [sandboxDriveAz, setSandboxDriveAz] = useState<number>(settings.driveDirection || 45);

  const dragRef = useRef<{ startX: number; startY: number; yaw0: number; pitch0: number } | null>(
    null
  );
  const svgViewportRef = useRef<SVGSVGElement | null>(null);
  const [captureBanner, setCaptureBanner] = useState<string | null>(null);

  useEffect(() => {
    if (initialSelectedJointId) {
      setSelectedJointId(initialSelectedJointId);
      setViewMode('SINGLE_JOINT');
    }
  }, [initialSelectedJointId]);

  useEffect(() => {
    setSandboxDriveAz(settings.driveDirection || 0);
  }, [settings.driveDirection]);

  // Smooth auto-rotation animation loop
  useEffect(() => {
    if (!isOpen || !autoRotate) return;
    const timer = window.setInterval(() => {
      setYaw((prev) => (prev + 0.8) % 360);
    }, 30);
    return () => window.clearInterval(timer);
  }, [isOpen, autoRotate]);

  const activeDriveAzimuth =
    viewMode === 'SANDBOX' ? sandboxDriveAz : settings.driveDirection || 0;

  // Build list of 3D planes to render
  const planesToRender = useMemo(() => {
    if (viewMode === 'SANDBOX') {
      return [
        {
          id: 'SANDBOX',
          label: 'Interactive Test Plane',
          set: 'J1',
          color: '#38BDF8',
          dipDirection: sandboxDipDir,
          dip: sandboxDip,
          offsetAlongDrive: 0,
        },
      ];
    }

    if (viewMode === 'SINGLE_JOINT') {
      const target = joints.find((j) => j.id === selectedJointId) || joints[0];
      if (!target) {
        return [
          {
            id: 'DEFAULT',
            label: 'Sample Plane J1',
            set: 'J1',
            color: '#EF4444',
            dipDirection: 135,
            dip: 65,
            offsetAlongDrive: 0,
          },
        ];
      }
      return [
        {
          id: target.id,
          label: `${target.jointNumber || target.set} (${target.surface.toUpperCase()})`,
          set: target.set,
          color: JOINT_SET_PALETTE[target.set]?.color || '#EF4444',
          dipDirection: target.dipDirection,
          dip: target.dip,
          offsetAlongDrive: 0,
        },
      ];
    }

    // ALL_SETS mode: render each active JointSet distributed cleanly along the tunnel heading
    const activeSets = jointSets.filter((s) => visibleSets[s.id] !== false);
    if (activeSets.length === 0) {
      return [
        {
          id: 'J1-DEFAULT',
          label: 'Set J1 (135° / 68°)',
          set: 'J1',
          color: '#EF4444',
          dipDirection: 135,
          dip: 68,
          offsetAlongDrive: -1.2,
        },
        {
          id: 'J2-DEFAULT',
          label: 'Set J2 (240° / 54°)',
          set: 'J2',
          color: '#22C55E',
          dipDirection: 240,
          dip: 54,
          offsetAlongDrive: 1.2,
        },
      ];
    }

    const pullLen = Math.max(4, settings.roundLength || 5);
    return activeSets.map((s, idx) => {
      const frac =
        activeSets.length === 1 ? 0 : (idx / (activeSets.length - 1) - 0.5) * (pullLen * 0.55);
      return {
        id: s.id,
        label: `Set ${s.id} (${s.avgDipDirection ?? 135}° / ${s.avgDip ?? 60}°)`,
        set: s.id,
        color: s.color || JOINT_SET_PALETTE[s.id]?.color || '#38BDF8',
        dipDirection: s.avgDipDirection ?? 135,
        dip: s.avgDip ?? 60,
        offsetAlongDrive: frac,
      };
    });
  }, [
    viewMode,
    sandboxDipDir,
    sandboxDip,
    joints,
    selectedJointId,
    jointSets,
    visibleSets,
    settings.roundLength,
  ]);

  if (!isOpen) return null;

  const svgW = 820;
  const svgH = 520;
  const cx = svgW / 2;
  const cy = svgH / 2 + 15;
  const baseScale = Math.min(36, 250 / Math.max(geometry.width, geometry.height)) * zoom;

  const halfLen = Math.max(3.2, (settings.roundLength || 4.5) * 0.75);
  const centerH = geometry.height / 2;

  // Sample realistic curved tunnel cross-section points for 3D extrusion (no boxy pentagons)
  const rawProfilePts =
    geometry.crossSectionPoints && geometry.crossSectionPoints.length >= 10
      ? geometry.crossSectionPoints
      : (() => {
          const halfW = geometry.width / 2;
          const wH = Math.min(geometry.height * 0.65, geometry.wallHeight || geometry.height * 0.55);
          const archRise = Math.max(0.5, geometry.height - wH);
          const pts: { x: number; y: number }[] = [
            { x: -halfW, y: 0 },
            { x: -halfW, y: wH * 0.5 },
            { x: -halfW, y: wH },
          ];
          const archSteps = 14;
          for (let i = 1; i < archSteps; i++) {
            const t = i / archSteps;
            const ang = Math.PI * (1 - t);
            pts.push({
              x: Math.cos(ang) * halfW,
              y: wH + Math.sin(ang) * archRise,
            });
          }
          pts.push(
            { x: halfW, y: wH },
            { x: halfW, y: wH * 0.5 },
            { x: halfW, y: 0 }
          );
          return pts;
        })();

  const frontSection2D = rawProfilePts.map((pt) =>
    project3DPoint(
      tunnelLocalToWorldENU(pt.x, pt.y, halfLen, activeDriveAzimuth, centerH),
      yaw,
      pitch,
      baseScale,
      cx,
      cy
    )
  );
  const midSection2D = rawProfilePts.map((pt) =>
    project3DPoint(
      tunnelLocalToWorldENU(pt.x, pt.y, 0, activeDriveAzimuth, centerH),
      yaw,
      pitch,
      baseScale,
      cx,
      cy
    )
  );
  const backSection2D = rawProfilePts.map((pt) =>
    project3DPoint(
      tunnelLocalToWorldENU(pt.x, pt.y, -halfLen, activeDriveAzimuth, centerH),
      yaw,
      pitch,
      baseScale,
      cx,
      cy
    )
  );

  // Compass Rose on floor plane (y = -centerH - 0.3)
  const compassRadius = Math.max(geometry.width, halfLen * 2) * 0.72;
  const floorY = -centerH - 0.25;
  const compassRingPts = Array.from({ length: 37 }, (_, i) => {
    const a = (i * 10 * Math.PI) / 180;
    return project3DPoint(
      {
        x: Math.sin(a) * compassRadius,
        y: floorY,
        z: Math.cos(a) * compassRadius,
      },
      yaw,
      pitch,
      baseScale,
      cx,
      cy
    );
  });

  const northPt = project3DPoint({ x: 0, y: floorY, z: compassRadius }, yaw, pitch, baseScale, cx, cy);
  const southPt = project3DPoint({ x: 0, y: floorY, z: -compassRadius }, yaw, pitch, baseScale, cx, cy);
  const eastPt = project3DPoint({ x: compassRadius, y: floorY, z: 0 }, yaw, pitch, baseScale, cx, cy);
  const westPt = project3DPoint({ x: -compassRadius, y: floorY, z: 0 }, yaw, pitch, baseScale, cx, cy);

  // Tunnel Drive Direction 3D Vector along centerline
  const driveVecStart = project3DPoint(
    tunnelLocalToWorldENU(0, 0.15, -halfLen * 0.9, activeDriveAzimuth, centerH),
    yaw,
    pitch,
    baseScale,
    cx,
    cy
  );
  const driveVecEnd = project3DPoint(
    tunnelLocalToWorldENU(0, 0.15, halfLen * 1.32, activeDriveAzimuth, centerH),
    yaw,
    pitch,
    baseScale,
    cx,
    cy
  );

  // Primary plane for detailed right-hand engineering readout
  const primaryPlane = planesToRender[0];
  const primaryVectors = computeJointPlane3DVectors(
    primaryPlane.dipDirection,
    primaryPlane.dip
  );
  const primaryDriveEval = evaluateStrikeDipRelativeToDrive(
    primaryVectors.strikeDeg,
    primaryVectors.dipDirectionDeg,
    primaryVectors.dipDeg,
    activeDriveAzimuth
  );

  const attachedSnapshots = settings.strikeDip3DSnapshots || [];

  const handleCaptureCurrent3DViewToAppendix = () => {
    const svgEl = svgViewportRef.current;
    if (!svgEl) return;

    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svgEl);
    if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
      svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svgW * 1.5;
      canvas.height = svgH * 1.5;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngDataUrl = canvas.toDataURL('image/png');

        const snapshot: StrikeDip3DSnapshotAppendix = {
          id: `3D-SNAP-${Date.now()}`,
          capturedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          imageDataUrl: pngDataUrl,
          viewModeLabel:
            viewMode === 'ALL_SETS'
              ? `All Joint Sets (${jointSets.length})`
              : viewMode === 'SINGLE_JOINT'
              ? `Single Trace (${primaryPlane.label})`
              : 'Interactive 3D Test Plane',
          cameraAnglesLabel: `Yaw ${Math.round(yaw)}° · Pitch ${Math.round(pitch)}° · Zoom ${zoom.toFixed(2)}×`,
          driveAzimuthDeg: Math.round(activeDriveAzimuth),
          primaryPlaneLabel: primaryPlane.label,
          strikeDeg: primaryVectors.strikeDeg,
          dipDirectionDeg: primaryVectors.dipDirectionDeg,
          dipDeg: primaryVectors.dipDeg,
          acuteStrikeToDriveAngleDeg: primaryDriveEval.acuteStrikeToDriveAngleDeg,
          favorabilityLabel: primaryDriveEval.favorabilityLabel,
          rmrAdjustmentRating: primaryDriveEval.rmrAdjustmentRating,
          explanation: primaryDriveEval.explanation,
        };

        onCaptureSnapshotToSheetAppendix?.(snapshot);
        setCaptureBanner(
          `Captured 3D snapshot (${primaryPlane.label} — Strike ${primaryVectors.strikeDeg}° / Dip ${primaryVectors.dipDeg}°) to Final Engineering Mapping Sheet Appendix!`
        );
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4">
      <div className="w-full max-w-6xl max-h-[94dvh] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-900">
        {/* TOP HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-sm sm:text-base tracking-wide">
                Interactive 3D Joint Strike &amp; Dip Visualizer (Wall &amp; Crown Only)
              </h2>
              <p className="text-[11px] text-slate-300">
                Strictly based on mapped Left Wall, Crown Arch, and Right Wall traces (2D Face traces excluded from 3D)
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs + Unwrapped Wall & Crown Button */}
          <div className="flex items-center gap-2">
            {onOpenUnwrapped3DStrip && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenUnwrapped3DStrip();
                }}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold cursor-pointer shadow-xs"
                title="Open 3D Unwrapped Wall & Crown Strip Logger"
              >
                See Unwrapped Wall &amp; Crown 3D
              </button>
            )}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-mono">
              <button
                type="button"
                onClick={() => setViewMode('ALL_SETS')}
                className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                  viewMode === 'ALL_SETS'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                All Joint Sets ({jointSets.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('SINGLE_JOINT')}
                className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                  viewMode === 'SINGLE_JOINT'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Single Mapped Trace ({joints.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('SANDBOX')}
                className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                  viewMode === 'SANDBOX'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Interactive Strike/Dip Tester
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* MAIN BODY */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT 8 COLUMNS: INTERACTIVE 3D VIEWPORT */}
          <div className="lg:col-span-8 flex flex-col gap-2.5">
            {/* Camera Preset Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">
                  3D Camera:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setYaw(-36);
                    setPitch(25);
                    setZoom(1.0);
                  }}
                  className="px-2 py-1 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold cursor-pointer"
                >
                  Isometric 3D
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setYaw(-activeDriveAzimuth);
                    setPitch(8);
                  }}
                  className="px-2 py-1 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold cursor-pointer"
                >
                  Look Along Drive ({activeDriveAzimuth}°)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setYaw(0);
                    setPitch(85);
                  }}
                  className="px-2 py-1 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold cursor-pointer"
                >
                  Top Plan (North Up)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setYaw(-activeDriveAzimuth + 90);
                    setPitch(5);
                  }}
                  className="px-2 py-1 rounded bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold cursor-pointer"
                >
                  Side Profile
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowGeometricPlanes((p) => !p)}
                  className={`px-2.5 py-1 rounded border font-bold cursor-pointer ${
                    showGeometricPlanes
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                  }`}
                  title="Toggle between Exact Unwrapped Wall & Crown Points Only vs. Extended Geometric Strike/Dip Planes"
                >
                  {showGeometricPlanes ? 'Showing Geometric Planes' : 'Exact Unwrapped Points (Realistic)'}
                </button>
                <button
                  type="button"
                  onClick={handleCaptureCurrent3DViewToAppendix}
                  className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 font-bold cursor-pointer flex items-center gap-1.5 shadow-xs"
                  title="Capture a high-resolution snapshot of this 3D Strike & Dip view and attach it as an Appendix to the Final Engineering Mapping Sheet"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Capture Snapshot to Sheet Appendix ({attachedSnapshots.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAutoRotate((r) => !r)}
                  className={`px-2.5 py-1 rounded border font-bold cursor-pointer flex items-center gap-1 ${
                    autoRotate
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {autoRotate ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  {autoRotate ? 'Stop Orbit' : 'Auto-Orbit'}
                </button>
              </div>
            </div>

            {captureBanner && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-950">
                <div className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{captureBanner}</span>
                </div>
                {onOpenEngineeringSheet && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenEngineeringSheet();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-mono text-[11px] font-bold cursor-pointer flex items-center gap-1"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    View in Engineering Sheet Appendix
                  </button>
                )}
              </div>
            )}

            {/* 3D SVG Canvas */}
            <div className="relative flex-1 min-h-[400px] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden select-none">
              <svg
                ref={svgViewportRef}
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setAutoRotate(false);
                  dragRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    yaw0: yaw,
                    pitch0: pitch,
                  };
                }}
                onPointerMove={(e) => {
                  if (!dragRef.current) return;
                  const dx = e.clientX - dragRef.current.startX;
                  const dy = e.clientY - dragRef.current.startY;
                  setYaw(dragRef.current.yaw0 + dx * 0.45);
                  setPitch(Math.max(-75, Math.min(85, dragRef.current.pitch0 + dy * 0.45)));
                }}
                onPointerUp={() => {
                  dragRef.current = null;
                }}
                onWheel={(e) => {
                  e.preventDefault();
                  setZoom((z) => Math.max(0.55, Math.min(2.2, z - e.deltaY * 0.001)));
                }}
              >
                <defs>
                  <marker
                    id="drive-arrow-3d"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8" />
                  </marker>
                  <marker
                    id="dip-arrow-3d"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="5.5"
                    markerHeight="5.5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#FACC15" />
                  </marker>
                  <marker
                    id="normal-arrow-3d"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#A855F7" />
                  </marker>
                </defs>

                {/* 1. COMPASS ROSE & HORIZONTAL DATUM RING (N, E, S, W) */}
                {showCompassGrid && (
                  <g>
                    <path
                      d={
                        compassRingPts
                          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.u} ${p.v}`)
                          .join(' ') + ' Z'
                      }
                      fill="rgba(15, 23, 42, 0.45)"
                      stroke="#334155"
                      strokeWidth="1.5"
                    />
                    <line
                      x1={southPt.u}
                      y1={southPt.v}
                      x2={northPt.u}
                      y2={northPt.v}
                      stroke="#475569"
                      strokeWidth="1.2"
                      strokeDasharray="4,4"
                    />
                    <line
                      x1={westPt.u}
                      y1={westPt.v}
                      x2={eastPt.u}
                      y2={eastPt.v}
                      stroke="#475569"
                      strokeWidth="1.2"
                      strokeDasharray="4,4"
                    />
                    <text
                      x={northPt.u}
                      y={northPt.v - 6}
                      fill="#F87171"
                      fontFamily="IBM Plex Mono, monospace"
                      fontSize="13"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      N (000°)
                    </text>
                    <text
                      x={southPt.u}
                      y={southPt.v + 14}
                      fill="#94A3B8"
                      fontFamily="IBM Plex Mono, monospace"
                      fontSize="11"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      S (180°)
                    </text>
                    <text
                      x={eastPt.u + 12}
                      y={eastPt.v + 4}
                      fill="#94A3B8"
                      fontFamily="IBM Plex Mono, monospace"
                      fontSize="11"
                      fontWeight="bold"
                      textAnchor="start"
                    >
                      E (090°)
                    </text>
                    <text
                      x={westPt.u - 12}
                      y={westPt.v + 4}
                      fill="#94A3B8"
                      fontFamily="IBM Plex Mono, monospace"
                      fontSize="11"
                      fontWeight="bold"
                      textAnchor="end"
                    >
                      W (270°)
                    </text>
                  </g>
                )}

                {/* 2. 3D TUNNEL WIREFRAME SHELL (BACK ARCH, MID RIB, LONGITUDINAL RIBS) */}
                <g>
                  <path
                    d={
                      backSection2D
                        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.u} ${p.v}`)
                        .join(' ') + ' Z'
                    }
                    fill="rgba(30, 41, 59, 0.28)"
                    stroke="#475569"
                    strokeWidth="1.5"
                    strokeDasharray="4,4"
                  />
                  <path
                    d={
                      midSection2D
                        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.u} ${p.v}`)
                        .join(' ') + ' Z'
                    }
                    fill="none"
                    stroke="#334155"
                    strokeWidth="1.2"
                    strokeDasharray="3,3"
                  />
                  {frontSection2D.map((fp, idx) => {
                    if (idx % 2 !== 0 && idx !== frontSection2D.length - 1) return null;
                    const bp = backSection2D[idx];
                    return (
                      <line
                        key={idx}
                        x1={bp.u}
                        y1={bp.v}
                        x2={fp.u}
                        y2={fp.v}
                        stroke="#475569"
                        strokeWidth="1.2"
                      />
                    );
                  })}
                </g>

                {/* 3. TUNNEL DRIVE DIRECTION 3D VECTOR ARROW */}
                <g>
                  <line
                    x1={driveVecStart.u}
                    y1={driveVecStart.v}
                    x2={driveVecEnd.u}
                    y2={driveVecEnd.v}
                    stroke="#38BDF8"
                    strokeWidth="3.5"
                    markerEnd="url(#drive-arrow-3d)"
                  />
                  <rect
                    x={driveVecEnd.u - 90}
                    y={driveVecEnd.v - 28}
                    width="180"
                    height="22"
                    rx="5"
                    fill="rgba(15, 23, 42, 0.92)"
                    stroke="#38BDF8"
                    strokeWidth="1.5"
                  />
                  <text
                    x={driveVecEnd.u}
                    y={driveVecEnd.v - 13}
                    fill="#38BDF8"
                    fontFamily="IBM Plex Mono, monospace"
                    fontSize="11"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    TUNNEL DRIVE: {String(Math.round(activeDriveAzimuth)).padStart(3, '0')}°
                  </text>
                </g>

                {/* 3.5 EXACT UNWRAPPED WALL & CROWN TRACES WRAPPED ONTO REALISTIC 3D TUNNEL ARCH SHELL */}
                {joints.map((j) => {
                  if (!j.geometry || j.geometry.length < 2) return null;
                  const col = JOINT_SET_PALETTE[j.set]?.color || '#38BDF8';
                  const halfW = geometry.width / 2;
                  const wH = Math.min(geometry.height * 0.65, geometry.wallHeight || geometry.height * 0.55);
                  const archRise = Math.max(0.5, geometry.height - wH);
                  const crownArc = Math.max(3.0, geometry.crownArcLength || geometry.width * 1.25);
                  const pullLen = Math.max(1.5, settings.roundLength || 4.0);

                  const tracePts2D = j.geometry.map((pt) => {
                    let localRight = 0;
                    let localUp = wH;
                    let localAlongDrive = 0;

                    // 2D unwrapped coordinates (u2d horizontal left-to-right, v2d vertical top-to-bottom)
                    const u2d =
                      j.surface === 'crown'
                        ? Math.max(0, Math.min(1, (pt.x + crownArc * 0.5) / crownArc))
                        : Math.max(0, Math.min(1, pt.x / pullLen));
                    const v2d =
                      j.surface === 'crown'
                        ? Math.max(0, Math.min(1, 1 - pt.y / pullLen))
                        : Math.max(0, Math.min(1, 1 - pt.y / Math.max(0.5, wH)));

                    // Rotate 2D unwrapped trace 90° clockwise (2D horizontal -> 3D vertical)
                    const u3d = 1 - v2d;
                    const v3d = u2d;

                    if (j.surface === 'leftWall') {
                      localRight = -halfW;
                      localUp = v3d * wH;
                      localAlongDrive = (u3d - 0.5) * halfLen * 2;
                    } else if (j.surface === 'crown') {
                      const ang = Math.PI * (1 - v3d);
                      localRight = Math.cos(ang) * halfW;
                      localUp = wH + Math.sin(ang) * archRise;
                      localAlongDrive = (u3d - 0.5) * halfLen * 2;
                    } else {
                      localRight = halfW;
                      localUp = (1 - v3d) * wH;
                      localAlongDrive = (u3d - 0.5) * halfLen * 2;
                    }

                    return project3DPoint(
                      tunnelLocalToWorldENU(
                        localRight,
                        localUp,
                        localAlongDrive,
                        activeDriveAzimuth,
                        centerH
                      ),
                      yaw,
                      pitch,
                      baseScale,
                      cx,
                      cy
                    );
                  });

                  const dPath = tracePts2D
                    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.u} ${p.v}`)
                    .join(' ');
                  const midP = tracePts2D[Math.floor(tracePts2D.length / 2)] || tracePts2D[0];

                  return (
                    <g key={`exact-3d-trace-${j.id}`}>
                      <path
                        d={dPath}
                        fill="none"
                        stroke={col}
                        strokeWidth="3.0"
                        strokeLinecap="round"
                      />
                      {tracePts2D.map((tp, tIdx) => (
                        <circle
                          key={tIdx}
                          cx={tp.u}
                          cy={tp.v}
                          r="3.8"
                          fill="#020617"
                          stroke={col}
                          strokeWidth="1.8"
                        />
                      ))}
                      {midP && (
                        <text
                          x={midP.u}
                          y={midP.v - 6}
                          textAnchor="middle"
                          fontSize="9.5"
                          fontFamily="IBM Plex Mono, monospace"
                          fontWeight="bold"
                          fill={col}
                          stroke="#020617"
                          strokeWidth="2.4"
                          paintOrder="stroke"
                        >
                          {j.set} ({Math.round(j.dip)}°/{String(Math.round(j.dipDirection)).padStart(3, '0')}°)
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* 4. 3D GEOLOGICAL DISCONTINUITY PLANES, STRIKE LINES & DIP VECTORS */}
                {(showGeometricPlanes || viewMode === 'SANDBOX' || joints.length === 0) &&
                  planesToRender.map((plane) => {
                  const vecs = computeJointPlane3DVectors(plane.dipDirection, plane.dip);
                  const center3D = tunnelLocalToWorldENU(
                    0,
                    centerH,
                    plane.offsetAlongDrive,
                    activeDriveAzimuth,
                    centerH
                  );
                  const r = Math.max(geometry.width, geometry.height) * 0.58;

                  const corners3D: Vec3[] = [
                    {
                      x: center3D.x + (-vecs.strikeVec.x - vecs.dipVec.x) * r,
                      y: center3D.y + (-vecs.strikeVec.y - vecs.dipVec.y) * r,
                      z: center3D.z + (-vecs.strikeVec.z - vecs.dipVec.z) * r,
                    },
                    {
                      x: center3D.x + (vecs.strikeVec.x - vecs.dipVec.x) * r,
                      y: center3D.y + (vecs.strikeVec.y - vecs.dipVec.y) * r,
                      z: center3D.z + (vecs.strikeVec.z - vecs.dipVec.z) * r,
                    },
                    {
                      x: center3D.x + (vecs.strikeVec.x + vecs.dipVec.x) * r,
                      y: center3D.y + (vecs.strikeVec.y + vecs.dipVec.y) * r,
                      z: center3D.z + (vecs.strikeVec.z + vecs.dipVec.z) * r,
                    },
                    {
                      x: center3D.x + (-vecs.strikeVec.x + vecs.dipVec.x) * r,
                      y: center3D.y + (-vecs.strikeVec.y + vecs.dipVec.y) * r,
                      z: center3D.z + (-vecs.strikeVec.z + vecs.dipVec.z) * r,
                    },
                  ];
                  const corners2D = corners3D.map((c) =>
                    project3DPoint(c, yaw, pitch, baseScale, cx, cy)
                  );
                  const center2D = project3DPoint(center3D, yaw, pitch, baseScale, cx, cy);

                  // Strike Line endpoints passing through plane center
                  const strikeStart2D = project3DPoint(
                    {
                      x: center3D.x - vecs.strikeVec.x * r * 1.05,
                      y: center3D.y,
                      z: center3D.z - vecs.strikeVec.z * r * 1.05,
                    },
                    yaw,
                    pitch,
                    baseScale,
                    cx,
                    cy
                  );
                  const strikeEnd2D = project3DPoint(
                    {
                      x: center3D.x + vecs.strikeVec.x * r * 1.05,
                      y: center3D.y,
                      z: center3D.z + vecs.strikeVec.z * r * 1.05,
                    },
                    yaw,
                    pitch,
                    baseScale,
                    cx,
                    cy
                  );

                  // Steepest Down-Dip Vector
                  const dipEnd2D = project3DPoint(
                    {
                      x: center3D.x + vecs.dipVec.x * r * 0.95,
                      y: center3D.y + vecs.dipVec.y * r * 0.95,
                      z: center3D.z + vecs.dipVec.z * r * 0.95,
                    },
                    yaw,
                    pitch,
                    baseScale,
                    cx,
                    cy
                  );

                  // 3D Normal Vector Pole
                  const normalEnd2D = project3DPoint(
                    {
                      x: center3D.x + vecs.normalVec.x * r * 0.8,
                      y: center3D.y + vecs.normalVec.y * r * 0.8,
                      z: center3D.z + vecs.normalVec.z * r * 0.8,
                    },
                    yaw,
                    pitch,
                    baseScale,
                    cx,
                    cy
                  );

                  return (
                    <g key={plane.id}>
                      {/* Translucent 3D Joint Plane */}
                      <polygon
                        points={corners2D.map((c) => `${c.u},${c.v}`).join(' ')}
                        fill={plane.color}
                        fillOpacity="0.32"
                        stroke={plane.color}
                        strokeWidth="2.5"
                      />

                      {/* Horizontal Strike Line */}
                      {showStrikeLines && (
                        <>
                          <line
                            x1={strikeStart2D.u}
                            y1={strikeStart2D.v}
                            x2={strikeEnd2D.u}
                            y2={strikeEnd2D.v}
                            stroke="#FFFFFF"
                            strokeWidth="2.2"
                            strokeDasharray="6,4"
                          />
                          <rect
                            x={strikeEnd2D.u - 52}
                            y={strikeEnd2D.v - 20}
                            width="104"
                            height="18"
                            rx="4"
                            fill="rgba(15, 23, 42, 0.88)"
                            stroke="#FFFFFF"
                            strokeWidth="1"
                          />
                          <text
                            x={strikeEnd2D.u}
                            y={strikeEnd2D.v - 7}
                            fill="#FFFFFF"
                            fontFamily="IBM Plex Mono, monospace"
                            fontSize="10"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            STRIKE {String(vecs.strikeDeg).padStart(3, '0')}°
                          </text>
                        </>
                      )}

                      {/* Down-Dip Vector Arrow */}
                      {showDipVectors && (
                        <>
                          <line
                            x1={center2D.u}
                            y1={center2D.v}
                            x2={dipEnd2D.u}
                            y2={dipEnd2D.v}
                            stroke="#FACC15"
                            strokeWidth="3"
                            markerEnd="url(#dip-arrow-3d)"
                          />
                          <rect
                            x={dipEnd2D.u - 68}
                            y={dipEnd2D.v + 6}
                            width="136"
                            height="19"
                            rx="4"
                            fill="rgba(15, 23, 42, 0.9)"
                            stroke="#FACC15"
                            strokeWidth="1.2"
                          />
                          <text
                            x={dipEnd2D.u}
                            y={dipEnd2D.v + 19}
                            fill="#FACC15"
                            fontFamily="IBM Plex Mono, monospace"
                            fontSize="10"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            {plane.set}: DIP {vecs.dipDeg}° → {String(vecs.dipDirectionDeg).padStart(3, '0')}°
                          </text>
                        </>
                      )}

                      {/* Normal Pole Vector */}
                      {showNormalPoles && (
                        <line
                          x1={center2D.u}
                          y1={center2D.v}
                          x2={normalEnd2D.u}
                          y2={normalEnd2D.v}
                          stroke="#A855F7"
                          strokeWidth="2.2"
                          markerEnd="url(#normal-arrow-3d)"
                        />
                      )}
                    </g>
                  );
                })}

                {/* 5. FRONT TUNNEL FACE BOUNDARY RING */}
                <path
                  d={
                    frontSection2D
                      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.u} ${p.v}`)
                      .join(' ') + ' Z'
                  }
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="2.5"
                />
              </svg>

              {/* Bottom-left Legend Overlay */}
              <div className="absolute bottom-3 left-3 px-3 py-2 bg-slate-900/90 border border-slate-700 rounded-xl text-[11px] font-mono text-slate-200 flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-sky-400 inline-block" />
                  Tunnel Drive ({activeDriveAzimuth}°)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-b-2 border-dashed border-white inline-block" />
                  Strike Line
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-yellow-400 inline-block" />
                  Down-Dip Vector
                </span>
              </div>
            </div>

            {/* Display Layer Checkboxes */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStrikeLines}
                    onChange={(e) => setShowStrikeLines(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600"
                  />
                  <span>Show Strike Line</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDipVectors}
                    onChange={(e) => setShowDipVectors(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600"
                  />
                  <span>Show Down-Dip Vector</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showNormalPoles}
                    onChange={(e) => setShowNormalPoles(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600"
                  />
                  <span>Show 3D Normal Pole</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCompassGrid}
                    onChange={(e) => setShowCompassGrid(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600"
                  />
                  <span>Show Compass Rose (N/E/S/W)</span>
                </label>
              </div>
            </div>
          </div>

          {/* RIGHT 4 COLUMNS: SELECTION CONTROLS & DRIVE FAVORABILITY READOUT */}
          <div className="lg:col-span-4 flex flex-col justify-between gap-3">
            <div className="space-y-3">
              {/* Mode-Specific Controls */}
              {viewMode === 'ALL_SETS' && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Active Joint Sets in 3D Tunnel
                  </div>
                  {jointSets.length > 0 ? (
                    <div className="space-y-1.5">
                      {jointSets.map((s) => (
                        <label
                          key={s.id}
                          className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-sky-300 font-mono text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={visibleSets[s.id] !== false}
                              onChange={(e) =>
                                setVisibleSets((prev) => ({
                                  ...prev,
                                  [s.id]: e.target.checked,
                                }))
                              }
                            />
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: s.color }}
                            />
                            <span className="font-bold text-slate-900">Set {s.id}</span>
                          </div>
                          <span className="text-slate-600">
                            Strike {normalizeAzimuth((s.avgDipDirection ?? 135) - 90)}° · Dip{' '}
                            {s.avgDip ?? 60}°→{s.avgDipDirection ?? 135}°
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Showing default reference sets J1 &amp; J2. Map joints on the canvas to see your project sets.
                    </p>
                  )}
                </div>
              )}

              {viewMode === 'SINGLE_JOINT' && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Select Mapped Joint Trace
                  </div>
                  {joints.length > 0 ? (
                    <>
                      <select
                        value={selectedJointId}
                        onChange={(e) => setSelectedJointId(e.target.value)}
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs font-bold text-slate-900"
                      >
                        {joints.map((j, idx) => (
                          <option key={j.id} value={j.id}>
                            #{idx + 1} Set {j.set} ({j.surface.toUpperCase()}) — Dip Dir{' '}
                            {Math.round(j.dipDirection)}° / Dip {Math.round(j.dip)}°
                          </option>
                        ))}
                      </select>

                      {onUpdateJointOrientation &&
                        joints.find((j) => j.id === selectedJointId) && (
                          <div className="pt-2 space-y-2 border-t border-slate-200 font-mono text-xs">
                            <div className="text-[11px] font-bold text-sky-800">
                              Live Adjust Selected Trace 3D Orientation:
                            </div>
                            <label className="block space-y-0.5">
                              <div className="flex justify-between text-[11px]">
                                <span>Dip Direction (0–360°):</span>
                                <strong>{primaryVectors.dipDirectionDeg}°</strong>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="360"
                                value={primaryVectors.dipDirectionDeg}
                                onChange={(e) =>
                                  onUpdateJointOrientation(
                                    selectedJointId,
                                    Number(e.target.value),
                                    primaryVectors.dipDeg
                                  )
                                }
                                className="w-full accent-sky-600"
                              />
                            </label>
                            <label className="block space-y-0.5">
                              <div className="flex justify-between text-[11px]">
                                <span>True Dip Angle (0–90°):</span>
                                <strong>{primaryVectors.dipDeg}°</strong>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="90"
                                value={primaryVectors.dipDeg}
                                onChange={(e) =>
                                  onUpdateJointOrientation(
                                    selectedJointId,
                                    primaryVectors.dipDirectionDeg,
                                    Number(e.target.value)
                                  )
                                }
                                className="w-full accent-amber-500"
                              />
                            </label>
                          </div>
                        )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-500">
                      No joints mapped yet. Switch to "Interactive Strike/Dip Tester" to test any orientation.
                    </p>
                  )}
                </div>
              )}

              {viewMode === 'SANDBOX' && (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5 font-mono text-xs">
                  <div className="font-bold text-amber-950 uppercase tracking-wider">
                    Interactive 3D Strike, Dip &amp; Drive Tester
                  </div>
                  <label className="block space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-700">Dip Direction (0–360°):</span>
                      <strong className="text-slate-950">
                        {sandboxDipDir}° (Strike {normalizeAzimuth(sandboxDipDir - 90)}°)
                      </strong>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={sandboxDipDir}
                      onChange={(e) => setSandboxDipDir(Number(e.target.value))}
                      className="w-full accent-sky-600"
                    />
                  </label>

                  <label className="block space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-700">True Dip Angle (0–90°):</span>
                      <strong className="text-slate-950">{sandboxDip}°</strong>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="90"
                      value={sandboxDip}
                      onChange={(e) => setSandboxDip(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </label>

                  <label className="block space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-700">Tunnel Drive Azimuth (0–360°):</span>
                      <strong className="text-sky-700">{sandboxDriveAz}°</strong>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={sandboxDriveAz}
                      onChange={(e) => setSandboxDriveAz(Number(e.target.value))}
                      className="w-full accent-emerald-600"
                    />
                  </label>
                </div>
              )}

              {/* CALCULATED STRIKE & DIP VS. TUNNEL DRIVE DIRECTION CARD */}
              <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-3 font-mono">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-cyan-400">
                    3D ORIENTATION vs. TUNNEL DRIVE
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[11px]">
                    {primaryPlane.label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400">STRIKE (RHR)</div>
                    <div className="text-base font-bold text-white">
                      {String(primaryVectors.strikeDeg).padStart(3, '0')}°
                    </div>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400">DIP DIRECTION</div>
                    <div className="text-base font-bold text-amber-300">
                      {String(primaryVectors.dipDirectionDeg).padStart(3, '0')}°
                    </div>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400">TRUE DIP</div>
                    <div className="text-base font-bold text-amber-400">
                      {String(primaryVectors.dipDeg).padStart(2, '0')}°
                    </div>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Tunnel Drive Azimuth:</span>
                    <span className="font-bold text-sky-400">
                      {String(Math.round(activeDriveAzimuth)).padStart(3, '0')}°
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Strike-to-Drive Angle (Δα):</span>
                    <span className="font-bold text-white">
                      {primaryDriveEval.acuteStrikeToDriveAngleDeg}°
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Drive vs. Dip Relation:</span>
                    <span className="font-bold text-cyan-300">
                      {primaryDriveEval.dipRelativeRelation.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                    <span className="text-slate-400">Bieniawski RMR89 Rating:</span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                        primaryDriveEval.rmrAdjustmentRating >= -2
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : primaryDriveEval.rmrAdjustmentRating >= -5
                          ? 'bg-amber-950 text-amber-300 border border-amber-700'
                          : 'bg-rose-950 text-rose-300 border border-rose-700'
                      }`}
                    >
                      {primaryDriveEval.favorabilityLabel} ({primaryDriveEval.rmrAdjustmentRating})
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  {primaryDriveEval.explanation}
                </p>
              </div>

              {/* APPENDIX SNAPSHOT CAPTURE & ATTACHED GALLERY CARD */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-emerald-700" />
                    Engineering Sheet Appendix ({attachedSnapshots.length})
                  </span>
                  {attachedSnapshots.length > 0 && onOpenEngineeringSheet && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenEngineeringSheet();
                      }}
                      className="text-[11px] font-bold text-sky-700 hover:underline cursor-pointer"
                    >
                      Open Sheet →
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCaptureCurrent3DViewToAppendix}
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Capture Current 3D View to Sheet Appendix
                </button>

                {attachedSnapshots.length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {attachedSnapshots.map((snap, idx) => (
                      <div
                        key={snap.id}
                        className="flex items-center justify-between gap-2 p-1.5 bg-white border border-emerald-200 rounded-lg"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={snap.imageDataUrl}
                            alt={snap.primaryPlaneLabel}
                            className="w-12 h-8 object-cover rounded border border-slate-300 shrink-0"
                          />
                          <div className="truncate">
                            <div className="text-[10px] font-bold text-slate-900 truncate">
                              #{idx + 1} {snap.primaryPlaneLabel}
                            </div>
                            <div className="text-[9px] text-slate-500">
                              Strike {snap.strikeDeg}° · Dip {snap.dipDeg}°/{snap.dipDirectionDeg}° · {snap.favorabilityLabel}
                            </div>
                          </div>
                        </div>
                        {onDeleteSnapshotFromSheetAppendix && (
                          <button
                            type="button"
                            onClick={() => onDeleteSnapshotFromSheetAppendix(snap.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Remove snapshot from Appendix"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
            >
              Done / Return to Mapping Canvas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
