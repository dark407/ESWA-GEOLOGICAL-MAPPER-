import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import {
  Compass,
  Maximize2,
  Minimize2,
  RotateCcw,
  Eye,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  Move,
  Info,
  Type,
  Trash2,
  Edit2,
  Check,
  X,
  Box,
} from 'lucide-react';
import {
  ContinuousStripTrace,
  ContinuousTunnelStripDataset,
  Point2D,
  resolveStripTraceColor,
  computeContinuous3DJointInspectionSchedule,
  extendStripTraceAcrossPull,
} from '../engine/continuous3DStripEngine';

export interface ContinuousTunnel3DCanvasProps {
  dataset: ContinuousTunnelStripDataset;
  selectedTraceId: string | null;
  onSelectTrace: (traceId: string | null) => void;
  onUpdateTrace?: (updatedTrace: ContinuousStripTrace) => void;
  onDeleteTrace?: (traceId: string) => void;
  showWedgeBlocks?: boolean;
  onExtendTrace?: (
    traceId: string,
    direction: 'start' | 'end' | 'both' | 'full_span',
    distanceM: number
  ) => void;
  className?: string;
}

/** Convert 2D unwrapped strip point (x = chainage/depth, y = perimeter) to 3D Cartesian coordinates for both Tunnel and Vertical Shaft */
export function unrolledToTunnel3D(
  ch: number,
  yPerimeter: number,
  fromRd: number,
  toRd: number,
  leftWallHeight: number,
  crownWidth: number,
  rightWallHeight: number,
  tunnelWidth: number,
  excavationMode: 'TUNNEL' | 'SHAFT' = 'TUNNEL',
  totalPerimOverride?: number
): THREE.Vector3 {
  const radius = tunnelWidth / 2;
  const totalPerimeter =
    totalPerimOverride || leftWallHeight + crownWidth + rightWallHeight;

  if (excavationMode === 'SHAFT') {
    // Vertical Shaft: Y axis is vertical depth downward from collar, X-Z plane is circular shaft cross-section
    const totalDepth = Math.max(1, toRd - fromRd);
    const yHeight = Math.max(0, totalDepth - (ch - fromRd));
    const angle = (yPerimeter / Math.max(0.001, totalPerimeter)) * Math.PI * 2; // 0 (N) -> PI/2 (E) -> PI (S) -> 3PI/2 (W)
    const x = radius * Math.sin(angle);
    const z = -radius * Math.cos(angle);
    return new THREE.Vector3(x, yHeight, z);
  }

  // Horizontal/Inclined Tunnel: Z axis along tunnel drive direction
  const z = ch - fromRd;
  let x = 0;
  let y = 0;

  if (yPerimeter <= leftWallHeight) {
    // Left Wall (Vertical from floor to springline)
    x = -radius;
    y = Math.max(0, yPerimeter);
  } else if (yPerimeter <= leftWallHeight + crownWidth) {
    // Crown Arch (Semi-circle from left springline to right springline)
    const t = (yPerimeter - leftWallHeight) / Math.max(0.001, crownWidth);
    const angle = t * Math.PI; // 0 to PI
    x = -radius * Math.cos(angle);
    y = leftWallHeight + radius * Math.sin(angle);
  } else {
    // Right Wall (Vertical from springline to floor)
    x = radius;
    const fromBottom = Math.max(0, totalPerimeter - yPerimeter);
    y = fromBottom;
  }

  return new THREE.Vector3(x, y, z);
}

export const ContinuousTunnel3DCanvas: React.FC<ContinuousTunnel3DCanvasProps> = ({
  dataset,
  selectedTraceId,
  onSelectTrace,
  onUpdateTrace,
  onDeleteTrace,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const reqIdRef = useRef<number | null>(null);

  // Interaction & Orbit
  const isPointerDownRef = useRef(false);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const cameraOrbitRef = useRef({
    radius: 35,
    theta: 0.7, // azimuthal angle (rad)
    phi: 1.1, // polar angle (rad)
    target: new THREE.Vector3(0, 4, 15),
  });

  // Display Settings
  const [showJointPlanes, setShowJointPlanes] = useState<boolean>(true);
  const [showWedgeBlocks, setShowWedgeBlocks] = useState<boolean>(true);
  const [showLithologyBands, setShowLithologyBands] = useState<boolean>(true);
  const [showChainageRings, setShowChainageRings] = useState<boolean>(true);
  const [show3DLabels, setShow3DLabels] = useState<boolean>(true);
  const [tunnelOpacity, setTunnelOpacity] = useState<number>(0.55);
  const [hoveredTraceId, setHoveredTraceId] = useState<string | null>(null);

  // Trace editing inside 3D Inspector
  const [isEditingLabel, setIsEditingLabel] = useState<boolean>(false);
  const [labelTextDraft, setLabelTextDraft] = useState<string>('');

  const excavationMode: 'TUNNEL' | 'SHAFT' = dataset.excavationMode || 'TUNNEL';
  const isShaft = excavationMode === 'SHAFT';

  // Dimensions
  const fromRd = dataset.viewFromRd ?? 250;
  const toRd = dataset.viewToRd ?? 300;
  const totalLengthM = Math.max(1, toRd - fromRd);

  const leftWallHeight = dataset.leftWallHeightM || dataset.leftWallArcLengthM || 4.5;
  const crownWidth = dataset.crownWidthM || dataset.crownArcLengthM || 9.0;
  const rightWallHeight = dataset.rightWallHeightM || dataset.rightWallArcLengthM || 4.5;
  const tunnelWidth = dataset.tunnelDiameterWidthM || dataset.shaftDiameterM || 10.0;
  const totalPerimeterM =
    (dataset.upperZoneWidthM || 0) + (dataset.lowerZoneWidthM || 0) ||
    leftWallHeight + crownWidth + rightWallHeight;

  // High-precision 3D joint inspection schedule
  const jointInspectionList = useMemo(
    () => computeContinuous3DJointInspectionSchedule(dataset),
    [dataset]
  );

  // Selected trace object & its 3D inspection record
  const activeTrace = useMemo(() => {
    return (dataset.traces || []).find((t) => t.id === selectedTraceId) || null;
  }, [dataset.traces, selectedTraceId]);

  const activeInspection = useMemo(() => {
    if (!activeTrace) return null;
    return jointInspectionList.find((j) => j.traceId === activeTrace.id) || null;
  }, [activeTrace, jointInspectionList]);

  // Sync draft label when active trace changes
  useEffect(() => {
    if (activeTrace) {
      setLabelTextDraft(activeTrace.customLabel !== undefined ? activeTrace.customLabel : activeTrace.setId);
    }
  }, [activeTrace?.id, activeTrace?.customLabel, activeTrace?.setId]);

  // References to 3D trace meshes for raycasting
  const traceMeshesRef = useRef<Array<{ id: string; mesh: THREE.Object3D }>>([]);

  // Initialize Three.js scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff); // Pure crisp white background
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;

    // Set initial orbit target at tunnel center
    cameraOrbitRef.current.target.set(0, leftWallHeight * 0.7, totalLengthM / 2);
    cameraOrbitRef.current.radius = Math.max(25, totalLengthM * 0.85);

    const updateCameraPos = () => {
      const { radius, theta, phi, target } = cameraOrbitRef.current;
      const x = target.x + radius * Math.sin(phi) * Math.sin(theta);
      const y = target.y + radius * Math.cos(phi);
      const z = target.z + radius * Math.sin(phi) * Math.cos(theta);
      camera.position.set(x, y, z);
      camera.lookAt(target);
    };
    updateCameraPos();

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xfff8ee, 0.85);
    dirLight1.position.set(30, 45, 20);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xe0f2fe, 0.5);
    dirLight2.position.set(-30, 20, -10);
    scene.add(dirLight2);

    // 5. Floor Reference Grid
    const gridHelper = new THREE.GridHelper(Math.max(60, totalLengthM + 20), 40, 0x94a3b8, 0xe2e8f0);
    gridHelper.position.set(0, -0.05, totalLengthM / 2);
    scene.add(gridHelper);

    // Render loop
    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [totalLengthM, leftWallHeight]);

  // Re-build 3D tunnel meshes when dataset, traces, or display settings change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove previous dynamic objects (tagged with userData.isTunnelEntity)
    const toRemove: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (obj.userData?.isTunnelEntity) {
        toRemove.push(obj);
      }
    });
    toRemove.forEach((obj) => {
      scene.remove(obj);
      if ((obj as any).geometry) (obj as any).geometry.dispose();
      if ((obj as any).material) {
        if (Array.isArray((obj as any).material)) {
          (obj as any).material.forEach((m: any) => m.dispose());
        } else {
          (obj as any).material.dispose();
        }
      }
    });
    traceMeshesRef.current = [];

    // 1. Build Horseshoe Tunnel Mesh (Continuous Extruded Profile)
    const uSegments = 40; // perimeter resolution
    const vSegments = Math.max(10, Math.round(totalLengthM * 2)); // length resolution

    const tunnelGeo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const totalPerimeter = totalPerimeterM;

    for (let j = 0; j <= vSegments; j++) {
      const v = j / vSegments;
      const ch = fromRd + v * totalLengthM;
      for (let i = 0; i <= uSegments; i++) {
        const u = i / uSegments;
        const yPerim = u * totalPerimeter;
        const pt = unrolledToTunnel3D(
          ch,
          yPerim,
          fromRd,
          toRd,
          leftWallHeight,
          crownWidth,
          rightWallHeight,
          tunnelWidth,
          excavationMode,
          totalPerimeter
        );
        positions.push(pt.x, pt.y, pt.z);

        // Normal pointing inwards / outwards
        const nx = isShaft ? -pt.x : yPerim > leftWallHeight && yPerim < leftWallHeight + crownWidth ? -pt.x : (pt.x > 0 ? -1 : 1);
        const nz = isShaft ? -pt.z : 0;
        normals.push(nx, 0.5, nz);
        uvs.push(u, v);
      }
    }

    for (let j = 0; j < vSegments; j++) {
      for (let i = 0; i < uSegments; i++) {
        const a = j * (uSegments + 1) + i;
        const b = (j + 1) * (uSegments + 1) + i;
        const c = (j + 1) * (uSegments + 1) + (i + 1);
        const d = j * (uSegments + 1) + (i + 1);
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    tunnelGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    tunnelGeo.setIndex(indices);
    tunnelGeo.computeVertexNormals();

    const tunnelMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: tunnelOpacity,
      depthWrite: tunnelOpacity > 0.8,
    });

    const tunnelMesh = new THREE.Mesh(tunnelGeo, tunnelMat);
    tunnelMesh.userData.isTunnelEntity = true;
    scene.add(tunnelMesh);

    // Wireframe overlay for tunnel ribs
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    const wireMesh = new THREE.Mesh(tunnelGeo, wireMat);
    wireMesh.userData.isTunnelEntity = true;
    scene.add(wireMesh);

    // 2. Chainage / Shaft Depth Rings & Tick Annotations
    if (showChainageRings) {
      const ringStep = Math.max(2, Math.min(5, Math.round(totalLengthM / 6)));
      for (let ch = Math.ceil(fromRd); ch <= toRd; ch += ringStep) {
        const ringPoints: THREE.Vector3[] = [];
        for (let i = 0; i <= 36; i++) {
          const yP = (i / 36) * totalPerimeter;
          ringPoints.push(
            unrolledToTunnel3D(ch, yP, fromRd, toRd, leftWallHeight, crownWidth, rightWallHeight, tunnelWidth, excavationMode, totalPerimeter)
          );
        }
        const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPoints);
        const ringMat = new THREE.LineBasicMaterial({
          color: 0x94a3b8,
          linewidth: 1.5,
        });
        const ringLine = new THREE.Line(ringGeo, ringMat);
        ringLine.userData.isTunnelEntity = true;
        scene.add(ringLine);

        // Chainage / Depth Billboard Text Sprite
        const crownTop = unrolledToTunnel3D(
          ch,
          isShaft ? 0 : leftWallHeight + crownWidth / 2,
          fromRd,
          toRd,
          leftWallHeight,
          crownWidth,
          rightWallHeight,
          tunnelWidth,
          excavationMode,
          totalPerimeter
        );
        if (isShaft) {
          crownTop.z -= 1.2;
        } else {
          crownTop.y += 0.8;
        }

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 26px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${isShaft ? 'DEPTH' : 'RD'} ${ch.toFixed(1)}m`, 128, 32);

          const tex = new THREE.CanvasTexture(canvas);
          const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
          const sprite = new THREE.Sprite(spriteMat);
          sprite.position.copy(crownTop);
          sprite.scale.set(4, 1, 1);
          sprite.userData.isTunnelEntity = true;
          scene.add(sprite);
        }
      }
    }

    // 2B. Highlight Unlogged Gap Intervals (`MISSING_GAP`) in 3D with Dashed Amber Wireframe Rings
    (dataset.pulls || [])
      .filter((p) => p.status === 'MISSING_GAP')
      .forEach((gapPull) => {
        for (const boundaryRd of [gapPull.fromRd, gapPull.toRd]) {
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i <= 36; i++) {
            const yP = (i / 36) * totalPerimeter;
            pts.push(
              unrolledToTunnel3D(
                boundaryRd,
                yP,
                fromRd,
                toRd,
                leftWallHeight,
                crownWidth,
                rightWallHeight,
                tunnelWidth,
                excavationMode,
                totalPerimeter
              )
            );
          }
          const gGeo = new THREE.BufferGeometry().setFromPoints(pts);
          const gMat = new THREE.LineDashedMaterial({
            color: 0xd97706,
            dashSize: 0.5,
            gapSize: 0.3,
          });
          const gLine = new THREE.Line(gGeo, gMat);
          gLine.computeLineDistances();
          gLine.userData.isTunnelEntity = true;
          scene.add(gLine);
        }
      });

    // 2C. If Vertical Shaft Half-Circle Mode, render the Center Median Dividing Wall
    if (isShaft && dataset.shaftSubMode && dataset.shaftSubMode !== 'FULL_CIRCLE') {
      const medianGeo = new THREE.PlaneGeometry(tunnelWidth, totalLengthM);
      const medianMat = new THREE.MeshStandardMaterial({
        color: dataset.shaftCenterMedianStatus === 'open' ? 0xf59e0b : 0x64748b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: dataset.shaftCenterMedianStatus === 'open' ? 0.25 : 0.55,
      });
      const medianMesh = new THREE.Mesh(medianGeo, medianMat);
      medianMesh.rotation.y = Math.PI / 2;
      medianMesh.position.set(0, totalLengthM / 2, 0);
      medianMesh.userData.isTunnelEntity = true;
      scene.add(medianMesh);
    }

    // 3. Lithology Strata Zones & 3D Groundwater Seepage Markers in 3D
    if (showLithologyBands && dataset.lithologyZones) {
      dataset.lithologyZones.forEach((zone) => {
        if (!zone.polygon || zone.polygon.length < 3) return;
        const rl = (zone.rockType || zone.label || '').toLowerCase();
        const lithColor = rl.includes('granite')
          ? 0xef4444
          : rl.includes('gneiss')
          ? 0x8b5cf6
          : rl.includes('phyllite') || rl.includes('schist')
          ? 0x10b981
          : rl.includes('limestone')
          ? 0x3b82f6
          : rl.includes('basalt')
          ? 0x64748b
          : 0xeab308;

        // Subdivide polygon edges so it conforms smoothly to the 3D tunnel/shaft arch
        const dense2D: { x: number; y: number }[] = [];
        for (let i = 0; i < zone.polygon.length; i++) {
          const a = zone.polygon[i];
          const b = zone.polygon[(i + 1) % zone.polygon.length];
          const steps = 6;
          for (let s = 0; s < steps; s++) {
            const t = s / steps;
            dense2D.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
          }
        }
        const pts3D = dense2D.map((p) =>
          unrolledToTunnel3D(p.x, p.y, fromRd, toRd, leftWallHeight, crownWidth, rightWallHeight, tunnelWidth, excavationMode, totalPerimeter)
        );

        // Draw outline of lithology boundary
        const polyGeo = new THREE.BufferGeometry().setFromPoints([...pts3D, pts3D[0]]);
        const polyMat = new THREE.LineBasicMaterial({
          color: lithColor,
          linewidth: 2,
          transparent: true,
          opacity: 0.75,
        });
        const polyLine = new THREE.Line(polyGeo, polyMat);
        polyLine.userData.isTunnelEntity = true;
        scene.add(polyLine);

        // Shaded fan mesh for custom lithology zones
        if (!zone.id.startsWith('lith-pull-') && pts3D.length >= 3) {
          const center3D = new THREE.Vector3();
          pts3D.forEach((pt) => center3D.add(pt));
          center3D.divideScalar(pts3D.length);
          const fanVerts: number[] = [];
          for (let i = 0; i < pts3D.length; i++) {
            const pA = pts3D[i];
            const pB = pts3D[(i + 1) % pts3D.length];
            fanVerts.push(center3D.x, center3D.y, center3D.z, pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
          }
          const fanGeo = new THREE.BufferGeometry();
          fanGeo.setAttribute('position', new THREE.Float32BufferAttribute(fanVerts, 3));
          fanGeo.computeVertexNormals();
          const fanMat = new THREE.MeshBasicMaterial({
            color: lithColor,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
          });
          const fanMesh = new THREE.Mesh(fanGeo, fanMat);
          fanMesh.userData.isTunnelEntity = true;
          scene.add(fanMesh);
        }
      });
    }

    // 3B. 3D Groundwater Seepage Markers (`dataset.waterSymbols`)
    (dataset.waterSymbols || []).forEach((ws) => {
      const pos3D = unrolledToTunnel3D(
        ws.position.x,
        ws.position.y,
        fromRd,
        toRd,
        leftWallHeight,
        crownWidth,
        rightWallHeight,
        tunnelWidth,
        excavationMode,
        totalPerimeter
      );
      const cond = ws.condition || 'Dry';
      const wColor =
        cond === 'Flowing'
          ? 0x1d4ed8
          : cond === 'Dripping'
          ? 0x0284c7
          : cond === 'Wet'
          ? 0x0ea5e9
          : cond === 'Moist/Damp'
          ? 0x38bdf8
          : 0x64748b;
      const dropGeo = new THREE.SphereGeometry(cond === 'Dry' ? 0.08 : 0.14, 12, 12);
      const dropMat = new THREE.MeshStandardMaterial({
        color: wColor,
        emissive: wColor,
        emissiveIntensity: cond === 'Dry' ? 0.15 : 0.55,
        roughness: 0.2,
      });
      const dropMesh = new THREE.Mesh(dropGeo, dropMat);
      dropMesh.position.copy(pos3D);
      dropMesh.userData.isTunnelEntity = true;
      scene.add(dropMesh);
    });

    // 4. Render Discontinuity Joint Traces in 3D (Crisp Tubes + 3D Dip Surface Ribbons + Oriented Plane Discs + 3D Tetrahedral Wedge Blocks)
    (dataset.traces || []).forEach((trace) => {
      const points = trace.points || [];
      if (points.length < 2) return;

      const isSelected = trace.id === selectedTraceId;
      const isHovered = trace.id === hoveredTraceId;
      const colorHex = resolveStripTraceColor(trace);
      const colorNum = parseInt(colorHex.replace('#', '0x'), 16) || 0x3b82f6;

      // Convert 2D points to 3D curve
      const pts3D = points.map((p) =>
        unrolledToTunnel3D(p.x, p.y, fromRd, toRd, leftWallHeight, crownWidth, rightWallHeight, tunnelWidth, excavationMode, totalPerimeter)
      );

      // Create a smooth 3D CatmullRom curve with crisp, fine geological trace thickness
      const curve = new THREE.CatmullRomCurve3(pts3D, false, 'chordal');
      const tubeRadius = isSelected ? 0.055 : isHovered ? 0.042 : 0.026;
      const tubeGeo = new THREE.TubeGeometry(curve, Math.max(12, points.length * 4), tubeRadius, 8, false);

      const tubeMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0xf59e0b : isHovered ? 0x38bdf8 : colorNum,
        roughness: 0.3,
        metalness: 0.1,
        emissive: isSelected ? 0x78350f : isHovered ? 0x075985 : 0x000000,
        emissiveIntensity: isSelected ? 0.6 : 0.3,
      });

      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      tubeMesh.userData = { isTunnelEntity: true, traceId: trace.id };
      scene.add(tubeMesh);

      // Invisible wider raycast hit proxy so crisp thin traces remain effortless to click/hover
      const hitProxyGeo = new THREE.TubeGeometry(curve, Math.max(10, points.length * 3), 0.16, 6, false);
      const hitProxyMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const hitProxyMesh = new THREE.Mesh(hitProxyGeo, hitProxyMat);
      hitProxyMesh.userData = { isTunnelEntity: true, traceId: trace.id };
      scene.add(hitProxyMesh);
      traceMeshesRef.current.push({ id: trace.id, mesh: hitProxyMesh });

      // Calculate centroid of trace in 3D
      const centroid3D = new THREE.Vector3();
      pts3D.forEach((p) => centroid3D.add(p));
      centroid3D.divideScalar(pts3D.length);

      // 5. Continuous 3D Dip Surface Ribbon & Oriented Geological Plane Disc
      if (showJointPlanes) {
        const dipDirRad = (trace.dipDirectionDeg * Math.PI) / 180;
        const dipRad = (trace.dipDeg * Math.PI) / 180;

        // Normal vector of the joint plane
        const nx = Math.sin(dipRad) * Math.sin(dipDirRad);
        const ny = Math.cos(dipRad);
        const nz = Math.sin(dipRad) * Math.cos(dipDirRad);
        const normal = new THREE.Vector3(nx, ny, nz).normalize();

        // Down-dip vector along the dipping plane surface
        const dipVec = new THREE.Vector3(
          Math.cos(dipRad) * Math.sin(dipDirRad),
          -Math.sin(dipRad),
          Math.cos(dipRad) * Math.cos(dipDirRad)
        ).normalize();

        // Only extrude a 3D Dip Surface Ribbon when the structure is explicitly a Dip Surface ('Joint Plane/Surface')
        // Regular joint traces (J1, J2, J3, etc.) remain crisp 3D trace lines without dip-surface ribbon extrusion.
        if (trace.structureType === 'Joint Plane/Surface') {
          const sampledPts = curve.getPoints(Math.max(12, points.length * 3));
          const ribbonDepthM = isSelected ? 1.15 : 0.78;
          const ribVerts: number[] = [];
          for (let i = 0; i < sampledPts.length - 1; i++) {
            const p1 = sampledPts[i];
            const p2 = sampledPts[i + 1];
            const p1Out = p1.clone().addScaledVector(dipVec, ribbonDepthM);
            const p2Out = p2.clone().addScaledVector(dipVec, ribbonDepthM);

            ribVerts.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p1Out.x, p1Out.y, p1Out.z);
            ribVerts.push(p2.x, p2.y, p2.z, p2Out.x, p2Out.y, p2Out.z, p1Out.x, p1Out.y, p1Out.z);
          }
          if (ribVerts.length > 0) {
            const ribGeo = new THREE.BufferGeometry();
            ribGeo.setAttribute('position', new THREE.Float32BufferAttribute(ribVerts, 3));
            ribGeo.computeVertexNormals();
            const ribMat = new THREE.MeshStandardMaterial({
              color: isSelected ? 0xf59e0b : colorNum,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: isSelected ? 0.42 : 0.24,
              roughness: 0.45,
              depthWrite: false,
            });
            const ribMesh = new THREE.Mesh(ribGeo, ribMat);
            ribMesh.userData = { isTunnelEntity: true, traceId: trace.id };
            scene.add(ribMesh);
          }
        }

        const discRadius = Math.max(
          1.4,
          Math.min(
            2.8,
            Math.hypot(
              pts3D[pts3D.length - 1].x - pts3D[0].x,
              pts3D[pts3D.length - 1].z - pts3D[0].z
            ) * 0.45
          )
        );
        const discGeo = new THREE.CircleGeometry(discRadius, 32);

        // Align circle normal (default +Z) to joint plane normal
        const defaultNormal = new THREE.Vector3(0, 0, 1);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(defaultNormal, normal);

        const discMat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0xf59e0b : colorNum,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: isSelected ? 0.45 : 0.18,
          roughness: 0.5,
        });

        const discMesh = new THREE.Mesh(discGeo, discMat);
        discMesh.position.copy(centroid3D);
        discMesh.quaternion.copy(quaternion);
        discMesh.userData = { isTunnelEntity: true, traceId: trace.id };
        scene.add(discMesh);

        // Plane disc boundary ring
        const ringEdges = new THREE.LineSegments(
          new THREE.EdgesGeometry(discGeo),
          new THREE.LineBasicMaterial({
            color: isSelected ? 0xf59e0b : colorNum,
            linewidth: isSelected ? 2 : 1,
            transparent: true,
            opacity: 0.7,
          })
        );
        ringEdges.position.copy(centroid3D);
        ringEdges.quaternion.copy(quaternion);
        ringEdges.userData.isTunnelEntity = true;
        scene.add(ringEdges);
      }

      // 5B. 3D Tetrahedral Kinematic Wedge Block on Selected or Critical Traces
      if (showWedgeBlocks && (isSelected || pts3D.length >= 2)) {
        const insp = jointInspectionList.find((j) => j.traceId === trace.id);
        const apexH = insp ? insp.wedgeApexHeightM : 1.4;
        const dipDirRad = (trace.dipDirectionDeg * Math.PI) / 180;
        const dipRad = (trace.dipDeg * Math.PI) / 180;
        const normal = new THREE.Vector3(
          Math.sin(dipRad) * Math.sin(dipDirRad),
          Math.cos(dipRad),
          Math.sin(dipRad) * Math.cos(dipDirRad)
        ).normalize();

        const pStart = pts3D[0];
        const pEnd = pts3D[pts3D.length - 1];
        const pMid = centroid3D.clone().add(new THREE.Vector3(0, isShaft ? 0.6 : 0.4, isShaft ? 0.4 : 0.8));
        const pApex = centroid3D.clone().addScaledVector(normal, apexH);

        const wedgeGeo = new THREE.BufferGeometry();
        const wVerts = new Float32Array([
          pStart.x, pStart.y, pStart.z,
          pEnd.x, pEnd.y, pEnd.z,
          pMid.x, pMid.y, pMid.z,

          pStart.x, pStart.y, pStart.z,
          pMid.x, pMid.y, pMid.z,
          pApex.x, pApex.y, pApex.z,

          pMid.x, pMid.y, pMid.z,
          pEnd.x, pEnd.y, pEnd.z,
          pApex.x, pApex.y, pApex.z,

          pEnd.x, pEnd.y, pEnd.z,
          pStart.x, pStart.y, pStart.z,
          pApex.x, pApex.y, pApex.z,
        ]);
        wedgeGeo.setAttribute('position', new THREE.BufferAttribute(wVerts, 3));
        wedgeGeo.computeVertexNormals();

        const isCrit = insp && insp.fosUnreinforced < 1.15;
        const wedgeMat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0xf59e0b : isCrit ? 0xef4444 : 0x0ea5e9,
          transparent: true,
          opacity: isSelected ? 0.48 : 0.22,
          side: THREE.DoubleSide,
          roughness: 0.4,
        });
        const wedgeMesh = new THREE.Mesh(wedgeGeo, wedgeMat);
        wedgeMesh.userData = { isTunnelEntity: true, traceId: trace.id };
        scene.add(wedgeMesh);
      }

      // 6. 3D Billboard Text Label (Clean text, NO boxy cards)
      if (show3DLabels && !trace.hideLabel) {
        const labelText = trace.customLabel || trace.setId || 'J';
        const orientText = `${trace.dipDirectionDeg}°/${trace.dipDeg}°`;

        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
          ctx.shadowBlur = 4;

          ctx.fillStyle = colorHex;
          ctx.font = 'bold 34px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(labelText, 150, 42);

          ctx.fillStyle = '#1e293b';
          ctx.font = 'bold 22px monospace';
          ctx.fillText(orientText, 150, 78);

          const tex = new THREE.CanvasTexture(canvas);
          const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
          const sprite = new THREE.Sprite(spriteMat);
          sprite.position.copy(centroid3D);
          sprite.position.y += 0.8;
          sprite.scale.set(3.2, 1.1, 1);
          sprite.userData.isTunnelEntity = true;
          scene.add(sprite);
        }
      }
    });
  }, [
    dataset,
    selectedTraceId,
    hoveredTraceId,
    showJointPlanes,
    showWedgeBlocks,
    showLithologyBands,
    showChainageRings,
    show3DLabels,
    tunnelOpacity,
    fromRd,
    toRd,
    totalLengthM,
    leftWallHeight,
    crownWidth,
    rightWallHeight,
    tunnelWidth,
    excavationMode,
    isShaft,
    totalPerimeterM,
    jointInspectionList,
  ]);

  // Handle Mouse Events for Orbit / Pan / Raycast selection
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isPointerDownRef.current = true;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = mountRef.current;
    if (!container || !cameraRef.current || !sceneRef.current) return;

    if (isPointerDownRef.current) {
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      pointerStartRef.current = { x: e.clientX, y: e.clientY };

      if (e.buttons === 1 && !e.shiftKey) {
        // Orbit
        cameraOrbitRef.current.theta -= dx * 0.007;
        cameraOrbitRef.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraOrbitRef.current.phi - dy * 0.007));
      } else if (e.buttons === 2 || (e.buttons === 1 && e.shiftKey)) {
        // Pan
        const panSpeed = 0.04;
        const forward = new THREE.Vector3();
        cameraRef.current.getWorldDirection(forward);
        const right = new THREE.Vector3().crossVectors(forward, cameraRef.current.up).normalize();

        cameraOrbitRef.current.target.addScaledVector(right, -dx * panSpeed);
        cameraOrbitRef.current.target.y += dy * panSpeed;
      }

      // Update camera position
      const { radius, theta, phi, target } = cameraOrbitRef.current;
      const cx = target.x + radius * Math.sin(phi) * Math.sin(theta);
      const cy = target.y + radius * Math.cos(phi);
      const cz = target.z + radius * Math.sin(phi) * Math.cos(theta);
      cameraRef.current.position.set(cx, cy, cz);
      cameraRef.current.lookAt(target);
    } else {
      // Raycasting for trace hover highlight
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);
      const targets = traceMeshesRef.current.map((t) => t.mesh);
      const intersects = raycaster.intersectObjects(targets, false);

      if (intersects.length > 0) {
        const hitId = intersects[0].object.userData.traceId;
        setHoveredTraceId(hitId || null);
      } else {
        setHoveredTraceId(null);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isPointerDownRef.current = false;
    const container = mountRef.current;
    if (!container || !cameraRef.current) return;

    // Detect click vs drag
    const moveDist = Math.hypot(e.clientX - pointerStartRef.current.x, e.clientY - pointerStartRef.current.y);
    if (moveDist < 4) {
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);
      const targets = traceMeshesRef.current.map((t) => t.mesh);
      const intersects = raycaster.intersectObjects(targets, false);

      if (intersects.length > 0) {
        const hitId = intersects[0].object.userData.traceId;
        onSelectTrace(hitId);
      } else {
        // Deselect if clicked empty space
        onSelectTrace(null);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!cameraRef.current) return;
    const zoomDelta = e.deltaY * 0.04;
    cameraOrbitRef.current.radius = Math.max(5, Math.min(120, cameraOrbitRef.current.radius + zoomDelta));

    const { radius, theta, phi, target } = cameraOrbitRef.current;
    const cx = target.x + radius * Math.sin(phi) * Math.sin(theta);
    const cy = target.y + radius * Math.cos(phi);
    const cz = target.z + radius * Math.sin(phi) * Math.cos(theta);
    cameraRef.current.position.set(cx, cy, cz);
    cameraRef.current.lookAt(target);
  };

  // Camera Presets
  const setCameraPreset = (preset: 'iso' | 'ahead' | 'back' | 'top' | 'left' | 'right' | 'crown') => {
    if (!cameraRef.current) return;
    const center = new THREE.Vector3(0, leftWallHeight * 0.6, totalLengthM / 2);
    cameraOrbitRef.current.target.copy(center);

    switch (preset) {
      case 'iso':
        cameraOrbitRef.current.theta = 0.75;
        cameraOrbitRef.current.phi = 1.1;
        cameraOrbitRef.current.radius = Math.max(30, totalLengthM * 0.9);
        break;
      case 'ahead':
        cameraOrbitRef.current.theta = 0;
        cameraOrbitRef.current.phi = Math.PI / 2;
        cameraOrbitRef.current.radius = Math.max(25, totalLengthM * 0.8);
        break;
      case 'back':
        cameraOrbitRef.current.theta = Math.PI;
        cameraOrbitRef.current.phi = Math.PI / 2;
        cameraOrbitRef.current.radius = Math.max(25, totalLengthM * 0.8);
        break;
      case 'top':
        cameraOrbitRef.current.theta = 0;
        cameraOrbitRef.current.phi = 0.05;
        cameraOrbitRef.current.radius = Math.max(35, totalLengthM * 1.1);
        break;
      case 'left':
        cameraOrbitRef.current.theta = Math.PI / 2;
        cameraOrbitRef.current.phi = Math.PI / 2;
        cameraOrbitRef.current.radius = Math.max(25, totalLengthM * 0.8);
        break;
      case 'right':
        cameraOrbitRef.current.theta = -Math.PI / 2;
        cameraOrbitRef.current.phi = Math.PI / 2;
        cameraOrbitRef.current.radius = Math.max(25, totalLengthM * 0.8);
        break;
      case 'crown':
        cameraOrbitRef.current.theta = 0;
        cameraOrbitRef.current.phi = 0.4;
        cameraOrbitRef.current.radius = Math.max(25, totalLengthM * 0.7);
        break;
    }

    const { radius, theta, phi, target } = cameraOrbitRef.current;
    const cx = target.x + radius * Math.sin(phi) * Math.sin(theta);
    const cy = target.y + radius * Math.cos(phi);
    const cz = target.z + radius * Math.sin(phi) * Math.cos(theta);
    cameraRef.current.position.set(cx, cy, cz);
    cameraRef.current.lookAt(target);
  };

  // Next / Prev trace cycler
  const handleCycleTrace = (direction: 1 | -1) => {
    const traces = dataset.traces || [];
    if (traces.length === 0) return;
    const currentIdx = traces.findIndex((t) => t.id === selectedTraceId);
    let nextIdx = currentIdx + direction;
    if (nextIdx < 0) nextIdx = traces.length - 1;
    if (nextIdx >= traces.length) nextIdx = 0;
    onSelectTrace(traces[nextIdx].id);
  };

  // Update label text from 3D HUD
  const handleSaveLabelText = () => {
    if (!activeTrace) return;
    onUpdateTrace({
      ...activeTrace,
      customLabel: labelTextDraft,
      hideLabel: labelTextDraft.trim() === '',
    });
    setIsEditingLabel(false);
  };

  // Delete label text from canvas
  const handleDeleteText = () => {
    if (!activeTrace) return;
    onUpdateTrace({
      ...activeTrace,
      customLabel: '',
      hideLabel: true,
    });
    setLabelTextDraft('');
    setIsEditingLabel(false);
  };

  return (
    <div className={`relative w-full h-full flex flex-col bg-white overflow-hidden select-none ${className}`}>
      {/* 3D Top Controls & Camera Ribbon Bar */}
      <div className="h-10 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 flex items-center justify-between shrink-0 z-10 shadow-xs">
        {/* Left: 3D View Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-sans">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Box className="w-3.5 h-3.5 text-blue-600" />
            3D Views:
          </span>
          <button
            type="button"
            onClick={() => setCameraPreset('iso')}
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] cursor-pointer transition border border-slate-200"
          >
            Isometric
          </button>
          <button
            type="button"
            onClick={() => setCameraPreset('ahead')}
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] cursor-pointer transition border border-slate-200"
          >
            Drive Heading
          </button>
          <button
            type="button"
            onClick={() => setCameraPreset('left')}
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] cursor-pointer transition border border-slate-200"
          >
            Left Wall
          </button>
          <button
            type="button"
            onClick={() => setCameraPreset('crown')}
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] cursor-pointer transition border border-slate-200"
          >
            Crown
          </button>
          <button
            type="button"
            onClick={() => setCameraPreset('right')}
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] cursor-pointer transition border border-slate-200"
          >
            Right Wall
          </button>
          <button
            type="button"
            onClick={() => setCameraPreset('top')}
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] cursor-pointer transition border border-slate-200"
          >
            Top Plan
          </button>
        </div>

        {/* Right: Layer Toggles in 3D */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-slate-700 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={showJointPlanes}
              onChange={(e) => setShowJointPlanes(e.target.checked)}
              className="rounded text-blue-600 focus:ring-0"
            />
            <span>3D Joint Planes</span>
          </label>
          <label className="flex items-center gap-1 text-[11px] text-slate-700 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={showWedgeBlocks}
              onChange={(e) => setShowWedgeBlocks(e.target.checked)}
              className="rounded text-blue-600 focus:ring-0"
            />
            <span>3D Wedge Blocks</span>
          </label>
          <label className="flex items-center gap-1 text-[11px] text-slate-700 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={show3DLabels}
              onChange={(e) => setShow3DLabels(e.target.checked)}
              className="rounded text-blue-600 focus:ring-0"
            />
            <span>Text Labels</span>
          </label>
          <label className="flex items-center gap-1 text-[11px] text-slate-700 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={showLithologyBands}
              onChange={(e) => setShowLithologyBands(e.target.checked)}
              className="rounded text-blue-600 focus:ring-0"
            />
            <span>Lithology</span>
          </label>
          <button
            type="button"
            onClick={() => setCameraPreset('iso')}
            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            title="Reset 3D Camera View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Three.js Viewport */}
      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing touch-none"
      />

      {/* 3D Navigation Overlay Tip */}
      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm text-[11px] text-slate-600 font-mono pointer-events-none flex items-center gap-2">
        <span>🖱 Left Click + Drag: Orbit</span>
        <span>•</span>
        <span>Right Click / Shift+Drag: Pan</span>
        <span>•</span>
        <span>Wheel: Zoom</span>
        <span>•</span>
        <span className="text-blue-600 font-bold">Click Joint to Inspect</span>
      </div>

      {/* Joint Cycler Pill at Bottom Center */}
      {(dataset.traces || []).length > 0 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-slate-300 rounded-full px-3 py-1 shadow-md flex items-center gap-2 z-10 text-xs">
          <button
            type="button"
            onClick={() => handleCycleTrace(-1)}
            className="p-1 rounded-full hover:bg-slate-100 text-slate-600 cursor-pointer"
            title="Inspect Previous Joint"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-slate-800 min-w-28 text-center">
            {activeTrace ? (
              <span className="flex items-center justify-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: resolveStripTraceColor(activeTrace) }}
                />
                {activeTrace.customLabel || activeTrace.setId} ({activeTrace.orientationLabel})
              </span>
            ) : (
              <span className="text-slate-400">Select a Joint ({(dataset.traces || []).length} mapped)</span>
            )}
          </span>
          <button
            type="button"
            onClick={() => handleCycleTrace(1)}
            className="p-1 rounded-full hover:bg-slate-100 text-slate-600 cursor-pointer"
            title="Inspect Next Joint"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3D Interactive Joint Inspector HUD (Floating Card) */}
      {activeTrace && (
        <div className="absolute top-12 right-3 w-80 bg-white/95 backdrop-blur-md border border-slate-300 rounded-2xl shadow-xl overflow-hidden z-20 animate-in fade-in slide-in-from-right-4 duration-200">
          {/* Header */}
          <div className="p-3 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full ring-2 ring-white shadow-xs"
                style={{ backgroundColor: resolveStripTraceColor(activeTrace) }}
              />
              <div>
                <h4 className="text-xs font-bold text-slate-900 leading-tight">
                  {activeTrace.customLabel || activeTrace.setId} 3D Inspection
                </h4>
                <p className="text-[10px] text-slate-500 font-mono">
                  Chainage Span: CH {(activeTrace.points?.[0]?.x || fromRd).toFixed(1)}m – {(activeTrace.points?.[activeTrace.points.length - 1]?.x || toRd).toFixed(1)}m
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectTrace(null)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 space-y-3 text-xs max-h-[calc(100vh-160px)] overflow-y-auto">
            {/* 1. Joint Text & Label Editor (User requirement: delete and edit any texts inside the canvas) */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-blue-600" />
                  <span>Joint Canvas Text / Label</span>
                </span>
                {!isEditingLabel ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingLabel(true)}
                    className="text-[10.5px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit Text</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveLabelText}
                    className="text-[10.5px] font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>Done</span>
                  </button>
                )}
              </div>

              {isEditingLabel ? (
                <div className="space-y-1.5 pt-1">
                  <input
                    type="text"
                    value={labelTextDraft}
                    onChange={(e) => setLabelTextDraft(e.target.value)}
                    placeholder="Enter custom joint text (e.g. J1, Fault Splay)..."
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-blue-500"
                    autoFocus
                  />
                  <div className="flex items-center justify-between gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={handleDeleteText}
                      className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer"
                      title="Clear text so no label appears on canvas"
                    >
                      <Trash2 className="w-3 h-3 text-red-600" />
                      <span>Delete Text</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLabelTextDraft(activeTrace.setId);
                        onUpdateTrace({ ...activeTrace, customLabel: activeTrace.setId, hideLabel: false });
                        setIsEditingLabel(false);
                      }}
                      className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10.5px] font-semibold cursor-pointer"
                    >
                      Reset Default
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <span className="text-slate-500">Rendered Text:</span>
                  <span className={`font-bold font-mono ${activeTrace.hideLabel ? 'text-slate-400 italic' : 'text-slate-900'}`}>
                    {activeTrace.hideLabel ? '(Text Deleted / Hidden)' : (activeTrace.customLabel || activeTrace.setId)}
                  </span>
                </div>
              )}
            </div>

            {/* 2. Orientation Data: Strike & Dip */}
            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                  Dip Direction:
                </span>
                <div className="flex items-center gap-1">
                  <Compass className="w-4 h-4 text-orange-500 shrink-0" />
                  <span className="text-sm font-bold font-mono text-slate-900">
                    {activeTrace.dipDirectionDeg}°
                  </span>
                </div>
                <div className="flex items-center gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateTrace({
                        ...activeTrace,
                        dipDirectionDeg: (activeTrace.dipDirectionDeg - 5 + 360) % 360,
                        orientationLabel: `${(activeTrace.dipDirectionDeg - 5 + 360) % 360}°/${activeTrace.dipDeg}°`,
                      })
                    }
                    className="flex-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-700 hover:bg-slate-100 cursor-pointer text-center"
                  >
                    -5°
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateTrace({
                        ...activeTrace,
                        dipDirectionDeg: (activeTrace.dipDirectionDeg + 5) % 360,
                        orientationLabel: `${(activeTrace.dipDirectionDeg + 5) % 360}°/${activeTrace.dipDeg}°`,
                      })
                    }
                    className="flex-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-700 hover:bg-slate-100 cursor-pointer text-center"
                  >
                    +5°
                  </button>
                </div>
              </div>

              <div className="space-y-1 border-l border-slate-200 pl-2.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                  Dip Angle:
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold font-mono text-slate-900">
                    {activeTrace.dipDeg}°
                  </span>
                  <span className="text-[10px] text-slate-400 font-sans">
                    ({activeTrace.dipDeg > 60 ? 'Steep' : activeTrace.dipDeg > 30 ? 'Moderate' : 'Shallow'})
                  </span>
                </div>
                <div className="flex items-center gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateTrace({
                        ...activeTrace,
                        dipDeg: Math.max(0, activeTrace.dipDeg - 5),
                        orientationLabel: `${activeTrace.dipDirectionDeg}°/${Math.max(0, activeTrace.dipDeg - 5)}°`,
                      })
                    }
                    className="flex-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-700 hover:bg-slate-100 cursor-pointer text-center"
                  >
                    -5°
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateTrace({
                        ...activeTrace,
                        dipDeg: Math.min(90, activeTrace.dipDeg + 5),
                        orientationLabel: `${activeTrace.dipDirectionDeg}°/${Math.min(90, activeTrace.dipDeg + 5)}°`,
                      })
                    }
                    className="flex-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-700 hover:bg-slate-100 cursor-pointer text-center"
                  >
                    +5°
                  </button>
                </div>
              </div>
            </div>

            {/* 3. High-Precision 3D Plane & Tetrahedral Wedge Kinematics */}
            {activeInspection && (
              <div className="p-2.5 rounded-xl bg-slate-900 text-slate-100 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-sky-400">
                    High-Precision 3D Wedge &amp; Plane
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold ${
                      activeInspection.riskRating === 'CRITICAL'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                        : activeInspection.riskRating === 'MODERATE'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {activeInspection.kinematicMode.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[10.5px] font-mono">
                  <div className="bg-slate-950/80 p-1.5 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[9.5px]">FoS Before Support</span>
                    <strong
                      className={`text-xs ${
                        activeInspection.fosUnreinforced < 1.15 ? 'text-red-400' : 'text-amber-300'
                      }`}
                    >
                      {activeInspection.fosUnreinforced.toFixed(2)}
                    </strong>
                  </div>
                  <div className="bg-slate-950/80 p-1.5 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[9.5px]">FoS After Support</span>
                    <strong className="text-xs text-emerald-400">
                      {activeInspection.fosReinforced.toFixed(2)}
                    </strong>
                  </div>
                  <div className="bg-slate-950/80 p-1.5 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[9.5px]">Wedge Volume</span>
                    <strong className="text-white">{activeInspection.wedgeBlockVolumeM3} m³</strong>
                  </div>
                  <div className="bg-slate-950/80 p-1.5 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[9.5px]">Persistence Span</span>
                    <strong className="text-white">{activeInspection.persistenceLengthM} m</strong>
                  </div>
                </div>

                <div className="text-[10px] font-mono text-slate-300 space-y-0.5 pt-0.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">3D Plane Eq:</span>
                    <span className="text-sky-300">{activeInspection.planeEquationStr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Barton Friction φ_r:</span>
                    <span>
                      {activeInspection.bartonFrictionAngleDeg}° (JRC {activeInspection.jrc} / JCS {activeInspection.jcsMpa} MPa)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Zones Intersected:</span>
                    <span className="text-amber-300">{activeInspection.surfaceZones.join(', ')}</span>
                  </div>
                </div>

                {/* 1-Click Expand / Extend Joint Across Pulls */}
                <div className="pt-1.5 border-t border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block font-semibold">
                    Expand / Extend Joint Plane in 3D:
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTrace(
                          extendStripTraceAcrossPull(activeTrace, 'start', 1.0, totalPerimeterM, fromRd, toRd)
                        )
                      }
                      className="py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono font-bold text-sky-300 cursor-pointer"
                    >
                      -1.0m Start
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTrace(
                          extendStripTraceAcrossPull(activeTrace, 'end', 1.0, totalPerimeterM, fromRd, toRd)
                        )
                      }
                      className="py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono font-bold text-sky-300 cursor-pointer"
                    >
                      +1.0m End
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTrace(
                          extendStripTraceAcrossPull(activeTrace, 'full_span', 0, totalPerimeterM, fromRd, toRd)
                        )
                      }
                      className="py-1 px-1.5 rounded bg-sky-600 hover:bg-sky-500 text-[10px] font-mono font-bold text-white cursor-pointer"
                    >
                      Full Span
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Geological Properties & Infill */}
            <div className="space-y-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Joint Category:</span>
                <span className="font-semibold text-slate-800">{activeTrace.structureType || 'Joint Plane'}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Aperture / Infill:</span>
                <span className="font-semibold text-slate-800">{activeTrace.fillingThickness || 'Thin (< 1mm)'}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">3D Traced Points:</span>
                <span className="font-mono font-semibold text-slate-800">{activeTrace.points?.length || 0} vertices</span>
              </div>
            </div>

            {/* 5. Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              {onDeleteTrace && (
                <button
                  type="button"
                  onClick={() => onDeleteTrace(activeTrace.id)}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  <span>Delete Joint</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
