import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  ExcavationStageType,
  computeStageElevationBounds,
} from '../engine/advancedModelingAndAlignmentEngine';
import { TunnelGeometry } from '../types/tunnel';
import { RotateCcw, Eye, Layers, Compass } from 'lucide-react';

export interface Mapped3DTraceItem {
  id: string;
  set: string;
  dip: number;
  dipDirection: number;
  strike?: number;
  type?: string;
}

interface ExcavationSpecific3DLogViewportProps {
  spanW: number;
  heightH: number;
  benchHeight: number;
  crownRadius: number;
  pullLength: number;
  activeStage: ExcavationStageType;
  geometry?: TunnelGeometry;
  driveAzimuth?: number;
  mappedTraces?: Mapped3DTraceItem[];
  onStageSelect?: (stage: ExcavationStageType) => void;
}

function getProfilePerimeterPoints(
  spanW: number,
  heightH: number,
  benchHeight: number,
  geometry?: TunnelGeometry
): { x: number; z: number }[] {
  if (geometry?.crossSectionPoints && geometry.crossSectionPoints.length >= 4) {
    return geometry.crossSectionPoints.map((pt) => ({ x: pt.x, z: pt.y }));
  }
  const halfW = spanW / 2;
  const wallH = Math.min(benchHeight, heightH * 0.6);
  const archH = Math.max(0.5, heightH - wallH);
  const pts: { x: number; z: number }[] = [];
  const wallSteps = 12;
  for (let i = 0; i <= wallSteps; i++) {
    pts.push({ x: -halfW, z: (i / wallSteps) * wallH });
  }
  const archSteps = 32;
  for (let i = 1; i < archSteps; i++) {
    const theta = Math.PI * (1 - i / archSteps);
    pts.push({
      x: halfW * Math.cos(theta),
      z: wallH + archH * Math.sin(theta),
    });
  }
  for (let i = wallSteps; i >= 0; i--) {
    pts.push({ x: halfW, z: (i / wallSteps) * wallH });
  }
  const invSteps = 12;
  for (let i = 1; i < invSteps; i++) {
    const t = i / invSteps;
    pts.push({
      x: halfW * (1 - 2 * t),
      z: -0.12 * heightH * Math.sin(t * Math.PI),
    });
  }
  return pts;
}

export const ExcavationSpecific3DLogViewport: React.FC<ExcavationSpecific3DLogViewportProps> = ({
  spanW,
  heightH,
  benchHeight,
  crownRadius,
  pullLength,
  activeStage,
  geometry,
  driveAzimuth = 45,
  mappedTraces = [],
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [wireframe, setWireframe] = useState(false);
  const [showTraces, setShowTraces] = useState(true);
  const [showGhostFullProfile, setShowGhostFullProfile] = useState(true);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const bounds = computeStageElevationBounds(activeStage, spanW, heightH, benchHeight, 0, pullLength);
  const profileLabel = (geometry?.crownGeometry || 'D-Shaped').replace(/_/g, ' ').toUpperCase();

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 720;
    const height = container.clientHeight || 480;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060a12);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(spanW * 1.45, pullLength * 0.95, heightH * 1.75);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, heightH * 0.42, -pullLength * 0.5);
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    const dirLight1 = new THREE.DirectionalLight(0x38bdf8, 1.0);
    dirLight1.position.set(18, 28, 22);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xf59e0b, 0.45);
    dirLight2.position.set(-18, -10, -15);
    scene.add(dirLight2);

    // CAD Floor Reference Grid
    const grid = new THREE.GridHelper(32, 32, 0x1e293b, 0x0f172a);
    grid.position.y = -Math.abs(bounds.yMin) - 0.15;
    scene.add(grid);

    const perimeterPts = getProfilePerimeterPoints(spanW, heightH, benchHeight, geometry);
    const segY = 24;

    // 1. Ghost Full Profile (CAD reference frame)
    if (showGhostFullProfile && activeStage !== 'FULL_FACE') {
      const ghostLoopPts = perimeterPts.map((p) => new THREE.Vector3(p.x, p.z, 0));
      ghostLoopPts.push(ghostLoopPts[0].clone());
      const ghostGeo = new THREE.BufferGeometry().setFromPoints(ghostLoopPts);
      const ghostMat = new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.45 });
      for (const zPos of [0, -pullLength * 0.5, -pullLength]) {
        const ring = new THREE.Line(ghostGeo, ghostMat);
        ring.position.z = zPos;
        scene.add(ring);
      }
    }

    // 2. Active Stage Filtered Profile Extrusion
    const stagePts = perimeterPts.filter((p) => p.z >= bounds.yMin - 0.08 && p.z <= bounds.yMax + 0.08);
    const activePts = stagePts.length >= 3 ? stagePts : perimeterPts;

    const vertices: number[] = [];
    const indices: number[] = [];
    const nPts = activePts.length;
    const closeLoop = activeStage === 'FULL_FACE';

    for (let j = 0; j <= segY; j++) {
      const zAxial = -(j / segY) * pullLength;
      for (let i = 0; i < nPts; i++) {
        vertices.push(activePts[i].x, activePts[i].z, zAxial);
      }
    }

    for (let j = 0; j < segY; j++) {
      for (let i = 0; i < (closeLoop ? nPts : nPts - 1); i++) {
        const nextI = (i + 1) % nPts;
        const a = j * nPts + i;
        const b = j * nPts + nextI;
        const c = (j + 1) * nPts + i;
        const d = (j + 1) * nPts + nextI;
        indices.push(a, b, d);
        indices.push(a, d, c);
      }
    }

    const skinGeo = new THREE.BufferGeometry();
    skinGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    skinGeo.setIndex(indices);
    skinGeo.computeVertexNormals();

    const stageColor =
      activeStage === 'TOP_HEADING'
        ? 0x0ea5e9
        : activeStage === 'BENCH'
        ? 0xf59e0b
        : activeStage === 'INVERT'
        ? 0x10b981
        : 0x3b82f6;

    const skinMat = new THREE.MeshStandardMaterial({
      color: stageColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: wireframe ? 0.16 : 0.42,
      wireframe,
      roughness: 0.45,
      metalness: 0.2,
    });
    scene.add(new THREE.Mesh(skinGeo, skinMat));

    // 3. CAD Station Rings every 1.0m along pull length
    const numStationRings = Math.max(2, Math.round(pullLength));
    for (let r = 0; r <= numStationRings; r++) {
      const zPos = -(r / numStationRings) * pullLength;
      const isEndRing = r === 0 || r === numStationRings;
      const ringVecs = activePts.map((p) => new THREE.Vector3(p.x, p.z, zPos));
      if (closeLoop && ringVecs.length > 0) ringVecs.push(ringVecs[0].clone());
      const ringGeo = new THREE.BufferGeometry().setFromPoints(ringVecs);
      const ringMat = new THREE.LineBasicMaterial({
        color: isEndRing ? 0x38bdf8 : 0x1e293b,
        transparent: true,
        opacity: isEndRing ? 0.95 : 0.55,
      });
      scene.add(new THREE.Line(ringGeo, ringMat));
    }

    // 4. Stage Horizon Cut Planes (Springline / Bench Floor)
    if (activeStage !== 'FULL_FACE') {
      const cutY = activeStage === 'TOP_HEADING' ? bounds.yMin : bounds.yMax;
      const cutPlaneGeo = new THREE.PlaneGeometry(spanW * 1.08, pullLength);
      const cutPlaneMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.12,
      });
      const cutMesh = new THREE.Mesh(cutPlaneGeo, cutPlaneMat);
      cutMesh.rotation.x = Math.PI / 2;
      cutMesh.position.set(0, cutY, -pullLength * 0.5);
      scene.add(cutMesh);
    }

    // 5. Real Mapped Discontinuity / Fault Planes Intersecting the 3D Shell
    if (showTraces && mappedTraces.length > 0) {
      const palette = [0xef4444, 0xf59e0b, 0x10b981, 0xa855f7, 0xec4899, 0x38bdf8];
      mappedTraces.slice(0, 8).forEach((tr, idx) => {
        const dipRad = THREE.MathUtils.degToRad(tr.dip);
        const relStrikeDeg = (tr.dipDirection - 90 - driveAzimuth + 360) % 360;
        const strikeRad = THREE.MathUtils.degToRad(relStrikeDeg);

        const planeSize = Math.max(spanW, heightH, pullLength) * 1.15;
        const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize, 12, 12);
        const colorHex = palette[idx % palette.length];

        const planeMat = new THREE.MeshStandardMaterial({
          color: colorHex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.28,
          roughness: 0.3,
        });
        const planeMesh = new THREE.Mesh(planeGeo, planeMat);
        const zOffset = -pullLength * ((idx + 1) / (Math.min(mappedTraces.length, 8) + 1));
        planeMesh.position.set(0, (bounds.yMin + bounds.yMax) * 0.5, zOffset);
        planeMesh.rotation.order = 'YXZ';
        planeMesh.rotation.y = -strikeRad;
        planeMesh.rotation.x = Math.PI / 2 - dipRad;
        scene.add(planeMesh);

        const edgesGeo = new THREE.EdgesGeometry(planeGeo);
        const edgesMat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.9 });
        const edgesLine = new THREE.LineSegments(edgesGeo, edgesMat);
        edgesLine.position.copy(planeMesh.position);
        edgesLine.rotation.copy(planeMesh.rotation);
        scene.add(edgesLine);
      });
    }

    let reqId: number;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 720;
      const h = container.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [spanW, heightH, benchHeight, crownRadius, pullLength, activeStage, geometry, driveAzimuth, mappedTraces, wireframe, showTraces, showGhostFullProfile, bounds.yMin, bounds.yMax]);

  const setPresetCamera = (preset: 'ISO' | 'FACE' | 'CROWN' | 'RIGHT_WALL') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    const targetY = (bounds.yMin + bounds.yMax) * 0.5;
    const targetZ = -pullLength * 0.5;

    if (preset === 'ISO') {
      cam.position.set(spanW * 1.45, heightH * 1.35, pullLength * 0.85);
    } else if (preset === 'FACE') {
      cam.position.set(0, targetY, pullLength * 1.5);
    } else if (preset === 'CROWN') {
      cam.position.set(0, heightH * 2.4, targetZ);
    } else if (preset === 'RIGHT_WALL') {
      cam.position.set(spanW * 2.2, targetY, targetZ);
    }
    ctrl.target.set(0, targetY, targetZ);
    ctrl.update();
  };

  return (
    <div className="relative w-full h-full min-h-[440px] bg-[#060a12] rounded-lg overflow-hidden border border-slate-800 flex flex-col">
      {/* Top CAD Viewport Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900/95 border-b border-slate-800 z-10">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/40 text-[10px] font-mono font-bold text-sky-300 uppercase">
            STAGE: {activeStage.replace(/_/g, ' ')}
          </span>
          <span className="text-[11px] font-mono text-slate-400 tabular-nums">
            Profile: <strong className="text-slate-200">{profileLabel}</strong> ({spanW.toFixed(2)}m × {heightH.toFixed(2)}m)
          </span>
          <span className="text-[11px] font-mono text-slate-400 tabular-nums hidden sm:inline">
            | Elev Y: <strong className="text-emerald-400">{bounds.yMin.toFixed(2)}m → {bounds.yMax.toFixed(2)}m</strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {(['ISO', 'FACE', 'CROWN', 'RIGHT_WALL'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setPresetCamera(view)}
              className="px-2 py-1 rounded text-[10px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              {view.replace('_', ' ')}
            </button>
          ))}
          <button
            onClick={() => setShowTraces(!showTraces)}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition flex items-center gap-1 ${
              showTraces
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Compass className="w-3 h-3" /> Planes ({mappedTraces.length})
          </button>
          <button
            onClick={() => setShowGhostFullProfile(!showGhostFullProfile)}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition flex items-center gap-1 ${
              showGhostFullProfile
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Layers className="w-3 h-3" /> Datum Frame
          </button>
          <button
            onClick={() => setWireframe(!wireframe)}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition flex items-center gap-1 ${
              wireframe
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Eye className="w-3 h-3" /> Mesh
          </button>
          <button
            onClick={() => setPresetCamera('ISO')}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Reset 3D View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3D Canvas Container */}
      <div ref={mountRef} className="w-full flex-1 min-h-[390px] cursor-grab active:cursor-grabbing" />

      {/* Bottom Engineering Scale & Coordinate Legend */}
      <div className="px-3 py-1.5 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400 tabular-nums">
        <div>
          PULL LENGTH L = <span className="text-slate-200 font-bold">{pullLength.toFixed(2)}m</span> | STATION RINGS: 1.0m INTERVAL
        </div>
        <div>
          MAPPED STRUCTURAL PLANES ON SHELL: <span className="text-emerald-400 font-bold">{mappedTraces.length}</span>
        </div>
      </div>
    </div>
  );
};
