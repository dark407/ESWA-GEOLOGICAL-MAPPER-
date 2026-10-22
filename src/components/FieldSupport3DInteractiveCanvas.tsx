import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Compass,
  RotateCcw,
  Maximize2,
  Minimize2,
  Layers,
  Sliders,
  Check,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Crosshair,
  Shield,
  HelpCircle,
  Sparkles,
  ArrowUpRight,
  Target,
  Wrench,
} from 'lucide-react';
import {
  FieldExcavationRound,
  FieldJointTrace,
  FieldPanelId,
  FieldSpotBoltItem,
  FieldSupportSystemConfig,
  FieldTunnelLocationItem,
  getLocationSurfaceConfig,
} from '../engine/fieldMappingEngine';

export interface FieldSupport3DInteractiveCanvasProps {
  activeLocation: FieldTunnelLocationItem;
  activeRound: FieldExcavationRound;
  support: FieldSupportSystemConfig;
  onUpdateSupport: (patch: Partial<FieldSupportSystemConfig>) => void;
  newSpotLengthM: number;
  setNewSpotLengthM: (len: number) => void;
  newSpotAngleDeg: number;
  setNewSpotAngleDeg: (deg: number) => void;
  newSpotAzimuthDeg: number;
  setNewSpotAzimuthDeg: (deg: number) => void;
  isLightMode?: boolean;
}

export type Support3DLayerFilter =
  | 'ALL'
  | 'SPOT_BOLTS'
  | 'PIPE_ROOFING'
  | 'FOREPOLING'
  | 'PATTERN_BOLTS'
  | 'STEEL_RIBS';

export type CameraPreset = 'perspective' | 'face' | 'crown' | 'side' | 'isometric';

/**
 * Generate 2D cross-section points along tunnel perimeter:
 * returns array of points { x, y } where x is transverse [-W/2, W/2] and y is height [0, H]
 */
function generateTunnelPerimeterPoints(
  shape: string,
  W: number,
  H: number,
  splH: number,
  numArchSegments = 32
): { x: number; y: number; normal: { x: number; y: number }; panel: FieldPanelId; arcT: number }[] {
  const pts: { x: number; y: number; normal: { x: number; y: number }; panel: FieldPanelId; arcT: number }[] = [];
  const halfW = W / 2;

  // Invert left corner to left springline
  const leftWallSteps = 6;
  for (let i = 0; i <= leftWallSteps; i++) {
    const t = i / leftWallSteps;
    const y = t * splH;
    pts.push({
      x: -halfW,
      y,
      normal: { x: -1, y: 0 },
      panel: 'left_wall',
      arcT: t,
    });
  }

  // Crown Arch from left springline to right springline
  const archRx = halfW;
  const archRy = Math.max(0.5, H - splH);
  for (let i = 1; i < numArchSegments; i++) {
    const t = i / numArchSegments; // 0 at left SPL, 0.5 at crown peak, 1 at right SPL
    const angle = Math.PI - t * Math.PI; // from PI to 0
    let x = Math.cos(angle) * archRx;
    let y = splH + Math.sin(angle) * archRy;
    if (shape === 'horseshoe') {
      y = splH + Math.sin(angle) * archRy * (1 - 0.1 * Math.sin(angle));
    } else if (shape === 'circular') {
      const r = W / 2;
      x = Math.cos(angle) * r;
      y = r + Math.sin(angle) * r;
    }
    // Normal vector pointing outward into rock
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const nLen = Math.hypot(nx, ny) || 1;
    pts.push({
      x,
      y,
      normal: { x: nx / nLen, y: ny / nLen },
      panel: 'crown',
      arcT: t,
    });
  }

  // Right springline down to invert
  const rightWallSteps = 6;
  for (let i = 0; i <= rightWallSteps; i++) {
    const t = i / rightWallSteps;
    const y = splH * (1 - t);
    pts.push({
      x: halfW,
      y,
      normal: { x: 1, y: 0 },
      panel: 'right_wall',
      arcT: t,
    });
  }

  return pts;
}

export const FieldSupport3DInteractiveCanvas: React.FC<FieldSupport3DInteractiveCanvasProps> = ({
  activeLocation,
  activeRound,
  support,
  onUpdateSupport,
  newSpotLengthM,
  setNewSpotLengthM,
  newSpotAngleDeg,
  setNewSpotAngleDeg,
  newSpotAzimuthDeg,
  setNewSpotAzimuthDeg,
  isLightMode = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Active interaction states
  const [selectedBoltId, setSelectedBoltId] = useState<string | null>(null);
  const [activeLayerFilter, setActiveLayerFilter] = useState<Support3DLayerFilter>('ALL');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('perspective');
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [showWireframe, setShowWireframe] = useState<boolean>(false);
  const [showNormals, setShowNormals] = useState<boolean>(true);
  const [activeToolMode, setActiveToolMode] = useState<'SELECT_ORIENT' | 'CLICK_TO_ADD'>('SELECT_ORIENT');
  const [activeQuickTab, setActiveQuickTab] = useState<'SPOT_BOLTS' | 'PIPE_ROOFING' | 'FOREPOLING'>('SPOT_BOLTS');

  // Physical tunnel parameters
  const surf3D = useMemo(() => getLocationSurfaceConfig(activeLocation), [activeLocation]);
  const pullM = Math.max(0.5, activeRound.pullLengthMeters || 3.0);
  const W = Math.max(1.5, surf3D.tunnelW || activeLocation.widthM || 8.5);
  const H = Math.max(1.5, surf3D.tunnelH || activeLocation.heightM || 7.5);
  const splH = Math.max(1.0, Math.min(H * 0.85, activeLocation.wallHeightM || 3.8));
  const shape = activeLocation.shape || 'horseshoe';

  // Find currently selected spot bolt
  const selectedBolt = useMemo(() => {
    if (!selectedBoltId) return support.spotBolts?.[0] || null;
    return support.spotBolts?.find((b) => b.id === selectedBoltId) || null;
  }, [selectedBoltId, support.spotBolts]);

  // Major joint sets available in active round
  const availableJointSets = useMemo(() => {
    const traces = activeRound.jointTraces || [];
    const setGroups: Record<string, { count: number; dipDeg: number; dipDirDeg: number }> = {};
    traces.forEach((tr) => {
      const g = (tr.setId && tr.setId !== 'unassigned') ? tr.setId : 'J1';
      if (!setGroups[g]) {
        setGroups[g] = { count: 0, dipDeg: tr.dipAmount || 60, dipDirDeg: tr.dipDirection || 45 };
      }
      setGroups[g].count++;
    });
    return Object.entries(setGroups).map(([id, info]) => ({
      id,
      label: `${id} (${info.dipDeg}°/DIR ${info.dipDirDeg}°)`,
      dipDeg: info.dipDeg,
      dipDirDeg: info.dipDirDeg,
    }));
  }, [activeRound.jointTraces]);

  // Camera Orbit Controls state in ref to avoid re-rendering WebGL
  const controlsRef = useRef({
    theta: 0.75, // Horizontal azimuth
    phi: 0.42,  // Elevation
    radius: Math.max(12, Math.max(W, H) * 2.2),
    target: new THREE.Vector3(0, H * 0.45, pullM * 0.5),
    isDragging: false,
    isPanning: false,
    prevX: 0,
    prevY: 0,
    cameraPreset: 'perspective' as CameraPreset,
  });

  // Keep cameraPreset ref in sync
  useEffect(() => {
    controlsRef.current.cameraPreset = cameraPreset;
    const c = controlsRef.current;
    if (cameraPreset === 'perspective') {
      c.theta = 0.75;
      c.phi = 0.42;
      c.target.set(0, H * 0.45, pullM * 0.5);
      c.radius = Math.max(12, Math.max(W, H) * 2.2);
    } else if (cameraPreset === 'face') {
      c.theta = 0;
      c.phi = 0.05;
      c.target.set(0, H * 0.45, pullM);
      c.radius = Math.max(10, Math.max(W, H) * 1.8);
    } else if (cameraPreset === 'crown') {
      c.theta = 0;
      c.phi = Math.PI * 0.48;
      c.target.set(0, H * 0.45, pullM * 0.5);
      c.radius = Math.max(12, Math.max(W, H) * 2.1);
    } else if (cameraPreset === 'side') {
      c.theta = Math.PI * 0.5;
      c.phi = 0.08;
      c.target.set(0, H * 0.45, pullM * 0.5);
      c.radius = Math.max(14, Math.max(W, pullM) * 2.4);
    } else if (cameraPreset === 'isometric') {
      c.theta = Math.PI * 0.25;
      c.phi = 0.55;
      c.target.set(0, H * 0.45, pullM * 0.5);
      c.radius = Math.max(13, Math.max(W, H) * 2.3);
    }
  }, [cameraPreset, W, H, pullM]);

  // Three.js Mount & Animation Loop
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 340;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(isLightMode ? 0xf1f5f9 : 0x030712);

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(isLightMode ? 0xffffff : 0x94a3b8, isLightMode ? 1.0 : 0.85);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.4);
    mainLight.position.set(W * 1.5, H * 2.0, pullM * 2.0);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.8);
    rimLight.position.set(-W * 1.5, -H * 0.5, -pullM * 1.0);
    scene.add(rimLight);

    const faceSpotLight = new THREE.SpotLight(0xffedd5, 2.5, 30, Math.PI / 3, 0.4);
    faceSpotLight.position.set(0, H * 0.8, pullM + 5);
    scene.add(faceSpotLight);

    // 3. Ground / Tunnel Invert Plane
    const gridHelper = new THREE.GridHelper(Math.max(20, W * 2.5), 20, 0x0284c7, 0x1e293b);
    gridHelper.position.set(0, 0, pullM * 0.5);
    scene.add(gridHelper);

    // 4. Render Procedural 3D Tunnel Shell Mesh
    const perimeterPts = generateTunnelPerimeterPoints(shape, W, H, splH, 36);
    const zSegments = Math.max(4, Math.round(pullM * 2));
    const zStep = pullM / zSegments;

    // Build extruded tunnel profile vertices and indices
    const tunnelGeom = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const numPts = perimeterPts.length;

    for (let iz = 0; iz <= zSegments; iz++) {
      const z = iz * zStep;
      for (let ip = 0; ip < numPts; ip++) {
        const pt = perimeterPts[ip];
        vertices.push(pt.x, pt.y, z);
        normals.push(-pt.normal.x, -pt.normal.y, 0); // facing inward toward tunnel void
        uvs.push(ip / (numPts - 1), iz / zSegments);
      }
    }

    // Connect quads for tunnel perimeter wall
    for (let iz = 0; iz < zSegments; iz++) {
      for (let ip = 0; ip < numPts - 1; ip++) {
        const i0 = iz * numPts + ip;
        const i1 = i0 + 1;
        const i2 = (iz + 1) * numPts + ip;
        const i3 = i2 + 1;
        // Two triangles per quad
        indices.push(i0, i2, i1);
        indices.push(i1, i2, i3);
      }
    }

    tunnelGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    tunnelGeom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    tunnelGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    tunnelGeom.setIndex(indices);

    const tunnelMat = new THREE.MeshStandardMaterial({
      color: isLightMode ? 0xdbeafe : 0x0f172a,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide,
      wireframe: showWireframe,
      transparent: true,
      opacity: 0.9,
    });
    const tunnelMesh = new THREE.Mesh(tunnelGeom, tunnelMat);
    scene.add(tunnelMesh);

    // Tunnel Edge Outlines / Ribs
    const wireGeom = new THREE.WireframeGeometry(tunnelGeom);
    const wireMat = new THREE.LineBasicMaterial({
      color: isLightMode ? 0x94a3b8 : 0x334155,
      transparent: true,
      opacity: 0.35,
    });
    const wireLines = new THREE.LineSegments(wireGeom, wireMat);
    scene.add(wireLines);

    // Excavation Face Wall at Pull M
    const faceShape = new THREE.Shape();
    faceShape.moveTo(perimeterPts[0].x, perimeterPts[0].y);
    for (let i = 1; i < perimeterPts.length; i++) {
      faceShape.lineTo(perimeterPts[i].x, perimeterPts[i].y);
    }
    faceShape.closePath();

    const faceGeom = new THREE.ShapeGeometry(faceShape);
    const faceMat = new THREE.MeshStandardMaterial({
      color: isLightMode ? 0xfef3c7 : 0x1e1b4b,
      roughness: 0.9,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const faceMesh = new THREE.Mesh(faceGeom, faceMat);
    faceMesh.position.set(0, 0, pullM);
    scene.add(faceMesh);

    // Outline along face perimeter (golden ring)
    const facePerimeterPts3D: THREE.Vector3[] = perimeterPts.map(
      (p) => new THREE.Vector3(p.x, p.y, pullM)
    );
    facePerimeterPts3D.push(new THREE.Vector3(perimeterPts[0].x, perimeterPts[0].y, pullM));
    const faceOutlineGeom = new THREE.BufferGeometry().setFromPoints(facePerimeterPts3D);
    const faceOutlineMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 });
    const faceOutlineLine = new THREE.Line(faceOutlineGeom, faceOutlineMat);
    scene.add(faceOutlineLine);

    // Outline along portal perimeter (0m)
    const portalPerimeterPts3D: THREE.Vector3[] = perimeterPts.map(
      (p) => new THREE.Vector3(p.x, p.y, 0)
    );
    portalPerimeterPts3D.push(new THREE.Vector3(perimeterPts[0].x, perimeterPts[0].y, 0));
    const portalOutlineGeom = new THREE.BufferGeometry().setFromPoints(portalPerimeterPts3D);
    const portalOutlineMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 2 });
    const portalOutlineLine = new THREE.Line(portalOutlineGeom, portalOutlineMat);
    scene.add(portalOutlineLine);

    // Steel Ribs / Lattice Girders (if enabled)
    if (
      (activeLayerFilter === 'ALL' || activeLayerFilter === 'STEEL_RIBS') &&
      (support.latticeGirderEnabled || support.ismbEnabled)
    ) {
      const ribSpacing = support.latticeGirderSpacingM || support.ismbSpacingM || 1.2;
      const numRibs = Math.max(1, Math.floor(pullM / ribSpacing));
      const ribMat = new THREE.LineBasicMaterial({
        color: support.ismbEnabled ? 0xa855f7 : 0x38bdf8,
        linewidth: 3,
      });

      for (let ir = 1; ir <= numRibs; ir++) {
        const rz = Math.min(pullM, ir * ribSpacing);
        const ribPts = perimeterPts.map((p) => new THREE.Vector3(p.x, p.y, rz));
        const ribGeom = new THREE.BufferGeometry().setFromPoints(ribPts);
        const ribLine = new THREE.Line(ribGeom, ribMat);
        scene.add(ribLine);
      }
    }

    // Pattern Rockbolts (Systematic Bolting) if enabled
    if (
      (activeLayerFilter === 'ALL' || activeLayerFilter === 'PATTERN_BOLTS') &&
      support.rockBoltsEnabled
    ) {
      const boltLen = support.rockBoltLengthM || 4.0;
      const inPlaneSpacing = Math.max(1.0, support.rockBoltInPlaneSpacingM || 1.5);
      const longSpacing = Math.max(1.0, support.rockBoltLongitudinalSpacingM || 1.5);
      const boltColor = 0x38bdf8;

      const numRings = Math.max(1, Math.floor(pullM / longSpacing));
      const ringZOffsets = Array.from({ length: numRings }, (_, i) => (i + 0.5) * (pullM / numRings));

      ringZOffsets.forEach((rz) => {
        // Step along crown & sidewalls by in-plane spacing
        const crownPts = perimeterPts.filter((p) =>
          support.rockBoltScope === 'crown_only' || support.rockBoltScope === 'crown'
            ? p.panel === 'crown'
            : p.panel !== 'face'
        );
        const stride = Math.max(2, Math.round(inPlaneSpacing * 3));
        for (let ip = 0; ip < crownPts.length; ip += stride) {
          const pt = crownPts[ip];
          const startPt = new THREE.Vector3(pt.x, pt.y, rz);
          // Radial normal outward into rock
          const normal = new THREE.Vector3(pt.normal.x, pt.normal.y, 0).normalize();
          const endPt = startPt.clone().add(normal.clone().multiplyScalar(boltLen));

          const boltGeom = new THREE.BufferGeometry().setFromPoints([startPt, endPt]);
          const boltMat = new THREE.LineBasicMaterial({
            color: boltColor,
            linewidth: 2,
            transparent: true,
            opacity: 0.65,
          });
          const boltLine = new THREE.Line(boltGeom, boltMat);
          scene.add(boltLine);

          // Small plate at collar
          const plateGeom = new THREE.BoxGeometry(0.18, 0.18, 0.04);
          const plateMat = new THREE.MeshStandardMaterial({ color: 0x64748b });
          const plateMesh = new THREE.Mesh(plateGeom, plateMat);
          plateMesh.position.copy(startPt);
          plateMesh.lookAt(endPt);
          scene.add(plateMesh);
        }
      });
    }

    // Pipe Roofing (Forepoling Umbrella Canopy) if enabled
    if (
      (activeLayerFilter === 'ALL' || activeLayerFilter === 'PIPE_ROOFING') &&
      support.pipeRoofingEnabled
    ) {
      const pipeLen = support.pipeRoofingLengthM || 12.0;
      const lookoutAngleDeg = support.pipeRoofingAngleDeg ?? 7.0;
      const lookoutRad = (lookoutAngleDeg * Math.PI) / 180;
      const numPipes = Math.max(16, Math.min(48, Math.round((W * 1.6) / 0.4)));

      // Umbrella crown arch points
      const crownArchPts = perimeterPts.filter((p) => p.panel === 'crown');
      const pipeStep = Math.max(1, Math.floor(crownArchPts.length / numPipes));

      for (let ip = 0; ip < crownArchPts.length; ip += pipeStep) {
        const pt = crownArchPts[ip];
        // Starting collar position: typically just behind the face or at last girder (e.g. at pullM * 0.7 or pullM)
        const collarPt = new THREE.Vector3(pt.x, pt.y, Math.max(0, pullM - 0.5));

        // Pipe vector: drives forward into +Z, flared outward by lookoutRad relative to normal
        const normal = new THREE.Vector3(pt.normal.x, pt.normal.y, 0).normalize();
        const dir = new THREE.Vector3(
          normal.x * Math.sin(lookoutRad),
          normal.y * Math.sin(lookoutRad),
          Math.cos(lookoutRad)
        ).normalize();

        const tipPt = collarPt.clone().add(dir.clone().multiplyScalar(pipeLen));

        // Create 3D Pipe Cylinder
        const pipeCylGeom = new THREE.CylinderGeometry(0.057, 0.057, pipeLen, 8);
        const pipeCylMat = new THREE.MeshStandardMaterial({
          color: 0xf97316, // Orange casing pipe
          roughness: 0.4,
          metalness: 0.7,
        });
        const pipeMesh = new THREE.Mesh(pipeCylGeom, pipeCylMat);

        // Position cylinder at midpoint and orient along dir
        const midPt = collarPt.clone().add(tipPt).multiplyScalar(0.5);
        pipeMesh.position.copy(midPt);
        pipeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        scene.add(pipeMesh);

        // Perforation holes or collar ring
        const collarRingGeom = new THREE.TorusGeometry(0.08, 0.02, 6, 12);
        const collarRingMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
        const collarRingMesh = new THREE.Mesh(collarRingGeom, collarRingMat);
        collarRingMesh.position.copy(collarPt);
        scene.add(collarRingMesh);
      }
    }

    // Forepoling Rebar Spiles (if enabled)
    if (
      (activeLayerFilter === 'ALL' || activeLayerFilter === 'FOREPOLING') &&
      support.forepolingEnabled
    ) {
      const spileLen = support.forepolingLengthM || 4.0;
      const spileAngleDeg = support.forepolingAngleDeg ?? 10.0;
      const spileRad = (spileAngleDeg * Math.PI) / 180;
      const crownArchPts = perimeterPts.filter((p) => p.panel === 'crown');
      const step = Math.max(1, Math.floor(crownArchPts.length / 20));

      for (let ip = 0; ip < crownArchPts.length; ip += step) {
        const pt = crownArchPts[ip];
        const collarPt = new THREE.Vector3(pt.x, pt.y, pullM);
        const normal = new THREE.Vector3(pt.normal.x, pt.normal.y, 0).normalize();
        const dir = new THREE.Vector3(
          normal.x * Math.sin(spileRad),
          normal.y * Math.sin(spileRad),
          Math.cos(spileRad)
        ).normalize();
        const tipPt = collarPt.clone().add(dir.clone().multiplyScalar(spileLen));

        const spileGeom = new THREE.BufferGeometry().setFromPoints([collarPt, tipPt]);
        const spileMat = new THREE.LineBasicMaterial({ color: 0xeab308, linewidth: 3 });
        const spileLine = new THREE.Line(spileGeom, spileMat);
        scene.add(spileLine);
      }
    }

    // Spot Bolts (Individual targeted rockbolts in 3D)
    if (activeLayerFilter === 'ALL' || activeLayerFilter === 'SPOT_BOLTS') {
      const spotBoltsList = support.spotBolts || [];

      spotBoltsList.forEach((sb) => {
        const isSelected = selectedBolt?.id === sb.id;
        const bLen = Math.max(1.0, sb.lengthM || 4.0);
        const bAngleDeg = sb.angleDeg || 65;
        const bAzimuthDeg = sb.azimuthDeg ?? 45;

        // Compute 3D Collar Point on tunnel surface
        let collarX = sb.xMeters ?? 0;
        let collarY = sb.yMeters ?? H * 0.8;
        let collarZ = Math.max(0, Math.min(pullM, sb.pullMeter ?? pullM * 0.5));

        // Find closest surface normal vector
        let surfNormal = new THREE.Vector3(0, 1, 0);
        if (sb.panel === 'face') {
          surfNormal.set(0, 0, 1);
          collarZ = pullM;
        } else if (sb.panel === 'left_wall') {
          surfNormal.set(-1, 0, 0);
          collarX = -W / 2;
        } else if (sb.panel === 'right_wall') {
          surfNormal.set(1, 0, 0);
          collarX = W / 2;
        } else {
          // Crown Arch: estimate radial normal from collarX, collarY
          const dx = collarX;
          const dy = Math.max(0.1, collarY - splH);
          surfNormal.set(dx / (W / 2), dy / Math.max(0.5, H - splH), 0).normalize();
        }

        // Compute 3D Direction Vector based on bAngleDeg (relative to surface normal or vertical) and bAzimuthDeg
        // bAngleDeg = 90 means exactly normal to surface; < 90 tilts away
        const angleRad = ((90 - bAngleDeg) * Math.PI) / 180;
        const azRad = (bAzimuthDeg * Math.PI) / 180;

        // Tangent vector along tunnel axis Z
        const tangentZ = new THREE.Vector3(0, 0, Math.cos(azRad));
        const tangentTrans = new THREE.Vector3(-surfNormal.y, surfNormal.x, 0).multiplyScalar(Math.sin(azRad));
        const tangentDir = tangentZ.add(tangentTrans).normalize();

        const boltDir = surfNormal
          .clone()
          .multiplyScalar(Math.cos(angleRad))
          .add(tangentDir.clone().multiplyScalar(Math.sin(angleRad)))
          .normalize();

        const collar3D = new THREE.Vector3(collarX, collarY, collarZ);
        const tip3D = collar3D.clone().add(boltDir.clone().multiplyScalar(bLen));

        // 3D Bolt Shank Cylinder
        const boltCylGeom = new THREE.CylinderGeometry(0.035, 0.035, bLen, 10);
        const boltCylMat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0xf59e0b : 0xf43f5e,
          roughness: 0.3,
          metalness: 0.8,
          emissive: isSelected ? 0xb45309 : 0x881337,
          emissiveIntensity: isSelected ? 0.6 : 0.2,
        });
        const boltMesh = new THREE.Mesh(boltCylGeom, boltCylMat);
        const midPoint = collar3D.clone().add(tip3D).multiplyScalar(0.5);
        boltMesh.position.copy(midPoint);
        boltMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), boltDir);
        scene.add(boltMesh);

        // Direction Arrow Tip / Cone at bolt tip penetrating rock
        const tipConeGeom = new THREE.ConeGeometry(0.08, 0.22, 10);
        const tipConeMat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0xfef08a : 0xfb7185,
        });
        const tipConeMesh = new THREE.Mesh(tipConeGeom, tipConeMat);
        tipConeMesh.position.copy(tip3D);
        tipConeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), boltDir);
        scene.add(tipConeMesh);

        // Anchor Bearing Plate (Domed Square Steel Washer) on rock face
        const plateGeom = new THREE.BoxGeometry(0.26, 0.26, 0.04);
        const plateMat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0xf59e0b : 0xe2e8f0,
          metalness: 0.85,
          roughness: 0.25,
        });
        const plateMesh = new THREE.Mesh(plateGeom, plateMat);
        plateMesh.position.copy(collar3D);
        plateMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), surfNormal);
        scene.add(plateMesh);

        // Hex Nut on Washer
        const nutGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.06, 6);
        const nutMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });
        const nutMesh = new THREE.Mesh(nutGeom, nutMat);
        nutMesh.position.copy(collar3D.clone().add(surfNormal.clone().multiplyScalar(0.04)));
        scene.add(nutMesh);

        // If selected: show Normal Vector ray and Angle Arc Gizmo
        if (isSelected && showNormals) {
          // Normal guide ray (cyan dashed line)
          const normalRayLen = 2.0;
          const normalRayEnd = collar3D.clone().add(surfNormal.clone().multiplyScalar(normalRayLen));
          const normalGeom = new THREE.BufferGeometry().setFromPoints([collar3D, normalRayEnd]);
          const normalMat = new THREE.LineDashedMaterial({
            color: 0x38bdf8,
            dashSize: 0.15,
            gapSize: 0.1,
            linewidth: 2,
          });
          const normalLine = new THREE.Line(normalGeom, normalMat);
          normalLine.computeLineDistances();
          scene.add(normalLine);

          // Angle arc arc points between surfNormal and boltDir
          const arcPts: THREE.Vector3[] = [];
          const arcRadius = 1.2;
          const numArcSteps = 16;
          for (let ia = 0; ia <= numArcSteps; ia++) {
            const t = ia / numArcSteps;
            const interpDir = new THREE.Vector3()
              .lerpVectors(surfNormal, boltDir, t)
              .normalize()
              .multiplyScalar(arcRadius);
            arcPts.push(collar3D.clone().add(interpDir));
          }
          const arcGeom = new THREE.BufferGeometry().setFromPoints(arcPts);
          const arcMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 3 });
          const arcLine = new THREE.Line(arcGeom, arcMat);
          scene.add(arcLine);

          // Selection highlight sphere halo at collar
          const haloGeom = new THREE.RingGeometry(0.2, 0.35, 24);
          const haloMat = new THREE.MeshBasicMaterial({
            color: 0xf59e0b,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.75,
          });
          const haloMesh = new THREE.Mesh(haloGeom, haloMat);
          haloMesh.position.copy(collar3D.clone().add(surfNormal.clone().multiplyScalar(0.02)));
          haloMesh.lookAt(collar3D.clone().add(surfNormal));
          scene.add(haloMesh);
        }
      });
    }

    // 5. Animation / Render Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Auto-rotation if enabled
      if (isRotating) {
        controlsRef.current.theta += 0.005;
      }

      // Update camera position from spherical coordinates
      const { theta, phi, radius, target } = controlsRef.current;
      const clampedPhi = Math.max(0.01, Math.min(Math.PI * 0.49, phi));
      camera.position.x = target.x + radius * Math.sin(theta) * Math.cos(clampedPhi);
      camera.position.y = target.y + radius * Math.sin(clampedPhi);
      camera.position.z = target.z + radius * Math.cos(theta) * Math.cos(clampedPhi);
      camera.lookAt(target);

      renderer.render(scene, camera);
    };
    animate();

    // 6. Pointer Controls for Camera Orbit / Pan / Zoom
    const handlePointerDown = (e: PointerEvent) => {
      controlsRef.current.isDragging = e.button === 0;
      controlsRef.current.isPanning = e.button === 2;
      controlsRef.current.prevX = e.clientX;
      controlsRef.current.prevY = e.clientY;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const c = controlsRef.current;
      if (!c.isDragging && !c.isPanning) return;

      const dx = e.clientX - c.prevX;
      const dy = e.clientY - c.prevY;
      c.prevX = e.clientX;
      c.prevY = e.clientY;

      if (c.isDragging) {
        c.theta -= dx * 0.007;
        c.phi += dy * 0.007;
      } else if (c.isPanning) {
        // Pan target in camera space
        const panSpeed = c.radius * 0.0015;
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
        c.target.add(right.multiplyScalar(-dx * panSpeed));
        c.target.add(camera.up.clone().multiplyScalar(dy * panSpeed));
      }
    };

    const handlePointerUp = () => {
      controlsRef.current.isDragging = false;
      controlsRef.current.isPanning = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSpeed = 0.0015;
      const newRadius = controlsRef.current.radius * (1 + e.deltaY * zoomSpeed);
      controlsRef.current.radius = Math.max(4, Math.min(60, newRadius));
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    dom.addEventListener('wheel', handleWheel, { passive: false });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      if (newW > 0 && newH > 0) {
        camera.aspect = newW / newH;
        camera.updateProjectionMatrix();
        renderer.setSize(newW, newH);
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      dom.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      dom.removeEventListener('wheel', handleWheel);
      if (rendererRef.current?.domElement) {
        container.removeChild(rendererRef.current.domElement);
      }
      renderer.dispose();
      tunnelGeom.dispose();
      tunnelMat.dispose();
    };
  }, [
    activeLocation,
    activeRound,
    support,
    selectedBolt,
    activeLayerFilter,
    showWireframe,
    showNormals,
    isRotating,
    isLightMode,
    W,
    H,
    splH,
    pullM,
    shape,
  ]);

  // Click on Canvas to Add or Select Spot Bolt
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeToolMode !== 'CLICK_TO_ADD') return;
    const container = containerRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!container || !camera || !scene) return;

    const rect = container.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

    const intersects = raycaster.intersectObjects(scene.children, true);
    // Find intersection on tunnel shell or face
    const validHit = intersects.find(
      (h) => h.point.y >= 0 && h.point.z >= 0 && h.point.z <= pullM * 1.05
    );

    if (validHit) {
      const pt = validHit.point;
      const halfW = W / 2;

      let panel: FieldPanelId = 'crown';
      if (Math.abs(pt.z - pullM) < 0.25) {
        panel = 'face';
      } else if (pt.x <= -halfW * 0.85) {
        panel = 'left_wall';
      } else if (pt.x >= halfW * 0.85) {
        panel = 'right_wall';
      } else {
        panel = 'crown';
      }

      const nextIdx = (support.spotBolts?.length || 0) + 1;
      const newBolt: FieldSpotBoltItem = {
        id: `sb-${Date.now()}`,
        label: `SB-${nextIdx}`,
        panel,
        u: Number((((pt.x + halfW) / W)).toFixed(3)),
        v: Number((pt.y / H).toFixed(3)),
        pullMeter: Number(pt.z.toFixed(2)),
        xMeters: Number(pt.x.toFixed(2)),
        yMeters: Number(pt.y.toFixed(2)),
        lengthM: newSpotLengthM,
        angleDeg: newSpotAngleDeg,
        azimuthDeg: newSpotAzimuthDeg,
      };

      onUpdateSupport({
        spotBoltsEnabled: true,
        spotBolts: [...(support.spotBolts || []), newBolt],
      });
      setSelectedBoltId(newBolt.id);
    }
  };

  // Quick Preset Handlers to Simply Choose Spotbolt Angle
  const setBoltAngle = (angleDeg: number, azimuthDeg?: number) => {
    if (!selectedBolt) {
      setNewSpotAngleDeg(angleDeg);
      if (azimuthDeg !== undefined) setNewSpotAzimuthDeg(azimuthDeg);
      return;
    }
    onUpdateSupport({
      spotBolts: (support.spotBolts || []).map((b) =>
        b.id === selectedBolt.id
          ? {
              ...b,
              angleDeg,
              azimuthDeg: azimuthDeg !== undefined ? azimuthDeg : b.azimuthDeg,
            }
          : b
      ),
    });
  };

  const setBoltLength = (lengthM: number) => {
    if (!selectedBolt) {
      setNewSpotLengthM(lengthM);
      return;
    }
    onUpdateSupport({
      spotBolts: (support.spotBolts || []).map((b) =>
        b.id === selectedBolt.id ? { ...b, lengthM } : b
      ),
    });
  };

  const deleteCurrentBolt = () => {
    if (!selectedBolt) return;
    onUpdateSupport({
      spotBolts: (support.spotBolts || []).filter((b) => b.id !== selectedBolt.id),
    });
    setSelectedBoltId(null);
  };

  return (
    <div className="flex flex-col gap-2.5 bg-slate-900 border border-rose-500/40 rounded-xl p-2.5 sm:p-3 shadow-xl">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-rose-500/20 text-rose-400">
            <Crosshair className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-black uppercase text-rose-400 flex items-center gap-2">
              <span>Interactive 3D Tunnel &amp; Support System</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800">
                {W}m × {H}m × {pullM}m Pull
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              True 3D Spatial View — Simply select and orient Spot Bolts, Pipe Roofing Umbrella, Forepoling &amp; Pattern Rockbolts
            </div>
          </div>
        </div>

        {/* Layer Filters */}
        <div className="flex items-center gap-1 text-[11px] bg-slate-950 p-1 rounded-lg border border-slate-800">
          {(
            [
              { id: 'ALL', label: 'All 3D' },
              { id: 'SPOT_BOLTS', label: 'Spot Bolts' },
              { id: 'PIPE_ROOFING', label: 'Pipe Roofing' },
              { id: 'FOREPOLING', label: 'Forepoling' },
              { id: 'PATTERN_BOLTS', label: 'Pattern Bolts' },
            ] as const
          ).map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveLayerFilter(filter.id)}
              className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                activeLayerFilter === filter.id
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main 3D Viewport with Floating Controls */}
      <div className="relative w-full h-[270px] sm:h-[320px] bg-slate-950 rounded-lg border border-slate-800 overflow-hidden select-none">
        {/* Three.js Container */}
        <div
          ref={containerRef}
          onClick={handleCanvasClick}
          className={`w-full h-full ${activeToolMode === 'CLICK_TO_ADD' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
        />

        {/* Top-Left Viewport Mode Badges & Camera Presets */}
        <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1.5 pointer-events-auto">
          <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-md p-0.5 text-[10px]">
            {(
              [
                { id: 'perspective', label: '3D Orbit' },
                { id: 'face', label: 'Face' },
                { id: 'crown', label: 'Crown' },
                { id: 'side', label: 'Side Look' },
                { id: 'isometric', label: 'Iso' },
              ] as const
            ).map((cp) => (
              <button
                key={cp.id}
                type="button"
                onClick={() => setCameraPreset(cp.id)}
                className={`px-1.5 py-0.5 rounded font-semibold cursor-pointer ${
                  cameraPreset === cp.id
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {cp.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsRotating((r) => !r)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
              isRotating
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {isRotating ? 'Auto-Rotate ON' : 'Rotate'}
          </button>

          <button
            type="button"
            onClick={() => setShowWireframe((w) => !w)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
              showWireframe
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {showWireframe ? 'Wireframe' : 'Solid Shell'}
          </button>
        </div>

        {/* Top-Right Tool Mode (Select / Orient vs Click to Place) */}
        <div className="absolute top-2 right-2 flex items-center gap-1 pointer-events-auto bg-slate-900/90 backdrop-blur border border-slate-700/80 rounded-md p-0.5 text-[10px]">
          <button
            type="button"
            onClick={() => setActiveToolMode('SELECT_ORIENT')}
            className={`px-2 py-1 rounded font-bold flex items-center gap-1 cursor-pointer ${
              activeToolMode === 'SELECT_ORIENT'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-3 h-3" />
            <span>Choose Angle</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveToolMode('CLICK_TO_ADD')}
            className={`px-2 py-1 rounded font-bold flex items-center gap-1 cursor-pointer ${
              activeToolMode === 'CLICK_TO_ADD'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Plus className="w-3 h-3" />
            <span>+ Click 3D to Place</span>
          </button>
        </div>

        {/* Bottom Floating Legend / Indicator */}
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center justify-between gap-2 pointer-events-none text-[10.5px]">
          <div className="flex items-center gap-2 bg-slate-950/85 backdrop-blur px-2.5 py-1 rounded-md border border-slate-800 text-slate-300">
            <span className="flex items-center gap-1 text-rose-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Spot Bolt ({support.spotBolts?.length || 0})
            </span>
            {support.pipeRoofingEnabled && (
              <span className="flex items-center gap-1 text-orange-400">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" /> Pipe Roof (∠{support.pipeRoofingAngleDeg ?? 7}°)
              </span>
            )}
            {support.forepolingEnabled && (
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> Forepoling (∠{support.forepolingAngleDeg ?? 10}°)
              </span>
            )}
            {support.rockBoltsEnabled && (
              <span className="flex items-center gap-1 text-sky-400">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" /> Pattern Bolts ({support.rockBoltLengthM}m)
              </span>
            )}
          </div>
          <div className="bg-slate-950/85 backdrop-blur px-2 py-1 rounded-md border border-slate-800 text-[9.5px] text-slate-400">
            Drag to Rotate • Right-Click / 2-Finger to Pan • Scroll to Zoom
          </div>
        </div>
      </div>

      {/* Angle Chooser Tabs: Spot Bolts vs Pipe Roofing Umbrella vs Forepoling */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
        <button
          type="button"
          onClick={() => setActiveQuickTab('SPOT_BOLTS')}
          className={`px-3 py-1 text-xs font-bold rounded-t-lg transition-colors cursor-pointer ${
            activeQuickTab === 'SPOT_BOLTS'
              ? 'bg-rose-950/70 border-t-2 border-rose-500 text-rose-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          1. Spot Bolts Angle &amp; Orientation
        </button>
        <button
          type="button"
          onClick={() => setActiveQuickTab('PIPE_ROOFING')}
          className={`px-3 py-1 text-xs font-bold rounded-t-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeQuickTab === 'PIPE_ROOFING'
              ? 'bg-orange-950/70 border-t-2 border-orange-500 text-orange-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>2. Pipe Roofing (Umbrella Canopy)</span>
          {support.pipeRoofingEnabled && (
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveQuickTab('FOREPOLING')}
          className={`px-3 py-1 text-xs font-bold rounded-t-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeQuickTab === 'FOREPOLING'
              ? 'bg-yellow-950/70 border-t-2 border-yellow-500 text-yellow-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>3. Forepoling Spiles</span>
          {support.forepolingEnabled && (
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
          )}
        </button>
      </div>

      {/* TAB 1: SPOT BOLTS ANGLE CHOOSER */}
      {activeQuickTab === 'SPOT_BOLTS' && (
        <div className="space-y-2.5">
          {/* Active Bolt Selector Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-300 mr-1">Active Bolt:</span>
            {(support.spotBolts || []).map((sb) => {
              const isSelected = selectedBolt?.id === sb.id;
              return (
                <button
                  key={sb.id}
                  type="button"
                  onClick={() => setSelectedBoltId(sb.id)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{sb.label}</span>
                  <span className="text-[10px] opacity-80">({sb.pullMeter}m, ∠{sb.angleDeg}°)</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                const nextIdx = (support.spotBolts?.length || 0) + 1;
                const newBolt: FieldSpotBoltItem = {
                  id: `sb-${Date.now()}`,
                  label: `SB-${nextIdx}`,
                  panel: 'crown',
                  u: 0.5,
                  v: 0.5,
                  pullMeter: Number((pullM * 0.5).toFixed(2)),
                  xMeters: 0,
                  yMeters: Number((H * 0.88).toFixed(2)),
                  lengthM: newSpotLengthM,
                  angleDeg: newSpotAngleDeg,
                  azimuthDeg: newSpotAzimuthDeg,
                };
                onUpdateSupport({
                  spotBoltsEnabled: true,
                  spotBolts: [...(support.spotBolts || []), newBolt],
                });
                setSelectedBoltId(newBolt.id);
              }}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Bolt</span>
            </button>
          </div>

          {/* Interactive Angle Dial & Slider Chooser */}
          {selectedBolt ? (
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 sm:p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-300 font-mono">
                    {selectedBolt.label} ({selectedBolt.panel.replace('_', ' ').toUpperCase()})
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Pull: <strong className="text-white">{selectedBolt.pullMeter}m</strong> | X: <strong className="text-white">{selectedBolt.xMeters}m</strong> | Y: <strong className="text-white">{selectedBolt.yMeters}m</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={deleteCurrentBolt}
                  className="px-2 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Bolt</span>
                </button>
              </div>

              {/* Angle Presets (Quick 1-Click Buttons) */}
              <div>
                <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Target className="w-3 h-3 text-rose-400" />
                  <span>Simply Choose Angle Presets:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBoltAngle(90)}
                    className={`px-2 py-1.5 rounded text-left text-xs font-semibold border transition-all cursor-pointer ${
                      selectedBolt.angleDeg === 90
                        ? 'bg-rose-600/30 border-rose-500 text-rose-200'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold">🎯 Normal (90°)</div>
                    <div className="text-[9.5px] text-slate-400">Perpendicular to Arch</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBoltAngle(75, 0)}
                    className={`px-2 py-1.5 rounded text-left text-xs font-semibold border transition-all cursor-pointer ${
                      selectedBolt.angleDeg === 75
                        ? 'bg-rose-600/30 border-rose-500 text-rose-200'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold">🔺 Steep Arch (75°)</div>
                    <div className="text-[9.5px] text-slate-400">Crown Wedge Pinning</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBoltAngle(60, 45)}
                    className={`px-2 py-1.5 rounded text-left text-xs font-semibold border transition-all cursor-pointer ${
                      selectedBolt.angleDeg === 60
                        ? 'bg-rose-600/30 border-rose-500 text-rose-200'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold">📐 Incline (60°)</div>
                    <div className="text-[9.5px] text-slate-400">Forward Heading Tilt</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBoltAngle(45, 0)}
                    className={`px-2 py-1.5 rounded text-left text-xs font-semibold border transition-all cursor-pointer ${
                      selectedBolt.angleDeg === 45
                        ? 'bg-rose-600/30 border-rose-500 text-rose-200'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold">↗ Face / Spandrel (45°)</div>
                    <div className="text-[9.5px] text-slate-400">Diagonal Anchoring</div>
                  </button>
                </div>
              </div>

              {/* Orthogonal to Joint Sets Presets (if joints exist in round) */}
              {availableJointSets.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Perpendicular to Intersecting Joint Planes (Shear Keys):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableJointSets.map((js) => (
                      <button
                        key={js.id}
                        type="button"
                        onClick={() => {
                          // Perpendicular to joint: 90 - dip angle, oriented orthogonal to strike
                          const perpAngle = Math.max(15, Math.min(85, Math.round(90 - js.dipDeg + 30)));
                          const perpAzimuth = (js.dipDirDeg + 180) % 360;
                          setBoltAngle(perpAngle, perpAzimuth);
                        }}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-850 border border-amber-500/40 text-amber-200 text-xs font-medium cursor-pointer"
                      >
                        ⚡ Orthogonal to {js.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sliders for Precise Custom Angle, Azimuth, and Length */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {/* 1. Installation Angle Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-bold">Installation Angle:</span>
                    <span className="font-mono text-rose-400 font-bold">{selectedBolt.angleDeg}°</span>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={90}
                    step={1}
                    value={selectedBolt.angleDeg}
                    onChange={(e) => setBoltAngle(Number(e.target.value))}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>15° (Flat)</span>
                    <span>60° (Incline)</span>
                    <span>90° (Normal)</span>
                  </div>
                </div>

                {/* 2. Azimuth / Tilt Heading Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-bold">Azimuth / Heading:</span>
                    <span className="font-mono text-amber-400 font-bold">{selectedBolt.azimuthDeg ?? 45}°</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={5}
                    value={selectedBolt.azimuthDeg ?? 45}
                    onChange={(e) => setBoltAngle(selectedBolt.angleDeg, Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>0° (Face)</span>
                    <span>90° (Right)</span>
                    <span>180° (Back)</span>
                    <span>270° (Left)</span>
                  </div>
                </div>

                {/* 3. Bolt Length Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-bold">Bolt Length:</span>
                    <span className="font-mono text-emerald-400 font-bold">{selectedBolt.lengthM}m</span>
                  </div>
                  <input
                    type="range"
                    min={1.5}
                    max={8.0}
                    step={0.5}
                    value={selectedBolt.lengthM}
                    onChange={(e) => setBoltLength(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>2.0m</span>
                    <span>4.0m</span>
                    <span>6.0m</span>
                    <span>8.0m</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
              No spot bolt selected. Click any spot bolt in the 3D scene or click <strong>&quot;+ Add Bolt&quot;</strong> above to create one.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PIPE ROOFING (UMBRELLA CANOPY) ANGLE & SPEC CHOOSER */}
      {activeQuickTab === 'PIPE_ROOFING' && (
        <div className="bg-slate-950/80 border border-orange-500/40 rounded-lg p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(support.pipeRoofingEnabled)}
                  onChange={(e) =>
                    onUpdateSupport({
                      protectionSupportEnabled: true,
                      pipeRoofingEnabled: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-orange-500 rounded cursor-pointer"
                />
                <span className="text-xs font-bold text-orange-400">
                  Enable Pipe Roofing (Umbrella Canopy) in 3D
                </span>
              </label>
            </div>
            <div className="text-[11px] text-slate-400">
              Drilled ahead of face over crown arch to protect against portal/fault collapse
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Pipe Roofing Look-out Angle Chooser */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-bold">Look-out Angle (Flaring):</span>
                <span className="font-mono text-orange-400 font-bold text-sm">
                  ∠{support.pipeRoofingAngleDeg ?? 7}°
                </span>
              </div>
              <input
                type="range"
                min={3}
                max={15}
                step={1}
                value={support.pipeRoofingAngleDeg ?? 7}
                onChange={(e) =>
                  onUpdateSupport({
                    protectionSupportEnabled: true,
                    pipeRoofingEnabled: true,
                    pipeRoofingAngleDeg: Number(e.target.value),
                  })
                }
                className="w-full accent-orange-500 cursor-pointer"
              />
              <div className="flex justify-between gap-1 text-[10px]">
                {[3, 5, 7, 10, 12, 15].map((ang) => (
                  <button
                    key={ang}
                    type="button"
                    onClick={() =>
                      onUpdateSupport({
                        protectionSupportEnabled: true,
                        pipeRoofingEnabled: true,
                        pipeRoofingAngleDeg: ang,
                      })
                    }
                    className={`px-1.5 py-0.5 rounded font-mono font-bold cursor-pointer ${
                      (support.pipeRoofingAngleDeg ?? 7) === ang
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {ang}°
                  </button>
                ))}
              </div>
            </div>

            {/* Pipe Length & Overlap */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-bold">Pipe Length (m):</span>
                <span className="font-mono text-orange-400 font-bold">
                  {support.pipeRoofingLengthM ?? 12.0}m
                </span>
              </div>
              <div className="flex gap-1">
                {[6, 9, 12, 15, 18].map((len) => (
                  <button
                    key={len}
                    type="button"
                    onClick={() =>
                      onUpdateSupport({
                        protectionSupportEnabled: true,
                        pipeRoofingEnabled: true,
                        pipeRoofingLengthM: len,
                      })
                    }
                    className={`flex-1 py-1 rounded text-xs font-mono font-bold cursor-pointer ${
                      (support.pipeRoofingLengthM ?? 12) === len
                        ? 'bg-orange-600 text-white'
                        : 'bg-slate-900 border border-slate-800 text-slate-300'
                    }`}
                  >
                    {len}m
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-400">
                Design Overlap: <strong>{support.pipeRoofingOverlapM ?? 4.0}m</strong> (ahead of next round)
              </div>
            </div>

            {/* Casing Diameter & Spacing */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-bold">Casing Spec &amp; Spacing:</span>
                <span className="font-mono text-slate-200">
                  Ø{support.pipeRoofingDiameterMm ?? 114}mm @ {support.pipeRoofingSpacingCm ?? 40}cm
                </span>
              </div>
              <div className="flex gap-1.5">
                <select
                  value={support.pipeRoofingDiameterMm ?? 114}
                  onChange={(e) =>
                    onUpdateSupport({
                      protectionSupportEnabled: true,
                      pipeRoofingEnabled: true,
                      pipeRoofingDiameterMm: Number(e.target.value),
                    })
                  }
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white flex-1"
                >
                  <option value={76}>Ø 76 mm (Standard)</option>
                  <option value={89}>Ø 89 mm (Medium)</option>
                  <option value={114}>Ø 114 mm (Heavy Duty)</option>
                  <option value={140}>Ø 140 mm (Severe Fault)</option>
                </select>
                <select
                  value={support.pipeRoofingSpacingCm ?? 40}
                  onChange={(e) =>
                    onUpdateSupport({
                      protectionSupportEnabled: true,
                      pipeRoofingEnabled: true,
                      pipeRoofingSpacingCm: Number(e.target.value),
                    })
                  }
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white w-24"
                >
                  <option value={30}>30 cm</option>
                  <option value={40}>40 cm</option>
                  <option value={50}>50 cm</option>
                </select>
              </div>
              <div className="text-[10px] text-slate-400">
                Sector: <strong>{support.pipeRoofingSector || 'Crown Arch (120°)'}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FOREPOLING (REBAR SPILES) ANGLE CHOOSER */}
      {activeQuickTab === 'FOREPOLING' && (
        <div className="bg-slate-950/80 border border-yellow-500/40 rounded-lg p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(support.forepolingEnabled)}
                  onChange={(e) =>
                    onUpdateSupport({
                      protectionSupportEnabled: true,
                      forepolingEnabled: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-yellow-500 rounded cursor-pointer"
                />
                <span className="text-xs font-bold text-yellow-400">
                  Enable Forepoling (Rebar Spiles) in 3D
                </span>
              </label>
            </div>
            <div className="text-[11px] text-slate-400">
              Immediate roof pre-support driven manually or with jumbo drill ahead of crown
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Forepoling Angle Chooser */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-bold">Driving Angle:</span>
                <span className="font-mono text-yellow-400 font-bold text-sm">
                  ∠{support.forepolingAngleDeg ?? 10}°
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={25}
                step={1}
                value={support.forepolingAngleDeg ?? 10}
                onChange={(e) =>
                  onUpdateSupport({
                    protectionSupportEnabled: true,
                    forepolingEnabled: true,
                    forepolingAngleDeg: Number(e.target.value),
                  })
                }
                className="w-full accent-yellow-500 cursor-pointer"
              />
              <div className="flex justify-between gap-1 text-[10px]">
                {[8, 10, 12, 15, 20].map((ang) => (
                  <button
                    key={ang}
                    type="button"
                    onClick={() =>
                      onUpdateSupport({
                        protectionSupportEnabled: true,
                        forepolingEnabled: true,
                        forepolingAngleDeg: ang,
                      })
                    }
                    className={`px-1.5 py-0.5 rounded font-mono font-bold cursor-pointer ${
                      (support.forepolingAngleDeg ?? 10) === ang
                        ? 'bg-yellow-500 text-slate-950'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {ang}°
                  </button>
                ))}
              </div>
            </div>

            {/* Spile Length */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-bold">Spile Length:</span>
                <span className="font-mono text-yellow-400 font-bold">
                  {support.forepolingLengthM ?? 4.0}m
                </span>
              </div>
              <div className="flex gap-1">
                {[3.0, 3.5, 4.0, 4.5, 5.0].map((len) => (
                  <button
                    key={len}
                    type="button"
                    onClick={() =>
                      onUpdateSupport({
                        protectionSupportEnabled: true,
                        forepolingEnabled: true,
                        forepolingLengthM: len,
                      })
                    }
                    className={`flex-1 py-1 rounded text-xs font-mono font-bold cursor-pointer ${
                      (support.forepolingLengthM ?? 4.0) === len
                        ? 'bg-yellow-600 text-slate-950'
                        : 'bg-slate-900 border border-slate-800 text-slate-300'
                    }`}
                  >
                    {len}m
                  </button>
                ))}
              </div>
            </div>

            {/* Spile Diameter & Spacing */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-bold">Rebar Diameter &amp; Spacing:</span>
                <span className="font-mono text-slate-200">
                  Ø{support.forepolingDiameterMm ?? 25}mm @ {support.forepolingSpacingCm ?? 30}cm
                </span>
              </div>
              <div className="flex gap-1.5">
                <select
                  value={support.forepolingDiameterMm ?? 25}
                  onChange={(e) =>
                    onUpdateSupport({
                      protectionSupportEnabled: true,
                      forepolingEnabled: true,
                      forepolingDiameterMm: Number(e.target.value),
                    })
                  }
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white flex-1"
                >
                  <option value={25}>Ø 25 mm Rebar</option>
                  <option value={28}>Ø 28 mm Rebar</option>
                  <option value={32}>Ø 32 mm Heavy Bar</option>
                </select>
                <select
                  value={support.forepolingSpacingCm ?? 30}
                  onChange={(e) =>
                    onUpdateSupport({
                      protectionSupportEnabled: true,
                      forepolingEnabled: true,
                      forepolingSpacingCm: Number(e.target.value),
                    })
                  }
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white w-24"
                >
                  <option value={20}>20 cm</option>
                  <option value={30}>30 cm</option>
                  <option value={40}>40 cm</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
