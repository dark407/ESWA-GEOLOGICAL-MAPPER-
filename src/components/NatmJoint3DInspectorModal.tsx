// ============================================================================
// ESWA GEOLOGICAL MAPPER — NATM 3D JOINT INSPECTOR MODAL & WORKBENCH
// Calculation-based 3D orientation, multi-surface intersections, trace extent,
// persistence analysis, and Three.js spatial visualization for NATM joints.
// High-Performance Engine with Pure White CAD Viewport & Real-Time 3D Compass
// ============================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useTheme } from '../context/ThemeContext';
import {
  Compass,
  Maximize2,
  Minimize2,
  X,
  Save,
  Check,
  RotateCcw,
  Layers,
  Activity,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  Info,
  CheckCircle2,
  Link2,
  Eye,
  EyeOff,
  Sliders,
  ChevronRight,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  Printer,
  Sparkles,
  Navigation,
  Box,
  Lock,
  ZoomIn,
  ZoomOut,
  Move,
  PenTool,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Zap,
  Camera,
} from 'lucide-react';
import {
  FieldJointTrace,
  FieldDipPlaneSurface,
  FieldPanelId,
  FieldJointGroupingId,
  FIELD_JOINT_GROUP_COLORS,
  buildDipSurfaceOutlineAndCentroid,
  computeTraceOrientationFromTunnelDrive,
} from '../engine/fieldMappingEngine';
import { getSurfacePanelLabelMap, MappingDomainType } from '../engine/surfaceMappingEngine';
import {
  TunnelSpatialGeometry,
  Joint3DInspectionData,
  calculateStrikeFromDipDirection,
  constructJointPlane,
  deriveAnchorPointFromPoints,
  calculatePolylineLengthM,
  calculatePlaneSurfaceIntersections,
  clipPlaneToTunnelBox,
  calculateJointPairIntersection,
  JointPairIntersectionResult,
  runJointEngineValidationTests,
  calculateSurfaceApparentTraceAngles,
  TunnelSurfacesApparentDipMatrix,
  normalizeAngle360,
  clampDip,
  Vec3D,
  getTunnelRelativeDirectionLabel,
  getCrownStrikePair,
  calculateJointFractureIntensityAndArea,
  constructPlaneFromFaceTraceHinge,
  constructPlaneFromTraceHinge,
  constructTraceAnchoredPlaneFromOrientation,
  buildTunnelCrossSectionProfileMetric,
  FaceTraceHingePlaneResult,
  TraceHingePlaneResult,
  JointFractureIntensityAndAreaResult,
  pointToTunnel3DMetric,
  constructCurvedCrownPlaneAndTrace,
  recomputeAlignedCanvasTracePoints,
  TracePivotEndpoint,
  DipHalfCircleSense,
  isStrikeMeasuredOnPanel,
  computeEndpointPivotedTracePoints,
} from '../engine/joint3DInspectorEngine';
import { AdvancedGeologicalAnalysisModal } from './AdvancedGeologicalAnalysisModal';
import { DigitalTwinPhotogrammetryModal } from './DigitalTwinPhotogrammetryModal';
import { createTunnelGeometry } from '../engine/geometryEngine';
import { Joint, JointSet, SurfaceType } from '../types/tunnel';

export interface NatmJoint3DInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeJoint?: FieldJointTrace | null;
  allRoundJoints: FieldJointTrace[];
  activeDipSurface?: FieldDipPlaneSurface | null;
  allRoundDipSurfaces?: FieldDipPlaneSurface[];
  initialInspectTargetType?: 'joint' | 'dip_surface';
  tunnelGeometry: TunnelSpatialGeometry;
  existingPhotos?: Partial<Record<FieldPanelId, string>>;
  onSaveJoint: (updatedJoint: FieldJointTrace) => void;
  onSaveDipSurface?: (updatedSurface: FieldDipPlaneSurface) => void;
}

function convertDipSurfaceToVirtualJoint(dp: FieldDipPlaneSurface): FieldJointTrace {
  const baseOutline =
    dp.outlinePolygon && dp.outlinePolygon.length >= 3
      ? dp.outlinePolygon
      : buildDipSurfaceOutlineAndCentroid(dp.points, dp.brushRadius || 28).outlinePolygon;
  const cx =
    baseOutline.length > 0
      ? baseOutline.reduce((s, p) => s + p.x, 0) / baseOutline.length
      : dp.points[0]?.x ?? 420;
  const cy =
    baseOutline.length > 0
      ? baseOutline.reduce((s, p) => s + p.y, 0) / baseOutline.length
      : dp.points[0]?.y ?? 320;
  const r = Math.max(24, dp.brushRadius || 28);
  const strikeRad = (((dp.strike ?? (dp.dipDirection - 90 + 360) % 360) - 90) * Math.PI) / 180;
  const syntheticPts =
    dp.points && dp.points.length >= 2
      ? dp.points
      : [
          { x: Number((cx - Math.cos(strikeRad) * r).toFixed(1)), y: Number((cy - Math.sin(strikeRad) * r).toFixed(1)) },
          { x: Number((cx + Math.cos(strikeRad) * r).toFixed(1)), y: Number((cy + Math.sin(strikeRad) * r).toFixed(1)) },
        ];
  return {
    id: dp.id,
    label: dp.label || 'DP',
    panel: dp.panel,
    points: syntheticPts,
    dipDirection: dp.dipDirection ?? 135,
    dipAmount: dp.dipAmount ?? 60,
    strike: dp.strike ?? ((dp.dipDirection - 90 + 360) % 360),
    setId: dp.setId || 'unassigned',
    editedByCompass: true,
    inspection3D: dp.inspection3D,
  };
}

export type InspectionViewTab =
  | 'VIEW_3D'
  | 'VIEW_FACE'
  | 'VIEW_LEFT_WALL'
  | 'VIEW_RIGHT_WALL'
  | 'VIEW_CROWN'
  | 'VIEW_UNROLLED_COMBINED';

// ----------------------------------------------------------------------------
// GEOLOGICAL AZIMUTH TO CARDINAL COMPASS DIRECTION HELPER
// ----------------------------------------------------------------------------
function getCardinal(deg: number): string {
  const d = ((deg % 360) + 360) % 360;
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(d / 22.5) % 16;
  return directions[idx];
}

// ----------------------------------------------------------------------------
// THREE.JS 3D BILLBOARD SPRITE TEXT GENERATOR WITH GPU TEXTURE CACHE
// ----------------------------------------------------------------------------
const BILLBOARD_TEXTURE_CACHE = new Map<string, THREE.CanvasTexture>();

function createBillboardLabel(
  text: string,
  bgColor: string,
  textColor: string,
  scaleX = 1.65,
  scaleY = 0.36
): THREE.Sprite {
  const cacheKey = `${text}|${bgColor}|${textColor}`;
  let texture = BILLBOARD_TEXTURE_CACHE.get(cacheKey);
  if (!texture) {
    if (BILLBOARD_TEXTURE_CACHE.size > 160) {
      const oldestKey = BILLBOARD_TEXTURE_CACHE.keys().next().value;
      if (oldestKey) {
        BILLBOARD_TEXTURE_CACHE.get(oldestKey)?.dispose();
        BILLBOARD_TEXTURE_CACHE.delete(oldestKey);
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 88;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.roundRect(6, 6, 372, 76, 18);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.font = 'bold 28px monospace, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 192, 44);
    }
    texture = new THREE.CanvasTexture(canvas);
    texture.userData = { isCached: true };
    texture.needsUpdate = true;
    BILLBOARD_TEXTURE_CACHE.set(cacheKey, texture);
  }
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scaleX, scaleY, 1);
  return sprite;
}

let CACHED_VALIDATION_REPORT: ReturnType<typeof runJointEngineValidationTests> | null = null;
function getCachedValidationReport() {
  if (!CACHED_VALIDATION_REPORT) {
    CACHED_VALIDATION_REPORT = runJointEngineValidationTests();
  }
  return CACHED_VALIDATION_REPORT;
}

// ----------------------------------------------------------------------------
// HIGH-RESPONSIVENESS NUMERIC STEPPER COMPONENT
// Handles typing, backspace, deleting, and selecting without snap-to-zero or lag
// ----------------------------------------------------------------------------
interface NumericStepperInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  isCircular?: boolean; // 0..360 wrapping
  isLight?: boolean;
  onChange: (val: number) => void;
}

const NumericStepperInput: React.FC<NumericStepperInputProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '°',
  isCircular = false,
  isLight = false,
  onChange,
}) => {
  const safeVal = typeof value === 'number' && !isNaN(value) ? value : min;
  const [localStr, setLocalStr] = useState<string>(String(safeVal));
  const isFocusedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalStr(String(safeVal));
    }
  }, [safeVal]);

  const commitValue = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '' || isNaN(Number(trimmed))) {
      setLocalStr(String(safeVal));
      return;
    }
    let num = Number(trimmed);
    if (isCircular) {
      num = ((num % 360) + 360) % 360;
    } else {
      num = Math.max(min, Math.min(max, num));
    }
    setLocalStr(String(num));
    onChange(num);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalStr(val);
    if (val.trim() !== '' && !isNaN(Number(val))) {
      let num = Number(val);
      if (isCircular) {
        num = ((num % 360) + 360) % 360;
      } else {
        num = Math.max(min, Math.min(max, num));
      }
      onChange(num);
    }
  };

  const handleStep = (delta: number) => {
    let next: number;
    if (isCircular) {
      next = ((value + delta) % 360 + 360) % 360;
    } else {
      next = Math.max(min, Math.min(max, value + delta));
    }
    setLocalStr(String(next));
    onChange(next);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className={`font-bold ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>{label}:</span>
        <strong className={`font-mono text-sm ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
          {value}{unit}
        </strong>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => handleStep(-step)}
          className={`px-2 py-1 rounded font-mono font-bold text-xs select-none cursor-pointer border transition-colors ${
            isLight
              ? 'bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 border-slate-300'
              : 'bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 border-slate-700'
          }`}
          title={`Decrease ${label}`}
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={localStr}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={(e) => {
            isFocusedRef.current = false;
            commitValue(e.target.value);
          }}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitValue(localStr);
              e.currentTarget.blur();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              handleStep(step);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              handleStep(-step);
            }
          }}
          className={`w-full text-center px-2 py-1 rounded border font-bold text-xs font-mono focus:outline-none transition-colors ${
            isLight
              ? 'bg-white border-slate-300 text-amber-800 focus:border-amber-500'
              : 'bg-slate-900 border-slate-700 text-amber-300 focus:border-amber-400'
          }`}
        />
        <button
          type="button"
          onClick={() => handleStep(step)}
          className={`px-2 py-1 rounded font-mono font-bold text-xs select-none cursor-pointer border transition-colors ${
            isLight
              ? 'bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 border-slate-300'
              : 'bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 border-slate-700'
          }`}
          title={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
};

const EMPTY_DIP_SURFACES: FieldDipPlaneSurface[] = [];

export const NatmJoint3DInspectorModal: React.FC<NatmJoint3DInspectorModalProps> = (props) => {
  const firstRoundJoint = props.allRoundJoints?.[0] || null;
  const firstRoundDipSurface = props.allRoundDipSurfaces?.[0] || null;
  const effectiveJoint = useMemo(() => {
    if (props.activeJoint) return props.activeJoint;
    if (props.activeDipSurface) return convertDipSurfaceToVirtualJoint(props.activeDipSurface);
    if (firstRoundJoint) return firstRoundJoint;
    if (firstRoundDipSurface) return convertDipSurfaceToVirtualJoint(firstRoundDipSurface);
    return null;
  }, [props.activeJoint, props.activeDipSurface, firstRoundJoint, firstRoundDipSurface]);
  if (!props.isOpen || !effectiveJoint) return null;
  return <NatmJoint3DInspectorModalContent {...props} activeJoint={effectiveJoint} />;
};

const NatmJoint3DInspectorModalContent: React.FC<
  NatmJoint3DInspectorModalProps & { activeJoint: FieldJointTrace }
> = ({
  isOpen,
  onClose,
  activeJoint,
  allRoundJoints,
  activeDipSurface = null,
  allRoundDipSurfaces = EMPTY_DIP_SURFACES,
  initialInspectTargetType,
  tunnelGeometry: rawTunnelGeometry,
  onSaveJoint,
  onSaveDipSurface,
}) => {
  const tunnelGeometry = useMemo<TunnelSpatialGeometry>(
    () => rawTunnelGeometry,
    [
      rawTunnelGeometry.widthM,
      rawTunnelGeometry.heightM,
      rawTunnelGeometry.wallHeightM,
      rawTunnelGeometry.leftWallHeightM,
      rawTunnelGeometry.rightWallHeightM,
      rawTunnelGeometry.pullLengthM,
      rawTunnelGeometry.driveAzimuthDeg,
      rawTunnelGeometry.currentChainageM,
      rawTunnelGeometry.tunnelShape,
      rawTunnelGeometry.hasLeftWall,
      rawTunnelGeometry.hasRightWall,
      rawTunnelGeometry.hasCrown,
      rawTunnelGeometry.hasInvert,
      rawTunnelGeometry.isVerticalShaft,
      rawTunnelGeometry.mappingDomain,
      rawTunnelGeometry.excavationApproach,
      rawTunnelGeometry.shaftHalfSide,
      rawTunnelGeometry.shaftCenterMedianStatus,
      rawTunnelGeometry.crossSectionPoints?.length,
    ]
  );
  // Real-Time Theme Integration (supports light & dark themes seamlessly)
  const { theme, palette } = useTheme();
  const isLight = theme === 'light' || Boolean(palette?.isLightBg);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<InspectionViewTab>('VIEW_3D');

  // Collapsible & Shrinkable Aside Sidebar State
  const [isAsideCollapsed, setIsAsideCollapsed] = useState<boolean>(false);
  const [asideWidthMode, setAsideWidthMode] = useState<'compact' | 'standard'>('standard');

  // Target Type: 'joint' vs 'dip_surface'
  const [inspectTargetType, setInspectTargetType] = useState<'joint' | 'dip_surface'>(
    initialInspectTargetType || (activeDipSurface ? 'dip_surface' : 'joint')
  );
  const [currentDipSurfaceId, setCurrentDipSurfaceId] = useState<string>(
    activeDipSurface?.id || allRoundDipSurfaces[0]?.id || ''
  );

  // Currently Selected Joint in Inspector (defaults to activeJoint.id, switchable to any joint in round)
  const [currentJointId, setCurrentJointId] = useState<string>(activeJoint.id);
  const [pendingSwitchJointId, setPendingSwitchJointId] = useState<string | null>(null);
  const [showSwitchConfirm, setShowSwitchConfirm] = useState<boolean>(false);

  // Interactive 3D Plane/Disk Gizmo Drag Mode on Three.js Canvas (defaults to false so 1-finger/mouse drag rotates the 3D tunnel)
  const [is3DGizmoDragMode, setIs3DGizmoDragMode] = useState<boolean>(false);
  const is3DGizmoDragModeRef = useRef<boolean>(is3DGizmoDragMode);
  useEffect(() => {
    is3DGizmoDragModeRef.current = is3DGizmoDragMode;
  }, [is3DGizmoDragMode]);

  // Synchronize when activeJoint or activeDipSurface prop changes from parent
  useEffect(() => {
    if (initialInspectTargetType === 'dip_surface' && activeDipSurface?.id) {
      setInspectTargetType('dip_surface');
      setCurrentDipSurfaceId(activeDipSurface.id);
    } else if (activeJoint?.id) {
      setInspectTargetType(initialInspectTargetType || 'joint');
      setCurrentJointId(activeJoint.id);
    }
  }, [activeJoint?.id, activeDipSurface?.id, initialInspectTargetType]);

  const currentDipSurface = useMemo(() => {
    if (inspectTargetType !== 'dip_surface') return null;
    return (
      allRoundDipSurfaces.find((d) => d.id === currentDipSurfaceId) ||
      activeDipSurface ||
      allRoundDipSurfaces[0] ||
      null
    );
  }, [inspectTargetType, allRoundDipSurfaces, currentDipSurfaceId, activeDipSurface]);

  const currentJoint = useMemo(() => {
    if (inspectTargetType === 'dip_surface' && currentDipSurface) {
      return convertDipSurfaceToVirtualJoint(currentDipSurface);
    }
    return allRoundJoints.find((j) => j.id === currentJointId) || activeJoint;
  }, [inspectTargetType, currentDipSurface, allRoundJoints, currentJointId, activeJoint]);

  // Editable Orientation Parameters (auto-recalculated from drawn trace geometry if not yet manually edited)
  const isCrown = currentJoint.panel === 'crown';
  const canonicalTraceEst = useMemo(() => {
    if (
      inspectTargetType !== 'dip_surface' &&
      !currentJoint.editedByCompass &&
      !currentJoint.inspection3D &&
      currentJoint.points &&
      currentJoint.points.length >= 2
    ) {
      return computeTraceOrientationFromTunnelDrive(
        currentJoint.points,
        currentJoint.panel || 'face',
        tunnelGeometry.driveAzimuthDeg ?? 0,
        currentJoint.crownDipSign || '+90',
        tunnelGeometry.widthM || 8.4,
        tunnelGeometry.heightM || 7.2,
        Boolean(tunnelGeometry.isVerticalShaft)
      );
    }
    return null;
  }, [
    inspectTargetType,
    currentJoint.id,
    currentJoint.editedByCompass,
    currentJoint.inspection3D,
    currentJoint.points,
    currentJoint.panel,
    currentJoint.crownDipSign,
    tunnelGeometry.driveAzimuthDeg,
    tunnelGeometry.widthM,
    tunnelGeometry.heightM,
    tunnelGeometry.isVerticalShaft,
  ]);

  const resolvedInitialDip = isCrown
    ? (currentJoint.editedByCompass || currentJoint.inspection3D) &&
      typeof currentJoint.dipAmount === 'number' &&
      currentJoint.dipAmount >= 1 &&
      currentJoint.dipAmount <= 90
      ? currentJoint.dipAmount
      : 90
    : (canonicalTraceEst?.dipAmount ?? currentJoint.dipAmount ?? 65);

  const resolvedInitialDipDir =
    canonicalTraceEst?.dipDirection ?? currentJoint.dipDirection ?? 135;
  const [dipDirection, setDipDirection] = useState<number>(resolvedInitialDipDir);
  const [dipAmount, setDipAmount] = useState<number>(resolvedInitialDip);
  const [jointSetId, setJointSetId] = useState<FieldJointGroupingId>(currentJoint.setId || 'unassigned');

  const isSurfaceMapping = Boolean(
    tunnelGeometry.mappingDomain && tunnelGeometry.mappingDomain !== 'TUNNEL'
  );
  const domainPanelMap = useMemo(
    () =>
      getSurfacePanelLabelMap(
        (tunnelGeometry.mappingDomain as MappingDomainType) || 'TUNNEL',
        Boolean(tunnelGeometry.isVerticalShaft)
      ),
    [tunnelGeometry.mappingDomain, tunnelGeometry.isVerticalShaft]
  );
  const getPortionEntry = (panelId: FieldPanelId) =>
    panelId === 'left_wall'
      ? domainPanelMap.leftWall
      : panelId === 'right_wall'
      ? domainPanelMap.rightWall
      : panelId === 'crown'
      ? domainPanelMap.crown
      : panelId === 'shaft_sn'
      ? domainPanelMap.shaftSn || domainPanelMap.rightWall
      : domainPanelMap.face;
  const getPortionTitle = (panelId: FieldPanelId) =>
    getPortionEntry(panelId)?.fullLabel || panelId.replace('_', ' ');
  const getPortionShort = (panelId: FieldPanelId) =>
    getPortionEntry(panelId)?.shortLabel || panelId.replace('_', ' ');
  const activePortionPanel: FieldPanelId =
    inspectTargetType === 'dip_surface'
      ? currentDipSurface?.panel || 'face'
      : currentJoint.panel || 'face';

  // Unified rule across Tunnel, Vertical Shaft, and Surface Mapping:
  // - Strike-Measured Panels (isStrikeMeasuredPanel === true):
  //   Tunnel Crown, Surface Berm/Crest/Trench Floor, Vertical Shaft Bottom Face (Pull 0m).
  //   -> Changing Strike / Dip Direction asks for Starting (P1) or Ending (P2) point and pivots around it;
  //      once completed, changing Dip Amount tilts the 3D plane hinge-based around that Strike trace.
  // - Dip-Measured Panels (isStrikeMeasuredPanel === false):
  //   Tunnel Face/Left Wall/Right Wall, Vertical Shaft 4 Quadrant Walls, Surface Face/Left Wall/Right Wall.
  //   -> Changing Dip Amount asks for Starting (P1) or Ending (P2) point and dips around that point;
  //      once completed, changing Dip Direction rotates the 3D plane hinge-based around that tilted trace.
  const isStrikeMeasuredPanel = isStrikeMeasuredOnPanel(
    currentJoint.panel || 'face',
    tunnelGeometry
  );
  const isCrownOrSurface = isStrikeMeasuredPanel;
  const isFaceTrace = !tunnelGeometry.isVerticalShaft && currentJoint.panel === 'face';
  const isWallTrace =
    currentJoint.panel === 'left_wall' ||
    currentJoint.panel === 'right_wall' ||
    (Boolean(tunnelGeometry.isVerticalShaft) &&
      (currentJoint.panel === 'crown' || currentJoint.panel === 'shaft_sn'));
  const isCrownTrace = isStrikeMeasuredPanel;

  const [isHingeRotationActive, setIsHingeRotationActive] = useState<boolean>(
    inspectTargetType !== 'dip_surface'
  );
  const [isStrikeLineHingeLocked, setIsStrikeLineHingeLocked] = useState<boolean>(
    inspectTargetType !== 'dip_surface' && isStrikeMeasuredPanel
  );
  const [hingeDipDeg, setHingeDipDeg] = useState<number>(resolvedInitialDip || 90);
  const [hingeDipSide, setHingeDipSide] = useState<'heading' | 'collar'>(
    currentJoint.panel === 'crown' && currentJoint.crownDipSign === '-90' ? 'collar' : 'heading'
  );
  const [showIntensityMethodModal, setShowIntensityMethodModal] = useState<boolean>(false);
  const [showDigitalTwinModal, setShowDigitalTwinModal] = useState<boolean>(false);

  // Dip Half-Circle Sense ('inwards' = Dip Inwards into rock/heading, 'outwards' = Dip Outwards toward excavation/collar)
  const [dipHalfCircleSense, setDipHalfCircleSense] = useState<DipHalfCircleSense>(
    currentJoint.panel === 'crown' && currentJoint.crownDipSign === '-90' ? 'outwards' : 'inwards'
  );

  // Endpoint-based Dip / Strike Pivot State ('start' = P1 Starting Point, 'end' = P2 Ending Point)
  const [tracePivotEndpoint, setTracePivotEndpoint] = useState<TracePivotEndpoint | null>(null);
  const [isDipAmountEdited, setIsDipAmountEdited] = useState<boolean>(false);
  const [isStrikeDirEdited, setIsStrikeDirEdited] = useState<boolean>(false);
  const [isPrimaryStepCompleted, setIsPrimaryStepCompleted] = useState<boolean>(false);
  const [initialDipDirectionForPivot, setInitialDipDirectionForPivot] = useState<number>(
    resolvedInitialDipDir
  );
  const [hingeIndicationModal, setHingeIndicationModal] = useState<{
    mode: 'FACE_DIP_AMOUNT' | 'CROWN_SURFACE_STRIKE_DIR';
    targetValue: number;
    currentValue: number;
    targetSense?: DipHalfCircleSense;
  } | null>(null);

  const handleDipHalfCircleSenseChange = (nextSense: DipHalfCircleSense) => {
    const nextSide: 'heading' | 'collar' = nextSense === 'inwards' ? 'heading' : 'collar';
    const isFlipping = nextSense !== dipHalfCircleSense;
    setDipHalfCircleSense(nextSense);
    setHingeDipSide(nextSide);
    if (!isStrikeMeasuredPanel && inspectTargetType !== 'dip_surface') {
      if (!tracePivotEndpoint) {
        setHingeIndicationModal({
          mode: 'FACE_DIP_AMOUNT',
          targetValue: dipAmount ?? 60,
          currentValue: dipAmount ?? 60,
          targetSense: nextSense,
        });
        return;
      }
      setIsDipAmountEdited(true);
      setIsHingeRotationActive(true);
    }
    if (isFlipping) {
      setDipDirection((prev) => (((prev ?? 135) + 180) % 360 + 360) % 360);
    }
  };

  const handleRequestDipAmountChange = (nextDip: number, explicitSense?: DipHalfCircleSense) => {
    const clamped = Math.max(0, Math.min(90, Math.round(nextDip)));
    const targetSense = explicitSense || dipHalfCircleSense;
    if (explicitSense && explicitSense !== dipHalfCircleSense) {
      setDipHalfCircleSense(explicitSense);
      setHingeDipSide(explicitSense === 'inwards' ? 'heading' : 'collar');
    }
    if (inspectTargetType === 'dip_surface') {
      setIsHingeRotationActive(false);
      setDipAmount(clamped);
      setHingeDipDeg(clamped);
      return;
    }
    if (!isStrikeMeasuredPanel) {
      // On Dip-measured panels (Tunnel Face/Walls, Shaft Quadrant Walls, Surface Face/Walls):
      // Ask which endpoint (Starting Point P1 or Ending Point P2) to base the Dip Amount change on if not yet selected
      if (!tracePivotEndpoint && (clamped !== dipAmount || targetSense !== dipHalfCircleSense)) {
        setHingeIndicationModal({
          mode: 'FACE_DIP_AMOUNT',
          targetValue: clamped,
          currentValue: dipAmount ?? 60,
          targetSense,
        });
        return;
      }
      setIsDipAmountEdited(true);
      setIsHingeRotationActive(true);
      setDipAmount(clamped);
      setHingeDipDeg(clamped);
      return;
    }
    // On Strike-measured panels (Crown / Surface Berm / Shaft Bottom Face):
    // Dip Amount rotates the 3D plane hinge-based around the Strike trace
    setIsHingeRotationActive(true);
    setDipAmount(clamped);
    setHingeDipDeg(clamped);
  };

  // Continuous 0°..180° Half-Circle Protractor angle:
  // 0°..90° = Dip Inwards (0° Horizontal Inwards -> 90° Vertical)
  // 90°..180° = Dip Outwards (90° Vertical -> 180° Horizontal Outwards, i.e., dipAmount = 180 - angle)
  const halfCircleProtractorAngle = useMemo(() => {
    const d = Math.max(0, Math.min(90, dipAmount ?? 60));
    return dipHalfCircleSense === 'inwards' ? d : 180 - d;
  }, [dipAmount, dipHalfCircleSense]);

  const handleHalfCircleProtractorChange = (angle0to180: number) => {
    const clamped180 = Math.max(0, Math.min(180, Math.round(angle0to180)));
    const nextSense: DipHalfCircleSense = clamped180 <= 90 ? 'inwards' : 'outwards';
    const nextDip = clamped180 <= 90 ? clamped180 : 180 - clamped180;
    const isFlipping = nextSense !== dipHalfCircleSense;
    if (isFlipping) {
      setDipDirection((prev) => (((prev ?? 135) + 180) % 360 + 360) % 360);
    }
    handleRequestDipAmountChange(nextDip, nextSense);
  };

  const handleRequestDipDirectionOrStrikeChange = (nextDipDir: number) => {
    const normDir = ((Math.round(nextDipDir) % 360) + 360) % 360;
    if (inspectTargetType === 'dip_surface') {
      setIsHingeRotationActive(false);
      setDipDirection(normDir);
      return;
    }
    if (isStrikeMeasuredPanel) {
      // Vice Versa on Strike-measured panels (Tunnel Crown, Surface Berm/Crest/Floor, Shaft Bottom Face):
      // Ask which endpoint (Starting Point P1 or Ending Point P2) to base the Strike / Dip Direction change on if not yet selected
      if (!tracePivotEndpoint && normDir !== dipDirection) {
        setHingeIndicationModal({
          mode: 'CROWN_SURFACE_STRIKE_DIR',
          targetValue: normDir,
          currentValue: dipDirection ?? 135,
        });
        return;
      }
      setIsStrikeDirEdited(true);
      setIsStrikeLineHingeLocked(false);
      setIsHingeRotationActive(true);
      setDipDirection(normDir);
    } else {
      // On Dip-measured panels: once Dip Amount is set, Dip Direction rotates the 3D plane hinge-based around the trace
      setIsHingeRotationActive(true);
      setDipDirection(normDir);
    }
  };

  // Active 2D trace points pivoted around Starting Point (P1) or Ending Point (P2)
  const activeTracePoints = useMemo(() => {
    return computeEndpointPivotedTracePoints({
      points: currentJoint.points,
      panel: currentJoint.panel || 'face',
      geom: tunnelGeometry,
      pivotEndpoint: tracePivotEndpoint,
      targetDipAmountDeg: dipAmount ?? 60,
      targetDipDirectionDeg: dipDirection ?? 135,
      initialDipDirectionDeg: initialDipDirectionForPivot,
      isDipAmountEdited,
      isStrikeDirEdited,
      dipHalfCircleSense,
    });
  }, [
    currentJoint.points,
    currentJoint.panel,
    tunnelGeometry,
    tracePivotEndpoint,
    dipAmount,
    dipDirection,
    initialDipDirectionForPivot,
    isDipAmountEdited,
    isStrikeDirEdited,
    dipHalfCircleSense,
  ]);

  const handleTraceHingeAngleOrSideChange = (
    nextHingeDeg: number,
    nextSide: 'heading' | 'collar' = hingeDipSide
  ) => {
    const clampedHinge = Math.max(0, Math.min(90, Math.round(nextHingeDeg)));
    const isFlippingSide = nextSide !== hingeDipSide;
    const nextSense: DipHalfCircleSense = nextSide === 'heading' ? 'inwards' : 'outwards';
    setHingeDipDeg(clampedHinge);
    setHingeDipSide(nextSide);
    setDipHalfCircleSense(nextSense);
    if (activeTracePoints && activeTracePoints.length >= 2) {
      const targetPrefDir = isFlippingSide
        ? ((dipDirection + 180) % 360 + 360) % 360
        : dipDirection;
      if (isFlippingSide) {
        setDipDirection(targetPrefDir);
      } else {
        handleRequestDipAmountChange(clampedHinge, nextSense);
      }
    } else {
      setDipAmount(clampedHinge);
    }
  };

  const [measurementSource, setMeasurementSource] = useState<'MANUAL_COMPASS' | 'GEOMETRIC_FIT' | 'PHOTOGRAMMETRY_MULTIVIEW'>(
    currentJoint.inspection3D?.measurementSource || (currentJoint.editedByCompass ? 'MANUAL_COMPASS' : 'GEOMETRIC_FIT')
  );
  const [orientationConfidence, setOrientationConfidence] = useState<'HIGH' | 'MEDIUM' | 'LOW'>(
    currentJoint.inspection3D?.orientationConfidence || 'HIGH'
  );
  const [angularUncertainty, setAngularUncertainty] = useState<number>(
    currentJoint.inspection3D?.angularUncertaintyDeg ?? 3.0
  );

  // Persistence & Geological Interpretation
  const [persistenceInterpretation, setPersistenceInterpretation] = useState<string>(
    currentJoint.inspection3D?.persistenceInterpretation ||
      (isSurfaceMapping
        ? `Visible trace exposed across ${domainPanelMap.face.shortLabel}. Continuity into adjacent mapped exposure evaluated.`
        : 'Visible trace exposed across excavation face. Continuity into crown arch observed with tight intact rock bridge.')
  );
  const [persistenceAssumptions, setPersistenceAssumptions] = useState<string>(
    currentJoint.inspection3D?.persistenceAssumptions ||
      (isSurfaceMapping
        ? `Orientation assumed planar within the mapped ${domainPanelMap.domainTitle.toLowerCase()} exposure boundary.`
        : 'Orientation assumed planar within the excavation volume. Planar extrapolation clipped to tunnel cross-section perimeter.')
  );
  const [persistenceConfidence, setPersistenceConfidence] = useState<'HIGH' | 'MEDIUM' | 'LOW'>(
    currentJoint.inspection3D?.persistenceConfidence || 'MEDIUM'
  );

  // Cross-Surface Linking
  const [linkedTraceIds, setLinkedTraceIds] = useState<string[]>(
    currentJoint.inspection3D?.linkedTraceIds || []
  );

  // When switching currentJointId or currentDipSurfaceId or inspectTargetType, load its orientation parameters
  useEffect(() => {
    const isStrikePan = isStrikeMeasuredOnPanel(currentJoint.panel || 'face', tunnelGeometry);
    const recalcEst =
      inspectTargetType !== 'dip_surface' &&
      !currentJoint.editedByCompass &&
      !currentJoint.inspection3D &&
      currentJoint.points &&
      currentJoint.points.length >= 2
        ? computeTraceOrientationFromTunnelDrive(
            currentJoint.points,
            currentJoint.panel || 'face',
            tunnelGeometry.driveAzimuthDeg ?? 0,
            currentJoint.crownDipSign || '+90',
            tunnelGeometry.widthM || 8.4,
            tunnelGeometry.heightM || 7.2,
            Boolean(tunnelGeometry.isVerticalShaft)
          )
        : null;
    const resolvedDip = isStrikePan
      ? (currentJoint.editedByCompass || currentJoint.inspection3D) &&
        typeof currentJoint.dipAmount === 'number' &&
        currentJoint.dipAmount >= 1 &&
        currentJoint.dipAmount <= 90
        ? currentJoint.dipAmount
        : 90
      : (recalcEst?.dipAmount ?? currentJoint.dipAmount ?? 65);
    const resolvedDir = recalcEst?.dipDirection ?? currentJoint.dipDirection ?? 135;
    setDipDirection(resolvedDir);
    setInitialDipDirectionForPivot(resolvedDir);
    setDipAmount(resolvedDip);
    setHingeDipDeg(resolvedDip);
    const initSide = isStrikePan && currentJoint.crownDipSign === '-90' ? 'collar' : 'heading';
    setHingeDipSide(initSide);
    setDipHalfCircleSense(initSide === 'collar' ? 'outwards' : 'inwards');
    setIsHingeRotationActive(inspectTargetType !== 'dip_surface');
    setIsStrikeLineHingeLocked(inspectTargetType !== 'dip_surface' && isStrikePan);
    setTracePivotEndpoint(null);
    setIsDipAmountEdited(false);
    setIsStrikeDirEdited(false);
    setIsPrimaryStepCompleted(false);
    setHingeIndicationModal(null);
    setJointSetId(currentJoint.setId || 'unassigned');
    setMeasurementSource(
      currentJoint.inspection3D?.measurementSource || (currentJoint.editedByCompass ? 'MANUAL_COMPASS' : 'GEOMETRIC_FIT')
    );
    setOrientationConfidence(currentJoint.inspection3D?.orientationConfidence || 'HIGH');
    setAngularUncertainty(currentJoint.inspection3D?.angularUncertaintyDeg ?? 3.0);
    setPersistenceInterpretation(
      currentJoint.inspection3D?.persistenceInterpretation ||
        (isSurfaceMapping
          ? `Visible trace exposed across ${domainPanelMap.face.shortLabel}. Continuity into adjacent mapped exposure evaluated.`
          : 'Visible trace exposed across excavation face. Continuity into crown arch observed with tight intact rock bridge.')
    );
    setPersistenceAssumptions(
      currentJoint.inspection3D?.persistenceAssumptions ||
        (isSurfaceMapping
          ? `Orientation assumed planar within the mapped ${domainPanelMap.domainTitle.toLowerCase()} exposure boundary.`
          : 'Orientation assumed planar within the excavation volume. Planar extrapolation clipped to tunnel cross-section perimeter.')
    );
    setPersistenceConfidence(currentJoint.inspection3D?.persistenceConfidence || 'MEDIUM');
    setLinkedTraceIds(currentJoint.inspection3D?.linkedTraceIds || []);
  }, [currentJointId, currentDipSurfaceId, inspectTargetType, isSurfaceMapping]);

  // Check if current joint has unsaved edits
  const hasUnsavedChanges = useMemo(() => {
    const isCr = currentJoint.panel === 'crown';
    const baselineDip = isCr
      ? (currentJoint.editedByCompass || currentJoint.inspection3D) &&
        typeof currentJoint.dipAmount === 'number' &&
        currentJoint.dipAmount >= 1 &&
        currentJoint.dipAmount <= 90
        ? currentJoint.dipAmount
        : 90
      : (currentJoint.dipAmount ?? 65);
    return (
      dipDirection !== (currentJoint.dipDirection ?? 135) ||
      dipAmount !== baselineDip ||
      jointSetId !== (currentJoint.setId || 'unassigned') ||
      isDipAmountEdited ||
      isStrikeDirEdited
    );
  }, [dipDirection, dipAmount, jointSetId, currentJoint, isDipAmountEdited, isStrikeDirEdited]);

  // Toggle for interior plane sheet (default true to immediately display the colored cutting plane)
  const [showInteriorPlane, setShowInteriorPlane] = useState<boolean>(true);

  // Plane Display Mode: 'TRACED_LENGTH' (exact 2D traced joint length plane) | 'EXTENDED' (current full extended plane) | 'CLIPPED' (clipped to tunnel box)
  const [planeDisplayMode, setPlaneDisplayMode] = useState<'TRACED_LENGTH' | 'EXTENDED' | 'CLIPPED'>('TRACED_LENGTH');
  const [tracedPlaneDepthMode, setTracedPlaneDepthMode] = useState<'MATCH_TRACE' | 'ONE_SIDED' | 'HALF_TRACE'>('MATCH_TRACE');
  const defaultCalculatedExt = useMemo(() => {
    const w = tunnelGeometry.widthM || 8.5;
    const h = tunnelGeometry.heightM || 7.5;
    return Math.max(5.0, Math.round(Math.max(w, h) * 0.65 * 10) / 10);
  }, [tunnelGeometry.widthM, tunnelGeometry.heightM]);
  const [planeExtensionM, setPlaneExtensionM] = useState<number>(defaultCalculatedExt);

  // Pair Intersection Comparison Target
  const otherJoints = useMemo(
    () => allRoundJoints.filter((j) => j.id !== currentJoint.id),
    [allRoundJoints, currentJoint.id]
  );
  const [compareTargetJointId, setCompareTargetJointId] = useState<string>(
    otherJoints[0]?.id || ''
  );

  // Save Feedback Status
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVED'>('IDLE');

  // UI Overlays in Canvas (user can toggle legend if needed, default is clean canvas)
  const [showLegendOverlay, setShowLegendOverlay] = useState<boolean>(false);

  // Interactive 3D Compass & Plot Plane State (Compass hidden by default for clean canvas view)
  const [showCompass, setShowCompass] = useState<boolean>(false);
  const [showAdvanceAnalysis, setShowAdvanceAnalysis] = useState<boolean>(false);
  const [cameraTheta, setCameraTheta] = useState<number>(Math.PI / 4);
  const [showPlotPlaneDrawer, setShowPlotPlaneDrawer] = useState<boolean>(false);
  const [plotPlaneAnchorType, setPlotPlaneAnchorType] = useState<
    'AUTO' | 'FACE_CENTER' | 'CROWN_APEX' | 'LEFT_WALL' | 'RIGHT_WALL' | 'INVERT'
  >('AUTO');

  // Advance Position along Tunnel Pull:
  // Tunnel portal is at X = 0.0m; excavation face canvas is at X = pullLengthM (defaults to 3.0m toward pull)
  const defaultPull = tunnelGeometry.pullLengthM || 3.0;
  const [plotPlaneAdvanceM, setPlotPlaneAdvanceM] = useState<number>(defaultPull);

  useEffect(() => {
    if (tunnelGeometry.pullLengthM && tunnelGeometry.pullLengthM > 0) {
      const nextPull = tunnelGeometry.pullLengthM;
      setPlotPlaneAdvanceM((prev) => (prev === nextPull ? prev : nextPull));
    }
  }, [tunnelGeometry.pullLengthM]);

  // Reliable aside sidebar ref and scrolling actions
  const asideRef = useRef<HTMLElement | null>(null);

  const scrollToAsideTop = () => {
    asideRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const scrollToAsideBottom = () => {
    if (asideRef.current) {
      asideRef.current.scrollTo({ top: asideRef.current.scrollHeight, behavior: 'smooth' });
    }
  };
  const scrollAsideBy = (delta: number) => {
    if (asideRef.current) {
      asideRef.current.scrollBy({ top: delta, behavior: 'smooth' });
    }
  };

  // Adaptive Horizontal & Vertical Layout Engine
  const [viewLayoutMode, setViewLayoutMode] = useState<'SPLIT' | 'CANVAS' | 'PARAMS'>('SPLIT');
  const [verticalCanvasPosition, setVerticalCanvasPosition] = useState<'top' | 'bottom'>('top');
  const [isVerticalMode, setIsVerticalMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1024 || window.innerHeight > window.innerWidth;
  });

  useEffect(() => {
    const handleCheckOrientation = () => {
      const isVert = window.innerWidth < 1024 || window.innerHeight > window.innerWidth;
      setIsVerticalMode(isVert);
    };
    handleCheckOrientation();
    window.addEventListener('resize', handleCheckOrientation);
    window.addEventListener('orientationchange', handleCheckOrientation);
    return () => {
      window.removeEventListener('resize', handleCheckOrientation);
      window.removeEventListener('orientationchange', handleCheckOrientation);
    };
  }, []);

  // -------------------------------------------------------------------------
  // MATHEMATICAL CALCULATIONS (REAL & VALIDATED)
  // -------------------------------------------------------------------------

  // 3a. Curved Crown Arch Plane & Trace Calculation (for arched tunnel crown mapping)
  const crownCurvedData = useMemo(() => {
    if (
      currentJoint.panel !== 'crown' ||
      tunnelGeometry.isVerticalShaft ||
      !activeTracePoints ||
      activeTracePoints.length < 2
    ) {
      return null;
    }
    return constructCurvedCrownPlaneAndTrace(
      activeTracePoints,
      dipDirection ?? 135,
      dipAmount ?? 60,
      tunnelGeometry
    );
  }, [currentJoint.panel, activeTracePoints, dipDirection, dipAmount, tunnelGeometry]);

  // 3a-ii. Trace Hinge-Axis Plane Calculation (Pinned to Active Endpoint-Pivoted Trace Line on all Tunnel, Shaft & Surface panels)
  const hingePlaneResult = useMemo<TraceHingePlaneResult | null>(() => {
    if (!isHingeRotationActive || activeTracePoints.length < 2) return null;
    if (isStrikeLineHingeLocked && !isStrikeDirEdited) {
      return constructPlaneFromTraceHinge(
        activeTracePoints,
        currentJoint.panel || 'face',
        dipAmount ?? hingeDipDeg,
        hingeDipSide,
        tunnelGeometry,
        true,
        dipDirection
      );
    }
    return constructTraceAnchoredPlaneFromOrientation(
      activeTracePoints,
      currentJoint.panel || 'face',
      dipDirection ?? 135,
      dipAmount ?? 60,
      tunnelGeometry,
      hingeDipSide,
      isDipAmountEdited
    );
  }, [
    isHingeRotationActive,
    activeTracePoints,
    currentJoint.panel,
    dipDirection,
    dipAmount,
    hingeDipDeg,
    hingeDipSide,
    tunnelGeometry,
    isStrikeLineHingeLocked,
    isStrikeDirEdited,
    isDipAmountEdited,
  ]);

  // 1. Strike Convention & Angles (keeps Strike invariant only when rotating around an explicitly locked Strike Line Hinge)
  const strikeInfo = useMemo(() => {
    const base = calculateStrikeFromDipDirection(dipDirection ?? 135, dipAmount ?? 60);
    if (isStrikeLineHingeLocked && !isStrikeDirEdited && hingePlaneResult) {
      const fixedStrike = hingePlaneResult.strikeRhrDeg;
      const fixedAlt = (fixedStrike + 180) % 360;
      const p1 = Math.min(fixedStrike, fixedAlt);
      const p2 = Math.max(fixedStrike, fixedAlt);
      const pairLabel = `${String(p1).padStart(3, '0')}° ↔ ${String(p2).padStart(3, '0')}°`;
      return {
        ...base,
        strikeRhrDeg: fixedStrike,
        strikeAltDeg: fixedAlt,
        strikePair: {
          strike1: p1,
          strike2: p2,
          label: pairLabel,
        },
        strikePairLabel: pairLabel,
        isOrientationComplete: true,
      };
    }
    return {
      ...base,
      isOrientationComplete: true,
    };
  }, [dipDirection, dipAmount, isStrikeLineHingeLocked, isStrikeDirEdited, hingePlaneResult]);

  // 1b. True Dip vs. Surface Apparent Dips Matrix (Analytical Geological Calculation)
  const apparentMatrix = useMemo<TunnelSurfacesApparentDipMatrix>(() => {
    return calculateSurfaceApparentTraceAngles(
      dipDirection ?? 135,
      dipAmount ?? 60,
      tunnelGeometry?.driveAzimuthDeg ?? 0
    );
  }, [dipDirection, dipAmount, tunnelGeometry?.driveAzimuthDeg]);

  // 2. Anchor Point Derived from active (endpoint-pivoted) 2D polyline vertices or user-selected plot anchor
  const anchorPoint = useMemo(() => {
    const pull = plotPlaneAdvanceM;
    if (plotPlaneAnchorType === 'FACE_CENTER') {
      return { x: pull, y: (tunnelGeometry.widthM || 8.5) / 2, z: (tunnelGeometry.heightM || 7.5) / 2 };
    }
    if (plotPlaneAnchorType === 'CROWN_APEX') {
      return { x: pull, y: (tunnelGeometry.widthM || 8.5) / 2, z: tunnelGeometry.heightM || 7.5 };
    }
    if (plotPlaneAnchorType === 'LEFT_WALL') {
      return { x: pull, y: 0.1, z: (tunnelGeometry.wallHeightM || 3.8) / 2 };
    }
    if (plotPlaneAnchorType === 'RIGHT_WALL') {
      return { x: pull, y: (tunnelGeometry.widthM || 8.5) - 0.1, z: (tunnelGeometry.wallHeightM || 3.8) / 2 };
    }
    if (plotPlaneAnchorType === 'INVERT') {
      return { x: pull, y: (tunnelGeometry.widthM || 8.5) / 2, z: 0.1 };
    }
    const derived = deriveAnchorPointFromPoints(activeTracePoints, currentJoint.panel, tunnelGeometry);
    if (currentJoint.panel === 'face' && !tunnelGeometry.isVerticalShaft) {
      return { ...derived, x: pull };
    }
    return derived;
  }, [plotPlaneAnchorType, plotPlaneAdvanceM, activeTracePoints, currentJoint.panel, tunnelGeometry]);

  // Exact 2D Traced Joint Length in Meters
  const currentTraceLengthM = useMemo(() => {
    const rawLen =
      hingePlaneResult?.traceLengthM ||
      calculatePolylineLengthM(activeTracePoints, currentJoint.panel || 'face', tunnelGeometry) ||
      1.2;
    return Number(Math.max(0.2, rawLen).toFixed(2));
  }, [hingePlaneResult, activeTracePoints, currentJoint.panel, tunnelGeometry]);

  // 3b. ISRM & Rock Mechanics Fracture Intensity & Occupied Area Calculation
  // Note: Endpoint rotation is an isometry preserving trace length, so depend on currentJoint.points to avoid per-frame recalculation
  const fractureIntensityResult = useMemo<JointFractureIntensityAndAreaResult>(() => {
    return calculateJointFractureIntensityAndArea(
      currentJoint.points,
      allRoundJoints,
      tunnelGeometry,
      currentJoint.panel || 'face'
    );
  }, [currentJoint.points, currentJoint.panel, allRoundJoints, tunnelGeometry]);

  // 3. Mathematical Plane Equation
  const plane = useMemo(() => {
    if (hingePlaneResult) {
      return hingePlaneResult;
    }
    return constructJointPlane(
      dipDirection ?? 135,
      dipAmount ?? 60,
      anchorPoint,
      tunnelGeometry?.driveAzimuthDeg ?? 0
    );
  }, [hingePlaneResult, dipDirection, dipAmount, anchorPoint, tunnelGeometry?.driveAzimuthDeg]);

  // 4. Clipped Plane Polygon to Tunnel Bounding Box
  const clippedVertices = useMemo(() => {
    return clipPlaneToTunnelBox(plane, tunnelGeometry);
  }, [plane, tunnelGeometry]);

  // 5. Multi-Surface Intersections
  const surfaceIntersections = useMemo(() => {
    return calculatePlaneSurfaceIntersections(plane, tunnelGeometry, currentJoint.panel);
  }, [plane, tunnelGeometry, currentJoint.panel]);

  // 6. Observed Trace Lengths
  const observedLengths = useMemo(() => {
    const faceTraces = allRoundJoints.filter(
      (j) => j.panel === 'face' && (j.id === currentJoint.id || linkedTraceIds.includes(j.id))
    );
    const leftTraces = allRoundJoints.filter(
      (j) => j.panel === 'left_wall' && (j.id === currentJoint.id || linkedTraceIds.includes(j.id))
    );
    const rightTraces = allRoundJoints.filter(
      (j) => j.panel === 'right_wall' && (j.id === currentJoint.id || linkedTraceIds.includes(j.id))
    );
    const crownTraces = allRoundJoints.filter(
      (j) => j.panel === 'crown' && (j.id === currentJoint.id || linkedTraceIds.includes(j.id))
    );

    const faceM = faceTraces.reduce((acc, t) => acc + calculatePolylineLengthM(t.points, 'face', tunnelGeometry), 0);
    const leftWallM = leftTraces.reduce((acc, t) => acc + calculatePolylineLengthM(t.points, 'left_wall', tunnelGeometry), 0);
    const rightWallM = rightTraces.reduce((acc, t) => acc + calculatePolylineLengthM(t.points, 'right_wall', tunnelGeometry), 0);
    const crownM = crownTraces.reduce((acc, t) => acc + calculatePolylineLengthM(t.points, 'crown', tunnelGeometry), 0);

    const totalObservedM = Number((faceM + leftWallM + rightWallM + crownM).toFixed(2));

    return {
      faceM: Number(faceM.toFixed(2)),
      leftWallM: Number(leftWallM.toFixed(2)),
      rightWallM: Number(rightWallM.toFixed(2)),
      crownM: Number(crownM.toFixed(2)),
      totalObservedM,
    };
  }, [allRoundJoints, currentJoint, linkedTraceIds, tunnelGeometry]);

  // Joint Switching with Unsaved Changes Confirmation
  const handleRequestSwitchJoint = (targetId: string) => {
    if (targetId === currentJointId) return;
    if (hasUnsavedChanges) {
      setPendingSwitchJointId(targetId);
      setShowSwitchConfirm(true);
    } else {
      setCurrentJointId(targetId);
    }
  };

  const handleConfirmSwitch = (
    saveFirst: boolean,
    applyMode: 'TEXT_ONLY' | 'ALIGN_TRACE' = 'TEXT_ONLY'
  ) => {
    if (saveFirst) {
      handleSaveInspection(applyMode);
    }
    if (pendingSwitchJointId) {
      setCurrentJointId(pendingSwitchJointId);
    }
    setPendingSwitchJointId(null);
    setShowSwitchConfirm(false);
  };

  // 7. Plane-Plane Intersection with Compare Target
  const pairIntersectionResult = useMemo<JointPairIntersectionResult | null>(() => {
    const target = otherJoints.find((j) => j.id === compareTargetJointId);
    if (!target) return null;
    const targetAnchor = deriveAnchorPointFromPoints(target.points, target.panel, tunnelGeometry);
    const targetPlane = constructJointPlane(
      target.dipDirection ?? 135,
      target.dipAmount ?? 65,
      targetAnchor,
      tunnelGeometry?.driveAzimuthDeg ?? 0
    );
    return calculateJointPairIntersection(plane, targetPlane, tunnelGeometry?.driveAzimuthDeg ?? 0);
  }, [compareTargetJointId, otherJoints, plane, tunnelGeometry]);

  // 8. Automated Engine Validation Test Report (Cached at module scope for instant modal launch)
  const validationReport = useMemo(() => getCachedValidationReport(), []);

  // Format joints for Advance Geological Analysis modal integration
  const convertedJoints = useMemo(() => {
    return (allRoundJoints || []).map((t) => ({
      id: t.id,
      surface: (t.panel === 'left_wall' ? 'leftWall' : t.panel === 'right_wall' ? 'rightWall' : t.panel) as SurfaceType,
      points: t.points.map((p) => ({ x: p.x, y: p.y })),
      dipDirection: t.dipDirection ?? 135,
      dip: t.dipAmount ?? 65,
      strike: t.strike ?? 45,
      set: t.setId || 'J1',
      persistenceMeters: (t as any).lengthMeters || 3.0,
      spacingMeters: 0.8,
      roughness: 'ROUGH_PLANAR' as const,
      apertureMm: 1.5,
      weathering: 'SLIGHTLY_WEATHERED' as const,
      infilling: 'NONE' as const,
      seepageCondition: 'DRY' as const,
      visible: true,
    })) as unknown as Joint[];
  }, [allRoundJoints]);

  const convertedJointSets = useMemo(() => {
    const sets = ['J1', 'J2', 'J3'];
    return sets.map((s, idx) => ({
      id: s,
      name: `Joint Set ${s}`,
      color: idx === 0 ? '#ef4444' : idx === 1 ? '#3b82f6' : '#10b981',
      meanDipDirection: idx === 0 ? 135 : idx === 1 ? 225 : 315,
      meanDip: idx === 0 ? 70 : idx === 1 ? 65 : 45,
      spacing: '0.45m',
      persistence: '3.2m',
      jrc: 8,
      jcs: 85,
      roughness: 'Rough planar',
      traceCount: 4,
    })) as unknown as JointSet[];
  }, []);

  // -------------------------------------------------------------------------
  // THREE.JS HIGH-PERFORMANCE ON-DEMAND 3D CANVAS RENDERING
  // -------------------------------------------------------------------------
  const threeMountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Separate persistent groups for Tunnel Shell vs Dynamic Joint Plane (prevents WebGL context recreation)
  const tunnelGroupRef = useRef<THREE.Group | null>(null);
  const jointGroupRef = useRef<THREE.Group | null>(null);
  const requestRenderRef = useRef<() => void>(() => {});
  const cameraCenterRef = useRef<{ cx: number; cy: number; cz: number }>({
    cx: (tunnelGeometry.widthM || 8.5) / 2,
    cy: Boolean(tunnelGeometry.isVerticalShaft)
      ? (tunnelGeometry.pullLengthM || 3.0) / 2
      : (tunnelGeometry.heightM || 7.5) / 2,
    cz: Boolean(tunnelGeometry.isVerticalShaft)
      ? (tunnelGeometry.widthM || 8.5) / 2
      : (tunnelGeometry.pullLengthM || 3.0) / 2,
  });

  // Mutable camera orientation ref — prevents React state updates during drag
  const camSphericalRef = useRef<{ radius: number; theta: number; phi: number }>({
    radius: 17,
    theta: Math.PI / 4,
    phi: Math.PI / 3,
  });

  // Panning / Move target offset in Three.js coordinates
  const targetOffsetRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const lastThetaDegRef = useRef<number>(-999);

  // Set Camera Presets (smoothly updates camSphericalRef and triggers on-demand render)
  const setCameraPreset = (preset: 'ISO' | 'PLAN' | 'FACE' | 'PROFILE' | 'RIGHT') => {
    targetOffsetRef.current = { x: 0, y: 0, z: 0 };
    switch (preset) {
      case 'ISO':
        camSphericalRef.current = { radius: 17, theta: Math.PI / 4, phi: Math.PI / 3 };
        break;
      case 'PLAN':
        camSphericalRef.current = { radius: 19, theta: 0, phi: 0.05 };
        break;
      case 'FACE':
        camSphericalRef.current = { radius: 16, theta: 0, phi: Math.PI / 2 };
        break;
      case 'PROFILE': // Left Wall
        camSphericalRef.current = { radius: 17, theta: -Math.PI / 2, phi: Math.PI / 2 };
        break;
      case 'RIGHT':
        camSphericalRef.current = { radius: 17, theta: Math.PI / 2, phi: Math.PI / 2 };
        break;
    }
    setCameraTheta(camSphericalRef.current.theta);
    requestRenderRef.current();
  };

  // Align camera with True North
  const snapToNorth = () => {
    const driveAz = tunnelGeometry.driveAzimuthDeg || 0;
    camSphericalRef.current.theta = -((driveAz * Math.PI) / 180);
    setCameraTheta(camSphericalRef.current.theta);
    requestRenderRef.current();
  };

  // Align camera looking straight down the Tunnel Drive Axis (+Z)
  const snapToTunnelDrive = () => {
    camSphericalRef.current.theta = 0;
    camSphericalRef.current.phi = Math.PI / 2.3;
    setCameraTheta(0);
    requestRenderRef.current();
  };

  // Reset Camera Target & Orbit
  const resetCameraTarget = () => {
    targetOffsetRef.current = { x: 0, y: 0, z: 0 };
    camSphericalRef.current = { radius: 17, theta: Math.PI / 4, phi: Math.PI / 3 };
    setCameraTheta(Math.PI / 4);
    requestRenderRef.current();
  };

  // On-screen Zoom & Pan buttons
  const zoomIn = () => {
    camSphericalRef.current.radius = Math.max(3, camSphericalRef.current.radius - 2.5);
    requestRenderRef.current();
  };
  const zoomOut = () => {
    camSphericalRef.current.radius = Math.min(55, camSphericalRef.current.radius + 2.5);
    requestRenderRef.current();
  };
  const panCamera = (dx: number, dy: number) => {
    const cam = camSphericalRef.current;
    const rightX = Math.cos(cam.theta);
    const rightZ = -Math.sin(cam.theta);
    targetOffsetRef.current.x += rightX * dx;
    targetOffsetRef.current.z += rightZ * dx;
    targetOffsetRef.current.y += dy;
    requestRenderRef.current();
  };

  // Keep latest control state in refs for zero-lag event handlers
  const inspectTargetTypeRef = useRef(inspectTargetType);
  const isStrikeLineHingeLockedRef = useRef(isStrikeLineHingeLocked);
  useEffect(() => {
    inspectTargetTypeRef.current = inspectTargetType;
    isStrikeLineHingeLockedRef.current = isStrikeLineHingeLocked;
  }, [inspectTargetType, isStrikeLineHingeLocked]);

  // -------------------------------------------------------------------------
  // 1. INITIALIZE PERSISTENT THREE.JS WEBGL CONTEXT & ON-DEMAND RENDER ENGINE ONCE
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (activeTab !== 'VIEW_3D' || !threeMountRef.current) return;

    const container = threeMountRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 150);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software/i.test(rendererStr);

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0xffffff, 1);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdfe7ec, 0.85);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight1.position.set(15, 25, 20);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 0.4);
    dirLight2.position.set(-15, 10, -15);
    scene.add(dirLight2);

    const tunnelGroup = new THREE.Group();
    tunnelGroupRef.current = tunnelGroup;
    scene.add(tunnelGroup);

    const jointGroup = new THREE.Group();
    jointGroupRef.current = jointGroup;
    scene.add(jointGroup);

    let pendingRaf = false;
    let drawPending = false;
    let needsFollowUp = false;
    const afterDraw: (cb: () => void) => void = isSoftwareGl
      ? (cb) => setTimeout(cb, 0)
      : (cb) => cb();

    const renderSingleFrame = () => {
      pendingRaf = false;
      const cam = camSphericalRef.current;
      const target = targetOffsetRef.current;
      const { cx, cy, cz } = cameraCenterRef.current;
      const targetX = cx + target.x;
      const targetY = cy + target.y;
      const targetZ = cz + target.z;

      const x = targetX + cam.radius * Math.sin(cam.phi) * Math.sin(cam.theta);
      const y = targetY + cam.radius * Math.cos(cam.phi);
      const z = targetZ + cam.radius * Math.sin(cam.phi) * Math.cos(cam.theta);

      camera.position.set(x, y, z);
      camera.lookAt(targetX, targetY, targetZ);

      const thetaDeg = Math.round(((cam.theta * 180) / Math.PI) * 10) / 10;
      if (Math.abs(thetaDeg - lastThetaDegRef.current) >= 1.0) {
        lastThetaDegRef.current = thetaDeg;
        setCameraTheta((prev) => (Math.abs(prev - cam.theta) < 1e-3 ? prev : cam.theta));
      }

      drawPending = true;
      renderer.render(scene, camera);
      afterDraw(() => {
        drawPending = false;
        if (needsFollowUp) {
          needsFollowUp = false;
          requestRender();
        }
      });
    };

    const requestRender = () => {
      if (drawPending) {
        needsFollowUp = true;
        return;
      }
      if (!pendingRaf) {
        pendingRaf = true;
        animFrameIdRef.current = requestAnimationFrame(renderSingleFrame);
      }
    };

    requestRenderRef.current = requestRender;
    requestRender();

    // Mouse & Touch Controls (Coalesced On-Demand Render)
    let isMouseDown = false;
    let mouseButton = 0;
    let prevMouse = { x: 0, y: 0 };

    let touchMode: 'NONE' | 'ORBIT' | 'PINCH_ROTATE_ZOOM' = 'NONE';
    let prevTouch = { x: 0, y: 0 };
    let initialPinchDist = 0;
    let initialRadius = 17;
    let prevMidpoint = { x: 0, y: 0 };
    let prevPinchAngle = 0;

    const onMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      mouseButton = e.button;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      prevMouse = { x: e.clientX, y: e.clientY };

      const cam = camSphericalRef.current;
      const target = targetOffsetRef.current;

      if (mouseButton === 2 || mouseButton === 1 || (mouseButton === 0 && e.shiftKey)) {
        const panSpeed = cam.radius * 0.0016;
        const rightX = Math.cos(cam.theta);
        const rightZ = -Math.sin(cam.theta);
        target.x -= rightX * dx * panSpeed;
        target.z -= rightZ * dx * panSpeed;
        target.y += dy * panSpeed;
        requestRender();
      } else if (mouseButton === 0 && (is3DGizmoDragModeRef.current || e.altKey)) {
        if (inspectTargetTypeRef.current === 'dip_surface') {
          setIsHingeRotationActive(false);
        }
        if (!isStrikeLineHingeLockedRef.current) {
          setDipDirection((prev) => Math.round(((prev + dx * 0.65) % 360 + 360) % 360));
        }
        setDipAmount((prev) => {
          const next = Math.max(0, Math.min(90, Math.round(prev + dy * 0.45)));
          setHingeDipDeg(next);
          return next;
        });
      } else if (mouseButton === 0) {
        cam.theta -= dx * 0.007;
        cam.phi = Math.max(0.04, Math.min(Math.PI - 0.04, cam.phi - dy * 0.007));
        requestRender();
      }
    };

    const onMouseUp = () => {
      isMouseDown = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = camSphericalRef.current;
      cam.radius = Math.max(3, Math.min(55, cam.radius + e.deltaY * 0.015));
      requestRender();
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchMode = 'ORBIT';
        prevTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length >= 2) {
        touchMode = 'PINCH_ROTATE_ZOOM';
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        initialPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        initialRadius = camSphericalRef.current.radius;
        prevMidpoint = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
        prevPinchAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchMode === 'NONE') return;
      if (e.cancelable) e.preventDefault();
      const cam = camSphericalRef.current;

      if (e.touches.length === 1 && touchMode === 'ORBIT') {
        const t = e.touches[0];
        const dx = t.clientX - prevTouch.x;
        const dy = t.clientY - prevTouch.y;
        prevTouch = { x: t.clientX, y: t.clientY };

        if (is3DGizmoDragModeRef.current) {
          if (inspectTargetTypeRef.current === 'dip_surface') {
            setIsHingeRotationActive(false);
          }
          if (!isStrikeLineHingeLockedRef.current) {
            setDipDirection((prev) => Math.round(((prev + dx * 0.65) % 360 + 360) % 360));
          }
          setDipAmount((prev) => {
            const next = Math.max(0, Math.min(90, Math.round(prev + dy * 0.45)));
            setHingeDipDeg(next);
            return next;
          });
        } else {
          cam.theta -= dx * 0.007;
          cam.phi = Math.max(0.04, Math.min(Math.PI - 0.04, cam.phi - dy * 0.007));
          requestRender();
        }
      } else if (e.touches.length >= 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const currentMidpoint = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
        const currentAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);

        if (initialPinchDist > 0) {
          const scale = initialPinchDist / Math.max(10, currentDist);
          cam.radius = Math.max(3, Math.min(55, initialRadius * scale));
        }

        const dMidX = currentMidpoint.x - prevMidpoint.x;
        const dMidY = currentMidpoint.y - prevMidpoint.y;
        let dAngle = currentAngle - prevPinchAngle;
        if (dAngle > Math.PI) dAngle -= Math.PI * 2;
        if (dAngle < -Math.PI) dAngle += Math.PI * 2;

        cam.theta -= dMidX * 0.0075 + dAngle * 0.45;
        cam.phi = Math.max(0.04, Math.min(Math.PI - 0.04, cam.phi - dMidY * 0.0075));

        prevMidpoint = currentMidpoint;
        prevPinchAngle = currentAngle;
        requestRender();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (touchMode === 'NONE') return;
      if (e.touches.length === 1) {
        touchMode = 'ORBIT';
        prevTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 0) {
        touchMode = 'NONE';
      }
    };

    const handleResize = () => {
      if (!threeMountRef.current || !rendererRef.current || !cameraRef.current) return;
      const wNow = threeMountRef.current.clientWidth || 600;
      const hNow = threeMountRef.current.clientHeight || 450;
      if (wNow > 0 && hNow > 0) {
        cameraRef.current.aspect = wNow / hNow;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(wNow, hNow);
        requestRender();
      }
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && threeMountRef.current) {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(threeMountRef.current);
    }

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('contextmenu', onContextMenu);
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (resizeObserver) resizeObserver.disconnect();
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('contextmenu', onContextMenu);
      container.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('resize', handleResize);
      scene.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m: any) => m.dispose?.());
          } else {
            obj.material.dispose?.();
          }
        }
      });
      renderer.dispose();
    };
  }, [activeTab]);

  // -------------------------------------------------------------------------
  // 2. UPDATE TUNNEL / SHAFT / SURFACE SHELL GROUP WITHOUT RECREATING WEBGL
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (activeTab !== 'VIEW_3D' || !tunnelGroupRef.current) return;

    const tunnelGroup = tunnelGroupRef.current;
    while (tunnelGroup.children.length > 0) {
      const child = tunnelGroup.children[0] as any;
      if (child.geometry) child.geometry.dispose?.();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m: any) => m.dispose?.());
        else child.material.dispose?.();
      }
      tunnelGroup.remove(child);
    }

    // Tunnel / Shaft Dimensions
    const w = tunnelGeometry.widthM || 8.5;
    const h = tunnelGeometry.heightM || 7.5;
    const hw = tunnelGeometry.wallHeightM || 4.2;
    const pullL = tunnelGeometry.pullLengthM || 3.0;
    const archRise = h - hw;
    const isVertShaft = Boolean(tunnelGeometry.isVerticalShaft);
    const isShaftHalfFace =
      isVertShaft && tunnelGeometry.excavationApproach === 'Half Face';
    const shaftHalfSide = tunnelGeometry.shaftHalfSide || 'left_half';
    const shaftMedianStatus = tunnelGeometry.shaftCenterMedianStatus || 'closed';

    const cx = w / 2;
    const cy = isVertShaft ? pullL / 2 : h / 2;
    const cz = isVertShaft ? w / 2 : pullL / 2;
    cameraCenterRef.current = { cx, cy, cz };

    if (isVertShaft) {
      // =========================================================================
      // VERTICAL SHAFT 3D CYLINDRICAL BOWL:
      // - Shaft Bottom Face horizontally at y = 0 (Bottom of the Bowl, Pull 0m)
      // - 1m North-to-South Reference Line across Bottom Face (0° N at z=0 -> 180° S at z=w)
      // - 4 Quadrant Walls (1. NE 0°–90°, 2. ES 90°–180°, 3. SW 180°–270°, 4. WN 270°–360°)
      //   rising vertically around perimeter from y = 0 (Pull 0m) to y = pullL (Pull 3m Top Rim)
      // =========================================================================
      const r = w / 2;
      const segments = 64;
      // Perimeter points in horizontal (x, z) plane where:
      // 0° North = (cx, 0), 90° East = (w, cz), 180° South = (cx, w), 270° West = (0, cz)
      const bowlRingPts: { x: number; z: number }[] = [];
      if (isShaftHalfFace) {
        if (shaftHalfSide === 'left_half') {
          // Left Half (West 180° South -> 270° West -> 360° North)
          for (let i = 0; i <= segments / 2; i++) {
            const deg = 180 + (i / (segments / 2)) * 180;
            const rad = (deg * Math.PI) / 180;
            bowlRingPts.push({
              x: cx + r * Math.sin(rad),
              z: cz - r * Math.cos(rad),
            });
          }
        } else {
          // Right Half (East 0° North -> 90° East -> 180° South)
          for (let i = 0; i <= segments / 2; i++) {
            const deg = (i / (segments / 2)) * 180;
            const rad = (deg * Math.PI) / 180;
            bowlRingPts.push({
              x: cx + r * Math.sin(rad),
              z: cz - r * Math.cos(rad),
            });
          }
        }
      } else {
        for (let i = 0; i < segments; i++) {
          const deg = (i / segments) * 360;
          const rad = (deg * Math.PI) / 180;
          bowlRingPts.push({
            x: cx + r * Math.sin(rad),
            z: cz - r * Math.cos(rad),
          });
        }
      }

      const numPts = bowlRingPts.length;
      const shellPositions: number[] = [];
      const shellIndices: number[] = [];
      for (let i = 0; i < numPts; i++) {
        const p = bowlRingPts[i];
        // Bottom of bowl (y = 0, Pull 0m)
        shellPositions.push(p.x, 0, p.z);
        // Top rim of bowl (y = pullL, Pull 3m)
        shellPositions.push(p.x, pullL, p.z);
      }
      const wallSegCount = isShaftHalfFace && shaftMedianStatus === 'open' ? numPts - 1 : numPts;
      for (let i = 0; i < wallSegCount; i++) {
        const next = (i + 1) % numPts;
        const v0 = i * 2;
        const v1 = i * 2 + 1;
        const v2 = next * 2 + 1;
        const v3 = next * 2;
        shellIndices.push(v0, v1, v2);
        shellIndices.push(v0, v2, v3);
      }
      const shaftWallGeo = new THREE.BufferGeometry();
      shaftWallGeo.setAttribute('position', new THREE.Float32BufferAttribute(shellPositions, 3));
      shaftWallGeo.setIndex(shellIndices);
      shaftWallGeo.computeVertexNormals();
      const shaftWallMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        transparent: true,
        opacity: 0.28,
        roughness: 0.25,
        metalness: 0.02,
        side: THREE.DoubleSide,
      });
      tunnelGroup.add(new THREE.Mesh(shaftWallGeo, shaftWallMat));

      // Horizontal Shaft Bottom Face Cap at y = 0 (Bottom of Bowl, Pull 0m)
      const facePositions: number[] = [];
      const faceIndices: number[] = [];
      for (let i = 0; i < numPts; i++) {
        facePositions.push(bowlRingPts[i].x, 0.005, bowlRingPts[i].z);
      }
      // Centroid fan at (cx, 0.005, cz)
      facePositions.push(cx, 0.005, cz);
      const fanSegCount = isShaftHalfFace ? numPts - 1 : numPts;
      for (let i = 0; i < fanSegCount; i++) {
        const next = (i + 1) % numPts;
        faceIndices.push(numPts, i, next);
      }
      const faceCapGeo = new THREE.BufferGeometry();
      faceCapGeo.setAttribute('position', new THREE.Float32BufferAttribute(facePositions, 3));
      faceCapGeo.setIndex(faceIndices);
      faceCapGeo.computeVertexNormals();
      const faceCapMat = new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.34,
        roughness: 0.3,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });
      tunnelGroup.add(new THREE.Mesh(faceCapGeo, faceCapMat));

      // Bottom Face Contour Ring at y = 0 (Pull 0m) in Electric Cyan
      const botContourPts: THREE.Vector3[] = bowlRingPts.map((pt) => new THREE.Vector3(pt.x, 0.01, pt.z));
      botContourPts.push(new THREE.Vector3(bowlRingPts[0].x, 0.01, bowlRingPts[0].z));
      tunnelGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(botContourPts),
          new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 3 })
        )
      );

      // Top Collar Rim Contour Ring at y = pullL (Pull 3m)
      const topContourPts: THREE.Vector3[] = bowlRingPts.map((pt) => new THREE.Vector3(pt.x, pullL, pt.z));
      topContourPts.push(new THREE.Vector3(bowlRingPts[0].x, pullL, bowlRingPts[0].z));
      tunnelGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(topContourPts),
          new THREE.LineBasicMaterial({ color: 0x475569, linewidth: 2 })
        )
      );

      // 4 Vertical Quadrant Seam Rails at 0° North, 90° East, 180° South, 270° West
      const seamRailsPos: number[] = [
        cx, 0, 0, cx, pullL, 0,     // 0° North seam
        w, 0, cz, w, pullL, cz,     // 90° East seam
        cx, 0, w, cx, pullL, w,     // 180° South seam
        0, 0, cz, 0, pullL, cz,     // 270° West seam
      ];
      const seamRailsGeo = new THREE.BufferGeometry();
      seamRailsGeo.setAttribute('position', new THREE.Float32BufferAttribute(seamRailsPos, 3));
      tunnelGroup.add(
        new THREE.LineSegments(
          seamRailsGeo,
          new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 1.5, transparent: true, opacity: 0.65 })
        )
      );

      // Clean North-to-South Reference Line (0° N at z=0 to 180° S at z=w) on the Bottom Face
      const refLinePts = [
        new THREE.Vector3(cx, 0.02, 0),
        new THREE.Vector3(cx, 0.02, w),
      ];
      tunnelGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(refLinePts),
          new THREE.LineBasicMaterial({ color: 0xe11d48, linewidth: 2 })
        )
      );
      // Subtle 1m ticks along the North-to-South Reference Line on the Shaft Bottom Face
      const tickPos: number[] = [];
      for (let m = 1; m < Math.floor(w); m++) {
        tickPos.push(cx - 0.14, 0.02, m, cx + 0.14, 0.02, m);
      }
      if (tickPos.length > 0) {
        const tickGeo = new THREE.BufferGeometry();
        tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(tickPos, 3));
        tunnelGroup.add(
          new THREE.LineSegments(
            tickGeo,
            new THREE.LineBasicMaterial({ color: 0xe11d48, linewidth: 1.5 })
          )
        );
      }

      // Minimal, compact North / South Rim Reference Badges (positioned outside rim so bowl is unobstructed)
      const northSp = createBillboardLabel(
        `0° N`,
        '#881337',
        '#fecdd3',
        1.1,
        0.28
      );
      northSp.position.set(cx, pullL + 0.28, -0.35);
      tunnelGroup.add(northSp);

      const southSp = createBillboardLabel(
        `180° S`,
        '#0f172a',
        '#e2e8f0',
        1.2,
        0.28
      );
      southSp.position.set(cx, pullL + 0.28, w + 0.35);
      tunnelGroup.add(southSp);

      // Show compact quadrant wall tags only when 'Show 3D Labels' (showLegendOverlay) is toggled on
      if (showLegendOverlay) {
        const qLabels = [
          {
            text: `1. NE`,
            x: cx + r * 0.82,
            z: cz - r * 0.82,
            active: !isShaftHalfFace || shaftHalfSide === 'right_half',
          },
          {
            text: `2. ES`,
            x: cx + r * 0.82,
            z: cz + r * 0.82,
            active: !isShaftHalfFace || shaftHalfSide === 'right_half',
          },
          {
            text: `3. SW`,
            x: cx - r * 0.82,
            z: cz + r * 0.82,
            active: !isShaftHalfFace || shaftHalfSide === 'left_half',
          },
          {
            text: `4. WN`,
            x: cx - r * 0.82,
            z: cz - r * 0.82,
            active: !isShaftHalfFace || shaftHalfSide === 'left_half',
          },
        ];
        qLabels.forEach((ql) => {
          if (!ql.active) return;
          const sp = createBillboardLabel(ql.text, '#0f172a', '#38bdf8', 1.15, 0.28);
          sp.position.set(ql.x, pullL + 0.25, ql.z);
          tunnelGroup.add(sp);
        });
      }
    } else if (isSurfaceMapping) {
      // =====================================================================
      // SURFACE MAPPING 3D EXPOSURE & ACTIVE PORTION GEOMETRY
      // Strictly renders ONLY the user-configured portions (no extra toe apron
      // or unconfigured flank walls).
      // =====================================================================
      const domain = tunnelGeometry.mappingDomain || 'BENCH';
      const isTrench = domain === 'TRENCH';

      // 1. Main Surface Exposure Face / Bench Face / Slope Face / Trench End Face at z = pullL
      const facePlaneGeo = new THREE.PlaneGeometry(w, h);
      facePlaneGeo.translate(cx, h / 2, pullL);
      const isFaceActive = activePortionPanel === 'face';
      const facePlaneMat = new THREE.MeshStandardMaterial({
        color: isFaceActive ? 0xbae6fd : 0xe2e8f0,
        transparent: true,
        opacity: isFaceActive ? 0.36 : 0.24,
        roughness: 0.3,
        metalness: 0.04,
        side: THREE.DoubleSide,
      });
      tunnelGroup.add(new THREE.Mesh(facePlaneGeo, facePlaneMat));

      // Face Contour Outline at z = pullL
      const faceRectPts = [
        new THREE.Vector3(0, 0, pullL),
        new THREE.Vector3(0, h, pullL),
        new THREE.Vector3(w, h, pullL),
        new THREE.Vector3(w, 0, pullL),
        new THREE.Vector3(0, 0, pullL),
      ];
      tunnelGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(faceRectPts),
          new THREE.LineBasicMaterial({
            color: isFaceActive ? 0x0284c7 : 0x64748b,
            linewidth: isFaceActive ? 3.5 : 2,
          })
        )
      );

      // 2. Upper Berm / Crest Ledge / Trench Floor Reference at y = h (crown panel, only if configured)
      if (tunnelGeometry.hasCrown !== false) {
        const isCrownActive = activePortionPanel === 'crown';
        const bermGeo = new THREE.PlaneGeometry(w, pullL);
        bermGeo.rotateX(-Math.PI / 2);
        bermGeo.translate(cx, h, cz);
        const bermMat = new THREE.MeshStandardMaterial({
          color: isCrownActive ? 0xa7f3d0 : 0xe2e8f0,
          transparent: true,
          opacity: isTrench ? (isCrownActive ? 0.28 : 0.14) : isCrownActive ? 0.42 : 0.26,
          roughness: 0.35,
          metalness: 0.03,
          side: THREE.DoubleSide,
        });
        tunnelGroup.add(new THREE.Mesh(bermGeo, bermMat));

        const bermOutlinePts = [
          new THREE.Vector3(0, h, 0),
          new THREE.Vector3(w, h, 0),
          new THREE.Vector3(w, h, pullL),
          new THREE.Vector3(0, h, pullL),
          new THREE.Vector3(0, h, 0),
        ];
        tunnelGroup.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(bermOutlinePts),
            new THREE.LineBasicMaterial({
              color: isCrownActive ? 0x059669 : 0x94a3b8,
              linewidth: isCrownActive ? 3 : 1.5,
            })
          )
        );
      }

      // 3. Left Trench Wall / Left Flank Portion at x = 0 (only if configured)
      if (tunnelGeometry.hasLeftWall !== false) {
        const isLeftActive = activePortionPanel === 'left_wall';
        const leftWallGeo = new THREE.PlaneGeometry(pullL, h);
        leftWallGeo.rotateY(Math.PI / 2);
        leftWallGeo.translate(0, h / 2, cz);
        const leftWallMat = new THREE.MeshStandardMaterial({
          color: isLeftActive ? 0xfde68a : 0xf1f5f9,
          transparent: true,
          opacity: isLeftActive ? 0.38 : 0.26,
          roughness: 0.35,
          metalness: 0.02,
          side: THREE.DoubleSide,
        });
        tunnelGroup.add(new THREE.Mesh(leftWallGeo, leftWallMat));

        const leftOutlinePts = [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, h, 0),
          new THREE.Vector3(0, h, pullL),
          new THREE.Vector3(0, 0, pullL),
          new THREE.Vector3(0, 0, 0),
        ];
        tunnelGroup.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(leftOutlinePts),
            new THREE.LineBasicMaterial({
              color: isLeftActive ? 0xd97706 : 0x94a3b8,
              linewidth: isLeftActive ? 3 : 1.5,
            })
          )
        );
      }

      // 4. Right Trench Wall / Right Flank Portion at x = w (only if configured)
      if (tunnelGeometry.hasRightWall !== false) {
        const isRightActive = activePortionPanel === 'right_wall';
        const rightWallGeo = new THREE.PlaneGeometry(pullL, h);
        rightWallGeo.rotateY(-Math.PI / 2);
        rightWallGeo.translate(w, h / 2, cz);
        const rightWallMat = new THREE.MeshStandardMaterial({
          color: isRightActive ? 0xfde68a : 0xf1f5f9,
          transparent: true,
          opacity: isRightActive ? 0.38 : 0.26,
          roughness: 0.35,
          metalness: 0.02,
          side: THREE.DoubleSide,
        });
        tunnelGroup.add(new THREE.Mesh(rightWallGeo, rightWallMat));

        const rightOutlinePts = [
          new THREE.Vector3(w, 0, 0),
          new THREE.Vector3(w, h, 0),
          new THREE.Vector3(w, h, pullL),
          new THREE.Vector3(w, 0, pullL),
          new THREE.Vector3(w, 0, 0),
        ];
        tunnelGroup.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(rightOutlinePts),
            new THREE.LineBasicMaterial({
              color: isRightActive ? 0xd97706 : 0x94a3b8,
              linewidth: isRightActive ? 3 : 1.5,
            })
          )
        );
      }

      // 5. 3D Portion Billboard Badges for configured portions only
      if (showLegendOverlay) {
        const faceBadge = createBillboardLabel(
          `${domainPanelMap.face.shortLabel.toUpperCase()}${activePortionPanel === 'face' ? ' ★' : ''}`,
          activePortionPanel === 'face' ? '#0284c7' : '#0f172a',
          '#ffffff',
          2.2,
          0.36
        );
        faceBadge.position.set(cx, h + 0.45, pullL);
        tunnelGroup.add(faceBadge);

        if (tunnelGeometry.hasCrown !== false) {
          const crownBadge = createBillboardLabel(
            `${domainPanelMap.crown.shortLabel.toUpperCase()}${activePortionPanel === 'crown' ? ' ★' : ''}`,
            activePortionPanel === 'crown' ? '#059669' : '#0f172a',
            '#ffffff',
            2.2,
            0.34
          );
          crownBadge.position.set(cx, h + 0.45, cz);
          tunnelGroup.add(crownBadge);
        }

        if (tunnelGeometry.hasLeftWall !== false) {
          const leftBadge = createBillboardLabel(
            `${domainPanelMap.leftWall.shortLabel.toUpperCase()}${activePortionPanel === 'left_wall' ? ' ★' : ''}`,
            activePortionPanel === 'left_wall' ? '#d97706' : '#334155',
            '#ffffff',
            2.0,
            0.32
          );
          leftBadge.position.set(-0.35, h * 0.55, cz);
          tunnelGroup.add(leftBadge);
        }

        if (tunnelGeometry.hasRightWall !== false) {
          const rightBadge = createBillboardLabel(
            `${domainPanelMap.rightWall.shortLabel.toUpperCase()}${activePortionPanel === 'right_wall' ? ' ★' : ''}`,
            activePortionPanel === 'right_wall' ? '#d97706' : '#334155',
            '#ffffff',
            2.0,
            0.32
          );
          rightBadge.position.set(w + 0.35, h * 0.55, cz);
          tunnelGroup.add(rightBadge);
        }
      }
    } else {
      // Exact Tunnel Cross-Section Profile from configured shape and dimensions
      const profileData = buildTunnelCrossSectionProfileMetric(tunnelGeometry);
      const profilePts: THREE.Vector2[] = profileData.points.map(
        (pt) => new THREE.Vector2(pt.y, pt.z)
      );
      const isProfileClosed = profileData.isClosed;

      // 5. Clean Excavation Invert Floor (only when invert is present)
      if (tunnelGeometry.hasInvert !== false) {
        const floorGeo = new THREE.PlaneGeometry(w, pullL);
        floorGeo.rotateX(-Math.PI / 2);
        floorGeo.translate(cx, 0.001, cz);
        const floorMat = new THREE.MeshStandardMaterial({
          color: 0xf8fafc,
          roughness: 0.65,
          metalness: 0.02,
          side: THREE.DoubleSide,
        });
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        tunnelGroup.add(floorMesh);
      }

      // A. Clean Hollow 3D Tunnel Shell Mesh
      const shellPositions: number[] = [];
      const shellIndices: number[] = [];
      const numPts = profilePts.length;

      for (let i = 0; i < numPts; i++) {
        const p = profilePts[i];
        shellPositions.push(p.x, p.y, 0);
        shellPositions.push(p.x, p.y, pullL);
      }

      const segLimit = isProfileClosed ? numPts : Math.max(0, numPts - 1);
      for (let i = 0; i < segLimit; i++) {
        const next = (i + 1) % numPts;
        const v0 = i * 2;
        const v1 = i * 2 + 1;
        const v2 = next * 2 + 1;
        const v3 = next * 2;

        shellIndices.push(v0, v1, v2);
        shellIndices.push(v0, v2, v3);
      }

      const tunnelGeo = new THREE.BufferGeometry();
      tunnelGeo.setAttribute('position', new THREE.Float32BufferAttribute(shellPositions, 3));
      tunnelGeo.setIndex(shellIndices);
      tunnelGeo.computeVertexNormals();

      const tunnelMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        transparent: true,
        opacity: 0.28,
        roughness: 0.22,
        metalness: 0.02,
        side: THREE.DoubleSide,
      });
      const tunnelMesh = new THREE.Mesh(tunnelGeo, tunnelMat);
      tunnelGroup.add(tunnelMesh);

      // B. Excavation Face Rock Cap at z = pullL
      if (numPts >= 3) {
        const facePositions: number[] = [];
        const faceIndices: number[] = [];

        for (let i = 0; i < numPts; i++) {
          facePositions.push(profilePts[i].x, profilePts[i].y, pullL);
        }

        try {
          const triangles = THREE.ShapeUtils.triangulateShape(profilePts, []);
          if (triangles && triangles.length > 0) {
            for (const tri of triangles) {
              faceIndices.push(tri[0], tri[1], tri[2]);
            }
          } else {
            const avgX = profilePts.reduce((s, p) => s + p.x, 0) / numPts;
            const avgY = profilePts.reduce((s, p) => s + p.y, 0) / numPts;
            facePositions.push(avgX, avgY, pullL);
            for (let i = 0; i < segLimit; i++) {
              const next = (i + 1) % numPts;
              faceIndices.push(numPts, i, next);
            }
          }
        } catch {
          const avgX = profilePts.reduce((s, p) => s + p.x, 0) / numPts;
          const avgY = profilePts.reduce((s, p) => s + p.y, 0) / numPts;
          facePositions.push(avgX, avgY, pullL);
          for (let i = 0; i < segLimit; i++) {
            const next = (i + 1) % numPts;
            faceIndices.push(numPts, i, next);
          }
        }

        const faceCapGeo = new THREE.BufferGeometry();
        faceCapGeo.setAttribute('position', new THREE.Float32BufferAttribute(facePositions, 3));
        faceCapGeo.setIndex(faceIndices);
        faceCapGeo.computeVertexNormals();

        const faceCapMat = new THREE.MeshStandardMaterial({
          color: 0xe0f2fe,
          transparent: true,
          opacity: 0.22,
          roughness: 0.3,
          metalness: 0.05,
          side: THREE.DoubleSide,
        });
        const faceMesh = new THREE.Mesh(faceCapGeo, faceCapMat);
        tunnelGroup.add(faceMesh);
      }

      // C. Excavation Face Contour (z = pullL) in Electric Cyan/Blue
      const faceContourPoints: THREE.Vector3[] = [];
      for (const pt of profilePts) {
        faceContourPoints.push(new THREE.Vector3(pt.x, pt.y, pullL));
      }
      if (isProfileClosed && profilePts.length > 0) {
        faceContourPoints.push(new THREE.Vector3(profilePts[0].x, profilePts[0].y, pullL));
      }
      const faceContourGeo = new THREE.BufferGeometry().setFromPoints(faceContourPoints);
      const faceContourMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 3 });
      const faceContourLine = new THREE.Line(faceContourGeo, faceContourMat);
      tunnelGroup.add(faceContourLine);

      // D. Portal Entrance Outline at z = 0
      const prevContourPoints: THREE.Vector3[] = [];
      for (const pt of profilePts) {
        prevContourPoints.push(new THREE.Vector3(pt.x, pt.y, 0));
      }
      if (isProfileClosed && profilePts.length > 0) {
        prevContourPoints.push(new THREE.Vector3(profilePts[0].x, profilePts[0].y, 0));
      }
      const prevContourGeo = new THREE.BufferGeometry().setFromPoints(prevContourPoints);
      const prevContourMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, linewidth: 1.5 });
      const prevContourLine = new THREE.Line(prevContourGeo, prevContourMat);
      tunnelGroup.add(prevContourLine);

      // E. Longitudinal Generator Rails along Key Shape Vertices
      const railPositions: number[] = [];
      const railStep = numPts <= 12 ? 1 : Math.max(1, Math.floor(numPts / 8));
      for (let idx = 0; idx < numPts; idx += railStep) {
        const pt = profilePts[idx];
        if (pt) {
          railPositions.push(pt.x, pt.y, 0, pt.x, pt.y, pullL);
        }
      }
      const railsGeo = new THREE.BufferGeometry();
      railsGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPositions, 3));
      const railsMat = new THREE.LineBasicMaterial({ color: 0x64748b, linewidth: 1.5 });
      const railsLines = new THREE.LineSegments(railsGeo, railsMat);
      tunnelGroup.add(railsLines);
    }

    requestRenderRef.current();
  }, [activeTab, tunnelGeometry, showLegendOverlay, isSurfaceMapping, activePortionPanel]);

  // Handle immediate Three.js canvas re-layout when switching orientation or layout mode
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!threeMountRef.current || !rendererRef.current || !cameraRef.current) return;
      const wNow = threeMountRef.current.clientWidth || 600;
      const hNow = threeMountRef.current.clientHeight || 450;
      if (wNow > 0 && hNow > 0) {
        cameraRef.current.aspect = wNow / hNow;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(wNow, hNow);
        requestRenderRef.current();
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [viewLayoutMode, isVerticalMode, verticalCanvasPosition, isAsideCollapsed]);

  // -------------------------------------------------------------------------
  // UPDATE ONLY JOINT MESH IN 3D SCENE WHEN ORIENTATION OR CLIPPING CHANGES
  // (Runs in < 0.2ms, NO WebGL Context re-creation or lag!)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (activeTab !== 'VIEW_3D' || !jointGroupRef.current) return;

    const group = jointGroupRef.current;
    // Clear previous children
    while (group.children.length > 0) {
      const child = group.children[0] as any;
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m: any) => m.dispose());
        else child.material.dispose();
      }
      group.remove(child);
    }

    // Three.js anchor & orientation vectors:
    // ax = width (anchorPoint.y), ay = elevation (anchorPoint.z), az = advance (anchorPoint.x)
    const effectiveAnchor =
      planeDisplayMode === 'TRACED_LENGTH' && hingePlaneResult
        ? hingePlaneResult.traceMidPoint
        : anchorPoint;
    const ax = effectiveAnchor.y;
    const ay = effectiveAnchor.z;
    const az = effectiveAnchor.x;

    const sx = plane.strikeVector.y;
    const sy = plane.strikeVector.z;
    const sz = plane.strikeVector.x;

    const dx = plane.dipVector.y;
    const dy = plane.dipVector.z;
    const dz = plane.dipVector.x;

    const nx = plane.normal.y;
    const ny = plane.normal.z;
    const nz = plane.normal.x;

    const tracedHalfLen = Math.max(0.15, currentTraceLengthM / 2);
    const isCrownNonPenetratingHinge =
      !tunnelGeometry.isVerticalShaft && (currentJoint.panel === 'crown' || isStrikeLineHingeLocked);
    const roofProfile = buildTunnelCrossSectionProfileMetric(tunnelGeometry);
    const getCrownArchRoofY = (xPos: number): number => {
      return roofProfile.getRoofZAtY(xPos);
    };

    // 1. 3D Joint Cutting Plane Mesh
    if (showInteriorPlane) {
      const grpColor = FIELD_JOINT_GROUP_COLORS[jointSetId]?.stroke || '#d97706';

      if (planeDisplayMode === 'TRACED_LENGTH') {
        if (inspectTargetType === 'dip_surface' && currentDipSurface) {
          // Exact Drawn Shape & Size in 3D for Dip Surface
          const rawPoly2D =
            currentDipSurface.outlinePolygon && currentDipSurface.outlinePolygon.length >= 3
              ? currentDipSurface.outlinePolygon
              : buildDipSurfaceOutlineAndCentroid(
                  currentDipSurface.points,
                  currentDipSurface.brushRadius
                ).outlinePolygon;

          const surfPanel = currentDipSurface.panel || 'face';
          const surfPts3D = rawPoly2D.map((pt) => {
            const m = pointToTunnel3DMetric(pt, surfPanel, tunnelGeometry);
            return new THREE.Vector3(m.y, m.z, m.x);
          });

          if (surfPts3D.length >= 3) {
            // 1. Compute exact 3D centroid of the drawn Dip Surface polygon
            const polyCentroid3D = new THREE.Vector3();
            surfPts3D.forEach((p) => polyCentroid3D.add(p));
            polyCentroid3D.divideScalar(surfPts3D.length);

            // 2. Determine local panel normal in Three.js coordinates (x=transverse, y=elevation, z=advance)
            let surfNormal = new THREE.Vector3(0, 0, -1);
            if (surfPanel === 'left_wall') {
              surfNormal.set(1, 0, 0);
            } else if (surfPanel === 'right_wall') {
              surfNormal.set(-1, 0, 0);
            } else if (surfPanel === 'crown') {
              const cx = (tunnelGeometry.widthM || 8.5) / 2;
              const hw = tunnelGeometry.wallHeightM || 4.2;
              surfNormal.set(cx - polyCentroid3D.x, hw - polyCentroid3D.y, 0);
              if (surfNormal.lengthSq() < 1e-4) surfNormal.set(0, -1, 0);
              else surfNormal.normalize();
            } else {
              // Estimate from polygon vertices via Newell's method, fallback to -Z
              const newell = new THREE.Vector3();
              for (let i = 0; i < surfPts3D.length; i++) {
                const curr = surfPts3D[i];
                const next = surfPts3D[(i + 1) % surfPts3D.length];
                newell.x += (curr.y - next.y) * (curr.z + next.z);
                newell.y += (curr.z - next.z) * (curr.x + next.x);
                newell.z += (curr.x - next.x) * (curr.y + next.y);
              }
              if (newell.lengthSq() > 1e-5) surfNormal.copy(newell.normalize());
            }

            // 3. Target geological plane normal from Dip Direction & Dip Amount
            const targetNormal = new THREE.Vector3(nx, ny, nz).normalize();
            if (surfNormal.dot(targetNormal) < 0) {
              targetNormal.negate();
            }

            // 4. Rotate exact drawn 3D polygon around its centroid onto the Dip Plane (preserving 100% exact drawn shape & size)
            const quat = new THREE.Quaternion().setFromUnitVectors(surfNormal, targetNormal);
            const tiltedPts3D = surfPts3D.map((p) =>
              p.clone().sub(polyCentroid3D).applyQuaternion(quat).add(polyCentroid3D)
            );

            // 5. Project onto 2D orthonormal basis on the tilted plane for exact concave/convex triangulation
            const uAxis = new THREE.Vector3(sx, sy, sz).normalize();
            const vAxis = new THREE.Vector3().crossVectors(targetNormal, uAxis).normalize();
            const contour2D = tiltedPts3D.map((p) => {
              const rel = p.clone().sub(polyCentroid3D);
              return new THREE.Vector2(rel.dot(uAxis), rel.dot(vAxis));
            });

            const triangles = THREE.ShapeUtils.triangulateShape(contour2D, []);
            const dipPositions: number[] = [];
            const dipNormals: number[] = [];
            const dipIndices: number[] = [];

            tiltedPts3D.forEach((p) => {
              dipPositions.push(p.x, p.y, p.z);
              dipNormals.push(nx, ny, nz);
            });
            triangles.forEach((tri) => {
              dipIndices.push(tri[0], tri[1], tri[2]);
            });

            const dipGeo = new THREE.BufferGeometry();
            dipGeo.setAttribute('position', new THREE.Float32BufferAttribute(dipPositions, 3));
            dipGeo.setAttribute('normal', new THREE.Float32BufferAttribute(dipNormals, 3));
            dipGeo.setIndex(dipIndices);

            const dipMat = new THREE.MeshStandardMaterial({
              color: new THREE.Color(grpColor),
              transparent: true,
              opacity: 0.76,
              side: THREE.DoubleSide,
              roughness: 0.28,
              metalness: 0.08,
              depthWrite: false,
            });
            group.add(new THREE.Mesh(dipGeo, dipMat));

            // 6. Exact Perimeter Border of the Tilted Dip Surface
            const borderGeo = new THREE.BufferGeometry().setFromPoints([...tiltedPts3D, tiltedPts3D[0]]);
            const borderMat = new THREE.LineBasicMaterial({
              color: 0xfbbf24,
              linewidth: 3,
              transparent: true,
              opacity: 0.98,
            });
            group.add(new THREE.Line(borderGeo, borderMat));

            // 7. In-plane Strike/Dip Hatch Lines clipped inside the exact drawn polygon
            let minU = Infinity,
              maxU = -Infinity,
              minV = Infinity,
              maxV = -Infinity;
            contour2D.forEach((pt) => {
              if (pt.x < minU) minU = pt.x;
              if (pt.x > maxU) maxU = pt.x;
              if (pt.y < minV) minV = pt.y;
              if (pt.y > maxV) maxV = pt.y;
            });
            const pointInPoly2D = (x: number, y: number): boolean => {
              let inside = false;
              for (let i = 0, j = contour2D.length - 1; i < contour2D.length; j = i++) {
                const xi = contour2D[i].x,
                  yi = contour2D[i].y;
                const xj = contour2D[j].x,
                  yj = contour2D[j].y;
                const intersect =
                  yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi;
                if (intersect) inside = !inside;
              }
              return inside;
            };
            const spanMax = Math.max(maxU - minU, maxV - minV, 0.2);
            const gridStep = Math.max(0.12, spanMax / 5);
            const sampleStep = spanMax / 36;
            const gridPositions: number[] = [];
            for (let u = minU + gridStep; u < maxU; u += gridStep) {
              for (let v = minV; v < maxV; v += sampleStep) {
                const vNext = Math.min(maxV, v + sampleStep);
                if (pointInPoly2D(u, (v + vNext) * 0.5)) {
                  const p0 = polyCentroid3D
                    .clone()
                    .addScaledVector(uAxis, u)
                    .addScaledVector(vAxis, v);
                  const p1 = polyCentroid3D
                    .clone()
                    .addScaledVector(uAxis, u)
                    .addScaledVector(vAxis, vNext);
                  gridPositions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
                }
              }
            }
            for (let v = minV + gridStep; v < maxV; v += gridStep) {
              for (let u = minU; u < maxU; u += sampleStep) {
                const uNext = Math.min(maxU, u + sampleStep);
                if (pointInPoly2D((u + uNext) * 0.5, v)) {
                  const p0 = polyCentroid3D
                    .clone()
                    .addScaledVector(uAxis, u)
                    .addScaledVector(vAxis, v);
                  const p1 = polyCentroid3D
                    .clone()
                    .addScaledVector(uAxis, uNext)
                    .addScaledVector(vAxis, v);
                  gridPositions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
                }
              }
            }
            if (gridPositions.length > 0) {
              const gridGeo = new THREE.BufferGeometry();
              gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3));
              const gridMat = new THREE.LineBasicMaterial({
                color: new THREE.Color(grpColor).getHex(),
                transparent: true,
                opacity: 0.42,
              });
              group.add(new THREE.LineSegments(gridGeo, gridMat));
            }

            // 8. Exact Surface Footprint Outline on Tunnel Wall/Face/Crown (for reference)
            const footprintGeo = new THREE.BufferGeometry().setFromPoints([
              ...surfPts3D,
              surfPts3D[0],
            ]);
            const footprintMat = new THREE.LineBasicMaterial({
              color: 0x06b6d4,
              linewidth: 2.5,
              transparent: true,
              opacity: 0.85,
            });
            group.add(new THREE.Line(footprintGeo, footprintMat));

            // Also render the original drawn centerline/pencil stroke on the tunnel surface
            if (currentDipSurface.points && currentDipSurface.points.length >= 2) {
              const strokePts = currentDipSurface.points.map((pt) => {
                const m = pointToTunnel3DMetric(pt, surfPanel, tunnelGeometry);
                return new THREE.Vector3(m.y, m.z, m.x);
              });
              const strokeGeo = new THREE.BufferGeometry().setFromPoints(strokePts);
              const strokeMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 3.5 });
              group.add(new THREE.Line(strokeGeo, strokeMat));
            }
          }
        } else {
          // Traced Joint Length Plane: spans strictly the exact 2D traced joint length (-R_s to +R_s along the traced axis)
          const R_s = tracedHalfLen;
          let R_up = R_s;
          let R_down = R_s;
          if (isCrownNonPenetratingHinge) {
            // Crown strike line hinge plane in 3D joint inspection:
            R_up = 0.28;
            const dipSin = Math.max(0.25, Math.sin((dipAmount * Math.PI) / 180));
            const maxToInvert = Math.max(0.5, ay / dipSin);
            R_down =
              tracedPlaneDepthMode === 'HALF_TRACE'
                ? Math.min(maxToInvert, R_s)
                : Math.min(maxToInvert, R_s * 1.85);
          } else if (tracedPlaneDepthMode === 'ONE_SIDED') {
            R_up = 0;
            R_down = R_s * 2;
          } else if (tracedPlaneDepthMode === 'HALF_TRACE') {
            R_up = R_s * 0.5;
            R_down = R_s * 0.5;
          } else {
            // MATCH_TRACE: square patch of exact traced length (2 * R_s by 2 * R_s) centered on the 2D trace
            R_up = R_s;
            R_down = R_s;
          }

          const numCols = 20;
          const numRows = 12;
          const tracedPositions: number[] = [];
          const tracedNormals: number[] = [];
          const tracedUvs: number[] = [];
          const tracedIndices: number[] = [];

          // Helper: interpolate along the 3D curved crown trace when inspecting a Crown joint
          const sampleCrownCurve3D = (uFrac: number): [number, number, number] | null => {
            if (!crownCurvedData || isStrikeLineHingeLocked || crownCurvedData.editedCurve3D.length < 2) {
              return null;
            }
            const pts = crownCurvedData.editedCurve3D;
            const scaled = Math.max(0, Math.min(pts.length - 1, uFrac * (pts.length - 1)));
            const idx = Math.min(pts.length - 2, Math.floor(scaled));
            const frac = scaled - idx;
            const p0 = pts[idx];
            const p1 = pts[idx + 1];
            // Map tunnel metric (x=drive, y=transverse, z=elevation) -> Three.js (x=y, y=z, z=x)
            return [
              p0.y + (p1.y - p0.y) * frac,
              p0.z + (p1.z - p0.z) * frac,
              p0.x + (p1.x - p0.x) * frac,
            ];
          };

          const getPt = (uDist: number, vDist: number, uFracOverride?: number): [number, number, number] => {
            const uFrac = uFracOverride !== undefined ? uFracOverride : (uDist + R_s) / Math.max(1e-4, 2 * R_s);
            const curvedBase = sampleCrownCurve3D(uFrac);
            if (curvedBase) {
              const [bx, by, bz] = curvedBase;
              const px = bx + vDist * dx;
              const py = Math.max(0.02, by + vDist * dy);
              const pz = bz + vDist * dz;
              return [px, py, pz];
            }
            const px = ax + uDist * sx + vDist * dx;
            const hingeRoofY = isCrownNonPenetratingHinge
              ? Math.min(ay + uDist * sy, getCrownArchRoofY(ax + uDist * sx))
              : ay + uDist * sy;
            const rawPy = hingeRoofY + vDist * dy;
            const py = isCrownNonPenetratingHinge
              ? Math.max(0, Math.min(rawPy, getCrownArchRoofY(px)))
              : rawPy;
            const pz = az + uDist * sz + vDist * dz;
            return [px, py, pz];
          };

          for (let r = 0; r <= numRows; r++) {
            const vFrac = r / numRows;
            const vDist = -R_up + vFrac * (R_up + R_down);
            for (let c = 0; c <= numCols; c++) {
              const uFrac = c / numCols;
              const uDist = -R_s + uFrac * (2 * R_s);
              const [px, py, pz] = getPt(uDist, vDist, uFrac);

              tracedPositions.push(px, py, pz);
              tracedNormals.push(nx, ny, nz);
              tracedUvs.push(uFrac, vFrac);
            }
          }

          for (let r = 0; r < numRows; r++) {
            for (let c = 0; c < numCols; c++) {
              const i0 = r * (numCols + 1) + c;
              const i1 = i0 + 1;
              const i2 = (r + 1) * (numCols + 1) + c;
              const i3 = i2 + 1;

              tracedIndices.push(i0, i2, i1);
              tracedIndices.push(i1, i2, i3);
            }
          }

          const tracedGeo = new THREE.BufferGeometry();
          tracedGeo.setAttribute('position', new THREE.Float32BufferAttribute(tracedPositions, 3));
          tracedGeo.setAttribute('normal', new THREE.Float32BufferAttribute(tracedNormals, 3));
          tracedGeo.setAttribute('uv', new THREE.Float32BufferAttribute(tracedUvs, 2));
          tracedGeo.setIndex(tracedIndices);

          const tracedPlaneMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(grpColor),
            transparent: true,
            opacity: 0.68,
            side: THREE.DoubleSide,
            roughness: 0.3,
            metalness: 0.08,
            depthWrite: false,
          });

          const tracedPlaneMesh = new THREE.Mesh(tracedGeo, tracedPlaneMat);
          group.add(tracedPlaneMesh);

          const borderPos: number[] = [];
          for (let c = 0; c < numCols; c++) {
            const uFrac0 = c / numCols;
            const uFrac1 = (c + 1) / numCols;
            const u0 = -R_s + uFrac0 * (2 * R_s);
            const u1 = -R_s + uFrac1 * (2 * R_s);
            borderPos.push(...getPt(u0, -R_up, uFrac0), ...getPt(u1, -R_up, uFrac1));
            borderPos.push(...getPt(u0, R_down, uFrac0), ...getPt(u1, R_down, uFrac1));
          }
          borderPos.push(...getPt(-R_s, -R_up, 0), ...getPt(-R_s, R_down, 0));
          borderPos.push(...getPt(R_s, -R_up, 1), ...getPt(R_s, R_down, 1));

          const borderGeo = new THREE.BufferGeometry();
          borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderPos, 3));
          const borderMat = new THREE.LineBasicMaterial({
            color: 0xfbbf24,
            linewidth: 2.5,
            transparent: true,
            opacity: 0.95,
          });
          group.add(new THREE.LineSegments(borderGeo, borderMat));

          // Proportional internal subdivision grid lines on the traced-length plane
          const gridStep = Math.max(0.25, Number((currentTraceLengthM / 4).toFixed(2)));
          const gridPositions: number[] = [];
          for (let step = -R_up + gridStep; step < R_down - 0.02; step += gridStep) {
            if (Math.abs(step) < 0.05) continue;
            for (let c = 0; c < numCols; c++) {
              const uFrac0 = c / numCols;
              const uFrac1 = (c + 1) / numCols;
              const u0 = -R_s + uFrac0 * (2 * R_s);
              const u1 = -R_s + uFrac1 * (2 * R_s);
              gridPositions.push(...getPt(u0, step, uFrac0), ...getPt(u1, step, uFrac1));
            }
          }
          for (let step = -R_s + gridStep; step < R_s - 0.02; step += gridStep) {
            if (Math.abs(step) < 0.05) continue;
            const uFrac = (step + R_s) / Math.max(1e-4, 2 * R_s);
            gridPositions.push(...getPt(step, -R_up, uFrac), ...getPt(step, R_down, uFrac));
          }
          if (gridPositions.length > 0) {
            const gridGeo = new THREE.BufferGeometry();
            gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3));
            const gridMat = new THREE.LineBasicMaterial({
              color: new THREE.Color(grpColor).getHex(),
              transparent: true,
              opacity: 0.35,
            });
            group.add(new THREE.LineSegments(gridGeo, gridMat));
          }

          // Exact 3D Polyline of the Crown Curved Intersection Trace (or 2D Mapped Trace Points)
          if (crownCurvedData && !isStrikeLineHingeLocked && crownCurvedData.editedCurve3D.length >= 2) {
            // 1. Live Edited Curved Crown Trace where the 3D plane cuts right through the crown arch
            const editedPts = crownCurvedData.editedCurve3D.map(
              (m) => new THREE.Vector3(m.y, m.z, m.x)
            );
            const editedGeo = new THREE.BufferGeometry().setFromPoints(editedPts);
            const editedMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 4.5 });
            group.add(new THREE.Line(editedGeo, editedMat));

            // 2. Original Drawn Trace on Crown (for visual reference)
            const drawnPts = crownCurvedData.drawnCurve3D.map(
              (m) => new THREE.Vector3(m.y, m.z + 0.015, m.x)
            );
            const drawnGeo = new THREE.BufferGeometry().setFromPoints(drawnPts);
            const drawnMat = new THREE.LineBasicMaterial({
              color: 0x38bdf8,
              linewidth: 2.5,
              transparent: true,
              opacity: 0.65,
            });
            group.add(new THREE.Line(drawnGeo, drawnMat));
          } else if (activeTracePoints && activeTracePoints.length >= 2) {
            const polyPts = activeTracePoints.map((pt) => {
              const m = pointToTunnel3DMetric(pt, currentJoint.panel || 'face', tunnelGeometry);
              return new THREE.Vector3(m.y, m.z, m.x);
            });
            const polyGeo = new THREE.BufferGeometry().setFromPoints(polyPts);
            const polyMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 4 });
            group.add(new THREE.Line(polyGeo, polyMat));

            // If trace was pivoted around Starting (P1) or Ending (P2) point, also show original trace for reference
            if (
              tracePivotEndpoint &&
              (isDipAmountEdited || isStrikeDirEdited) &&
              currentJoint.points &&
              currentJoint.points.length >= 2
            ) {
              const origPts = currentJoint.points.map((pt) => {
                const m = pointToTunnel3DMetric(pt, currentJoint.panel || 'face', tunnelGeometry);
                return new THREE.Vector3(m.y, m.z, m.x);
              });
              const origGeo = new THREE.BufferGeometry().setFromPoints(origPts);
              const origMat = new THREE.LineBasicMaterial({
                color: 0x94a3b8,
                linewidth: 2,
                transparent: true,
                opacity: 0.5,
              });
              group.add(new THREE.Line(origGeo, origMat));
            }
          }
        }
      } else if (planeDisplayMode === 'EXTENDED') {
        const wTunnel = tunnelGeometry.widthM || 8.5;
        const hTunnel = tunnelGeometry.heightM || 7.5;
        const autoExtR = Math.max(4.8, Math.round(Math.max(wTunnel, hTunnel) * 0.65 * 10) / 10);
        const extR = planeExtensionM && planeExtensionM <= 9.0 ? planeExtensionM : autoExtR;
        const R_s = extR;

        // For crown / strike-hinge joints: Top edge is anchored at the Crown Strike Line Hinge (R_up = 0)
        // and projects strictly downward toward the invert floor without penetrating above the crown arch:
        const dipSin = Math.max(0.35, Math.sin((dipAmount * Math.PI) / 180));
        const R_down = isCrownNonPenetratingHinge ? Math.min(9.5, Math.max(0.5, ay / dipSin)) : extR;
        const R_up = isCrownNonPenetratingHinge ? 0 : extR;

        const numCols = 16;
        const numRows = 12;
        const extPositions: number[] = [];
        const extNormals: number[] = [];
        const extUvs: number[] = [];
        const extIndices: number[] = [];

        const getExtPt = (uDist: number, vDist: number): [number, number, number] => {
          const px = ax + uDist * sx + vDist * dx;
          const hingeRoofY = isCrownNonPenetratingHinge
            ? Math.min(ay + uDist * sy, getCrownArchRoofY(ax + uDist * sx))
            : ay + uDist * sy;
          const rawPy = hingeRoofY + vDist * dy;
          const py = isCrownNonPenetratingHinge
            ? Math.max(0, Math.min(rawPy, getCrownArchRoofY(px)))
            : rawPy;
          const pz = az + uDist * sz + vDist * dz;
          return [px, py, pz];
        };

        for (let r = 0; r <= numRows; r++) {
          const vFrac = r / numRows;
          const vDist = -R_up + vFrac * (R_up + R_down); // along dip direction
          for (let c = 0; c <= numCols; c++) {
            const uFrac = c / numCols;
            const uDist = -R_s + uFrac * (2 * R_s); // along strike axis

            const [px, py, pz] = getExtPt(uDist, vDist);

            extPositions.push(px, py, pz);
            extNormals.push(nx, ny, nz);
            extUvs.push(uFrac, vFrac);
          }
        }

        for (let r = 0; r < numRows; r++) {
          for (let c = 0; c < numCols; c++) {
            const i0 = r * (numCols + 1) + c;
            const i1 = i0 + 1;
            const i2 = (r + 1) * (numCols + 1) + c;
            const i3 = i2 + 1;

            extIndices.push(i0, i2, i1);
            extIndices.push(i1, i2, i3);
          }
        }

        const extGeo = new THREE.BufferGeometry();
        extGeo.setAttribute('position', new THREE.Float32BufferAttribute(extPositions, 3));
        extGeo.setAttribute('normal', new THREE.Float32BufferAttribute(extNormals, 3));
        extGeo.setAttribute('uv', new THREE.Float32BufferAttribute(extUvs, 2));
        extGeo.setIndex(extIndices);

        const extPlaneMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(grpColor),
          transparent: true,
          opacity: 0.54,
          side: THREE.DoubleSide,
          roughness: 0.35,
          metalness: 0.05,
          depthWrite: false,
        });

        const extPlaneMesh = new THREE.Mesh(extGeo, extPlaneMat);
        group.add(extPlaneMesh);

        // Extended Plane Perimeter Outline
        const borderPos: number[] = [];
        for (let c = 0; c < numCols; c++) {
          const u0 = -R_s + (c / numCols) * (2 * R_s);
          const u1 = -R_s + ((c + 1) / numCols) * (2 * R_s);
          borderPos.push(...getExtPt(u0, -R_up), ...getExtPt(u1, -R_up));
          borderPos.push(...getExtPt(u0, R_down), ...getExtPt(u1, R_down));
        }
        borderPos.push(...getExtPt(-R_s, -R_up), ...getExtPt(-R_s, R_down));
        borderPos.push(...getExtPt(R_s, -R_up), ...getExtPt(R_s, R_down));

        const borderGeo = new THREE.BufferGeometry();
        borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderPos, 3));
        const borderMat = new THREE.LineBasicMaterial({
          color: new THREE.Color(grpColor).offsetHSL(0, 0, -0.15).getHex(),
          linewidth: 2.2,
          transparent: true,
          opacity: 0.85,
        });
        group.add(new THREE.LineSegments(borderGeo, borderMat));

        // In-Plane Structure Grid Lines (every 1.5m)
        const gridPositions: number[] = [];
        for (let step = -Math.floor(R_up / 1.5) * 1.5; step <= R_down; step += 1.5) {
          if (Math.abs(step) < 0.15) continue;
          for (let c = 0; c < numCols; c++) {
            const u0 = -R_s + (c / numCols) * (2 * R_s);
            const u1 = -R_s + ((c + 1) / numCols) * (2 * R_s);
            gridPositions.push(...getExtPt(u0, step), ...getExtPt(u1, step));
          }
        }
        for (let step = -Math.floor(R_s / 1.5) * 1.5; step <= R_s; step += 1.5) {
          if (Math.abs(step) < 0.15) continue;
          gridPositions.push(...getExtPt(step, -R_up), ...getExtPt(step, R_down));
        }
        if (gridPositions.length > 0) {
          const gridGeo = new THREE.BufferGeometry();
          gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3));
          const gridMat = new THREE.LineBasicMaterial({
            color: new THREE.Color(grpColor).getHex(),
            transparent: true,
            opacity: 0.28,
          });
          group.add(new THREE.LineSegments(gridGeo, gridMat));
        }

        // Highlight Tunnel Intersection Cut Outline if plane intersects tunnel box
        if (clippedVertices.length >= 3) {
          const cutPerim: number[] = [];
          for (let i = 0; i < clippedVertices.length; i++) {
            const curr = clippedVertices[i];
            const next = clippedVertices[(i + 1) % clippedVertices.length];
            const cyCurr = isCrownNonPenetratingHinge
              ? Math.min(curr.z, getCrownArchRoofY(curr.y))
              : curr.z;
            const cyNext = isCrownNonPenetratingHinge
              ? Math.min(next.z, getCrownArchRoofY(next.y))
              : next.z;
            cutPerim.push(curr.y, cyCurr, curr.x, next.y, cyNext, next.x);
          }
          const cutGeo = new THREE.BufferGeometry();
          cutGeo.setAttribute('position', new THREE.Float32BufferAttribute(cutPerim, 3));
          const cutMat = new THREE.LineBasicMaterial({ color: 0xfbbf24, linewidth: 3.5 });
          group.add(new THREE.LineSegments(cutGeo, cutMat));
        }
      } else if (clippedVertices.length >= 3) {
        // Clipped to tunnel cross-section (clamped to Crown Strike Line Hinge & Arch when on Crown)
        const planeGeo = new THREE.BufferGeometry();
        const positions: number[] = [];
        const indices: number[] = [];

        clippedVertices.forEach((v) => {
          const clampedY = isCrownNonPenetratingHinge
            ? Math.min(v.z, getCrownArchRoofY(v.y))
            : v.z;
          positions.push(v.y, clampedY, v.x);
        });

        for (let i = 1; i < clippedVertices.length - 1; i++) {
          indices.push(0, i, i + 1);
        }

        planeGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        planeGeo.setIndex(indices);
        planeGeo.computeVertexNormals();

        const planeMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(grpColor),
          transparent: true,
          opacity: 0.68,
          side: THREE.DoubleSide,
          roughness: 0.35,
          metalness: 0.1,
        });

        const planeMesh = new THREE.Mesh(planeGeo, planeMat);
        group.add(planeMesh);

        const perimeterPositions: number[] = [];
        for (let i = 0; i < clippedVertices.length; i++) {
          const curr = clippedVertices[i];
          const next = clippedVertices[(i + 1) % clippedVertices.length];
          const cyCurr = isCrownNonPenetratingHinge
            ? Math.min(curr.z, getCrownArchRoofY(curr.y))
            : curr.z;
          const cyNext = isCrownNonPenetratingHinge
            ? Math.min(next.z, getCrownArchRoofY(next.y))
            : next.z;
          perimeterPositions.push(curr.y, cyCurr, curr.x, next.y, cyNext, next.x);
        }
        const perimGeo = new THREE.BufferGeometry();
        perimGeo.setAttribute('position', new THREE.Float32BufferAttribute(perimeterPositions, 3));
        const perimMat = new THREE.LineBasicMaterial({ color: 0x92400e, linewidth: 2.5 });
        group.add(new THREE.LineSegments(perimGeo, perimMat));
      }
    }

    // 2. Strike Vector Hinge Line at Anchor / Crown Cut Point (Contoured to Crown Arch when on Crown so it never pokes through roof)
    const currentPlaneExt = planeExtensionM && planeExtensionM <= 9.0 ? planeExtensionM : 5.5;
    const sLen =
      planeDisplayMode === 'TRACED_LENGTH'
        ? tracedHalfLen
        : Math.max(3.8, currentPlaneExt * 0.95);
    const sPos: number[] = [];
    const sSegs = isCrownNonPenetratingHinge ? 16 : 1;
    for (let i = 0; i < sSegs; i++) {
      const u0 = -sLen + (i / sSegs) * (2 * sLen);
      const u1 = -sLen + ((i + 1) / sSegs) * (2 * sLen);
      const x0 = ax + u0 * sx;
      const x1 = ax + u1 * sx;
      const y0 = isCrownNonPenetratingHinge ? Math.min(ay + u0 * sy, getCrownArchRoofY(x0)) : ay + u0 * sy;
      const y1 = isCrownNonPenetratingHinge ? Math.min(ay + u1 * sy, getCrownArchRoofY(x1)) : ay + u1 * sy;
      const z0 = az + u0 * sz;
      const z1 = az + u1 * sz;
      sPos.push(x0, y0, z0, x1, y1, z1);
    }
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
    const sMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 3.5 });
    group.add(new THREE.LineSegments(sGeo, sMat));

    // 3. Downward Dip Direction Arrow (Vibrant Amber / Gold — projected onto plane along exact dipDirection)
    const dipArrowLen =
      planeDisplayMode === 'TRACED_LENGTH'
        ? Math.max(0.65, Math.min(2.2, tracedHalfLen * 1.15))
        : 2.4;
    const relDipRad =
      (((dipDirection - (tunnelGeometry.driveAzimuthDeg || 0)) % 360) * Math.PI) / 180;
    const dipRad = (Math.max(1, dipAmount) * Math.PI) / 180;
    // Target 3D downward dip vector in Three.js coordinates (X = Y_tunnel = sin, Y = Z_tunnel = -sin(dip), Z = X_tunnel = cos)
    const targetDip3D = new THREE.Vector3(
      Math.sin(relDipRad) * Math.cos(dipRad),
      -Math.sin(dipRad),
      Math.cos(relDipRad) * Math.cos(dipRad)
    );
    const planeNorm3D = new THREE.Vector3(plane.normal.y, plane.normal.z, plane.normal.x).normalize();
    const projDip3D = targetDip3D
      .clone()
      .sub(planeNorm3D.clone().multiplyScalar(targetDip3D.dot(planeNorm3D)));
    const rawDipDir =
      projDip3D.lengthSq() > 1e-4
        ? projDip3D
        : new THREE.Vector3(plane.dipVector.y, plane.dipVector.z, plane.dipVector.x);
    const dipArrowOrigin = new THREE.Vector3(
      isNaN(ax) ? 4.25 : ax,
      isNaN(ay) ? 3.75 : ay,
      isNaN(az) ? 3.0 : az
    );
    if (rawDipDir.length() > 0.001 && !isNaN(rawDipDir.x) && !isNaN(rawDipDir.y) && !isNaN(rawDipDir.z)) {
      const dipArrowDir = rawDipDir.clone().normalize();
      const dipArrow = new THREE.ArrowHelper(
        dipArrowDir,
        dipArrowOrigin,
        dipArrowLen,
        0xd97706,
        Math.min(0.45, dipArrowLen * 0.25),
        Math.min(0.26, dipArrowLen * 0.15)
      );
      group.add(dipArrow);
    }

    // 4. Plane Normal Vector Arrow (Forest Green)
    const normalArrowLen =
      planeDisplayMode === 'TRACED_LENGTH'
        ? Math.max(0.55, Math.min(1.8, tracedHalfLen * 0.95))
        : 1.9;
    const rawNormalDir = new THREE.Vector3(plane.normal.y, plane.normal.z, plane.normal.x);
    if (rawNormalDir.length() > 0.001 && !isNaN(rawNormalDir.x) && !isNaN(rawNormalDir.y) && !isNaN(rawNormalDir.z)) {
      const normalDir = rawNormalDir.clone().normalize();
      const normalArrow = new THREE.ArrowHelper(
        normalDir,
        dipArrowOrigin,
        normalArrowLen,
        0x15803d,
        Math.min(0.38, normalArrowLen * 0.25),
        Math.min(0.2, normalArrowLen * 0.15)
      );
      group.add(normalArrow);
    }

    // 5. Anchor Point Sphere directly on user trace location / crown strike cut point
    const isCrownJoint = currentJoint.panel === 'crown';
    const anchorGeo = new THREE.SphereGeometry(isCrownJoint ? 0.2 : 0.14, 20, 20);
    const anchorMat = new THREE.MeshBasicMaterial({ color: isCrownJoint ? 0xef4444 : 0xdc2626 });
    const anchorMesh = new THREE.Mesh(anchorGeo, anchorMat);
    anchorMesh.position.copy(dipArrowOrigin);
    group.add(anchorMesh);

    if (isCrownJoint) {
      // Golden Halo ring around crown strike cut point
      const haloGeo = new THREE.RingGeometry(0.25, 0.35, 24);
      const haloMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.position.set(ax, ay + 0.02, az);
      haloMesh.rotation.x = Math.PI / 2;
      group.add(haloMesh);
    }

    // 5a. Dedicated Glowing Golden Hinge Axis along Mapped Joint Trace (Face, Walls & Crown)
    if (hingePlaneResult) {
      const p1 = hingePlaneResult.traceStartPoint;
      const p2 = hingePlaneResult.traceEndPoint;
      // Coordinates in Three.js: X = Y_geom (width), Y = Z_geom (elevation), Z = X_geom (advance)
      const v1 = new THREE.Vector3(p1.y, p1.z, p1.x);
      const v2 = new THREE.Vector3(p2.y, p2.z, p2.x);
      const hVec = new THREE.Vector3().subVectors(v2, v1);
      const hLen = hVec.length();

      if (hLen > 0.02) {
        // Glowing gold cylinder along the mapped trace line
        const hingeCylGeo = new THREE.CylinderGeometry(0.045, 0.045, hLen, 16);
        const hingeCylMat = new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          emissive: 0xd97706,
          emissiveIntensity: 0.85,
          metalness: 0.7,
          roughness: 0.2,
        });
        const hingeCyl = new THREE.Mesh(hingeCylGeo, hingeCylMat);
        hingeCyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hVec.clone().normalize());
        hingeCyl.position.copy(v1.clone().add(v2).multiplyScalar(0.5));
        group.add(hingeCyl);

        // Terminal Spheres: Highlight selected Starting Point (P1) or Ending Point (P2)
        const isStartSelected = tracePivotEndpoint === 'start';
        const isEndSelected = tracePivotEndpoint === 'end';

        const sp1Geo = new THREE.SphereGeometry(isStartSelected ? 0.16 : 0.1, 20, 20);
        const sp1Mat = new THREE.MeshStandardMaterial({
          color: isStartSelected ? 0x10b981 : 0xfde047,
          emissive: isStartSelected ? 0x059669 : 0xf59e0b,
          emissiveIntensity: 0.95,
        });
        const sp1 = new THREE.Mesh(sp1Geo, sp1Mat);
        sp1.position.copy(v1);
        group.add(sp1);

        const sp2Geo = new THREE.SphereGeometry(isEndSelected ? 0.16 : 0.1, 20, 20);
        const sp2Mat = new THREE.MeshStandardMaterial({
          color: isEndSelected ? 0x06b6d4 : 0xfde047,
          emissive: isEndSelected ? 0x0284c7 : 0xf59e0b,
          emissiveIntensity: 0.95,
        });
        const sp2 = new THREE.Mesh(sp2Geo, sp2Mat);
        sp2.position.copy(v2);
        group.add(sp2);

        if (tracePivotEndpoint) {
          const pivotVec = isStartSelected ? v1 : v2;
          const pivotBadge = createBillboardLabel(
            isStartSelected ? 'P1 START (BASE)' : 'P2 END (BASE)',
            '#0f172a',
            isStartSelected ? '#6ee7b7' : '#67e8f9',
            1.45,
            0.28
          );
          pivotBadge.position.set(pivotVec.x, pivotVec.y + 0.28, pivotVec.z);
          group.add(pivotBadge);
        }
      }
    }

    // 5a. 3D Geological Disk Gizmo & Normal/Dip Vectors around Anchor
    if (inspectTargetType === 'dip_surface' || is3DGizmoDragMode) {
      const gizmoRadius = Math.max(0.75, Math.min(2.2, currentTraceLengthM * 0.55));
      // Only render the circular ring gizmo for joints in 3D Gizmo Drag mode; Dip Surfaces show their exact drawn polygon shape instead
      if (inspectTargetType !== 'dip_surface') {
        const circlePts: THREE.Vector3[] = [];
        const segments = 64;
        for (let i = 0; i <= segments; i++) {
          const ang = (i / segments) * Math.PI * 2;
          const c = Math.cos(ang) * gizmoRadius;
          const s = Math.sin(ang) * gizmoRadius;
          circlePts.push(
            new THREE.Vector3(
              ax + sx * c + dx * s,
              ay + sy * c + dy * s,
              az + sz * c + dz * s
            )
          );
        }
        const ringGeo = new THREE.BufferGeometry().setFromPoints(circlePts);
        const ringMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 3 });
        group.add(new THREE.Line(ringGeo, ringMat));
      }

      // Dip Direction Arrow on Surface (Amber)
      const dipDirVec = new THREE.Vector3(dx, dy, dz).normalize();
      const dipArrow = new THREE.ArrowHelper(
        dipDirVec,
        new THREE.Vector3(ax, ay, az),
        gizmoRadius * 1.15,
        0xf59e0b,
        0.32,
        0.18
      );
      group.add(dipArrow);

      // Plane Normal Vector Arrow (Emerald)
      const normVec = new THREE.Vector3(nx, ny, nz).normalize();
      const normArrow = new THREE.ArrowHelper(
        normVec,
        new THREE.Vector3(ax, ay, az),
        gizmoRadius * 0.95,
        0x10b981,
        0.28,
        0.16
      );
      group.add(normArrow);
    }

    // 5b. Compact 3D Joint / Dip Surface Tag (shown only when 'Show 3D Labels' is enabled so the joint plane stays unobstructed)
    if (showLegendOverlay) {
      const billboardLabelText = `${inspectTargetType === 'dip_surface' ? 'DP ' : ''}${dipAmount}°/${dipDirection}° (${currentTraceLengthM}m)`;
      const planeDipSprite = createBillboardLabel(
        billboardLabelText,
        '#0F172A',
        '#FCD34D',
        1.75,
        0.34
      );
      planeDipSprite.position.set(ax, ay + 0.42, az);
      group.add(planeDipSprite);
    }

    // 6. Clean Multi-Surface Intersection Traces in 3D (Shown for EXTENDED and CLIPPED full-tunnel modes)
    if (planeDisplayMode !== 'TRACED_LENGTH' && !tunnelGeometry.isVerticalShaft) {
      const pullL = tunnelGeometry.pullLengthM || 3.0;
      const w = tunnelGeometry.widthM || 8.5;
      const hw = tunnelGeometry.wallHeightM || 4.2;
      const h = tunnelGeometry.heightM || 7.5;
      const cx = w / 2;
      const archRise = h - hw;

      // Face Intersection Trace (at z = pullL) in Electric Blue
      if (surfaceIntersections.face) {
        const f1 = surfaceIntersections.face.p1;
        const f2 = surfaceIntersections.face.p2;
        const faceTraceGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(f1.x, f1.y, pullL),
          new THREE.Vector3(f2.x, f2.y, pullL),
        ]);
        const faceTraceMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 3.5 });
        group.add(new THREE.Line(faceTraceGeo, faceTraceMat));
      }

      // Left Wall Intersection Trace (at x = 0) in Amber
      if (surfaceIntersections.leftWall) {
        const l1 = surfaceIntersections.leftWall.p1;
        const l2 = surfaceIntersections.leftWall.p2;
        const leftTraceGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, l1.y, l1.x),
          new THREE.Vector3(0, l2.y, l2.x),
        ]);
        const leftTraceMat = new THREE.LineBasicMaterial({ color: 0xd97706, linewidth: 3.5 });
        group.add(new THREE.Line(leftTraceGeo, leftTraceMat));
      }

      // Right Wall Intersection Trace (at x = w) in Amber
      if (surfaceIntersections.rightWall) {
        const r1 = surfaceIntersections.rightWall.p1;
        const r2 = surfaceIntersections.rightWall.p2;
        const rightTraceGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(w, r1.y, r1.x),
          new THREE.Vector3(w, r2.y, r2.x),
        ]);
        const rightTraceMat = new THREE.LineBasicMaterial({ color: 0xd97706, linewidth: 3.5 });
        group.add(new THREE.Line(rightTraceGeo, rightTraceMat));
      }

      // Crown Arch Intersection Trace in Emerald Green (Curved along arched crown roof)
      if (surfaceIntersections.crown) {
        const curved3D = surfaceIntersections.crown.curvedPoints3D;
        if (curved3D && curved3D.length >= 2) {
          const crownTraceGeo = new THREE.BufferGeometry().setFromPoints(
            curved3D.map((pt) => new THREE.Vector3(pt.y, pt.z, pt.x))
          );
          const crownTraceMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 3.8 });
          group.add(new THREE.Line(crownTraceGeo, crownTraceMat));
        } else {
          const c1 = surfaceIntersections.crown.p1;
          const c2 = surfaceIntersections.crown.p2;
          const getCrownY = (xVal: number) => {
            const dx = (xVal - cx) / (w / 2);
            const clamped = Math.max(-1, Math.min(1, dx));
            return hw + archRise * Math.sqrt(Math.max(0, 1 - clamped * clamped));
          };
          const crownTraceGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(c1.y, getCrownY(c1.y), c1.x),
            new THREE.Vector3(c2.y, getCrownY(c2.y), c2.x),
          ]);
          const crownTraceMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 3.5 });
          group.add(new THREE.Line(crownTraceGeo, crownTraceMat));
        }
      }
    }
    requestRenderRef.current();
  }, [
    activeTab,
    clippedVertices,
    plane,
    anchorPoint,
    jointSetId,
    surfaceIntersections,
    tunnelGeometry,
    showInteriorPlane,
    planeDisplayMode,
    tracedPlaneDepthMode,
    planeExtensionM,
    currentJoint,
    currentJoint.panel,
    activeTracePoints,
    tracePivotEndpoint,
    isDipAmountEdited,
    isStrikeDirEdited,
    dipHalfCircleSense,
    hingePlaneResult,
    crownCurvedData,
    hingeDipDeg,
    currentTraceLengthM,
    isStrikeLineHingeLocked,
    showLegendOverlay,
    inspectTargetType,
    currentDipSurface,
    is3DGizmoDragMode,
  ]);

  // -------------------------------------------------------------------------
  // SAVE HANDLER (SUPPORTS BOTH 'TEXT_ONLY' AND 'ALIGN_TRACE' MODES)
  // -------------------------------------------------------------------------
  const handleSaveInspection = (applyMode: 'TEXT_ONLY' | 'ALIGN_TRACE' = 'TEXT_ONLY') => {
    const inspectionData: Joint3DInspectionData = {
      jointId: currentJoint.id,
      sourcePanel: currentJoint.panel,
      orientation: strikeInfo,
      measurementSource,
      orientationConfidence,
      angularUncertaintyDeg: angularUncertainty,
      isGeoreferenced: tunnelGeometry.driveAzimuthDeg !== undefined && !isNaN(tunnelGeometry.driveAzimuthDeg),
      isOrientationComplete: strikeInfo.isOrientationComplete ?? true,
      incompleteNotice:
        strikeInfo.isOrientationComplete === false
          ? 'Crown-only observation: Strike axis known, dipping side not yet confirmed'
          : undefined,
      coordinateReferenceNotice:
        tunnelGeometry.driveAzimuthDeg !== undefined
          ? isSurfaceMapping
            ? `Georeferenced to Exposure Bearing N ${Math.round(tunnelGeometry.driveAzimuthDeg)}° E`
            : `Georeferenced to Tunnel Drive Axis N ${Math.round(tunnelGeometry.driveAzimuthDeg)}° E`
          : isSurfaceMapping
          ? 'Local Surface Exposure Coordinate Reference'
          : 'Local Tunnel Coordinate Reference (Drive Bearing Unspecified)',
      anchorPoint,
      plane,
      clippedPlaneVertices: clippedVertices,
      observedLengths,
      calculatedIntersections: surfaceIntersections,
      persistenceInterpretation,
      persistenceAssumptions,
      persistenceConfidence,
      linkedTraceIds,
    };

    if (inspectTargetType === 'dip_surface' && currentDipSurface && onSaveDipSurface) {
      const updatedSurface: FieldDipPlaneSurface = {
        ...currentDipSurface,
        dipDirection: strikeInfo.dipDirectionDeg,
        dipAmount: strikeInfo.dipDeg,
        strike: strikeInfo.strikeRhrDeg,
        setId: jointSetId,
        label:
          jointSetId !== 'unassigned' && (!currentDipSurface.label || currentDipSurface.label === 'DP')
            ? jointSetId
            : currentDipSurface.label || 'DP',
        inspection3D: {
          ...inspectionData,
          isOrientationComplete: true,
        },
      };
      onSaveDipSurface(updatedSurface);
      setSaveStatus('SAVED');
      setTimeout(() => setSaveStatus('IDLE'), 2400);
      return;
    }

    const nextPoints =
      applyMode === 'ALIGN_TRACE'
        ? tracePivotEndpoint && (isDipAmountEdited || isStrikeDirEdited)
          ? currentJoint.panel === 'crown' && !tunnelGeometry.isVerticalShaft && crownCurvedData
            ? crownCurvedData.editedCanvasPoints
            : activeTracePoints
          : recomputeAlignedCanvasTracePoints(
              activeTracePoints,
              currentJoint.panel,
              strikeInfo.dipDirectionDeg,
              strikeInfo.dipDeg,
              tunnelGeometry
            )
        : currentJoint.points;

    const updated: FieldJointTrace = {
      ...currentJoint,
      points: nextPoints,
      dipDirection: strikeInfo.dipDirectionDeg,
      dipAmount: strikeInfo.dipDeg,
      strike: strikeInfo.strikeRhrDeg,
      crownDipSign: hingeDipSide === 'collar' ? '-90' : '+90',
      editedByCompass: true,
      setId: jointSetId,
      inspection3D: {
        ...inspectionData,
        isOrientationComplete: true,
      },
    };

    onSaveJoint(updated);
    setSaveStatus('SAVED');
    setTimeout(() => setSaveStatus('IDLE'), 2400);
  };

  // Automatic Zero-Lag Debounced Reflection to 2D Canvas when orientation or endpoint pivot is edited
  useEffect(() => {
    if (!isDipAmountEdited && !isStrikeDirEdited && !hasUnsavedChanges) return;
    const timer = window.setTimeout(() => {
      const mode: 'TEXT_ONLY' | 'ALIGN_TRACE' =
        tracePivotEndpoint && (isDipAmountEdited || isStrikeDirEdited) ? 'ALIGN_TRACE' : 'TEXT_ONLY';
      handleSaveInspection(mode);
    }, 160);
    return () => window.clearTimeout(timer);
  }, [dipDirection, dipAmount, dipHalfCircleSense, jointSetId, tracePivotEndpoint, isDipAmountEdited, isStrikeDirEdited]);

  // Export Inspection CSV
  const handleExportCsv = () => {
    const rows = [
      ['PARAMETER', 'VALUE', 'UNIT', 'GEOTECHNICAL_NOTE'],
      ['Joint_ID', currentJoint.id, '', 'Unique mapped joint identifier'],
      ['Source_Panel', currentJoint.panel, '', 'Mapping surface where trace was observed'],
      ['Joint_Set', jointSetId, '', 'Discontinuity structural grouping'],
      ['Tunnel_Relative_Dip_Direction', strikeInfo.dipDirectionDeg, 'degrees', '000° Forward, 090° Right, 180° Backward, 270° Left clockwise from drive axis'],
      ['Direction_Label', strikeInfo.directionLabel, '', 'Human-readable tunnel-relative orientation descriptor'],
      ['Dip_Angle', strikeInfo.dipDeg, 'degrees', '0-90 plunge from horizontal plane'],
      ['Crown_Strike_Pair', strikeInfo.strikePair?.label || strikeInfo.strikePairLabel, 'degrees', 'Opposite bidirectional collinear crown strike axes differing by 180°'],
      ['Strike_RHR', strikeInfo.strikeRhrDeg, 'degrees', 'Right-Hand Rule convention in local horizontal plane'],
      ['Strike_Alternate', strikeInfo.strikeAltDeg, 'degrees', 'Back-azimuth (RHR + 180 deg)'],
      ['Orientation_Completeness', strikeInfo.isOrientationComplete ? 'COMPLETE' : 'INCOMPLETE_CROWN_STRIKE_ONLY', '', 'Orientation status (strike-only requires dipping side)'],
      ['Dipping_Side', strikeInfo.dippingSide || 'unspecified', '', 'Assigned dipping side for crown observations (Right +Y, Left -Y, or unspecified)'],
      ['Measurement_Source', measurementSource, '', 'Observation instrumentation / input source'],
      ['Orientation_Confidence', orientationConfidence, '', 'Mapper statistical confidence'],
      ['Angular_Uncertainty', angularUncertainty, 'degrees', 'Estimated measurement tolerance'],
      ['Tunnel_Width', tunnelGeometry.widthM, 'm', 'Tunnel cross-section excavation width'],
      ['Tunnel_Height', tunnelGeometry.heightM, 'm', 'Tunnel cross-section excavation height'],
      ['Tunnel_Pull_Length', tunnelGeometry.pullLengthM, 'm', 'Round advance / pull depth'],
      ['Tunnel_Drive_Azimuth', tunnelGeometry.driveAzimuthDeg ?? 'N/A', 'degrees', 'Excavation heading bearing (geographic reference)'],
      ['Anchor_X_Longitudinal_M', anchorPoint.x.toFixed(3), 'm', 'Tunnel drive direction (+X forward, 0..L)'],
      ['Anchor_Y_Transverse_M', anchorPoint.y.toFixed(3), 'm', 'Transverse span (+Y right looking forward, 0..W)'],
      ['Anchor_Z_Elevation_M', anchorPoint.z.toFixed(3), 'm', 'Vertical elevation (+Z upward above invert, 0..H)'],
      ['Plane_Normal_A', plane.a.toFixed(4), '', 'Direction cosine Ax (+X Forward)'],
      ['Plane_Normal_B', plane.b.toFixed(4), '', 'Direction cosine By (+Y Right)'],
      ['Plane_Normal_C', plane.c.toFixed(4), '', 'Direction cosine Cz (+Z Upward)'],
      ['Plane_D_Constant', plane.d.toFixed(4), '', 'Plane equation aX + bY + cZ + d = 0'],
      ['Observed_Face_Length', observedLengths.faceM, 'm', 'Directly mapped length on excavation face'],
      ['Observed_Left_Wall_Length', observedLengths.leftWallM, 'm', 'Directly mapped length on left wall'],
      ['Observed_Right_Wall_Length', observedLengths.rightWallM, 'm', 'Directly mapped length on right wall'],
      ['Observed_Crown_Length', observedLengths.crownM, 'm', 'Directly mapped length on crown arch'],
      ['Total_Observed_Length', observedLengths.totalObservedM, 'm', 'Confirmed exposed trace length'],
      ['Calculated_Face_Length', surfaceIntersections.face ? surfaceIntersections.face.lengthM : 0, 'm', 'Calculated plane intersection on Face'],
      ['Calculated_Left_Wall_Length', surfaceIntersections.leftWall ? surfaceIntersections.leftWall.lengthM : 0, 'm', 'Calculated plane intersection on Left Wall'],
      ['Calculated_Right_Wall_Length', surfaceIntersections.rightWall ? surfaceIntersections.rightWall.lengthM : 0, 'm', 'Calculated plane intersection on Right Wall'],
      ['Calculated_Crown_Length', surfaceIntersections.crown ? surfaceIntersections.crown.lengthM : 0, 'm', 'Calculated plane intersection on Crown'],
      ['Calculated_Total_Intersection', surfaceIntersections.totalCalculatedM, 'm', 'Theoretical plane perimeter across all 4 surfaces in round'],
      ['Persistence_Confidence', persistenceConfidence, '', 'Engineering continuity rating'],
      ['Persistence_Interpretation', `"${persistenceInterpretation.replace(/"/g, '""')}"`, '', 'Geologist interpretation'],
      ['Persistence_Assumptions', `"${persistenceAssumptions.replace(/"/g, '""')}"`, '', 'Modeling assumptions'],
      ['Export_Timestamp', new Date().toISOString(), '', 'ESWA Geological Mapper Audit'],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NATM_3D_Joint_Inspection_${activeJoint.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 bg-slate-900 safe-area-inset-box">
      <div
        className={`w-full max-w-full h-full h-[100dvh] flex flex-col rounded-none shadow-none overflow-hidden transition-colors border-0 ${
          isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-900 text-slate-100'
        }`}
      >
        {/* ===================================================================
            HEADER: TITLE, STATUS & ACTION BUTTONS (COMPACT SINGLE-ROW SCROLL ON ANDROID)
            =================================================================== */}
        <header
          className={`flex-none px-2.5 sm:px-4 py-1.5 sm:py-2.5 flex flex-nowrap lg:flex-wrap items-center justify-between gap-2 sm:gap-3 border-b transition-colors overflow-x-auto no-scrollbar whitespace-nowrap ${
            isLight
              ? 'bg-white/95 text-slate-900 border-slate-200 shadow-xs'
              : 'bg-slate-900/95 text-slate-100 border-slate-700/80 shadow-xs'
          }`}
        >
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div
              className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center font-black transition-colors shrink-0 ${
                isLight
                  ? 'bg-amber-100 border-amber-400 text-amber-700'
                  : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
              }`}
            >
              <Compass className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            </div>
            <div className="shrink-0">
              <div className="flex items-center gap-2">
                <h2
                  className={`font-mono font-black text-xs sm:text-base tracking-wide transition-colors ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  {tunnelGeometry.isVerticalShaft
                    ? 'VERTICAL SHAFT 3D JOINT INSPECTOR'
                    : isSurfaceMapping
                    ? `${domainPanelMap.domainTitle.toUpperCase()} 3D INSPECTOR · ${getPortionShort(activePortionPanel).toUpperCase()}`
                    : 'NATM 3D JOINT INSPECTOR & PERSISTENCE'}
                </h2>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowDigitalTwinModal(true)}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-mono text-[10.5px] sm:text-[11px] font-bold flex items-center gap-1.5 shadow cursor-pointer transition-colors shrink-0"
              title="Open 3D Digital Twin & Photogrammetry Workbench to extract exact 3D facet Dip Direction & Dip Amount"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>3D Digital Twin</span>
            </button>
            {/* Horizontal & Vertical Adaptive Mode Segmented Controls */}
            <div className="flex items-center p-0.5 rounded-xl bg-slate-800/90 border border-slate-700/80 font-mono text-[10.5px] sm:text-[11px] font-bold shadow-inner shrink-0">
              <button
                type="button"
                onClick={() => setViewLayoutMode('CANVAS')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                  viewLayoutMode === 'CANVAS'
                    ? 'bg-amber-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Show 3D Viewport Only (Full Canvas)"
              >
                <Box className="w-3.5 h-3.5" />
                <span>3D Only</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayoutMode('SPLIT')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                  viewLayoutMode === 'SPLIT'
                    ? 'bg-amber-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Split View (Show both 3D Viewport and Parameters)"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Split</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayoutMode('PARAMS')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                  viewLayoutMode === 'PARAMS'
                    ? 'bg-amber-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Show Parameters & Audit Only (Full Aside)"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Params</span>
              </button>
            </div>

            {/* In Vertical Mode: Quick Canvas Position Inverter (Top vs Bottom) */}
            {isVerticalMode && viewLayoutMode === 'SPLIT' && (
              <button
                type="button"
                onClick={() => setVerticalCanvasPosition((prev) => (prev === 'top' ? 'bottom' : 'top'))}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white border border-slate-700 transition-colors cursor-pointer text-[10.5px] font-mono font-bold flex items-center gap-1 shadow-sm shrink-0"
                title="Swap vertical placement of 3D Canvas and Parameters"
              >
                <RotateCcw className="w-3 h-3 text-cyan-400" />
                <span>{verticalCanvasPosition === 'top' ? '3D: Top' : '3D: Bottom'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-xl border cursor-pointer transition-colors shrink-0 ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border-slate-700'
              }`}
              title="Close 3D Joint Inspector"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </header>

        {/* ===================================================================
            MAIN BODY: ADAPTIVE 2-PANEL LAYOUT (WORKS IN BOTH HORIZONTAL & VERTICAL)
            =================================================================== */}
        <div
          className={`flex-1 h-full min-h-0 max-h-full flex ${
            isVerticalMode ? 'flex-col' : 'flex-col lg:flex-row'
          } overflow-hidden relative`}
        >
          {/* ---------------------------------------------------------------
              LEFT/BOTTOM PANEL: HIGH-RESPONSIVENESS INPUTS & GEOLOGICAL AUDIT
              (ADAPTS TO HORIZONTAL & VERTICAL MODES)
              --------------------------------------------------------------- */}
          {isAsideCollapsed ? (
            /* COLLAPSED RAIL: ADAPTS TO HORIZONTAL (rail) OR VERTICAL (top/bottom bar) */
            <aside
              className={`${
                isVerticalMode
                  ? verticalCanvasPosition === 'top'
                    ? 'order-2 w-full h-10 border-t'
                    : 'order-1 w-full h-10 border-b'
                  : 'order-1 flex-none w-12 border-r flex flex-col items-center py-2.5 gap-2.5'
              } flex items-center justify-between px-3 z-20 select-none shadow-md transition-all ${
                isLight
                  ? 'bg-slate-100 border-slate-300 text-slate-800'
                  : 'bg-slate-900 border-slate-700/80 text-slate-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAsideCollapsed(false)}
                  className="px-2.5 py-1 rounded-md bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 text-xs font-bold shadow-md cursor-pointer transition-colors"
                  title="Expand Audit & Parameters Aside Sidebar"
                >
                  <PanelLeftOpen className="w-3.5 h-3.5" />
                  <span>Show Parameters</span>
                </button>
                <span className="text-[11px] font-mono text-amber-300 font-bold">
                  Joint {currentJoint.id} ({isSurfaceMapping ? getPortionShort(currentJoint.panel) : currentJoint.panel})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAsideCollapsed(false)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 cursor-pointer"
                title="Expand"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            </aside>
          ) : (
            <aside
              ref={asideRef as unknown as React.RefObject<HTMLElement>}
              data-mouse-scrollable="true"
              tabIndex={0}
              onWheel={(e) => {
                e.stopPropagation();
              }}
              style={{
                overscrollBehaviorY: 'contain',
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y',
              }}
              className={`${
                isVerticalMode
                  ? verticalCanvasPosition === 'top'
                    ? 'order-2'
                    : 'order-1'
                  : 'order-1 lg:order-1'
              } ${
                viewLayoutMode === 'CANVAS'
                  ? 'hidden'
                  : viewLayoutMode === 'PARAMS'
                  ? 'flex-1 h-full w-full'
                  : isVerticalMode
                  ? 'flex-1 h-[calc(54vh-48px)] sm:h-[calc(52vh-48px)] min-h-[200px] w-full border-t border-slate-700/80'
                  : asideWidthMode === 'compact'
                  ? 'w-full lg:w-[340px] flex-none h-full border-r'
                  : 'w-full lg:w-[460px] flex-none h-full border-r'
              } p-3 sm:p-4 overflow-y-scroll overscroll-y-contain space-y-3.5 font-mono text-xs transition-all duration-150 shadow-xl inspector-scrollable-aside select-text ${
                isLight
                  ? 'bg-slate-100/95 border-slate-300 text-slate-900'
                  : 'bg-slate-900 border-slate-700/80 text-slate-100'
              }`}
            >
              {/* ASIDE TOP HEADER BAR: COLLAPSE, SCROLL & SHRINK CONTROLS */}
              <div
                className={`flex items-center justify-between pb-2 border-b transition-colors ${
                  isLight ? 'border-slate-300' : 'border-slate-700/70'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-sky-400 uppercase tracking-wide text-xs">
                  <Sliders className="w-3.5 h-3.5 text-sky-400" />
                  <span>Audit &amp; Parameters</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Quick Scroll Stepper Buttons */}
                  <div className="flex items-center rounded-lg bg-slate-800 border border-slate-700 p-0.5">
                    <button
                      type="button"
                      onClick={() => scrollAsideBy(-320)}
                      className="px-1.5 py-0.5 rounded hover:bg-slate-700 text-amber-300 hover:text-white transition-colors cursor-pointer flex items-center gap-0.5 text-[10px] font-bold"
                      title="Scroll Up"
                    >
                      <ArrowUp className="w-3 h-3 text-amber-400" />
                      <span>Up</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollAsideBy(320)}
                      className="px-1.5 py-0.5 rounded hover:bg-slate-700 text-amber-300 hover:text-white transition-colors cursor-pointer flex items-center gap-0.5 text-[10px] font-bold"
                      title="Scroll Down"
                    >
                      <ArrowDown className="w-3 h-3 text-amber-400" />
                      <span>Down</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAsideWidthMode((prev) => (prev === 'compact' ? 'standard' : 'compact'))}
                    className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                    title={
                      asideWidthMode === 'compact'
                        ? 'Expand to Standard Width (460px)'
                        : 'Shrink to Compact Width (340px)'
                    }
                  >
                    {asideWidthMode === 'compact' ? 'Standard (460px)' : 'Shrink (340px)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAsideCollapsed(true)}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer flex items-center gap-1 text-[10.5px] font-bold"
                    title="Collapse Sidebar to maximize 3D viewport"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Collapse</span>
                  </button>
                </div>
              </div>

              {/* TOP CARD: TRACED JOINTS & DIP SURFACES IN ROUND (Instant Switching & 3D Editing) */}
              <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700/80 shadow-lg space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/70 pb-2">
                  <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        setInspectTargetType('joint');
                        if (allRoundJoints[0] && !allRoundJoints.some((j) => j.id === currentJointId)) {
                          setCurrentJointId(allRoundJoints[0].id);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold cursor-pointer transition-all ${
                        inspectTargetType === 'joint'
                          ? 'bg-amber-500 text-slate-950 font-black shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Joints ({allRoundJoints.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInspectTargetType('dip_surface');
                        if (
                          allRoundDipSurfaces[0] &&
                          !allRoundDipSurfaces.some((d) => d.id === currentDipSurfaceId)
                        ) {
                          setCurrentDipSurfaceId(allRoundDipSurfaces[0].id);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-md text-[10.5px] font-bold cursor-pointer transition-all ${
                        inspectTargetType === 'dip_surface'
                          ? 'bg-emerald-500 text-slate-950 font-black shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Dip Surfaces ({allRoundDipSurfaces.length})
                    </button>
                  </div>
                  <span className="text-[10px] text-cyan-300 font-bold">Click to Inspect &amp; Edit</span>
                </div>

                {inspectTargetType === 'dip_surface' ? (
                  allRoundDipSurfaces.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">
                      No Dip Surfaces mapped in this round yet.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                      {allRoundDipSurfaces.map((dp) => {
                        const isCurrent = dp.id === (currentDipSurface?.id || currentDipSurfaceId);
                        const dpColor =
                          FIELD_JOINT_GROUP_COLORS[dp.setId || 'unassigned']?.stroke || '#10b981';
                        return (
                          <div
                            key={dp.id}
                            onClick={() => {
                              setInspectTargetType('dip_surface');
                              setCurrentDipSurfaceId(dp.id);
                            }}
                            className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                              isCurrent
                                ? 'bg-emerald-500/20 border-emerald-400 shadow-md ring-2 ring-emerald-400/50'
                                : 'bg-slate-900/90 hover:bg-slate-700/80 border-slate-700 hover:border-slate-600 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-full shrink-0 border border-white/50"
                                style={{ backgroundColor: dpColor }}
                              />
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`font-bold font-mono text-xs ${
                                      isCurrent ? 'text-emerald-300 font-black' : 'text-white'
                                    }`}
                                  >
                                    Dip Surface {dp.label || dp.id}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 uppercase font-mono">
                                    {isSurfaceMapping ? getPortionShort(dp.panel) : dp.panel.replace('_', ' ')}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Set: {dp.setId || 'Unassigned'} · Strike: {dp.strike}°
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 font-mono text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-emerald-300 text-xs">
                                  {dp.dipAmount}°
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  ➔ {String(dp.dipDirection).padStart(3, '0')}°
                                </span>
                              </div>
                              {isCurrent ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[9.5px]">
                                  ACTIVE
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[9.5px] hover:text-white">
                                  Inspect 3D
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : allRoundJoints.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">No joints traced in this round.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                    {allRoundJoints.map((j) => {
                      const isCurrent = j.id === currentJointId;
                      const jColor = FIELD_JOINT_GROUP_COLORS[j.setId || 'unassigned']?.stroke || '#f59e0b';
                      return (
                        <div
                          key={j.id}
                          onClick={() => handleRequestSwitchJoint(j.id)}
                          className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isCurrent
                              ? 'bg-amber-500/20 border-amber-400 shadow-md ring-2 ring-amber-400/50'
                              : 'bg-slate-900/90 hover:bg-slate-700/80 border-slate-700 hover:border-slate-600 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 border border-white/50"
                              style={{ backgroundColor: jColor }}
                            />
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className={`font-bold font-mono text-xs ${isCurrent ? 'text-amber-300 font-black' : 'text-white'}`}>
                                  Joint {j.id}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 uppercase font-mono">
                                  {tunnelGeometry.isVerticalShaft
                                    ? j.panel === 'face'
                                      ? 'SHAFT FACE (BOTTOM 0m)'
                                      : j.panel === 'left_wall'
                                      ? '1. NE WALL (0°-90°)'
                                      : j.panel === 'crown'
                                      ? '2. ES WALL (90°-180°)'
                                      : j.panel === 'right_wall'
                                      ? '3. SW WALL (180°-270°)'
                                      : '4. WN WALL (270°-360°)'
                                    : isSurfaceMapping
                                    ? getPortionShort(j.panel)
                                    : j.panel.replace('_', ' ')}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Set: {j.setId || 'Unassigned'} · Length: {calculatePolylineLengthM(j.points, j.panel, tunnelGeometry).toFixed(2)}m
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 font-mono text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-amber-300 text-xs">
                                {j.dipAmount ?? 65}°
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ➔ {String(j.dipDirection ?? 135).padStart(3, '0')}°
                              </span>
                            </div>
                            {isCurrent ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[9.5px]">
                                ACTIVE
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[9.5px] hover:text-white">
                                Inspect
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Two Explicit Apply Options: Change Text Only vs Change Trace Alignment on Canvas */}
                <div className="pt-1.5 space-y-1.5">
                  <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wide flex items-center justify-between">
                    <span>Apply Edited 3D Inspection to Canvas:</span>
                    {saveStatus === 'SAVED' && (
                      <span className="text-emerald-400 flex items-center gap-1 font-black">
                        <Check className="w-3.5 h-3.5" /> Reflected on Canvas!
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSaveInspection('TEXT_ONLY')}
                      className="py-2 px-2.5 rounded-xl font-mono text-[11px] font-black cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-300"
                      title="Update Dip Direction, Dip Amount & Strike text on the canvas while keeping the drawn trace line unchanged"
                    >
                      <Save className="w-3.5 h-3.5 shrink-0" />
                      <span>1. Change Text Only on Canvas</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveInspection('ALIGN_TRACE')}
                      className="py-2 px-2.5 rounded-xl font-mono text-[11px] font-black cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 border border-cyan-300"
                      title={
                        isSurfaceMapping
                          ? 'Update both text and trace alignment on the surface mapping canvas based on edited 3D joint inspection'
                          : 'Update both text and trace alignment (curved crown arch intersection or apparent-dip trace) on the canvas based on edited 3D joint inspection'
                      }
                    >
                      <Compass className="w-3.5 h-3.5 shrink-0" />
                      <span>2. Change Trace Alignment on Canvas</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* INTERACTIVE 3D GIZMO DISK + REAL-TIME STEREONET + DIRECT DIP / DIP DIRECTION SLIDERS */}
              <div className="p-3.5 rounded-xl bg-slate-800/95 border border-cyan-500/40 shadow-lg space-y-3">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
                  <span className="font-bold text-cyan-300 uppercase flex items-center gap-1.5 text-xs">
                    <Compass className="w-4 h-4 text-cyan-400" />
                    <span>
                      3D {inspectTargetType === 'dip_surface' ? 'Dip Surface' : 'Joint'} Gizmo, Stereonet &amp; Direct Sliders
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIs3DGizmoDragMode((v) => !v)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer transition-all ${
                      is3DGizmoDragMode
                        ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-black shadow'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-cyan-500/50'
                    }`}
                    title="When active, dragging directly on the 3D viewport rotates the 3D Plane/Disk Dip Direction and Dip Angle"
                  >
                    {is3DGizmoDragMode ? '3D Viewport Gizmo Drag: ON' : '3D Viewport Gizmo Drag: OFF'}
                  </button>
                </div>

                {/* Interactive Lower-Hemisphere Equal-Area Stereonet & 3D Plane Disk */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-5 flex flex-col items-center">
                    {(() => {
                      const cx = 80;
                      const cy = 80;
                      const R = 64;
                      const driveAz = Math.round(
                        (((tunnelGeometry.driveAzimuthDeg ?? 0) % 360) + 360) % 360
                      );
                      const rightAz = (driveAz + 90) % 360;
                      const backAz = (driveAz + 180) % 360;
                      const leftAz = (driveAz + 270) % 360;

                      const dipRad = ((dipAmount ?? 60) * Math.PI) / 180;
                      const relDipDir =
                        ((((dipDirection ?? 135) - driveAz) % 360) + 360) % 360;
                      const dirRad = ((relDipDir - 90) * Math.PI) / 180;
                      // Dip vector point on disk (radius proportional to dipAmount / 90)
                      const rDip = ((dipAmount ?? 60) / 90) * R;
                      const handleX = cx + rDip * Math.cos(dirRad);
                      const handleY = cy + rDip * Math.sin(dirRad);

                      // Strike endpoints (relative to Tunnel Drive at Top 12 o'clock)
                      const relStrike1 =
                        ((((strikeInfo.strikeRhrDeg ?? 45) - driveAz) % 360) + 360) % 360;
                      const strike1Rad = ((relStrike1 - 90) * Math.PI) / 180;
                      const sx1 = cx + R * Math.cos(strike1Rad);
                      const sy1 = cy + R * Math.sin(strike1Rad);
                      const sx2 = cx - R * Math.cos(strike1Rad);
                      const sy2 = cy - R * Math.sin(strike1Rad);

                      // Great circle arc midpoint (bowing toward dip direction)
                      const bowDist = R * Math.cos(dipRad);
                      const midArcX = cx + bowDist * Math.cos(dirRad);
                      const midArcY = cy + bowDist * Math.sin(dirRad);
                      const ctrlX = 2 * midArcX - 0.5 * (sx1 + sx2);
                      const ctrlY = 2 * midArcY - 0.5 * (sy1 + sy2);

                      const updateFromStereonetPointer = (e: React.PointerEvent<SVGSVGElement>) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const px = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 160;
                        const py = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 160;
                        const dx = px - cx;
                        const dy = py - cy;
                        const dist = Math.min(R, Math.hypot(dx, dy));
                        const relClickDeg =
                          ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
                        const nextDir = Math.round((driveAz + relClickDeg) % 360);
                        const nextDip = Math.max(0, Math.min(90, Math.round((dist / R) * 90)));
                        if (inspectTargetType === 'dip_surface') {
                          setIsHingeRotationActive(false);
                          setDipDirection(nextDir);
                          setDipAmount(nextDip);
                          setHingeDipDeg(nextDip);
                        } else if (isCrownOrSurface) {
                          setDipAmount(nextDip);
                          setHingeDipDeg(Math.max(1, nextDip));
                          if (Math.abs(nextDir - (dipDirection ?? 135)) >= 3) {
                            handleRequestDipDirectionOrStrikeChange(nextDir);
                          }
                        } else {
                          // On Face & Walls: Plane stays anchored to the drawn joint trace hinge while updating Dip Direction
                          setDipDirection(nextDir);
                          handleRequestDipAmountChange(nextDip);
                        }
                      };

                      return (
                        <div className="flex flex-col items-center">
                          <svg
                            viewBox="0 0 160 160"
                            className="w-36 h-36 cursor-crosshair touch-none select-none"
                            onPointerDown={(e) => {
                              e.currentTarget.setPointerCapture(e.pointerId);
                              updateFromStereonetPointer(e);
                            }}
                            onPointerMove={(e) => {
                              if (e.buttons > 0) {
                                updateFromStereonetPointer(e);
                              }
                            }}
                          >
                            <circle cx={cx} cy={cy} r={R + 6} fill="#020617" stroke="#1e293b" strokeWidth="1.5" />
                            <circle cx={cx} cy={cy} r={R} fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
                            <circle cx={cx} cy={cy} r={R * 0.66} fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,2" />
                            <circle cx={cx} cy={cy} r={R * 0.33} fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="2,2" />
                            <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke="#1e293b" strokeWidth="1" />
                            <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke="#1e293b" strokeWidth="1" />
                            <text x={cx} y={11} textAnchor="middle" fill="#f43f5e" fontSize="8.5" fontWeight="bold">
                              {driveAz}°
                            </text>
                            <text x={150} y={cy + 3} textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontWeight="bold">
                              {rightAz}°
                            </text>
                            <text x={cx} y={156} textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontWeight="bold">
                              {backAz}°
                            </text>
                            <text x={10} y={cy + 3} textAnchor="middle" fill="#94a3b8" fontSize="7.5" fontWeight="bold">
                              {leftAz}°
                            </text>

                            {/* Strike Line */}
                            <line
                              x1={sx1}
                              y1={sy1}
                              x2={sx2}
                              y2={sy2}
                              stroke="#10b981"
                              strokeWidth="1.8"
                              strokeDasharray="3,2"
                            />
                            {/* Great Circle Projection */}
                            <path
                              d={`M ${sx1.toFixed(1)} ${sy1.toFixed(1)} Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${sx2.toFixed(1)} ${sy2.toFixed(1)}`}
                              fill="none"
                              stroke="#f59e0b"
                              strokeWidth="2.5"
                            />
                            {/* Dip Vector Line + Draggable Gizmo Handle */}
                            <line
                              x1={cx}
                              y1={cy}
                              x2={handleX}
                              y2={handleY}
                              stroke="#06b6d4"
                              strokeWidth="2.2"
                            />
                            <circle
                              cx={handleX}
                              cy={handleY}
                              r="6.5"
                              fill="#f59e0b"
                              stroke="#ffffff"
                              strokeWidth="2"
                            />
                          </svg>
                          <span className="text-[9.5px] text-cyan-300 font-bold text-center mt-0.5">
                            Top = {isSurfaceMapping ? 'Bearing' : 'Drive'} ({driveAz}°) · Drag to Rotate
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Direct Dip Direction (0-359°) & Dip Angle (0-90°) Sliders with Trace Hinge Protection */}
                  <div className="sm:col-span-7 space-y-2.5">
                    <div className="space-y-1">
                      <NumericStepperInput
                        label={
                          isCrownOrSurface
                            ? 'Strike / Dip Direction (0°–359° · Rotates Plane)'
                            : 'Dip Direction (0°–359°)'
                        }
                        value={dipDirection ?? 135}
                        min={0}
                        max={359}
                        step={1}
                        unit="°"
                        isCircular={true}
                        isLight={isLight}
                        onChange={(val) => {
                          handleRequestDipDirectionOrStrikeChange(val);
                        }}
                      />
                      <input
                        type="range"
                        min={0}
                        max={359}
                        value={dipDirection ?? 135}
                        onChange={(e) => {
                          handleRequestDipDirectionOrStrikeChange(Number(e.target.value));
                        }}
                        className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-900 rounded-lg"
                      />
                      <div className="flex items-center justify-between gap-1">
                        {(() => {
                          const dAz = Math.round(
                            (((tunnelGeometry.driveAzimuthDeg ?? 0) % 360) + 360) % 360
                          );
                          return [
                            { d: dAz, label: `${String(dAz).padStart(3, '0')}° FWD` },
                            {
                              d: (dAz + 90) % 360,
                              label: `${String((dAz + 90) % 360).padStart(3, '0')}° R`,
                            },
                            {
                              d: (dAz + 180) % 360,
                              label: `${String((dAz + 180) % 360).padStart(3, '0')}° BACK`,
                            },
                            {
                              d: (dAz + 270) % 360,
                              label: `${String((dAz + 270) % 360).padStart(3, '0')}° L`,
                            },
                          ].map((btn) => (
                            <button
                              key={btn.label}
                              type="button"
                              onClick={() => {
                                handleRequestDipDirectionOrStrikeChange(btn.d);
                              }}
                              className={`flex-1 py-0.5 rounded text-[9px] font-mono cursor-pointer border ${
                                (dipDirection ?? 135) === btn.d
                                  ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-bold'
                                  : 'bg-slate-900 hover:bg-slate-700 text-slate-300 border-slate-700'
                              }`}
                            >
                              {btn.label}
                            </button>
                          ));
                        })()}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1 border-t border-slate-700/70">
                      <NumericStepperInput
                        label={
                          isCrownOrSurface
                            ? 'Dip Amount Around Strike Trace (0°–90°)'
                            : 'Dip Amount (0°–90° · Inwards / Outwards Half-Circle)'
                        }
                        value={dipAmount ?? 60}
                        min={0}
                        max={90}
                        step={1}
                        unit="°"
                        isLight={isLight}
                        onChange={(val) => {
                          handleRequestDipAmountChange(val);
                        }}
                      />

                      {/* DIP INWARDS vs DIP OUTWARDS BUTTONS */}
                      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleDipHalfCircleSenseChange('inwards')}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold cursor-pointer border transition-colors flex items-center justify-center gap-1 ${
                            dipHalfCircleSense === 'inwards'
                              ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-black shadow-sm'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                          title="Dip Inwards into rock mass / heading (0°–90° Inwards half of semicircle)"
                        >
                          <span>↙ Dip Inwards</span>
                          <span className="text-[9px] opacity-85">({dipAmount ?? 60}°)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDipHalfCircleSenseChange('outwards')}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold cursor-pointer border transition-colors flex items-center justify-center gap-1 ${
                            dipHalfCircleSense === 'outwards'
                              ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow-sm'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                          title="Dip Outwards toward excavation / collar (90°–0° Outwards half of semicircle)"
                        >
                          <span>↘ Dip Outwards</span>
                          <span className="text-[9px] opacity-85">({dipAmount ?? 60}°)</span>
                        </button>
                      </div>

                      {/* INTERACTIVE 180° HALF-CIRCLE DIP AMOUNT PROTRACTOR (INWARDS 0°..90°..0° OUTWARDS) */}
                      <div className="p-2 rounded-xl bg-slate-950/90 border border-slate-700/80 space-y-1.5">
                        <div className="flex items-center justify-between text-[9.5px] font-mono">
                          <span className="text-emerald-400 font-bold">◀ 0° Inwards</span>
                          <span className="text-amber-300 font-black">
                            180° Half-Circle: {dipAmount ?? 60}° {dipHalfCircleSense === 'inwards' ? 'INWARDS' : 'OUTWARDS'}
                          </span>
                          <span className="text-amber-400 font-bold">0° Outwards ▶</span>
                        </div>
                        {(() => {
                          const hCx = 110;
                          const hCy = 16;
                          const hR = 76;
                          // Map halfCircleProtractorAngle (0..180) to semi-circle below horizontal baseline:
                          // 0° Inwards = Left (180°), 90° Vertical = Bottom (90°), 180° (0° Outwards) = Right (0°)
                          const thetaRad = ((180 - halfCircleProtractorAngle) * Math.PI) / 180;
                          const tipX = hCx + hR * Math.cos(thetaRad);
                          const tipY = hCy + hR * Math.sin(thetaRad);

                          const updateFromHalfCirclePointer = (e: React.PointerEvent<SVGSVGElement>) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const px = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 220;
                            const py = Math.max(hCy, ((e.clientY - rect.top) / Math.max(1, rect.height)) * 106);
                            const dx = px - hCx;
                            const dy = Math.max(0, py - hCy);
                            // Angle from left horizontal (180°) through bottom (90°) to right horizontal (0°)
                            const rawDeg = (Math.atan2(dy, dx) * 180) / Math.PI; // 0..180
                            const angle0to180 = Math.round(180 - Math.max(0, Math.min(180, rawDeg)));
                            handleHalfCircleProtractorChange(angle0to180);
                          };

                          return (
                            <svg
                              viewBox="0 0 220 106"
                              className="w-full h-24 cursor-pointer touch-none select-none"
                              onPointerDown={(e) => {
                                e.currentTarget.setPointerCapture(e.pointerId);
                                updateFromHalfCirclePointer(e);
                              }}
                              onPointerMove={(e) => {
                                if (e.buttons > 0) {
                                  updateFromHalfCirclePointer(e);
                                }
                              }}
                            >
                              {/* Inwards Quadrant Fill (Left Half: 0° Inwards to 90° Vertical) */}
                              <path
                                d={`M ${hCx} ${hCy} L ${hCx - hR} ${hCy} A ${hR} ${hR} 0 0 0 ${hCx} ${hCy + hR} Z`}
                                fill={dipHalfCircleSense === 'inwards' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(15, 23, 42, 0.7)'}
                                stroke="#1e293b"
                                strokeWidth="1"
                              />
                              {/* Outwards Quadrant Fill (Right Half: 90° Vertical to 0° Outwards) */}
                              <path
                                d={`M ${hCx} ${hCy} L ${hCx} ${hCy + hR} A ${hR} ${hR} 0 0 0 ${hCx + hR} ${hCy} Z`}
                                fill={dipHalfCircleSense === 'outwards' ? 'rgba(245, 158, 11, 0.18)' : 'rgba(15, 23, 42, 0.7)'}
                                stroke="#1e293b"
                                strokeWidth="1"
                              />
                              {/* Outer Half-Circle Protractor Arc */}
                              <path
                                d={`M ${hCx - hR} ${hCy} A ${hR} ${hR} 0 0 0 ${hCx + hR} ${hCy}`}
                                fill="none"
                                stroke="#38bdf8"
                                strokeWidth="1.75"
                              />
                              {/* Horizontal Top Baseline (0° Inwards <-> Pivot <-> 0° Outwards) */}
                              <line
                                x1={hCx - hR - 8}
                                y1={hCy}
                                x2={hCx + hR + 8}
                                y2={hCy}
                                stroke="#475569"
                                strokeWidth="1.5"
                              />
                              {/* 90° Vertical Plumb Line */}
                              <line
                                x1={hCx}
                                y1={hCy}
                                x2={hCx}
                                y2={hCy + hR}
                                stroke="#64748b"
                                strokeWidth="1.2"
                                strokeDasharray="3,2"
                              />
                              {/* Protractor Degree Ticks every 30° */}
                              {[0, 30, 60, 90, 120, 150, 180].map((ang180) => {
                                const rRad = ((180 - ang180) * Math.PI) / 180;
                                const x1 = hCx + (hR - 5) * Math.cos(rRad);
                                const y1 = hCy + (hR - 5) * Math.sin(rRad);
                                const x2 = hCx + hR * Math.cos(rRad);
                                const y2 = hCy + hR * Math.sin(rRad);
                                const lx = hCx + (hR + 11) * Math.cos(rRad);
                                const ly = hCy + (hR + 10) * Math.sin(rRad);
                                const dispDeg = ang180 <= 90 ? ang180 : 180 - ang180;
                                return (
                                  <g key={ang180}>
                                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth="1.3" />
                                    <text
                                      x={lx}
                                      y={ly + 2}
                                      textAnchor="middle"
                                      fill={ang180 === 90 ? '#f8fafc' : ang180 < 90 ? '#6ee7b7' : '#fcd34d'}
                                      fontSize="7.5"
                                      fontWeight="bold"
                                    >
                                      {dispDeg}°
                                    </text>
                                  </g>
                                );
                              })}
                              {/* Active Dip Vector Ray from Base Pivot */}
                              <line
                                x1={hCx}
                                y1={hCy}
                                x2={tipX}
                                y2={tipY}
                                stroke={dipHalfCircleSense === 'inwards' ? '#10b981' : '#f59e0b'}
                                strokeWidth="3"
                              />
                              {/* Base Pivot Point (P1 Start or P2 End) */}
                              <circle cx={hCx} cy={hCy} r="4.5" fill="#06b6d4" stroke="#ffffff" strokeWidth="1.5" />
                              {/* Draggable Dip Handle on Half-Circle */}
                              <circle
                                cx={tipX}
                                cy={tipY}
                                r="6"
                                fill={dipHalfCircleSense === 'inwards' ? '#10b981' : '#f59e0b'}
                                stroke="#ffffff"
                                strokeWidth="2"
                              />
                              <text x={hCx - 42} y={hCy + 28} textAnchor="middle" fill="#6ee7b7" fontSize="8" fontWeight="bold">
                                INWARDS
                              </text>
                              <text x={hCx + 42} y={hCy + 28} textAnchor="middle" fill="#fcd34d" fontSize="8" fontWeight="bold">
                                OUTWARDS
                              </text>
                            </svg>
                          );
                        })()}

                        {/* Continuous 180° Half-Circle Slider (0° Inwards -> 90° Vertical -> 0° Outwards) */}
                        <input
                          type="range"
                          min={0}
                          max={180}
                          value={halfCircleProtractorAngle}
                          onChange={(e) => handleHalfCircleProtractorChange(Number(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-900 rounded-lg"
                          title="Sweep across full 180° Half-Circle: Left (0°–90° Dip Inwards) ↔ Center (90° Vertical) ↔ Right (90°–0° Dip Outwards)"
                        />

                        {/* Quick Base Point (P1 Start / P2 End) Selector Strip */}
                        {inspectTargetType !== 'dip_surface' && (
                          <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800 text-[9.5px]">
                            <span className="text-slate-400 font-bold">Base Pivot:</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setTracePivotEndpoint('start');
                                  if (!isStrikeMeasuredPanel) setIsDipAmountEdited(true);
                                  else setIsStrikeDirEdited(true);
                                }}
                                className={`px-2 py-0.5 rounded font-mono font-bold cursor-pointer border ${
                                  tracePivotEndpoint === 'start'
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-black'
                                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                                }`}
                              >
                                P1 Start
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setTracePivotEndpoint('end');
                                  if (!isStrikeMeasuredPanel) setIsDipAmountEdited(true);
                                  else setIsStrikeDirEdited(true);
                                }}
                                className={`px-2 py-0.5 rounded font-mono font-bold cursor-pointer border ${
                                  tracePivotEndpoint === 'end'
                                    ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-black'
                                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                                }`}
                              >
                                P2 End
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        {[15, 30, 45, 60, 75, 90].map((deg) => (
                          <button
                            key={deg}
                            type="button"
                            onClick={() => {
                              handleRequestDipAmountChange(deg);
                            }}
                            className={`flex-1 py-0.5 rounded text-[9px] font-mono cursor-pointer border ${
                              (dipAmount ?? 60) === deg
                                ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold'
                                : 'bg-slate-900 hover:bg-slate-700 text-slate-300 border-slate-700'
                            }`}
                          >
                            {deg}°
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            {/* 1. Orientation & Angle Conventions */}
            <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700/80 shadow-md space-y-3">
              <div className="flex items-center justify-between border-b border-slate-700/70 pb-2">
                <span className="font-bold text-amber-400 uppercase flex items-center gap-1.5">
                  <Compass className="w-4 h-4" />
                  <span>3D Orientation &amp; Strike Conventions</span>
                </span>
                <span className="text-[10px] text-cyan-300 font-mono font-bold">
                  {getTunnelRelativeDirectionLabel(dipDirection)}
                </span>
              </div>

              {/* FACE TRACE HINGE ROTATION CONTROL (Pinned strictly to mapped joint trace) */}
              {isFaceTrace && isHingeRotationActive && (
                <div className="p-3 rounded-lg bg-gradient-to-br from-amber-500/15 via-slate-900 to-amber-950/20 border border-amber-500/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-[11px] font-bold text-amber-300">
                        {isSurfaceMapping
                          ? `${domainPanelMap.face.shortLabel} Trace Hinge Axis:`
                          : 'Face Trace Hinge Axis:'}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/40 text-[10px]">
                      Trace: {hingePlaneResult?.traceLengthM.toFixed(2) ?? '0.00'}m
                    </span>
                  </div>

                  {/* Live Dip Angle Slider around Traced Line */}
                  <div className="space-y-1.5 bg-slate-900/90 p-2.5 rounded-lg border border-amber-500/20">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-200">Rotation Angle Around Trace (Dip δ):</span>
                      <span className="font-mono font-black text-amber-400 bg-amber-950/90 px-2 py-0.5 rounded border border-amber-500/50 text-xs shadow-sm">
                        {dipAmount ?? hingeDipDeg}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={90}
                      value={dipAmount ?? hingeDipDeg}
                      onChange={(e) => handleRequestDipAmountChange(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                    />
                    {/* Quick Preset Angles */}
                    <div className="flex items-center justify-between gap-1 pt-1">
                      {[90, 75, 60, 45, 30, 15].map((deg) => (
                        <button
                          key={deg}
                          type="button"
                          onClick={() => handleRequestDipAmountChange(deg)}
                          className={`flex-1 py-1 rounded text-[9.5px] font-mono cursor-pointer border transition-all ${
                            (dipAmount ?? hingeDipDeg) === deg
                              ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold shadow-sm'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {deg}°
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dipping Direction Side Toggle */}
                  <div className="space-y-1 pt-0.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-300">
                      <span>
                        Dipping Side relative to {isSurfaceMapping ? domainPanelMap.face.shortLabel : 'Face'}:
                      </span>
                      <span className="font-mono font-bold text-amber-300">
                        {hingeDipSide === 'heading'
                          ? isSurfaceMapping
                            ? 'Into Rock Mass (+Z)'
                            : 'Ahead (+Z Advance)'
                          : isSurfaceMapping
                          ? 'Outward / Daylight (-Z)'
                          : 'Back (-Z Portal)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTraceHingeAngleOrSideChange(dipAmount ?? hingeDipDeg, 'heading')}
                        className={`py-1.5 px-2 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                          hingeDipSide === 'heading'
                            ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-sm'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                      >
                        {isSurfaceMapping ? 'Dip Into Rock Mass (+Z)' : 'Dip Ahead into Heading (+Z)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTraceHingeAngleOrSideChange(dipAmount ?? hingeDipDeg, 'collar')}
                        className={`py-1.5 px-2 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                          hingeDipSide === 'collar'
                            ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-sm'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                      >
                        {isSurfaceMapping ? 'Dip Outward / Daylight (-Z)' : 'Dip Back to Collar (-Z)'}
                      </button>
                    </div>
                  </div>

                  {/* Live Derived Geological Orientation */}
                  <div className="p-2 rounded bg-slate-800/90 border border-slate-700/80 shadow-md flex items-center justify-between text-[10px] font-mono">
                    <div>
                      <span className="text-slate-400">Derived Dip: </span>
                      <strong className="text-amber-400 font-bold">{dipAmount}°</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Dip Dir: </span>
                      <strong className="text-cyan-400 font-bold">
                        {dipDirection}°
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Strike: </span>
                      <strong className="text-emerald-400 font-bold">
                        {strikeInfo.strikeRhrDeg}°
                      </strong>
                    </div>
                  </div>

                  {/* Crown Portion / Strike Line Hinge Lock Toggle */}
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 cursor-pointer pt-1 text-[9.5px] text-amber-300 hover:text-amber-200 border-t border-amber-500/20"
                  >
                    <input
                      type="checkbox"
                      checked={isStrikeLineHingeLocked}
                      onChange={(e) => {
                        e.stopPropagation();
                        setIsStrikeLineHingeLocked(e.target.checked);
                      }}
                      className="accent-amber-500 rounded cursor-pointer"
                    />
                    <span>
                      {isSurfaceMapping
                        ? `Strike Hinge Mode (Lock Strike ${strikeInfo.strikePairLabel} as stationary hinge when adjusting dip)`
                        : `Crown Portion Strike Hinge Mode (Lock Strike ${strikeInfo.strikePairLabel} as non-penetrating hinge when decreasing dip)`}
                    </span>
                  </label>
                </div>
              )}

              {/* WALL TRACE HINGE ROTATION CONTROL (Left Wall & Right Wall) */}
              {isWallTrace && isHingeRotationActive && (
                <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-500/15 via-slate-900 to-emerald-950/20 border border-emerald-500/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] font-bold text-emerald-300">
                        {tunnelGeometry.isVerticalShaft
                          ? currentJoint.panel === 'left_wall'
                            ? '1. NE Wall (0°–90°)'
                            : currentJoint.panel === 'right_wall'
                            ? '3. SW Wall (180°–270°)'
                            : '4. WN Wall (270°–360°)'
                          : isSurfaceMapping
                          ? getPortionShort(currentJoint.panel)
                          : currentJoint.panel === 'left_wall'
                          ? 'Left Wall'
                          : 'Right Wall'}{' '}
                        Trace Hinge Axis:
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/40 text-[10px]">
                      Trace: {hingePlaneResult?.traceLengthM.toFixed(2) ?? '0.00'}m
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-300 leading-snug">
                    The traced joint line on the{' '}
                    {tunnelGeometry.isVerticalShaft
                      ? 'vertical shaft quadrant wall'
                      : isSurfaceMapping
                      ? getPortionShort(currentJoint.panel)
                      : currentJoint.panel === 'left_wall'
                      ? 'left sidewall'
                      : 'right sidewall'}{' '}
                    is locked as the <strong className="text-emerald-300">stationary hinge axis</strong>. Sliding Dip Direction or Dip Amount rotates and tilts the 3D plane smoothly around the traced joint.
                  </p>

                  {/* Live Dip Angle Slider around Sidewall Traced Line */}
                  <div className="space-y-1.5 bg-slate-900/90 p-2.5 rounded-lg border border-emerald-500/20">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-200">Rotation Angle Around Wall Trace (Dip δ):</span>
                      <span className="font-mono font-black text-emerald-400 bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-500/50 text-xs shadow-sm">
                        {dipAmount ?? hingeDipDeg}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={90}
                      value={dipAmount ?? hingeDipDeg}
                      onChange={(e) => handleRequestDipAmountChange(Number(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                    />
                    {/* Quick Preset Angles */}
                    <div className="flex items-center justify-between gap-1 pt-1">
                      {[90, 75, 60, 45, 30, 15].map((deg) => (
                        <button
                          key={deg}
                          type="button"
                          onClick={() => handleRequestDipAmountChange(deg)}
                          className={`flex-1 py-1 rounded text-[9.5px] font-mono cursor-pointer border transition-all ${
                            (dipAmount ?? hingeDipDeg) === deg
                              ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-bold shadow-sm'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {deg}°
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dipping Direction Side Toggle for Wall */}
                  <div className="space-y-1 pt-0.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-300">
                      <span>Dipping Side relative to {isSurfaceMapping ? getPortionShort(currentJoint.panel) : 'Wall'}:</span>
                      <span className="font-mono font-bold text-emerald-300">
                        {hingeDipSide === 'heading'
                          ? (currentJoint.panel === 'left_wall' ? 'Into Left Rock (+Y)' : 'Into Right Rock (-Y)')
                          : isSurfaceMapping
                          ? 'Outward Into Exposure'
                          : 'Into Tunnel Opening'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTraceHingeAngleOrSideChange(dipAmount ?? hingeDipDeg, 'heading')}
                        className={`py-1.5 px-2 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                          hingeDipSide === 'heading'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-sm'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                      >
                        {currentJoint.panel === 'left_wall' ? 'Dip into Left Rock (+Y)' : 'Dip into Right Rock (-Y)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTraceHingeAngleOrSideChange(dipAmount ?? hingeDipDeg, 'collar')}
                        className={`py-1.5 px-2 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                          hingeDipSide === 'collar'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-sm'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                      >
                        {isSurfaceMapping ? 'Dip Outward Into Exposure' : 'Dip into Tunnel Cavity'}
                      </button>
                    </div>
                  </div>

                  {/* Live Derived Geological Orientation */}
                  <div className="p-2 rounded bg-slate-800/90 border border-slate-700/80 shadow-md flex items-center justify-between text-[10px] font-mono">
                    <div>
                      <span className="text-slate-400">Derived Dip: </span>
                      <strong className="text-emerald-400 font-bold">{dipAmount}°</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Dip Dir: </span>
                      <strong className="text-cyan-400 font-bold">
                        {dipDirection}°
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Strike: </span>
                      <strong className="text-amber-400 font-bold">
                        {strikeInfo.strikeRhrDeg}°
                      </strong>
                    </div>
                  </div>

                  {/* Toggle */}
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 cursor-pointer pt-0.5 text-[9.5px] text-slate-400 hover:text-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={isHingeRotationActive}
                      onChange={(e) => {
                        e.stopPropagation();
                        setIsHingeRotationActive(e.target.checked);
                      }}
                      className="accent-emerald-500 rounded cursor-pointer"
                    />
                    <span>Strictly lock rotation axis to mapped trace on {isSurfaceMapping ? getPortionShort(currentJoint.panel) : 'sidewall'} (Recommended)</span>
                  </label>
                </div>
              )}

              {/* CROWN CURVED STRIKE LINE & 3D PLANE CUTTING THROUGH CURVE CONTROL */}
              {isCrownTrace && isHingeRotationActive && (
                <div className="p-3 rounded-lg bg-gradient-to-br from-sky-500/15 via-slate-900 to-sky-950/20 border border-sky-500/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                      <span className="text-[11px] font-bold text-sky-300">
                        {tunnelGeometry.isVerticalShaft
                          ? '2. ES Wall (90°–180°) Trace Hinge & Dip Tilt:'
                          : isSurfaceMapping
                          ? `${domainPanelMap.crown.shortLabel} Strike Trace & 3D Cutting Plane:`
                          : 'Crown Curved Strike Trace & 3D Cutting Plane:'}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono font-bold border border-sky-500/40 text-[10px]">
                      Strike: {strikeInfo.strikePairLabel}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-300 leading-snug">
                    {tunnelGeometry.isVerticalShaft ? (
                      <>
                        The mapped trace on <strong className="text-sky-300">2. ES Wall (90°–180°)</strong> acts as the{' '}
                        <strong className="text-sky-300">stationary hinge axis</strong> on the vertical shaft wall (Pull 0m at bottom to {tunnelGeometry.pullLengthM}m at top).
                      </>
                    ) : (
                      <>
                        In <strong className="text-sky-300">{isSurfaceMapping ? 'Surface Mapping' : 'Crown Mapping'}</strong>, your drawn joint trace acts as the <strong className="text-emerald-300">fixed Strike trace hinge</strong>. Changing <strong className="text-sky-300">Dip Amount</strong> tilts the 3D plane around that Strike trace. Only changing <strong className="text-cyan-300">Strike / Dip Direction</strong> rotates the plane horizontally (with an indication notice first).
                      </>
                    )}
                  </p>

                  {/* Live Crown/Surface Strike / Dip Direction Slider (0° - 359°) — gated by Indication Modal */}
                  <div className="space-y-1.5 bg-slate-900/90 p-2.5 rounded-lg border border-cyan-500/25">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-200">
                        {isSurfaceMapping ? 'Surface' : 'Crown'} Strike / Dip Direction (Rotates Plane):
                      </span>
                      <span className="font-mono font-black text-cyan-400 bg-cyan-950/90 px-2 py-0.5 rounded border border-cyan-500/50 text-xs shadow-sm">
                        {String(dipDirection ?? 135).padStart(3, '0')}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={359}
                      value={dipDirection ?? 135}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        handleRequestDipDirectionOrStrikeChange(val);
                      }}
                      className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                    />
                    <div className="flex items-center justify-between gap-1 pt-0.5">
                      {[
                        { d: 0, label: '000° FWD' },
                        { d: 90, label: '090° R' },
                        { d: 180, label: '180° BACK' },
                        { d: 270, label: '270° L' },
                      ].map((btn) => (
                        <button
                          key={btn.d}
                          type="button"
                          onClick={() => handleRequestDipDirectionOrStrikeChange(btn.d)}
                          className={`flex-1 py-0.5 rounded text-[9px] font-mono cursor-pointer border ${
                            (dipDirection ?? 135) === btn.d
                              ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-bold'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live Crown Dip Amount Slider (1° - 90°) */}
                  <div className="space-y-1.5 bg-slate-900/90 p-2.5 rounded-lg border border-sky-500/20">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-200">
                        Dip Amount Around Strike Trace Hinge (δ):
                      </span>
                      <span className="font-mono font-black text-sky-400 bg-sky-950/90 px-2 py-0.5 rounded border border-sky-500/50 text-xs shadow-sm">
                        {dipAmount ?? hingeDipDeg}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={90}
                      value={dipAmount ?? hingeDipDeg}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setHingeDipDeg(val);
                        setDipAmount(val);
                      }}
                      className="w-full accent-sky-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                    />
                    {/* Quick Preset Angles */}
                    <div className="flex items-center justify-between gap-1 pt-1">
                      {[90, 80, 70, 60, 45, 30].map((deg) => (
                        <button
                          key={deg}
                          type="button"
                          onClick={() => {
                            setHingeDipDeg(deg);
                            setDipAmount(deg);
                          }}
                          className={`flex-1 py-1 rounded text-[9.5px] font-mono cursor-pointer border transition-all ${
                            (dipAmount ?? hingeDipDeg) === deg
                              ? 'bg-sky-500 text-slate-950 border-sky-300 font-bold shadow-sm'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {deg}°
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live Derived Orientation */}
                  <div className="p-2 rounded bg-slate-800/90 border border-slate-700/80 shadow-md flex items-center justify-between text-[10px] font-mono">
                    <div>
                      <span className="text-slate-400">Dip Amount: </span>
                      <strong className="text-sky-400 font-bold">{dipAmount ?? hingeDipDeg}°</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Dip Dir: </span>
                      <strong className="text-cyan-400 font-bold">
                        {String(dipDirection ?? 135).padStart(3, '0')}°
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Strike (RHR): </span>
                      <strong className="text-emerald-400 font-bold">
                        {strikeInfo.strikeRhrDeg}°
                      </strong>
                    </div>
                  </div>

                  {/* Two Canvas Sync Options directly inside Crown Inspector Card */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSaveInspection('TEXT_ONLY')}
                      className="py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-[10px] font-black cursor-pointer shadow"
                    >
                      Change Text Only on Canvas
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveInspection('ALIGN_TRACE')}
                      className="py-1.5 px-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-[10px] font-black cursor-pointer shadow"
                    >
                      Change Trace Alignment
                    </button>
                  </div>

                  {/* Optional Strike Lock Toggle */}
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 cursor-pointer pt-0.5 text-[9.5px] text-slate-400 hover:text-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={isStrikeLineHingeLocked}
                      onChange={(e) => {
                        e.stopPropagation();
                        setIsStrikeLineHingeLocked(e.target.checked);
                      }}
                      className="accent-sky-500 rounded cursor-pointer"
                    />
                    <span>Lock initial chord strike angle (optional)</span>
                  </label>
                </div>
              )}

              {/* Standard Inputs (shown if hinge rotation is manually deactivated) */}
              {!isHingeRotationActive && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <NumericStepperInput
                      label="Dip Direction (α)"
                      value={dipDirection ?? 135}
                      min={0}
                      max={359}
                      step={1}
                      unit="°"
                      isCircular={true}
                      isLight={isLight}
                      onChange={(val) => setDipDirection(val)}
                    />
                    <input
                      type="range"
                      min="0"
                      max="359"
                      value={dipDirection ?? 135}
                      onChange={(e) => setDipDirection(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    {/* Quick Preset Buttons in Tunnel Coordinates */}
                    <div className="flex items-center justify-between gap-1 pt-0.5">
                      {[
                        { d: 0, label: 'FWD' },
                        { d: 90, label: 'R' },
                        { d: 180, label: 'BACK' },
                        { d: 270, label: 'L' },
                      ].map((btn) => (
                        <button
                          key={btn.d}
                          type="button"
                          onClick={() => setDipDirection(btn.d)}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono cursor-pointer border ${
                            (dipDirection ?? 135) === btn.d
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <NumericStepperInput
                      label="Dip Angle (δ)"
                      value={dipAmount ?? 60}
                      min={currentJoint.panel === 'crown' ? 1 : 0}
                      max={90}
                      step={1}
                      unit="°"
                      isLight={isLight}
                      onChange={(val) => {
                        const clamped = currentJoint.panel === 'crown' ? Math.max(1, Math.min(90, val)) : val;
                        setDipAmount(clamped);
                        setHingeDipDeg(clamped);
                      }}
                    />
                    <input
                      type="range"
                      min={currentJoint.panel === 'crown' ? 1 : 0}
                      max={90}
                      value={dipAmount ?? 60}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const clamped = currentJoint.panel === 'crown' ? Math.max(1, Math.min(90, val)) : val;
                        setDipAmount(clamped);
                        setHingeDipDeg(clamped);
                      }}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    {/* Quick Preset Angles */}
                    <div className="flex items-center justify-between gap-1 pt-0.5">
                      {(currentJoint.panel === 'crown' ? [90, 80, 70, 60, 45, 30] : [90, 75, 60, 45, 30, 0]).map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => {
                            setDipAmount(a);
                            setHingeDipDeg(a);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono cursor-pointer border transition-all ${
                            (dipAmount ?? 60) === a
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-sm'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {a === 90 ? '90°' : `${a}°`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Re-enable Trace Hinge Lock */}
                  <div className="col-span-2 pt-2 border-t border-slate-700/60">
                    <label
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 cursor-pointer text-[9.5px] text-slate-400 hover:text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={isHingeRotationActive}
                        onChange={(e) => {
                          e.stopPropagation();
                          setIsHingeRotationActive(e.target.checked);
                        }}
                        className="accent-amber-500 rounded cursor-pointer"
                      />
                      <span>
                        Lock 3D orientation strictly to mapped trace on{' '}
                        {isSurfaceMapping ? getPortionShort(currentJoint.panel) : currentJoint.panel.replace('_', ' ')} (Trace Hinge Mode)
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Crown / Berm Joint 3D Orientation & Dip Control (Strike-Derived) */}
              {currentJoint.panel === 'crown' && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-amber-300">
                        {isSurfaceMapping ? `${domainPanelMap.crown.shortLabel} Strike Axis:` : 'Crown Strike Axis:'}
                      </span>
                      <span className="font-mono font-black text-amber-400 bg-amber-950/70 px-1.5 py-0.5 rounded border border-amber-600/40">
                        {strikeInfo.strikePairLabel}
                      </span>
                    </div>
                    {dipAmount === 90 ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 text-[9.5px]">
                        Ideal 90° Dip to Strike
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 text-[9.5px]">
                        Inclined {dipAmount}° Dip to Strike
                      </span>
                    )}
                  </div>

                  {/* Dipping Direction Buttons */}
                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDipAmount(90);
                        setHingeDipDeg(90);
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                        dipAmount === 90
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm shadow-emerald-950'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                    >
                      90° Ideal Dip
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHingeDipSide('heading');
                        const s = hingePlaneResult?.strikeRhrDeg ?? strikeInfo.strikeRhrDeg;
                        setDipDirection((s + 90) % 360);
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                        hingeDipSide === 'heading'
                          ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-sm'
                          : 'bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border-slate-700'
                      }`}
                    >
                      Dip +90° to Strike
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHingeDipSide('collar');
                        const s = hingePlaneResult?.strikeRhrDeg ?? strikeInfo.strikeRhrDeg;
                        setDipDirection((s - 90 + 360) % 360);
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                        hingeDipSide === 'collar'
                          ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-sm'
                          : 'bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border-slate-700'
                      }`}
                    >
                      Dip -90° to Strike
                    </button>
                  </div>

                  {/* Crown Dip Amount Choices */}
                  <div className="space-y-1 pt-1.5 border-t border-amber-500/20">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">Dip Amount Relative to Strike (Ideal 90°):</span>
                      <span className="font-mono font-bold text-amber-300">{dipAmount}°</span>
                    </div>
                    <div className="grid grid-cols-6 gap-1">
                      {[90, 80, 70, 60, 45, 30].map((deg) => (
                        <button
                          key={deg}
                          type="button"
                          onClick={() => {
                            setDipAmount(deg);
                            setHingeDipDeg(deg);
                          }}
                          className={`py-1 rounded text-[9.5px] font-mono cursor-pointer border transition-all ${
                            dipAmount === deg
                              ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold shadow-sm'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {deg === 90 ? '90° (Ideal)' : `${deg}°`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 3D Plane Extent & Rockmass Extension Controls */}
              <div className="p-3 rounded-lg bg-slate-800/90 border border-slate-700/80 shadow-md space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>3D Plane Mode:</span>
                  </span>
                  <span className="font-mono font-bold text-emerald-400 text-[10px]">
                    {planeDisplayMode === 'TRACED_LENGTH'
                      ? `Traced Length (${currentTraceLengthM}m)`
                      : planeDisplayMode === 'EXTENDED'
                      ? `Full Extended (${planeExtensionM}m)`
                      : isSurfaceMapping
                      ? 'Clipped to Exposure'
                      : 'Clipped to Tunnel'}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPlaneDisplayMode('TRACED_LENGTH')}
                    className={`py-1.5 px-2.5 rounded text-[10.5px] font-bold cursor-pointer transition-all border flex items-center justify-between ${
                      planeDisplayMode === 'TRACED_LENGTH'
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm shadow-emerald-950'
                        : 'bg-slate-900 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                  >
                    <span>Traced 2D Joint Length Plane</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/25">
                      {currentTraceLengthM}m
                    </span>
                  </button>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPlaneDisplayMode('EXTENDED')}
                      className={`py-1 px-2 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                        planeDisplayMode === 'EXTENDED'
                          ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm shadow-cyan-950'
                          : 'bg-slate-900 hover:bg-slate-700 text-slate-300 border-slate-700'
                      }`}
                    >
                      Full Extended (Current)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlaneDisplayMode('CLIPPED')}
                      className={`py-1 px-2 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                        planeDisplayMode === 'CLIPPED'
                          ? 'bg-amber-600 text-white border-amber-400 shadow-sm shadow-amber-950'
                          : 'bg-slate-900 hover:bg-slate-700 text-slate-300 border-slate-700'
                      }`}
                    >
                      {isSurfaceMapping ? 'Clipped to Exposure Box' : 'Clipped to Tunnel Box'}
                    </button>
                  </div>
                </div>
                {planeDisplayMode === 'TRACED_LENGTH' && (
                  <div className="space-y-1 pt-1 border-t border-slate-700/80">
                    <div className="flex items-center justify-between text-[9.5px] text-slate-400">
                      <span>Dip Depth Profile (Along Dip Vector):</span>
                      <span className="font-mono text-emerald-300 font-bold">{currentTraceLengthM}m Trace</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          { id: 'MATCH_TRACE', label: '1:1 Square' },
                          { id: 'ONE_SIDED', label: 'Into Rock' },
                          { id: 'HALF_TRACE', label: 'Slim Band' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setTracedPlaneDepthMode(opt.id)}
                          className={`py-0.5 rounded text-[9.5px] font-mono cursor-pointer border transition-all ${
                            tracedPlaneDepthMode === opt.id
                              ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-bold shadow-sm'
                              : 'bg-slate-900 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {planeDisplayMode === 'EXTENDED' && (
                  <div className="space-y-1 pt-1 border-t border-slate-700/80">
                    <div className="flex items-center justify-between text-[9.5px] text-slate-400">
                      <span>Extension Radius from Cut Line:</span>
                      <span className="font-mono text-cyan-300 font-bold">{planeExtensionM}m</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {[8, 12, 16, 20].map((dist) => (
                        <button
                          key={dist}
                          type="button"
                          onClick={() => setPlaneExtensionM(dist)}
                          className={`py-0.5 rounded text-[9.5px] font-mono cursor-pointer border transition-all ${
                            planeExtensionM === dist
                              ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-bold shadow-sm'
                              : 'bg-slate-900 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {dist}m
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Strike Axis */}
              <div className="p-2.5 rounded-lg bg-slate-800/90 border border-slate-700/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Strike Axis:</span>
                <strong className="text-amber-400 font-mono">{strikeInfo.strikePairLabel}</strong>
              </div>

              {/* Source & Joint Set Assignment */}
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div>
                  <label className="text-slate-400 block mb-1">Joint Set:</label>
                  <select
                    value={jointSetId}
                    onChange={(e) => setJointSetId(e.target.value as FieldJointGroupingId)}
                    className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700 text-amber-300 font-bold text-xs"
                  >
                    {[
                      'unassigned',
                      'J1',
                      'J2',
                      'J3',
                      'J4',
                      'J5',
                      'J-Bedding',
                      'J-Random',
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s === 'unassigned' ? 'Unassigned (J)' : s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Measurement Source:</label>
                  <select
                    value={measurementSource}
                    onChange={(e) => setMeasurementSource(e.target.value as any)}
                    className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-200 text-xs"
                  >
                    <option value="MANUAL_COMPASS">Compass &amp; Inclinometer</option>
                    <option value="GEOMETRIC_FIT">Polyline Geometry Fit</option>
                    <option value="PHOTOGRAMMETRY_MULTIVIEW">Multi-View 3D Triangulation</option>
                  </select>
                </div>
              </div>
            </div>

            {/* WHERE THIS PLANE CUTS THE EXCAVATION / EXPOSURE */}
            <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700/80 shadow-md space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-700/70 pb-1.5">
                <span className="font-bold text-amber-400 uppercase flex items-center gap-1.5 text-xs">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>
                    {tunnelGeometry.isVerticalShaft
                      ? 'Where Plane Cuts Vertical Shaft Quadrants'
                      : isSurfaceMapping
                      ? `Where Plane Cuts ${domainPanelMap.domainTitle}`
                      : 'Where Plane Cuts Tunnel'}
                  </span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">
                  Total Cut: {surfaceIntersections.totalCalculatedM}m
                </span>
              </div>

              {/* Status for each configured surface */}
              <div className="space-y-1.5 text-[11px] font-mono">
                {/* 1. Face */}
                <div className={`p-2 rounded-lg border flex items-center justify-between ${
                  surfaceIntersections.face
                    ? 'bg-cyan-950/40 border-cyan-700/60 text-cyan-200'
                    : 'bg-slate-900 border-slate-700/70 text-slate-500'
                }`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{surfaceIntersections.face ? '✅' : '—'}</span>
                    <strong className={surfaceIntersections.face ? 'text-white' : 'text-slate-400'}>
                      {tunnelGeometry.isVerticalShaft
                        ? 'Shaft Face (ØD):'
                        : isSurfaceMapping
                        ? `${domainPanelMap.face.shortLabel}:`
                        : 'Excavation Face:'}
                    </strong>
                  </div>
                  <span className="font-bold">
                    {surfaceIntersections.face
                      ? `Cuts ${isSurfaceMapping ? domainPanelMap.face.shortLabel : 'Face'} (${surfaceIntersections.face.lengthM}m)`
                      : 'Does not cut'}
                  </span>
                </div>

                {/* 2. Crown Arch / Berm / Trench Floor (only if configured) */}
                {tunnelGeometry.hasCrown !== false && (
                  <div className={`p-2 rounded-lg border flex items-center justify-between ${
                    surfaceIntersections.crown
                      ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                      : 'bg-slate-900 border-slate-700/70 text-slate-500'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{surfaceIntersections.crown ? '✅' : '—'}</span>
                      <strong className={surfaceIntersections.crown ? 'text-white' : 'text-slate-400'}>
                        {tunnelGeometry.isVerticalShaft
                          ? 'Q2: EAST-SOUTH (90°–180°):'
                          : isSurfaceMapping
                          ? `${domainPanelMap.crown.shortLabel}:`
                          : 'Crown Arch:'}
                      </strong>
                    </div>
                    <span className="font-bold">
                      {surfaceIntersections.crown
                        ? `Cuts ${
                            tunnelGeometry.isVerticalShaft
                              ? 'ES (90°–180°)'
                              : isSurfaceMapping
                              ? domainPanelMap.crown.shortLabel
                              : 'Crown'
                          } (${surfaceIntersections.crown.lengthM}m)`
                        : 'Does not cut'}
                    </span>
                  </div>
                )}

                {/* 3. Left Wall / Q1 NE (only if configured) */}
                {tunnelGeometry.hasLeftWall !== false && (
                  <div className={`p-2 rounded-lg border flex items-center justify-between ${
                    surfaceIntersections.leftWall
                      ? 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                      : 'bg-slate-900 border-slate-700/70 text-slate-500'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{surfaceIntersections.leftWall ? '✅' : '—'}</span>
                      <strong className={surfaceIntersections.leftWall ? 'text-white' : 'text-slate-400'}>
                        {tunnelGeometry.isVerticalShaft
                          ? 'Q1: NORTH-EAST (0°–90°):'
                          : isSurfaceMapping
                          ? `${domainPanelMap.leftWall.shortLabel}:`
                          : 'Left Sidewall:'}
                      </strong>
                    </div>
                    <span className="font-bold">
                      {surfaceIntersections.leftWall
                        ? `Cuts ${
                            tunnelGeometry.isVerticalShaft
                              ? 'NE (0°–90°)'
                              : isSurfaceMapping
                              ? domainPanelMap.leftWall.shortLabel
                              : 'Left Wall'
                          } (${surfaceIntersections.leftWall.lengthM}m)`
                        : 'Does not cut'}
                    </span>
                  </div>
                )}

                {/* 4. Right Wall / Q3 SW (only if configured) */}
                {tunnelGeometry.hasRightWall !== false && (
                  <div className={`p-2 rounded-lg border flex items-center justify-between ${
                    surfaceIntersections.rightWall
                      ? 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                      : 'bg-slate-900 border-slate-700/70 text-slate-500'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{surfaceIntersections.rightWall ? '✅' : '—'}</span>
                      <strong className={surfaceIntersections.rightWall ? 'text-white' : 'text-slate-400'}>
                        {tunnelGeometry.isVerticalShaft
                          ? 'Q3 SW (180°–270°) / Q4 WN (270°–360°):'
                          : isSurfaceMapping
                          ? `${domainPanelMap.rightWall.shortLabel}:`
                          : 'Right Sidewall:'}
                      </strong>
                    </div>
                    <span className="font-bold">
                      {surfaceIntersections.rightWall
                        ? `Cuts ${
                            tunnelGeometry.isVerticalShaft
                              ? 'SW / WN'
                              : isSurfaceMapping
                              ? domainPanelMap.rightWall.shortLabel
                              : 'Right Wall'
                          } (${surfaceIntersections.rightWall.lengthM}m)`
                        : 'Does not cut'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* TRUE DIP VS. SURFACE APPARENT DIPS MATRIX */}
            <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700/80 shadow-md space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5">
                <span className="font-bold text-amber-400 uppercase flex items-center gap-1.5 text-xs">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <span>True Dip vs. Surface Apparent Dips</span>
                </span>
                <span className="text-[10px] text-cyan-300 font-mono font-bold">
                  {isSurfaceMapping ? 'Bearing' : 'Heading'} N {Math.round(tunnelGeometry.driveAzimuthDeg ?? 0)}° E
                </span>
              </div>

              {/* Surface-by-surface Apparent Dip Breakdown (only configured portions) */}
              <div className="space-y-1.5 text-[11px] font-mono">
                {/* 1. Face */}
                <div className="p-2.5 rounded-lg bg-slate-800/90 border border-slate-700/80 shadow-md flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <strong className="text-cyan-400">
                        {tunnelGeometry.isVerticalShaft
                          ? 'Shaft Bottom Face (Pull 0m)'
                          : isSurfaceMapping
                          ? domainPanelMap.face.shortLabel
                          : 'Excavation Face'}
                      </strong>
                      <span className="text-[9.5px] text-slate-500 font-sans">
                        {tunnelGeometry.isVerticalShaft
                          ? '(Horizontal Bowl Bottom · 1m N→S Ref)'
                          : isSurfaceMapping
                          ? `(${tunnelGeometry.widthM}m × ${tunnelGeometry.heightM}m)`
                          : '(Transverse, 90° to Drive)'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-300 mt-0.5">
                      {apparentMatrix.face.apparentDipDirectionLabel}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black font-mono text-amber-300">
                      {apparentMatrix.face.apparentDipDeg}°
                    </span>
                    <span
                      className={`block text-[9px] font-bold ${
                        apparentMatrix.face.isTrueDip
                          ? 'text-emerald-400'
                          : apparentMatrix.face.isHorizontal
                          ? 'text-slate-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {apparentMatrix.face.isTrueDip
                        ? 'TRUE DIP'
                        : apparentMatrix.face.isHorizontal
                        ? 'HORIZONTAL'
                        : 'APPARENT DIP'}
                    </span>
                  </div>
                </div>

                {/* 2. Left Wall / 1. NE Wall (only if configured) */}
                {tunnelGeometry.hasLeftWall !== false && (
                  <div className="p-2.5 rounded-lg bg-slate-800/90 border border-slate-700/80 shadow-md flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-slate-300">
                          {tunnelGeometry.isVerticalShaft
                            ? '1. NE Wall (0°–90°)'
                            : isSurfaceMapping
                            ? domainPanelMap.leftWall.shortLabel
                            : 'Left Sidewall'}
                        </strong>
                        <span className="text-[9.5px] text-slate-500 font-sans">
                          {tunnelGeometry.isVerticalShaft
                            ? '(Nearest: 4. WN ◀ | ▶ 2. ES)'
                            : isSurfaceMapping
                            ? '(Longitudinal Exposure)'
                            : '(Longitudinal, 0° to Drive)'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-300 mt-0.5">
                        {apparentMatrix.leftWall.apparentDipDirectionLabel}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black font-mono text-amber-300">
                        {apparentMatrix.leftWall.apparentDipDeg}°
                      </span>
                      <span
                        className={`block text-[9px] font-bold ${
                          apparentMatrix.leftWall.isTrueDip
                            ? 'text-emerald-400'
                            : apparentMatrix.leftWall.isHorizontal
                            ? 'text-slate-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {apparentMatrix.leftWall.isTrueDip
                          ? 'TRUE DIP'
                          : apparentMatrix.leftWall.isHorizontal
                          ? 'HORIZONTAL'
                          : 'APPARENT DIP'}
                      </span>
                    </div>
                  </div>
                )}

                {/* 3. Right Wall / 3. SW Wall (only if configured) */}
                {tunnelGeometry.hasRightWall !== false && (
                  <div className="p-2.5 rounded-lg bg-slate-800/90 border border-slate-700/80 shadow-md flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-slate-300">
                          {tunnelGeometry.isVerticalShaft
                            ? '3. SW Wall (180°–270°)'
                            : isSurfaceMapping
                            ? domainPanelMap.rightWall.shortLabel
                            : 'Right Sidewall'}
                        </strong>
                        <span className="text-[9.5px] text-slate-500 font-sans">
                          {tunnelGeometry.isVerticalShaft
                            ? '(Nearest: 2. ES ◀ | ▶ 4. WN)'
                            : isSurfaceMapping
                            ? '(Longitudinal Exposure)'
                            : '(Longitudinal, 0° to Drive)'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-300 mt-0.5">
                        {apparentMatrix.rightWall.apparentDipDirectionLabel}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black font-mono text-amber-300">
                        {apparentMatrix.rightWall.apparentDipDeg}°
                      </span>
                      <span
                        className={`block text-[9px] font-bold ${
                          apparentMatrix.rightWall.isTrueDip
                            ? 'text-emerald-400'
                            : apparentMatrix.rightWall.isHorizontal
                            ? 'text-slate-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {apparentMatrix.rightWall.isTrueDip
                          ? 'TRUE DIP'
                          : apparentMatrix.rightWall.isHorizontal
                          ? 'HORIZONTAL'
                          : 'APPARENT DIP'}
                      </span>
                    </div>
                  </div>
                )}

                {/* 4. Crown / Berm / Trench Floor (only if configured) */}
                {tunnelGeometry.hasCrown !== false && (
                  <div className="p-2.5 rounded-lg bg-slate-800/90 border border-slate-700/80 shadow-md flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-sky-300">
                          {tunnelGeometry.isVerticalShaft
                            ? '2. ES Wall (90°–180°)'
                            : isSurfaceMapping
                            ? domainPanelMap.crown.shortLabel
                            : 'Crown Arch / Back'}
                        </strong>
                        <span className="text-[9.5px] text-slate-500 font-sans">
                          {tunnelGeometry.isVerticalShaft
                            ? '(Nearest: 1. NE ◀ | ▶ 3. SW)'
                            : isSurfaceMapping
                            ? '(Horizontal Plan Surface)'
                            : '(Horizontal Apex Tangent)'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-300 mt-0.5">
                        {apparentMatrix.crown.apparentDipDirectionLabel}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black font-mono text-sky-400">
                        {Math.round(apparentMatrix.strikeRhrDeg)}°
                      </span>
                      <span className="block text-[9px] font-bold text-sky-400">
                        STRIKE TRACE
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Surface Trace Lengths & Extent Audit */}
            <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700/80 shadow-md space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5">
                <span className="font-bold text-cyan-400 uppercase flex items-center gap-1.5">
                  <Activity className="w-4 h-4" />
                  <span>Surface Trace Lengths &amp; Extent (m)</span>
                </span>
                <span className="text-[10px] text-slate-400">Metric Calibration</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2 rounded-lg bg-slate-800/90 border border-slate-700/80 shadow-md text-center">
                  <span className="text-[10px] text-slate-400 block">
                    {tunnelGeometry.isVerticalShaft
                      ? 'Bottom Face (m)'
                      : isSurfaceMapping
                      ? `${domainPanelMap.face.shortLabel} (m)`
                      : 'Face (m)'}
                  </span>
                  <strong className="text-amber-300 text-sm font-mono">
                    {observedLengths.faceM > 0 ? `${observedLengths.faceM}m` : '—'}
                  </strong>
                </div>
                {tunnelGeometry.hasLeftWall !== false && (
                  <div className="p-2 rounded-lg bg-slate-800/90 border border-slate-700/80 shadow-md text-center">
                    <span className="text-[10px] text-slate-400 block">
                      {tunnelGeometry.isVerticalShaft
                        ? '1. NE Wall (m)'
                        : isSurfaceMapping
                        ? `${domainPanelMap.leftWall.shortLabel} (m)`
                        : 'Left Wall (m)'}
                    </span>
                    <strong className="text-amber-300 text-sm font-mono">
                      {observedLengths.leftWallM > 0 ? `${observedLengths.leftWallM}m` : '—'}
                    </strong>
                  </div>
                )}
                {tunnelGeometry.hasRightWall !== false && (
                  <div className="p-2 rounded-lg bg-slate-800/90 border border-slate-700/80 shadow-md text-center">
                    <span className="text-[10px] text-slate-400 block">
                      {tunnelGeometry.isVerticalShaft
                        ? '3. SW Wall (m)'
                        : isSurfaceMapping
                        ? `${domainPanelMap.rightWall.shortLabel} (m)`
                        : 'Right Wall (m)'}
                    </span>
                    <strong className="text-amber-300 text-sm font-mono">
                      {observedLengths.rightWallM > 0 ? `${observedLengths.rightWallM}m` : '—'}
                    </strong>
                  </div>
                )}
                {tunnelGeometry.hasCrown !== false && (
                  <div className="p-2 rounded-lg bg-slate-800/90 border border-slate-700/80 shadow-md text-center">
                    <span className="text-[10px] text-slate-400 block">
                      {tunnelGeometry.isVerticalShaft
                        ? '2. ES Wall (m)'
                        : isSurfaceMapping
                        ? `${domainPanelMap.crown.shortLabel} (m)`
                        : 'Crown (m)'}
                    </span>
                    <strong className="text-amber-300 text-sm font-mono">
                      {observedLengths.crownM > 0 ? `${observedLengths.crownM}m` : '—'}
                    </strong>
                  </div>
                )}
              </div>

              <div className="p-2.5 rounded-lg bg-slate-800/90 border border-slate-700/80 shadow-md space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold">Total Confirmed Visible Extent:</span>
                  <strong className="text-emerald-400 font-mono text-sm">
                    {observedLengths.totalObservedM} meters
                  </strong>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Calculated Surface Intersection Length:</span>
                  <strong className="text-cyan-400 font-mono">
                    {surfaceIntersections.totalCalculatedM} meters
                  </strong>
                </div>
              </div>
            </div>

            {/* QUICK NAVIGATION / JUMP TO TOP HELPER */}
            <div className="pt-2 pb-6 flex justify-center">
              <button
                type="button"
                onClick={scrollToAsideTop}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 hover:border-amber-400/60 transition-all cursor-pointer flex items-center gap-2 font-mono text-xs font-bold shadow-lg active:scale-95"
                title="Scroll back to top of audit parameters"
              >
                <ArrowUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Jump to Top ↑</span>
              </button>
            </div>
          </aside>
        )}

          {/* ---------------------------------------------------------------
              RIGHT PANEL: PURE WHITE 3D CAD VIEWPORT & REAL-TIME COMPASS
              --------------------------------------------------------------- */}
          <main
            className={`${
              isVerticalMode
                ? verticalCanvasPosition === 'top'
                  ? 'order-1'
                  : 'order-2'
                : 'order-2 lg:order-2'
            } ${
              viewLayoutMode === 'PARAMS'
                ? 'hidden'
                : viewLayoutMode === 'CANVAS'
                ? 'flex-1 h-full w-full'
                : isVerticalMode
                ? 'h-[46vh] sm:h-[48vh] min-h-[220px] w-full flex-none'
                : 'flex-1 h-full min-w-0'
            } flex flex-col overflow-hidden relative transition-colors ${
              isLight ? 'bg-slate-100' : 'bg-slate-900'
            }`}
          >
            {/* View Switcher Bar */}
            <div
              className={`flex-none px-3 py-2 flex flex-wrap items-center justify-between gap-2 border-b z-10 transition-colors ${
                isLight ? 'bg-white/95 border-slate-200' : 'bg-slate-900 border-slate-700/80 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-2">
                {isAsideCollapsed && (
                  <button
                    type="button"
                    onClick={() => setIsAsideCollapsed(false)}
                    className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-colors shrink-0"
                    title="Expand Parameters & Audit Sidebar"
                  >
                    <PanelLeftOpen className="w-3.5 h-3.5" />
                    <span>Show Parameters</span>
                  </button>
                )}
                {viewLayoutMode === 'CANVAS' && (
                  <button
                    type="button"
                    onClick={() => setViewLayoutMode('SPLIT')}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-colors shrink-0"
                    title="Switch to Split View (Show Parameters & 3D)"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Split (Show Parameters)</span>
                  </button>
                )}
                <div
                  className={`flex items-center gap-1 p-1 rounded-xl font-mono text-xs font-bold border transition-colors ${
                    isLight ? 'bg-slate-100 border-slate-300' : 'bg-slate-800/90 border-slate-700/80'
                  }`}
                >
                {[
                  {
                    id: 'VIEW_3D' as InspectionViewTab,
                    label: tunnelGeometry.isVerticalShaft
                      ? '1. 3D Shaft Bowl View'
                      : isSurfaceMapping
                      ? `1. 3D ${getPortionShort(activePortionPanel)} View`
                      : '1. 3D Tunnel View',
                  },
                  {
                    id: 'VIEW_UNROLLED_COMBINED' as InspectionViewTab,
                    label: tunnelGeometry.isVerticalShaft
                      ? '2. Unrolled 2D Shaft Quadrant View'
                      : isSurfaceMapping
                      ? '2. Unrolled 2D Portion Developed View'
                      : '2. Unrolled 2D Developed View',
                  },
                ].map((t) => {
                  const isAct = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTab(t.id)}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        isAct
                          ? 'bg-amber-500 text-slate-950 font-black shadow'
                          : isLight
                          ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

              {/* 3D Camera Controls, Compass Toggle, Plot Plane Toggle & Legend */}
              {activeTab === 'VIEW_3D' && (
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                  {/* COMPASS OPTION LOGO BUTTON */}
                  <button
                    type="button"
                    onClick={() => setShowCompass(!showCompass)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      showCompass
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow font-black'
                        : isLight
                        ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                    title={
                      isSurfaceMapping
                        ? 'Toggle Real-Time 3D Geological Compass synced with Exposure Dip Azimuth'
                        : 'Toggle Real-Time 3D Geological Compass synced with Tunnel Heading'
                    }
                  >
                    <Compass className={`w-3.5 h-3.5 ${showCompass ? 'animate-spin-slow' : ''}`} />
                    <span>{showCompass ? 'Compass: ON' : 'Compass: OFF'}</span>
                  </button>

                  {/* Toggle Interior Plane Mesh (Default: ON for vivid colored cut) */}
                  <button
                    type="button"
                    onClick={() => setShowInteriorPlane(!showInteriorPlane)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      showInteriorPlane
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow font-black'
                        : isLight
                        ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                    title="Toggle 3D Colored Joint Plane cut"
                  >
                    <Box className="w-3.5 h-3.5" />
                    <span>{showInteriorPlane ? 'Cutting Plane: ON' : 'Cutting Plane: OFF'}</span>
                  </button>

                  {/* Quick Toggle: Traced 2D Joint Length Plane vs Full Extended Plane (Current) */}
                  <div
                    className={`flex items-center rounded-lg p-0.5 border ${
                      isLight ? 'bg-slate-100 border-slate-300' : 'bg-slate-900 border-slate-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setPlaneDisplayMode('TRACED_LENGTH')}
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        planeDisplayMode === 'TRACED_LENGTH'
                          ? 'bg-emerald-500 text-slate-950 shadow font-black'
                          : isLight
                          ? 'text-slate-600 hover:text-slate-900'
                          : 'text-slate-300 hover:text-white'
                      }`}
                      title="Show 3D joint plane strictly matching the 2D traced joint length"
                    >
                      Traced Length ({currentTraceLengthM}m)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlaneDisplayMode('EXTENDED')}
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        planeDisplayMode === 'EXTENDED'
                          ? 'bg-cyan-500 text-slate-950 shadow font-black'
                          : isLight
                          ? 'text-slate-600 hover:text-slate-900'
                          : 'text-slate-300 hover:text-white'
                      }`}
                      title={
                        isSurfaceMapping
                          ? 'Show full extended cutting plane across the surface exposure'
                          : 'Show full extended cutting plane across the tunnel'
                      }
                    >
                      Full Plane (Current)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlaneDisplayMode('CLIPPED')}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        planeDisplayMode === 'CLIPPED'
                          ? 'bg-amber-500 text-slate-950 shadow font-black'
                          : isLight
                          ? 'text-slate-600 hover:text-slate-900'
                          : 'text-slate-300 hover:text-white'
                      }`}
                      title={
                        isSurfaceMapping
                          ? 'Show plane clipped to the mapped surface exposure bounding box'
                          : 'Show plane clipped to the tunnel bounding box'
                      }
                    >
                      Clipped
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowLegendOverlay(!showLegendOverlay)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border cursor-pointer font-bold transition-colors ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                    title="Toggle 3D reference labels and vector legend"
                  >
                    {showLegendOverlay ? <EyeOff className="w-3.5 h-3.5 text-amber-500" /> : <Eye className="w-3.5 h-3.5 text-cyan-500" />}
                    <span>{showLegendOverlay ? 'Hide 3D Labels' : 'Show 3D Labels'}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {(['ISO', 'FACE', 'PLAN', 'PROFILE', 'RIGHT'] as const).map((pr) => (
                      <button
                        key={pr}
                        type="button"
                        onClick={() => setCameraPreset(pr)}
                        className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors border ${
                          isLight
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        }`}
                      >
                        {pr}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={resetCameraTarget}
                      className={`p-1 rounded ml-0.5 cursor-pointer transition-colors border ${
                        isLight
                          ? 'bg-slate-100 hover:bg-slate-200 text-amber-700 border-slate-300'
                          : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                      }`}
                      title="Reset 3D camera and target"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Viewport Content */}
            <div className="flex-1 overflow-hidden relative bg-white">
              {/* TAB 1: THREE.JS 3D VIEWPORT WITH PURE WHITE BACKGROUND */}
              {activeTab === 'VIEW_3D' && (
                <div className="w-full h-full relative cursor-grab active:cursor-grabbing select-none touch-none">
                  {/* Clean Three.js WebGL Canvas Mount */}
                  <div ref={threeMountRef} className="w-full h-full touch-none" />

                  {/* COMPACT TOP-CENTER HEADING PILL */}
                  {(() => {
                    const thetaDeg = (cameraTheta * 180) / Math.PI;
                    const driveAngleDeg = ((-thetaDeg) % 360 + 360) % 360;
                    const driveAz = tunnelGeometry.driveAzimuthDeg || 0;

                    return (
                      <div
                        onClick={snapToTunnelDrive}
                        className={`absolute top-2.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full shadow-md pointer-events-auto cursor-pointer z-20 flex items-center gap-2 font-mono text-[11px] font-bold transition-colors border select-none ${
                          isLight
                            ? 'bg-white/95 border-slate-300 text-slate-800'
                            : 'bg-slate-950/95 border-slate-700 text-slate-100'
                        }`}
                        title="Click to align 3D view with heading"
                      >
                        <div
                          className="w-4 h-4 flex items-center justify-center"
                          style={{ transform: `rotate(${driveAngleDeg}deg)` }}
                        >
                          <Navigation className="w-3.5 h-3.5 text-cyan-500 fill-cyan-500/40" />
                        </div>
                        <span>
                          {tunnelGeometry.isVerticalShaft
                            ? `0° N REF · Ø${tunnelGeometry.widthM}m × ${tunnelGeometry.pullLengthM || 3}m Pull`
                            : isSurfaceMapping
                            ? `${getPortionShort(activePortionPanel).toUpperCase()} · N ${Math.round(driveAz)}° E · ${tunnelGeometry.widthM}×${tunnelGeometry.heightM}m`
                            : `DRIVE N ${Math.round(driveAz)}° E · ${tunnelGeometry.widthM}×${tunnelGeometry.heightM}m`}
                        </span>
                      </div>
                    );
                  })()}

                  {/* =========================================================
                      REAL-TIME SYNCHRONIZED 3D GEOLOGICAL COMPASS ROSE (DIAL)
                      ========================================================= */}
                  {showCompass && (() => {
                    const driveAz = tunnelGeometry.driveAzimuthDeg || 0;
                    const thetaDeg = (cameraTheta * 180) / Math.PI;
                    const northAngleDeg = (-driveAz - thetaDeg) % 360;
                    const driveAngleDeg = (-thetaDeg) % 360;

                    return (
                      <div className="absolute top-12 right-3 z-20 font-mono select-none">
                        <div className="p-2.5 rounded-2xl bg-slate-950/95 border border-cyan-500/40 shadow-2xl space-y-1.5 w-36 text-center text-xs">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                            <span className="font-bold text-[9.5px] text-cyan-300 uppercase flex items-center gap-1">
                              <Compass className="w-3 h-3 text-cyan-400" />
                              <span>Compass</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowCompass(false)}
                              className="p-0.5 rounded text-slate-500 hover:text-white cursor-pointer"
                              title="Hide Compass"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                            <svg viewBox="0 0 120 120" className="w-full h-full">
                              <circle cx="60" cy="60" r="54" fill="#0f172a" stroke="#334155" strokeWidth="2" />
                              <circle cx="60" cy="60" r="48" fill="#020617" stroke="#1e293b" strokeWidth="1" />
                              <g transform={`rotate(${northAngleDeg} 60 60)`}>
                                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                                  <line
                                    key={deg}
                                    x1="60"
                                    y1="14"
                                    x2="60"
                                    y2={deg % 90 === 0 ? "20" : "17"}
                                    stroke={deg === 0 ? "#f43f5e" : "#64748b"}
                                    strokeWidth={deg % 90 === 0 ? "2" : "1"}
                                    transform={`rotate(${deg} 60 60)`}
                                  />
                                ))}
                                <text x="60" y="27" fill="#f43f5e" fontSize="9" fontWeight="black" textAnchor="middle">N</text>
                                <text x="96" y="63" fill="#cbd5e1" fontSize="8" fontWeight="bold" textAnchor="middle">E</text>
                                <text x="60" y="100" fill="#cbd5e1" fontSize="8" fontWeight="bold" textAnchor="middle">S</text>
                                <text x="24" y="63" fill="#cbd5e1" fontSize="8" fontWeight="bold" textAnchor="middle">W</text>
                                <polygon points="60,18 64,55 56,55" fill="#f43f5e" />
                                <polygon points="60,102 64,65 56,65" fill="#94a3b8" />
                              </g>
                              <g transform={`rotate(${driveAngleDeg} 60 60)`}>
                                <line x1="60" y1="60" x2="60" y2="22" stroke="#06b6d4" strokeWidth="2.5" strokeDasharray="3,2" />
                                <polygon points="60,16 64,26 56,26" fill="#06b6d4" />
                              </g>
                              {/* Active Plane Dip Direction Vector Arrow (Amber) */}
                              <g transform={`rotate(${(northAngleDeg + (dipDirection ?? 135)) % 360} 60 60)`}>
                                <line x1="60" y1="60" x2="60" y2="20" stroke="#f59e0b" strokeWidth="2.6" />
                                <polygon points="60,14 64.5,24 55.5,24" fill="#f59e0b" />
                              </g>
                              <circle cx="60" cy="60" r="4.5" fill="#020617" stroke="#38bdf8" strokeWidth="2" />
                            </svg>
                          </div>

                          <div className="text-[8.5px] font-mono text-center text-amber-300 font-bold">
                            Dip Dir {String(dipDirection ?? 135).padStart(3, '0')}° / {dipAmount ?? 60}°
                          </div>

                          <div className="grid grid-cols-2 gap-1 pt-0.5">
                            <button
                              type="button"
                              onClick={snapToNorth}
                              className="px-1 py-0.5 rounded bg-slate-900 hover:bg-rose-500 hover:text-slate-950 text-rose-300 border border-rose-900/40 text-[8.5px] font-bold cursor-pointer transition-colors"
                            >
                              North
                            </button>
                            <button
                              type="button"
                              onClick={snapToTunnelDrive}
                              className="px-1 py-0.5 rounded bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 border border-cyan-900/40 text-[8.5px] font-bold cursor-pointer transition-colors"
                            >
                              Axis
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* SINGLE COMPACT BOTTOM STATUS PILL */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-slate-950/95 border border-amber-400/70 text-white shadow-lg flex items-center gap-2.5 font-mono text-[11px] z-20 select-none pointer-events-auto">
                    <span className="text-amber-400 font-black">
                      Dip {dipAmount ?? 60}° ({dipHalfCircleSense === 'inwards' ? 'Inwards' : 'Outwards'})
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-cyan-300 font-bold">
                      Dir {String(dipDirection ?? 135).padStart(3, '0')}°
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-300">
                      Strike {strikeInfo.strikePairLabel}
                    </span>
                  </div>

                  {/* OPTIONAL GEOLOGICAL VECTORS LEGEND OVERLAY (HIDDEN BY DEFAULT FOR CLEAN CANVAS) */}
                  {showLegendOverlay && (
                    <div className="absolute top-12 left-3 p-2.5 rounded-xl bg-slate-950/95 border border-slate-800 font-mono text-[10px] space-y-1 shadow-xl pointer-events-none z-10">
                      <div className="font-bold text-amber-400 uppercase text-[10.5px]">
                        3D Vectors &amp; Anchor
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: FIELD_JOINT_GROUP_COLORS[jointSetId]?.stroke || '#f59e0b' }} />
                        <span className="text-slate-100 font-bold">
                          {currentJoint.id} ({dipDirection}°/{dipAmount}° · L={currentTraceLengthM}m)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-0.5 bg-sky-500" />
                        <span className="text-sky-300">Strike ({strikeInfo.strikeRhrDeg}°)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-0.5 bg-amber-500" />
                        <span className="text-amber-300">Dip ({dipDirection}°)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-0.5 bg-emerald-500" />
                        <span className="text-emerald-300">Normal Vector</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TABS 2-5: 2D SURFACE PROJECTION VIEWS (Face, Left Wall, Right Wall, Crown) */}
              {activeTab !== 'VIEW_3D' && activeTab !== 'VIEW_UNROLLED_COMBINED' && (
                <div className="w-full h-full p-4 flex flex-col items-center justify-center font-mono bg-slate-950">
                  <div className="w-full max-w-2xl bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-sm text-cyan-300 uppercase">
                        {activeTab.replace('VIEW_', '').replace('_', ' ')} Projection Analysis
                      </span>
                      <span className="text-xs text-amber-400 font-bold">
                        {activeJoint.panel.toUpperCase() === activeTab.replace('VIEW_', '')
                          ? 'Observed Trace Surface'
                          : 'Intersecting Surface Projection'}
                      </span>
                    </div>

                    {/* SVG Cross-Section & Projected Line */}
                    <div className="w-full bg-slate-950 rounded-xl border border-slate-800 p-4 flex items-center justify-center">
                      <svg viewBox="0 0 500 350" className="w-full max-w-lg h-auto">
                        <rect x="50" y="30" width="400" height="280" rx="4" fill="#0b132b" stroke="#334155" strokeWidth="1.5" />

                        {activeTab === 'VIEW_FACE' && (() => {
                          const prof = buildTunnelCrossSectionProfileMetric(tunnelGeometry);
                          const wProf = Math.max(0.5, tunnelGeometry.widthM || 8.0);
                          const hProf = Math.max(0.5, tunnelGeometry.heightM || 6.5);
                          const polyStr = prof.points
                            .map((pt) => {
                              const sx = 50 + (pt.y / wProf) * 400;
                              const sy = 310 - (pt.z / hProf) * 280;
                              return `${sx.toFixed(1)},${sy.toFixed(1)}`;
                            })
                            .join(' ');
                          return prof.isClosed ? (
                            <polygon points={polyStr} fill="#1e293b" stroke="#0ea5e9" strokeWidth="2" />
                          ) : (
                            <polyline points={polyStr} fill="none" stroke="#0ea5e9" strokeWidth="2.5" />
                          );
                        })()}

                        {surfaceIntersections.face && activeTab === 'VIEW_FACE' && (
                          <g>
                            <line
                              x1={50 + (surfaceIntersections.face.p1.x / tunnelGeometry.widthM) * 400}
                              y1={310 - (surfaceIntersections.face.p1.y / tunnelGeometry.heightM) * 280}
                              x2={50 + (surfaceIntersections.face.p2.x / tunnelGeometry.widthM) * 400}
                              y2={310 - (surfaceIntersections.face.p2.y / tunnelGeometry.heightM) * 280}
                              stroke="#F59E0B"
                              strokeWidth="3"
                              strokeDasharray="6,4"
                            />
                            <text
                              x={50 + (surfaceIntersections.face.p1.x / tunnelGeometry.widthM) * 400 + 8}
                              y={310 - (surfaceIntersections.face.p1.y / tunnelGeometry.heightM) * 280}
                              fill="#F59E0B"
                              fontSize="11"
                              fontWeight="bold"
                            >
                              Calc Intersection ({surfaceIntersections.face.lengthM}m)
                            </text>
                          </g>
                        )}

                        {surfaceIntersections.leftWall && activeTab === 'VIEW_LEFT_WALL' && (
                          <line
                            x1={50 + (surfaceIntersections.leftWall.p1.x / tunnelGeometry.pullLengthM) * 400}
                            y1={310 - (surfaceIntersections.leftWall.p1.y / tunnelGeometry.wallHeightM) * 280}
                            x2={50 + (surfaceIntersections.leftWall.p2.x / tunnelGeometry.pullLengthM) * 400}
                            y2={310 - (surfaceIntersections.leftWall.p2.y / tunnelGeometry.wallHeightM) * 280}
                            stroke="#F59E0B"
                            strokeWidth="3"
                            strokeDasharray="6,4"
                          />
                        )}

                        {surfaceIntersections.rightWall && activeTab === 'VIEW_RIGHT_WALL' && (
                          <line
                            x1={50 + (surfaceIntersections.rightWall.p1.x / tunnelGeometry.pullLengthM) * 400}
                            y1={310 - (surfaceIntersections.rightWall.p1.y / tunnelGeometry.wallHeightM) * 280}
                            x2={50 + (surfaceIntersections.rightWall.p2.x / tunnelGeometry.pullLengthM) * 400}
                            y2={310 - (surfaceIntersections.rightWall.p2.y / tunnelGeometry.wallHeightM) * 280}
                            stroke="#F59E0B"
                            strokeWidth="3"
                            strokeDasharray="6,4"
                          />
                        )}

                        {activeJoint.panel.toUpperCase() === activeTab.replace('VIEW_', '') && activeJoint.points.length >= 2 && (
                          <polyline
                            points={activeJoint.points
                              .map((p) => `${50 + (p.x / 1000) * 400},${30 + (p.y / 800) * 280}`)
                              .join(' ')}
                            fill="none"
                            stroke="#38BDF8"
                            strokeWidth="4"
                          />
                        )}
                      </svg>
                    </div>

                    {/* Apparent vs True Dip Metrics for Active Surface Tab */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Observed Geological Trace:</span>
                        <strong className="text-cyan-400 text-sm">
                          {activeJoint.panel.toUpperCase() === activeTab.replace('VIEW_', '')
                            ? `${observedLengths.totalObservedM}m (Field)`
                            : 'None on this panel'}
                        </strong>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Visible Trace Angle:</span>
                        <strong className="text-amber-300 text-sm">
                          {activeTab === 'VIEW_FACE'
                            ? `${apparentMatrix.face.apparentDipDeg}° ${apparentMatrix.face.isTrueDip ? '(True Dip)' : '(Apparent Dip)'}`
                            : activeTab === 'VIEW_LEFT_WALL'
                            ? `${apparentMatrix.leftWall.apparentDipDeg}° ${apparentMatrix.leftWall.isTrueDip ? '(True Dip)' : '(Apparent Dip)'}`
                            : activeTab === 'VIEW_RIGHT_WALL'
                            ? `${apparentMatrix.rightWall.apparentDipDeg}° ${apparentMatrix.rightWall.isTrueDip ? '(True Dip)' : '(Apparent Dip)'}`
                            : `STRIKE ${Math.round(apparentMatrix.strikeRhrDeg)}°`}
                        </strong>
                        <span className="block text-[9.5px] text-slate-400">
                          {activeTab === 'VIEW_FACE'
                            ? apparentMatrix.face.apparentDipDirectionLabel
                            : activeTab === 'VIEW_LEFT_WALL'
                            ? apparentMatrix.leftWall.apparentDipDirectionLabel
                            : activeTab === 'VIEW_RIGHT_WALL'
                            ? apparentMatrix.rightWall.apparentDipDirectionLabel
                            : apparentMatrix.crown.apparentDipDirectionLabel}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Calculated Cut Length:</span>
                        <strong className="text-emerald-400 text-sm">
                          {activeTab === 'VIEW_FACE' && surfaceIntersections.face
                            ? `${surfaceIntersections.face.lengthM}m`
                            : activeTab === 'VIEW_LEFT_WALL' && surfaceIntersections.leftWall
                            ? `${surfaceIntersections.leftWall.lengthM}m`
                            : activeTab === 'VIEW_RIGHT_WALL' && surfaceIntersections.rightWall
                            ? `${surfaceIntersections.rightWall.lengthM}m`
                            : activeTab === 'VIEW_CROWN' && surfaceIntersections.crown
                            ? `${surfaceIntersections.crown.lengthM}m`
                            : 'No plane cut'}
                        </strong>
                      </div>
                    </div>

                    {/* Geotechnical Apparent vs True Dip Explanation Callout */}
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-cyan-800/60 text-[10.5px] text-cyan-200 leading-relaxed font-sans">
                      <div className="font-bold text-cyan-300 flex items-center gap-1.5 mb-1 font-mono text-xs">
                        <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>Why this trace appears this way on the {activeTab.replace('VIEW_', '').replace('_', ' ')}:</span>
                      </div>
                      <p>
                        {activeTab === 'VIEW_FACE'
                          ? apparentMatrix.face.geologicalNote
                          : activeTab === 'VIEW_LEFT_WALL'
                          ? apparentMatrix.leftWall.geologicalNote
                          : activeTab === 'VIEW_RIGHT_WALL'
                          ? apparentMatrix.rightWall.geologicalNote
                          : apparentMatrix.crown.geologicalNote}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: UNROLLED COMBINED VIEW (DEVELOPED 2D TUNNEL VIEW) */}
              {activeTab === 'VIEW_UNROLLED_COMBINED' && (
                <div className="w-full h-full p-4 overflow-y-auto space-y-4 font-mono bg-slate-950">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-sm text-cyan-300 uppercase">
                        {tunnelGeometry.isVerticalShaft
                          ? 'Developed 2D Vertical Shaft View (Horizontal Quadrant Walls: Pull 0m Bottom → Pull 3m Top + Bottom Face)'
                          : isSurfaceMapping
                          ? `Developed 2D ${domainPanelMap.domainTitle} View (${[
                              ...(tunnelGeometry.hasLeftWall !== false ? [domainPanelMap.leftWall.shortLabel] : []),
                              ...(tunnelGeometry.hasCrown !== false ? [domainPanelMap.crown.shortLabel] : []),
                              ...(tunnelGeometry.hasRightWall !== false ? [domainPanelMap.rightWall.shortLabel] : []),
                              domainPanelMap.face.shortLabel,
                            ].join(' + ')})`
                          : 'Developed 2D Tunnel View (Left Wall + Crown + Right Wall + Excavation Face)'}
                      </span>
                      <span className="text-xs text-amber-400 font-bold font-mono">
                        Joint {activeJoint.id} ({String(dipDirection).padStart(3, '0')}°/{dipAmount}° · {strikeInfo.strikePairLabel})
                      </span>
                    </div>

                    <div className="w-full bg-slate-950 rounded-xl border border-slate-800 p-4 overflow-x-auto">
                      <svg viewBox="0 0 940 280" className="w-full min-w-[780px] h-auto select-none">
                        {/* 1. LEFT WALL / 1. NE WALL */}
                        {tunnelGeometry.hasLeftWall !== false && (
                          <g>
                            <rect x="20" y="40" width="180" height="180" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
                            <text x="110" y="32" fill="#94a3b8" fontSize="10.5" fontWeight="bold" textAnchor="middle">
                              {tunnelGeometry.isVerticalShaft
                                ? `1. NE WALL (0°–90° · Pull 0..${tunnelGeometry.pullLengthM}m)`
                                : isSurfaceMapping
                                ? `1. ${domainPanelMap.leftWall.shortLabel.toUpperCase()} (0..${tunnelGeometry.pullLengthM}m)`
                                : `1. LEFT WALL (0..${tunnelGeometry.pullLengthM}m)`}
                            </text>
                            {/* Stationing ticks at 0m, 1m, 2m, pullL */}
                            <line x1="20" y1="220" x2="200" y2="220" stroke="#64748b" strokeWidth="1" />
                            <text x="20" y="235" fill="#64748b" fontSize="8.5" textAnchor="middle">
                              {tunnelGeometry.isVerticalShaft ? '◀ 4.WN (0°N)' : '0m'}
                            </text>
                            <text x="200" y="235" fill="#64748b" fontSize="8.5" textAnchor="middle">
                              {tunnelGeometry.isVerticalShaft ? '2.ES ▶ (90°E)' : `${tunnelGeometry.pullLengthM}m`}
                            </text>
                            <text x="110" y="248" fill="#64748b" fontSize="8.5" textAnchor="middle">
                              {tunnelGeometry.isVerticalShaft
                                ? 'Pull 0m Bottom → Pull Top'
                                : isSurfaceMapping
                                ? `${domainPanelMap.leftWall.shortLabel} Span`
                                : 'Drive Advance (+X)'}
                            </text>

                            {/* Observed traces on Left Wall */}
                            {allRoundJoints
                              .filter((j) => j.panel === 'left_wall' && j.points.length >= 2)
                              .map((j) => (
                                <polyline
                                  key={`unrolled-obs-lw-${j.id}`}
                                  points={j.points
                                    .map((p) => `${20 + (p.x / 1000) * 180},${220 - (p.y / 800) * 180}`)
                                    .join(' ')}
                                  fill="none"
                                  stroke={j.id === activeJoint.id ? '#38BDF8' : '#64748b'}
                                  strokeWidth={j.id === activeJoint.id ? '3.5' : '2'}
                                  strokeLinecap="round"
                                />
                              ))}

                            {/* Calculated Plane Intersection on Left Wall */}
                            {surfaceIntersections.leftWall && (
                              <g>
                                <line
                                  x1={20 + (surfaceIntersections.leftWall.p1.x / tunnelGeometry.pullLengthM) * 180}
                                  y1={220 - (surfaceIntersections.leftWall.p1.y / (tunnelGeometry.leftWallHeightM || tunnelGeometry.wallHeightM)) * 180}
                                  x2={20 + (surfaceIntersections.leftWall.p2.x / tunnelGeometry.pullLengthM) * 180}
                                  y2={220 - (surfaceIntersections.leftWall.p2.y / (tunnelGeometry.leftWallHeightM || tunnelGeometry.wallHeightM)) * 180}
                                  stroke="#F59E0B"
                                  strokeWidth="2.8"
                                  strokeDasharray="6,3"
                                />
                                <text
                                  x={20 + ((surfaceIntersections.leftWall.p1.x + surfaceIntersections.leftWall.p2.x) / (2 * tunnelGeometry.pullLengthM)) * 180}
                                  y={215 - ((surfaceIntersections.leftWall.p1.y + surfaceIntersections.leftWall.p2.y) / (2 * (tunnelGeometry.leftWallHeightM || tunnelGeometry.wallHeightM))) * 180}
                                  fill="#F59E0B"
                                  fontSize="8"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                >
                                  calc {surfaceIntersections.leftWall.lengthM}m
                                </text>
                              </g>
                            )}
                          </g>
                        )}

                        {/* 2. CROWN ARCH / 2. ES WALL */}
                        {tunnelGeometry.hasCrown !== false && (
                          <g>
                            <rect x="220" y="40" width="220" height="180" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
                            <text x="330" y="32" fill="#94a3b8" fontSize="10.5" fontWeight="bold" textAnchor="middle">
                              {tunnelGeometry.isVerticalShaft
                                ? `2. ES WALL (90°–180° · Pull 0..${tunnelGeometry.pullLengthM}m)`
                                : isSurfaceMapping
                                ? `2. ${domainPanelMap.crown.shortLabel.toUpperCase()} (${strikeInfo.strikePairLabel})`
                                : `2. CROWN ARCH (${strikeInfo.strikePairLabel})`}
                            </text>
                            {/* Crown Centerline */}
                            <line x1="330" y1="40" x2="330" y2="220" stroke="#0284c7" strokeWidth="1" strokeDasharray="4,4" />
                            <text x="330" y="235" fill="#0284c7" fontSize="8.5" textAnchor="middle">
                              {tunnelGeometry.isVerticalShaft ? 'Pull 0m Bottom → Pull Top' : `C/L (${(tunnelGeometry.widthM / 2).toFixed(1)}m)`}
                            </text>
                            <text x="220" y="235" fill="#64748b" fontSize="8.5" textAnchor="middle">
                              {tunnelGeometry.isVerticalShaft
                                ? '◀ 1.NE (90°E)'
                                : isSurfaceMapping
                                ? '0m (Left)'
                                : 'L-SPL'}
                            </text>
                            <text x="440" y="235" fill="#64748b" fontSize="8.5" textAnchor="middle">
                              {tunnelGeometry.isVerticalShaft
                                ? '3.SW ▶ (180°S)'
                                : isSurfaceMapping
                                ? `${tunnelGeometry.widthM}m (Right)`
                                : 'R-SPL'}
                            </text>

                            {/* Observed traces on Crown */}
                            {allRoundJoints
                              .filter((j) => j.panel === 'crown' && j.points.length >= 2)
                              .map((j) => (
                                <polyline
                                  key={`unrolled-obs-cr-${j.id}`}
                                  points={j.points
                                    .map((p) => `${220 + (p.x / 1000) * 220},${40 + (p.y / 800) * 180}`)
                                    .join(' ')}
                                  fill="none"
                                  stroke={j.id === activeJoint.id ? '#38BDF8' : '#64748b'}
                                  strokeWidth={j.id === activeJoint.id ? '3.5' : '2'}
                                  strokeLinecap="round"
                                />
                              ))}

                            {/* Calculated Plane Intersection on Crown */}
                            {surfaceIntersections.crown && (
                              <g>
                                <line
                                  x1={220 + (surfaceIntersections.crown.p1.y / tunnelGeometry.widthM) * 220}
                                  y1={40 + (surfaceIntersections.crown.p1.x / tunnelGeometry.pullLengthM) * 180}
                                  x2={220 + (surfaceIntersections.crown.p2.y / tunnelGeometry.widthM) * 220}
                                  y2={40 + (surfaceIntersections.crown.p2.x / tunnelGeometry.pullLengthM) * 180}
                                  stroke="#F59E0B"
                                  strokeWidth="2.8"
                                  strokeDasharray="6,3"
                                />
                                <text
                                  x={220 + ((surfaceIntersections.crown.p1.y + surfaceIntersections.crown.p2.y) / (2 * tunnelGeometry.widthM)) * 220}
                                  y={35 + ((surfaceIntersections.crown.p1.x + surfaceIntersections.crown.p2.x) / (2 * tunnelGeometry.pullLengthM)) * 180}
                                  fill="#F59E0B"
                                  fontSize="8"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                >
                                  strike {surfaceIntersections.crown.lengthM}m
                                </text>
                              </g>
                            )}
                          </g>
                        )}

                        {/* 3. RIGHT WALL / 3. SW WALL */}
                        {tunnelGeometry.hasRightWall !== false && (
                          <g>
                            <rect x="460" y="40" width="180" height="180" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
                            <text x="550" y="32" fill="#94a3b8" fontSize="10.5" fontWeight="bold" textAnchor="middle">
                              {tunnelGeometry.isVerticalShaft
                                ? `3. SW WALL (180°–270° · Pull 0..${tunnelGeometry.pullLengthM}m)`
                                : isSurfaceMapping
                                ? `3. ${domainPanelMap.rightWall.shortLabel.toUpperCase()} (0..${tunnelGeometry.pullLengthM}m)`
                                : `3. RIGHT WALL (0..${tunnelGeometry.pullLengthM}m)`}
                            </text>
                            <line x1="460" y1="220" x2="640" y2="220" stroke="#64748b" strokeWidth="1" />
                            <text x="460" y="235" fill="#64748b" fontSize="8.5" textAnchor="middle">
                              {tunnelGeometry.isVerticalShaft ? '◀ 2.ES (180°S)' : '0m'}
                            </text>
                            <text x="640" y="235" fill="#64748b" fontSize="8.5" textAnchor="middle">
                              {tunnelGeometry.isVerticalShaft ? '4.WN ▶ (270°W)' : `${tunnelGeometry.pullLengthM}m`}
                            </text>
                            <text x="550" y="248" fill="#64748b" fontSize="8.5" textAnchor="middle">
                              {tunnelGeometry.isVerticalShaft
                                ? 'Pull 0m Bottom → Pull Top'
                                : isSurfaceMapping
                                ? `${domainPanelMap.rightWall.shortLabel} Span`
                                : 'Drive Advance (+X)'}
                            </text>

                            {/* Observed traces on Right Wall */}
                            {allRoundJoints
                              .filter((j) => j.panel === 'right_wall' && j.points.length >= 2)
                              .map((j) => (
                                <polyline
                                  key={`unrolled-obs-rw-${j.id}`}
                                  points={j.points
                                    .map((p) => `${460 + (p.x / 1000) * 180},${220 - (p.y / 800) * 180}`)
                                    .join(' ')}
                                  fill="none"
                                  stroke={j.id === activeJoint.id ? '#38BDF8' : '#64748b'}
                                  strokeWidth={j.id === activeJoint.id ? '3.5' : '2'}
                                  strokeLinecap="round"
                                />
                              ))}

                            {/* Calculated Plane Intersection on Right Wall */}
                            {surfaceIntersections.rightWall && (
                              <g>
                                <line
                                  x1={460 + (surfaceIntersections.rightWall.p1.x / tunnelGeometry.pullLengthM) * 180}
                                  y1={220 - (surfaceIntersections.rightWall.p1.y / (tunnelGeometry.rightWallHeightM || tunnelGeometry.wallHeightM)) * 180}
                                  x2={460 + (surfaceIntersections.rightWall.p2.x / tunnelGeometry.pullLengthM) * 180}
                                  y2={220 - (surfaceIntersections.rightWall.p2.y / (tunnelGeometry.rightWallHeightM || tunnelGeometry.wallHeightM)) * 180}
                                  stroke="#F59E0B"
                                  strokeWidth="2.8"
                                  strokeDasharray="6,3"
                                />
                                <text
                                  x={460 + ((surfaceIntersections.rightWall.p1.x + surfaceIntersections.rightWall.p2.x) / (2 * tunnelGeometry.pullLengthM)) * 180}
                                  y={215 - ((surfaceIntersections.rightWall.p1.y + surfaceIntersections.rightWall.p2.y) / (2 * (tunnelGeometry.rightWallHeightM || tunnelGeometry.wallHeightM))) * 180}
                                  fill="#F59E0B"
                                  fontSize="8"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                >
                                  calc {surfaceIntersections.rightWall.lengthM}m
                                </text>
                              </g>
                            )}
                          </g>
                        )}

                        {/* 4. TUNNEL FACE / SHAFT BOTTOM FACE */}
                        {(() => {
                          if (tunnelGeometry.isVerticalShaft) {
                            return (
                              <g>
                                <circle cx="790" cy="130" r="88" fill="#1e293b" stroke="#0ea5e9" strokeWidth="2" />
                                {/* 1m North-to-South Reference Line */}
                                <line x1="790" y1="42" x2="790" y2="218" stroke="#e11d48" strokeWidth="2" strokeDasharray="5,3" />
                                <text x="790" y="54" fill="#fda4af" fontSize="8" fontWeight="bold" textAnchor="middle">0°N (0m REF)</text>
                                <text x="790" y="214" fill="#fda4af" fontSize="8" fontWeight="bold" textAnchor="middle">180°S ({tunnelGeometry.widthM}m)</text>
                              </g>
                            );
                          }
                          const prof = buildTunnelCrossSectionProfileMetric(tunnelGeometry);
                          const wProf = Math.max(0.5, tunnelGeometry.widthM || 8.0);
                          const hProf = Math.max(0.5, tunnelGeometry.heightM || 6.5);
                          const polyPoints = prof.points
                            .map((p) => {
                              const sx = 670 + (p.y / wProf) * 240;
                              const sy = 220 - (p.z / hProf) * 180;
                              return `${sx.toFixed(1)},${sy.toFixed(1)}`;
                            })
                            .join(' ');
                          return prof.isClosed ? (
                            <polygon
                              points={polyPoints}
                              fill="#1e293b"
                              stroke="#0ea5e9"
                              strokeWidth="2"
                            />
                          ) : (
                            <polyline
                              points={polyPoints}
                              fill="none"
                              stroke="#0ea5e9"
                              strokeWidth="2.5"
                            />
                          );
                        })()}
                        <text x="790" y="32" fill="#38bdf8" fontSize="10.5" fontWeight="bold" textAnchor="middle">
                          {tunnelGeometry.isVerticalShaft
                            ? `4. SHAFT BOTTOM FACE (PULL 0m · 1m N→S REF)`
                            : isSurfaceMapping
                            ? `4. ${domainPanelMap.face.shortLabel.toUpperCase()} (${tunnelGeometry.widthM}m × ${tunnelGeometry.heightM}m)`
                            : `4. EXCAVATION FACE (X = ${tunnelGeometry.pullLengthM}m)`}
                        </text>
                        {/* Centerline on Face */}
                        {!tunnelGeometry.isVerticalShaft && (
                          <line x1="790" y1="40" x2="790" y2="220" stroke="#0284c7" strokeWidth="1" strokeDasharray="4,4" />
                        )}
                        <line x1="670" y1="220" x2="910" y2="220" stroke="#64748b" strokeWidth="1" />
                        <text x="670" y="235" fill="#64748b" fontSize="8.5" textAnchor="middle">
                          {tunnelGeometry.isVerticalShaft ? '270°W (0m)' : '0m (Left)'}
                        </text>
                        <text x="790" y="235" fill="#0284c7" fontSize="8.5" textAnchor="middle">
                          {tunnelGeometry.isVerticalShaft ? '1m N→S REF' : 'C/L'}
                        </text>
                        <text x="910" y="235" fill="#64748b" fontSize="8.5" textAnchor="middle">
                          {tunnelGeometry.isVerticalShaft ? `90°E (${tunnelGeometry.widthM}m)` : `${tunnelGeometry.widthM}m (Right)`}
                        </text>
                        <text x="790" y="248" fill="#64748b" fontSize="8.5" textAnchor="middle">
                          {tunnelGeometry.isVerticalShaft ? `Shaft Diameter Ø ${tunnelGeometry.widthM}m` : 'Transverse Span (+Y)'}
                        </text>

                        {/* Observed traces on Face */}
                        {allRoundJoints
                          .filter((j) => j.panel === 'face' && j.points.length >= 2)
                          .map((j) => (
                            <polyline
                              key={`unrolled-obs-fc-${j.id}`}
                              points={j.points
                                .map((p) => `${670 + (p.x / 1000) * 240},${40 + (p.y / 800) * 180}`)
                                .join(' ')}
                              fill="none"
                              stroke={j.id === activeJoint.id ? '#38BDF8' : '#64748b'}
                              strokeWidth={j.id === activeJoint.id ? '3.5' : '2'}
                              strokeLinecap="round"
                            />
                          ))}

                        {/* Calculated Plane Intersection on Face */}
                        {surfaceIntersections.face && (
                          <g>
                            <line
                              x1={670 + (surfaceIntersections.face.p1.x / tunnelGeometry.widthM) * 240}
                              y1={220 - (surfaceIntersections.face.p1.y / tunnelGeometry.heightM) * 180}
                              x2={670 + (surfaceIntersections.face.p2.x / tunnelGeometry.widthM) * 240}
                              y2={220 - (surfaceIntersections.face.p2.y / tunnelGeometry.heightM) * 180}
                              stroke="#F59E0B"
                              strokeWidth="2.8"
                              strokeDasharray="6,3"
                            />
                            <text
                              x={670 + ((surfaceIntersections.face.p1.x + surfaceIntersections.face.p2.x) / (2 * tunnelGeometry.widthM)) * 240}
                              y={215 - ((surfaceIntersections.face.p1.y + surfaceIntersections.face.p2.y) / (2 * tunnelGeometry.heightM)) * 180}
                              fill="#F59E0B"
                              fontSize="8"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              calc {surfaceIntersections.face.lengthM}m
                            </text>
                          </g>
                        )}
                      </svg>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 text-sky-400">
                          <span className="w-3 h-1 bg-sky-400 rounded" /> Directly Observed Trace (Cyan)
                        </span>
                        <span className="flex items-center gap-1.5 text-amber-400">
                          <span className="w-3 h-0.5 bg-amber-400 border-dashed" /> Mathematically Calculated Intersection (Amber)
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-300">
                        Total Extent: {observedLengths.totalObservedM}m observed · {surfaceIntersections.totalCalculatedM}m theoretical
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* JOINT SWITCHING WITH UNSAVED EDITS CONFIRMATION MODAL */}
      {showSwitchConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="max-w-md w-full p-4 rounded-2xl bg-slate-900 border border-amber-400 shadow-2xl font-mono text-xs text-slate-100 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Confirm Joint Edit &amp; Reflect to Canvas</span>
            </div>
            <p className="text-slate-300">
              Do you want to save current changes for <strong>Joint {currentJoint.id}</strong> (Dip {dipAmount}° ∠ {dipDirection}°) and reflect them onto the Face Canvas before switching to Joint {pendingSwitchJointId}?
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowSwitchConfirm(false);
                  setPendingSwitchJointId(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSwitch(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white cursor-pointer"
              >
                Switch Without Saving
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSwitch(true, 'TEXT_ONLY')}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md cursor-pointer"
              >
                Change Text Only on Canvas
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSwitch(true, 'ALIGN_TRACE')}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black shadow-md cursor-pointer"
              >
                Change Trace Alignment on Canvas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SELECT STARTING POINT (P1) OR ENDING POINT (P2) MODAL FOR DIP AMOUNT OR STRIKE DIRECTION */}
      {hingeIndicationModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/90">
          <div className="max-w-lg w-full p-5 rounded-2xl bg-slate-900 border-2 border-cyan-500/70 shadow-2xl font-mono text-xs text-slate-100 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 shrink-0">
                <Crosshair className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <div className="font-black text-cyan-300 text-sm uppercase tracking-wide">
                  {hingeIndicationModal.mode === 'FACE_DIP_AMOUNT'
                    ? 'Select Base Point & Dip Inwards / Outwards Sense'
                    : 'Select Base Point for Strike / Dip Direction Change'}
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {hingeIndicationModal.mode === 'FACE_DIP_AMOUNT' ? (
                    <>
                      Choose which endpoint of <strong className="text-amber-300">Joint {currentJoint.id}</strong> should stay fixed as the base point while dipping from{' '}
                      <strong className="text-white">{hingeIndicationModal.currentValue}°</strong> to{' '}
                      <strong className="text-amber-300">{hingeIndicationModal.targetValue}°</strong> across the{' '}
                      <strong className="text-emerald-300">180° Half-Circle (Inwards / Outwards)</strong>:
                      <br />
                      <br />
                      • Once you select <strong className="text-emerald-300">Starting Point (P1)</strong> or{' '}
                      <strong className="text-cyan-300">Ending Point (P2)</strong>, the joint trace and 3D plane will dip directly around that point.
                      <br />
                      • Once completed, you can rotate <strong className="text-amber-300">Dip Direction</strong> hinge-based around the new trace line.
                    </>
                  ) : (
                    <>
                      On this <strong className="text-cyan-300">Strike-Measured Surface</strong> (vice versa rule), choose which endpoint of{' '}
                      <strong className="text-amber-300">Joint {currentJoint.id}</strong> should stay fixed as the base point while rotating Strike / Dip Direction from{' '}
                      <strong className="text-white">{hingeIndicationModal.currentValue}°</strong> to{' '}
                      <strong className="text-cyan-300">{hingeIndicationModal.targetValue}°</strong>:
                      <br />
                      <br />
                      • Once you select <strong className="text-emerald-300">Starting Point (P1)</strong> or{' '}
                      <strong className="text-cyan-300">Ending Point (P2)</strong>, the Strike trace will pivot around that point.
                      <br />
                      • Once completed, you can change <strong className="text-amber-300">Dip Amount (Inwards / Outwards)</strong> hinge-based around that Strike trace.
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Dip Inwards / Dip Outwards Half-Circle Selector inside Modal */}
            {hingeIndicationModal.mode === 'FACE_DIP_AMOUNT' && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  Choose Dip Half-Circle Sense (Inwards vs Outwards):
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDipHalfCircleSense('inwards');
                      setHingeDipSide('heading');
                      setHingeIndicationModal((prev) =>
                        prev ? { ...prev, targetSense: 'inwards' } : null
                      );
                    }}
                    className={`py-2 px-3 rounded-lg font-bold text-xs cursor-pointer border transition-colors ${
                      (hingeIndicationModal.targetSense || dipHalfCircleSense) === 'inwards'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-black'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    ↙ Dip Inwards ({hingeIndicationModal.targetValue}°)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDipHalfCircleSense('outwards');
                      setHingeDipSide('collar');
                      setHingeIndicationModal((prev) =>
                        prev ? { ...prev, targetSense: 'outwards' } : null
                      );
                    }}
                    className={`py-2 px-3 rounded-lg font-bold text-xs cursor-pointer border transition-colors ${
                      (hingeIndicationModal.targetSense || dipHalfCircleSense) === 'outwards'
                        ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    ↘ Dip Outwards ({hingeIndicationModal.targetValue}°)
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const chosenSense = hingeIndicationModal.targetSense || dipHalfCircleSense;
                  setTracePivotEndpoint('start');
                  setIsPrimaryStepCompleted(false);
                  if (hingeIndicationModal.mode === 'FACE_DIP_AMOUNT') {
                    setDipHalfCircleSense(chosenSense);
                    setHingeDipSide(chosenSense === 'inwards' ? 'heading' : 'collar');
                    setIsDipAmountEdited(true);
                    setIsHingeRotationActive(true);
                    setDipAmount(hingeIndicationModal.targetValue);
                    setHingeDipDeg(Math.max(1, hingeIndicationModal.targetValue));
                  } else {
                    setIsStrikeDirEdited(true);
                    setIsStrikeLineHingeLocked(false);
                    setIsHingeRotationActive(true);
                    setDipDirection(hingeIndicationModal.targetValue);
                  }
                  setHingeIndicationModal(null);
                }}
                className="px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-lg cursor-pointer flex flex-col items-center justify-center gap-0.5 border border-emerald-300"
              >
                <span className="text-xs uppercase">1. Starting Point (P1)</span>
                <span className="text-[10px] font-bold opacity-85">
                  {hingeIndicationModal.mode === 'FACE_DIP_AMOUNT'
                    ? `Keep P1 Fixed · Dip ${hingeIndicationModal.targetValue}° (${(hingeIndicationModal.targetSense || dipHalfCircleSense) === 'inwards' ? 'Inwards' : 'Outwards'})`
                    : `Keep P1 Fixed · Rotate to ${hingeIndicationModal.targetValue}°`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const chosenSense = hingeIndicationModal.targetSense || dipHalfCircleSense;
                  setTracePivotEndpoint('end');
                  setIsPrimaryStepCompleted(false);
                  if (hingeIndicationModal.mode === 'FACE_DIP_AMOUNT') {
                    setDipHalfCircleSense(chosenSense);
                    setHingeDipSide(chosenSense === 'inwards' ? 'heading' : 'collar');
                    setIsDipAmountEdited(true);
                    setIsHingeRotationActive(true);
                    setDipAmount(hingeIndicationModal.targetValue);
                    setHingeDipDeg(Math.max(1, hingeIndicationModal.targetValue));
                  } else {
                    setIsStrikeDirEdited(true);
                    setIsStrikeLineHingeLocked(false);
                    setIsHingeRotationActive(true);
                    setDipDirection(hingeIndicationModal.targetValue);
                  }
                  setHingeIndicationModal(null);
                }}
                className="px-4 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black shadow-lg cursor-pointer flex flex-col items-center justify-center gap-0.5 border border-cyan-300"
              >
                <span className="text-xs uppercase">2. Ending Point (P2)</span>
                <span className="text-[10px] font-bold opacity-85">
                  {hingeIndicationModal.mode === 'FACE_DIP_AMOUNT'
                    ? `Keep P2 Fixed · Dip ${hingeIndicationModal.targetValue}° (${(hingeIndicationModal.targetSense || dipHalfCircleSense) === 'inwards' ? 'Inwards' : 'Outwards'})`
                    : `Keep P2 Fixed · Rotate to ${hingeIndicationModal.targetValue}°`}
                </span>
              </button>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setHingeIndicationModal(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* METHODOLOGY & SCIENCE REFERENCE MODAL FOR FRACTURE INTENSITY & HINGE ROTATION */}
      {showIntensityMethodModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 rounded-2xl bg-slate-900 border border-cyan-500/50 shadow-2xl font-mono text-xs text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <Activity className="w-5 h-5 shrink-0" />
                <span>Geotechnical Methodology: Fracture Intensity, Occupied Area &amp; Hinge Axis</span>
              </div>
              <button
                type="button"
                onClick={() => setShowIntensityMethodModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Section 1: Hinge Axis Mechanics */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <h4 className="font-bold text-amber-400 flex items-center gap-2 text-xs">
                <span>1. Face Trace Hinge-Axis 3D Rotation Kinematics</span>
              </h4>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                In geological face mapping, the observed trace line on the face canvas has coordinates (X_pull, Y1, Z1) to (X_pull, Y2, Z2). Because both endpoints lie on the face plane (X = const), the trace vector u = (0, ΔY, ΔZ) constitutes a stationary hinge axis.
              </p>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[10.5px] text-amber-200">
                <div>• Hinge Unit Vector: u_hat = (0, ΔY/L, ΔZ/L) where L = √(ΔY² + ΔZ²)</div>
                <div>• In-Face Orthogonal: w_hat = (0, -u_z, u_y)</div>
                <div>• Rotated Dip Vector: v(θ) = w_hat · cos(θ) ± x_hat · sin(θ)</div>
                <div>• Plane Normal: n(θ) = u_hat × v(θ)</div>
              </div>
              <p className="text-slate-400 text-[10px]">
                Because n(θ) · u_hat ≡ 0 for all rotation angles θ in [0°, 90°], the mapped joint line is mathematically guaranteed to remain strictly in the plane during 3D rotation, never drifting away from the face canvas trace.
              </p>
            </div>

            {/* Section 2: Dershowitz P21 and P32 Intensity */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <h4 className="font-bold text-cyan-400 flex items-center gap-2 text-xs">
                <span>2. ISRM &amp; Dershowitz (1984/1988) Fracture Intensity (P_ij)</span>
              </h4>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Discontinuity intensity follows the international standardized P_ij notation proposed by Dershowitz (1984) and recommended by ISRM:
              </p>
              <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                <div className="p-2 rounded bg-slate-900 border border-slate-800 text-cyan-200">
                  <div className="font-bold text-cyan-300">P21 Area Trace Intensity (m/m²):</div>
                  <div className="pt-1">P21 = ∑L_face / A_face</div>
                  <div className="text-[9.5px] text-slate-400 pt-1">Total trace length observed per unit area of excavation face.</div>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800 text-emerald-200">
                  <div className="font-bold text-emerald-300">P32 Volumetric Intensity (m²/m³):</div>
                  <div className="pt-1">P32 = ∑A_occupied / V_excavation</div>
                  <div className="text-[9.5px] text-slate-400 pt-1">Total fracture surface area per unit volume of rock mass.</div>
                </div>
              </div>
            </div>

            {/* Section 3: Warburton & Baecher Disc Occupied Area Model */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <h4 className="font-bold text-amber-400 flex items-center gap-2 text-xs">
                <span>3. Warburton (1980) &amp; Baecher (1977) Discontinuity Occupied Area</span>
              </h4>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Visible joint traces represent chords of 3D discontinuity planes intersecting the excavation boundary. Under the standard circular disc model (Baecher et al., 1977; Warburton, 1980):
              </p>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[10.5px] text-slate-200 space-y-1">
                <div>• Expected Discontinuity Diameter: E[D] = (4/π) × L_trace ≈ 1.273 × L_trace</div>
                <div>• Discontinuity Occupied Area: A_disc = (π/4) × E[D]² = (4/π) × L_trace² ≈ 1.273 × L_trace²</div>
              </div>
              <p className="text-slate-400 text-[10px]">
                This formulation provides an objective, mathematically rigorous conversion from 1D/2D mapped surface chords to 3D persistence and occupied rock mass area.
              </p>
            </div>

            {/* Section 4: Palmström Volumetric Joint Count (Jv) and RQD */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <h4 className="font-bold text-emerald-400 flex items-center gap-2 text-xs">
                <span>4. Palmström (1995/2005) Volumetric Joint Count ($J_v$) &amp; RQD Correlation</span>
              </h4>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Palmström established that 2D trace intensity correlates directly to 3D volumetric joint count $J_v$ (joints/m³), which provides an empirical estimate of Rock Quality Designation (RQD):
              </p>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[10.5px] text-emerald-200 space-y-1">
                <div>• Volumetric Joint Count: J_v ≈ 1.15 × P21 (joints/m³)</div>
                <div>• Empirical RQD: RQD = 115 - 3.3 × J_v (bounded in range 0% – 100%)</div>
              </div>
              <div className="grid grid-cols-5 gap-1 text-[9px] text-center pt-1 font-mono">
                <div className="p-1 rounded bg-emerald-950 border border-emerald-700/50 text-emerald-300">
                  <div>Jv &lt; 1</div>
                  <div className="font-bold">Massive (90-100%)</div>
                </div>
                <div className="p-1 rounded bg-teal-950 border border-teal-700/50 text-teal-300">
                  <div>Jv 1–3</div>
                  <div className="font-bold">Good (75-90%)</div>
                </div>
                <div className="p-1 rounded bg-amber-950 border border-amber-700/50 text-amber-300">
                  <div>Jv 3–10</div>
                  <div className="font-bold">Fair (50-75%)</div>
                </div>
                <div className="p-1 rounded bg-orange-950 border border-orange-700/50 text-orange-300">
                  <div>Jv 10–30</div>
                  <div className="font-bold">Poor (25-50%)</div>
                </div>
                <div className="p-1 rounded bg-rose-950 border border-rose-700/50 text-rose-300">
                  <div>Jv &gt; 30</div>
                  <div className="font-bold">Crushed (0-25%)</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowIntensityMethodModal(false)}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer transition-colors shadow-md"
              >
                Close Methodology Reference
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMBEDDED ADVANCE GEOLOGICAL ANALYTICS VIEW */}
      {showAdvanceAnalysis && (
        <div className="fixed inset-0 z-[70] bg-slate-950">
          <AdvancedGeologicalAnalysisModal
            fullPage
            isOpen={true}
            onClose={() => setShowAdvanceAnalysis(false)}
            geometry={createTunnelGeometry(
              tunnelGeometry.widthM || 8.5,
              tunnelGeometry.heightM || 7.5,
              tunnelGeometry.wallHeightM || 4.2,
              tunnelGeometry.tunnelShape === 'horseshoe' ? 'horseshoe' : 'd_shaped'
            )}
            settings={{
              projectName: 'NATM Field Mapping',
              tunnelName: 'NATM Tunnel Heading',
              location: '',
              locationName: 'Active Face',
              driveDirectionInput: `N ${Math.round(tunnelGeometry.driveAzimuthDeg || 0)}° E`,
              driveDirection: tunnelGeometry.driveAzimuthDeg || 0,
              chainage: `RD ${tunnelGeometry.currentChainageM || 100}m`,
              faceChainage: `RD ${tunnelGeometry.currentChainageM || 100}m`,
              roundLength: tunnelGeometry.pullLengthM || 3.0,
              date: new Date().toISOString().slice(0, 10),
              mappedBy: 'Geotechnical Engineer',
              lithology: 'Granite / Schist',
            }}
            joints={convertedJoints}
            jointSets={convertedJointSets}
          />
        </div>
      )}

      {/* EMBEDDED 3D DIGITAL TWIN & PHOTOGRAMMETRY WORKBENCH */}
      {showDigitalTwinModal && (
        <DigitalTwinPhotogrammetryModal
          isOpen={showDigitalTwinModal}
          onClose={() => setShowDigitalTwinModal(false)}
          geometry={tunnelGeometry}
          initialPanel={currentJoint.panel || 'face'}
          existingJointTraces={allRoundJoints}
          existingDipSurfaces={allRoundDipSurfaces}
          onSaveJointTrace={(newTrace) => {
            onSaveJoint(newTrace);
          }}
          onSaveDipSurface={(newSurface) => {
            if (onSaveDipSurface) onSaveDipSurface(newSurface);
          }}
          onUpdateExistingJointTrace={(_traceId, newDipDir, newDipAmt, _newStrike, newSense) => {
            setDipHalfCircleSense(newSense);
            setHingeDipSide(newSense === 'inwards' ? 'heading' : 'collar');
            setDipDirection(Math.round(newDipDir));
            setDipAmount(Math.round(newDipAmt));
            setHingeDipDeg(Math.round(newDipAmt));
            setMeasurementSource('PHOTOGRAMMETRY_MULTIVIEW');
          }}
          onApplyToActiveInspector={(fit) => {
            setDipHalfCircleSense(fit.dipHalfCircleSense);
            setHingeDipSide(fit.dipHalfCircleSense === 'inwards' ? 'heading' : 'collar');
            setDipDirection(Math.round(fit.dipDirectionDeg));
            setDipAmount(Math.round(fit.dipAmountDeg));
            setHingeDipDeg(Math.round(fit.dipAmountDeg));
            setJointSetId(fit.setId);
            setMeasurementSource('PHOTOGRAMMETRY_MULTIVIEW');
          }}
        />
      )}
    </div>
  );
};
