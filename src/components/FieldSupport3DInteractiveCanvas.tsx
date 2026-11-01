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
import {
  normalizeVerticalShaftExcavationApproach,
  normalizeVerticalShaftHalfSide,
  normalizeVerticalShaftCenterMedianStatus,
} from '../engine/verticalShaftEngine';
import { formatSpotBoltPanelLabel } from '../engine/geotechnicalSpotBoltEngine';

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

  // Physical tunnel / vertical shaft parameters
  const surf3D = useMemo(() => getLocationSurfaceConfig(activeLocation), [activeLocation]);
  const pullM = Math.max(0.5, activeRound.pullLengthMeters || 3.0);
  const W = Math.max(1.5, surf3D.tunnelW || activeLocation.widthM || 8.5);
  const H = Math.max(1.5, surf3D.tunnelH || activeLocation.heightM || 7.5);
  const splH = Math.max(1.0, Math.min(H * 0.85, activeLocation.wallHeightM || 3.8));
  const shape = activeLocation.shape || 'horseshoe';
  const isVerticalShaft =
    activeLocation.undergroundSubMode === 'vertical_shaft' ||
    activeRound.undergroundSubMode === 'vertical_shaft';

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
    phi: 0.48,  // Elevation
    radius: Math.max(12, Math.max(W, H) * 2.2),
    target: new THREE.Vector3(0, isVerticalShaft ? 0 : H * 0.45, isVerticalShaft ? 0 : pullM * 0.5),
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
    if (isVerticalShaft) {
      if (cameraPreset === 'perspective') {
        c.theta = 0.65;
        c.phi = 0.58;
        c.target.set(0, 0, 0);
        c.radius = Math.max(12, Math.max(W, pullM) * 2.1);
      } else if (cameraPreset === 'face' || cameraPreset === 'crown') {
        c.theta = 0;
        c.phi = Math.PI * 0.48;
        c.target.set(0, 0, 0);
        c.radius = Math.max(11, W * 2.0);
      } else if (cameraPreset === 'side') {
        c.theta = Math.PI * 0.5;
        c.phi = 0.18;
        c.target.set(0, 0, 0);
        c.radius = Math.max(13, Math.max(W, pullM) * 2.2);
      } else if (cameraPreset === 'isometric') {
        c.theta = Math.PI * 0.25;
        c.phi = 0.62;
        c.target.set(0, 0, 0);
        c.radius = Math.max(13, Math.max(W, pullM) * 2.2);
      }
      return;
    }
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
  }, [cameraPreset, W, H, pullM, isVerticalShaft]);

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

    // 3. Ground / Reference Grid & Geometry Construction
    const tunnelGeom = new THREE.BufferGeometry();
    const tunnelMat = new THREE.MeshStandardMaterial({
      color: isLightMode ? 0xdbeafe : 0x0f172a,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide,
      wireframe: showWireframe,
      transparent: true,
      opacity: isVerticalShaft ? 0.55 : 0.9,
    });

    if (isVerticalShaft) {
      // ======================================================================
      // VERTICAL SHAFT 3D CYLINDRICAL SUPPORT SYSTEM (NATM & NMT SHAFT METHOD)
      // Renders all given shaft supports:
      // 1. 3D Cylindrical Shotcrete Lining Shell (with thickness & end-cap rings)
      // 2. 3D High-Tensile Wire Mesh Cylindrical Grid + Diamond Spike Plates
      // 3. 3D Circular Lattice Girder Truss Rings (3-bar chord + web lacing)
      // 4. 3D Circular ISMB / ISHB Steel Curb Rings (flanges + bolted splice plates)
      // 5. 3D Radial Pattern Rock Bolts (3D rebar cylinders + bearing plates + resin cones)
      // 6. 3D Collar Micropile / Pipe Roofing Ring & Shaft Perimeter Spiling Ring
      // 7. 3D Annulus Consolidation Grouting Boreholes & Grout Bulbs + Overbreak Cavity Pocket
      // 8. 3D Radial Spot Bolts with 3D Orientation Arcs & Quadrant Alignment (Q1 NE..Q4 WN)
      // ======================================================================
      const R = W / 2;
      const yTop = pullM / 2;
      const yBottom = -pullM / 2;
      const rawApproach = String(activeRound.excavationApproach || '');
      const shaftApproachNorm = normalizeVerticalShaftExcavationApproach(rawApproach);
      const shaftHalfSideNorm = normalizeVerticalShaftHalfSide(
        activeRound.shaftHalfSide || rawApproach
      );
      const medianCondition = normalizeVerticalShaftCenterMedianStatus(
        activeRound.shaftCenterMedianStatus ||
          (activeRound as { shaftMedianDivisionCondition?: string }).shaftMedianDivisionCondition
      );
      const isHalfShaft = shaftApproachNorm === 'Half Face' || rawApproach.startsWith('Half Face');
      const activeHalfIsEast = !isHalfShaft || shaftHalfSideNorm === 'right_half';

      const gridHelper = new THREE.GridHelper(Math.max(20, W * 2.5), 20, 0x0284c7, 0x1e293b);
      gridHelper.position.set(0, yBottom - 0.02, 0);
      scene.add(gridHelper);

      const azStartDeg = isHalfShaft ? (activeHalfIsEast ? 0 : 180) : 0;
      const azSweepDeg = isHalfShaft ? 180 : 360;
      const radialSegments = 64;
      const ySegments = Math.max(6, Math.round(pullM * 3));

      const vertices: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];

      for (let iy = 0; iy <= ySegments; iy++) {
        const ty = iy / ySegments;
        const y = yTop - ty * pullM;
        for (let ir = 0; ir <= radialSegments; ir++) {
          const tr = ir / radialSegments;
          const azDeg = azStartDeg + tr * azSweepDeg;
          const azRad = (azDeg * Math.PI) / 180;
          const nx = Math.sin(azRad);
          const nz = -Math.cos(azRad);
          vertices.push(R * nx, y, R * nz);
          normals.push(-nx, 0, -nz);
          uvs.push(tr, ty);
        }
      }

      const rowStride = radialSegments + 1;
      for (let iy = 0; iy < ySegments; iy++) {
        for (let ir = 0; ir < radialSegments; ir++) {
          const i0 = iy * rowStride + ir;
          const i1 = i0 + 1;
          const i2 = (iy + 1) * rowStride + ir;
          const i3 = i2 + 1;
          indices.push(i0, i2, i1);
          indices.push(i1, i2, i3);
        }
      }

      tunnelGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      tunnelGeom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      tunnelGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      tunnelGeom.setIndex(indices);

      const shaftWallMesh = new THREE.Mesh(tunnelGeom, tunnelMat);
      scene.add(shaftWallMesh);

      const wireGeom = new THREE.WireframeGeometry(tunnelGeom);
      const wireMat = new THREE.LineBasicMaterial({
        color: isLightMode ? 0x94a3b8 : 0x334155,
        transparent: true,
        opacity: 0.26,
      });
      scene.add(new THREE.LineSegments(wireGeom, wireMat));

      // Horizontal Shaft Sump Bottom Face Disc at y = yBottom
      const sumpPts2D: THREE.Vector2[] = [];
      for (let ir = 0; ir <= radialSegments; ir++) {
        const azDeg = azStartDeg + (ir / radialSegments) * azSweepDeg;
        const azRad = (azDeg * Math.PI) / 180;
        sumpPts2D.push(new THREE.Vector2(R * Math.sin(azRad), R * Math.cos(azRad)));
      }
      if (isHalfShaft) sumpPts2D.push(new THREE.Vector2(0, 0));
      const sumpShape = new THREE.Shape(sumpPts2D);
      const sumpGeom = new THREE.ShapeGeometry(sumpShape);
      sumpGeom.rotateX(-Math.PI / 2);
      const sumpMat = new THREE.MeshStandardMaterial({
        color: isLightMode ? 0xfef3c7 : 0x1e1b4b,
        roughness: 0.9,
        metalness: 0.1,
        side: THREE.DoubleSide,
      });
      const sumpMesh = new THREE.Mesh(sumpGeom, sumpMat);
      sumpMesh.position.set(0, yBottom, 0);
      scene.add(sumpMesh);

      // Unexcavated Half Ghost Outline & Center Median Wall in Half-Face Shaft Mode
      if (isHalfShaft) {
        const unexcavStartDeg = activeHalfIsEast ? 180 : 0;
        const ghostPtsTop: THREE.Vector3[] = [];
        const ghostPtsBot: THREE.Vector3[] = [];
        for (let ir = 0; ir <= 32; ir++) {
          const azDeg = unexcavStartDeg + (ir / 32) * 180;
          const azRad = (azDeg * Math.PI) / 180;
          ghostPtsTop.push(new THREE.Vector3(R * Math.sin(azRad), yTop, -R * Math.cos(azRad)));
          ghostPtsBot.push(new THREE.Vector3(R * Math.sin(azRad), yBottom, -R * Math.cos(azRad)));
        }
        const ghostLineTop = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(ghostPtsTop),
          new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 0.3, gapSize: 0.2 })
        );
        ghostLineTop.computeLineDistances();
        scene.add(ghostLineTop);

        const ghostLineBot = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(ghostPtsBot),
          new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 0.3, gapSize: 0.2 })
        );
        ghostLineBot.computeLineDistances();
        scene.add(ghostLineBot);

        if (medianCondition === 'closed') {
          const medGeom = new THREE.PlaneGeometry(R * 2, pullM);
          medGeom.rotateY(Math.PI / 2);
          const medMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            roughness: 0.82,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.72,
          });
          scene.add(new THREE.Mesh(medGeom, medMat));
        }
      }

      // Helper for ring points at any elevation yLevel and radius rVal
      const makeRingPts = (yLevel: number, rVal: number, closeMedian = true) => {
        const pts: THREE.Vector3[] = [];
        for (let ir = 0; ir <= radialSegments; ir++) {
          const azDeg = azStartDeg + (ir / radialSegments) * azSweepDeg;
          const azRad = (azDeg * Math.PI) / 180;
          pts.push(new THREE.Vector3(rVal * Math.sin(azRad), yLevel, -rVal * Math.cos(azRad)));
        }
        if (isHalfShaft && closeMedian && medianCondition === 'closed') {
          pts.push(new THREE.Vector3(0, yLevel, -rVal));
        }
        return pts;
      };

      scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(makeRingPts(yTop, R)),
          new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 2 })
        )
      );
      scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(makeRingPts(yBottom, R)),
          new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 })
        )
      );

      // Vertical Quadrant Division Lines (0° N, 90° E, 180° S, 270° W) & Cardinal Markers
      [
        { az: 0, color: 0xef4444, label: '0°N' },
        { az: 90, color: 0x38bdf8, label: '90°E' },
        { az: 180, color: 0x10b981, label: '180°S' },
        { az: 270, color: 0xa855f7, label: '270°W' },
      ].forEach((cm) => {
        const rad = (cm.az * Math.PI) / 180;
        const px = R * Math.sin(rad);
        const pz = -R * Math.cos(rad);
        const pin = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 12, 12),
          new THREE.MeshBasicMaterial({ color: cm.color })
        );
        pin.position.set(px, yTop, pz);
        scene.add(pin);

        const vertLine = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(px, yTop, pz),
            new THREE.Vector3(px, yBottom, pz),
          ]),
          new THREE.LineDashedMaterial({ color: cm.color, dashSize: 0.25, gapSize: 0.15 })
        );
        vertLine.computeLineDistances();
        scene.add(vertLine);
      });

      // ----------------------------------------------------------------------
      // 1. 3D SHOTCRETE CYLINDRICAL SHAFT LINING SHELL
      // ----------------------------------------------------------------------
      if (support.shotcreteEnabled) {
        const rawScThickM = (support.shotcreteCrownThicknessMm || 100) / 1000;
        // Visually scale thickness (min 0.14m in 3D space) so 50mm-250mm shotcrete lining is clearly visible
        const visualScThick = Math.max(0.14, Math.min(0.42, rawScThickM * 1.8));
        const rInner = Math.max(0.5, R - visualScThick);
        const rOuter = R - 0.01;

        const scVerts: number[] = [];
        const scIndices: number[] = [];
        const scSegs = 48;

        for (let ir = 0; ir <= scSegs; ir++) {
          const azDeg = azStartDeg + (ir / scSegs) * azSweepDeg;
          const azRad = (azDeg * Math.PI) / 180;
          const nx = Math.sin(azRad);
          const nz = -Math.cos(azRad);
          // 0: Top Outer, 1: Top Inner, 2: Bot Outer, 3: Bot Inner
          scVerts.push(rOuter * nx, yTop, rOuter * nz);
          scVerts.push(rInner * nx, yTop, rInner * nz);
          scVerts.push(rOuter * nx, yBottom, rOuter * nz);
          scVerts.push(rInner * nx, yBottom, rInner * nz);
        }

        for (let ir = 0; ir < scSegs; ir++) {
          const b0 = ir * 4;
          const b1 = (ir + 1) * 4;
          // Inner cylindrical shotcrete face
          scIndices.push(b0 + 1, b0 + 3, b1 + 1);
          scIndices.push(b1 + 1, b0 + 3, b1 + 3);
          // Outer cylindrical shotcrete face
          scIndices.push(b0 + 0, b1 + 0, b0 + 2);
          scIndices.push(b1 + 0, b1 + 2, b0 + 2);
          // Top collar annulus cap (shows shotcrete thickness clearly from top view)
          scIndices.push(b0 + 0, b0 + 1, b1 + 0);
          scIndices.push(b1 + 0, b0 + 1, b1 + 1);
          // Bottom sump annulus cap
          scIndices.push(b0 + 2, b1 + 2, b0 + 3);
          scIndices.push(b1 + 2, b1 + 3, b0 + 3);
        }

        const scGeom = new THREE.BufferGeometry();
        scGeom.setAttribute('position', new THREE.Float32BufferAttribute(scVerts, 3));
        scGeom.setIndex(scIndices);
        scGeom.computeVertexNormals();

        const scMat = new THREE.MeshStandardMaterial({
          color: support.shotcreteType === 'SFRS' ? 0x38bdf8 : 0x94a3b8,
          roughness: 0.65,
          metalness: 0.18,
          transparent: true,
          opacity: 0.42,
          side: THREE.DoubleSide,
        });
        scene.add(new THREE.Mesh(scGeom, scMat));

        // Center Median Shotcrete Layer if Half-Face Closed & crown_and_wall
        if (isHalfShaft && medianCondition === 'closed' && support.shotcreteScope === 'crown_and_wall') {
          const medScGeom = new THREE.BoxGeometry(visualScThick * 0.85, pullM, R * 1.96);
          const medScMesh = new THREE.Mesh(medScGeom, scMat);
          medScMesh.position.set(activeHalfIsEast ? visualScThick * 0.45 : -visualScThick * 0.45, 0, 0);
          scene.add(medScMesh);
        }

        // Bold Shotcrete Inner Boundary Rings at Top & Bottom + Mid Construction Joint Rings
        const numScHorizRings = Math.max(2, Math.round(pullM / 1.0));
        for (let ih = 0; ih <= numScHorizRings; ih++) {
          const ry = yTop - (ih / numScHorizRings) * pullM;
          scene.add(
            new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(makeRingPts(ry, rInner, false)),
              new THREE.LineBasicMaterial({
                color: support.shotcreteType === 'SFRS' ? 0x38bdf8 : 0xcbd5e1,
                transparent: true,
                opacity: ih === 0 || ih === numScHorizRings ? 0.95 : 0.45,
              })
            )
          );
        }
      }

      // ----------------------------------------------------------------------
      // 2. 3D WIRE MESH CYLINDRICAL GRID + DIAMOND SPIKE PLATES
      // ----------------------------------------------------------------------
      if (support.wireMeshEnabled) {
        const meshPts: THREE.Vector3[] = [];
        const rMesh = R - (support.shotcreteEnabled ? 0.16 : 0.05);
        for (let ir = 0; ir <= radialSegments; ir += 2) {
          const azDeg = azStartDeg + (ir / radialSegments) * azSweepDeg;
          const azRad = (azDeg * Math.PI) / 180;
          const mx = rMesh * Math.sin(azRad);
          const mz = -rMesh * Math.cos(azRad);
          meshPts.push(new THREE.Vector3(mx, yTop, mz), new THREE.Vector3(mx, yBottom, mz));
        }
        const numHoriz = Math.max(4, Math.round(pullM / 0.4));
        for (let ih = 0; ih <= numHoriz; ih++) {
          const ry = yTop - (ih / numHoriz) * pullM;
          const ringP = makeRingPts(ry, rMesh, false);
          for (let i = 0; i < ringP.length - 1; i++) {
            meshPts.push(ringP[i], ringP[i + 1]);
          }
        }
        scene.add(
          new THREE.LineSegments(
            new THREE.BufferGeometry().setFromPoints(meshPts),
            new THREE.LineBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.85 })
          )
        );

        // Diamond Spike Anchor Plates at Mesh Intersections
        const plateMat = new THREE.MeshStandardMaterial({
          color: 0x10b981,
          metalness: 0.75,
          roughness: 0.25,
        });
        for (let ih = 1; ih < numHoriz; ih += 2) {
          const ry = yTop - (ih / numHoriz) * pullM;
          for (let ir = 0; ir < radialSegments; ir += 8) {
            const azDeg = azStartDeg + (ir / radialSegments) * azSweepDeg;
            const azRad = (azDeg * Math.PI) / 180;
            const pMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.03), plateMat);
            pMesh.position.set(rMesh * Math.sin(azRad), ry, -rMesh * Math.cos(azRad));
            pMesh.lookAt(0, ry, 0);
            pMesh.rotateZ(Math.PI / 4);
            scene.add(pMesh);
          }
        }
      }

      // ----------------------------------------------------------------------
      // 3A. CIRCULAR LATTICE GIRDER RINGS (3-Bar Truss Ring + Web Lacing)
      // ----------------------------------------------------------------------
      if (
        (activeLayerFilter === 'ALL' || activeLayerFilter === 'STEEL_RIBS') &&
        support.latticeGirderEnabled
      ) {
        const lgSpacing = Math.max(0.4, support.latticeGirderSpacingM || 1.2);
        const numLgRings = Math.max(2, Math.ceil(pullM / lgSpacing));
        const rLg = R - 0.11;
        const lgChordMat = new THREE.MeshStandardMaterial({
          color: 0xa855f7,
          metalness: 0.75,
          roughness: 0.25,
          emissive: 0x581c87,
          emissiveIntensity: 0.25,
        });

        for (let ir = 0; ir < numLgRings; ir++) {
          const tRing = numLgRings === 1 ? 0.5 : (ir + 0.35) / numLgRings;
          const ry = Math.max(yBottom + 0.12, Math.min(yTop - 0.12, yTop - tRing * pullM));

          // Main Circular LG Chord Ring (supports full 360° or active 180° half-shaft)
          const chordPts: THREE.Vector3[] = [];
          const upperChordPts: THREE.Vector3[] = [];
          const lowerChordPts: THREE.Vector3[] = [];
          const webPts: THREE.Vector3[] = [];
          const lgSegs = 48;

          for (let is = 0; is <= lgSegs; is++) {
            const azDeg = azStartDeg + (is / lgSegs) * azSweepDeg;
            const azRad = (azDeg * Math.PI) / 180;
            const sinA = Math.sin(azRad);
            const cosA = -Math.cos(azRad);

            const pInner = new THREE.Vector3((rLg - 0.06) * sinA, ry, (rLg - 0.06) * cosA);
            const pUp = new THREE.Vector3((rLg + 0.04) * sinA, ry + 0.07, (rLg + 0.04) * cosA);
            const pLow = new THREE.Vector3((rLg + 0.04) * sinA, ry - 0.07, (rLg + 0.04) * cosA);
            chordPts.push(pInner);
            upperChordPts.push(pUp);
            lowerChordPts.push(pLow);

            if (is % 2 === 0) {
              webPts.push(pInner, pUp, pUp, pLow, pLow, pInner);
            } else {
              webPts.push(pUp, pInner, pInner, pLow);
            }
          }

          if (!isHalfShaft) {
            const lgTorus = new THREE.Mesh(
              new THREE.TorusGeometry(rLg, 0.045, 10, 56),
              lgChordMat
            );
            lgTorus.rotation.x = Math.PI / 2;
            lgTorus.position.set(0, ry, 0);
            scene.add(lgTorus);
          } else {
            const curve = new THREE.CatmullRomCurve3(chordPts);
            const tubeGeom = new THREE.TubeGeometry(curve, 48, 0.045, 10, false);
            scene.add(new THREE.Mesh(tubeGeom, lgChordMat));
          }

          // Upper & lower outer chords + diagonal sinusoidal web truss lacing
          scene.add(
            new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(upperChordPts),
              new THREE.LineBasicMaterial({ color: 0xc084fc })
            )
          );
          scene.add(
            new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(lowerChordPts),
              new THREE.LineBasicMaterial({ color: 0xc084fc })
            )
          );
          scene.add(
            new THREE.LineSegments(
              new THREE.BufferGeometry().setFromPoints(webPts),
              new THREE.LineBasicMaterial({ color: 0xd8b4fe, transparent: true, opacity: 0.85 })
            )
          );
        }
      }

      // ----------------------------------------------------------------------
      // 3B. CIRCULAR ISMB / ISHB STEEL CURB RINGS (With Bolted Splice Plates)
      // ----------------------------------------------------------------------
      if (
        (activeLayerFilter === 'ALL' || activeLayerFilter === 'STEEL_RIBS') &&
        support.ismbEnabled
      ) {
        const ismbSpacing = Math.max(0.4, support.ismbSpacingM || 1.0);
        const numCurbRings = Math.max(2, Math.ceil(pullM / ismbSpacing));
        const rCurb = R - 0.14;
        const curbMat = new THREE.MeshStandardMaterial({
          color: 0xf97316,
          metalness: 0.8,
          roughness: 0.22,
          emissive: 0x9a3412,
          emissiveIntensity: 0.25,
        });
        const spliceMat = new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          metalness: 0.85,
          roughness: 0.2,
        });

        for (let ir = 0; ir < numCurbRings; ir++) {
          const tRing = numCurbRings === 1 ? 0.5 : (ir + 0.65) / numCurbRings;
          const ry = Math.max(yBottom + 0.1, Math.min(yTop - 0.1, yTop - tRing * pullM));

          if (!isHalfShaft) {
            const curbTorus = new THREE.Mesh(
              new THREE.TorusGeometry(rCurb, 0.08, 12, 56),
              curbMat
            );
            curbTorus.rotation.x = Math.PI / 2;
            curbTorus.position.set(0, ry, 0);
            scene.add(curbTorus);
          } else {
            const halfPts: THREE.Vector3[] = [];
            for (let is = 0; is <= 40; is++) {
              const azDeg = azStartDeg + (is / 40) * azSweepDeg;
              const azRad = (azDeg * Math.PI) / 180;
              halfPts.push(new THREE.Vector3(rCurb * Math.sin(azRad), ry, -rCurb * Math.cos(azRad)));
            }
            const curve = new THREE.CatmullRomCurve3(halfPts);
            scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.08, 12, false), curbMat));

            // Median Strut Beam if Half-Shaft Closed
            if (medianCondition === 'closed') {
              const strutMesh = new THREE.Mesh(
                new THREE.BoxGeometry(0.14, 0.16, rCurb * 2),
                curbMat
              );
              strutMesh.position.set(0, ry, 0);
              scene.add(strutMesh);
            }
          }

          // Bolted Splice Plates every 45° around the Steel Curb Ring
          const numSplices = isHalfShaft ? 5 : 8;
          for (let isp = 0; isp < numSplices; isp++) {
            const azDeg = azStartDeg + (isp / Math.max(1, isHalfShaft ? numSplices - 1 : numSplices)) * azSweepDeg;
            const azRad = (azDeg * Math.PI) / 180;
            const spMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.18), spliceMat);
            spMesh.position.set(rCurb * Math.sin(azRad), ry, -rCurb * Math.cos(azRad));
            spMesh.lookAt(0, ry, 0);
            scene.add(spMesh);
          }
        }
      }

      // ----------------------------------------------------------------------
      // 4. 3D RADIAL SHAFT PATTERN ROCK BOLTS (3D Rebar Cylinders + Faceplates + Cones)
      // ----------------------------------------------------------------------
      if (
        (activeLayerFilter === 'ALL' || activeLayerFilter === 'PATTERN_BOLTS') &&
        support.rockBoltsEnabled
      ) {
        const boltLen = Math.max(1.5, support.rockBoltLengthM || 4.0);
        const circumfSp = Math.max(0.6, support.rockBoltInPlaneSpacingM || 1.5);
        const vertRingSp = Math.max(0.6, support.rockBoltLongitudinalSpacingM || 1.5);
        const numVertRings = Math.max(2, Math.ceil(pullM / vertRingSp));
        const arcLengthM = (azSweepDeg / 360) * Math.PI * W;
        const boltsPerRing = Math.max(6, Math.min(28, Math.round(arcLengthM / circumfSp)));

        const rebarMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          metalness: 0.75,
          roughness: 0.28,
          emissive: 0x0369a1,
          emissiveIntensity: 0.35,
        });
        const plateMat = new THREE.MeshStandardMaterial({
          color: 0xe2e8f0,
          metalness: 0.85,
          roughness: 0.2,
        });
        const coneMat = new THREE.MeshStandardMaterial({
          color: 0x0284c7,
          roughness: 0.4,
        });

        for (let ir = 0; ir < numVertRings; ir++) {
          const ry = yTop - ((ir + 0.5) / numVertRings) * pullM;
          for (let ib = 0; ib < boltsPerRing; ib++) {
            const azDeg = azStartDeg + ((ib + 0.5) / boltsPerRing) * azSweepDeg;
            const azRad = (azDeg * Math.PI) / 180;
            const normal = new THREE.Vector3(Math.sin(azRad), 0, -Math.cos(azRad)).normalize();
            const startPt = normal.clone().multiplyScalar(R);
            startPt.y = ry;
            const endPt = startPt.clone().add(normal.clone().multiplyScalar(boltLen));
            const midPt = startPt.clone().add(endPt).multiplyScalar(0.5);

            // 3D Cylindrical Rebar Stem
            const rebarMesh = new THREE.Mesh(
              new THREE.CylinderGeometry(0.038, 0.038, boltLen, 8),
              rebarMat
            );
            rebarMesh.position.copy(midPt);
            rebarMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
            scene.add(rebarMesh);

            // 3D Bearing Faceplate & Nut at Shaft Wall Collar
            const plateMesh = new THREE.Mesh(
              new THREE.BoxGeometry(0.24, 0.24, 0.05),
              plateMat
            );
            plateMesh.position.copy(startPt);
            plateMesh.lookAt(endPt);
            scene.add(plateMesh);

            // 3D Distal Anchor Cone
            const anchorCone = new THREE.Mesh(
              new THREE.ConeGeometry(0.08, 0.22, 8),
              coneMat
            );
            anchorCone.position.copy(endPt);
            anchorCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
            scene.add(anchorCone);
          }

          // Center Median Wall Rock Bolts when Half-Shaft Closed & crown_and_wall
          if (isHalfShaft && medianCondition === 'closed' && support.rockBoltScope === 'crown_and_wall') {
            const medNormal = new THREE.Vector3(activeHalfIsEast ? -1 : 1, 0, 0);
            const medBoltCount = Math.max(2, Math.round((R * 1.6) / circumfSp));
            for (let im = 0; im < medBoltCount; im++) {
              const zPos = -R * 0.75 + (im / Math.max(1, medBoltCount - 1)) * (R * 1.5);
              const mStart = new THREE.Vector3(0, ry, zPos);
              const mLen = boltLen * 0.65;
              const mEnd = mStart.clone().add(medNormal.clone().multiplyScalar(mLen));
              const mMid = mStart.clone().add(mEnd).multiplyScalar(0.5);

              const mRebar = new THREE.Mesh(
                new THREE.CylinderGeometry(0.035, 0.035, mLen, 8),
                rebarMat
              );
              mRebar.position.copy(mMid);
              mRebar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), medNormal);
              scene.add(mRebar);

              const mPlate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.05), plateMat);
              mPlate.position.copy(mStart);
              mPlate.lookAt(mEnd);
              scene.add(mPlate);
            }
          }
        }
      }

      // ----------------------------------------------------------------------
      // 5. COLLAR MICROPILE RING / PIPE ROOFING UMBRELLA AROUND SHAFT PERIMETER
      // ----------------------------------------------------------------------
      if (
        (activeLayerFilter === 'ALL' || activeLayerFilter === 'PIPE_ROOFING') &&
        support.pipeRoofingEnabled
      ) {
        const pipeLen = Math.min(10.0, Math.max(2.5, support.pipeRoofingLengthM || 6.0));
        const lookoutRad = ((support.pipeRoofingAngleDeg ?? 7.0) * Math.PI) / 180;
        const numPipes = Math.max(
          12,
          Math.min(
            36,
            Math.round((Math.PI * W) / Math.max(0.25, (support.pipeRoofingSpacingCm || 40) / 100))
          )
        );
        const pipeMat = new THREE.MeshStandardMaterial({
          color: 0xf97316,
          roughness: 0.35,
          metalness: 0.75,
          emissive: 0x7c2d12,
          emissiveIntensity: 0.2,
        });

        for (let ip = 0; ip < numPipes; ip++) {
          const azDeg = azStartDeg + (ip / numPipes) * azSweepDeg;
          const azRad = (azDeg * Math.PI) / 180;
          const normal = new THREE.Vector3(Math.sin(azRad), 0, -Math.cos(azRad)).normalize();
          const collarPt = normal.clone().multiplyScalar(R + 0.06);
          collarPt.y = yTop - 0.15;
          const dir = new THREE.Vector3(
            normal.x * Math.sin(lookoutRad),
            -Math.cos(lookoutRad),
            normal.z * Math.sin(lookoutRad)
          ).normalize();
          const tipPt = collarPt.clone().add(dir.clone().multiplyScalar(pipeLen));
          const midPt = collarPt.clone().add(tipPt).multiplyScalar(0.5);
          const pipeMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, pipeLen, 10),
            pipeMat
          );
          pipeMesh.position.copy(midPt);
          pipeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          scene.add(pipeMesh);
        }
      }

      // ----------------------------------------------------------------------
      // 6. SHAFT PERIMETER SPILING RING (FOREPOLING)
      // ----------------------------------------------------------------------
      if (
        (activeLayerFilter === 'ALL' || activeLayerFilter === 'FOREPOLING') &&
        support.forepolingEnabled
      ) {
        const spileLen = Math.max(2.0, support.forepolingLengthM || 4.0);
        const spileRad = ((support.forepolingAngleDeg ?? 10.0) * Math.PI) / 180;
        const numSpiles = 24;
        const spileMat = new THREE.MeshStandardMaterial({
          color: 0xeab308,
          metalness: 0.75,
          roughness: 0.3,
          emissive: 0x713f12,
          emissiveIntensity: 0.25,
        });
        for (let is = 0; is < numSpiles; is++) {
          const azDeg = azStartDeg + (is / numSpiles) * azSweepDeg;
          const azRad = (azDeg * Math.PI) / 180;
          const normal = new THREE.Vector3(Math.sin(azRad), 0, -Math.cos(azRad)).normalize();
          const collarPt = normal.clone().multiplyScalar(R + 0.02);
          collarPt.y = yBottom + 0.15;
          const dir = new THREE.Vector3(
            normal.x * Math.sin(spileRad),
            -Math.cos(spileRad),
            normal.z * Math.sin(spileRad)
          ).normalize();
          const tipPt = collarPt.clone().add(dir.clone().multiplyScalar(spileLen));
          const midPt = collarPt.clone().add(tipPt).multiplyScalar(0.5);

          const spileMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035, 0.035, spileLen, 8),
            spileMat
          );
          spileMesh.position.copy(midPt);
          spileMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          scene.add(spileMesh);
        }
      }

      // ----------------------------------------------------------------------
      // 7. 3D ANNULUS CONSOLIDATION GROUTING & OVERBREAK CAVITY SUPPORT POCKET
      // ----------------------------------------------------------------------
      if (support.groutingEnabled) {
        const gHoleLen = Math.max(2.5, Math.min(10.0, support.groutingHoleLengthM || 6.0));
        const gHoleCount = Math.max(4, Math.min(24, support.groutingHoleCount || 8));
        const groutLanceMat = new THREE.MeshStandardMaterial({
          color: 0x14b8a6,
          metalness: 0.65,
          roughness: 0.3,
        });
        const groutBulbMat = new THREE.MeshStandardMaterial({
          color: 0x2dd4bf,
          transparent: true,
          opacity: 0.26,
          roughness: 0.5,
        });

        for (let ig = 0; ig < gHoleCount; ig++) {
          const azDeg = azStartDeg + ((ig + 0.5) / gHoleCount) * azSweepDeg;
          const azRad = (azDeg * Math.PI) / 180;
          const normal = new THREE.Vector3(Math.sin(azRad), 0, -Math.cos(azRad)).normalize();
          const ry = ig % 2 === 0 ? yTop - pullM * 0.32 : yTop - pullM * 0.68;
          const startPt = normal.clone().multiplyScalar(R);
          startPt.y = ry;
          const dir = new THREE.Vector3(normal.x * 0.96, -0.28, normal.z * 0.96).normalize();
          const endPt = startPt.clone().add(dir.clone().multiplyScalar(gHoleLen));
          const midPt = startPt.clone().add(endPt).multiplyScalar(0.5);

          const lanceMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.032, 0.032, gHoleLen, 8),
            groutLanceMat
          );
          lanceMesh.position.copy(midPt);
          lanceMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          scene.add(lanceMesh);

          // Permeation Grout Bulb around distal zone of borehole
          const bulbCenter = startPt.clone().add(dir.clone().multiplyScalar(gHoleLen * 0.65));
          const bulbMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.38, 0.24, gHoleLen * 0.55, 12),
            groutBulbMat
          );
          bulbMesh.position.copy(bulbCenter);
          bulbMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          scene.add(bulbMesh);
        }
      }

      if (
        support.protectionSupportMode === 'Cavity Support' ||
        (support.groutingEnabled && (support.cavityDepthM || 0) > 0.2)
      ) {
        const cavDepth = Math.max(0.5, Math.min(4.0, support.cavityDepthM || 1.2));
        const cavWidth = Math.max(1.0, Math.min(W * 0.8, support.cavityWidthM || 3.0));
        const cavLocZone = (support as { cavityLocationZone?: string }).cavityLocationZone;
        const cavAzDeg =
          cavLocZone === 'Left Wall / Shoulder'
            ? 315
            : cavLocZone === 'Right Wall / Shoulder'
            ? 135
            : 45;
        const cavAzRad = (cavAzDeg * Math.PI) / 180;
        const cavNormal = new THREE.Vector3(Math.sin(cavAzRad), 0, -Math.cos(cavAzRad)).normalize();
        const cavCenter = cavNormal.clone().multiplyScalar(R + cavDepth * 0.45);
        cavCenter.y = 0;

        const cavGeom = new THREE.BoxGeometry(cavWidth, pullM * 0.65, cavDepth);
        const cavMat = new THREE.MeshStandardMaterial({
          color: 0xf43f5e,
          transparent: true,
          opacity: 0.34,
          roughness: 0.7,
        });
        const cavMesh = new THREE.Mesh(cavGeom, cavMat);
        cavMesh.position.copy(cavCenter);
        cavMesh.lookAt(0, 0, 0);
        scene.add(cavMesh);

        const cavWire = new THREE.LineSegments(
          new THREE.EdgesGeometry(cavGeom),
          new THREE.LineBasicMaterial({ color: 0xfda4af })
        );
        cavWire.position.copy(cavCenter);
        cavWire.lookAt(0, 0, 0);
        scene.add(cavWire);
      }

      // ----------------------------------------------------------------------
      // 8. 3D RADIAL SHAFT SPOT BOLTS (Aligned with Q1 NE, Q2 ES, Q3 SW, Q4 WN)
      // ----------------------------------------------------------------------
      if (
        (activeLayerFilter === 'ALL' || activeLayerFilter === 'SPOT_BOLTS') &&
        support.spotBoltsEnabled &&
        (support.spotBolts || []).length > 0
      ) {
        (support.spotBolts || []).forEach((sb) => {
          const isSelected = selectedBolt?.id === sb.id;
          const bLen = Math.max(1.0, sb.lengthM || 4.0);
          const bAngleDeg = sb.angleDeg || 75;

          let azDeg = sb.azimuthDeg;
          if (azDeg === undefined) {
            if (sb.xMeters || sb.yMeters) {
              azDeg = ((Math.atan2(sb.xMeters, sb.yMeters || 0.01) * 180) / Math.PI + 360) % 360;
            } else {
              // Exact Vertical Shaft Quadrant Mapping from verticalShaftEngine.ts:
              // left_wall = Q1 NE (0°–90°), crown = Q2 ES (90°–180°),
              // right_wall = Q3 SW (180°–270°), shaft_sn = Q4 WN (270°–360°)
              const uRatio = Number.isFinite(sb.u) ? sb.u : 0.5;
              azDeg =
                sb.panel === 'left_wall'
                  ? uRatio * 90
                  : sb.panel === 'crown'
                  ? 90 + uRatio * 90
                  : sb.panel === 'right_wall'
                  ? 180 + uRatio * 90
                  : sb.panel === 'shaft_sn'
                  ? 270 + uRatio * 90
                  : 45;
            }
          }
          const azRad = (azDeg * Math.PI) / 180;
          const surfNormal = new THREE.Vector3(Math.sin(azRad), 0, -Math.cos(azRad)).normalize();
          const pullClamped = Math.max(0, Math.min(pullM, sb.pullMeter ?? pullM * 0.5));
          const collarY = yTop - pullClamped;
          const collar3D = new THREE.Vector3(
            R * surfNormal.x,
            collarY,
            R * surfNormal.z
          );

          const tiltFromNormalRad = ((90 - bAngleDeg) * Math.PI) / 180;
          const boltDir = surfNormal
            .clone()
            .multiplyScalar(Math.cos(tiltFromNormalRad))
            .add(new THREE.Vector3(0, -Math.sin(tiltFromNormalRad), 0))
            .normalize();
          const tip3D = collar3D.clone().add(boltDir.clone().multiplyScalar(bLen));

          const boltMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(isSelected ? 0.055 : 0.045, isSelected ? 0.055 : 0.045, bLen, 12),
            new THREE.MeshStandardMaterial({
              color: isSelected ? 0xf59e0b : 0xf43f5e,
              roughness: 0.25,
              metalness: 0.85,
              emissive: isSelected ? 0xb45309 : 0x881337,
              emissiveIntensity: isSelected ? 0.65 : 0.3,
            })
          );
          boltMesh.position.copy(collar3D.clone().add(tip3D).multiplyScalar(0.5));
          boltMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), boltDir);
          scene.add(boltMesh);

          const tipConeMesh = new THREE.Mesh(
            new THREE.ConeGeometry(0.1, 0.25, 10),
            new THREE.MeshStandardMaterial({ color: isSelected ? 0xfef08a : 0xfb7185 })
          );
          tipConeMesh.position.copy(tip3D);
          tipConeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), boltDir);
          scene.add(tipConeMesh);

          const plateMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.3, 0.05),
            new THREE.MeshStandardMaterial({
              color: isSelected ? 0xf59e0b : 0xe2e8f0,
              metalness: 0.85,
              roughness: 0.25,
            })
          );
          plateMesh.position.copy(collar3D);
          plateMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), surfNormal);
          scene.add(plateMesh);

          if (isSelected && showNormals) {
            const normalRayEnd = collar3D.clone().add(surfNormal.clone().multiplyScalar(2.2));
            const normalLine = new THREE.Line(
              new THREE.BufferGeometry().setFromPoints([collar3D, normalRayEnd]),
              new THREE.LineDashedMaterial({ color: 0x38bdf8, dashSize: 0.15, gapSize: 0.1 })
            );
            normalLine.computeLineDistances();
            scene.add(normalLine);
          }
        });
      }
    } else {
      // ======================================================================
      // STANDARD HORIZONTAL TUNNEL 3D SUPPORT SYSTEM
      // ======================================================================
      const gridHelper = new THREE.GridHelper(Math.max(20, W * 2.5), 20, 0x0284c7, 0x1e293b);
      gridHelper.position.set(0, 0, pullM * 0.5);
      scene.add(gridHelper);

      // 4. Render Procedural 3D Tunnel Shell Mesh
      const perimeterPts = generateTunnelPerimeterPoints(shape, W, H, splH, 36);
      const zSegments = Math.max(4, Math.round(pullM * 2));
      const zStep = pullM / zSegments;

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
          normals.push(-pt.normal.x, -pt.normal.y, 0);
          uvs.push(ip / (numPts - 1), iz / zSegments);
        }
      }

      for (let iz = 0; iz < zSegments; iz++) {
        for (let ip = 0; ip < numPts - 1; ip++) {
          const i0 = iz * numPts + ip;
          const i1 = i0 + 1;
          const i2 = (iz + 1) * numPts + ip;
          const i3 = i2 + 1;
          indices.push(i0, i2, i1);
          indices.push(i1, i2, i3);
        }
      }

      tunnelGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      tunnelGeom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      tunnelGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      tunnelGeom.setIndex(indices);

      const tunnelMesh = new THREE.Mesh(tunnelGeom, tunnelMat);
      scene.add(tunnelMesh);

      const wireGeom = new THREE.WireframeGeometry(tunnelGeom);
      const wireMat = new THREE.LineBasicMaterial({
        color: isLightMode ? 0x94a3b8 : 0x334155,
        transparent: true,
        opacity: 0.35,
      });
      const wireLines = new THREE.LineSegments(wireGeom, wireMat);
      scene.add(wireLines);

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

      const facePerimeterPts3D: THREE.Vector3[] = perimeterPts.map(
        (p) => new THREE.Vector3(p.x, p.y, pullM)
      );
      facePerimeterPts3D.push(new THREE.Vector3(perimeterPts[0].x, perimeterPts[0].y, pullM));
      const faceOutlineGeom = new THREE.BufferGeometry().setFromPoints(facePerimeterPts3D);
      const faceOutlineMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 });
      const faceOutlineLine = new THREE.Line(faceOutlineGeom, faceOutlineMat);
      scene.add(faceOutlineLine);

      const portalPerimeterPts3D: THREE.Vector3[] = perimeterPts.map(
        (p) => new THREE.Vector3(p.x, p.y, 0)
      );
      portalPerimeterPts3D.push(new THREE.Vector3(perimeterPts[0].x, perimeterPts[0].y, 0));
      const portalOutlineGeom = new THREE.BufferGeometry().setFromPoints(portalPerimeterPts3D);
      const portalOutlineMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 2 });
      const portalOutlineLine = new THREE.Line(portalOutlineGeom, portalOutlineMat);
      scene.add(portalOutlineLine);

      if (support.shotcreteEnabled) {
        const scCrownOffM = Math.max(0.04, Math.min(0.25, (support.shotcreteCrownThicknessMm || 100) / 1000));
        const scWallOffM =
          support.shotcreteScope === 'crown_and_wall'
            ? Math.max(0.03, Math.min(0.2, (support.shotcreteWallThicknessMm || 75) / 1000))
            : 0;

        const scPerimeter = perimeterPts.filter((p) =>
          support.shotcreteScope === 'crown_and_wall' ? true : p.panel === 'crown'
        );

        if (scPerimeter.length >= 2) {
          const scGeom = new THREE.BufferGeometry();
          const scVerts: number[] = [];
          const scNorms: number[] = [];
          const scIndices: number[] = [];
          const numScPts = scPerimeter.length;

          for (let iz = 0; iz <= zSegments; iz++) {
            const z = iz * zStep;
            for (let ip = 0; ip < numScPts; ip++) {
              const pt = scPerimeter[ip];
              const off = pt.panel === 'crown' ? scCrownOffM : scWallOffM;
              scVerts.push(pt.x - pt.normal.x * off, Math.max(0, pt.y - pt.normal.y * off), z);
              scNorms.push(-pt.normal.x, -pt.normal.y, 0);
            }
          }

          for (let iz = 0; iz < zSegments; iz++) {
            for (let ip = 0; ip < numScPts - 1; ip++) {
              const i0 = iz * numScPts + ip;
              const i1 = i0 + 1;
              const i2 = (iz + 1) * numScPts + ip;
              const i3 = i2 + 1;
              scIndices.push(i0, i2, i1);
              scIndices.push(i1, i2, i3);
            }
          }

          scGeom.setAttribute('position', new THREE.Float32BufferAttribute(scVerts, 3));
          scGeom.setAttribute('normal', new THREE.Float32BufferAttribute(scNorms, 3));
          scGeom.setIndex(scIndices);

          const scMat = new THREE.MeshStandardMaterial({
            color: isLightMode ? 0x94a3b8 : 0x475569,
            roughness: 0.9,
            metalness: 0.1,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85,
          });
          const scMesh = new THREE.Mesh(scGeom, scMat);
          scene.add(scMesh);
        }
      }

      if (support.wireMeshEnabled) {
        const meshPerimeter = perimeterPts.filter((p) =>
          support.wireMeshScope === 'crown_and_wall' ? true : p.panel === 'crown'
        );
        if (meshPerimeter.length >= 2) {
          const meshLinePts: THREE.Vector3[] = [];
          for (let ip = 0; ip < meshPerimeter.length; ip += 2) {
            const pt = meshPerimeter[ip];
            const mx = pt.x - pt.normal.x * 0.035;
            const my = Math.max(0, pt.y - pt.normal.y * 0.035);
            meshLinePts.push(new THREE.Vector3(mx, my, 0), new THREE.Vector3(mx, my, pullM));
          }
          const numRings = Math.max(2, Math.round(pullM / 0.4));
          for (let ir = 0; ir <= numRings; ir++) {
            const rz = ir * (pullM / numRings);
            for (let ip = 0; ip < meshPerimeter.length - 1; ip++) {
              const p0 = meshPerimeter[ip];
              const p1 = meshPerimeter[ip + 1];
              meshLinePts.push(
                new THREE.Vector3(p0.x - p0.normal.x * 0.035, Math.max(0, p0.y - p0.normal.y * 0.035), rz),
                new THREE.Vector3(p1.x - p1.normal.x * 0.035, Math.max(0, p1.y - p1.normal.y * 0.035), rz)
              );
            }
          }
          const meshGeom = new THREE.BufferGeometry().setFromPoints(meshLinePts);
          const meshMat = new THREE.LineBasicMaterial({
            color: 0x0d9488,
            transparent: true,
            opacity: 0.65,
          });
          const meshLines = new THREE.LineSegments(meshGeom, meshMat);
          scene.add(meshLines);
        }
      }

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
          const crownPts = perimeterPts.filter((p) =>
            support.rockBoltScope === 'crown_only' || support.rockBoltScope === 'crown'
              ? p.panel === 'crown'
              : p.panel !== 'face'
          );
          const stride = Math.max(2, Math.round(inPlaneSpacing * 3));
          for (let ip = 0; ip < crownPts.length; ip += stride) {
            const pt = crownPts[ip];
            const startPt = new THREE.Vector3(pt.x, pt.y, rz);
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

            const plateGeom = new THREE.BoxGeometry(0.18, 0.18, 0.04);
            const plateMat = new THREE.MeshStandardMaterial({ color: 0x64748b });
            const plateMesh = new THREE.Mesh(plateGeom, plateMat);
            plateMesh.position.copy(startPt);
            plateMesh.lookAt(endPt);
            scene.add(plateMesh);
          }
        });
      }

      if (
        (activeLayerFilter === 'ALL' || activeLayerFilter === 'PIPE_ROOFING') &&
        support.protectionSupportEnabled &&
        support.pipeRoofingEnabled
      ) {
        const pipeLen = support.pipeRoofingLengthM || 12.0;
        const lookoutAngleDeg = support.pipeRoofingAngleDeg ?? 7.0;
        const lookoutRad = (lookoutAngleDeg * Math.PI) / 180;
        const numPipes = Math.max(16, Math.min(48, Math.round((W * 1.6) / 0.4)));

        const crownArchPts = perimeterPts.filter((p) => p.panel === 'crown');
        const pipeStep = Math.max(1, Math.floor(crownArchPts.length / numPipes));

        for (let ip = 0; ip < crownArchPts.length; ip += pipeStep) {
          const pt = crownArchPts[ip];
          const collarPt = new THREE.Vector3(pt.x, pt.y, Math.max(0, pullM - 0.5));
          const normal = new THREE.Vector3(pt.normal.x, pt.normal.y, 0).normalize();
          const dir = new THREE.Vector3(
            normal.x * Math.sin(lookoutRad),
            normal.y * Math.sin(lookoutRad),
            Math.cos(lookoutRad)
          ).normalize();

          const tipPt = collarPt.clone().add(dir.clone().multiplyScalar(pipeLen));

          const pipeCylGeom = new THREE.CylinderGeometry(0.057, 0.057, pipeLen, 8);
          const pipeCylMat = new THREE.MeshStandardMaterial({
            color: 0xf97316,
            roughness: 0.4,
            metalness: 0.7,
          });
          const pipeMesh = new THREE.Mesh(pipeCylGeom, pipeCylMat);

          const midPt = collarPt.clone().add(tipPt).multiplyScalar(0.5);
          pipeMesh.position.copy(midPt);
          pipeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          scene.add(pipeMesh);

          const collarRingGeom = new THREE.TorusGeometry(0.08, 0.02, 6, 12);
          const collarRingMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
          const collarRingMesh = new THREE.Mesh(collarRingGeom, collarRingMat);
          collarRingMesh.position.copy(collarPt);
          scene.add(collarRingMesh);
        }
      }

      if (
        (activeLayerFilter === 'ALL' || activeLayerFilter === 'FOREPOLING') &&
        support.protectionSupportEnabled &&
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

      if (
        (activeLayerFilter === 'ALL' || activeLayerFilter === 'SPOT_BOLTS') &&
        support.spotBoltsEnabled &&
        (support.spotBolts || []).length > 0
      ) {
        const spotBoltsList = support.spotBolts || [];

        spotBoltsList.forEach((sb) => {
          const isSelected = selectedBolt?.id === sb.id;
          const bLen = Math.max(1.0, sb.lengthM || 4.0);
          const bAngleDeg = sb.angleDeg || 65;
          const bAzimuthDeg = sb.azimuthDeg ?? 45;

          let collarX = sb.xMeters ?? 0;
          let collarY = sb.yMeters ?? H * 0.8;
          let collarZ = Math.max(0, Math.min(pullM, sb.pullMeter ?? pullM * 0.5));

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
            const dx = collarX;
            const dy = Math.max(0.1, collarY - splH);
            surfNormal.set(dx / (W / 2), dy / Math.max(0.5, H - splH), 0).normalize();
          }

          const angleRad = ((90 - bAngleDeg) * Math.PI) / 180;
          const azRad = (bAzimuthDeg * Math.PI) / 180;

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

          const tipConeGeom = new THREE.ConeGeometry(0.08, 0.22, 10);
          const tipConeMat = new THREE.MeshStandardMaterial({
            color: isSelected ? 0xfef08a : 0xfb7185,
          });
          const tipConeMesh = new THREE.Mesh(tipConeGeom, tipConeMat);
          tipConeMesh.position.copy(tip3D);
          tipConeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), boltDir);
          scene.add(tipConeMesh);

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

          const nutGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.06, 6);
          const nutMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });
          const nutMesh = new THREE.Mesh(nutGeom, nutMat);
          nutMesh.position.copy(collar3D.clone().add(surfNormal.clone().multiplyScalar(0.04)));
          scene.add(nutMesh);

          if (isSelected && showNormals) {
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
    isVerticalShaft,
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

    if (isVerticalShaft) {
      const yTop = pullM / 2;
      const yBottom = -pullM / 2;
      const validShaftHit = intersects.find(
        (h) => h.point.y >= yBottom - 0.1 && h.point.y <= yTop + 0.1
      );
      if (validShaftHit) {
        const pt = validShaftHit.point;
        const azDeg = ((Math.atan2(pt.x, -pt.z) * 180) / Math.PI + 360) % 360;
        // Exact Vertical Shaft Quadrant Mapping from verticalShaftEngine.ts:
        // 0°–90°: left_wall (Q1 NE), 90°–180°: crown (Q2 ES),
        // 180°–270°: right_wall (Q3 SW), 270°–360°: shaft_sn (Q4 WN)
        const panel: FieldPanelId =
          azDeg < 90
            ? 'left_wall'
            : azDeg < 180
            ? 'crown'
            : azDeg < 270
            ? 'right_wall'
            : 'shaft_sn';
        const pullMeter = Number(Math.max(0, Math.min(pullM, yTop - pt.y)).toFixed(2));
        const R = W / 2;
        const azRad = (azDeg * Math.PI) / 180;
        const xMeters = Number((R * Math.sin(azRad)).toFixed(2));
        const yMeters = Number((R * Math.cos(azRad)).toFixed(2));
        const nextIdx = (support.spotBolts?.length || 0) + 1;
        const newBolt: FieldSpotBoltItem = {
          id: `sb-${Date.now()}`,
          label: `SB-${nextIdx}`,
          panel,
          u: Number(((azDeg % 90) / 90).toFixed(3)),
          v: Number((pullMeter / pullM).toFixed(3)),
          pullMeter,
          xMeters,
          yMeters,
          lengthM: newSpotLengthM,
          angleDeg: newSpotAngleDeg,
          azimuthDeg: Math.round(azDeg),
        };
        onUpdateSupport({
          spotBoltsEnabled: true,
          spotBolts: [...(support.spotBolts || []), newBolt],
        });
        setSelectedBoltId(newBolt.id);
      }
      return;
    }

    // Find intersection on tunnel shell or face
    const validHit = intersects.find(
      (h) => h.point.y >= 0 && h.point.z >= 0 && h.point.z <= pullM * 1.05
    );

    if (validHit) {
      const pt = validHit.point;
      const halfW = W / 2;

      let panel: FieldPanelId = 'crown';
      if (pt.y >= H * 0.62) {
        panel = 'crown';
      } else if (pt.x < 0) {
        panel = 'left_wall';
      } else {
        panel = 'right_wall';
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
              <span>
                {isVerticalShaft
                  ? 'Interactive 3D Vertical Shaft & Support System'
                  : 'Interactive 3D Tunnel & Support System'}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800">
                {isVerticalShaft
                  ? `Ø${W}m Shaft × ${pullM}m Sinking Pull`
                  : `${W}m × ${H}m × ${pullM}m Pull`}
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              {isVerticalShaft
                ? 'True 3D Vertical Shaft View — Shows given 360° Shotcrete Shell, Wire Mesh, Radial Pattern Bolts, Circular Curb/LG Rings, Spiling, Grouting & Radial Spot Bolts'
                : 'True 3D Spatial View — Simply select and orient Spot Bolts, Pipe Roofing Umbrella, Forepoling & Pattern Rockbolts'}
            </div>
          </div>
        </div>

        {/* Layer Filters (Only show filters for currently given/enabled supports) */}
        <div className="flex items-center gap-1 text-[11px] bg-slate-950 p-1 rounded-lg border border-slate-800">
          {(
            [
              { id: 'ALL' as const, label: 'All 3D' },
              ...(support.spotBoltsEnabled && (support.spotBolts || []).length > 0
                ? [{ id: 'SPOT_BOLTS' as const, label: isVerticalShaft ? 'Radial Spot Bolts' : 'Spot Bolts' }]
                : []),
              ...(support.pipeRoofingEnabled
                ? [{ id: 'PIPE_ROOFING' as const, label: isVerticalShaft ? 'Micropile Ring' : 'Pipe Roofing' }]
                : []),
              ...(support.forepolingEnabled
                ? [{ id: 'FOREPOLING' as const, label: isVerticalShaft ? 'Shaft Spiling' : 'Forepoling' }]
                : []),
              ...(support.rockBoltsEnabled
                ? [{ id: 'PATTERN_BOLTS' as const, label: isVerticalShaft ? 'Radial Pattern Bolts' : 'Pattern Bolts' }]
                : []),
              ...(support.latticeGirderEnabled || support.ismbEnabled
                ? [{ id: 'STEEL_RIBS' as const, label: isVerticalShaft ? 'Curb / LG Rings' : 'Steel Sets' }]
                : []),
            ]
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

      {/* Quick Given Support Toggles Bar — Allows instant enabling/inspection of any support layer in 3D */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/90 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[10.5px]">
        <span className="font-black uppercase tracking-wider text-amber-400 mr-1">
          3D Given Supports:
        </span>
        {[
          {
            key: 'shotcreteEnabled' as const,
            enabled: Boolean(support.shotcreteEnabled),
            label: isVerticalShaft
              ? `Shotcrete Ring (${support.shotcreteCrownThicknessMm || 100}mm)`
              : `Shotcrete (${support.shotcreteCrownThicknessMm || 100}mm)`,
            activeClass: 'bg-sky-500/20 border-sky-400 text-sky-200',
          },
          {
            key: 'wireMeshEnabled' as const,
            enabled: Boolean(support.wireMeshEnabled),
            label: isVerticalShaft ? '360° Wire Mesh' : 'Wire Mesh',
            activeClass: 'bg-emerald-500/20 border-emerald-400 text-emerald-200',
          },
          {
            key: 'rockBoltsEnabled' as const,
            enabled: Boolean(support.rockBoltsEnabled),
            label: isVerticalShaft
              ? `Radial Pattern Bolts (${support.rockBoltLengthM || 4}m)`
              : `Pattern Bolts (${support.rockBoltLengthM || 4}m)`,
            activeClass: 'bg-cyan-500/20 border-cyan-400 text-cyan-200',
          },
          {
            key: 'latticeGirderEnabled' as const,
            enabled: Boolean(support.latticeGirderEnabled),
            label: isVerticalShaft ? 'Circular LG Ring' : 'Lattice Girder',
            activeClass: 'bg-purple-500/20 border-purple-400 text-purple-200',
          },
          {
            key: 'ismbEnabled' as const,
            enabled: Boolean(support.ismbEnabled),
            label: isVerticalShaft ? 'Steel Curb Ring' : 'ISMB Steel Rib',
            activeClass: 'bg-orange-500/20 border-orange-400 text-orange-200',
          },
          {
            key: 'forepolingEnabled' as const,
            enabled: Boolean(support.forepolingEnabled),
            label: isVerticalShaft ? 'Perimeter Spiling' : 'Forepoling',
            activeClass: 'bg-yellow-500/20 border-yellow-400 text-yellow-200',
          },
          {
            key: 'pipeRoofingEnabled' as const,
            enabled: Boolean(support.pipeRoofingEnabled),
            label: isVerticalShaft ? 'Collar Micropiles' : 'Pipe Roofing',
            activeClass: 'bg-amber-500/20 border-amber-400 text-amber-200',
          },
          {
            key: 'groutingEnabled' as const,
            enabled: Boolean(support.groutingEnabled),
            label: isVerticalShaft ? 'Annulus Grouting' : 'Grouting',
            activeClass: 'bg-teal-500/20 border-teal-400 text-teal-200',
          },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              const nextVal = !item.enabled;
              if (
                item.key === 'forepolingEnabled' ||
                item.key === 'pipeRoofingEnabled' ||
                item.key === 'groutingEnabled'
              ) {
                onUpdateSupport({
                  [item.key]: nextVal,
                  protectionSupportEnabled: nextVal ? true : support.protectionSupportEnabled,
                });
              } else {
                onUpdateSupport({ [item.key]: nextVal });
              }
            }}
            className={`px-2 py-0.5 rounded border font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
              item.enabled
                ? item.activeClass
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
            title={`Click to ${item.enabled ? 'disable' : 'enable'} ${item.label} in 3D & 2D Support System`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                item.enabled ? 'bg-current' : 'bg-slate-600'
              }`}
            />
            <span>{item.label}</span>
          </button>
        ))}
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
              isVerticalShaft
                ? ([
                    { id: 'perspective', label: '3D Shaft Orbit' },
                    { id: 'face', label: 'Top Plan (0°N)' },
                    { id: 'crown', label: 'Sump Face' },
                    { id: 'side', label: 'Shaft Wall' },
                    { id: 'isometric', label: 'Iso' },
                  ] as const)
                : ([
                    { id: 'perspective', label: '3D Orbit' },
                    { id: 'face', label: 'Face' },
                    { id: 'crown', label: 'Crown' },
                    { id: 'side', label: 'Side Look' },
                    { id: 'isometric', label: 'Iso' },
                  ] as const)
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

        {/* Bottom Floating Legend / Indicator — Only displays given supports */}
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center justify-between gap-2 pointer-events-none text-[10.5px]">
          <div className="flex flex-wrap items-center gap-2 bg-slate-950/85 backdrop-blur px-2.5 py-1 rounded-md border border-slate-800 text-slate-300">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-0.5">Given Supports:</span>
            {!support.rockBoltsEnabled &&
              !support.shotcreteEnabled &&
              !support.wireMeshEnabled &&
              !support.latticeGirderEnabled &&
              !support.ismbEnabled &&
              !(support.spotBoltsEnabled && (support.spotBolts?.length || 0) > 0) &&
              !support.forepolingEnabled &&
              !support.pipeRoofingEnabled &&
              !support.groutingEnabled && (
                <span className="text-slate-400 italic">None (Select a Support Class or toggle supports above)</span>
              )}
            {support.spotBoltsEnabled && (support.spotBolts?.length || 0) > 0 && (
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />{' '}
                {isVerticalShaft ? 'Radial Spot Bolt' : 'Spot Bolt'} ({support.spotBolts?.length || 0})
              </span>
            )}
            {support.pipeRoofingEnabled && (
              <span className="flex items-center gap-1 text-orange-400">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />{' '}
                {isVerticalShaft ? 'Micropile Ring' : 'Pipe Roof'} (∠{support.pipeRoofingAngleDeg ?? 7}°)
              </span>
            )}
            {support.forepolingEnabled && (
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />{' '}
                {isVerticalShaft ? 'Shaft Spiling Ring' : 'Forepoling'} (∠{support.forepolingAngleDeg ?? 10}°)
              </span>
            )}
            {support.groutingEnabled && (
              <span className="flex items-center gap-1 text-teal-300">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block" />{' '}
                {isVerticalShaft ? 'Annulus Grouting' : 'Grouting'} ({support.groutingHoleLengthM ?? 6}m)
              </span>
            )}
            {support.rockBoltsEnabled && (
              <span className="flex items-center gap-1 text-sky-400">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />{' '}
                {isVerticalShaft ? 'Radial Pattern Bolts' : 'Pattern Bolts'} ({support.rockBoltLengthM}m)
              </span>
            )}
            {support.shotcreteEnabled && (
              <span className="flex items-center gap-1 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-300 inline-block" />{' '}
                {isVerticalShaft ? 'Shotcrete Shaft Ring' : 'Shotcrete'} ({support.shotcreteCrownThicknessMm}mm)
              </span>
            )}
            {support.wireMeshEnabled && (
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />{' '}
                {isVerticalShaft ? 'Shaft Wall Mesh' : 'Wire Mesh'}
              </span>
            )}
            {support.latticeGirderEnabled && (
              <span className="flex items-center gap-1 text-purple-400">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" />{' '}
                {isVerticalShaft ? 'Circular LG Ring' : 'Lattice Girder'}
              </span>
            )}
            {support.ismbEnabled && (
              <span className="flex items-center gap-1 text-amber-500">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />{' '}
                {isVerticalShaft ? 'Steel Curb Ring' : 'ISMB Rib'}
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
          {isVerticalShaft
            ? '1. Radial Shaft Spot Bolts Angle & Azimuth'
            : '1. Spot Bolts Angle & Orientation'}
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
          <span>
            {isVerticalShaft
              ? '2. Collar Micropile / Tubular Ring'
              : '2. Pipe Roofing (Umbrella Canopy)'}
          </span>
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
          <span>{isVerticalShaft ? '3. Shaft Perimeter Spiling Ring' : '3. Forepoling Spiles'}</span>
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
                const R = W / 2;
                const azDeg = isVerticalShaft ? ((nextIdx * 75) % 360) : newSpotAzimuthDeg;
                const azRad = (azDeg * Math.PI) / 180;
                const newBolt: FieldSpotBoltItem = {
                  id: `sb-${Date.now()}`,
                  label: `SB-${nextIdx}`,
                  panel: isVerticalShaft
                    ? azDeg < 90
                      ? 'crown'
                      : azDeg < 180
                      ? 'right_wall'
                      : azDeg < 270
                      ? 'face'
                      : 'left_wall'
                    : 'crown',
                  u: 0.5,
                  v: 0.5,
                  pullMeter: Number((pullM * 0.5).toFixed(2)),
                  xMeters: isVerticalShaft ? Number((R * Math.sin(azRad)).toFixed(2)) : 0,
                  yMeters: isVerticalShaft
                    ? Number((R * Math.cos(azRad)).toFixed(2))
                    : Number((H * 0.88).toFixed(2)),
                  lengthM: newSpotLengthM,
                  angleDeg: newSpotAngleDeg,
                  azimuthDeg: Math.round(azDeg),
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
                    {selectedBolt.label} ({formatSpotBoltPanelLabel(selectedBolt.panel, isVerticalShaft)})
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
