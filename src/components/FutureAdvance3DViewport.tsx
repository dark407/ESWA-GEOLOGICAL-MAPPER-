import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Play, Pause, RotateCcw, Eye, Layers } from 'lucide-react';
import { TunnelGeometry } from '../types/tunnel';

export interface FutureAdvance3DViewportProps {
  spanW: number;
  heightH: number;
  wallHeight?: number;
  geometry?: TunnelGeometry;
  pullLength: number;
  currentFaceChainage: number;
  driveAzimuth: number;
  governingStrike: number;
  governingDip: number;
  governingDipDirection: number;
  governingSet: string;
  governingType: string;
  apparentDipDeg: number;
  advanceRatePerVerticalMeter: number;
}

function getProfileOutline(
  spanW: number,
  heightH: number,
  wallHeight: number,
  geometry?: TunnelGeometry
): { x: number; y: number }[] {
  if (geometry?.crossSectionPoints && geometry.crossSectionPoints.length >= 4) {
    return geometry.crossSectionPoints;
  }
  const halfW = spanW / 2;
  const wallH = Math.min(wallHeight, heightH * 0.6);
  const archH = Math.max(0.5, heightH - wallH);
  const pts: { x: number; y: number }[] = [];
  pts.push({ x: -halfW, y: 0 });
  pts.push({ x: -halfW, y: wallH });
  const archSteps = 32;
  for (let i = 1; i < archSteps; i++) {
    const theta = Math.PI * (1 - i / archSteps);
    pts.push({
      x: halfW * Math.cos(theta),
      y: wallH + archH * Math.sin(theta),
    });
  }
  pts.push({ x: halfW, y: wallH });
  pts.push({ x: halfW, y: 0 });
  return pts;
}

export const FutureAdvance3DViewport: React.FC<FutureAdvance3DViewportProps> = ({
  spanW,
  heightH,
  wallHeight,
  geometry,
  pullLength,
  currentFaceChainage,
  driveAzimuth,
  governingStrike,
  governingDip,
  governingDipDirection,
  governingSet,
  governingType,
  apparentDipDeg,
  advanceRatePerVerticalMeter,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedAdvanceDist, setSelectedAdvanceDist] = useState<number>(Math.max(3, pullLength * 3));
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showAllRings, setShowAllRings] = useState<boolean>(true);
  const [showPlaneMesh, setShowPlaneMesh] = useState<boolean>(true);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setSelectedAdvanceDist((prev) => {
        if (prev >= 30) return 0;
        return Number((prev + 0.5).toFixed(1));
      });
    }, 60);
    return () => clearInterval(timer);
  }, [isPlaying]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 720;
    const height = container.clientHeight || 460;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060a12);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(spanW * 2.1, heightH * 1.65, 16);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, heightH * 0.45, -10);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;

    scene.add(new THREE.AmbientLight(0x94a3b8, 0.8));
    const dirLight = new THREE.DirectionalLight(0xf8fafc, 1.1);
    dirLight.position.set(22, 34, 18);
    scene.add(dirLight);

    const gridHelper = new THREE.GridHelper(60, 30, 0x1e293b, 0x0f172a);
    gridHelper.position.set(0, -0.05, -10);
    scene.add(gridHelper);

    const wallH = wallHeight || geometry?.wallHeight || heightH * 0.55;
    const profilePts = getProfileOutline(spanW, heightH, wallH, geometry);

    const tunnelShape = new THREE.Shape();
    profilePts.forEach((p, idx) => {
      if (idx === 0) tunnelShape.moveTo(p.x, p.y);
      else tunnelShape.lineTo(p.x, p.y);
    });
    tunnelShape.closePath();

    // 1. Excavated Tunnel Behind Active Face (Z = +10m to Z = 0m)
    const excavatedLen = 10;
    const excavatedGeo = new THREE.ExtrudeGeometry(tunnelShape, {
      steps: 5,
      depth: excavatedLen,
      bevelEnabled: false,
    });
    const excavatedMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.75,
      metalness: 0.15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
    });
    scene.add(new THREE.Mesh(excavatedGeo, excavatedMat));

    // 2. Future Unexcavated Corridor Ahead (Z = -30m to Z = 0m)
    const futureLen = 30;
    const futureGeo = new THREE.ExtrudeGeometry(tunnelShape, {
      steps: 15,
      depth: futureLen,
      bevelEnabled: false,
    });
    futureGeo.translate(0, 0, -futureLen);
    const futureMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.5,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.18,
      wireframe: true,
    });
    scene.add(new THREE.Mesh(futureGeo, futureMat));

    // 3. Future Blast Pull Rings (+3m to +30m)
    if (showAllRings) {
      const stepPull = Math.max(1.5, pullLength || 3.0);
      for (let d = 0; d <= 30; d += stepPull) {
        const ringVecs = profilePts.map((p) => new THREE.Vector3(p.x, p.y, -d));
        if (ringVecs.length > 0) ringVecs.push(ringVecs[0].clone());
        const ringGeo = new THREE.BufferGeometry().setFromPoints(ringVecs);
        const isCurrentFace = d === 0;
        const ringMat = new THREE.LineBasicMaterial({
          color: isCurrentFace ? 0x10b981 : 0x334155,
          transparent: true,
          opacity: isCurrentFace ? 0.95 : 0.55,
        });
        scene.add(new THREE.Line(ringGeo, ringMat));
      }
    }

    // 4. Active Probe Face Plane at Z = -selectedAdvanceDist
    const probeGeo = new THREE.ShapeGeometry(tunnelShape);
    const probeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
    });
    const probeMesh = new THREE.Mesh(probeGeo, probeMat);
    probeMesh.position.z = -selectedAdvanceDist;
    scene.add(probeMesh);

    const probeRingVecs = profilePts.map((p) => new THREE.Vector3(p.x, p.y, -selectedAdvanceDist));
    if (probeRingVecs.length > 0) probeRingVecs.push(probeRingVecs[0].clone());
    scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(probeRingVecs),
        new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 })
      )
    );

    // 5. 3D Governing Structural Discontinuity / Fault Plane
    const strikeRelRad = THREE.MathUtils.degToRad(governingStrike - driveAzimuth);
    const dipRad = THREE.MathUtils.degToRad(governingDip);
    const isFault = governingType.toLowerCase().includes('fault') || governingType.toLowerCase().includes('shear');
    const planeColor = isFault ? 0xef4444 : 0xf59e0b;

    if (showPlaneMesh) {
      const planeGroup = new THREE.Group();
      const planeGeo = new THREE.PlaneGeometry(spanW * 2.5, 42, 18, 18);
      const planeMat = new THREE.MeshStandardMaterial({
        color: planeColor,
        roughness: 0.35,
        metalness: 0.1,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
      });
      const planeMesh = new THREE.Mesh(planeGeo, planeMat);
      planeMesh.rotation.order = 'YXZ';
      planeMesh.rotation.y = -strikeRelRad;
      planeMesh.rotation.x = Math.PI / 2 - dipRad;
      planeGroup.add(planeMesh);

      const planeWire = new THREE.LineSegments(
        new THREE.EdgesGeometry(planeGeo),
        new THREE.LineBasicMaterial({ color: planeColor, transparent: true, opacity: 0.9 })
      );
      planeWire.rotation.copy(planeMesh.rotation);
      planeGroup.add(planeWire);

      planeGroup.position.set(0, heightH, 0);
      scene.add(planeGroup);
    }

    // 6. Trace Line on Active Probe Face
    const tanApp = Math.tan(THREE.MathUtils.degToRad(apparentDipDeg));
    const traceYCenter = heightH - selectedAdvanceDist * tanApp;
    if (traceYCenter >= -1.0 && traceYCenter <= heightH + 1.0) {
      const clampedY = Math.max(0.1, Math.min(heightH - 0.1, traceYCenter));
      const halfW = spanW / 2;
      const tiltY = Math.sin(strikeRelRad) * 1.1;
      const traceGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-halfW * 0.92, Math.max(0.1, Math.min(heightH - 0.1, clampedY - tiltY)), -selectedAdvanceDist + 0.04),
        new THREE.Vector3(halfW * 0.92, Math.max(0.1, Math.min(heightH - 0.1, clampedY + tiltY)), -selectedAdvanceDist + 0.04),
      ]);
      scene.add(
        new THREE.Line(
          traceGeo,
          new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 })
        )
      );
    }

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 720;
      const h = container.clientHeight || 460;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [
    spanW,
    heightH,
    wallHeight,
    geometry,
    pullLength,
    driveAzimuth,
    governingStrike,
    governingDip,
    governingDipDirection,
    governingType,
    apparentDipDeg,
    selectedAdvanceDist,
    showAllRings,
    showPlaneMesh,
  ]);

  const tanApp = Math.tan((apparentDipDeg * Math.PI) / 180);
  const traceElevAtProbe = heightH - selectedAdvanceDist * tanApp;
  const isIntersectingFace = traceElevAtProbe >= 0 && traceElevAtProbe <= heightH;

  return (
    <div className="relative w-full h-full min-h-[440px] rounded-lg overflow-hidden border border-slate-800 bg-[#060a12] flex flex-col">
      {/* Top CAD Viewport Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900/95 border-b border-slate-800 z-10">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/40 text-[10px] font-mono font-bold text-sky-300 uppercase">
            PROBE: RD {(currentFaceChainage + selectedAdvanceDist).toFixed(1)}m (+{selectedAdvanceDist.toFixed(1)}m)
          </span>
          <span className="text-[11px] font-mono text-slate-400 tabular-nums">
            Plane: <strong className="text-slate-200">{governingSet} ({governingType})</strong> | α_app = <strong className="text-amber-300">{apparentDipDeg.toFixed(1)}°</strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border transition flex items-center gap-1 ${
              isPlaying
                ? 'bg-amber-600 text-white border-amber-400'
                : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400'
            }`}
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isPlaying ? 'Pause Probe' : 'Sweep +30m'}
          </button>
          <button
            onClick={() => {
              setIsPlaying(false);
              setSelectedAdvanceDist(0);
            }}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Reset to Current Face (0m)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowPlaneMesh(!showPlaneMesh)}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition flex items-center gap-1 ${
              showPlaneMesh
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Layers className="w-3 h-3" /> 3D Plane
          </button>
          <button
            onClick={() => setShowAllRings(!showAllRings)}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition flex items-center gap-1 ${
              showAllRings
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Eye className="w-3 h-3" /> Pull Rings
          </button>
        </div>
      </div>

      {/* Advance Distance Scrubber Bar */}
      <div className="px-3 py-1.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center gap-3 z-10">
        <span className="text-[10px] font-mono text-slate-400 uppercase shrink-0">Advance Distance (+m):</span>
        <input
          type="range"
          min={0}
          max={30}
          step={0.5}
          value={selectedAdvanceDist}
          onChange={(e) => {
            setIsPlaying(false);
            setSelectedAdvanceDist(Number(e.target.value));
          }}
          className="flex-1 accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
        />
        <span className="text-[11px] font-mono font-bold text-sky-300 tabular-nums w-14 text-right">
          +{selectedAdvanceDist.toFixed(1)}m
        </span>
      </div>

      {/* 3D Canvas Container */}
      <div ref={containerRef} className="w-full flex-1 min-h-[360px] cursor-grab active:cursor-grabbing" />

      {/* Bottom Engineering Readout */}
      <div className="px-3 py-1.5 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400 tabular-nums">
        <div>
          TRACE ELEVATION AT PROBE: {' '}
          <span className={isIntersectingFace ? 'text-emerald-400 font-bold' : 'text-slate-500 font-bold'}>
            {isIntersectingFace ? `${traceElevAtProbe.toFixed(2)}m above invert` : 'Exited Tunnel Profile'}
          </span>
        </div>
        <div>
          ADVANCE PER 1m VERTICAL DROP: <span className="text-sky-300 font-bold">{advanceRatePerVerticalMeter.toFixed(2)}m / m</span>
        </div>
      </div>
    </div>
  );
};
