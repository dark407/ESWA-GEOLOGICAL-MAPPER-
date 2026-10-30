import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  SequentialFaceLog,
  interpolateSequentialFaceLogs,
} from '../engine/advancedModelingAndAlignmentEngine';
import { TunnelGeometry } from '../types/tunnel';
import { Layers, RotateCcw, Eye } from 'lucide-react';

interface SequentialFace3DReconstructionViewProps {
  spanW: number;
  heightH: number;
  geometry?: TunnelGeometry;
  initialFaceLogs?: SequentialFaceLog[];
}

function getExactFaceOutlinePoints(
  spanW: number,
  heightH: number,
  geometry?: TunnelGeometry
): { x: number; y: number }[] {
  if (geometry?.crossSectionPoints && geometry.crossSectionPoints.length >= 4) {
    return geometry.crossSectionPoints;
  }
  const halfW = spanW / 2;
  const wallH = geometry?.wallHeight ? Math.min(geometry.wallHeight, heightH * 0.6) : heightH * 0.55;
  const archH = Math.max(0.5, heightH - wallH);
  const pts: { x: number; y: number }[] = [];
  pts.push({ x: -halfW, y: 0 });
  pts.push({ x: -halfW, y: wallH });
  for (let i = 1; i < 28; i++) {
    const theta = Math.PI * (1 - i / 28);
    pts.push({
      x: halfW * Math.cos(theta),
      y: wallH + archH * Math.sin(theta),
    });
  }
  pts.push({ x: halfW, y: wallH });
  pts.push({ x: halfW, y: 0 });
  return pts;
}

export const SequentialFace3DReconstructionView: React.FC<SequentialFace3DReconstructionViewProps> = ({
  spanW,
  heightH,
  geometry,
  initialFaceLogs = [],
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [faceLogs, setFaceLogs] = useState<SequentialFaceLog[]>(initialFaceLogs);
  const [selectedStation, setSelectedStation] = useState<number>(
    initialFaceLogs.length > 0 ? initialFaceLogs[0].chainageMeters : 100
  );
  const [showShell, setShowShell] = useState<boolean>(true);
  const [showRibbons, setShowRibbons] = useState<boolean>(true);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    setFaceLogs(initialFaceLogs);
    if (initialFaceLogs.length > 0) {
      setSelectedStation(initialFaceLogs[0].chainageMeters);
    }
  }, [initialFaceLogs]);

  const sortedLogs = [...faceLogs].sort((a, b) => a.chainageMeters - b.chainageMeters);
  const minY = sortedLogs.length > 0 ? sortedLogs[0].chainageMeters : 0;
  const maxY = sortedLogs.length > 0 ? sortedLogs[sortedLogs.length - 1].chainageMeters : 10;
  const interpolated = interpolateSequentialFaceLogs(sortedLogs, selectedStation, 16);

  useEffect(() => {
    const container = mountRef.current;
    if (!container || sortedLogs.length === 0) return;

    const width = container.clientWidth || 720;
    const height = container.clientHeight || 460;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060a12);

    const spanDrive = Math.max(6, maxY - minY);
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(spanW * 1.9, heightH * 1.6, spanDrive * 1.15);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, heightH * 0.45, -spanDrive * 0.45);
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.0);
    dirLight.position.set(16, 26, 18);
    scene.add(dirLight);

    const grid = new THREE.GridHelper(Math.max(40, spanDrive * 2), 24, 0x1e293b, 0x0f172a);
    grid.position.set(0, -0.05, -spanDrive * 0.5);
    scene.add(grid);

    const outlinePts = getExactFaceOutlinePoints(spanW, heightH, geometry);

    // 1. Optional Transparent Tunnel Corridor Shell
    if (showShell && spanDrive > 0.1) {
      const shape = new THREE.Shape();
      outlinePts.forEach((p, idx) => {
        if (idx === 0) shape.moveTo(p.x, p.y);
        else shape.lineTo(p.x, p.y);
      });
      shape.closePath();
      const shellGeo = new THREE.ExtrudeGeometry(shape, {
        steps: 10,
        depth: spanDrive,
        bevelEnabled: false,
      });
      shellGeo.translate(0, 0, -spanDrive);
      const shellMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.22,
        wireframe: false,
      });
      scene.add(new THREE.Mesh(shellGeo, shellMat));
    }

    // 2. Render Exact Tunnel Profile Frame & Mapped Contacts at Each Logged Face Station
    sortedLogs.forEach((face) => {
      const zOffset = -(face.chainageMeters - minY);
      const ringVecs = outlinePts.map((p) => new THREE.Vector3(p.x, p.y, zOffset));
      if (ringVecs.length > 0) ringVecs.push(ringVecs[0].clone());

      const frameGeo = new THREE.BufferGeometry().setFromPoints(ringVecs);
      const frameMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.85 });
      scene.add(new THREE.Line(frameGeo, frameMat));

      face.contacts.forEach((c, cIdx) => {
        const cPts = c.polyline.map((pt) => new THREE.Vector3(pt.x, Math.max(0, pt.y), zOffset));
        if (cPts.length >= 2) {
          const cGeo = new THREE.BufferGeometry().setFromPoints(cPts);
          const cMat = new THREE.LineBasicMaterial({
            color: cIdx === 0 ? 0xf59e0b : cIdx === 1 ? 0x10b981 : 0x38bdf8,
          });
          scene.add(new THREE.Line(cGeo, cMat));
        }
      });
    });

    // 3. Render 3D Interpolated Lithology / Structural Ribbon Surfaces Between Consecutive Faces
    if (showRibbons && sortedLogs.length >= 2) {
      for (let fIdx = 0; fIdx < sortedLogs.length - 1; fIdx++) {
        const fA = sortedLogs[fIdx];
        const fB = sortedLogs[fIdx + 1];
        const zA = -(fA.chainageMeters - minY);
        const zB = -(fB.chainageMeters - minY);
        const numContacts = Math.min(fA.contacts.length, fB.contacts.length);

        for (let cIdx = 0; cIdx < numContacts; cIdx++) {
          const polyA = fA.contacts[cIdx].polyline;
          const polyB = fB.contacts[cIdx].polyline;
          const nPts = Math.min(polyA.length, polyB.length);
          if (nPts < 2) continue;

          const vertices: number[] = [];
          const indices: number[] = [];
          for (let i = 0; i < nPts; i++) {
            vertices.push(polyA[i].x, Math.max(0, polyA[i].y), zA);
            vertices.push(polyB[i].x, Math.max(0, polyB[i].y), zB);
          }
          for (let i = 0; i < nPts - 1; i++) {
            const a = i * 2;
            const b = i * 2 + 1;
            const c = (i + 1) * 2;
            const d = (i + 1) * 2 + 1;
            indices.push(a, b, d);
            indices.push(a, d, c);
          }

          const ribGeo = new THREE.BufferGeometry();
          ribGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
          ribGeo.setIndex(indices);
          ribGeo.computeVertexNormals();

          const ribMat = new THREE.MeshStandardMaterial({
            color: cIdx === 0 ? 0xf59e0b : cIdx === 1 ? 0x10b981 : 0x38bdf8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.48,
            roughness: 0.4,
          });
          scene.add(new THREE.Mesh(ribGeo, ribMat));
        }
      }
    }

    // 4. Active Interpolated Probe Slice Plane at selectedStation
    const zSlice = -(selectedStation - minY);
    const sliceRingVecs = outlinePts.map((p) => new THREE.Vector3(p.x, p.y, zSlice));
    if (sliceRingVecs.length > 0) sliceRingVecs.push(sliceRingVecs[0].clone());
    scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(sliceRingVecs),
        new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 })
      )
    );

    interpolated.interpolatedContacts.forEach((ic) => {
      if (ic.points.length < 2) return;
      const sPts = ic.points.map((p) => new THREE.Vector3(p.x, Math.max(0, p.y), zSlice));
      scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(sPts),
          new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 })
        )
      );
    });

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
      const h = container.clientHeight || 460;
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
  }, [sortedLogs, selectedStation, spanW, heightH, geometry, minY, maxY, showShell, showRibbons]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
      {/* Left 8 Cols: 3D CAD Sequential Face Ribbon Reconstruction */}
      <div className="lg:col-span-8 bg-[#060a12] border border-slate-800 rounded-lg overflow-hidden flex flex-col min-h-[480px]">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900/95 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/40 text-[10px] font-mono font-bold text-sky-300 uppercase">
              3D SEQUENTIAL FACE INTERPOLATION
            </span>
            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
              Logged Faces: <strong className="text-slate-200">{sortedLogs.length}</strong> | Drive Span: <strong className="text-emerald-400">RD {minY.toFixed(1)}m → {maxY.toFixed(1)}m</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowRibbons(!showRibbons)}
              className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition flex items-center gap-1 ${
                showRibbons
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <Layers className="w-3 h-3" /> 3D Ribbons
            </button>
            <button
              onClick={() => setShowShell(!showShell)}
              className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition flex items-center gap-1 ${
                showShell
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <Eye className="w-3 h-3" /> Profile Shell
            </button>
            <button
              onClick={() => {
                if (cameraRef.current && controlsRef.current) {
                  const spanDrive = Math.max(6, maxY - minY);
                  cameraRef.current.position.set(spanW * 1.9, heightH * 1.6, spanDrive * 1.15);
                  controlsRef.current.target.set(0, heightH * 0.45, -spanDrive * 0.45);
                  controlsRef.current.update();
                }
              }}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              title="Reset 3D View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Station Interpolation Scrubber */}
        <div className="px-3 py-1.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center gap-3">
          <span className="text-[10px] font-mono text-slate-400 uppercase shrink-0">
            Interpolate Station (Y_q):
          </span>
          <input
            type="range"
            min={minY}
            max={Math.max(minY + 0.1, maxY)}
            step={0.1}
            value={selectedStation}
            onChange={(e) => setSelectedStation(Number(e.target.value))}
            className="flex-1 accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
          <span className="text-[11px] font-mono font-bold text-sky-300 tabular-nums w-24 text-right">
            RD {selectedStation.toFixed(1)}m
          </span>
        </div>

        <div ref={mountRef} className="w-full flex-1 min-h-[390px] cursor-grab active:cursor-grabbing" />
      </div>

      {/* Right 4 Cols: Compact Engineering Inspector */}
      <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between space-y-3">
        <div className="space-y-3">
          <div className="border-b border-slate-800 pb-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold">
              INTERPOLATED SLICE READOUT
            </div>
            <div className="text-xs font-mono text-slate-300 mt-0.5 tabular-nums">
              Station Y_q = <strong>RD {selectedStation.toFixed(2)}m</strong> (λ = {(interpolated.lambda * 100).toFixed(0)}%)
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-950/90 border border-slate-800 rounded p-2 text-center">
              <div className="text-[9px] font-mono text-slate-500 uppercase">Interp RMR</div>
              <div className="text-sm font-mono font-bold text-emerald-400 tabular-nums mt-0.5">
                {interpolated.interpolatedRmr.toFixed(1)}
              </div>
            </div>
            <div className="bg-slate-950/90 border border-slate-800 rounded p-2 text-center">
              <div className="text-[9px] font-mono text-slate-500 uppercase">Interp Q</div>
              <div className="text-sm font-mono font-bold text-sky-400 tabular-nums mt-0.5">
                {interpolated.interpolatedQ.toFixed(2)}
              </div>
            </div>
            <div className="bg-slate-950/90 border border-slate-800 rounded p-2 text-center">
              <div className="text-[9px] font-mono text-slate-500 uppercase">Interp GSI</div>
              <div className="text-sm font-mono font-bold text-amber-400 tabular-nums mt-0.5">
                {interpolated.interpolatedGsi.toFixed(1)}
              </div>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-1.5">
              Logged Face Stations ({sortedLogs.length})
            </div>
            <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
              {sortedLogs.map((log) => {
                const isSelected = Math.abs(selectedStation - log.chainageMeters) < 0.25;
                return (
                  <button
                    key={log.id}
                    onClick={() => setSelectedStation(log.chainageMeters)}
                    className={`w-full text-left p-2 rounded border transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-sky-500/15 border-sky-500/50 text-white'
                        : 'bg-slate-950/70 border-slate-800/80 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-[11px] font-mono font-bold text-sky-300 tabular-nums">
                        {log.faceChainageStr}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {log.contacts.length} Mapped Horizon(s)
                      </div>
                    </div>
                    <div className="text-right font-mono text-[10px] tabular-nums">
                      <div className="text-emerald-400 font-bold">RMR {log.meanRmr.toFixed(0)}</div>
                      <div className="text-slate-400">Q {log.meanQ.toFixed(2)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-slate-950/90 border border-slate-800/80 rounded p-2.5 text-[10px] font-mono text-slate-400 leading-relaxed">
          <div className="text-slate-300 font-bold mb-0.5">FORMULATION</div>
          P(u, λ) = (1 - λ)·P_i(u) + λ·P_&#123;i+1&#125;(u), where λ = (Y_q - Y_i) / (Y_&#123;i+1&#125; - Y_i)
        </div>
      </div>
    </div>
  );
};
