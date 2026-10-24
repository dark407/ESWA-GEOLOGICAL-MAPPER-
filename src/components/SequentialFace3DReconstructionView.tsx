// ============================================================================
// ESWA ADVANCED ANALYTICS — CAPABILITY 3: RECONSTRUCTING 3D GEOLOGY FROM FACE LOGS
// Triangulated 3D Contact Ribbons, Inferred True Dip/DipDir from Consecutive Shifts,
// and 3D Inverse Distance Weighting (IDW) Block/Voxel Interpolation (RMR, Q, GSI)
// ============================================================================

import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import {
  Layers,
  Box,
  Sliders,
  Maximize2,
  RotateCcw,
  Sparkles,
  Info,
  TrendingUp,
  Database,
  Eye,
} from 'lucide-react';
import {
  SequentialFaceLog,
  TriangulatedRibbonMesh,
  reconstruct3DGeologicalRibbons,
  interpolateIdwPoint,
} from '../engine/advancedModelingAndAlignmentEngine';

export interface SequentialFace3DReconstructionViewProps {
  faceLogs: SequentialFaceLog[];
  driveAzimuth?: number;
  spanW?: number;
  heightH?: number;
}

export const SequentialFace3DReconstructionView: React.FC<SequentialFace3DReconstructionViewProps> = ({
  faceLogs,
  driveAzimuth = 45,
  spanW = 8.4,
  heightH = 7.2,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [activePropertyMap, setActivePropertyMap] = useState<'RMR' | 'Q' | 'GSI'>('RMR');
  const [sliceChainage, setSliceChainage] = useState<number>(() => {
    return faceLogs && faceLogs.length > 0 ? faceLogs[Math.floor(faceLogs.length / 2)].chainageMeters : 100;
  });
  const [showVoxelGrid, setShowVoxelGrid] = useState<boolean>(true);
  const [showRibbonSurfaces, setShowRibbonSurfaces] = useState<boolean>(true);

  // Compute 3D triangulated ribbons between all consecutive face pairs
  const ribbons: TriangulatedRibbonMesh[] = useMemo(() => {
    if (!faceLogs || faceLogs.length < 2) return [];
    const allRibbons: TriangulatedRibbonMesh[] = [];
    for (let i = 0; i < faceLogs.length - 1; i++) {
      const segRibbons = reconstruct3DGeologicalRibbons(faceLogs[i], faceLogs[i + 1], driveAzimuth, 20);
      allRibbons.push(...segRibbons);
    }
    return allRibbons;
  }, [faceLogs, driveAzimuth]);

  // IDW value at current slice chainage
  const currentSliceProperty = useMemo(() => {
    return interpolateIdwPoint({ x: 0, y: heightH * 0.5, z: sliceChainage }, faceLogs);
  }, [sliceChainage, faceLogs, heightH]);

  // Camera Orbit controls
  const isDraggingRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const orbitRef = useRef<{ theta: number; phi: number; radius: number }>({
    theta: 0.8,
    phi: 1.15,
    radius: 32,
  });

  const updateCamera = () => {
    if (!cameraRef.current) return;
    const { theta, phi, radius } = orbitRef.current;
    const midZ = faceLogs.length > 0 ? (faceLogs[0].chainageMeters + faceLogs[faceLogs.length - 1].chainageMeters) * 0.5 : 100;
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi) + heightH * 0.5;
    const z = radius * Math.sin(phi) * Math.cos(theta) + midZ;
    cameraRef.current.position.set(x, y, z);
    cameraRef.current.lookAt(0, heightH * 0.45, midZ);
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 600;
    const height = mount.clientHeight || 420;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;
    updateCamera();

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    // Lights
    const amb = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0x38bdf8, 1.2);
    dir.position.set(15, 25, 20);
    scene.add(dir);

    const midZ = faceLogs.length > 0 ? (faceLogs[0].chainageMeters + faceLogs[faceLogs.length - 1].chainageMeters) * 0.5 : 100;
    const grid = new THREE.GridHelper(35, 35, 0x0284c7, 0x1e293b);
    grid.position.set(0, 0, midZ);
    scene.add(grid);

    // RENDER LOGGED 2D FACE PLANES AS 3D BULKHEAD FRAMES
    faceLogs.forEach((face, fIdx) => {
      const z = face.chainageMeters;
      // Outline frame
      const framePts: THREE.Vector3[] = [
        new THREE.Vector3(-spanW * 0.5, 0, z),
        new THREE.Vector3(-spanW * 0.5, heightH - spanW * 0.5, z),
        new THREE.Vector3(0, heightH, z),
        new THREE.Vector3(spanW * 0.5, heightH - spanW * 0.5, z),
        new THREE.Vector3(spanW * 0.5, 0, z),
        new THREE.Vector3(-spanW * 0.5, 0, z),
      ];
      const frameGeom = new THREE.BufferGeometry().setFromPoints(framePts);
      const frameMat = new THREE.LineBasicMaterial({
        color: fIdx === 0 ? 0x38bdf8 : fIdx === faceLogs.length - 1 ? 0xf59e0b : 0x94a3b8,
        linewidth: 2,
      });
      const frameLine = new THREE.Line(frameGeom, frameMat);
      scene.add(frameLine);

      // Contact lines on this face
      face.contacts.forEach((c) => {
        if (c.polyline && c.polyline.length > 1) {
          const cPts = c.polyline.map((p) => new THREE.Vector3(p.x, p.y, z));
          const cGeom = new THREE.BufferGeometry().setFromPoints(cPts);
          const cLine = new THREE.Line(cGeom, new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 3 }));
          scene.add(cLine);
        }
      });
    });

    // RENDER 3D TRIANGULATED RIBBON SURFACES BETWEEN CONSECUTIVE FACES
    if (showRibbonSurfaces) {
      ribbons.forEach((ribbon, rIdx) => {
        const ribbonGeom = new THREE.BufferGeometry();
        const pos: number[] = [];
        ribbon.vertices.forEach((v) => pos.push(v.x, v.y, v.z));
        ribbonGeom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        ribbonGeom.setIndex(ribbon.indices);
        ribbonGeom.computeVertexNormals();

        const ribbonMat = new THREE.MeshStandardMaterial({
          color: rIdx % 2 === 0 ? 0xf59e0b : 0xec4899,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.65,
          roughness: 0.6,
        });
        const ribbonMesh = new THREE.Mesh(ribbonGeom, ribbonMat);
        scene.add(ribbonMesh);

        // Wireframe overlay on ribbons
        const ribbonWire = new THREE.Mesh(
          ribbonGeom,
          new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.25 })
        );
        scene.add(ribbonWire);
      });
    }

    // RENDER 3D VOXEL / IDW BLOCK MODEL SAMPLES
    if (showVoxelGrid && faceLogs.length > 1) {
      const zMin = faceLogs[0].chainageMeters;
      const zMax = faceLogs[faceLogs.length - 1].chainageMeters;
      const voxelGroup = new THREE.Group();

      const numZ = 6;
      const numX = 5;
      const numY = 4;
      const boxSize = 0.55;
      const boxGeom = new THREE.BoxGeometry(boxSize, boxSize, boxSize);

      for (let iz = 0; iz < numZ; iz++) {
        const vz = zMin + ((zMax - zMin) * (iz + 0.5)) / numZ;
        for (let ix = 0; ix < numX; ix++) {
          const vx = -spanW * 0.4 + (spanW * 0.8 * ix) / (numX - 1);
          for (let iy = 0; iy < numY; iy++) {
            const vy = 1.0 + (heightH - 2.0) * (iy / (numY - 1));

            const val = interpolateIdwPoint({ x: vx, y: vy, z: vz }, faceLogs);
            let colorHex = 0x22c55e; // green (good)
            if (activePropertyMap === 'RMR') {
              colorHex = val.rmr >= 61 ? 0x22c55e : val.rmr >= 41 ? 0x0ea5e9 : val.rmr >= 21 ? 0xf59e0b : 0xef4444;
            } else if (activePropertyMap === 'Q') {
              colorHex = val.q >= 10 ? 0x22c55e : val.q >= 4 ? 0x0ea5e9 : val.q >= 1 ? 0xf59e0b : 0xef4444;
            } else {
              colorHex = val.gsi >= 60 ? 0x22c55e : val.gsi >= 45 ? 0x0ea5e9 : val.gsi >= 30 ? 0xf59e0b : 0xef4444;
            }

            const boxMat = new THREE.MeshStandardMaterial({
              color: colorHex,
              transparent: true,
              opacity: 0.5,
              roughness: 0.5,
            });
            const boxMesh = new THREE.Mesh(boxGeom, boxMat);
            boxMesh.position.set(vx, vy, vz);
            voxelGroup.add(boxMesh);
          }
        }
      }
      scene.add(voxelGroup);
    }

    // INTERACTIVE SLICE PLANE AT sliceChainage
    const sliceGeom = new THREE.PlaneGeometry(spanW * 1.2, heightH * 1.2);
    sliceGeom.translate(0, heightH * 0.5, sliceChainage);
    const sliceMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    });
    const sliceMesh = new THREE.Mesh(sliceGeom, sliceMat);
    scene.add(sliceMesh);

    // Render loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Mouse Controls
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
      orbitRef.current.radius = Math.max(8, Math.min(70, orbitRef.current.radius + e.deltaY * 0.02));
      updateCamera();
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      dom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dom.removeEventListener('wheel', handleWheel);
      renderer.dispose();
    };
  }, [faceLogs, ribbons, activePropertyMap, sliceChainage, showVoxelGrid, showRibbonSurfaces, spanW, heightH]);

  const minCh = faceLogs.length > 0 ? faceLogs[0].chainageMeters : 90;
  const maxCh = faceLogs.length > 0 ? faceLogs[faceLogs.length - 1].chainageMeters : 110;

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden font-sans text-slate-100">
      {/* HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Layers className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-mono font-bold text-sm text-white tracking-wide uppercase">
              3D Geology Reconstruction from Sequential Face Logs
            </h3>
            <p className="text-xs text-slate-400">
              Triangulated contact ribbon meshes &amp; 3D Inverse Distance Weighting (IDW w_i = 1/d_i²)
            </p>
          </div>
        </div>

        {/* PROPERTY SWITCHER (RMR, Q, GSI) */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 font-mono text-xs">
          {(['RMR', 'Q', 'GSI'] as const).map((prop) => (
            <button
              key={prop}
              onClick={() => setActivePropertyMap(prop)}
              className={`px-3 py-1 rounded font-bold transition-all cursor-pointer ${
                activePropertyMap === prop
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {prop} Block Heatmap
            </button>
          ))}
        </div>
      </div>

      {/* METRICS & SLICE SLIDER STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 px-4 py-2.5 bg-slate-950/70 border-b border-slate-800 text-xs font-mono items-center">
        <div className="sm:col-span-5 flex items-center gap-3">
          <span className="text-slate-400 text-[11px] whitespace-nowrap">Chainage Slice:</span>
          <input
            type="range"
            min={minCh}
            max={maxCh}
            step={0.5}
            value={sliceChainage}
            onChange={(e) => setSliceChainage(Number(e.target.value))}
            className="flex-1 accent-indigo-500 cursor-pointer"
          />
          <strong className="text-amber-300 w-16 text-right">RD {sliceChainage.toFixed(1)}m</strong>
        </div>

        <div className="sm:col-span-4 flex items-center gap-3 bg-slate-900/80 px-3 py-1.5 rounded border border-slate-800 justify-around">
          <div>
            <span className="text-slate-400 text-[10px] block">Interpolated RMR:</span>
            <strong className="text-emerald-400">{currentSliceProperty.rmr} / 100</strong>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] block">Barton Q:</span>
            <strong className="text-cyan-400">{currentSliceProperty.q}</strong>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] block">Hoek GSI:</span>
            <strong className="text-indigo-300">{currentSliceProperty.gsi}</strong>
          </div>
        </div>

        <div className="sm:col-span-3 flex items-center justify-end gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white text-[11px]">
            <input
              type="checkbox"
              checked={showVoxelGrid}
              onChange={(e) => setShowVoxelGrid(e.target.checked)}
              className="rounded accent-indigo-500"
            />
            3D Voxel Blocks
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white text-[11px]">
            <input
              type="checkbox"
              checked={showRibbonSurfaces}
              onChange={(e) => setShowRibbonSurfaces(e.target.checked)}
              className="rounded accent-amber-500"
            />
            Contact Ribbons
          </label>
        </div>
      </div>

      {/* 3D VIEWPORT CONTAINER */}
      <div className="relative flex-1 min-h-[380px] w-full overflow-hidden">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* INFERRED ATTITUDE OVERLAY */}
        {ribbons.length > 0 && (
          <div className="absolute top-3 right-3 bg-slate-950/85 backdrop-blur border border-slate-700 p-2.5 rounded-xl font-mono text-xs z-10 space-y-1.5 shadow-lg">
            <span className="font-bold text-amber-300 block text-[11px] uppercase tracking-wider">
              Inferred Discontinuity Attitudes:
            </span>
            {ribbons.map((rib, i) => (
              <div key={i} className="text-[11px] text-slate-300 border-b border-slate-800 pb-1">
                <span className="text-slate-400">{rib.contactName}:</span>{' '}
                <strong className="text-cyan-300">
                  Dip {rib.inferredDipDeg}° ∠ {rib.inferredDipDirDeg}°
                </strong>{' '}
                <span className="text-[10px] text-slate-400">
                  ({rib.fromChainage}m ➔ {rib.toChainage}m)
                </span>
              </div>
            ))}
          </div>
        )}

        {/* BOTTOM HUD LEGEND */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-1.5 bg-slate-950/85 backdrop-blur border border-slate-800 rounded-lg text-[11px] font-mono z-10">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2.5 h-2.5 bg-emerald-500 inline-block rounded-xs" /> Good Rock (RMR &gt; 60 / Q &gt; 10)
            </span>
            <span className="flex items-center gap-1 text-sky-400">
              <span className="w-2.5 h-2.5 bg-sky-500 inline-block rounded-xs" /> Fair Rock (RMR 41-60)
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2.5 h-2.5 bg-amber-500 inline-block rounded-xs" /> Poor Rock (RMR 21-40)
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <span className="w-2.5 h-2.5 bg-rose-500 inline-block rounded-xs" /> Very Poor (RMR &lt; 20)
            </span>
          </div>
          <span className="text-slate-400 text-[10px]">
            Sequential Face Logs: {faceLogs.length} Rounds Stitched
          </span>
        </div>
      </div>
    </div>
  );
};
