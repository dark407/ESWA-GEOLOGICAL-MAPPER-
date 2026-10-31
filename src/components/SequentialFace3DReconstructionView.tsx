import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Layers,
  Sliders,
  Maximize2,
  Eye,
  Compass,
  Activity,
} from 'lucide-react';
import {
  SequentialFaceLog,
  reconstruct3DGeologicalRibbons,
  interpolateIdwPoint,
  generateExactTunnelProfilePoints,
} from '../engine/advancedModelingAndAlignmentEngine';
import { TunnelGeometry } from '../types/tunnel';

export interface RibbonTriangle3D {
  v1: { x: number; y: number; z: number };
  v2: { x: number; y: number; z: number };
  v3: { x: number; y: number; z: number };
}

export interface SequentialFace3DReconstructionViewProps {
  geometry?: TunnelGeometry;
  tunnelWidth?: number;
  tunnelHeight?: number;
  spanW?: number;
  heightH?: number;
  initialFaceLogs?: SequentialFaceLog[];
}

export const SequentialFace3DReconstructionView: React.FC<SequentialFace3DReconstructionViewProps> = ({
  geometry,
  tunnelWidth: propTunnelWidth,
  tunnelHeight: propTunnelHeight,
  spanW: propSpanW,
  heightH: propHeightH,
  initialFaceLogs = [],
}) => {
  const tunnelWidth = propSpanW ?? propTunnelWidth ?? geometry?.width ?? 8.4;
  const tunnelHeight = propHeightH ?? propTunnelHeight ?? geometry?.height ?? 7.2;
  const [faceLogs, setFaceLogs] = useState<SequentialFaceLog[]>(initialFaceLogs);
  const [probeChainage, setProbeChainage] = useState<number>(
    initialFaceLogs.length > 0 ? initialFaceLogs[0].chainageMeters + 1.5 : 101.5
  );
  const [idwPowerP, setIdwPowerP] = useState<number>(2);
  const [showWireframe, setShowWireframe] = useState<boolean>(true);
  const [ribbonOpacity, setRibbonOpacity] = useState<number>(0.68);

  useEffect(() => {
    setFaceLogs(initialFaceLogs);
    if (initialFaceLogs.length >= 2) {
      const sorted = [...initialFaceLogs].sort((a, b) => a.chainageMeters - b.chainageMeters);
      const mid =
        (sorted[0].chainageMeters + sorted[sorted.length - 1].chainageMeters) * 0.5;
      setProbeChainage(Number(mid.toFixed(1)));
    } else if (initialFaceLogs.length === 1) {
      setProbeChainage(Number((initialFaceLogs[0].chainageMeters + 1.5).toFixed(1)));
    }
  }, [initialFaceLogs]);

  const sortedLogs = useMemo(() => {
    const base = [...faceLogs].sort((a, b) => a.chainageMeters - b.chainageMeters);
    if (base.length === 1) {
      const only = base[0];
      const nextCh = Number((only.chainageMeters + 3.5).toFixed(1));
      return [
        only,
        {
          ...only,
          id: `${only.id}-end`,
          chainageMeters: nextCh,
          faceChainageStr: `RD ${nextCh.toFixed(1)}m`,
        },
      ];
    }
    return base;
  }, [faceLogs]);

  const minChainage = sortedLogs[0]?.chainageMeters ?? 100;
  const maxChainage = sortedLogs[sortedLogs.length - 1]?.chainageMeters ?? 110;

  const idwResult = useMemo(() => {
    const res = interpolateIdwPoint(
      { x: 0, y: tunnelHeight * 0.5, z: probeChainage },
      sortedLogs,
      idwPowerP
    );
    const rockClass =
      res.rmr >= 81
        ? 'Class I (Very Good)'
        : res.rmr >= 61
        ? 'Class II (Good Rock)'
        : res.rmr >= 41
        ? 'Class III (Fair Rock)'
        : res.rmr >= 21
        ? 'Class IV (Poor Rock)'
        : 'Class V (Very Poor)';
    return {
      interpolatedRmr: res.rmr,
      interpolatedQ: res.q,
      interpolatedGsi: res.gsi,
      rockClass,
    };
  }, [probeChainage, sortedLogs, idwPowerP, tunnelHeight]);

  // Build Triangulated 3D Ribbons between consecutive logged faces
  const ribbonsData = useMemo(() => {
    const list: { color: number; triangles: RibbonTriangle3D[]; label: string }[] = [];
    const palette = [0x0284c7, 0xd97706, 0x059669, 0xdc2626];

    for (let i = 0; i < sortedLogs.length - 1; i++) {
      const logA: SequentialFaceLog = {
        ...sortedLogs[i],
        contacts: sortedLogs[i].contacts.map((c) => ({
          ...c,
          polyline: c.polyline.map((pt) => ({
            x: Math.max(-tunnelWidth * 0.48, Math.min(tunnelWidth * 0.48, pt.x)),
            y: Math.max(0.15, Math.min(tunnelHeight - 0.15, pt.y)),
          })),
        })),
      };
      const logB: SequentialFaceLog = {
        ...sortedLogs[i + 1],
        contacts: sortedLogs[i + 1].contacts.map((c) => ({
          ...c,
          polyline: c.polyline.map((pt) => ({
            x: Math.max(-tunnelWidth * 0.48, Math.min(tunnelWidth * 0.48, pt.x)),
            y: Math.max(0.15, Math.min(tunnelHeight - 0.15, pt.y)),
          })),
        })),
      };

      const meshes = reconstruct3DGeologicalRibbons(logA, logB, 45, 24);
      meshes.forEach((mesh, c) => {
        const tris: RibbonTriangle3D[] = [];
        for (let k = 0; k < mesh.indices.length; k += 3) {
          const v1 = mesh.vertices[mesh.indices[k]];
          const v2 = mesh.vertices[mesh.indices[k + 1]];
          const v3 = mesh.vertices[mesh.indices[k + 2]];
          if (v1 && v2 && v3) {
            tris.push({ v1, v2, v3 });
          }
        }
        list.push({
          color: palette[c % palette.length],
          triangles: tris,
          label: mesh.contactName,
        });
      });
    }
    return list;
  }, [sortedLogs, tunnelWidth, tunnelHeight]);

  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const getDims = () => ({
      width: Math.max(320, container.clientWidth || 600),
      height: Math.max(300, container.clientHeight || 380),
    });

    const { width, height } = getDims();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const spanDrive = Math.max(4, maxChainage - minChainage);
    const centerZ = (minChainage + maxChainage) / 2;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(tunnelWidth * 1.85, tunnelHeight * 1.35, spanDrive * 1.05);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, tunnelHeight * 0.45, 0);

    // Neutral Geotechnical CAD Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.65);
    dirLight.position.set(20, 35, 25);
    scene.add(dirLight);
    const backLight = new THREE.DirectionalLight(0xf8fafc, 0.4);
    backLight.position.set(-20, 15, -25);
    scene.add(backLight);

    // Technical Floor Grid on White Canvas
    const gridSpan = Math.ceil(Math.max(spanDrive * 1.8, tunnelWidth * 2.5, 20) / 2) * 2;
    const grid = new THREE.GridHelper(gridSpan, Math.min(30, gridSpan), 0x94a3b8, 0xe2e8f0);
    grid.position.y = -0.02;
    scene.add(grid);

    const profilePts = generateExactTunnelProfilePoints(
      geometry,
      tunnelWidth,
      tunnelHeight,
      geometry?.wallHeight
    );

    // 1. Extruded Corridor Shell & Longitudinal Stringers
    if (profilePts.length >= 3 && sortedLogs.length >= 2) {
      const shape = new THREE.Shape();
      shape.moveTo(profilePts[0].x, profilePts[0].y);
      for (let i = 1; i < profilePts.length; i++) {
        shape.lineTo(profilePts[i].x, profilePts[i].y);
      }
      shape.closePath();

      const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
        depth: spanDrive,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 24,
      });
      extrudeGeo.translate(0, 0, -spanDrive / 2);

      const shellMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.7,
        metalness: 0.05,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      scene.add(new THREE.Mesh(extrudeGeo, shellMat));

      const stride = Math.max(1, Math.floor(profilePts.length / 12));
      const stringerMat = new THREE.LineBasicMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: 0.55,
      });
      for (let i = 0; i < profilePts.length; i += stride) {
        const p = profilePts[i];
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(p.x, p.y, -spanDrive / 2),
          new THREE.Vector3(p.x, p.y, spanDrive / 2),
        ]);
        scene.add(new THREE.Line(lineGeo, stringerMat));
      }
    }

    // 2. Logged Station Cross-Section Rings & Face Polylines
    sortedLogs.forEach((log) => {
      const zLocal = log.chainageMeters - centerZ;
      const ringPts = profilePts.map((p) => new THREE.Vector3(p.x, p.y, zLocal));
      if (ringPts.length > 0) ringPts.push(ringPts[0].clone());

      const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
      const ringMat = new THREE.LineBasicMaterial({ color: 0x0f172a });
      scene.add(new THREE.Line(ringGeo, ringMat));

      log.contacts.forEach((contact, cIdx) => {
        const linePts = contact.polyline.map(
          (pt) =>
            new THREE.Vector3(
              Math.max(-tunnelWidth * 0.48, Math.min(tunnelWidth * 0.48, pt.x)),
              Math.max(0.15, Math.min(tunnelHeight - 0.15, pt.y)),
              zLocal
            )
        );
        if (linePts.length >= 2) {
          const cGeo = new THREE.BufferGeometry().setFromPoints(linePts);
          const cMat = new THREE.LineBasicMaterial({
            color: cIdx === 0 ? 0x0284c7 : 0xd97706,
          });
          scene.add(new THREE.Line(cGeo, cMat));
        }
      });
    });

    // 3. Triangulated 3D Geological Surface Ribbons
    ribbonsData.forEach((rib) => {
      const positions: number[] = [];
      rib.triangles.forEach((tri) => {
        positions.push(tri.v1.x, tri.v1.y, tri.v1.z - centerZ);
        positions.push(tri.v2.x, tri.v2.y, tri.v2.z - centerZ);
        positions.push(tri.v3.x, tri.v3.y, tri.v3.z - centerZ);
      });

      const bGeo = new THREE.BufferGeometry();
      bGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      bGeo.computeVertexNormals();

      const bMat = new THREE.MeshStandardMaterial({
        color: rib.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: ribbonOpacity,
        roughness: 0.45,
        metalness: 0.05,
      });
      scene.add(new THREE.Mesh(bGeo, bMat));

      if (showWireframe) {
        const wMat = new THREE.MeshBasicMaterial({
          color: 0x1e293b,
          wireframe: true,
          transparent: true,
          opacity: 0.28,
        });
        scene.add(new THREE.Mesh(bGeo, wMat));
      }
    });

    // 4. Probe Interpolation Plane at probeChainage
    const zProbeLocal = probeChainage - centerZ;
    if (profilePts.length >= 3) {
      const probeShape = new THREE.Shape();
      probeShape.moveTo(profilePts[0].x, profilePts[0].y);
      for (let i = 1; i < profilePts.length; i++) {
        probeShape.lineTo(profilePts[i].x, profilePts[i].y);
      }
      probeShape.closePath();

      const probeGeo = new THREE.ShapeGeometry(probeShape, 24);
      probeGeo.translate(0, 0, zProbeLocal);

      const probeColor =
        idwResult.interpolatedRmr >= 60
          ? 0x059669
          : idwResult.interpolatedRmr >= 40
          ? 0xd97706
          : 0xdc2626;
      const probeMat = new THREE.MeshBasicMaterial({
        color: probeColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.26,
      });
      scene.add(new THREE.Mesh(probeGeo, probeMat));

      const probeRing = profilePts.map((p) => new THREE.Vector3(p.x, p.y, zProbeLocal));
      probeRing.push(probeRing[0].clone());
      scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(probeRing),
          new THREE.LineBasicMaterial({ color: probeColor })
        )
      );
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
      const d = getDims();
      camera.aspect = d.width / d.height;
      camera.updateProjectionMatrix();
      renderer.setSize(d.width, d.height);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(reqId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [
    geometry,
    sortedLogs,
    ribbonsData,
    probeChainage,
    showWireframe,
    ribbonOpacity,
    tunnelWidth,
    tunnelHeight,
    minChainage,
    maxChainage,
    idwResult.interpolatedRmr,
  ]);

  const shapeLabel = (geometry?.crownGeometry || 'd_shaped').replace(/_/g, ' ').toUpperCase();

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden font-sans text-slate-100">
      {/* HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-mono font-bold text-sm text-white tracking-wide uppercase">
              3D Geological Surface Reconstruction from Sequential Face Logs
            </h3>
            <p className="text-xs text-slate-400">
              Exact {shapeLabel} Profile ({tunnelWidth.toFixed(2)}m × {tunnelHeight.toFixed(2)}m), Triangulated Contact Ribbons &amp; 3D IDW Interpolation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowWireframe(!showWireframe)}
            className={`px-2.5 py-1 rounded text-xs font-mono border transition cursor-pointer ${
              showWireframe
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Eye className="w-3.5 h-3.5 inline mr-1" />
            Mesh Wireframe: {showWireframe ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* MAIN BODY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 flex-1 overflow-y-auto">
        {/* LEFT COLUMN: 3D WHITE CAD VIEWPORT */}
        <div className="lg:col-span-8 flex flex-col bg-white border border-slate-300 rounded-xl overflow-hidden relative min-h-[380px]">
          <div ref={mountRef} className="w-full h-full flex-1 min-h-[380px]" />

          {/* Top-Left CAD Legend Overlay */}
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs border border-slate-300 shadow-xs rounded-lg p-2.5 text-[11px] font-mono space-y-1 pointer-events-none text-slate-800">
            <div className="text-slate-900 font-bold flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-sky-600" /> 3D SEQUENTIAL FACE CAD RECONSTRUCTION
            </div>
            <div className="text-slate-600">
              Shape: <strong className="text-slate-900">{shapeLabel}</strong> ({tunnelWidth.toFixed(2)}m × {tunnelHeight.toFixed(2)}m)
            </div>
            <div className="text-slate-600">
              Stations: <strong className="text-slate-900">{sortedLogs.length} Faces</strong> (RD {minChainage.toFixed(1)}m ➔ RD {maxChainage.toFixed(1)}m)
            </div>
            <div className="flex items-center gap-3 pt-1">
              <span className="flex items-center gap-1 text-sky-700 font-semibold">
                <span className="w-2.5 h-2.5 rounded-xs bg-sky-600 inline-block" /> Upper Horizon
              </span>
              <span className="flex items-center gap-1 text-amber-700 font-semibold">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" /> Lower Horizon
              </span>
            </div>
          </div>

          <div className="absolute bottom-2.5 right-3 bg-white/95 border border-slate-300 rounded px-2 py-1 text-[10px] font-mono text-slate-600 pointer-events-none shadow-2xs">
            CAD Orbit: Left-Drag | Zoom: Scroll | Pan: Right-Drag
          </div>
        </div>

        {/* RIGHT COLUMN: 3D IDW INTERPOLATION & STATION LOGS */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          {/* IDW Probe Control Card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-cyan-400 uppercase flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" /> 3D IDW Rock Quality Interpolator
              </span>
              <span className="text-[11px] text-amber-300 font-bold">
                RD {probeChainage.toFixed(1)} m
              </span>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Probe Chainage Z (m)</span>
                <span className="text-white font-bold">{probeChainage.toFixed(1)} m</span>
              </div>
              <input
                type="range"
                min={minChainage}
                max={maxChainage}
                step={0.2}
                value={probeChainage}
                onChange={(e) => setProbeChainage(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>{minChainage.toFixed(1)}m</span>
                <span>{maxChainage.toFixed(1)}m</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">IDW Exponent (p)</label>
                <select
                  value={idwPowerP}
                  onChange={(e) => setIdwPowerP(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                >
                  <option value={1}>p = 1 (Linear)</option>
                  <option value={2}>p = 2 (Inverse Sq)</option>
                  <option value={3}>p = 3 (Cubic Local)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Ribbon Opacity</label>
                <input
                  type="range"
                  min={0.2}
                  max={1.0}
                  step={0.05}
                  value={ribbonOpacity}
                  onChange={(e) => setRibbonOpacity(Number(e.target.value))}
                  className="w-full accent-cyan-500 mt-1.5 cursor-pointer"
                />
              </div>
            </div>

            {/* Interpolated Values Box */}
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                IDW Interpolated Parameters at Z = {probeChainage.toFixed(1)}m:
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">RMR₈₉</span>
                  <strong className="text-emerald-400 text-sm">{idwResult.interpolatedRmr}</strong>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Barton Q</span>
                  <strong className="text-cyan-300 text-sm">{idwResult.interpolatedQ}</strong>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">GSI</span>
                  <strong className="text-amber-300 text-sm">{idwResult.interpolatedGsi}</strong>
                </div>
              </div>
              <div className="text-[11px] text-slate-300 flex items-center justify-between pt-1 border-t border-slate-800">
                <span>Predicted Class:</span>
                <strong className="text-amber-300">{idwResult.rockClass}</strong>
              </div>
            </div>
          </div>

          {/* Sequential Logged Faces List */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex-1 font-mono text-xs space-y-2 overflow-y-auto max-h-60">
            <div className="text-slate-300 font-bold uppercase tracking-wider border-b border-slate-800 pb-1.5 flex items-center justify-between">
              <span>Sequential Face Stations ({sortedLogs.length})</span>
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            {sortedLogs.map((log) => (
              <div
                key={log.id}
                onClick={() => setProbeChainage(log.chainageMeters)}
                className={`p-2 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                  Math.abs(probeChainage - log.chainageMeters) < 0.3
                    ? 'bg-cyan-950/50 border-cyan-500/50 text-white'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div>
                  <div className="font-bold text-cyan-300">{log.faceChainageStr}</div>
                  <div className="text-[10px] text-slate-400">
                    {log.contacts.map((c) => c.lithologyName).join(' / ') || 'Mapped Station'}
                  </div>
                </div>
                <div className="text-right text-[11px]">
                  <div className="text-emerald-400 font-bold">RMR: {log.meanRmr}</div>
                  <div className="text-slate-400">Q: {log.meanQ}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
