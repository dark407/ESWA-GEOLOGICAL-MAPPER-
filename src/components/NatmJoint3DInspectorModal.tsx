// ============================================================================
// ESWA GEOLOGICAL MAPPER — NATM 3D JOINT INSPECTOR MODAL & WORKBENCH
// Calculation-based 3D orientation, multi-surface intersections, trace extent,
// persistence analysis, and Three.js spatial visualization for NATM joints.
// High-Performance Engine with Pure White CAD Viewport & Real-Time 3D Compass
// ============================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
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
  Shield,
  Printer,
  Sparkles,
  Navigation,
  Box,
  Lock,
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
  normalizeAngle360,
  clampDip,
  Vec3D,
  getTunnelRelativeDirectionLabel,
  getCrownStrikePair,
} from '../engine/joint3DInspectorEngine';

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
  onChange,
}) => {
  const [localStr, setLocalStr] = useState<string>(String(value));
  const isFocusedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalStr(String(value));
    }
  }, [value]);

  const commitValue = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '' || isNaN(Number(trimmed))) {
      setLocalStr(String(value));
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
        <span className="text-slate-400 font-bold">{label}:</span>
        <strong className="text-amber-300 font-mono text-sm">
          {value}{unit}
        </strong>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => handleStep(-step)}
          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded text-slate-300 font-mono font-bold text-xs select-none cursor-pointer"
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
          className="w-full text-center px-2 py-1 rounded bg-slate-950 border border-slate-700 text-amber-300 font-bold text-xs font-mono focus:border-amber-400 focus:outline-none transition-colors"
        />
        <button
          type="button"
          onClick={() => handleStep(step)}
          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded text-slate-300 font-mono font-bold text-xs select-none cursor-pointer"
          title={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
};

export const NatmJoint3DInspectorModal: React.FC<NatmJoint3DInspectorModalProps> = ({
  isOpen,
  onClose,
  activeJoint,
  allRoundJoints,
  tunnelGeometry,
  onSaveJoint,
}) => {
  if (!isOpen || !activeJoint) return null;

  // Active View Tab
  const [activeTab, setActiveTab] = useState<InspectionViewTab>('VIEW_3D');

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
  const [dipDirection, setDipDirection] = useState<number>(currentJoint.dipDirection ?? 135);
  const [dipAmount, setDipAmount] = useState<number>(currentJoint.dipAmount ?? 65);
  const [jointSetId, setJointSetId] = useState<FieldJointGroupingId>(currentJoint.setId || 'unassigned');
  const [measurementSource, setMeasurementSource] = useState<'MANUAL_COMPASS' | 'GEOMETRIC_FIT' | 'PHOTOGRAMMETRY_MULTIVIEW'>(
    currentJoint.inspection3D?.measurementSource || (currentJoint.editedByCompass ? 'MANUAL_COMPASS' : 'GEOMETRIC_FIT')
  );
  const [orientationConfidence, setOrientationConfidence] = useState<'HIGH' | 'MEDIUM' | 'LOW'>(
    currentJoint.inspection3D?.orientationConfidence || 'HIGH'
  );
  const [angularUncertainty, setAngularUncertainty] = useState<number>(
    currentJoint.inspection3D?.angularUncertaintyDeg ?? 3.0
  );

  // When switching currentJointId, load its orientation parameters
  useEffect(() => {
    setDipDirection(currentJoint.dipDirection ?? 135);
    setDipAmount(currentJoint.dipAmount ?? 65);
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
    return (
      dipDirection !== (currentJoint.dipDirection ?? 135) ||
      dipAmount !== (currentJoint.dipAmount ?? 65) ||
      jointSetId !== (currentJoint.setId || 'unassigned')
    );
  }, [dipDirection, dipAmount, jointSetId, currentJoint]);

  // Toggle for interior plane sheet (default true to immediately display the colored cutting plane)
  const [showInteriorPlane, setShowInteriorPlane] = useState<boolean>(true);

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

  // -------------------------------------------------------------------------
  // MATHEMATICAL CALCULATIONS (REAL & VALIDATED)
  // -------------------------------------------------------------------------

  // 1. Strike Convention & Angles
  const strikeInfo = useMemo(() => {
    return calculateStrikeFromDipDirection(dipDirection, dipAmount);
  }, [dipDirection, dipAmount]);

  // 2. Anchor Point Derived from actual mapped 2D polyline vertices
  const anchorPoint = useMemo(() => {
    return deriveAnchorPointFromPoints(currentJoint.points, currentJoint.panel, tunnelGeometry);
  }, [currentJoint.points, currentJoint.panel, tunnelGeometry]);

  // 3. Mathematical Plane Equation
  const plane = useMemo(() => {
    return constructJointPlane(
      dipDirection,
      dipAmount,
      anchorPoint,
      tunnelGeometry.driveAzimuthDeg
    );
  }, [dipDirection, dipAmount, anchorPoint, tunnelGeometry.driveAzimuthDeg]);

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
      target.dipDirection,
      target.dipAmount,
      targetAnchor,
      tunnelGeometry.driveAzimuthDeg
    );
    return calculateJointPairIntersection(plane, targetPlane, tunnelGeometry.driveAzimuthDeg);
  }, [compareTargetJointId, otherJoints, plane, tunnelGeometry]);

  // 8. Automated Engine Validation Test Report
  const validationReport = useMemo(() => runJointEngineValidationTests(), []);

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

  const isDraggingRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });


  // Set Camera Presets (smoothly updates camSphericalRef)
  const setCameraPreset = (preset: 'ISO' | 'PLAN' | 'FACE' | 'PROFILE' | 'RIGHT') => {
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

    // High-smoothness D-Shaped / Horseshoe profile (48 smooth segments)
    // Coords strictly in [0, w] (horizontal) and [0, h] (vertical)
    const profilePts: THREE.Vector2[] = [];
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
    // Triangulated radially from centroid (cx, hw * 0.6) to all perimeter points.
    // This strictly eliminates any chord or triangle on SPL!
    const facePositions: number[] = [];
    const faceIndices: number[] = [];
    const faceCentroid = new THREE.Vector2(cx, hw * 0.6);
    facePositions.push(faceCentroid.x, faceCentroid.y, pullL); // Index 0

    for (let i = 0; i < numPts; i++) {
      facePositions.push(profilePts[i].x, profilePts[i].y, pullL);
    }

    for (let i = 0; i < numPts; i++) {
      const next = (i + 1) % numPts;
      faceIndices.push(0, i + 1, next + 1);
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

    // E. 5 Essential Longitudinal Rails (Left Invert, Right Invert, Left SPL, Right SPL, Crown Apex)
    const railPositions: number[] = [
      0, 0.01, 0, 0, 0.01, pullL,      // Left Invert footing
      w, 0.01, 0, w, 0.01, pullL,      // Right Invert footing
      0, hw, 0, 0, hw, pullL,          // Left Springline (SPL)
      w, hw, 0, w, hw, pullL,          // Right Springline (SPL)
      cx, h, 0, cx, h, pullL,          // Crown Apex
    ];
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

    // 8. Animation Render Loop
    const render = () => {
      const cam = camSphericalRef.current;
      const x = cx + cam.radius * Math.sin(cam.phi) * Math.sin(cam.theta);
      const y = cy + cam.radius * Math.cos(cam.phi);
      const z = cz + cam.radius * Math.sin(cam.phi) * Math.cos(cam.theta);

      camera.position.set(x, y, z);
      camera.lookAt(cx, cy, cz);

      renderer.render(scene, camera);
      animFrameIdRef.current = requestAnimationFrame(render);
    };
    render();

    // 9. High-Performance Mouse Orbit Controls (Direct Ref Manipulation)
    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - prevMouseRef.current.x;
      const dy = e.clientY - prevMouseRef.current.y;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };

      const cam = camSphericalRef.current;
      cam.theta -= dx * 0.007;
      cam.phi = Math.max(0.04, Math.min(Math.PI - 0.04, cam.phi - dy * 0.007));
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = camSphericalRef.current;
      cam.radius = Math.max(4, Math.min(45, cam.radius + e.deltaY * 0.015));
    };

    const handleResize = () => {
      if (!threeMountRef.current || !rendererRef.current || !cameraRef.current) return;
      const wNow = threeMountRef.current.clientWidth || 600;
      const hNow = threeMountRef.current.clientHeight || 450;
      cameraRef.current.aspect = wNow / hNow;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(wNow, hNow);
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
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

    if (clippedVertices.length < 3) return;

    // 1. Optional Interior 3D Plane Mesh (Only added if user explicitly toggles on; default is OFF for clean 3D tunnel void)
    if (showInteriorPlane && clippedVertices.length >= 3) {
      const planeGeo = new THREE.BufferGeometry();
      const positions: number[] = [];
      const indices: number[] = [];

      clippedVertices.forEach((v) => {
        // Map Engine coordinates (x=advance, y=width, z=height) to Three.js (X=width, Y=height, Z=advance)
        positions.push(v.y, v.z, v.x);
      });

      for (let i = 1; i < clippedVertices.length - 1; i++) {
        indices.push(0, i, i + 1);
      }

      planeGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      planeGeo.setIndex(indices);
      planeGeo.computeVertexNormals();

      const grpColor = FIELD_JOINT_GROUP_COLORS[jointSetId]?.stroke || '#d97706';
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

      // Perimeter Line
      const perimeterPositions: number[] = [];
      for (let i = 0; i < clippedVertices.length; i++) {
        const curr = clippedVertices[i];
        const next = clippedVertices[(i + 1) % clippedVertices.length];
        perimeterPositions.push(curr.y, curr.z, curr.x, next.y, next.z, next.x);
      }
      const perimGeo = new THREE.BufferGeometry();
      perimGeo.setAttribute('position', new THREE.Float32BufferAttribute(perimeterPositions, 3));
      const perimMat = new THREE.LineBasicMaterial({ color: 0x92400e, linewidth: 2.5 });
      group.add(new THREE.LineSegments(perimGeo, perimMat));
    }

    // 2. Horizontal Strike Vector Line at Anchor (Sharp Blue)
    // Three.js anchor: X=width(anchorPoint.y), Y=height(anchorPoint.z), Z=advance(anchorPoint.x)
    const ax = anchorPoint.y;
    const ay = anchorPoint.z;
    const az = anchorPoint.x;
    const sx = plane.strikeVector.y;
    const sy = plane.strikeVector.z;
    const sz = plane.strikeVector.x;
    const sLen = 2.4;

    const sPos = [
      ax - sx * sLen,
      ay - sy * sLen,
      az - sz * sLen,
      ax + sx * sLen,
      ay + sy * sLen,
      az + sz * sLen,
    ];
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
    const sMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 3.5 });
    group.add(new THREE.LineSegments(sGeo, sMat));

    // 3. Downward Dip Direction Arrow (Vibrant Amber / Gold)
    const dipArrowDir = new THREE.Vector3(plane.dipVector.y, plane.dipVector.z, plane.dipVector.x).normalize();
    const dipArrowOrigin = new THREE.Vector3(ax, ay, az);
    const dipArrow = new THREE.ArrowHelper(dipArrowDir, dipArrowOrigin, 2.4, 0xd97706, 0.5, 0.28);
    group.add(dipArrow);

    // 4. Plane Normal Vector Arrow (Forest Green)
    const normalDir = new THREE.Vector3(plane.normal.y, plane.normal.z, plane.normal.x).normalize();
    const normalArrow = new THREE.ArrowHelper(normalDir, dipArrowOrigin, 1.9, 0x15803d, 0.4, 0.22);
    group.add(normalArrow);

    // 5. Anchor Point Sphere (Crimson Red) directly on user trace location
    const anchorGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const anchorMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
    const anchorMesh = new THREE.Mesh(anchorGeo, anchorMat);
    anchorMesh.position.set(ax, ay, az);
    group.add(anchorMesh);

    // 5b. Plane Dip & Amount Billboard directly along the plane in 3D
    const planeDipSprite = createBillboardLabel(
      `DIP: ${dipAmount}° ➔ ${dipDirection}°`,
      '#0F172A',
      '#FCD34D',
      2.5,
      0.65
    );
    planeDipSprite.position.set(ax, ay + 0.42, az);
    group.add(planeDipSprite);

    // 6. Clean Multi-Surface Intersection Traces in 3D (Face, Left Wall, Right Wall, Crown)
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
  }, [activeTab, clippedVertices, plane, anchorPoint, jointSetId, surfaceIntersections, tunnelGeometry, showInteriorPlane]);

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
      setId: jointSetId,
      inspection3D: inspectionData,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-2 bg-slate-950/85 backdrop-blur-md select-none">
      <div className="w-full max-w-[99.2vw] h-[98.5vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* ===================================================================
            HEADER: TITLE, STATUS & ACTION BUTTONS
            =================================================================== */}
        <header className="flex-none bg-slate-950/90 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black">
              <Compass className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono font-black text-sm sm:text-base text-white tracking-wide">
                  NATM 3D JOINT INSPECTOR &amp; MULTI-SURFACE PERSISTENCE
                </h2>
                <span
                  className="px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase"
                  style={{
                    backgroundColor: FIELD_JOINT_GROUP_COLORS[jointSetId]?.stroke || '#f59e0b',
                    color: '#020617',
                  }}
                >
                  Joint {currentJoint.id} ({jointSetId})
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono text-[10px]">
                  Observed on {currentJoint.panel.toUpperCase().replace('_', ' ')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                <span>
                  Tunnel Section: {tunnelGeometry.widthM}m W × {tunnelGeometry.heightM}m H × {tunnelGeometry.pullLengthM}m Pull
                </span>
                <span>·</span>
                <span className="text-amber-300">
                  Heading: {tunnelGeometry.driveAzimuthDeg !== undefined ? `N ${Math.round(tunnelGeometry.driveAzimuthDeg)}° E` : 'Local Grid'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold cursor-pointer transition-colors"
              title="Export complete 3D joint audit and coordinate tables to CSV"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleSaveInspection}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-mono text-xs font-black cursor-pointer transition-all shadow-md ${
                saveStatus === 'SAVED'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 hover:shadow-amber-500/20'
              }`}
            >
              {saveStatus === 'SAVED' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{saveStatus === 'SAVED' ? 'Reflected on Face Canvas!' : 'Save & Reflect on Face Canvas'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 cursor-pointer transition-colors"
              title="Close 3D Joint Inspector"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ===================================================================
            MAIN BODY: 2 COLUMNS (LEFT: EDITABLE PARAMETERS | RIGHT: 3D VIEWPORT)
            =================================================================== */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* ---------------------------------------------------------------
              LEFT PANEL: HIGH-RESPONSIVENESS INPUTS & GEOLOGICAL AUDIT
              --------------------------------------------------------------- */}
          <aside className="w-full lg:w-[450px] flex-none border-r border-slate-800 bg-slate-950/70 p-3 sm:p-4 overflow-y-auto space-y-3.5 font-mono text-xs">
            {/* 1. Orientation & Angle Conventions */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-amber-400 uppercase flex items-center gap-1.5">
                  <Compass className="w-4 h-4" />
                  <span>3D Orientation &amp; Strike Conventions</span>
                </span>
                <span className="text-[10px] text-cyan-300 font-mono font-bold">
                  {getTunnelRelativeDirectionLabel(dipDirection)}
                </span>
              </div>

              {/* High-Responsiveness Inputs for Dip Direction & Dip Angle */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <NumericStepperInput
                    label="Dip Direction (α)"
                    value={dipDirection}
                    min={0}
                    max={359}
                    step={1}
                    unit="°"
                    isCircular={true}
                    onChange={(val) => setDipDirection(val)}
                  />
                  <input
                    type="range"
                    min="0"
                    max="359"
                    value={dipDirection}
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
                          dipDirection === btn.d
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
                    value={dipAmount}
                    min={0}
                    max={90}
                    step={1}
                    unit="°"
                    onChange={(val) => setDipAmount(val)}
                  />
                  <input
                    type="range"
                    min="0"
                    max="90"
                    value={dipAmount}
                    onChange={(e) => setDipAmount(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  {/* Quick Preset Angles */}
                  <div className="flex items-center justify-between gap-1 pt-0.5">
                    {[0, 30, 45, 65, 90].map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setDipAmount(a)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[9.5px] text-slate-300 font-mono cursor-pointer"
                      >
                        {a}°
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Crown-Only Observation Dipping Side Selector (Section 6) */}
              {activeJoint.panel === 'crown' && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-amber-300">Crown Strike Axis:</span>
                    <span className="font-mono font-black text-amber-400">{strikeInfo.strikePairLabel}</span>
                  </div>
                  <p className="text-[10px] text-slate-300 leading-snug">
                    Crown trace preserves measured strike. To complete the 3D plane, specify the dipping side:
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        const s = strikeInfo.strikeRhrDeg;
                        setDipDirection((s + 90) % 360);
                      }}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border border-slate-700 text-[10px] font-bold cursor-pointer transition-all"
                    >
                      Dip Right (+Y side)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const s = strikeInfo.strikeRhrDeg;
                        setDipDirection((s - 90 + 360) % 360);
                      }}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border border-slate-700 text-[10px] font-bold cursor-pointer transition-all"
                    >
                      Dip Left (-Y side)
                    </button>
                  </div>
                </div>
              )}

              {/* Strike Axis */}
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-[11px]">
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
                    className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-amber-300 font-bold text-xs"
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
                    className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-slate-200 text-xs"
                  >
                    <option value="MANUAL_COMPASS">Compass &amp; Inclinometer</option>
                    <option value="GEOMETRIC_FIT">Polyline Geometry Fit</option>
                    <option value="PHOTOGRAMMETRY_MULTIVIEW">Multi-View 3D Triangulation</option>
                  </select>
                </div>
              </div>
            </div>

            {/* WHERE THIS PLANE CUTS THE TUNNEL */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
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
                    : 'bg-slate-950 border-slate-800/80 text-slate-500'
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
                    : 'bg-slate-950 border-slate-800/80 text-slate-500'
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
                    : 'bg-slate-950 border-slate-800/80 text-slate-500'
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
                    : 'bg-slate-950 border-slate-800/80 text-slate-500'
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

            {/* 2. Surface Trace Lengths & Extent Audit */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="font-bold text-cyan-400 uppercase flex items-center gap-1.5">
                  <Activity className="w-4 h-4" />
                  <span>Surface Trace Lengths &amp; Extent (m)</span>
                </span>
                <span className="text-[10px] text-slate-400">Metric Calibration</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">Face (m)</span>
                  <strong className="text-amber-300 text-sm font-mono">
                    {observedLengths.faceM > 0 ? `${observedLengths.faceM}m` : '—'}
                  </strong>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">Left Wall (m)</span>
                  <strong className="text-amber-300 text-sm font-mono">
                    {observedLengths.leftWallM > 0 ? `${observedLengths.leftWallM}m` : '—'}
                  </strong>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">Right Wall (m)</span>
                  <strong className="text-amber-300 text-sm font-mono">
                    {observedLengths.rightWallM > 0 ? `${observedLengths.rightWallM}m` : '—'}
                  </strong>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">Crown (m)</span>
                  <strong className="text-amber-300 text-sm font-mono">
                    {observedLengths.crownM > 0 ? `${observedLengths.crownM}m` : '—'}
                  </strong>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
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

            {/* 3. ALL TRACED JOINTS IN THIS ROUND (SWITCHABLE & EDITABLE) */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="font-bold text-amber-300 uppercase flex items-center gap-1.5 text-xs">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>All Traced Joints in Round ({allRoundJoints.length})</span>
                </span>
                <span className="text-[10px] text-slate-400">Click to Inspect &amp; Edit</span>
              </div>

              {allRoundJoints.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">No joints traced in this round.</p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                  {allRoundJoints.map((j) => {
                    const isCurrent = j.id === currentJointId;
                    const jColor = FIELD_JOINT_GROUP_COLORS[j.setId || 'unassigned']?.stroke || '#f59e0b';
                    return (
                      <div
                        key={j.id}
                        onClick={() => handleRequestSwitchJoint(j.id)}
                        className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isCurrent
                            ? 'bg-amber-500/15 border-amber-400/80 shadow-md ring-1 ring-amber-400/40'
                            : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700 text-slate-300'
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
          </aside>

          {/* ---------------------------------------------------------------
              RIGHT PANEL: PURE WHITE 3D CAD VIEWPORT & REAL-TIME COMPASS
              --------------------------------------------------------------- */}
          <main className="flex-1 flex flex-col bg-slate-900 overflow-hidden relative">
            {/* View Switcher Bar */}
            <div className="flex-none bg-slate-950 px-3 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 z-10">
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 font-mono text-xs font-bold">
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
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* 3D Camera Controls & Legend Toggle */}
              {activeTab === 'VIEW_3D' && (
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  {/* Toggle Interior Plane Mesh (Default: ON for vivid colored cut) */}
                  <button
                    type="button"
                    onClick={() => setShowInteriorPlane(!showInteriorPlane)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      showInteriorPlane
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow font-black'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                    title="Toggle 3D Colored Joint Plane cut"
                  >
                    <Box className="w-3.5 h-3.5" />
                    <span>{showInteriorPlane ? 'Cutting Plane: ON' : 'Cutting Plane: OFF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowLegendOverlay(!showLegendOverlay)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer font-bold"
                    title="Toggle vector legend overlay"
                  >
                    {showLegendOverlay ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-cyan-400" />}
                    <span>{showLegendOverlay ? 'Hide Legend' : 'Show Legend'}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {(['ISO', 'FACE', 'PLAN', 'PROFILE', 'RIGHT'] as const).map((pr) => (
                      <button
                        key={pr}
                        type="button"
                        onClick={() => setCameraPreset(pr)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold cursor-pointer transition-colors"
                      >
                        {pr}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCameraPreset('ISO')}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 cursor-pointer ml-0.5"
                      title="Reset 3D camera"
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
                <div className="w-full h-full relative cursor-grab active:cursor-grabbing">
                  {/* Clean Three.js WebGL Canvas Mount */}
                  <div ref={threeMountRef} className="w-full h-full" />

                  {/* PROMINENT TOP-CENTER TUNNEL DRIVE DIRECTION BANNER WITH ARROW */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-slate-950/90 backdrop-blur-md border border-cyan-500/50 shadow-xl pointer-events-none z-10 flex items-center gap-2 font-mono text-xs font-bold text-white">
                    <Navigation className="w-4 h-4 text-cyan-400 rotate-0" />
                    <span className="text-cyan-400 font-black">▲ TUNNEL DRIVE DIRECTION (+Z):</span>
                    <span className="bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 px-2.5 py-0.5 rounded-full font-black">
                      N {Math.round(tunnelGeometry.driveAzimuthDeg ?? 0)}° E (000° TUNNEL AXIS)
                    </span>
                  </div>

                  {/* TOP-LEFT: TUNNEL GEOMETRY & ADVANCE BADGE */}
                  <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-md border border-slate-700/80 shadow-xl pointer-events-none z-10 flex items-center gap-2 text-[11px] font-mono">
                    <span className="text-slate-400">Section:</span>
                    <strong className="text-white">{tunnelGeometry.widthM}m W × {tunnelGeometry.heightM}m H</strong>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-400">Advance:</span>
                    <strong className="text-amber-400">{tunnelGeometry.pullLengthM || 3.0}m</strong>
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
                          <span className="text-amber-400 font-black">PLANE ORIENTATION:</span>
                          <span className="text-white font-extrabold">
                            DIP {dipAmount}° ➔ {dipDirection}° ({getTunnelRelativeDirectionLabel(dipDirection)})
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Strike: {strikeInfo.strikePairLabel} · Anchor: X {anchorPoint.x.toFixed(2)}m, Y {anchorPoint.y.toFixed(2)}m, Z {anchorPoint.z.toFixed(2)}m
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

                  {/* Mouse Navigation Hint (Bottom-Right) */}
                  <div className="absolute bottom-3 right-3 px-2.5 py-1.5 rounded-lg bg-slate-950/75 border border-slate-800 text-[9.5px] text-slate-400 font-mono pointer-events-none z-10">
                    Orbit: Drag Left-Click · Zoom: Wheel Scroll · Pan: Right-Click
                  </div>
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

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block font-bold">Observed Geological Trace:</span>
                        <strong className="text-cyan-400">
                          {activeJoint.panel.toUpperCase() === activeTab.replace('VIEW_', '')
                            ? `${observedLengths.totalObservedM}m (Direct Field Measurement)`
                            : 'None recorded directly on this surface'}
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block font-bold">Calculated Intersection:</span>
                        <strong className="text-amber-400">
                          {activeTab === 'VIEW_FACE' && surfaceIntersections.face
                            ? `${surfaceIntersections.face.lengthM}m`
                            : activeTab === 'VIEW_LEFT_WALL' && surfaceIntersections.leftWall
                            ? `${surfaceIntersections.leftWall.lengthM}m`
                            : activeTab === 'VIEW_RIGHT_WALL' && surfaceIntersections.rightWall
                            ? `${surfaceIntersections.rightWall.lengthM}m`
                            : activeTab === 'VIEW_CROWN' && surfaceIntersections.crown
                            ? `${surfaceIntersections.crown.lengthM}m`
                            : 'No mathematical intersection in bounding box'}
                        </strong>
                      </div>
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
                              y1={220 - (surfaceIntersections.leftWall.p1.y / tunnelGeometry.wallHeightM) * 180}
                              x2={20 + (surfaceIntersections.leftWall.p2.x / tunnelGeometry.pullLengthM) * 180}
                              y2={220 - (surfaceIntersections.leftWall.p2.y / tunnelGeometry.wallHeightM) * 180}
                              stroke="#F59E0B"
                              strokeWidth="2.8"
                              strokeDasharray="6,3"
                            />
                            <text
                              x={20 + ((surfaceIntersections.leftWall.p1.x + surfaceIntersections.leftWall.p2.x) / (2 * tunnelGeometry.pullLengthM)) * 180}
                              y={215 - ((surfaceIntersections.leftWall.p1.y + surfaceIntersections.leftWall.p2.y) / (2 * tunnelGeometry.wallHeightM)) * 180}
                              fill="#F59E0B"
                              fontSize="8"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              calc {surfaceIntersections.leftWall.lengthM}m
                            </text>
                          </g>
                        )}

                        {/* 2. CROWN ARCH / BACK (Y: 0..widthM, X: 0..pullL) */}
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

                        {/* 3. RIGHT WALL (X: 0..pullL, Z: 0..wallHeightM) */}
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
                              y1={220 - (surfaceIntersections.rightWall.p1.y / tunnelGeometry.wallHeightM) * 180}
                              x2={460 + (surfaceIntersections.rightWall.p2.x / tunnelGeometry.pullLengthM) * 180}
                              y2={220 - (surfaceIntersections.rightWall.p2.y / tunnelGeometry.wallHeightM) * 180}
                              stroke="#F59E0B"
                              strokeWidth="2.8"
                              strokeDasharray="6,3"
                            />
                            <text
                              x={460 + ((surfaceIntersections.rightWall.p1.x + surfaceIntersections.rightWall.p2.x) / (2 * tunnelGeometry.pullLengthM)) * 180}
                              y={215 - ((surfaceIntersections.rightWall.p1.y + surfaceIntersections.rightWall.p2.y) / (2 * tunnelGeometry.wallHeightM)) * 180}
                              fill="#F59E0B"
                              fontSize="8"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              calc {surfaceIntersections.rightWall.lengthM}m
                            </text>
                          </g>
                        )}

                        {/* 4. TUNNEL FACE (Transverse Y: 0..widthM, Elevation Z: 0..heightM) */}
                        <rect x="670" y="40" width="240" height="180" fill="#1e293b" stroke="#0ea5e9" strokeWidth="2" />
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
    </div>
  );
};
