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
} from 'lucide-react';
import {
  FieldJointTrace,
  FieldPanelId,
  FieldJointGroupingId,
  FIELD_JOINT_GROUP_COLORS,
} from '../engine/fieldMappingEngine';
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
  FaceTraceHingePlaneResult,
  TraceHingePlaneResult,
  JointFractureIntensityAndAreaResult,
  pointToTunnel3DMetric,
} from '../engine/joint3DInspectorEngine';
import { AdvancedGeologicalAnalysisModal } from './AdvancedGeologicalAnalysisModal';
import { createTunnelGeometry } from '../engine/geometryEngine';
import { Joint, JointSet, SurfaceType } from '../types/tunnel';

export interface NatmJoint3DInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeJoint: FieldJointTrace;
  allRoundJoints: FieldJointTrace[];
  tunnelGeometry: TunnelSpatialGeometry;
  onSaveJoint: (updatedJoint: FieldJointTrace) => void;
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
// THREE.JS 3D BILLBOARD SPRITE TEXT GENERATOR FOR ADVANCE & FACE SIGNAGE
// ----------------------------------------------------------------------------
function createBillboardLabel(
  text: string,
  bgColor: string,
  textColor: string,
  scaleX = 3.6,
  scaleY = 0.75
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, 112, 16);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = 'bold 36px monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scaleX, scaleY, 1);
  return sprite;
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

export const NatmJoint3DInspectorModal: React.FC<NatmJoint3DInspectorModalProps> = (props) => {
  if (!props.isOpen || !props.activeJoint) return null;
  return <NatmJoint3DInspectorModalContent {...props} activeJoint={props.activeJoint} />;
};

const NatmJoint3DInspectorModalContent: React.FC<
  NatmJoint3DInspectorModalProps & { activeJoint: FieldJointTrace }
> = ({
  isOpen,
  onClose,
  activeJoint,
  allRoundJoints,
  tunnelGeometry,
  onSaveJoint,
}) => {
  // Real-Time Theme Integration (supports light & dark themes seamlessly)
  const { theme, palette } = useTheme();
  const isLight = theme === 'light' || Boolean(palette?.isLightBg);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<InspectionViewTab>('VIEW_3D');

  // Collapsible & Shrinkable Aside Sidebar State
  const [isAsideCollapsed, setIsAsideCollapsed] = useState<boolean>(false);
  const [asideWidthMode, setAsideWidthMode] = useState<'compact' | 'standard'>('standard');

  // Currently Selected Joint in Inspector (defaults to activeJoint.id, switchable to any joint in round)
  const [currentJointId, setCurrentJointId] = useState<string>(activeJoint.id);
  const [pendingSwitchJointId, setPendingSwitchJointId] = useState<string | null>(null);
  const [showSwitchConfirm, setShowSwitchConfirm] = useState<boolean>(false);

  // Synchronize when activeJoint prop changes from parent
  useEffect(() => {
    if (activeJoint?.id) {
      setCurrentJointId(activeJoint.id);
    }
  }, [activeJoint?.id]);

  const currentJoint = useMemo(() => {
    return allRoundJoints.find((j) => j.id === currentJointId) || activeJoint;
  }, [allRoundJoints, currentJointId, activeJoint]);

  // Editable Orientation Parameters
  // For Crown roof traces, the mapped trace defines the strike direction and the IDEAL dip amount is 90°
  // (dipping 90° relative to the strike direction), while preserving any custom dip amount saved by the user.
  const isCrown = currentJoint.panel === 'crown';
  const resolvedInitialDip = isCrown
    ? (currentJoint.editedByCompass || currentJoint.inspection3D) &&
      typeof currentJoint.dipAmount === 'number' &&
      currentJoint.dipAmount >= 1 &&
      currentJoint.dipAmount <= 90
      ? currentJoint.dipAmount
      : 90
    : (currentJoint.dipAmount ?? 65);

  const [dipDirection, setDipDirection] = useState<number>(currentJoint.dipDirection ?? 135);
  const [dipAmount, setDipAmount] = useState<number>(resolvedInitialDip);
  const [jointSetId, setJointSetId] = useState<FieldJointGroupingId>(currentJoint.setId || 'unassigned');

  // Hinge Axis of Rotation State (For face & wall traces, plane pivots strictly around the traced line; for crown, ideal 90° dip relative to strike direction)
  const isFaceTrace = currentJoint.panel === 'face';
  const isWallTrace = currentJoint.panel === 'left_wall' || currentJoint.panel === 'right_wall';
  const isCrownTrace = currentJoint.panel === 'crown';
  const [isHingeRotationActive, setIsHingeRotationActive] = useState<boolean>(true);
  const [isStrikeLineHingeLocked, setIsStrikeLineHingeLocked] = useState<boolean>(
    currentJoint.panel === 'crown'
  );
  const [hingeDipDeg, setHingeDipDeg] = useState<number>(resolvedInitialDip || 90);
  const [hingeDipSide, setHingeDipSide] = useState<'heading' | 'collar'>(
    currentJoint.panel === 'crown' && currentJoint.crownDipSign === '-90' ? 'collar' : 'heading'
  );
  const [showIntensityMethodModal, setShowIntensityMethodModal] = useState<boolean>(false);

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
      'Visible trace exposed across excavation face. Continuity into crown arch observed with tight intact rock bridge.'
  );
  const [persistenceAssumptions, setPersistenceAssumptions] = useState<string>(
    currentJoint.inspection3D?.persistenceAssumptions ||
      'Orientation assumed planar within the excavation volume. Planar extrapolation clipped to tunnel cross-section perimeter.'
  );
  const [persistenceConfidence, setPersistenceConfidence] = useState<'HIGH' | 'MEDIUM' | 'LOW'>(
    currentJoint.inspection3D?.persistenceConfidence || 'MEDIUM'
  );

  // Cross-Surface Linking
  const [linkedTraceIds, setLinkedTraceIds] = useState<string[]>(
    currentJoint.inspection3D?.linkedTraceIds || []
  );

  // When switching currentJointId, load its orientation parameters
  useEffect(() => {
    const isCr = currentJoint.panel === 'crown';
    const resolvedDip = isCr
      ? (currentJoint.editedByCompass || currentJoint.inspection3D) &&
        typeof currentJoint.dipAmount === 'number' &&
        currentJoint.dipAmount >= 1 &&
        currentJoint.dipAmount <= 90
        ? currentJoint.dipAmount
        : 90
      : (currentJoint.dipAmount ?? 65);
    setDipDirection(currentJoint.dipDirection ?? 135);
    setDipAmount(resolvedDip);
    setHingeDipDeg(resolvedDip);
    setHingeDipSide(isCr && currentJoint.crownDipSign === '-90' ? 'collar' : 'heading');
    setIsHingeRotationActive(true);
    setIsStrikeLineHingeLocked(isCr);
    setJointSetId(currentJoint.setId || 'unassigned');
    setMeasurementSource(
      currentJoint.inspection3D?.measurementSource || (currentJoint.editedByCompass ? 'MANUAL_COMPASS' : 'GEOMETRIC_FIT')
    );
    setOrientationConfidence(currentJoint.inspection3D?.orientationConfidence || 'HIGH');
    setAngularUncertainty(currentJoint.inspection3D?.angularUncertaintyDeg ?? 3.0);
    setPersistenceInterpretation(
      currentJoint.inspection3D?.persistenceInterpretation ||
        'Visible trace exposed across excavation face. Continuity into crown arch observed with tight intact rock bridge.'
    );
    setPersistenceAssumptions(
      currentJoint.inspection3D?.persistenceAssumptions ||
        'Orientation assumed planar within the excavation volume. Planar extrapolation clipped to tunnel cross-section perimeter.'
    );
    setPersistenceConfidence(currentJoint.inspection3D?.persistenceConfidence || 'MEDIUM');
    setLinkedTraceIds(currentJoint.inspection3D?.linkedTraceIds || []);
  }, [currentJointId]);

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
      jointSetId !== (currentJoint.setId || 'unassigned')
    );
  }, [dipDirection, dipAmount, jointSetId, currentJoint]);

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
      setPlotPlaneAdvanceM(tunnelGeometry.pullLengthM);
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

  // 3a. Trace Hinge-Axis Plane Calculation (Pinned to Traced Line on Face, Walls & Crown)
  const hingePlaneResult = useMemo<TraceHingePlaneResult | null>(() => {
    if (!isHingeRotationActive || currentJoint.points.length < 2) return null;
    return constructPlaneFromTraceHinge(
      currentJoint.points,
      currentJoint.panel || 'face',
      hingeDipDeg,
      hingeDipSide,
      tunnelGeometry,
      isStrikeLineHingeLocked
    );
  }, [
    isHingeRotationActive,
    currentJoint.points,
    currentJoint.panel,
    hingeDipDeg,
    hingeDipSide,
    tunnelGeometry,
    isStrikeLineHingeLocked,
  ]);

  // 1. Strike Convention & Angles (keeps Strike invariant when rotating around a locked Strike Line Hinge)
  const strikeInfo = useMemo(() => {
    const base = calculateStrikeFromDipDirection(dipDirection ?? 135, dipAmount ?? 60);
    if ((currentJoint.panel === 'crown' || isStrikeLineHingeLocked) && hingePlaneResult) {
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
    return base;
  }, [dipDirection, dipAmount, currentJoint.panel, isStrikeLineHingeLocked, hingePlaneResult]);

  // 1b. True Dip vs. Surface Apparent Dips Matrix (Analytical Geological Calculation)
  const apparentMatrix = useMemo<TunnelSurfacesApparentDipMatrix>(() => {
    return calculateSurfaceApparentTraceAngles(
      dipDirection ?? 135,
      dipAmount ?? 60,
      tunnelGeometry?.driveAzimuthDeg ?? 0
    );
  }, [dipDirection, dipAmount, tunnelGeometry?.driveAzimuthDeg]);

  // 2. Anchor Point Derived from actual mapped 2D polyline vertices or user-selected plot anchor
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
    const derived = deriveAnchorPointFromPoints(currentJoint.points, currentJoint.panel, tunnelGeometry);
    if (currentJoint.panel === 'face') {
      return { ...derived, x: pull };
    }
    return derived;
  }, [plotPlaneAnchorType, plotPlaneAdvanceM, currentJoint.points, currentJoint.panel, tunnelGeometry]);

  // Exact 2D Traced Joint Length in Meters
  const currentTraceLengthM = useMemo(() => {
    const rawLen =
      hingePlaneResult?.traceLengthM ||
      calculatePolylineLengthM(currentJoint.points, currentJoint.panel || 'face', tunnelGeometry) ||
      1.2;
    return Number(Math.max(0.2, rawLen).toFixed(2));
  }, [hingePlaneResult, currentJoint.points, currentJoint.panel, tunnelGeometry]);

  // 3b. ISRM & Rock Mechanics Fracture Intensity & Occupied Area Calculation
  const fractureIntensityResult = useMemo<JointFractureIntensityAndAreaResult>(() => {
    return calculateJointFractureIntensityAndArea(
      currentJoint.points,
      allRoundJoints,
      tunnelGeometry,
      currentJoint.panel || 'face'
    );
  }, [currentJoint.points, currentJoint.panel, allRoundJoints, tunnelGeometry]);

  // Synchronize derived dip and dip direction when hinge rotation changes
  useEffect(() => {
    if (hingePlaneResult) {
      if (typeof hingePlaneResult.derivedDipDeg === 'number' && !isNaN(hingePlaneResult.derivedDipDeg)) {
        setDipAmount(hingePlaneResult.derivedDipDeg);
      }
      if (typeof hingePlaneResult.derivedDipDirectionDeg === 'number' && !isNaN(hingePlaneResult.derivedDipDirectionDeg)) {
        setDipDirection(hingePlaneResult.derivedDipDirectionDeg);
      }
    }
  }, [hingePlaneResult]);

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

  const handleConfirmSwitch = (saveFirst: boolean) => {
    if (saveFirst) {
      handleSaveInspection();
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

  // 8. Automated Engine Validation Test Report
  const validationReport = useMemo(() => runJointEngineValidationTests(), []);

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
  // THREE.JS HIGH-PERFORMANCE 3D CANVAS RENDERING (PURE WHITE BACKGROUND)
  // -------------------------------------------------------------------------
  const threeMountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Dynamic mesh group reference to update ONLY joint features without recreating the scene
  const jointGroupRef = useRef<THREE.Group | null>(null);

  // Mutable camera orientation ref — prevents React state updates during drag
  const camSphericalRef = useRef<{ radius: number; theta: number; phi: number }>({
    radius: 17,
    theta: Math.PI / 4,
    phi: Math.PI / 3,
  });

  // Panning / Move target offset in Three.js coordinates
  const targetOffsetRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const lastThetaDegRef = useRef<number>(-999);

  const isDraggingRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Set Camera Presets (smoothly updates camSphericalRef and resets pan offset)
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
  };

  // Align camera with True North
  const snapToNorth = () => {
    const driveAz = tunnelGeometry.driveAzimuthDeg || 0;
    camSphericalRef.current.theta = -((driveAz * Math.PI) / 180);
    setCameraTheta(camSphericalRef.current.theta);
  };

  // Align camera looking straight down the Tunnel Drive Axis (+Z)
  const snapToTunnelDrive = () => {
    camSphericalRef.current.theta = 0;
    camSphericalRef.current.phi = Math.PI / 2.3;
    setCameraTheta(0);
  };

  // Reset Camera Target & Orbit
  const resetCameraTarget = () => {
    targetOffsetRef.current = { x: 0, y: 0, z: 0 };
    camSphericalRef.current = { radius: 17, theta: Math.PI / 4, phi: Math.PI / 3 };
    setCameraTheta(Math.PI / 4);
  };

  // On-screen Zoom & Pan buttons
  const zoomIn = () => {
    camSphericalRef.current.radius = Math.max(3, camSphericalRef.current.radius - 2.5);
  };
  const zoomOut = () => {
    camSphericalRef.current.radius = Math.min(55, camSphericalRef.current.radius + 2.5);
  };
  const panCamera = (dx: number, dy: number) => {
    const cam = camSphericalRef.current;
    const rightX = Math.cos(cam.theta);
    const rightZ = -Math.sin(cam.theta);
    targetOffsetRef.current.x += rightX * dx;
    targetOffsetRef.current.z += rightZ * dx;
    targetOffsetRef.current.y += dy;
  };

  // -------------------------------------------------------------------------
  // INITIALIZE THREE.JS SCENE ONCE
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (activeTab !== 'VIEW_3D' || !threeMountRef.current) return;

    const container = threeMountRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;

    // 1. Scene with Pure White Background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 150);
    cameraRef.current = camera;

    // 3. Renderer with High Performance
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xffffff, 1);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Studio CAD Lighting for White Background
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdfe7ec, 0.85);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight1.position.set(15, 25, 20);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 0.4);
    dirLight2.position.set(-15, 10, -15);
    scene.add(dirLight2);

    // Tunnel Dimensions
    const w = tunnelGeometry.widthM || 8.5;
    const h = tunnelGeometry.heightM || 7.5;
    const hw = tunnelGeometry.wallHeightM || 4.2;
    const pullL = tunnelGeometry.pullLengthM || 3.0;
    const archRise = h - hw;

    const cx = w / 2;
    const cy = h / 2;
    const cz = pullL / 2;

    // 5. Clean Excavation Invert Floor (Smooth, flat invert between x = 0 and x = w)
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
    scene.add(floorMesh);

    // 6. Tunnel Static Geometry Construction (Clean Smooth Hollow Tunnel Void, ZERO Triangles on SPL)
    const tunnelGroup = new THREE.Group();

    // Dynamic Profile points: strictly in [0, w] (horizontal) and [0, h] (vertical)
    const profilePts: THREE.Vector2[] = [];
    const customPoints = tunnelGeometry.crossSectionPoints;

    if (customPoints && customPoints.length >= 3) {
      const minX = Math.min(...customPoints.map((p) => p.x));
      const maxX = Math.max(...customPoints.map((p) => p.x));
      const minY = Math.min(...customPoints.map((p) => p.y));
      const maxY = Math.max(...customPoints.map((p) => p.y));
      const spanX = Math.max(0.01, maxX - minX);
      const spanY = Math.max(0.01, maxY - minY);

      for (const cp of customPoints) {
        // Map from custom profile space into Three.js tunnel coordinates:
        // x goes from 0 to w
        // y goes from 0 to h
        const tx = ((cp.x - minX) / spanX) * w;
        const ty = ((cp.y - minY) / spanY) * h;
        profilePts.push(new THREE.Vector2(tx, ty));
      }
    } else {
      // High-smoothness D-Shaped / Horseshoe profile (48 smooth segments)
      const segments = 48;
      // 1. Left Invert footing
      profilePts.push(new THREE.Vector2(0, 0));
      // 2. Right Invert footing
      profilePts.push(new THREE.Vector2(w, 0));
      // 3. Right Springline (SPL)
      profilePts.push(new THREE.Vector2(w, hw));
      // 4. Smooth arch from Right Springline to Left Springline
      for (let i = 1; i < segments; i++) {
        const theta = (i / segments) * Math.PI;
        const x = cx + (w / 2) * Math.cos(theta); // theta=0 -> w; theta=PI -> 0
        const y = hw + archRise * Math.sin(theta);
        profilePts.push(new THREE.Vector2(x, y));
      }
      // 5. Left Springline (SPL)
      profilePts.push(new THREE.Vector2(0, hw));
    }

    // A. Clean Hollow 3D Tunnel Shell Mesh (NO caps at portal z=0, NO internal dividing triangles, NO triangle on SPL)
    const shellPositions: number[] = [];
    const shellIndices: number[] = [];
    const numPts = profilePts.length;

    for (let i = 0; i < numPts; i++) {
      const p = profilePts[i];
      // Vertex at portal entrance (z = 0)
      shellPositions.push(p.x, p.y, 0);
      // Vertex at excavation face (z = pullL)
      shellPositions.push(p.x, p.y, pullL);
    }

    for (let i = 0; i < numPts; i++) {
      const next = (i + 1) % numPts;
      const v0 = i * 2;        // p[i] at z = 0
      const v1 = i * 2 + 1;    // p[i] at z = pullL
      const v2 = next * 2 + 1; // p[next] at z = pullL
      const v3 = next * 2;     // p[next] at z = 0

      // Quad divided into 2 triangles (outward & inward smooth normal)
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
    // Triangulated for arbitrary custom polygons (triangles, horseshoe, gothic arch, non-symmetric caverns)
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
        // Fallback to centroid fan
        const avgX = profilePts.reduce((s, p) => s + p.x, 0) / numPts;
        const avgY = profilePts.reduce((s, p) => s + p.y, 0) / numPts;
        facePositions.push(avgX, avgY, pullL);
        for (let i = 0; i < numPts; i++) {
          const next = (i + 1) % numPts;
          faceIndices.push(numPts, i, next);
        }
      }
    } catch {
      // Fallback to centroid fan
      const avgX = profilePts.reduce((s, p) => s + p.x, 0) / numPts;
      const avgY = profilePts.reduce((s, p) => s + p.y, 0) / numPts;
      facePositions.push(avgX, avgY, pullL);
      for (let i = 0; i < numPts; i++) {
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

    // C. Excavation Face Contour (z = pullL) in Electric Cyan/Blue (Crisp & Distinct)
    const faceContourPoints: THREE.Vector3[] = [];
    for (const pt of profilePts) {
      faceContourPoints.push(new THREE.Vector3(pt.x, pt.y, pullL));
    }
    faceContourPoints.push(new THREE.Vector3(profilePts[0].x, profilePts[0].y, pullL));
    const faceContourGeo = new THREE.BufferGeometry().setFromPoints(faceContourPoints);
    const faceContourMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 3 });
    const faceContourLine = new THREE.Line(faceContourGeo, faceContourMat);
    tunnelGroup.add(faceContourLine);

    // D. Portal Entrance Outline at z = 0 (Open Portal, Soft Slate)
    const prevContourPoints: THREE.Vector3[] = [];
    for (const pt of profilePts) {
      prevContourPoints.push(new THREE.Vector3(pt.x, pt.y, 0));
    }
    prevContourPoints.push(new THREE.Vector3(profilePts[0].x, profilePts[0].y, 0));
    const prevContourGeo = new THREE.BufferGeometry().setFromPoints(prevContourPoints);
    const prevContourMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, linewidth: 1.5 });
    const prevContourLine = new THREE.Line(prevContourGeo, prevContourMat);
    tunnelGroup.add(prevContourLine);

    // E. Longitudinal Generator Rails along Key Shape Vertices
    const railPositions: number[] = [];
    if (customPoints && customPoints.length >= 3 && numPts <= 12) {
      for (const p of profilePts) {
        railPositions.push(p.x, p.y, 0, p.x, p.y, pullL);
      }
    } else {
      railPositions.push(
        0, 0.01, 0, 0, 0.01, pullL,      // Left Invert footing
        w, 0.01, 0, w, 0.01, pullL,      // Right Invert footing
        0, hw, 0, 0, hw, pullL,          // Left Springline (SPL)
        w, hw, 0, w, hw, pullL,          // Right Springline (SPL)
        cx, h, 0, cx, h, pullL           // Crown Apex
      );
    }
    const railsGeo = new THREE.BufferGeometry();
    railsGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPositions, 3));
    const railsMat = new THREE.LineBasicMaterial({ color: 0x64748b, linewidth: 1.5 });
    const railsLines = new THREE.LineSegments(railsGeo, railsMat);
    tunnelGroup.add(railsLines);

    scene.add(tunnelGroup);

    // 7. Dynamic Joint Group (rebuilt only when orientation changes)
    const jointGroup = new THREE.Group();
    jointGroupRef.current = jointGroup;
    scene.add(jointGroup);

    // 8. Animation Render Loop (with target panning and live compass sync)
    const render = () => {
      const cam = camSphericalRef.current;
      const target = targetOffsetRef.current;
      const targetX = cx + target.x;
      const targetY = cy + target.y;
      const targetZ = cz + target.z;

      const x = targetX + cam.radius * Math.sin(cam.phi) * Math.sin(cam.theta);
      const y = targetY + cam.radius * Math.cos(cam.phi);
      const z = targetZ + cam.radius * Math.sin(cam.phi) * Math.cos(cam.theta);

      camera.position.set(x, y, z);
      camera.lookAt(targetX, targetY, targetZ);

      // Real-time camera theta sync for Compass Rose (sub-degree precision)
      const thetaDeg = Math.round((cam.theta * 180 / Math.PI) * 10) / 10;
      if (Math.abs(thetaDeg - lastThetaDegRef.current) >= 0.5) {
        lastThetaDegRef.current = thetaDeg;
        setCameraTheta(cam.theta);
      }

      renderer.render(scene, camera);
      animFrameIdRef.current = requestAnimationFrame(render);
    };
    render();

    // 9. HIGH-PERFORMANCE MOUSE & TOUCH CONTROLS (ORBIT, PINCH-ZOOM & PAN MOVE)
    let isMouseDown = false;
    let mouseButton = 0;
    let prevMouse = { x: 0, y: 0 };

    // Pinch & Multi-Touch State
    let touchMode: 'NONE' | 'ORBIT' | 'PINCH_PAN' = 'NONE';
    let prevTouch = { x: 0, y: 0 };
    let initialPinchDist = 0;
    let initialRadius = 17;
    let initialMidpoint = { x: 0, y: 0 };
    let initialTarget = { x: 0, y: 0, z: 0 };

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

      // Right-click (2), Middle-click (1), or Shift+Left-click (0 with shiftKey) -> MOVE / PAN
      if (mouseButton === 2 || mouseButton === 1 || (mouseButton === 0 && e.shiftKey)) {
        const panSpeed = cam.radius * 0.0016;
        const rightX = Math.cos(cam.theta);
        const rightZ = -Math.sin(cam.theta);
        target.x -= rightX * dx * panSpeed;
        target.z -= rightZ * dx * panSpeed;
        target.y += dy * panSpeed;
      } else if (mouseButton === 0) {
        // Left-click -> ORBIT
        cam.theta -= dx * 0.007;
        cam.phi = Math.max(0.04, Math.min(Math.PI - 0.04, cam.phi - dy * 0.007));
      }
    };

    const onMouseUp = () => {
      isMouseDown = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = camSphericalRef.current;
      cam.radius = Math.max(3, Math.min(55, cam.radius + e.deltaY * 0.015));
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // allow right-drag pan without opening browser context menu
    };

    // Touch Event Handlers: 1-finger Orbit, 2-finger Pinch Zoom & Pan Move
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchMode = 'ORBIT';
        prevTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length >= 2) {
        touchMode = 'PINCH_PAN';
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        initialPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        initialRadius = camSphericalRef.current.radius;
        initialMidpoint = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
        initialTarget = { ...targetOffsetRef.current };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchMode === 'NONE') return;
      if (e.cancelable) e.preventDefault();
      const cam = camSphericalRef.current;
      const target = targetOffsetRef.current;

      if (e.touches.length === 1 && touchMode === 'ORBIT') {
        const t = e.touches[0];
        const dx = t.clientX - prevTouch.x;
        const dy = t.clientY - prevTouch.y;
        prevTouch = { x: t.clientX, y: t.clientY };

        cam.theta -= dx * 0.007;
        cam.phi = Math.max(0.04, Math.min(Math.PI - 0.04, cam.phi - dy * 0.007));
      } else if (e.touches.length >= 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const currentMidpoint = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };

        // 1. Pinch Zoom
        if (initialPinchDist > 0) {
          const scale = initialPinchDist / Math.max(10, currentDist);
          cam.radius = Math.max(3, Math.min(55, initialRadius * scale));
        }

        // 2. Two-Finger Pan / Move
        const dMidX = currentMidpoint.x - initialMidpoint.x;
        const dMidY = currentMidpoint.y - initialMidpoint.y;
        const panSpeed = cam.radius * 0.0016;
        const rightX = Math.cos(cam.theta);
        const rightZ = -Math.sin(cam.theta);

        target.x = initialTarget.x - rightX * dMidX * panSpeed;
        target.z = initialTarget.z - rightZ * dMidX * panSpeed;
        target.y = initialTarget.y + dMidY * panSpeed;
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
      renderer.dispose();
      tunnelGeo.dispose();
      tunnelMat.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      railsGeo.dispose();
      railsMat.dispose();
    };
  }, [activeTab, tunnelGeometry]);

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
      currentJoint.panel === 'crown' || isStrikeLineHingeLocked;
    const wArch = tunnelGeometry.widthM || 8.5;
    const hArch = tunnelGeometry.heightM || 7.5;
    const hwArch = tunnelGeometry.wallHeightM || 4.2;
    const archRiseVal = Math.max(0.5, hArch - hwArch);
    const getCrownArchRoofY = (xPos: number): number => {
      const normX = Math.max(-1, Math.min(1, (xPos - wArch / 2) / Math.max(0.1, wArch / 2)));
      return hwArch + archRiseVal * Math.sqrt(Math.max(0, 1 - normX * normX));
    };

    // 1. 3D Joint Cutting Plane Mesh
    if (showInteriorPlane) {
      const grpColor = FIELD_JOINT_GROUP_COLORS[jointSetId]?.stroke || '#d97706';

      if (planeDisplayMode === 'TRACED_LENGTH') {
        // Traced Joint Length Plane: spans strictly the exact 2D traced joint length (-R_s to +R_s along the traced axis)
        const R_s = tracedHalfLen;
        let R_up = R_s;
        let R_down = R_s;
        if (isCrownNonPenetratingHinge) {
          // Crown strike line hinge plane in 3D joint inspection:
          // Top edge is strictly the Crown Strike Line Hinge (R_up = 0, never penetrates above the crown arch)
          // and pivots downward toward the invert at dipAmount (ideal 90°) relative to the strike direction!
          R_up = 0;
          const dipSin = Math.max(0.25, Math.sin((dipAmount * Math.PI) / 180));
          const maxToInvert = Math.max(0.5, ay / dipSin);
          R_down =
            tracedPlaneDepthMode === 'HALF_TRACE'
              ? Math.min(maxToInvert, R_s)
              : Math.min(maxToInvert, R_s * 2);
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

        const numCols = 16;
        const numRows = 12;
        const tracedPositions: number[] = [];
        const tracedNormals: number[] = [];
        const tracedUvs: number[] = [];
        const tracedIndices: number[] = [];

        for (let r = 0; r <= numRows; r++) {
          const vFrac = r / numRows;
          const vDist = -R_up + vFrac * (R_up + R_down);
          for (let c = 0; c <= numCols; c++) {
            const uFrac = c / numCols;
            const uDist = -R_s + uFrac * (2 * R_s);

            const px = ax + uDist * sx + vDist * dx;
            const hingeRoofY = isCrownNonPenetratingHinge
              ? Math.min(ay + uDist * sy, getCrownArchRoofY(ax + uDist * sx))
              : ay + uDist * sy;
            const rawPy = hingeRoofY + vDist * dy;
            const py = isCrownNonPenetratingHinge
              ? Math.max(0, Math.min(rawPy, getCrownArchRoofY(px)))
              : rawPy;
            const pz = az + uDist * sz + vDist * dz;

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

        // Exact Traced Length Plane Perimeter Outline (following non-penetrating crown hinge along top edge)
        const getPt = (uDist: number, vDist: number): [number, number, number] => {
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

        const borderPos: number[] = [];
        for (let c = 0; c < numCols; c++) {
          const u0 = -R_s + (c / numCols) * (2 * R_s);
          const u1 = -R_s + ((c + 1) / numCols) * (2 * R_s);
          borderPos.push(...getPt(u0, -R_up), ...getPt(u1, -R_up));
          borderPos.push(...getPt(u0, R_down), ...getPt(u1, R_down));
        }
        borderPos.push(...getPt(-R_s, -R_up), ...getPt(-R_s, R_down));
        borderPos.push(...getPt(R_s, -R_up), ...getPt(R_s, R_down));

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
            const u0 = -R_s + (c / numCols) * (2 * R_s);
            const u1 = -R_s + ((c + 1) / numCols) * (2 * R_s);
            gridPositions.push(...getPt(u0, step), ...getPt(u1, step));
          }
        }
        for (let step = -R_s + gridStep; step < R_s - 0.02; step += gridStep) {
          if (Math.abs(step) < 0.05) continue;
          gridPositions.push(...getPt(step, -R_up), ...getPt(step, R_down));
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

        // Exact 3D Polyline of the 2D Mapped Trace Points on the surface
        if (currentJoint.points && currentJoint.points.length >= 2) {
          const polyPts = currentJoint.points.map((pt) => {
            const m = pointToTunnel3DMetric(pt, currentJoint.panel || 'face', tunnelGeometry);
            return new THREE.Vector3(m.y, m.z, m.x);
          });
          const polyGeo = new THREE.BufferGeometry().setFromPoints(polyPts);
          const polyMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 4 });
          group.add(new THREE.Line(polyGeo, polyMat));
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

    // 3. Downward Dip Direction Arrow (Vibrant Amber / Gold)
    const dipArrowLen =
      planeDisplayMode === 'TRACED_LENGTH'
        ? Math.max(0.65, Math.min(2.2, tracedHalfLen * 1.15))
        : 2.4;
    const rawDipDir = new THREE.Vector3(plane.dipVector.y, plane.dipVector.z, plane.dipVector.x);
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

        // Terminal Gold Spheres
        const hingeSphereGeo = new THREE.SphereGeometry(0.1, 16, 16);
        const hingeSphereMat = new THREE.MeshStandardMaterial({
          color: 0xfde047,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.9,
        });
        const sp1 = new THREE.Mesh(hingeSphereGeo, hingeSphereMat);
        sp1.position.copy(v1);
        group.add(sp1);

        const sp2 = new THREE.Mesh(hingeSphereGeo, hingeSphereMat);
        sp2.position.copy(v2);
        group.add(sp2);

        // Billboard tag along hinge axis
        const hMid = v1.clone().add(v2).multiplyScalar(0.5);
        const panelName = currentJoint.panel === 'crown'
          ? 'CROWN ARCH AXIS'
          : currentJoint.panel === 'left_wall'
          ? 'LEFT WALL HINGE'
          : currentJoint.panel === 'right_wall'
          ? 'RIGHT WALL HINGE'
          : 'FACE HINGE AXIS';
        const tagAction = currentJoint.panel === 'crown' ? 'DIP TILT' : 'ROTATION';
        const hLabel = createBillboardLabel(
          `★ ${panelName}: ${hingePlaneResult.traceLengthM.toFixed(2)}m (${hingeDipDeg}° ${tagAction})`,
          '#78350F',
          '#FEF08A',
          3.8,
          0.65
        );
        hLabel.position.set(hMid.x, hMid.y + 0.38, hMid.z + 0.06);
        group.add(hLabel);
      }
    }

    // 5b. Billboard directly at Anchor / Crown Strike Cut Point
    const billboardLabelText = isHingeRotationActive && hingePlaneResult
      ? `DIP: ${hingePlaneResult.derivedDipDeg}° ➔ ${hingePlaneResult.derivedDipDirectionDeg}° | L=${currentTraceLengthM}m`
      : isCrownJoint
      ? `CROWN STRIKE: ${strikeInfo.strikePairLabel}`
      : `DIP: ${dipAmount}° ➔ ${dipDirection}° | L=${currentTraceLengthM}m`;
    const planeDipSprite = createBillboardLabel(
      billboardLabelText,
      '#0F172A',
      isCrownJoint ? '#38BDF8' : '#FCD34D',
      isCrownJoint ? 3.6 : 2.8,
      0.65
    );
    planeDipSprite.position.set(ax, ay + (isCrownJoint ? 0.55 : 0.42), az);
    group.add(planeDipSprite);

    // 6. Clean Multi-Surface Intersection Traces in 3D (Shown for EXTENDED and CLIPPED full-tunnel modes)
    if (planeDisplayMode !== 'TRACED_LENGTH') {
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

      // Crown Arch Intersection Trace in Emerald Green
      if (surfaceIntersections.crown) {
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
    hingePlaneResult,
    hingeDipDeg,
    currentTraceLengthM,
    isStrikeLineHingeLocked,
  ]);

  // -------------------------------------------------------------------------
  // SAVE HANDLER
  // -------------------------------------------------------------------------
  const handleSaveInspection = () => {
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
          ? `Georeferenced to Tunnel Drive Axis N ${Math.round(tunnelGeometry.driveAzimuthDeg)}° E`
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

    const updated: FieldJointTrace = {
      ...currentJoint,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 bg-slate-900">
      <div
        className={`w-full max-w-full h-full h-[100dvh] flex flex-col rounded-none shadow-none overflow-hidden transition-colors border-0 ${
          isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-900 text-slate-100'
        }`}
      >
        {/* ===================================================================
            HEADER: TITLE, STATUS & ACTION BUTTONS (FULL LIGHT/DARK THEME ADOPTION)
            =================================================================== */}
        <header
          className={`flex-none px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b transition-colors ${
            isLight
              ? 'bg-white/95 text-slate-900 border-slate-200 shadow-xs'
              : 'bg-slate-900/95 text-slate-100 border-slate-700/80 shadow-xs'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center font-black transition-colors ${
                isLight
                  ? 'bg-amber-100 border-amber-400 text-amber-700'
                  : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
              }`}
            >
              <Compass className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  className={`font-mono font-black text-sm sm:text-base tracking-wide transition-colors ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  NATM 3D JOINT INSPECTOR &amp; MULTI-SURFACE PERSISTENCE
                </h2>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Horizontal & Vertical Adaptive Mode Segmented Controls */}
            <div className="flex items-center p-0.5 rounded-xl bg-slate-800/90 border border-slate-700/80 font-mono text-[11px] font-bold shadow-inner">
              <button
                type="button"
                onClick={() => setViewLayoutMode('CANVAS')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewLayoutMode === 'CANVAS'
                    ? 'bg-amber-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Show 3D Viewport Only (Full Canvas)"
              >
                <Box className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">3D Canvas</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayoutMode('SPLIT')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewLayoutMode === 'SPLIT'
                    ? 'bg-amber-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Split View (Show both 3D Viewport and Parameters)"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Split View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayoutMode('PARAMS')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewLayoutMode === 'PARAMS'
                    ? 'bg-amber-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Show Parameters & Audit Only (Full Aside)"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Parameters</span>
              </button>
            </div>

            {/* In Vertical Mode: Quick Canvas Position Inverter (Top vs Bottom) */}
            {isVerticalMode && viewLayoutMode === 'SPLIT' && (
              <button
                type="button"
                onClick={() => setVerticalCanvasPosition((prev) => (prev === 'top' ? 'bottom' : 'top'))}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white border border-slate-700 transition-colors cursor-pointer text-[10.5px] font-mono font-bold flex items-center gap-1 shadow-sm"
                title="Swap vertical placement of 3D Canvas and Parameters"
              >
                <RotateCcw className="w-3 h-3 text-cyan-400" />
                <span>{verticalCanvasPosition === 'top' ? '3D: Top' : '3D: Bottom'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-xl border cursor-pointer transition-colors ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border-slate-700'
              }`}
              title="Close 3D Joint Inspector"
            >
              <X className="w-5 h-5" />
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
                  Joint {currentJoint.id} ({currentJoint.panel})
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
                    title="Collapse Sidebar to maximize 3D tunnel viewport"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Collapse</span>
                  </button>
                </div>
              </div>

              {/* TOP CARD: OTHER TRACED JOINTS IN ROUND (Instant Switching & Editing) */}
              <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700/80 shadow-lg space-y-3">
                <div className="flex items-center justify-between border-b border-slate-700/70 pb-1.5">
                  <span className="font-bold text-amber-300 uppercase flex items-center gap-1.5 text-xs">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span>Traced Joints in Round ({allRoundJoints.length})</span>
                  </span>
                  <span className="text-[10px] text-cyan-300 font-bold">Click to Switch &amp; Edit</span>
                </div>

              {allRoundJoints.length === 0 ? (
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
                                {j.panel.replace('_', ' ')}
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

              {/* Instant Save & Reflect on Face Canvas Button inside Card */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleSaveInspection}
                  className={`w-full py-2 px-3 rounded-xl font-mono text-xs font-black cursor-pointer transition-all flex items-center justify-center gap-2 shadow-md ${
                    saveStatus === 'SAVED'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  }`}
                >
                  {saveStatus === 'SAVED' ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Reflected on Face Canvas!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save &amp; Reflect on Face Canvas</span>
                    </>
                  )}
                </button>
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
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] font-bold text-amber-300">
                        Face Trace Hinge Axis:
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
                        {hingeDipDeg}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={90}
                      value={hingeDipDeg}
                      onChange={(e) => setHingeDipDeg(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                    />
                    {/* Quick Preset Angles */}
                    <div className="flex items-center justify-between gap-1 pt-1">
                      {[90, 75, 60, 45, 30, 15].map((deg) => (
                        <button
                          key={deg}
                          type="button"
                          onClick={() => setHingeDipDeg(deg)}
                          className={`flex-1 py-1 rounded text-[9.5px] font-mono cursor-pointer border transition-all ${
                            hingeDipDeg === deg
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
                      <span>Dipping Side relative to Face:</span>
                      <span className="font-mono font-bold text-amber-300">
                        {hingeDipSide === 'heading' ? 'Ahead (+Z Advance)' : 'Back (-Z Portal)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setHingeDipSide('heading')}
                        className={`py-1.5 px-2 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                          hingeDipSide === 'heading'
                            ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-sm'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                      >
                        Dip Ahead into Heading (+Z)
                      </button>
                      <button
                        type="button"
                        onClick={() => setHingeDipSide('collar')}
                        className={`py-1.5 px-2 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                          hingeDipSide === 'collar'
                            ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-sm'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                      >
                        Dip Back to Collar (-Z)
                      </button>
                    </div>
                  </div>

                  {/* Live Derived Geological Orientation */}
                  <div className="p-2 rounded bg-slate-800/90 border border-slate-700/80 shadow-md flex items-center justify-between text-[10px] font-mono">
                    <div>
                      <span className="text-slate-400">Derived Dip: </span>
                      <strong className="text-amber-400 font-bold">{hingePlaneResult?.derivedDipDeg ?? dipAmount}°</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Dip Dir: </span>
                      <strong className="text-cyan-400 font-bold">
                        {hingePlaneResult?.derivedDipDirectionDeg ?? dipDirection}°
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Strike: </span>
                      <strong className="text-emerald-400 font-bold">
                        {hingePlaneResult?.strikeRhrDeg ?? strikeInfo.strikeRhrDeg}°
                      </strong>
                    </div>
                  </div>

                  {/* Crown Portion / SPL-to-SPL Strike Line Hinge Lock Toggle */}
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
                      Crown Portion Strike Hinge Mode (Lock Strike {strikeInfo.strikePairLabel} as non-penetrating hinge when decreasing dip)
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
                        {currentJoint.panel === 'left_wall' ? 'Left Wall' : 'Right Wall'} Trace Hinge Axis:
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/40 text-[10px]">
                      Trace: {hingePlaneResult?.traceLengthM.toFixed(2) ?? '0.00'}m
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-300 leading-snug">
                    The traced joint line on the {currentJoint.panel === 'left_wall' ? 'left sidewall' : 'right sidewall'} is locked as the <strong className="text-emerald-300">stationary hinge axis</strong>. Sliding the angle rotates the 3D plane into the rock mass or tunnel opening without drifting.
                  </p>

                  {/* Live Dip Angle Slider around Sidewall Traced Line */}
                  <div className="space-y-1.5 bg-slate-900/90 p-2.5 rounded-lg border border-emerald-500/20">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-200">Rotation Angle Around Wall Trace (Dip δ):</span>
                      <span className="font-mono font-black text-emerald-400 bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-500/50 text-xs shadow-sm">
                        {hingeDipDeg}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={90}
                      value={hingeDipDeg}
                      onChange={(e) => setHingeDipDeg(Number(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                    />
                    {/* Quick Preset Angles */}
                    <div className="flex items-center justify-between gap-1 pt-1">
                      {[90, 75, 60, 45, 30, 15].map((deg) => (
                        <button
                          key={deg}
                          type="button"
                          onClick={() => setHingeDipDeg(deg)}
                          className={`flex-1 py-1 rounded text-[9.5px] font-mono cursor-pointer border transition-all ${
                            hingeDipDeg === deg
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
                      <span>Dipping Side relative to Wall:</span>
                      <span className="font-mono font-bold text-emerald-300">
                        {hingeDipSide === 'heading'
                          ? (currentJoint.panel === 'left_wall' ? 'Into Left Rock (+Y)' : 'Into Right Rock (-Y)')
                          : 'Into Tunnel Opening'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setHingeDipSide('heading')}
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
                        onClick={() => setHingeDipSide('collar')}
                        className={`py-1.5 px-2 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                          hingeDipSide === 'collar'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-sm'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                      >
                        Dip into Tunnel Cavity
                      </button>
                    </div>
                  </div>

                  {/* Live Derived Geological Orientation */}
                  <div className="p-2 rounded bg-slate-800/90 border border-slate-700/80 shadow-md flex items-center justify-between text-[10px] font-mono">
                    <div>
                      <span className="text-slate-400">Derived Dip: </span>
                      <strong className="text-emerald-400 font-bold">{hingePlaneResult?.derivedDipDeg ?? dipAmount}°</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Dip Dir: </span>
                      <strong className="text-cyan-400 font-bold">
                        {hingePlaneResult?.derivedDipDirectionDeg ?? dipDirection}°
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Strike: </span>
                      <strong className="text-amber-400 font-bold">
                        {hingePlaneResult?.strikeRhrDeg ?? strikeInfo.strikeRhrDeg}°
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
                    <span>Strictly lock rotation axis to mapped trace on sidewall (Recommended)</span>
                  </label>
                </div>
              )}

              {/* CROWN TRACE DIP AMOUNT & PLANE TILT CONTROL */}
              {isCrownTrace && isHingeRotationActive && (
                <div className="p-3 rounded-lg bg-gradient-to-br from-sky-500/15 via-slate-900 to-sky-950/20 border border-sky-500/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                      <span className="text-[11px] font-bold text-sky-300">
                        Crown Strike Line Hinge &amp; Dip Tilt:
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono font-bold border border-sky-500/40 text-[10px]">
                      Strike Locked: {strikeInfo.strikePairLabel}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-300 leading-snug">
                    The mapped Crown trace (<strong className="text-sky-300">{strikeInfo.strikePairLabel}</strong>) acts as a <strong className="text-sky-300">fixed non-penetrating Strike Line Hinge</strong> on the crown arch. Decreasing Dip Amount pivots the plane strictly downward from the crown hinge without penetrating the crown or changing Strike.
                  </p>

                  {/* Live Dip Amount Slider */}
                  <div className="space-y-1.5 bg-slate-900/90 p-2.5 rounded-lg border border-sky-500/20">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-200">Crown Strike Dip Amount (δ):</span>
                      <span className="font-mono font-black text-sky-400 bg-sky-950/90 px-2 py-0.5 rounded border border-sky-500/50 text-xs shadow-sm">
                        {hingeDipDeg}° {hingeDipDeg === 90 ? '(Ideal 90° to Strike)' : ''}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={90}
                      value={hingeDipDeg}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setHingeDipDeg(val);
                        setDipAmount(val);
                      }}
                      className="w-full accent-sky-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                    />
                    {/* Quick Preset Angles */}
                    <div className="flex items-center justify-between gap-1 pt-1">
                      {[90, 80, 75, 60, 45, 30].map((deg) => (
                        <button
                          key={deg}
                          type="button"
                          onClick={() => {
                            setHingeDipDeg(deg);
                            setDipAmount(deg);
                          }}
                          className={`flex-1 py-1 rounded text-[9.5px] font-mono cursor-pointer border transition-all ${
                            hingeDipDeg === deg
                              ? 'bg-sky-500 text-slate-950 border-sky-300 font-bold shadow-sm'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {deg === 90 ? '90° Ideal' : `${deg}°`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tilt Direction Side (Relative to Strike Direction) */}
                  <div className="space-y-1 pt-0.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-300">
                      <span>Dip Side Relative to Strike:</span>
                      <span className="font-mono font-bold text-sky-300">
                        {hingeDipSide === 'heading' ? 'Strike + 90° (RHR Side)' : 'Strike - 90° (Opposite Side)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setHingeDipSide('heading')}
                        className={`py-1.5 px-2 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                          hingeDipSide === 'heading'
                            ? 'bg-sky-500 text-slate-950 border-sky-300 shadow-sm'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                      >
                        Dip Side +90° to Strike
                      </button>
                      <button
                        type="button"
                        onClick={() => setHingeDipSide('collar')}
                        className={`py-1.5 px-2 rounded text-[10px] font-bold cursor-pointer transition-all border ${
                          hingeDipSide === 'collar'
                            ? 'bg-sky-500 text-slate-950 border-sky-300 shadow-sm'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                      >
                        Dip Side -90° to Strike
                      </button>
                    </div>
                  </div>

                  {/* Live Derived Orientation */}
                  <div className="p-2 rounded bg-slate-800/90 border border-slate-700/80 shadow-md flex items-center justify-between text-[10px] font-mono">
                    <div>
                      <span className="text-slate-400">Dip Amount: </span>
                      <strong className="text-sky-400 font-bold">{hingePlaneResult?.derivedDipDeg ?? dipAmount}°</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Dip Dir: </span>
                      <strong className="text-cyan-400 font-bold">
                        {hingePlaneResult?.derivedDipDirectionDeg ?? dipDirection}°
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Strike (RHR): </span>
                      <strong className="text-emerald-400 font-bold">
                        {hingePlaneResult?.strikeRhrDeg ?? strikeInfo.strikeRhrDeg}°
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
                      className="accent-sky-500 rounded cursor-pointer"
                    />
                    <span>Tilt plane strictly relative to crown strike direction (Recommended)</span>
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
                      <span>Lock 3D orientation strictly to mapped trace on {currentJoint.panel.replace('_', ' ')} (Trace Hinge Mode)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Crown Joint 3D Orientation & Dip Control (Strike-Derived) */}
              {currentJoint.panel === 'crown' && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-amber-300">Crown Strike Axis:</span>
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
                      Clipped to Tunnel Box
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

            {/* WHERE THIS PLANE CUTS THE TUNNEL */}
            <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700/80 shadow-md space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-700/70 pb-1.5">
                <span className="font-bold text-amber-400 uppercase flex items-center gap-1.5 text-xs">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>Where Plane Cuts Tunnel</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">
                  Total Cut: {surfaceIntersections.totalCalculatedM}m
                </span>
              </div>

              {/* Status for each surface */}
              <div className="space-y-1.5 text-[11px] font-mono">
                {/* 1. Excavation Face */}
                <div className={`p-2 rounded-lg border flex items-center justify-between ${
                  surfaceIntersections.face
                    ? 'bg-cyan-950/40 border-cyan-700/60 text-cyan-200'
                    : 'bg-slate-900 border-slate-700/70 text-slate-500'
                }`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{surfaceIntersections.face ? '✅' : '—'}</span>
                    <strong className={surfaceIntersections.face ? 'text-white' : 'text-slate-400'}>Excavation Face:</strong>
                  </div>
                  <span className="font-bold">
                    {surfaceIntersections.face ? `Cuts Face (${surfaceIntersections.face.lengthM}m)` : 'Does not cut'}
                  </span>
                </div>

                {/* 2. Crown Arch */}
                <div className={`p-2 rounded-lg border flex items-center justify-between ${
                  surfaceIntersections.crown
                    ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                    : 'bg-slate-900 border-slate-700/70 text-slate-500'
                }`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{surfaceIntersections.crown ? '✅' : '—'}</span>
                    <strong className={surfaceIntersections.crown ? 'text-white' : 'text-slate-400'}>Crown Arch:</strong>
                  </div>
                  <span className="font-bold">
                    {surfaceIntersections.crown ? `Cuts Crown (${surfaceIntersections.crown.lengthM}m)` : 'Does not cut'}
                  </span>
                </div>

                {/* 3. Left Wall */}
                <div className={`p-2 rounded-lg border flex items-center justify-between ${
                  surfaceIntersections.leftWall
                    ? 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                    : 'bg-slate-900 border-slate-700/70 text-slate-500'
                }`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{surfaceIntersections.leftWall ? '✅' : '—'}</span>
                    <strong className={surfaceIntersections.leftWall ? 'text-white' : 'text-slate-400'}>Left Sidewall:</strong>
                  </div>
                  <span className="font-bold">
                    {surfaceIntersections.leftWall ? `Cuts Left Wall (${surfaceIntersections.leftWall.lengthM}m)` : 'Does not cut'}
                  </span>
                </div>

                {/* 4. Right Wall */}
                <div className={`p-2 rounded-lg border flex items-center justify-between ${
                  surfaceIntersections.rightWall
                    ? 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                    : 'bg-slate-900 border-slate-700/70 text-slate-500'
                }`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{surfaceIntersections.rightWall ? '✅' : '—'}</span>
                    <strong className={surfaceIntersections.rightWall ? 'text-white' : 'text-slate-400'}>Right Sidewall:</strong>
                  </div>
                  <span className="font-bold">
                    {surfaceIntersections.rightWall ? `Cuts Right Wall (${surfaceIntersections.rightWall.lengthM}m)` : 'Does not cut'}
                  </span>
                </div>
              </div>
            </div>

            {/* TRUE DIP VS. SURFACE APPARENT DIPS MATRIX (CLARIFIES GEOLOGICAL CONFUSION) */}
            <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700/80 shadow-md space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5">
                <span className="font-bold text-amber-400 uppercase flex items-center gap-1.5 text-xs">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <span>True Dip vs. Surface Apparent Dips</span>
                </span>
                <span className="text-[10px] text-cyan-300 font-mono font-bold">
                  Heading N {Math.round(tunnelGeometry.driveAzimuthDeg ?? 0)}° E
                </span>
              </div>

              {/* Surface-by-surface Apparent Dip Breakdown */}
              <div className="space-y-1.5 text-[11px] font-mono">
                {/* 1. Excavation Face */}
                <div className="p-2.5 rounded-lg bg-slate-800/90 border border-slate-700/80 shadow-md flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <strong className="text-cyan-400">Excavation Face</strong>
                      <span className="text-[9.5px] text-slate-500 font-sans">(Transverse, 90° to Drive)</span>
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

                {/* 2. Left Sidewall */}
                <div className="p-2.5 rounded-lg bg-slate-800/90 border border-slate-700/80 shadow-md flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <strong className="text-slate-300">Left Sidewall</strong>
                      <span className="text-[9.5px] text-slate-500 font-sans">(Longitudinal, 0° to Drive)</span>
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

                {/* 3. Right Sidewall */}
                <div className="p-2.5 rounded-lg bg-slate-800/90 border border-slate-700/80 shadow-md flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <strong className="text-slate-300">Right Sidewall</strong>
                      <span className="text-[9.5px] text-slate-500 font-sans">(Longitudinal, 0° to Drive)</span>
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

                {/* 4. Crown Arch */}
                <div className="p-2.5 rounded-lg bg-slate-800/90 border border-slate-700/80 shadow-md flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <strong className="text-sky-300">Crown Arch / Back</strong>
                      <span className="text-[9.5px] text-slate-500 font-sans">(Horizontal Apex Tangent)</span>
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
                  <span className="text-[10px] text-slate-400 block">Face (m)</span>
                  <strong className="text-amber-300 text-sm font-mono">
                    {observedLengths.faceM > 0 ? `${observedLengths.faceM}m` : '—'}
                  </strong>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/90 border border-slate-700/80 shadow-md text-center">
                  <span className="text-[10px] text-slate-400 block">Left Wall (m)</span>
                  <strong className="text-amber-300 text-sm font-mono">
                    {observedLengths.leftWallM > 0 ? `${observedLengths.leftWallM}m` : '—'}
                  </strong>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/90 border border-slate-700/80 shadow-md text-center">
                  <span className="text-[10px] text-slate-400 block">Right Wall (m)</span>
                  <strong className="text-amber-300 text-sm font-mono">
                    {observedLengths.rightWallM > 0 ? `${observedLengths.rightWallM}m` : '—'}
                  </strong>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/90 border border-slate-700/80 shadow-md text-center">
                  <span className="text-[10px] text-slate-400 block">Crown (m)</span>
                  <strong className="text-amber-300 text-sm font-mono">
                    {observedLengths.crownM > 0 ? `${observedLengths.crownM}m` : '—'}
                  </strong>
                </div>
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
                  { id: 'VIEW_3D' as InspectionViewTab, label: '1. 3D Tunnel View' },
                  { id: 'VIEW_UNROLLED_COMBINED' as InspectionViewTab, label: '2. Unrolled 2D Developed View' },
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
                    title="Toggle Real-Time 3D Geological Compass synced with Tunnel Heading"
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
                      title="Show full extended cutting plane across the tunnel"
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
                      title="Show plane clipped to the tunnel bounding box"
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
                    title="Toggle vector legend overlay"
                  >
                    {showLegendOverlay ? <EyeOff className="w-3.5 h-3.5 text-amber-500" /> : <Eye className="w-3.5 h-3.5 text-cyan-500" />}
                    <span>{showLegendOverlay ? 'Hide Legend' : 'Show Legend'}</span>
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

                  {/* PROMINENT TOP-CENTER TUNNEL DRIVE DIRECTION BANNER (ALWAYS VISIBLE & ROTATING IN REAL-TIME WITH TUNNEL) */}
                  {(() => {
                    const thetaDeg = (cameraTheta * 180) / Math.PI;
                    const driveAngleDeg = ((-thetaDeg) % 360 + 360) % 360;
                    const driveAz = tunnelGeometry.driveAzimuthDeg || 0;

                    return (
                      <div
                        onClick={snapToTunnelDrive}
                        className={`absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full backdrop-blur-md shadow-2xl pointer-events-auto cursor-pointer z-30 flex items-center gap-2.5 font-mono text-xs font-bold transition-all hover:scale-105 active:scale-95 border-2 select-none ${
                          isLight
                            ? 'bg-white/95 border-cyan-600 text-slate-900 shadow-cyan-950/10'
                            : 'bg-slate-950/95 border-cyan-400 text-white shadow-cyan-500/20'
                        }`}
                        title="Click to synchronize 3D camera with Tunnel Drive Axis (+Z / 000° Heading)"
                      >
                        {/* Real-time Rotating Compass Vector Arrow synced with tunnel/camera orbit */}
                        <div
                          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 shadow-inner ${
                            isLight
                              ? 'bg-cyan-100 border-cyan-600 text-cyan-900'
                              : 'bg-cyan-950/90 border-cyan-400 text-cyan-300'
                          }`}
                        >
                          <div
                            className="w-full h-full flex items-center justify-center transition-transform duration-75 will-change-transform"
                            style={{ transform: `rotate(${driveAngleDeg}deg)` }}
                          >
                            <Navigation className="w-4 h-4 text-cyan-500 fill-cyan-500/40" />
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className={`font-black tracking-wide ${isLight ? 'text-cyan-800' : 'text-cyan-400'}`}>
                            ▲ TUNNEL DRIVE (+Z):
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-black border text-xs ${
                              isLight
                                ? 'bg-cyan-100 border-cyan-400 text-cyan-950'
                                : 'bg-cyan-500/25 border-cyan-400/50 text-cyan-100'
                            }`}
                          >
                            N {Math.round(driveAz)}° E (000° TUNNEL AXIS)
                          </span>
                        </div>

                        {/* Real-time view angle readout and Click to Sync button */}
                        <span
                          className={`text-[10.5px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                            isLight
                              ? 'bg-slate-200 text-slate-800 hover:bg-cyan-600 hover:text-white'
                              : 'bg-slate-800 text-cyan-300 hover:bg-cyan-500 hover:text-slate-950'
                          }`}
                        >
                          Sync View ({Math.round(driveAngleDeg)}°)
                        </span>
                      </div>
                    );
                  })()}

                  {/* TOP-LEFT: TUNNEL GEOMETRY & ADVANCE BADGE */}
                  <div
                    className={`absolute top-3 left-3 px-3 py-1.5 rounded-xl backdrop-blur-md shadow-xl pointer-events-none z-20 flex items-center gap-2 text-[11px] font-mono border transition-colors ${
                      isLight
                        ? 'bg-white/95 border-slate-300 text-slate-800'
                        : 'bg-slate-950/90 border-slate-700/80 text-white'
                    }`}
                  >
                    <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>Section:</span>
                    <strong className={isLight ? 'text-slate-900' : 'text-white'}>
                      {tunnelGeometry.widthM}m W × {tunnelGeometry.heightM}m H
                    </strong>
                    <span className={isLight ? 'text-slate-400' : 'text-slate-600'}>|</span>
                    <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>Advance:</span>
                    <strong className="text-amber-500 font-bold">{tunnelGeometry.pullLengthM || 3.0}m (Pull)</strong>
                  </div>

                  {/* =========================================================
                      REAL-TIME SYNCHRONIZED 3D GEOLOGICAL COMPASS ROSE (DIAL)
                      ========================================================= */}
                  {showCompass && (() => {
                    const driveAz = tunnelGeometry.driveAzimuthDeg || 0;
                    const thetaDeg = (cameraTheta * 180) / Math.PI;
                    // North rotation on screen plane
                    const northAngleDeg = (-driveAz - thetaDeg) % 360;
                    // Tunnel drive axis rotation on screen plane
                    const driveAngleDeg = (-thetaDeg) % 360;

                    return (
                      <div className="absolute top-14 right-3 z-20 font-mono select-none">
                        <div className="p-3 rounded-2xl bg-slate-950/92 backdrop-blur-md border border-cyan-500/40 shadow-2xl space-y-2 w-48 text-center text-xs">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                            <span className="font-bold text-[10px] text-cyan-300 uppercase flex items-center gap-1">
                              <Compass className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Geological Compass</span>
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

                          {/* Rotating 3D Compass Rose SVG */}
                          <div className="relative w-28 h-28 mx-auto my-1 flex items-center justify-center">
                            <svg viewBox="0 0 120 120" className="w-full h-full">
                              {/* Outer Fixed Bezel */}
                              <circle cx="60" cy="60" r="54" fill="#0f172a" stroke="#334155" strokeWidth="2" />
                              <circle cx="60" cy="60" r="48" fill="#020617" stroke="#1e293b" strokeWidth="1" />

                              {/* Rotating Dial Group (synced with camera & north) */}
                              <g transform={`rotate(${northAngleDeg} 60 60)`}>
                                {/* Azimuth Graduation Ticks (every 30 deg) */}
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

                                {/* Cardinal Direction Labels */}
                                <text x="60" y="27" fill="#f43f5e" fontSize="9" fontWeight="black" textAnchor="middle">N</text>
                                <text x="96" y="63" fill="#cbd5e1" fontSize="8" fontWeight="bold" textAnchor="middle">E</text>
                                <text x="60" y="100" fill="#cbd5e1" fontSize="8" fontWeight="bold" textAnchor="middle">S</text>
                                <text x="24" y="63" fill="#cbd5e1" fontSize="8" fontWeight="bold" textAnchor="middle">W</text>

                                {/* True North Needle (Red Arrow) */}
                                <polygon points="60,18 64,55 56,55" fill="#f43f5e" />
                                {/* South Needle (Silver) */}
                                <polygon points="60,102 64,65 56,65" fill="#94a3b8" />
                              </g>

                              {/* Tunnel Drive Heading Indicator (Cyan Line & Arrow) */}
                              <g transform={`rotate(${driveAngleDeg} 60 60)`}>
                                <line x1="60" y1="60" x2="60" y2="22" stroke="#06b6d4" strokeWidth="2.5" strokeDasharray="3,2" />
                                <polygon points="60,16 64,26 56,26" fill="#06b6d4" />
                              </g>

                              {/* Center Pivot Pivot Pin */}
                              <circle cx="60" cy="60" r="4.5" fill="#020617" stroke="#38bdf8" strokeWidth="2" />
                            </svg>
                          </div>

                          {/* Real-Time Synced Readouts */}
                          <div className="space-y-0.5 text-[9.5px] border-t border-slate-800 pt-1.5">
                            <div className="flex items-center justify-between text-slate-400">
                              <span>Tunnel Drive:</span>
                              <strong className="text-cyan-300">N {Math.round(driveAz)}° E</strong>
                            </div>
                            <div className="flex items-center justify-between text-slate-400">
                              <span>Camera Bearing:</span>
                              <strong className="text-amber-300">{Math.round((360 - (thetaDeg % 360)) % 360)}°</strong>
                            </div>
                          </div>

                          {/* Quick Snap View Buttons */}
                          <div className="grid grid-cols-2 gap-1 pt-1">
                            <button
                              type="button"
                              onClick={snapToNorth}
                              className="px-1.5 py-1 rounded bg-slate-900 hover:bg-rose-500 hover:text-slate-950 text-rose-300 border border-rose-900/40 text-[9px] font-bold cursor-pointer transition-colors"
                              title="Align 3D View to True North"
                            >
                              Snap North
                            </button>
                            <button
                              type="button"
                              onClick={snapToTunnelDrive}
                              className="px-1.5 py-1 rounded bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 border border-cyan-900/40 text-[9px] font-bold cursor-pointer transition-colors"
                              title="Align 3D View along Tunnel Drive Axis"
                            >
                              Snap Drive
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* PROMINENT PLANE DIP & AMOUNT ON CANVAS ALIGNED WITH PLANE */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-2xl bg-slate-950/95 border-2 border-amber-400 text-white shadow-2xl backdrop-blur-md flex items-center gap-3 font-mono text-xs z-30 select-none pointer-events-auto">
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-400 font-black uppercase text-[11px]">Plane Dip:</span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-black text-sm shadow">
                        {dipAmount ?? 60}°
                      </span>
                    </div>
                    <span className="text-slate-600">|</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-cyan-400 font-bold uppercase text-[11px]">Direction:</span>
                      <span className="px-2 py-0.5 rounded-lg bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-black">
                        ∠ {String(dipDirection ?? 135).padStart(3, '0')}° ({getTunnelRelativeDirectionLabel(dipDirection ?? 135)})
                      </span>
                    </div>
                    <span className="text-slate-600">|</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-[11px]">Strike:</span>
                      <strong className="text-amber-300 font-mono">
                        {strikeInfo.strikePairLabel}
                      </strong>
                    </div>
                  </div>

                  {/* HIGH-VISIBILITY 3D CUTTING PLANE HUD BADGE ALIGNED WITH THE PLANE */}
                  {showInteriorPlane && (
                    <div className="absolute bottom-3 left-3 p-2.5 rounded-xl bg-slate-950/95 backdrop-blur-md border border-amber-500/50 shadow-2xl pointer-events-none z-10 flex items-center gap-2.5 text-xs font-mono">
                      <div
                        className="w-4 h-4 rounded-full border-2 border-white/80 shadow-md shrink-0"
                        style={{ backgroundColor: FIELD_JOINT_GROUP_COLORS[jointSetId]?.stroke || '#f59e0b' }}
                      />
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-black">
                            {currentJoint.panel === 'crown' ? 'CROWN STRIKE PLANE:' : 'PLANE ORIENTATION:'}
                          </span>
                          <span className="text-white font-extrabold">
                            {currentJoint.panel === 'crown'
                              ? `STRIKE ${strikeInfo.strikePairLabel} (DIP ${dipAmount ?? 60}° ➔ ${dipDirection ?? 135}°)`
                              : `DIP ${dipAmount ?? 60}° ➔ ${dipDirection ?? 135}°`}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {currentJoint.panel === 'crown' ? 'Crown Cut Point' : 'Anchor Point'}: X {(anchorPoint?.x != null && !isNaN(anchorPoint.x) ? anchorPoint.x : 3.0).toFixed(2)}m (Toward Pull), Y {(anchorPoint?.y != null && !isNaN(anchorPoint.y) ? anchorPoint.y : 4.25).toFixed(2)}m, Z {(anchorPoint?.z != null && !isNaN(anchorPoint.z) ? anchorPoint.z : 3.75).toFixed(2)}m
                        </span>
                      </div>
                    </div>
                  )}

                  {/* OPTIONAL GEOLOGICAL VECTORS LEGEND OVERLAY (HIDDEN BY DEFAULT FOR CLEAN CANVAS) */}
                  {showLegendOverlay && (
                    <div className="absolute top-14 left-3 p-3 rounded-xl bg-slate-950/90 backdrop-blur-md border border-slate-800 font-mono text-[10.5px] space-y-1.5 shadow-xl pointer-events-none z-10">
                      <div className="font-bold text-amber-400 uppercase text-[11px] flex items-center justify-between">
                        <span>3D Geological Vectors</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded" style={{ backgroundColor: FIELD_JOINT_GROUP_COLORS[jointSetId]?.stroke || '#f59e0b' }} />
                        <span className="text-slate-100 font-bold">
                          Joint Plane {currentJoint.id} ({dipDirection}°/{dipAmount}°)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-0.5 bg-sky-500" />
                        <span className="text-sky-300">Strike Vector ({strikeInfo.strikeRhrDeg}°)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-0.5 bg-amber-500" />
                        <span className="text-amber-300">Downward Dip Vector ({dipDirection}°)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-0.5 bg-emerald-500" />
                        <span className="text-emerald-300">Plane Normal Vector</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                        <span className="text-red-300">
                          Anchor P0 ({anchorPoint.x.toFixed(1)}, {anchorPoint.y.toFixed(1)}, {anchorPoint.z.toFixed(1)})m
                        </span>
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

                        {activeTab === 'VIEW_FACE' && (
                          <path
                            d="M 50,310 L 50,150 Q 250,20 450,150 L 450,310 Z"
                            fill="#1e293b"
                            stroke="#0ea5e9"
                            strokeWidth="2"
                          />
                        )}

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
                        Developed 2D Tunnel View (Left Wall + Crown + Right Wall + Excavation Face)
                      </span>
                      <span className="text-xs text-amber-400 font-bold font-mono">
                        Joint {activeJoint.id} ({String(dipDirection).padStart(3, '0')}°/{dipAmount}° · {strikeInfo.strikePairLabel})
                      </span>
                    </div>

                    <div className="w-full bg-slate-950 rounded-xl border border-slate-800 p-4 overflow-x-auto">
                      <svg viewBox="0 0 940 280" className="w-full min-w-[780px] h-auto select-none">
                        {/* 1. LEFT WALL (X: 0..pullL, Z: 0..wallHeightM) */}
                        {tunnelGeometry.hasLeftWall !== false && (
                          <g>
                            <rect x="20" y="40" width="180" height="180" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
                            <text x="110" y="32" fill="#94a3b8" fontSize="10.5" fontWeight="bold" textAnchor="middle">
                              1. LEFT WALL (0..{tunnelGeometry.pullLengthM}m)
                            </text>
                            {/* Stationing ticks at 0m, 1m, 2m, pullL */}
                            <line x1="20" y1="220" x2="200" y2="220" stroke="#64748b" strokeWidth="1" />
                            <text x="20" y="235" fill="#64748b" fontSize="8.5" textAnchor="middle">0m</text>
                            <text x="200" y="235" fill="#64748b" fontSize="8.5" textAnchor="middle">{tunnelGeometry.pullLengthM}m</text>
                            <text x="110" y="248" fill="#64748b" fontSize="8.5" textAnchor="middle">Drive Advance (+X)</text>

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

                        {/* 2. CROWN ARCH / BACK (Y: 0..widthM, X: 0..pullL) */}
                        {tunnelGeometry.hasCrown !== false && (
                          <g>
                            <rect x="220" y="40" width="220" height="180" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
                            <text x="330" y="32" fill="#94a3b8" fontSize="10.5" fontWeight="bold" textAnchor="middle">
                              2. CROWN ARCH ({strikeInfo.strikePairLabel})
                            </text>
                            {/* Crown Centerline */}
                            <line x1="330" y1="40" x2="330" y2="220" stroke="#0284c7" strokeWidth="1" strokeDasharray="4,4" />
                            <text x="330" y="235" fill="#0284c7" fontSize="8.5" textAnchor="middle">C/L ({(tunnelGeometry.widthM / 2).toFixed(1)}m)</text>
                            <text x="220" y="235" fill="#64748b" fontSize="8.5" textAnchor="middle">L-SPL</text>
                            <text x="440" y="235" fill="#64748b" fontSize="8.5" textAnchor="middle">R-SPL</text>

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

                        {/* 3. RIGHT WALL (X: 0..pullL, Z: 0..wallHeightM) */}
                        {tunnelGeometry.hasRightWall !== false && (
                          <g>
                            <rect x="460" y="40" width="180" height="180" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
                            <text x="550" y="32" fill="#94a3b8" fontSize="10.5" fontWeight="bold" textAnchor="middle">
                              3. RIGHT WALL (0..{tunnelGeometry.pullLengthM}m)
                            </text>
                            <line x1="460" y1="220" x2="640" y2="220" stroke="#64748b" strokeWidth="1" />
                            <text x="460" y="235" fill="#64748b" fontSize="8.5" textAnchor="middle">0m</text>
                            <text x="640" y="235" fill="#64748b" fontSize="8.5" textAnchor="middle">{tunnelGeometry.pullLengthM}m</text>
                            <text x="550" y="248" fill="#64748b" fontSize="8.5" textAnchor="middle">Drive Advance (+X)</text>

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

                        {/* 4. TUNNEL FACE (Transverse Y: 0..widthM, Elevation Z: 0..heightM) */}
                        {(() => {
                          const customPts = tunnelGeometry.crossSectionPoints;
                          if (customPts && customPts.length >= 3) {
                            const minX = Math.min(...customPts.map((p) => p.x));
                            const maxX = Math.max(...customPts.map((p) => p.x));
                            const minY = Math.min(...customPts.map((p) => p.y));
                            const maxY = Math.max(...customPts.map((p) => p.y));
                            const spanX = Math.max(0.01, maxX - minX);
                            const spanY = Math.max(0.01, maxY - minY);
                            const polyPoints = customPts
                              .map((p) => {
                                const sx = 670 + ((p.x - minX) / spanX) * 240;
                                const sy = 220 - ((p.y - minY) / spanY) * 180;
                                return `${sx.toFixed(1)},${sy.toFixed(1)}`;
                              })
                              .join(' ');
                            return (
                              <polygon
                                points={polyPoints}
                                fill="#1e293b"
                                stroke="#0ea5e9"
                                strokeWidth="2"
                              />
                            );
                          }
                          return (
                            <rect x="670" y="40" width="240" height="180" fill="#1e293b" stroke="#0ea5e9" strokeWidth="2" />
                          );
                        })()}
                        <text x="790" y="32" fill="#38bdf8" fontSize="10.5" fontWeight="bold" textAnchor="middle">
                          4. EXCAVATION FACE (X = {tunnelGeometry.pullLengthM}m)
                        </text>
                        {/* Centerline on Face */}
                        <line x1="790" y1="40" x2="790" y2="220" stroke="#0284c7" strokeWidth="1" strokeDasharray="4,4" />
                        <line x1="670" y1="220" x2="910" y2="220" stroke="#64748b" strokeWidth="1" />
                        <text x="670" y="235" fill="#64748b" fontSize="8.5" textAnchor="middle">0m (Left)</text>
                        <text x="790" y="235" fill="#0284c7" fontSize="8.5" textAnchor="middle">C/L</text>
                        <text x="910" y="235" fill="#64748b" fontSize="8.5" textAnchor="middle">{tunnelGeometry.widthM}m (Right)</text>
                        <text x="790" y="248" fill="#64748b" fontSize="8.5" textAnchor="middle">Transverse Span (+Y)</text>

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
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
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
                onClick={() => handleConfirmSwitch(true)}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md cursor-pointer"
              >
                Save &amp; Reflect on Canvas
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
    </div>
  );
};
