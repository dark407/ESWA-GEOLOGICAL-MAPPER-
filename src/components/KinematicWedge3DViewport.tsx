import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Play, RotateCcw, Shield, Layers, Eye, AlertTriangle } from 'lucide-react';
import { TunnelGeometry } from '../types/tunnel';

export interface KinematicWedge3DViewportProps {
  spanW: number;
  heightH: number;
  wallHeight?: number;
  geometry?: TunnelGeometry;
  wedgeVolumeM3: number;
  wedgeWeightKn: number;
  apexHeightM: number;
  fosUnbolted: number;
  fosBolted: number;
  boltLengthM: number;
  boltSpacingM: number;
  governingStrike: number;
  governingDip: number;
  governingDipDirection?: number;
  driveAzimuth?: number;
  failureMode: 'ROOF_FALL' | 'SLIDING_J1' | 'SLIDING_J2' | 'STABLE';
}

function getExactProfileOutline(
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

export const KinematicWedge3DViewport: React.FC<KinematicWedge3DViewportProps> = ({
  spanW,
  heightH,
  wallHeight,
  geometry,
  wedgeVolumeM3,
  wedgeWeightKn,
  apexHeightM,
  fosUnbolted,
  fosBolted,
  boltLengthM,
  boltSpacingM,
  governingStrike,
  governingDip,
  driveAzimuth = 45,
  failureMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showBolts, setShowBolts] = useState(true);
  const [showBoundingPlanes, setShowBoundingPlanes] = useState(true);
  const [wireframeTunnel, setWireframeTunnel] = useState(false);
  const [detachSimulation, setDetachSimulation] = useState(false);

  const detachProgressRef = useRef(0);
  const wedgeGroupRef = useRef<THREE.Group | null>(null);

  const effectiveFoS = showBolts ? fosBolted : fosUnbolted;
  const isUnstable = effectiveFoS < 1.0;
  const isMarginal = effectiveFoS >= 1.0 && effectiveFoS < 1.5;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 720;
    const height = container.clientHeight || 460;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060a12);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
    camera.position.set(spanW * 1.15, heightH * 0.9, spanW * 1.65);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, heightH * 0.62, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;

    scene.add(new THREE.AmbientLight(0x94a3b8, 0.85));
    const dirLight = new THREE.DirectionalLight(0xf8fafc, 1.15);
    dirLight.position.set(15, 25, 20);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    fillLight.position.set(-15, -5, -15);
    scene.add(fillLight);

    const gridHelper = new THREE.GridHelper(32, 32, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -0.05;
    scene.add(gridHelper);

    const wallH = wallHeight || geometry?.wallHeight || heightH * 0.55;
    const profilePts = getExactProfileOutline(spanW, heightH, wallH, geometry);
    const tunnelLength = 14;

    // 1. Exact Tunnel Profile Extrusion
    const tunnelShape = new THREE.Shape();
    profilePts.forEach((p, idx) => {
      if (idx === 0) tunnelShape.moveTo(p.x, p.y);
      else tunnelShape.lineTo(p.x, p.y);
    });
    tunnelShape.closePath();

    const extrudeGeo = new THREE.ExtrudeGeometry(tunnelShape, {
      steps: 14,
      depth: tunnelLength,
      bevelEnabled: false,
    });
    extrudeGeo.translate(0, 0, -tunnelLength / 2);

    const tunnelMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.75,
      metalness: 0.15,
      side: THREE.BackSide,
      transparent: true,
      opacity: wireframeTunnel ? 0.15 : 0.48,
      wireframe: wireframeTunnel,
    });
    scene.add(new THREE.Mesh(extrudeGeo, tunnelMat));

    // CAD Profile Station Rings
    for (let z = -tunnelLength / 2; z <= tunnelLength / 2; z += 2.0) {
      const ringVecs = profilePts.map((p) => new THREE.Vector3(p.x, p.y, z));
      if (ringVecs.length > 0) ringVecs.push(ringVecs[0].clone());
      const ringGeo = new THREE.BufferGeometry().setFromPoints(ringVecs);
      const isFaceRing = Math.abs(z - tunnelLength / 2) < 0.01;
      const ringMat = new THREE.LineBasicMaterial({
        color: isFaceRing ? 0x38bdf8 : 0x334155,
        transparent: true,
        opacity: isFaceRing ? 0.95 : 0.5,
      });
      scene.add(new THREE.Line(ringGeo, ringMat));
    }

    // 2. 3D Tetrahedral Wedge at Crown / Haunch
    const wedgeGroup = new THREE.Group();
    wedgeGroupRef.current = wedgeGroup;

    const baseHalfSpan = Math.min(spanW * 0.34, Math.max(0.8, Math.cbrt(Math.max(0.2, wedgeVolumeM3)) * 0.72));
    const baseHalfLen = Math.min(4.2, Math.max(1.0, baseHalfSpan * 1.25));
    const clampedApex = Math.min(4.5, Math.max(0.45, apexHeightM));

    const relSkewRad = THREE.MathUtils.degToRad((governingStrike - driveAzimuth + 360) % 180);
    const skewX = Math.sin(relSkewRad) * 0.45;

    const v0 = new THREE.Vector3(skewX, heightH + clampedApex, 0); // Apex inside rock mass
    const v1 = new THREE.Vector3(-baseHalfSpan, heightH - 0.3, -baseHalfLen);
    const v2 = new THREE.Vector3(baseHalfSpan, heightH - 0.3, -baseHalfLen * 0.65);
    const v3 = new THREE.Vector3(0, heightH - 0.15, baseHalfLen);

    const wedgeGeo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z,
      v0.x, v0.y, v0.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z,
      v0.x, v0.y, v0.z, v3.x, v3.y, v3.z, v1.x, v1.y, v1.z,
      v1.x, v1.y, v1.z, v3.x, v3.y, v3.z, v2.x, v2.y, v2.z,
    ]);
    wedgeGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    wedgeGeo.computeVertexNormals();

    const wedgeColor = isUnstable ? 0xef4444 : isMarginal ? 0xf59e0b : 0x10b981;
    const wedgeMat = new THREE.MeshStandardMaterial({
      color: wedgeColor,
      roughness: 0.35,
      metalness: 0.15,
      transparent: true,
      opacity: 0.86,
      side: THREE.DoubleSide,
    });
    const wedgeMesh = new THREE.Mesh(wedgeGeo, wedgeMat);
    wedgeGroup.add(wedgeMesh);

    const wedgeEdges = new THREE.EdgesGeometry(wedgeGeo);
    wedgeGroup.add(
      new THREE.LineSegments(
        wedgeEdges,
        new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 })
      )
    );

    // Gravity Resultant Vector Arrow
    const arrowOrigin = new THREE.Vector3(0, heightH - 0.15, 0);
    const arrowHelper = new THREE.ArrowHelper(
      new THREE.Vector3(0, -1, 0),
      arrowOrigin,
      Math.min(2.4, Math.max(1.1, wedgeWeightKn / 220)),
      wedgeColor,
      0.4,
      0.26
    );
    wedgeGroup.add(arrowHelper);
    scene.add(wedgeGroup);

    // 3. Bounding Discontinuity Planes (J1, J2) oriented by real strike/dip
    if (showBoundingPlanes) {
      const dipRad = THREE.MathUtils.degToRad(governingDip || 60);
      const planeSize = Math.max(spanW, heightH) * 0.9;
      const pGeo = new THREE.PlaneGeometry(planeSize, planeSize);

      const p1Mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
      });
      const p1 = new THREE.Mesh(pGeo, p1Mat);
      p1.position.set(-baseHalfSpan * 0.45, heightH + clampedApex * 0.35, 0);
      p1.rotation.z = -dipRad;
      p1.rotation.y = relSkewRad * 0.35;
      scene.add(p1);

      const p2Mat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
      });
      const p2 = new THREE.Mesh(pGeo, p2Mat);
      p2.position.set(baseHalfSpan * 0.45, heightH + clampedApex * 0.35, 0);
      p2.rotation.z = dipRad;
      p2.rotation.y = -relSkewRad * 0.35;
      scene.add(p2);
    }

    // 4. Radial Pattern Rockbolts Normal to True Crown Perimeter
    if (showBolts) {
      const boltGroup = new THREE.Group();
      const boltMat = new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        metalness: 0.7,
        roughness: 0.2,
        emissive: 0x0891b2,
        emissiveIntensity: 0.35,
      });
      const plateMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.25 });

      const crownPts = profilePts.filter((p) => p.y >= wallH * 0.75);
      const stepIdx = Math.max(1, Math.floor(crownPts.length / Math.max(3, Math.round(spanW / boltSpacingM))));
      const sampledCrownPts = crownPts.filter((_, idx) => idx % stepIdx === 0);

      for (let z = -3.0; z <= 3.0; z += Math.max(1.0, boltSpacingM)) {
        sampledCrownPts.forEach((pt) => {
          const centerY = wallH;
          const dir = new THREE.Vector3(pt.x, Math.max(0.25, pt.y - centerY), 0).normalize();
          const startPos = new THREE.Vector3(pt.x, pt.y, z);
          const midPos = startPos.clone().addScaledVector(dir, boltLengthM / 2);

          const cylGeo = new THREE.CylinderGeometry(0.04, 0.04, boltLengthM, 8);
          const boltMesh = new THREE.Mesh(cylGeo, boltMat);
          boltMesh.position.copy(midPos);
          boltMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          boltGroup.add(boltMesh);

          const plateGeo = new THREE.BoxGeometry(0.26, 0.06, 0.26);
          const plateMesh = new THREE.Mesh(plateGeo, plateMat);
          plateMesh.position.copy(startPos);
          plateMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          boltGroup.add(plateMesh);
        });
      }
      scene.add(boltGroup);
    }

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (detachSimulation && wedgeGroupRef.current) {
        detachProgressRef.current = Math.min(1, detachProgressRef.current + 0.018);
        const dropY = detachProgressRef.current * detachProgressRef.current * (heightH * 0.52);
        wedgeGroupRef.current.position.y = -dropY;
      } else if (wedgeGroupRef.current) {
        detachProgressRef.current = 0;
        wedgeGroupRef.current.position.y = 0;
      }
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
    wedgeVolumeM3,
    wedgeWeightKn,
    apexHeightM,
    fosUnbolted,
    fosBolted,
    boltLengthM,
    boltSpacingM,
    governingStrike,
    governingDip,
    driveAzimuth,
    showBolts,
    showBoundingPlanes,
    wireframeTunnel,
    detachSimulation,
    isUnstable,
    isMarginal,
  ]);

  return (
    <div className="relative w-full h-full min-h-[440px] rounded-lg overflow-hidden border border-slate-800 bg-[#060a12] flex flex-col">
      {/* Top CAD Viewport Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900/95 border-b border-slate-800 z-10">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border flex items-center gap-1 ${
              isUnstable
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                : isMarginal
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
            }`}
          >
            {isUnstable && <AlertTriangle className="w-3 h-3" />}
            FoS = {effectiveFoS.toFixed(2)} ({failureMode.replace(/_/g, ' ')})
          </span>
          <span className="text-[11px] font-mono text-slate-400 tabular-nums">
            V = <strong className="text-slate-200">{wedgeVolumeM3.toFixed(2)} m³</strong> | W = <strong className="text-amber-300">{wedgeWeightKn.toFixed(0)} kN</strong> | Apex = <strong className="text-sky-300">{apexHeightM.toFixed(2)} m</strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowBolts(!showBolts)}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition flex items-center gap-1 ${
              showBolts
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Shield className="w-3 h-3" /> Bolts ({boltLengthM}m @ {boltSpacingM}m)
          </button>
          <button
            onClick={() => setShowBoundingPlanes(!showBoundingPlanes)}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition flex items-center gap-1 ${
              showBoundingPlanes
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Layers className="w-3 h-3" /> J1/J2 Planes
          </button>
          <button
            onClick={() => setWireframeTunnel(!wireframeTunnel)}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition flex items-center gap-1 ${
              wireframeTunnel
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Eye className="w-3 h-3" /> Shell
          </button>
          <button
            onClick={() => setDetachSimulation(!detachSimulation)}
            className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border transition flex items-center gap-1 ${
              detachSimulation
                ? 'bg-rose-600 text-white border-rose-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            {detachSimulation ? <RotateCcw className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {detachSimulation ? 'Reset Wedge' : 'Test Kinematic Drop'}
          </button>
        </div>
      </div>

      {/* 3D Canvas Container */}
      <div ref={containerRef} className="w-full flex-1 min-h-[390px] cursor-grab active:cursor-grabbing" />

      {/* Bottom Engineering Status Bar */}
      <div className="px-3 py-1.5 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400 tabular-nums">
        <div>
          UNBOLTED FoS: <span className="text-rose-400 font-bold">{fosUnbolted.toFixed(2)}</span> → BOLTED FoS: <span className="text-emerald-400 font-bold">{fosBolted.toFixed(2)}</span>
        </div>
        <div>
          BOLT EMBEDMENT PAST APEX: <span className={boltLengthM > apexHeightM + 0.5 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{(boltLengthM - apexHeightM).toFixed(2)} m</span>
        </div>
      </div>
    </div>
  );
};
