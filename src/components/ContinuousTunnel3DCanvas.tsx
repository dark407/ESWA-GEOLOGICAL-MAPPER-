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
} from '../engine/continuous3DStripEngine';

export interface ContinuousTunnel3DCanvasProps {
  dataset: ContinuousTunnelStripDataset;
  selectedTraceId: string | null;
  onSelectTrace: (traceId: string | null) => void;
  onUpdateTrace: (updatedTrace: ContinuousStripTrace) => void;
  onDeleteTrace?: (traceId: string) => void;
  className?: string;
}

/** Convert 2D unwrapped strip point (x = chainage, y = perimeter) to 3D Cartesian coordinates */
export function unrolledToTunnel3D(
  ch: number,
  yPerimeter: number,
  fromRd: number,
  toRd: number,
  leftWallHeight: number,
  crownWidth: number,
  rightWallHeight: number,
  tunnelWidth: number
): THREE.Vector3 {
  // Z axis along tunnel drive direction
  const z = ch - fromRd;
  const radius = tunnelWidth / 2;
  const totalPerimeter = leftWallHeight + crownWidth + rightWallHeight;

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
  const [showLithologyBands, setShowLithologyBands] = useState<boolean>(true);
  const [showChainageRings, setShowChainageRings] = useState<boolean>(true);
  const [show3DLabels, setShow3DLabels] = useState<boolean>(true);
  const [tunnelOpacity, setTunnelOpacity] = useState<number>(0.55);
  const [hoveredTraceId, setHoveredTraceId] = useState<string | null>(null);

  // Trace editing inside 3D Inspector
  const [isEditingLabel, setIsEditingLabel] = useState<boolean>(false);
  const [labelTextDraft, setLabelTextDraft] = useState<string>('');

  // Dimensions
  const fromRd = dataset.viewFromRd ?? 250;
  const toRd = dataset.viewToRd ?? 300;
  const totalLengthM = Math.max(1, toRd - fromRd);

  const leftWallHeight = dataset.leftWallHeightM || dataset.leftWallArcLengthM || 4.5;
  const crownWidth = dataset.crownWidthM || dataset.crownArcLengthM || 9.0;
  const rightWallHeight = dataset.rightWallHeightM || dataset.rightWallArcLengthM || 4.5;
  const tunnelWidth = dataset.tunnelDiameterWidthM || 10.0;

  // Selected trace object
  const activeTrace = useMemo(() => {
    return (dataset.traces || []).find((t) => t.id === selectedTraceId) || null;
  }, [dataset.traces, selectedTraceId]);

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

    const totalPerimeter = leftWallHeight + crownWidth + rightWallHeight;

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
          tunnelWidth
        );
        positions.push(pt.x, pt.y, pt.z);

        // Approximate normal pointing inwards / outwards
        const nx = yPerim > leftWallHeight && yPerim < leftWallHeight + crownWidth ? -pt.x : (pt.x > 0 ? -1 : 1);
        normals.push(nx, 0.5, 0);
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

    // 2. Chainage Steel Rib Rings & Tick Annotations every 5m
    if (showChainageRings) {
      for (let ch = Math.ceil(fromRd); ch <= toRd; ch += 5) {
        const ringPoints: THREE.Vector3[] = [];
        for (let i = 0; i <= 36; i++) {
          const yP = (i / 36) * totalPerimeter;
          ringPoints.push(
            unrolledToTunnel3D(ch, yP, fromRd, toRd, leftWallHeight, crownWidth, rightWallHeight, tunnelWidth)
          );
        }
        const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPoints);
        const ringMat = new THREE.LineBasicMaterial({
          color: 0xe2e8f0,
          linewidth: 1.5,
        });
        const ringLine = new THREE.Line(ringGeo, ringMat);
        ringLine.userData.isTunnelEntity = true;
        scene.add(ringLine);

        // Chainage Billboard Text Sprite at Crown
        const crownTop = unrolledToTunnel3D(
          ch,
          leftWallHeight + crownWidth / 2,
          fromRd,
          toRd,
          leftWallHeight,
          crownWidth,
          rightWallHeight,
          tunnelWidth
        );
        crownTop.y += 0.8;

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 26px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`CH ${ch.toFixed(1)}m`, 128, 32);

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

    // 3. Lithology Strata Zones in 3D
    if (showLithologyBands && dataset.lithologyZones) {
      dataset.lithologyZones.forEach((zone) => {
        if (!zone.polygon || zone.polygon.length < 3) return;
        const pts3D = zone.polygon.map((p) =>
          unrolledToTunnel3D(p.x, p.y, fromRd, toRd, leftWallHeight, crownWidth, rightWallHeight, tunnelWidth)
        );
        // Draw outline of lithology boundary
        const polyGeo = new THREE.BufferGeometry().setFromPoints([...pts3D, pts3D[0]]);
        const polyMat = new THREE.LineBasicMaterial({
          color: 0xd97706,
          linewidth: 2,
        });
        const polyLine = new THREE.Line(polyGeo, polyMat);
        polyLine.userData.isTunnelEntity = true;
        scene.add(polyLine);
      });
    }

    // 4. Render Discontinuity Joint Traces in 3D (Thick Tubes + Oriented Plane Discs)
    (dataset.traces || []).forEach((trace) => {
      const points = trace.points || [];
      if (points.length < 2) return;

      const isSelected = trace.id === selectedTraceId;
      const isHovered = trace.id === hoveredTraceId;
      const colorHex = resolveStripTraceColor(trace);
      const colorNum = parseInt(colorHex.replace('#', '0x'), 16) || 0x3b82f6;

      // Convert 2D points to 3D curve
      const pts3D = points.map((p) =>
        unrolledToTunnel3D(p.x, p.y, fromRd, toRd, leftWallHeight, crownWidth, rightWallHeight, tunnelWidth)
      );

      // Create a smooth 3D CatmullRom curve
      const curve = new THREE.CatmullRomCurve3(pts3D, false, 'chordal');
      const tubeRadius = isSelected ? 0.22 : isHovered ? 0.18 : 0.12;
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
      traceMeshesRef.current.push({ id: trace.id, mesh: tubeMesh });

      // Calculate centroid of trace in 3D
      const centroid3D = new THREE.Vector3();
      pts3D.forEach((p) => centroid3D.add(p));
      centroid3D.divideScalar(pts3D.length);

      // 5. Oriented Geological Plane Disc
      if (showJointPlanes) {
        const dipDirRad = (trace.dipDirectionDeg * Math.PI) / 180;
        const dipRad = (trace.dipDeg * Math.PI) / 180;

        // Normal vector of the joint plane
        const nx = Math.sin(dipRad) * Math.sin(dipDirRad);
        const ny = Math.cos(dipRad);
        const nz = Math.sin(dipRad) * Math.cos(dipDirRad);
        const normal = new THREE.Vector3(nx, ny, nz).normalize();

        const discRadius = Math.max(2.8, Math.hypot(pts3D[pts3D.length - 1].x - pts3D[0].x, pts3D[pts3D.length - 1].z - pts3D[0].z) * 0.7);
        const discGeo = new THREE.CircleGeometry(discRadius, 32);

        // Align circle normal (default +Z) to joint plane normal
        const defaultNormal = new THREE.Vector3(0, 0, 1);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(defaultNormal, normal);

        const discMat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0xf59e0b : colorNum,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: isSelected ? 0.55 : 0.28,
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

      // 6. 3D Billboard Text Label (Clean text, NO boxy cards)
      if (show3DLabels && !trace.hideLabel) {
        const labelText = trace.customLabel || trace.setId || 'J';
        const orientText = `${trace.dipDirectionDeg}°/${trace.dipDeg}°`;

        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Anti-alias shadow
          ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
          ctx.shadowBlur = 4;

          // Pure text, crisp styling without any box
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

            {/* 3. Geological Properties & Infill */}
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

            {/* 4. Action Buttons */}
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
