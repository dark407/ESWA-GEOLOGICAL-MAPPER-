// ============================================================================
// ESWA ADVANCED ANALYTICS — CAPABILITY 1: EXCAVATION-SPECIFIC 3D GEOLOGICAL LOGS
// Multi-Stage NATM (Full Face, Top Heading, Bench, Invert),
// Unwrapped Strip (s, Z) -> 3D Skin Coordinates (X, Y, Z), 3D Excavation Volume
// ============================================================================

import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import {
  Box,
  Layers,
  RotateCcw,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Info,
  CheckCircle2,
  Droplets,
  Zap,
} from 'lucide-react';
import {
  ExcavationStage,
  computeStageElevationBounds,
  unwrappedToSkin3D,
} from '../engine/advancedModelingAndAlignmentEngine';

export interface ExcavationSpecific3DLogViewportProps {
  spanW: number;
  heightH: number;
  benchHeight: number;
  zStart: number;
  zEnd: number;
  lithologyName?: string;
  driveAzimuth?: number;
}

export const ExcavationSpecific3DLogViewport: React.FC<ExcavationSpecific3DLogViewportProps> = ({
  spanW,
  heightH,
  benchHeight,
  zStart,
  zEnd,
  lithologyName = 'Quartzite / Gneiss Complex',
  driveAzimuth = 45,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [selectedStage, setSelectedStage] = useState<ExcavationStage>('TOP_HEADING');
  const [showWireframe, setShowWireframe] = useState<boolean>(true);
  const [showSkinContacts, setShowSkinContacts] = useState<boolean>(true);
  const [showWaterInflow, setShowWaterInflow] = useState<boolean>(true);
  const [cameraPreset, setCameraPreset] = useState<'ISOMETRIC' | 'FRONT_FACE' | 'PROFILE'>('ISOMETRIC');

  // Mouse orbit controls
  const isDraggingRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const orbitRef = useRef<{ theta: number; phi: number; radius: number }>({
    theta: 0.75,
    phi: 1.1,
    radius: 28,
  });

  const stageBounds = useMemo(() => {
    return computeStageElevationBounds(selectedStage, spanW, heightH, benchHeight, zStart, zEnd);
  }, [selectedStage, spanW, heightH, benchHeight, zStart, zEnd]);

  const updateCamera = () => {
    if (!cameraRef.current) return;
    const { theta, phi, radius } = orbitRef.current;
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi) + heightH * 0.5;
    const z = radius * Math.sin(phi) * Math.cos(theta);
    cameraRef.current.position.set(x, y, z);
    cameraRef.current.lookAt(0, heightH * 0.45, (zStart + zEnd) * 0.5);
  };

  useEffect(() => {
    if (cameraPreset === 'ISOMETRIC') {
      orbitRef.current = { theta: 0.75, phi: 1.1, radius: 28 };
    } else if (cameraPreset === 'FRONT_FACE') {
      orbitRef.current = { theta: 0.05, phi: 1.55, radius: 22 };
    } else if (cameraPreset === 'PROFILE') {
      orbitRef.current = { theta: Math.PI / 2, phi: 1.55, radius: 24 };
    }
    updateCamera();
  }, [cameraPreset, heightH, zStart, zEnd]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 600;
    const height = mount.clientHeight || 420;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1120); // deep slate/navy
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;
    updateCamera();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    // Lighting
    const ambLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambLight);

    const dirLight1 = new THREE.DirectionalLight(0x38bdf8, 1.2);
    dirLight1.position.set(20, 30, 20);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xf59e0b, 0.8);
    dirLight2.position.set(-20, 15, -15);
    scene.add(dirLight2);

    // Coordinate Grid at Invert Y = 0
    const grid = new THREE.GridHelper(30, 30, 0x0284c7, 0x1e293b);
    grid.position.set(0, 0, (zStart + zEnd) * 0.5);
    scene.add(grid);

    // BUILD 3D TUNNEL SHELL MESH ACCORDING TO STAGE ELEVATION BOUNDS
    const R = spanW / 2;
    const H_wall = Math.max(0.5, heightH - R);
    const halfArchP = (Math.PI * R) / 2;
    const totalP = 2 * (halfArchP + H_wall);

    const stepsPerim = 32;
    const stepsZ = 12;
    const zLen = Math.max(0.5, zEnd - zStart);

    const geom = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];

    // Filter perimeter samples by selected stage bounds
    const yMin = stageBounds.yMin;
    const yMax = stageBounds.yMax;

    // Build stage-specific 3D skin vertices
    for (let iz = 0; iz <= stepsZ; iz++) {
      const zVal = zStart + (zLen * iz) / stepsZ;
      for (let ip = 0; ip <= stepsPerim; ip++) {
        const sVal = -totalP * 0.5 + (totalP * ip) / stepsPerim;
        const pt = unwrappedToSkin3D(sVal, zVal, spanW, heightH);

        // Clamp or mark if inside stage elevation bounds
        const isInsideStage = pt.y >= yMin - 0.05 && pt.y <= yMax + 0.05;
        const finalY = Math.max(yMin, Math.min(yMax, pt.y));

        positions.push(pt.x, finalY, pt.z);

        // Stage-based color scheme
        if (selectedStage === 'TOP_HEADING') {
          // Amber / Gold arch
          colors.push(0.95, isInsideStage ? 0.72 : 0.25, 0.15);
        } else if (selectedStage === 'BENCH') {
          // Cyan / Sky lower walls
          colors.push(0.1, isInsideStage ? 0.75 : 0.2, 0.9);
        } else if (selectedStage === 'INVERT') {
          // Emerald invert base
          colors.push(0.15, isInsideStage ? 0.85 : 0.25, 0.45);
        } else {
          // Full face slate/violet
          colors.push(0.4, 0.6, 0.9);
        }

        uvs.push(ip / stepsPerim, iz / stepsZ);
      }
    }

    const indices: number[] = [];
    for (let iz = 0; iz < stepsZ; iz++) {
      for (let ip = 0; ip < stepsPerim; ip++) {
        const a = iz * (stepsPerim + 1) + ip;
        const b = (iz + 1) * (stepsPerim + 1) + ip;
        const c = (iz + 1) * (stepsPerim + 1) + (ip + 1);
        const d = iz * (stepsPerim + 1) + (ip + 1);

        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    geom.setIndex(indices);
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.82,
      roughness: 0.55,
      metalness: 0.15,
      wireframe: false,
    });

    const mesh = new THREE.Mesh(geom, mat);
    scene.add(mesh);

    if (showWireframe) {
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.35,
      });
      const wireMesh = new THREE.Mesh(geom, wireMat);
      scene.add(wireMesh);
    }

    // TOP HEADING TEMPORARY INVERT / FLOOR (at Y = H_bench)
    if (selectedStage === 'TOP_HEADING') {
      const floorGeom = new THREE.PlaneGeometry(spanW, zLen);
      floorGeom.rotateX(-Math.PI / 2);
      floorGeom.translate(0, benchHeight, (zStart + zEnd) * 0.5);
      const floorMat = new THREE.MeshStandardMaterial({
        color: 0xb45309,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
      });
      const floorMesh = new THREE.Mesh(floorGeom, floorMat);
      scene.add(floorMesh);

      // Temporary floor center strip
      const centerLineGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, benchHeight + 0.05, zStart),
        new THREE.Vector3(0, benchHeight + 0.05, zEnd),
      ]);
      const centerLineMat = new THREE.LineDashedMaterial({
        color: 0xfef08a,
        dashSize: 0.5,
        gapSize: 0.3,
      });
      const centerLine = new THREE.Line(centerLineGeom, centerLineMat);
      centerLine.computeLineDistances();
      scene.add(centerLine);
    }

    // FACE BULKHEAD AT zEnd
    const faceProfilePts: THREE.Vector2[] = [];
    const numFacePts = 24;
    for (let i = 0; i <= numFacePts; i++) {
      const sVal = -totalP * 0.5 + (totalP * i) / numFacePts;
      const pt = unwrappedToSkin3D(sVal, zEnd, spanW, heightH);
      const yVal = Math.max(yMin, Math.min(yMax, pt.y));
      faceProfilePts.push(new THREE.Vector2(pt.x, yVal));
    }
    // Close shape along datum
    faceProfilePts.push(new THREE.Vector2(spanW * 0.5, yMin));
    faceProfilePts.push(new THREE.Vector2(-spanW * 0.5, yMin));

    const faceShape = new THREE.Shape(faceProfilePts);
    const faceGeom = new THREE.ShapeGeometry(faceShape);
    faceGeom.translate(0, 0, zEnd);
    const faceMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      side: THREE.DoubleSide,
      roughness: 0.8,
    });
    const faceMesh = new THREE.Mesh(faceGeom, faceMat);
    scene.add(faceMesh);

    // LITHOLOGY CONTACT BANDS WRAPPING ACROSS SKIN
    if (showSkinContacts) {
      const contactCurvePts: THREE.Vector3[] = [];
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        const sVal = -totalP * 0.45 + totalP * 0.9 * t;
        const zVal = zStart + zLen * 0.2 + zLen * 0.6 * Math.sin(t * Math.PI);
        const pt = unwrappedToSkin3D(sVal, zVal, spanW, heightH);
        if (pt.y >= yMin && pt.y <= yMax) {
          contactCurvePts.push(new THREE.Vector3(pt.x * 1.02, pt.y, pt.z));
        }
      }
      if (contactCurvePts.length > 2) {
        const contactGeom = new THREE.BufferGeometry().setFromPoints(contactCurvePts);
        const contactLine = new THREE.Line(
          contactGeom,
          new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 3 })
        );
        scene.add(contactLine);
      }
    }

    // WATER INFLOW MARKERS (Droplets / Seepage points)
    if (showWaterInflow) {
      const dropGeom = new THREE.SphereGeometry(0.18, 8, 8);
      const dropMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0891b2,
        roughness: 0.2,
      });

      const drop1 = new THREE.Mesh(dropGeom, dropMat);
      drop1.position.set(-R * 0.85, Math.min(yMax - 0.5, benchHeight + 1.2), zStart + zLen * 0.4);
      scene.add(drop1);

      const drop2 = new THREE.Mesh(dropGeom, dropMat);
      drop2.position.set(R * 0.2, Math.min(yMax - 0.2, heightH - 0.6), zStart + zLen * 0.7);
      scene.add(drop2);
    }

    // Animation Loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Mouse Drag Handlers
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - prevMouseRef.current.x;
      const dy = e.clientY - prevMouseRef.current.y;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };

      orbitRef.current.theta -= dx * 0.008;
      orbitRef.current.phi = Math.max(0.15, Math.min(Math.PI - 0.15, orbitRef.current.phi - dy * 0.008));
      updateCamera();
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbitRef.current.radius = Math.max(8, Math.min(60, orbitRef.current.radius + e.deltaY * 0.02));
      updateCamera();
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('wheel', handleWheel, { passive: false });

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      dom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dom.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      geom.dispose();
      mat.dispose();
    };
  }, [
    spanW,
    heightH,
    benchHeight,
    zStart,
    zEnd,
    selectedStage,
    stageBounds,
    showWireframe,
    showSkinContacts,
    showWaterInflow,
  ]);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden font-sans text-slate-100">
      {/* HEADER & STAGE SELECTOR */}
      <div className="flex flex-wrap items-center justify-between px-3.5 py-2.5 bg-slate-950 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-amber-500/20 text-amber-400">
            <Box className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-mono font-bold text-xs text-white uppercase tracking-wider">
              Excavation-Specific 3D Geological Shell &amp; Volume
            </h3>
            <span className="text-[10px] text-slate-400">
              Unwrapped Strip (s, Z) ➔ 3D Skin Coordinates (X, Y, Z) · Round Pull {zStart}m ➔ {zEnd}m (L = {(zEnd - zStart).toFixed(1)}m)
            </span>
          </div>
        </div>

        {/* 4 STAGE BUTTONS */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          {(
            [
              { id: 'TOP_HEADING', label: 'Top Heading (TH)', desc: `Y: ${benchHeight.toFixed(1)}m ➔ ${heightH.toFixed(1)}m` },
              { id: 'BENCH', label: 'Bench (BN)', desc: `Y: 0.0m ➔ ${benchHeight.toFixed(1)}m` },
              { id: 'INVERT', label: 'Invert (INV)', desc: 'Concave floor' },
              { id: 'FULL_FACE', label: 'Full Face', desc: `Y: 0.0m ➔ ${heightH.toFixed(1)}m` },
            ] as { id: ExcavationStage; label: string; desc: string }[]
          ).map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStage(st.id)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                selectedStage === st.id
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
              title={st.desc}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* METRICS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-3.5 py-2 bg-slate-950/60 border-b border-slate-800/80 text-xs font-mono">
        <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
          <div className="text-[10px] text-slate-400">Stage Elevation Datum</div>
          <div className="text-amber-300 font-bold">
            Y ∈ [{stageBounds.yMin.toFixed(2)}m, {stageBounds.yMax.toFixed(2)}m]
          </div>
        </div>
        <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
          <div className="text-[10px] text-slate-400">Stage Cross Section Area</div>
          <div className="text-cyan-300 font-bold">A = {stageBounds.crossSectionArea} m²</div>
        </div>
        <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
          <div className="text-[10px] text-slate-400">Excavation Pull Volume (V)</div>
          <div className="text-emerald-300 font-bold">V_stage = {stageBounds.volume} m³</div>
        </div>
        <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
          <div className="text-[10px] text-slate-400">Heading Azimuth</div>
          <div className="text-slate-200 font-bold">N {Math.round(driveAzimuth)}° E</div>
        </div>
      </div>

      {/* 3D VIEWPORT CONTAINER */}
      <div className="relative flex-1 min-h-[360px] w-full overflow-hidden">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* OVERLAY CONTROLS */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10 font-mono text-[11px]">
          <div className="flex items-center gap-1 bg-slate-950/80 backdrop-blur border border-slate-700/80 p-1 rounded-lg">
            {(['ISOMETRIC', 'FRONT_FACE', 'PROFILE'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => setCameraPreset(preset)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                  cameraPreset === preset ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-slate-950/80 backdrop-blur border border-slate-700/80 px-2 py-1 rounded-lg">
            <label className="flex items-center gap-1 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={showWireframe}
                onChange={(e) => setShowWireframe(e.target.checked)}
                className="rounded accent-sky-500"
              />
              Grid
            </label>
            <label className="flex items-center gap-1 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={showSkinContacts}
                onChange={(e) => setShowSkinContacts(e.target.checked)}
                className="rounded accent-rose-500"
              />
              Contact Band
            </label>
            <label className="flex items-center gap-1 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={showWaterInflow}
                onChange={(e) => setShowWaterInflow(e.target.checked)}
                className="rounded accent-cyan-500"
              />
              Water
            </label>
          </div>
        </div>

        {/* BOTTOM HUD LEGEND */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-1.5 bg-slate-950/85 backdrop-blur border border-slate-800 rounded-lg text-[11px] font-mono z-10">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Top Heading Crown Arch (X = R·sin(s/R))
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" /> Bench Left/Right Wall (X = ±R)
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <span className="w-2.5 h-1 bg-rose-500 inline-block" /> Lithology Contact Trace
            </span>
          </div>
          <span className="text-slate-400 text-[10px]">
            Drag to Rotate · Scroll to Zoom
          </span>
        </div>
      </div>
    </div>
  );
};
