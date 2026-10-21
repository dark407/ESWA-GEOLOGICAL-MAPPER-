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

  // Editable Orientation Parameters
  const [dipDirection, setDipDirection] = useState<number>(activeJoint.dipDirection ?? 135);
  const [dipAmount, setDipAmount] = useState<number>(activeJoint.dipAmount ?? 65);
  const [jointSetId, setJointSetId] = useState<FieldJointGroupingId>(activeJoint.setId || 'unassigned');
  const [measurementSource, setMeasurementSource] = useState<'MANUAL_COMPASS' | 'GEOMETRIC_FIT' | 'PHOTOGRAMMETRY_MULTIVIEW'>(
    activeJoint.inspection3D?.measurementSource || (activeJoint.editedByCompass ? 'MANUAL_COMPASS' : 'GEOMETRIC_FIT')
  );
  const [orientationConfidence, setOrientationConfidence] = useState<'HIGH' | 'MEDIUM' | 'LOW'>(
    activeJoint.inspection3D?.orientationConfidence || 'HIGH'
  );
  const [angularUncertainty, setAngularUncertainty] = useState<number>(
    activeJoint.inspection3D?.angularUncertaintyDeg ?? 3.0
  );

  // Persistence & Geological Interpretation
  const [persistenceInterpretation, setPersistenceInterpretation] = useState<string>(
    activeJoint.inspection3D?.persistenceInterpretation ||
      'Visible trace exposed across excavation face. Continuity into crown arch observed with tight intact rock bridge.'
  );
  const [persistenceAssumptions, setPersistenceAssumptions] = useState<string>(
    activeJoint.inspection3D?.persistenceAssumptions ||
      'Orientation assumed planar within the excavation volume. Planar extrapolation clipped to tunnel cross-section perimeter.'
  );
  const [persistenceConfidence, setPersistenceConfidence] = useState<'HIGH' | 'MEDIUM' | 'LOW'>(
    activeJoint.inspection3D?.persistenceConfidence || 'MEDIUM'
  );

  // Cross-Surface Linking
  const [linkedTraceIds, setLinkedTraceIds] = useState<string[]>(
    activeJoint.inspection3D?.linkedTraceIds || []
  );

  // Pair Intersection Comparison Target
  const otherJoints = useMemo(
    () => allRoundJoints.filter((j) => j.id !== activeJoint.id),
    [allRoundJoints, activeJoint.id]
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
    return deriveAnchorPointFromPoints(activeJoint.points, activeJoint.panel, tunnelGeometry);
  }, [activeJoint.points, activeJoint.panel, tunnelGeometry]);

  // 3. Mathematical Plane Equation
  const plane = useMemo(() => {
    return constructJointPlane(
      dipDirection,
      dipAmount,
      anchorPoint,
      tunnelGeometry.driveAzimuthDeg
    );
  }, [dipDirection, dipAmount, anchorPoint, tunnelGeometry.driveAzimuthDeg]);

  // 3b. Analytical True vs Apparent Dip Matrix across all 4 Tunnel Surfaces
  const apparentMatrix = useMemo<TunnelSurfacesApparentDipMatrix>(() => {
    return calculateSurfaceApparentTraceAngles(
      dipDirection,
      dipAmount,
      tunnelGeometry.driveAzimuthDeg ?? 0
    );
  }, [dipDirection, dipAmount, tunnelGeometry.driveAzimuthDeg]);

  // 4. Clipped Plane Polygon to Tunnel Bounding Box
  const clippedVertices = useMemo(() => {
    return clipPlaneToTunnelBox(plane, tunnelGeometry);
  }, [plane, tunnelGeometry]);

  // 5. Multi-Surface Intersections
  const surfaceIntersections = useMemo(() => {
    return calculatePlaneSurfaceIntersections(plane, tunnelGeometry, activeJoint.panel);
  }, [plane, tunnelGeometry, activeJoint.panel]);

  // 6. Observed Trace Lengths
  const observedLengths = useMemo(() => {
    const faceTraces = allRoundJoints.filter(
      (j) => j.panel === 'face' && (j.id === activeJoint.id || linkedTraceIds.includes(j.id))
    );
    const leftTraces = allRoundJoints.filter(
      (j) => j.panel === 'left_wall' && (j.id === activeJoint.id || linkedTraceIds.includes(j.id))
    );
    const rightTraces = allRoundJoints.filter(
      (j) => j.panel === 'right_wall' && (j.id === activeJoint.id || linkedTraceIds.includes(j.id))
    );
    const crownTraces = allRoundJoints.filter(
      (j) => j.panel === 'crown' && (j.id === activeJoint.id || linkedTraceIds.includes(j.id))
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
  }, [allRoundJoints, activeJoint, linkedTraceIds, tunnelGeometry]);

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

  // DOM refs for Real-Time 3D Compass
  const compassDialRef = useRef<HTMLDivElement | null>(null);
  const compassNeedleRef = useRef<HTMLDivElement | null>(null);
  const compassReadoutRef = useRef<HTMLSpanElement | null>(null);

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

    // 5. Clean Excavation Invert Floor (No boxy multi-line grid clutter)
    const floorGeo = new THREE.PlaneGeometry(w, pullL);
    floorGeo.rotateX(-Math.PI / 2);
    floorGeo.translate(cx, 0.002, cz);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.6,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    scene.add(floorMesh);

    // 6. Tunnel Static Geometry Construction (Clean Smooth Tunnel, No Facet Clutter)
    const tunnelGroup = new THREE.Group();

    // High-smoothness D-Shaped / Horseshoe profile (48 smooth segments)
    const profilePts: THREE.Vector2[] = [];
    const segments = 48;
    profilePts.push(new THREE.Vector2(-w / 2, 0));
    profilePts.push(new THREE.Vector2(w / 2, 0));
    profilePts.push(new THREE.Vector2(w / 2, hw));
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI;
      const x = (w / 2) * Math.cos(theta);
      const y = hw + archRise * Math.sin(theta);
      profilePts.push(new THREE.Vector2(-x, y));
    }
    profilePts.push(new THREE.Vector2(-w / 2, hw));

    const tunnelShape = new THREE.Shape(profilePts);
    const extrudeSettings = {
      steps: 1,
      depth: pullL,
      bevelEnabled: false,
    };
    const tunnelGeo = new THREE.ExtrudeGeometry(tunnelShape, extrudeSettings);
    tunnelGeo.translate(cx, 0, 0);
    tunnelGeo.computeVertexNormals();

    // Clean, smooth, non-boxy translucent shell
    const tunnelMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      transparent: true,
      opacity: 0.28,
      roughness: 0.2,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const tunnelMesh = new THREE.Mesh(tunnelGeo, tunnelMat);
    tunnelGroup.add(tunnelMesh);

    // Clean Excavation Face Contour (z = pullL) in Electric Cyan/Blue (Crisp & Distinct)
    const faceContourPoints: THREE.Vector3[] = [];
    for (const pt of profilePts) {
      faceContourPoints.push(new THREE.Vector3(pt.x + cx, pt.y, pullL));
    }
    faceContourPoints.push(new THREE.Vector3(profilePts[0].x + cx, profilePts[0].y, pullL));
    const faceContourGeo = new THREE.BufferGeometry().setFromPoints(faceContourPoints);
    const faceContourMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 3 });
    const faceContourLine = new THREE.Line(faceContourGeo, faceContourMat);
    tunnelGroup.add(faceContourLine);

    // Excavation Face Subtle Shaded Cap (demarcates the rock face clearly)
    const faceShapeGeo = new THREE.ShapeGeometry(tunnelShape);
    faceShapeGeo.translate(cx, 0, 0);
    const faceShapeMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    });
    const faceMesh = new THREE.Mesh(faceShapeGeo, faceShapeMat);
    faceMesh.position.set(0, 0, pullL);
    tunnelGroup.add(faceMesh);

    // Previous Round Outline at Entrance (z = 0) (Soft Slate)
    const prevContourPoints: THREE.Vector3[] = [];
    for (const pt of profilePts) {
      prevContourPoints.push(new THREE.Vector3(pt.x + cx, pt.y, 0));
    }
    prevContourPoints.push(new THREE.Vector3(profilePts[0].x + cx, profilePts[0].y, 0));
    const prevContourGeo = new THREE.BufferGeometry().setFromPoints(prevContourPoints);
    const prevContourMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, linewidth: 1.5 });
    const prevContourLine = new THREE.Line(prevContourGeo, prevContourMat);
    tunnelGroup.add(prevContourLine);

    // Clean Structural Longitudinal Rails (Only 5 essential lines: 2 Invert corners, 2 Springlines, 1 Crown Apex)
    const railPositions: number[] = [
      // Left Invert footing
      0, 0.01, 0, 0, 0.01, pullL,
      // Right Invert footing
      w, 0.01, 0, w, 0.01, pullL,
      // Left Springline
      0, hw, 0, 0, hw, pullL,
      // Right Springline
      w, hw, 0, w, hw, pullL,
      // Crown Apex
      cx, h, 0, cx, h, pullL,
    ];
    const railsGeo = new THREE.BufferGeometry();
    railsGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPositions, 3));
    const railsMat = new THREE.LineBasicMaterial({ color: 0x64748b, linewidth: 1.5 });
    const railsLines = new THREE.LineSegments(railsGeo, railsMat);
    tunnelGroup.add(railsLines);

    // Centerline Advance Arrow on Invert (Z-axis drive direction)
    const advanceDir = new THREE.Vector3(0, 0, 1);
    const advanceOrigin = new THREE.Vector3(cx, 0.02, 0);
    const advanceArrow = new THREE.ArrowHelper(advanceDir, advanceOrigin, pullL, 0x0284c7, 0.45, 0.22);
    tunnelGroup.add(advanceArrow);

    // Subtle 1-Meter Advance Chainage Markers along Centerline
    const tickPositions: number[] = [];
    for (let mz = 1; mz < pullL; mz += 1) {
      tickPositions.push(cx - 0.25, 0.02, mz, cx + 0.25, 0.02, mz);
    }
    if (tickPositions.length > 0) {
      const ticksGeo = new THREE.BufferGeometry();
      ticksGeo.setAttribute('position', new THREE.Float32BufferAttribute(tickPositions, 3));
      const ticksMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, linewidth: 1.5 });
      tunnelGroup.add(new THREE.LineSegments(ticksGeo, ticksMat));
    }

    scene.add(tunnelGroup);

    // 7. Dynamic Joint Group (rebuilt only when orientation changes)
    const jointGroup = new THREE.Group();
    jointGroupRef.current = jointGroup;
    scene.add(jointGroup);

    // 8. Animation & Real-Time 3D Compass Render Loop
    const camDir = new THREE.Vector3();
    const driveAz = tunnelGeometry.driveAzimuthDeg ?? 0;

    const render = () => {
      const cam = camSphericalRef.current;
      const x = cx + cam.radius * Math.sin(cam.phi) * Math.sin(cam.theta);
      const y = cy + cam.radius * Math.cos(cam.phi);
      const z = cz + cam.radius * Math.sin(cam.phi) * Math.cos(cam.theta);

      camera.position.set(x, y, z);
      camera.lookAt(cx, cy, cz);

      renderer.render(scene, camera);

      // Real-Time 3D Compass Rotation & Tilt directly to DOM (0 React re-renders, 60fps)
      camera.getWorldDirection(camDir);
      // Horizontal angle of camera looking towards center:
      const viewAzRad = Math.atan2(-camDir.x, -camDir.z);
      const viewAzDeg = (viewAzRad * (180 / Math.PI) + 360) % 360;
      const tiltDeg = Math.round(Math.asin(Math.max(-1, Math.min(1, camDir.y))) * (180 / Math.PI));

      // In local coordinates: +Z is Tunnel Drive (Azimuth = driveAz).
      // North Needle orientation relative to screen 12 o'clock:
      const compassNeedleAngle = Math.round((driveAz - viewAzDeg + 360) % 360);

      if (compassNeedleRef.current) {
        compassNeedleRef.current.style.transform = `rotate(${compassNeedleAngle}deg)`;
      }
      if (compassDialRef.current) {
        compassDialRef.current.style.transform = `rotate(${-viewAzDeg}deg)`;
      }
      if (compassReadoutRef.current) {
        compassReadoutRef.current.innerText = `CAM AZ: ${Math.round(viewAzDeg)}° · TILT: ${tiltDeg}°`;
      }

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

    // 1. Build 3D Clipped Polygon Mesh
    const planeGeo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const indices: number[] = [];

    clippedVertices.forEach((v) => {
      positions.push(v.x, v.y, v.z);
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
      opacity: 0.72,
      side: THREE.DoubleSide,
      roughness: 0.35,
      metalness: 0.1,
    });

    const planeMesh = new THREE.Mesh(planeGeo, planeMat);
    group.add(planeMesh);

    // 2. High-Contrast Perimeter Line
    const perimeterPositions: number[] = [];
    for (let i = 0; i < clippedVertices.length; i++) {
      const curr = clippedVertices[i];
      const next = clippedVertices[(i + 1) % clippedVertices.length];
      perimeterPositions.push(curr.x, curr.y, curr.z, next.x, next.y, next.z);
    }
    const perimGeo = new THREE.BufferGeometry();
    perimGeo.setAttribute('position', new THREE.Float32BufferAttribute(perimeterPositions, 3));
    const perimMat = new THREE.LineBasicMaterial({ color: 0x92400e, linewidth: 3 });
    group.add(new THREE.LineSegments(perimGeo, perimMat));

    // 3. Horizontal Strike Vector Line (Sharp Blue)
    const sLen = 2.4;
    const sPos = [
      anchorPoint.x - plane.strikeVector.x * sLen,
      anchorPoint.y - plane.strikeVector.y * sLen,
      anchorPoint.z - plane.strikeVector.z * sLen,
      anchorPoint.x + plane.strikeVector.x * sLen,
      anchorPoint.y + plane.strikeVector.y * sLen,
      anchorPoint.z + plane.strikeVector.z * sLen,
    ];
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
    const sMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 3.5 });
    group.add(new THREE.LineSegments(sGeo, sMat));

    // 4. Downward Dip Direction Arrow (Vibrant Amber / Gold)
    const dipArrowDir = new THREE.Vector3(plane.dipVector.x, plane.dipVector.y, plane.dipVector.z).normalize();
    const dipArrowOrigin = new THREE.Vector3(anchorPoint.x, anchorPoint.y, anchorPoint.z);
    const dipArrow = new THREE.ArrowHelper(dipArrowDir, dipArrowOrigin, 2.4, 0xd97706, 0.5, 0.28);
    group.add(dipArrow);

    // 5. Plane Normal Vector Arrow (Forest Green)
    const normalDir = new THREE.Vector3(plane.normal.x, plane.normal.y, plane.normal.z).normalize();
    const normalArrow = new THREE.ArrowHelper(normalDir, dipArrowOrigin, 1.9, 0x15803d, 0.4, 0.22);
    group.add(normalArrow);

    // 6. Anchor Point Sphere (Crimson Red)
    const anchorGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const anchorMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
    const anchorMesh = new THREE.Mesh(anchorGeo, anchorMat);
    anchorMesh.position.set(anchorPoint.x, anchorPoint.y, anchorPoint.z);
    group.add(anchorMesh);

    // 7. Multi-Surface Intersection Traces in 3D (Face, Left Wall, Right Wall)
    const pullL = tunnelGeometry.pullLengthM || 3.0;
    const w = tunnelGeometry.widthM || 8.5;

    // Face Intersection Trace (at z = pullL) in Electric Blue
    if (surfaceIntersections.face) {
      const f1 = surfaceIntersections.face.p1;
      const f2 = surfaceIntersections.face.p2;
      const faceTraceGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(f1.x, f1.y, pullL),
        new THREE.Vector3(f2.x, f2.y, pullL),
      ]);
      const faceTraceMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 3 });
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
      const leftTraceMat = new THREE.LineBasicMaterial({ color: 0xd97706, linewidth: 3 });
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
      const rightTraceMat = new THREE.LineBasicMaterial({ color: 0xd97706, linewidth: 3 });
      group.add(new THREE.Line(rightTraceGeo, rightTraceMat));
    }
  }, [activeTab, clippedVertices, plane, anchorPoint, jointSetId, surfaceIntersections, tunnelGeometry]);

  // -------------------------------------------------------------------------
  // SAVE HANDLER
  // -------------------------------------------------------------------------
  const handleSaveInspection = () => {
    const inspectionData: Joint3DInspectionData = {
      jointId: activeJoint.id,
      sourcePanel: activeJoint.panel,
      orientation: strikeInfo,
      measurementSource,
      orientationConfidence,
      angularUncertaintyDeg: angularUncertainty,
      isGeoreferenced: tunnelGeometry.driveAzimuthDeg !== undefined && !isNaN(tunnelGeometry.driveAzimuthDeg),
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
      ...activeJoint,
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
      ['Joint_ID', activeJoint.id, '', 'Unique mapped joint identifier'],
      ['Source_Panel', activeJoint.panel, '', 'Mapping surface where trace was observed'],
      ['Joint_Set', jointSetId, '', 'Discontinuity structural grouping'],
      ['Dip_Direction', strikeInfo.dipDirectionDeg, 'degrees', '0-360 clockwise from North reference'],
      ['Dip_Angle', strikeInfo.dipDeg, 'degrees', '0-90 plunge from horizontal'],
      ['Strike_RHR', strikeInfo.strikeRhrDeg, 'degrees', 'Right-Hand Rule convention (dip to the right)'],
      ['Strike_Alternate', strikeInfo.strikeAltDeg, 'degrees', 'Back-azimuth (RHR + 180 deg)'],
      ['Measurement_Source', measurementSource, '', 'Observation instrumentation'],
      ['Orientation_Confidence', orientationConfidence, '', 'Mapper statistical confidence'],
      ['Angular_Uncertainty', angularUncertainty, 'degrees', 'Estimated measurement tolerance'],
      ['Tunnel_Width', tunnelGeometry.widthM, 'm', 'Tunnel cross-section excavation width'],
      ['Tunnel_Height', tunnelGeometry.heightM, 'm', 'Tunnel cross-section excavation height'],
      ['Tunnel_Pull_Length', tunnelGeometry.pullLengthM, 'm', 'Round advance / pull depth'],
      ['Tunnel_Drive_Azimuth', tunnelGeometry.driveAzimuthDeg ?? 'N/A', 'degrees', 'Excavation heading bearing'],
      ['Anchor_P0_X', anchorPoint.x.toFixed(3), 'm', 'Local cross-tunnel coordinate (0..W)'],
      ['Anchor_P0_Y', anchorPoint.y.toFixed(3), 'm', 'Local elevation coordinate above invert (0..H)'],
      ['Anchor_P0_Z', anchorPoint.z.toFixed(3), 'm', 'Local chainage distance along drive (0..L)'],
      ['Plane_Normal_A', plane.a.toFixed(4), '', 'Direction cosine Ax'],
      ['Plane_Normal_B', plane.b.toFixed(4), '', 'Direction cosine By'],
      ['Plane_Normal_C', plane.c.toFixed(4), '', 'Direction cosine Cz'],
      ['Plane_D_Constant', plane.d.toFixed(4), '', 'Plane equation Ax + By + Cz + D = 0'],
      ['Observed_Face_Length', observedLengths.faceM, 'm', 'Directly mapped length on excavation face'],
      ['Observed_Left_Wall_Length', observedLengths.leftWallM, 'm', 'Directly mapped length on left wall'],
      ['Observed_Right_Wall_Length', observedLengths.rightWallM, 'm', 'Directly mapped length on right wall'],
      ['Observed_Crown_Length', observedLengths.crownM, 'm', 'Directly mapped length on crown arch'],
      ['Total_Observed_Length', observedLengths.totalObservedM, 'm', 'Confirmed exposed trace length'],
      ['Calculated_Total_Intersection', surfaceIntersections.totalCalculatedM, 'm', 'Theoretical plane perimeter in round box'],
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md select-none">
      <div className="w-full max-w-7xl h-[94vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* ===================================================================
            HEADER: TITLE, STATUS & ACTION BUTTONS
            =================================================================== */}
        <header className="flex-none bg-slate-950/90 px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
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
                  Joint {activeJoint.id} ({jointSetId})
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono text-[10px]">
                  Observed on {activeJoint.panel.toUpperCase().replace('_', ' ')}
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
              <span>{saveStatus === 'SAVED' ? 'Saved to NATM' : 'Save & Link Joint'}</span>
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
                <span className="text-[10px] text-slate-400">RHR Standard</span>
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
                  {/* Quick Preset Buttons */}
                  <div className="flex items-center justify-between gap-1 pt-0.5">
                    {[0, 90, 135, 180, 270].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDipDirection(d)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[9.5px] text-slate-300 font-mono cursor-pointer"
                      >
                        {d}°
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
                    {[15, 30, 45, 65, 85].map((a) => (
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

              {/* Computed Strike Directions (RHR and Alternate) */}
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Right-Hand Rule Strike (RHR):</span>
                  <strong className="text-cyan-400 font-mono">{strikeInfo.strikeRhrDeg}°</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Alternate Strike (Back-azimuth):</span>
                  <strong className="text-slate-300 font-mono">{strikeInfo.strikeAltDeg}°</strong>
                </div>
                <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/80 leading-relaxed font-sans">
                  {strikeInfo.explanation}
                </p>
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

            {/* 1B. TRUE DIP VS. SURFACE APPARENT DIPS MATRIX (CLARIFIES GEOLOGICAL CONFUSION) */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="font-bold text-amber-400 uppercase flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <span>True Dip vs. Surface Apparent Dips</span>
                </span>
                <span className="text-[10px] text-cyan-300 font-mono font-bold">
                  Heading N {Math.round(tunnelGeometry.driveAzimuthDeg ?? 0)}° E
                </span>
              </div>

              {/* Matrix of all 4 surfaces */}
              <div className="space-y-1.5 text-[11px]">
                {/* 1. Excavation Face */}
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/90 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <strong className="text-cyan-400">Excavation Face</strong>
                      <span className="text-[9px] text-slate-500 font-sans">(Transverse, 90° to Drive)</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
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

                {/* 2. Left Wall */}
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/90 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <strong className="text-slate-300">Left Sidewall</strong>
                      <span className="text-[9px] text-slate-500 font-sans">(Longitudinal, 0° to Drive)</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
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

                {/* 3. Right Wall */}
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/90 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <strong className="text-slate-300">Right Sidewall</strong>
                      <span className="text-[9px] text-slate-500 font-sans">(Longitudinal, 0° to Drive)</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
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
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/90 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <strong className="text-sky-300">Crown Arch / Back</strong>
                      <span className="text-[9px] text-slate-500 font-sans">(Horizontal Apex Tangent)</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
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

              {/* Geotechnical Rule & Natural Language Explanation */}
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-200 leading-relaxed font-sans space-y-1">
                <div className="font-bold flex items-center gap-1 text-amber-300">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>Geological Orientation Rule:</span>
                </div>
                <p>{apparentMatrix.comprehensiveExplanation}</p>
                <div className="text-slate-400 border-t border-amber-500/20 pt-1 space-y-0.5">
                  <p><strong>Face:</strong> {apparentMatrix.face.geologicalNote}</p>
                  <p><strong>Sidewalls:</strong> {apparentMatrix.leftWall.geologicalNote}</p>
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

            {/* 3. Persistence Interpretation & Assumptions */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="font-bold text-amber-300 uppercase flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>Persistence Interpretation &amp; Assumptions</span>
                </span>
                <span className="text-[10px] text-slate-400">Engineering Review</span>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block text-[11px]">Geologist Persistence Interpretation:</label>
                <textarea
                  value={persistenceInterpretation}
                  onChange={(e) => setPersistenceInterpretation(e.target.value)}
                  rows={2}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block text-[11px]">Geometric &amp; Continuity Assumptions:</label>
                <textarea
                  value={persistenceAssumptions}
                  onChange={(e) => setPersistenceAssumptions(e.target.value)}
                  rows={2}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* 4. Cross-Surface Trace Linking */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="font-bold text-cyan-300 uppercase flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-cyan-400" />
                  <span>Cross-Surface Trace Linking</span>
                </span>
                <span className="text-[10px] text-slate-400">Correlate Multi-Surface</span>
              </div>

              {otherJoints.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">No other joints mapped in this round to link.</p>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
                  {otherJoints.map((oj) => {
                    const isLinked = linkedTraceIds.includes(oj.id);
                    return (
                      <div
                        key={oj.id}
                        className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px]"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                FIELD_JOINT_GROUP_COLORS[oj.setId || 'unassigned']?.stroke || '#64748B',
                            }}
                          />
                          <span className="font-bold text-slate-200">{oj.id}</span>
                          <span className="text-slate-400">({oj.panel.replace('_', ' ')})</span>
                          <span className="font-mono text-amber-300">
                            {oj.dipDirection}°/{oj.dipAmount}°
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (isLinked) {
                              setLinkedTraceIds((prev) => prev.filter((id) => id !== oj.id));
                            } else {
                              setLinkedTraceIds((prev) => [...prev, oj.id]);
                            }
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                            isLinked
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                          }`}
                        >
                          {isLinked ? 'Unlink' : 'Link Joint'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 5. Spatial Intersections with Other Joints */}
            {otherJoints.length > 0 && pairIntersectionResult && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="font-bold text-purple-300 uppercase flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <span>Two-Plane Spatial Intersection</span>
                  </span>
                  <select
                    value={compareTargetJointId}
                    onChange={(e) => setCompareTargetJointId(e.target.value)}
                    className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-purple-300 font-bold text-[11px]"
                  >
                    {otherJoints.map((oj) => (
                      <option key={oj.id} value={oj.id}>
                        vs {oj.id} ({oj.setId})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Angle Between Planes:</span>
                    <strong className="text-purple-300 font-mono">
                      {pairIntersectionResult.angleBetweenPlanesDeg}°
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Intersection Line Plunge:</span>
                    <strong className="text-amber-300 font-mono">
                      {pairIntersectionResult.linePlungeDeg}°
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Intersection Line Trend:</span>
                    <strong className="text-cyan-400 font-mono">
                      {pairIntersectionResult.lineTrendDeg}°
                    </strong>
                  </div>
                </div>
              </div>
            )}
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
                  { id: 'VIEW_FACE' as InspectionViewTab, label: '2. Face' },
                  { id: 'VIEW_LEFT_WALL' as InspectionViewTab, label: '3. Left Wall' },
                  { id: 'VIEW_RIGHT_WALL' as InspectionViewTab, label: '4. Right Wall' },
                  { id: 'VIEW_CROWN' as InspectionViewTab, label: '5. Crown Arch' },
                  { id: 'VIEW_UNROLLED_COMBINED' as InspectionViewTab, label: '6. Unrolled Combined' },
                ].map((t) => {
                  const isAct = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTab(t.id)}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
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

                  {/* REAL-TIME 3D COMPASS GIZMO (TOP-RIGHT CORNER) */}
                  <div className="absolute top-3 right-3 p-3 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-slate-700/80 shadow-2xl flex flex-col items-center gap-2 pointer-events-auto z-20">
                    <div className="flex items-center justify-between w-full border-b border-slate-800 pb-1">
                      <span className="text-[10px] font-black uppercase text-amber-400 font-mono tracking-wider flex items-center gap-1">
                        <Navigation className="w-3.5 h-3.5" />
                        <span>3D Compass</span>
                      </span>
                      <span className="text-[9.5px] font-mono text-cyan-400 font-bold">
                        DRIVE: {Math.round(tunnelGeometry.driveAzimuthDeg ?? 0)}°
                      </span>
                    </div>

                    {/* Rotating 3D Compass Dial */}
                    <div className="relative w-24 h-24 flex items-center justify-center select-none">
                      {/* Outer Degree Dial */}
                      <div
                        ref={compassDialRef}
                        className="absolute inset-0 rounded-full border-2 border-slate-700 bg-slate-900/90 flex items-center justify-center transition-none shadow-inner"
                      >
                        {/* Cardinal Labels */}
                        <span className="absolute top-1 text-[11px] font-black text-rose-500 font-mono">N</span>
                        <span className="absolute right-1 text-[10px] font-bold text-slate-300 font-mono">E</span>
                        <span className="absolute bottom-1 text-[10px] font-bold text-slate-300 font-mono">S</span>
                        <span className="absolute left-1 text-[10px] font-bold text-slate-300 font-mono">W</span>
                        {/* Crosshairs */}
                        <div className="w-full h-px bg-slate-800/80 absolute" />
                        <div className="h-full w-px bg-slate-800/80 absolute" />
                      </div>

                      {/* North-South Needle */}
                      <div
                        ref={compassNeedleRef}
                        className="relative w-2.5 h-16 flex flex-col items-center justify-between transition-none z-10"
                      >
                        {/* North Tip (Vivid Red Triangle) */}
                        <div
                          className="w-0 h-0 border-x-[5px] border-x-transparent border-b-[24px] border-b-rose-500 drop-shadow"
                        />
                        {/* Center Pin */}
                        <div className="w-3.5 h-3.5 rounded-full bg-slate-100 border-2 border-slate-900 z-20 shadow" />
                        {/* South Tip (Silver Triangle) */}
                        <div
                          className="w-0 h-0 border-x-[5px] border-x-transparent border-t-[24px] border-t-slate-400 drop-shadow"
                        />
                      </div>
                    </div>

                    {/* Live Camera Azimuth & Tilt Readout */}
                    <span
                      ref={compassReadoutRef}
                      className="text-[9.5px] font-mono font-bold text-slate-300 text-center tracking-tight"
                    >
                      CAM AZ: 045° · TILT: 30°
                    </span>

                    {/* Quick Face Snaps on Compass */}
                    <div className="grid grid-cols-3 gap-1 w-full pt-1 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => setCameraPreset('FACE')}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[9px] text-cyan-300 font-bold cursor-pointer text-center"
                        title="Look at Excavation Face"
                      >
                        Face
                      </button>
                      <button
                        type="button"
                        onClick={() => setCameraPreset('PLAN')}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[9px] text-amber-300 font-bold cursor-pointer text-center"
                        title="Look from Crown Arch (Plan)"
                      >
                        Crown
                      </button>
                      <button
                        type="button"
                        onClick={() => setCameraPreset('ISO')}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[9px] text-emerald-300 font-bold cursor-pointer text-center"
                        title="Isometric Geotechnical View"
                      >
                        3D Iso
                      </button>
                    </div>
                  </div>

                  {/* OPTIONAL GEOLOGICAL VECTORS LEGEND OVERLAY (HIDDEN BY DEFAULT FOR CLEAN CANVAS) */}
                  {showLegendOverlay && (
                    <div className="absolute top-3 left-3 p-3 rounded-xl bg-slate-950/90 backdrop-blur-md border border-slate-800 font-mono text-[10.5px] space-y-1.5 shadow-xl pointer-events-none z-10">
                      <div className="font-bold text-amber-400 uppercase text-[11px] flex items-center justify-between">
                        <span>3D Geological Vectors</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded" style={{ backgroundColor: FIELD_JOINT_GROUP_COLORS[jointSetId]?.stroke || '#f59e0b' }} />
                        <span className="text-slate-100 font-bold">
                          Joint Plane {activeJoint.id} ({dipDirection}°/{dipAmount}°)
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

                  {/* Metric Dimensions HUD Badge (Bottom-Left) */}
                  <div className="absolute bottom-3 left-3 px-3 py-2 rounded-xl bg-slate-950/80 backdrop-blur-sm border border-slate-800 text-[10px] text-slate-300 font-mono shadow-md flex items-center gap-3 pointer-events-none z-10">
                    <div>
                      <span className="text-slate-500 block">TUNNEL PROFILE</span>
                      <strong className="text-white">{tunnelGeometry.widthM}m W × {tunnelGeometry.heightM}m H</strong>
                    </div>
                    <div className="w-px h-6 bg-slate-800" />
                    <div>
                      <span className="text-slate-500 block">ROUND PULL</span>
                      <strong className="text-cyan-400">{tunnelGeometry.pullLengthM}m Advance</strong>
                    </div>
                    <div className="w-px h-6 bg-slate-800" />
                    <div>
                      <span className="text-slate-500 block">CONFIRMED TRACE</span>
                      <strong className="text-emerald-400">{observedLengths.totalObservedM}m Extent</strong>
                    </div>
                  </div>

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

              {/* TAB 6: UNROLLED COMBINED VIEW */}
              {activeTab === 'VIEW_UNROLLED_COMBINED' && (
                <div className="w-full h-full p-4 overflow-y-auto space-y-4 font-mono bg-slate-950">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-sm text-cyan-300 uppercase">
                        Continuous Unrolled Developed Surface Strip (Left Wall + Crown + Right Wall + Face)
                      </span>
                      <span className="text-xs text-amber-400 font-bold font-mono">
                        Joint {activeJoint.id} ({dipDirection}°/{dipAmount}°)
                      </span>
                    </div>

                    <div className="w-full bg-slate-950 rounded-xl border border-slate-800 p-4">
                      <svg viewBox="0 0 900 240" className="w-full h-auto">
                        <rect x="20" y="30" width="180" height="180" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
                        <text x="110" y="25" fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle">
                          LEFT WALL
                        </text>

                        <rect x="220" y="30" width="220" height="180" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
                        <text x="330" y="25" fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle">
                          CROWN ARCH / BACK
                        </text>

                        <rect x="460" y="30" width="180" height="180" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
                        <text x="550" y="25" fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle">
                          RIGHT WALL
                        </text>

                        <rect x="660" y="30" width="200" height="180" fill="#1e293b" stroke="#0ea5e9" strokeWidth="2" />
                        <text x="760" y="25" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">
                          TUNNEL FACE
                        </text>

                        {activeJoint.panel === 'face' && activeJoint.points.length >= 2 && (
                          <polyline
                            points={activeJoint.points
                              .map((p) => `${660 + (p.x / 1000) * 200},${30 + (p.y / 800) * 180}`)
                              .join(' ')}
                            fill="none"
                            stroke="#38BDF8"
                            strokeWidth="3.5"
                          />
                        )}

                        {surfaceIntersections.face && (
                          <line
                            x1={660 + (surfaceIntersections.face.p1.x / tunnelGeometry.widthM) * 200}
                            y1={210 - (surfaceIntersections.face.p1.y / tunnelGeometry.heightM) * 180}
                            x2={660 + (surfaceIntersections.face.p2.x / tunnelGeometry.widthM) * 200}
                            y2={210 - (surfaceIntersections.face.p2.y / tunnelGeometry.heightM) * 180}
                            stroke="#F59E0B"
                            strokeWidth="2.5"
                            strokeDasharray="5,3"
                          />
                        )}
                      </svg>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 text-sky-400">
                          <span className="w-3 h-1 bg-sky-400 rounded" /> Directly Observed Trace
                        </span>
                        <span className="flex items-center gap-1.5 text-amber-400">
                          <span className="w-3 h-0.5 bg-amber-400 border-dashed" /> Mathematically Calculated Intersection
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
