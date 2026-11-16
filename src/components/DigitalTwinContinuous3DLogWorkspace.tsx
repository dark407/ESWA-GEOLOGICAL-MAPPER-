import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Box,
  CheckCircle2,
  Compass,
  Download,
  FileSpreadsheet,
  Layers,
  Lock,
  MapPin,
  Plus,
  Scissors,
  Sparkles,
} from 'lucide-react';
import { EswaTunnelLogo } from './EswaBrandIdentity';
import {
  appendNextSequential3DDigitalTwinRound,
  buildContinuous3DDigitalTwinCorridorAnalysis,
  Continuous3DDigitalTwinCorridorAnalysis,
  DigitalTwinBetaStore,
  ensureMultiRound3DDigitalTwinDrive,
  exportContinuous3DDigitalTwinAuditToCSV,
  exportContinuous3DDigitalTwinCorridorToDXF,
  loadDigitalTwinBetaStore,
  saveDigitalTwinBetaStore,
  Stitched3DRoundSegment,
  sync3DDigitalTwinRoundTo2DUndergroundStore,
  syncAll3DDigitalTwinLocationRoundsTo2DStore,
} from '../engine/digitalTwin20PhotoEngine';

export interface DigitalTwinContinuous3DLogWorkspaceProps {
  onBackToMainMenu: () => void;
  onOpenSingleRoundIn3DTwin: (
    projectId: string,
    locationId: string,
    roundId: string,
    targetStep?:
      | 'setup'
      | 'capture_20'
      | 'reconstruct_3d'
      | 'joint_dip_inspector_window'
      | 'unfold_3d_to_2d'
  ) => void;
  onOpenSynced2DUndergroundMapping: (
    targetStage?: 'field_canvas' | 'strip_align' | 'parameters_q_rmr' | 'report_sheet'
  ) => void;
}

export const DigitalTwinContinuous3DLogWorkspace: React.FC<
  DigitalTwinContinuous3DLogWorkspaceProps
> = ({
  onBackToMainMenu,
  onOpenSingleRoundIn3DTwin,
  onOpenSynced2DUndergroundMapping,
}) => {
  const [store, setStore] = useState<DigitalTwinBetaStore>(() => {
    const loaded = loadDigitalTwinBetaStore();
    return ensureMultiRound3DDigitalTwinDrive(loaded, 3);
  });

  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [lastAutoSyncInfo, setLastAutoSyncInfo] = useState<{
    syncedCount: number;
    timestampLabel: string;
  } | null>(null);

  // Active Project & Location derived from store
  const activeProject = useMemo(
    () =>
      store.projects.find((p) => p.id === store.activeProjectId) ||
      store.projects[0] ||
      null,
    [store.projects, store.activeProjectId]
  );

  const activeLocation = useMemo(
    () =>
      activeProject?.locations.find((l) => l.id === store.activeLocationId) ||
      activeProject?.locations[0] ||
      null,
    [activeProject, store.activeLocationId]
  );

  // Multi-Round Continuous 3D Digital Twin Corridor Analysis
  const corridorAnalysis: Continuous3DDigitalTwinCorridorAnalysis | null = useMemo(() => {
    if (!activeProject || !activeLocation) return null;
    return buildContinuous3DDigitalTwinCorridorAnalysis(
      activeProject,
      activeLocation,
      store.rounds
    );
  }, [activeProject, activeLocation, store.rounds]);

  // Derived corridor wedge & fabric summary
  const corridorStats = useMemo(() => {
    if (!corridorAnalysis) {
      return {
        totalWedgesCount: 0,
        minFoS: 2.5,
        woodcockK: 1.0,
        shapeCategory: 'Cluster / Girdle Hybrid',
      };
    }
    const allWedges = corridorAnalysis.stitchedRounds.flatMap(
      (s) => s.world3DWedges
    );
    const minFoS =
      allWedges.length > 0
        ? Math.min(...allWedges.map((w) => w.factorOfSafety))
        : 2.5;
    const [l1, l2, l3] = corridorAnalysis.globalEigenvalues;
    const safeL2 = Math.max(0.01, l2);
    const safeL3 = Math.max(0.005, l3);
    const k = Number(
      (Math.log(Math.max(1.01, l1 / safeL2)) /
        Math.max(0.05, Math.log(Math.max(1.01, safeL2 / safeL3)))).toFixed(2)
    );
    const shapeCategory =
      k > 1.05
        ? 'Strong Polar Cluster'
        : k < 0.95
        ? 'Planar Girdle Distribution'
        : 'Orthogonal Conjugate Fabric';
    return {
      totalWedgesCount: allWedges.length,
      minFoS,
      woodcockK: k,
      shapeCategory,
    };
  }, [corridorAnalysis]);

  // Automatic One-Way Sync (3D Digital Twin Location Rounds ➔ 2D Underground Face Mapping Store)
  useEffect(() => {
    if (!activeProject || !activeLocation || !corridorAnalysis) return;
    if (corridorAnalysis.stitchedRounds.length === 0) return;

    const locationRounds = corridorAnalysis.stitchedRounds.map((s) => s.round);
    const res = syncAll3DDigitalTwinLocationRoundsTo2DStore({
      dtProject: activeProject,
      dtLocation: activeLocation,
      dtRounds: locationRounds,
      preferredActiveRoundId: store.activeRoundId,
    });
    if (res.syncedRoundsCount > 0) {
      setLastAutoSyncInfo({
        syncedCount: res.syncedRoundsCount,
        timestampLabel: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      });
    }
  }, [
    activeProject,
    activeLocation,
    corridorAnalysis,
    store.activeRoundId,
  ]);

  // 3D Viewport Display & Layer Controls
  const [surfaceRenderMode, setSurfaceRenderMode] = useState<
    | 'rock_with_break_edges'
    | 'textured_rock_mesh'
    | 'overbreak_heatmap'
    | 'dense_point_cloud'
  >('rock_with_break_edges');
  const [showDesignWireframe, setShowDesignWireframe] = useState<boolean>(true);
  const [show3DDipSurfaces, setShow3DDipSurfaces] = useState<boolean>(true);
  const [show3DJointTraces, setShow3DJointTraces] = useState<boolean>(true);
  const [showCrossRoundRibbons, setShowCrossRoundRibbons] = useState<boolean>(true);
  const [show3DWedges, setShow3DWedges] = useState<boolean>(true);
  const [showChainageScrubber, setShowChainageScrubber] = useState<boolean>(true);
  const [selectedChainageM, setSelectedChainageM] = useState<number>(103.5);

  // Selection states for right-hand analytical panel & 3D highlighting
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(
    () => store.activeRoundId
  );
  const [selectedContinuityId, setSelectedContinuityId] = useState<string | null>(
    null
  );
  const [activeRightTab, setActiveRightTab] = useState<
    | 'rounds_and_2d_sync'
    | 'cross_round_continuity'
    | 'longitudinal_analytics'
    | 'export_audit'
  >('rounds_and_2d_sync');

  // Keep selectedChainageM within corridor chainage bounds
  useEffect(() => {
    if (!corridorAnalysis || corridorAnalysis.stitchedRounds.length === 0) return;
    setSelectedChainageM((prev) => {
      if (
        prev < corridorAnalysis.startChainageM ||
        prev > corridorAnalysis.endChainageM
      ) {
        return Number(
          (
            (corridorAnalysis.startChainageM + corridorAnalysis.endChainageM) *
            0.5
          ).toFixed(2)
        );
      }
      return prev;
    });
  }, [corridorAnalysis]);

  // Find active slice closest to selectedChainageM across all stitched rounds
  const activeChainageSliceInfo = useMemo(() => {
    if (!corridorAnalysis || corridorAnalysis.stitchedRounds.length === 0) {
      return null;
    }
    let bestSeg: Stitched3DRoundSegment = corridorAnalysis.stitchedRounds[0];
    let bestSlice = bestSeg.reconstructedModel.sliceSections[0];
    let bestDist = Infinity;

    for (const seg of corridorAnalysis.stitchedRounds) {
      for (const sl of seg.reconstructedModel.sliceSections) {
        const d = Math.abs(sl.chainageM - selectedChainageM);
        if (d < bestDist) {
          bestDist = d;
          bestSeg = seg;
          bestSlice = sl;
        }
      }
    }
    if (!bestSlice) return null;
    const worldZ = bestSeg.zWorldStartM + bestSlice.zOffsetM;
    return {
      segment: bestSeg,
      slice: bestSlice,
      worldZ,
    };
  }, [corridorAnalysis, selectedChainageM]);

  // Append next connected 3D round along tunnel chainage
  const handleAppendNextConnectedRound = useCallback(() => {
    if (!activeProject || !activeLocation) return;
    const { updatedStore, createdRound } = appendNextSequential3DDigitalTwinRound(
      store,
      activeProject.id,
      activeLocation.id
    );
    setStore(updatedStore);
    setSelectedRoundId(createdRound.id);
    setStatusToast(
      `Appended connected 3D Digital Twin Round #${createdRound.roundNumber} (CH ${createdRound.chainageFromM.toFixed(
        1
      )}m → ${createdRound.chainageToM.toFixed(
        1
      )}m) — 20/20 photos reconstructed & auto-synced 3D ➔ 2D.`
    );
  }, [store, activeProject, activeLocation]);

  // Explicit One-Way Sync & Open 2D Underground Face Mapping
  const handleConvertAndOpen2DFaceMapping = useCallback(
    (
      roundId?: string,
      targetStage: 'field_canvas' | 'strip_align' = 'field_canvas'
    ) => {
      if (!activeProject || !activeLocation || !corridorAnalysis) return;
      const locationRounds = corridorAnalysis.stitchedRounds.map((s) => s.round);
      const targetId = roundId || selectedRoundId || store.activeRoundId;

      syncAll3DDigitalTwinLocationRoundsTo2DStore({
        dtProject: activeProject,
        dtLocation: activeLocation,
        dtRounds: locationRounds,
        preferredActiveRoundId: targetId,
      });

      const chosenSeg = corridorAnalysis.stitchedRounds.find(
        (s) => s.round.id === targetId
      );
      if (chosenSeg) {
        sync3DDigitalTwinRoundTo2DUndergroundStore({
          dtProject: activeProject,
          dtLocation: activeLocation,
          dtRound: chosenSeg.round,
          all3DJoints:
            chosenSeg.round.extracted3DJoints ||
            chosenSeg.reconstructedModel.extracted3DJoints,
          reconstructedModel: chosenSeg.reconstructedModel,
        });
      }

      onOpenSynced2DUndergroundMapping(targetStage);
    },
    [
      activeProject,
      activeLocation,
      corridorAnalysis,
      selectedRoundId,
      store.activeRoundId,
      onOpenSynced2DUndergroundMapping,
    ]
  );

  // ============================================================================
  // THREE.JS MULTI-ROUND CONTINUOUS 3D DIGITAL TWIN CORRIDOR VIEWPORT
  // ============================================================================
  const viewportContainerRef = useRef<HTMLDivElement | null>(null);
  const threeCtxRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    corridorRootGroup: THREE.Group | null;
    animId: number;
  } | null>(null);

  const resetCorridorCamera = useCallback(
    (
      preset:
        | 'isometric_drive'
        | 'portal_to_face'
        | 'crown_arch'
        | 'left_wall'
        | 'right_wall' = 'isometric_drive'
    ) => {
      const ctx = threeCtxRef.current;
      if (!ctx || !corridorAnalysis || !activeLocation) return;

      const W = activeLocation.widthM;
      const H = activeLocation.heightM;
      const L = Math.max(4, corridorAnalysis.totalMappedLengthM);
      const midZ = -L * 0.5;

      if (preset === 'portal_to_face') {
        ctx.camera.position.set(0, H * 0.48, Math.max(4.5, L * 0.35));
        ctx.controls.target.set(0, H * 0.45, -L * 0.65);
      } else if (preset === 'crown_arch') {
        ctx.camera.position.set(0, H * 0.18, midZ + L * 0.35);
        ctx.controls.target.set(0, H * 0.88, midZ - L * 0.15);
      } else if (preset === 'left_wall') {
        ctx.camera.position.set(W * 0.75, H * 0.48, midZ + L * 0.25);
        ctx.controls.target.set(-W * 0.45, H * 0.45, midZ - L * 0.1);
      } else if (preset === 'right_wall') {
        ctx.camera.position.set(-W * 0.75, H * 0.48, midZ + L * 0.25);
        ctx.controls.target.set(W * 0.45, H * 0.45, midZ - L * 0.1);
      } else {
        ctx.camera.position.set(W * 1.15, H * 0.92, Math.max(5.5, L * 0.42));
        ctx.controls.target.set(0, H * 0.42, midZ);
      }
      ctx.controls.update();
    },
    [corridorAnalysis, activeLocation]
  );

  // Initialize Three.js WebGLRenderer once
  useEffect(() => {
    const container = viewportContainerRef.current;
    if (!container) return;

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(320, container.clientHeight);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 500);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxDistance = 240;
    controls.minDistance = 0.6;

    // Bright studio & engineering inspection lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 1.15);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.95);
    dirLight1.position.set(16, 28, 22);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xf1f5f9, 0.65);
    dirLight2.position.set(-18, 14, -28);
    scene.add(dirLight2);

    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    threeCtxRef.current = {
      renderer,
      scene,
      camera,
      controls,
      corridorRootGroup: null,
      animId,
    };

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cw = Math.max(300, entry.contentRect.width);
        const ch = Math.max(260, entry.contentRect.height);
        camera.aspect = cw / ch;
        camera.updateProjectionMatrix();
        renderer.setSize(cw, ch);
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(animId);
      pmremGenerator.dispose();
      renderer.dispose();
      threeCtxRef.current = null;
    };
  }, []);

  // Build / Update Stitched Multi-Round 3D Corridor Scene Graph
  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx || !corridorAnalysis || !activeLocation) return;

    const { scene } = ctx;
    if (ctx.corridorRootGroup) {
      scene.remove(ctx.corridorRootGroup);
    }

    const rootGroup = new THREE.Group();
    const W = activeLocation.widthM;
    const H = activeLocation.heightM;
    const totalLen = Math.max(4, corridorAnalysis.totalMappedLengthM);

    // 1. Clean Light Engineering Floor Reference Grid along the entire stitched corridor
    const gridSpan = Math.max(W * 3.2, totalLen * 1.4, 28);
    const gridHelper = new THREE.GridHelper(
      gridSpan,
      Math.round(gridSpan / 1.5),
      0x94a3b8,
      0xe2e8f0
    );
    gridHelper.position.set(0, -0.03, -totalLen * 0.5);
    rootGroup.add(gridHelper);

    // 2. Render each Stitched 3D Excavation Round Segment along world -Z
    for (const seg of corridorAnalysis.stitchedRounds) {
      const roundGroup = new THREE.Group();
      const isSelectedRound = seg.round.id === selectedRoundId;
      const model = seg.reconstructedModel;

      // 2A. 3D Rock Mesh or Dense Point Cloud (shifted by seg.zWorldStartM)
      const shiftedPositions = new Float32Array(model.positions.length);
      for (let i = 0; i < model.positions.length; i += 3) {
        shiftedPositions[i] = model.positions[i];
        shiftedPositions[i + 1] = model.positions[i + 1];
        shiftedPositions[i + 2] = model.positions[i + 2] + seg.zWorldStartM;
      }

      const activeColors =
        surfaceRenderMode === 'overbreak_heatmap'
          ? model.deviationColors
          : model.colors;

      if (surfaceRenderMode === 'dense_point_cloud') {
        const shiftedPts = new Float32Array(model.pointCloudPositions.length);
        for (let i = 0; i < model.pointCloudPositions.length; i += 3) {
          shiftedPts[i] = model.pointCloudPositions[i];
          shiftedPts[i + 1] = model.pointCloudPositions[i + 1];
          shiftedPts[i + 2] =
            model.pointCloudPositions[i + 2] + seg.zWorldStartM;
        }
        const ptGeom = new THREE.BufferGeometry();
        ptGeom.setAttribute(
          'position',
          new THREE.BufferAttribute(shiftedPts, 3)
        );
        ptGeom.setAttribute(
          'color',
          new THREE.BufferAttribute(model.pointCloudColors, 3)
        );
        const ptMat = new THREE.PointsMaterial({
          size: 0.075,
          vertexColors: true,
        });
        roundGroup.add(new THREE.Points(ptGeom, ptMat));
      } else {
        const meshGeom = new THREE.BufferGeometry();
        meshGeom.setAttribute(
          'position',
          new THREE.BufferAttribute(shiftedPositions, 3)
        );
        meshGeom.setAttribute(
          'color',
          new THREE.BufferAttribute(activeColors, 3)
        );
        meshGeom.setIndex(new THREE.BufferAttribute(model.indices, 1));
        meshGeom.computeVertexNormals();

        const meshMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.78,
          metalness: 0.08,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        });
        roundGroup.add(new THREE.Mesh(meshGeom, meshMat));

        if (surfaceRenderMode === 'rock_with_break_edges') {
          const edgesGeom = new THREE.EdgesGeometry(meshGeom, 16);
          const edgesMat = new THREE.LineBasicMaterial({
            color: isSelectedRound ? 0x0f172a : 0x334155,
            transparent: true,
            opacity: isSelectedRound ? 0.52 : 0.32,
          });
          roundGroup.add(new THREE.LineSegments(edgesGeom, edgesMat));
        }
      }

      // 2B. Theoretical Design Wireframe & Round Boundary Collar Ring
      if (showDesignWireframe) {
        const shiftedWire = new Float32Array(
          model.designWireframePositions.length
        );
        for (let i = 0; i < model.designWireframePositions.length; i += 3) {
          shiftedWire[i] = model.designWireframePositions[i];
          shiftedWire[i + 1] = model.designWireframePositions[i + 1];
          shiftedWire[i + 2] =
            model.designWireframePositions[i + 2] + seg.zWorldStartM;
        }
        const wireGeom = new THREE.BufferGeometry();
        wireGeom.setAttribute(
          'position',
          new THREE.BufferAttribute(shiftedWire, 3)
        );
        const wireMat = new THREE.LineBasicMaterial({
          color: isSelectedRound ? 0x0284c7 : 0x64748b,
          transparent: true,
          opacity: isSelectedRound ? 0.85 : 0.45,
        });
        roundGroup.add(new THREE.LineSegments(wireGeom, wireMat));
      }

      // 2C. World-Space 3D Dip Surface Polygons & 3D Joint Traces for this Round
      for (const j of seg.world3DJoints) {
        if (j.status === 'Rejected Shadow / Disturbance') continue;
        const col = new THREE.Color(j.colorHex);

        if (
          show3DDipSurfaces &&
          j.dipPolygonVertices3D &&
          j.dipPolygonVertices3D.length >= 3
        ) {
          const poly = j.dipPolygonVertices3D;
          const c = j.center3D;
          const triPositions: number[] = [];
          for (let i = 0; i < poly.length; i++) {
            const p0 = poly[i];
            const p1 = poly[(i + 1) % poly.length];
            triPositions.push(
              c.x,
              c.y,
              c.z,
              p0.x,
              p0.y,
              p0.z,
              p1.x,
              p1.y,
              p1.z
            );
          }
          const dipGeom = new THREE.BufferGeometry();
          dipGeom.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(triPositions, 3)
          );
          dipGeom.computeVertexNormals();
          roundGroup.add(
            new THREE.Mesh(
              dipGeom,
              new THREE.MeshBasicMaterial({
                color: col,
                transparent: true,
                opacity: isSelectedRound ? 0.44 : 0.3,
                side: THREE.DoubleSide,
                depthWrite: false,
              })
            )
          );

          const loopPts = [...poly, poly[0]].map(
            (p) => new THREE.Vector3(p.x, p.y, p.z)
          );
          roundGroup.add(
            new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(loopPts),
              new THREE.LineBasicMaterial({ color: col })
            )
          );
        }

        if (
          show3DJointTraces &&
          j.tracePoints3D &&
          j.tracePoints3D.length >= 2
        ) {
          const tracePts = j.tracePoints3D.map(
            (p) =>
              new THREE.Vector3(
                p.x + j.normal3D.nx * 0.035,
                p.y + j.normal3D.ny * 0.035,
                p.z + j.normal3D.nz * 0.035
              )
          );
          roundGroup.add(
            new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(tracePts),
              new THREE.LineBasicMaterial({ color: col })
            )
          );
        }
      }

      // 2D. 3D Key-Block Wedges in World Space
      if (show3DWedges) {
        for (const wdg of seg.world3DWedges) {
          const b = wdg.baseVertices3D;
          const a = wdg.apex3D;
          if (!b || b.length < 3 || !a) continue;
          const pos = new Float32Array([
            b[0].x, b[0].y, b[0].z, b[1].x, b[1].y, b[1].z, b[2].x, b[2].y, b[2].z,
            b[0].x, b[0].y, b[0].z, b[1].x, b[1].y, b[1].z, a.x, a.y, a.z,
            b[1].x, b[1].y, b[1].z, b[2].x, b[2].y, b[2].z, a.x, a.y, a.z,
            b[2].x, b[2].y, b[2].z, b[0].x, b[0].y, b[0].z, a.x, a.y, a.z,
          ]);
          const wGeom = new THREE.BufferGeometry();
          wGeom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
          wGeom.computeVertexNormals();
          const wColor = wdg.factorOfSafety < 1.2 ? 0xdc2626 : 0xd97706;
          roundGroup.add(
            new THREE.Mesh(
              wGeom,
              new THREE.MeshStandardMaterial({
                color: wColor,
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide,
                depthWrite: false,
              })
            )
          );
        }
      }

      rootGroup.add(roundGroup);
    }

    // 3. Cross-Round 3D Continuity Ribbons & Tie-Lines (Multi-Round Structural Persistence)
    if (showCrossRoundRibbons) {
      const continuityGroup = new THREE.Group();
      for (const link of corridorAnalysis.crossRoundStructures) {
        const isHighlighted = selectedContinuityId === link.id;
        const ribbonColor = new THREE.Color(
          isHighlighted ? '#f59e0b' : link.colorHex
        );

        for (const rib of link.continuityRibbons3D) {
          if (rib.quadVertices3D.length < 4) continue;
          const [q0, q1, q2, q3] = rib.quadVertices3D;
          const quadPos = new Float32Array([
            q0.x, q0.y, q0.z, q1.x, q1.y, q1.z, q2.x, q2.y, q2.z,
            q0.x, q0.y, q0.z, q2.x, q2.y, q2.z, q3.x, q3.y, q3.z,
          ]);
          const rGeom = new THREE.BufferGeometry();
          rGeom.setAttribute('position', new THREE.BufferAttribute(quadPos, 3));
          rGeom.computeVertexNormals();
          continuityGroup.add(
            new THREE.Mesh(
              rGeom,
              new THREE.MeshBasicMaterial({
                color: ribbonColor,
                transparent: true,
                opacity: isHighlighted ? 0.62 : 0.34,
                side: THREE.DoubleSide,
                depthWrite: false,
              })
            )
          );

          // Center tie line connecting consecutive rounds
          const tieGeom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(
              rib.centerTieLine3D[0].x,
              rib.centerTieLine3D[0].y,
              rib.centerTieLine3D[0].z
            ),
            new THREE.Vector3(
              rib.centerTieLine3D[1].x,
              rib.centerTieLine3D[1].y,
              rib.centerTieLine3D[1].z
            ),
          ]);
          continuityGroup.add(
            new THREE.Line(
              tieGeom,
              new THREE.LineBasicMaterial({
                color: isHighlighted ? 0xf59e0b : ribbonColor,
              })
            )
          );
        }
      }
      rootGroup.add(continuityGroup);
    }

    // 4. Longitudinal Chainage Slicer Plane across the Stitched Corridor
    if (showChainageScrubber && activeChainageSliceInfo) {
      const { slice, worldZ } = activeChainageSliceInfo;
      const slicerGroup = new THREE.Group();

      const planeGeom = new THREE.PlaneGeometry(W * 1.38, H * 1.38);
      const planeMesh = new THREE.Mesh(
        planeGeom,
        new THREE.MeshBasicMaterial({
          color: 0x0284c7,
          transparent: true,
          opacity: 0.14,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      planeMesh.position.set(0, H * 0.5, worldZ);
      slicerGroup.add(planeMesh);

      const realPts3D = slice.realRockPoints2D.map(
        (p) => new THREE.Vector3(p.x, p.y, worldZ)
      );
      slicerGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(realPts3D),
          new THREE.LineBasicMaterial({ color: 0xea580c })
        )
      );

      const desPts3D = slice.designPoints2D.map(
        (p) => new THREE.Vector3(p.x, p.y, worldZ)
      );
      slicerGroup.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(desPts3D),
          new THREE.LineBasicMaterial({ color: 0x0284c7 })
        )
      );

      rootGroup.add(slicerGroup);
    }

    scene.add(rootGroup);
    ctx.corridorRootGroup = rootGroup;
  }, [
    corridorAnalysis,
    activeLocation,
    surfaceRenderMode,
    showDesignWireframe,
    show3DDipSurfaces,
    show3DJointTraces,
    showCrossRoundRibbons,
    show3DWedges,
    showChainageScrubber,
    activeChainageSliceInfo,
    selectedRoundId,
    selectedContinuityId,
  ]);

  // Initial camera positioning when location changes
  useEffect(() => {
    resetCorridorCamera('isometric_drive');
  }, [activeLocation?.id, resetCorridorCamera]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 text-slate-900 flex flex-col overflow-hidden select-none">
      {/* ==================== TOP HEADER BAR (SCROLLABLE WITHOUT SCROLLBAR, ZERO OVERLAP) ==================== */}
      <header className="w-full bg-white border-b border-slate-200 px-3 py-2 shrink-0 z-20 shadow-xs overflow-x-auto no-scrollbar mouse-scrollable whitespace-nowrap">
        <div
          className="flex items-center justify-between gap-4 min-w-max"
          style={{ minWidth: 'max-content' }}
        >
          {/* Left Brand + Navigation */}
          <div
            className="flex items-center gap-2 shrink-0"
            style={{ minWidth: 'max-content' }}
          >
            <EswaTunnelLogo size="sm" />
            <button
              type="button"
              onClick={onBackToMainMenu}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shrink-0 whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="whitespace-nowrap">NATM Menu</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeProject && activeLocation) {
                  const rId =
                    selectedRoundId ||
                    corridorAnalysis?.stitchedRounds[0]?.round.id ||
                    store.activeRoundId ||
                    '';
                  onOpenSingleRoundIn3DTwin(
                    activeProject.id,
                    activeLocation.id,
                    rId,
                    'reconstruct_3d'
                  );
                }
              }}
              className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shrink-0 whitespace-nowrap"
              title="Switch to Single-Round 3D Digital Twin Tunnel Inspector"
            >
              <Box className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span className="whitespace-nowrap">Single-Round 3D Twin</span>
            </button>

            <div
              className="flex items-center gap-1.5 pl-1 shrink-0 whitespace-nowrap"
              style={{ minWidth: 'max-content' }}
            >
              <span className="font-extrabold text-sm text-slate-900 tracking-tight whitespace-nowrap shrink-0">
                3D Digital Twin Continuous Tunnel Log
              </span>
              <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-mono font-black text-[10px] uppercase tracking-wider shrink-0 whitespace-nowrap">
                MULTI-ROUND 3D CORRIDOR
              </span>
            </div>
          </div>

          {/* Center Project & Location Selectors + Append Next Round */}
          <div
            className="flex items-center gap-2 shrink-0 whitespace-nowrap"
            style={{ minWidth: 'max-content' }}
          >
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 shrink-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                Project:
              </span>
              <select
                value={activeProject?.id || ''}
                onChange={(e) => {
                  const nextProj = store.projects.find(
                    (p) => p.id === e.target.value
                  );
                  if (!nextProj) return;
                  const nextLoc = nextProj.locations[0] || null;
                  const nextRound = store.rounds.find(
                    (r) =>
                      r.projectId === nextProj.id &&
                      r.locationId === nextLoc?.id
                  );
                  const updated: DigitalTwinBetaStore = {
                    ...store,
                    activeProjectId: nextProj.id,
                    activeLocationId: nextLoc?.id || null,
                    activeRoundId: nextRound?.id || null,
                  };
                  saveDigitalTwinBetaStore(updated);
                  setStore(updated);
                  setSelectedRoundId(nextRound?.id || null);
                }}
                className="bg-transparent text-xs font-extrabold text-slate-900 focus:outline-none cursor-pointer"
              >
                {store.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 shrink-0">
              <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                Location:
              </span>
              <select
                value={activeLocation?.id || ''}
                onChange={(e) => {
                  if (!activeProject) return;
                  const nextLoc = activeProject.locations.find(
                    (l) => l.id === e.target.value
                  );
                  if (!nextLoc) return;
                  const nextRound = store.rounds.find(
                    (r) =>
                      r.projectId === activeProject.id &&
                      r.locationId === nextLoc.id
                  );
                  const updated: DigitalTwinBetaStore = {
                    ...store,
                    activeLocationId: nextLoc.id,
                    activeRoundId: nextRound?.id || null,
                  };
                  saveDigitalTwinBetaStore(updated);
                  setStore(updated);
                  setSelectedRoundId(nextRound?.id || null);
                }}
                className="bg-transparent text-xs font-extrabold text-slate-900 focus:outline-none cursor-pointer"
              >
                {(activeProject?.locations || []).map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.widthM}m × {loc.heightM}m)
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleAppendNextConnectedRound}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 cursor-pointer transition-all shrink-0 whitespace-nowrap shadow-xs"
              title="Log & Stitch Next Sequential 3D Excavation Round Along Tunnel Chainage"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">
                + Add Connected 3D Round (CH)
              </span>
            </button>
          </div>

          {/* Right One-Way Sync Status Badge + Convert 3D ➔ 2D Buttons */}
          <div
            className="flex items-center gap-2 shrink-0 whitespace-nowrap"
            style={{ minWidth: 'max-content' }}
          >
            <div
              className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-[11px] font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap"
              title="3D Digital Twin rounds automatically sync one-way to 2D Underground Face Mapping. Reverse 2D ➔ 3D sync is blocked because 2D mapping lacks 20-photo 3D stereo mesh data."
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="whitespace-nowrap">
                Auto-Sync: 3D Twin ➔ 2D Face Mapping
              </span>
              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 font-mono text-[9.5px] font-black flex items-center gap-0.5 shrink-0">
                <Lock className="w-2.5 h-2.5 shrink-0" />
                2D ↛ 3D Blocked
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                handleConvertAndOpen2DFaceMapping(
                  selectedRoundId || undefined,
                  'field_canvas'
                )
              }
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer transition-all shrink-0 whitespace-nowrap shadow-xs"
              title="Convert & Sync all 3D Digital Twin rounds for this Location into normal 2D Underground Face Mapping for Lithology & Official Documentation"
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">
                Convert 3D ➔ 2D Underground Face Mapping
              </span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </div>
      </header>

      {/* Status Toast Banner */}
      {statusToast && (
        <div className="bg-sky-50 border-b border-sky-300 px-4 py-1.5 flex items-center justify-between text-xs text-sky-950 font-semibold shrink-0 z-20">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>{statusToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusToast(null)}
            className="text-sky-700 hover:text-slate-950 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ==================== MAIN SPLIT WORKSPACE (LEFT 60% 3D CORRIDOR / RIGHT 40% ANALYTICS & 3D➔2D CONVERSION) ==================== */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* ==================== LEFT 7 COLUMNS: STITCHED MULTI-ROUND 3D DIGITAL TWIN CORRIDOR VIEWPORT ==================== */}
        <div className="lg:col-span-7 relative flex flex-col bg-[#F8FAFC] border-r border-slate-200 min-h-[380px] overflow-hidden">
          {/* Top-Left Floating 3D Corridor Toolbar */}
          <div className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 py-1.5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar mouse-scrollable whitespace-nowrap z-10 shrink-0">
            <div
              className="flex items-center gap-1.5 shrink-0"
              style={{ minWidth: 'max-content' }}
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 mr-1">
                3D Surface:
              </span>
              {(
                [
                  { id: 'rock_with_break_edges', label: '3D Rock + Break Edges' },
                  { id: 'textured_rock_mesh', label: '20-Photo Textured 3D' },
                  { id: 'overbreak_heatmap', label: '3D Overbreak Heatmap' },
                  { id: 'dense_point_cloud', label: 'Dense 3D Point Cloud' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSurfaceRenderMode(m.id)}
                  className={`px-2 py-1 rounded text-[10.5px] font-bold cursor-pointer transition-all shrink-0 ${
                    surfaceRenderMode === m.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div
              className="flex items-center gap-1 shrink-0"
              style={{ minWidth: 'max-content' }}
            >
              <button
                type="button"
                onClick={() => setShowCrossRoundRibbons((v) => !v)}
                className={`px-2 py-1 rounded text-[10.5px] font-bold border cursor-pointer shrink-0 ${
                  showCrossRoundRibbons
                    ? 'bg-indigo-600 text-white border-indigo-700'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                Cross-Round 3D Continuity ({corridorAnalysis?.crossRoundStructures.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setShow3DDipSurfaces((v) => !v)}
                className={`px-2 py-1 rounded text-[10.5px] font-bold border cursor-pointer shrink-0 ${
                  show3DDipSurfaces
                    ? 'bg-sky-600 text-white border-sky-700'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                3D Dip Polygons
              </button>
              <button
                type="button"
                onClick={() => setShow3DWedges((v) => !v)}
                className={`px-2 py-1 rounded text-[10.5px] font-bold border cursor-pointer shrink-0 ${
                  show3DWedges
                    ? 'bg-amber-600 text-white border-amber-700'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                3D Wedges ({corridorStats.totalWedgesCount})
              </button>
              <button
                type="button"
                onClick={() => setShowDesignWireframe((v) => !v)}
                className={`px-2 py-1 rounded text-[10.5px] font-bold border cursor-pointer shrink-0 ${
                  showDesignWireframe
                    ? 'bg-slate-800 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                Design Wireframe
              </button>
            </div>
          </div>

          {/* Second Sub-Bar: Camera View Presets & Corridor Telemetry */}
          <div className="w-full bg-slate-100/90 border-b border-slate-200 px-3 py-1 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar mouse-scrollable whitespace-nowrap z-10 shrink-0">
            <div
              className="flex items-center gap-1 shrink-0"
              style={{ minWidth: 'max-content' }}
            >
              <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">
                Camera:
              </span>
              {(
                [
                  { id: 'isometric_drive', label: 'Isometric Corridor' },
                  { id: 'portal_to_face', label: 'Portal → Face' },
                  { id: 'crown_arch', label: 'Crown Arch' },
                  { id: 'left_wall', label: 'Left Wall' },
                  { id: 'right_wall', label: 'Right Wall' },
                ] as const
              ).map((cam) => (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => resetCorridorCamera(cam.id)}
                  className="px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 text-[10px] font-bold cursor-pointer shrink-0"
                >
                  {cam.label}
                </button>
              ))}
            </div>

            {corridorAnalysis && (
              <div
                className="flex items-center gap-2 text-[10.5px] font-mono font-bold text-slate-700 shrink-0"
                style={{ minWidth: 'max-content' }}
              >
                <span className="px-2 py-0.5 rounded bg-white border border-slate-300">
                  CH {corridorAnalysis.startChainageM.toFixed(1)}m →{' '}
                  {corridorAnalysis.endChainageM.toFixed(1)}m (
                  {corridorAnalysis.totalMappedLengthM.toFixed(1)}m Drive)
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300">
                  {corridorAnalysis.stitchedRounds.length} Stitched 3D Rounds
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-300">
                  {corridorAnalysis.allWorld3DJoints.length} Validated 3D Joints
                </span>
              </div>
            )}
          </div>

          {/* Three.js Canvas Mount */}
          <div className="relative flex-1 min-h-0 w-full">
            <div ref={viewportContainerRef} className="w-full h-full" />

            {/* Live 2D Cross-Section Overbreak Profile Overlay (Top-Right of 3D Viewport) */}
            {showChainageScrubber && activeChainageSliceInfo && activeLocation && (
              <div className="absolute top-3 right-3 w-56 bg-white/95 backdrop-blur-md border border-slate-300 rounded-xl p-2.5 shadow-md z-10 pointer-events-auto">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                    3D Slice @ CH {activeChainageSliceInfo.slice.chainageM.toFixed(2)}m
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono font-bold text-[9.5px]">
                    R-{activeChainageSliceInfo.segment.round.roundNumber}
                  </span>
                </div>
                <svg
                  viewBox={`${-activeLocation.widthM * 0.72} ${-activeLocation.heightM * 1.15} ${
                    activeLocation.widthM * 1.44
                  } ${activeLocation.heightM * 1.3}`}
                  className="w-full h-28 bg-slate-50 rounded-lg border border-slate-200"
                >
                  {/* Theoretical Design Profile Loop */}
                  <polyline
                    fill="rgba(2,132,199,0.08)"
                    stroke="#0284c7"
                    strokeWidth={0.09}
                    strokeDasharray="0.22 0.14"
                    points={activeChainageSliceInfo.slice.designPoints2D
                      .map((p) => `${p.x.toFixed(3)},${(-p.y).toFixed(3)}`)
                      .join(' ')}
                  />
                  {/* Reconstructed Real-Edge 3D Rock Loop */}
                  <polyline
                    fill="none"
                    stroke="#ea580c"
                    strokeWidth={0.12}
                    points={activeChainageSliceInfo.slice.realRockPoints2D
                      .map((p) => `${p.x.toFixed(3)},${(-p.y).toFixed(3)}`)
                      .join(' ')}
                  />
                </svg>
                <div className="mt-1.5 grid grid-cols-2 gap-1 text-[9.5px] font-mono">
                  <div className="bg-slate-100 rounded px-1.5 py-0.5 text-slate-700">
                    Overbreak:{' '}
                    <strong>
                      +{activeChainageSliceInfo.slice.overbreakAreaM2.toFixed(2)}m²
                    </strong>
                  </div>
                  <div className="bg-orange-50 rounded px-1.5 py-0.5 text-orange-900">
                    Underbreak:{' '}
                    <strong>
                      {activeChainageSliceInfo.slice.underbreakAreaM2.toFixed(2)}m²
                    </strong>
                  </div>
                  <div className="col-span-2 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5 text-rose-900 font-bold">
                    Max Radial Overbreak:{' '}
                    {activeChainageSliceInfo.slice.maxOverbreakCm.toFixed(1)} cm
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Longitudinal Chainage Scrubber Bar */}
            {corridorAnalysis && corridorAnalysis.stitchedRounds.length > 0 && (
              <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-md border border-slate-300 rounded-xl px-3 py-2 shadow-md z-10 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowChainageScrubber((v) => !v)}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold flex items-center gap-1 cursor-pointer border shrink-0 ${
                    showChainageScrubber
                      ? 'bg-sky-600 text-white border-sky-700'
                      : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  <Scissors className="w-3.5 h-3.5 shrink-0" />
                  <span>Chainage Slicer</span>
                </button>

                <span className="text-[11px] font-mono font-bold text-slate-700 shrink-0">
                  CH {corridorAnalysis.startChainageM.toFixed(1)}m
                </span>

                <input
                  type="range"
                  min={corridorAnalysis.startChainageM}
                  max={corridorAnalysis.endChainageM}
                  step={0.1}
                  value={selectedChainageM}
                  onChange={(e) => {
                    setShowChainageScrubber(true);
                    setSelectedChainageM(parseFloat(e.target.value));
                  }}
                  className="flex-1 accent-sky-600 cursor-pointer"
                />

                <span className="text-[11px] font-mono font-bold text-slate-700 shrink-0">
                  CH {corridorAnalysis.endChainageM.toFixed(1)}m
                </span>

                <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-950 border border-sky-300 font-mono font-black text-xs shrink-0">
                  Active Slice: CH {selectedChainageM.toFixed(2)}m
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ==================== RIGHT 5 COLUMNS: 3D ANALYSIS & ONE-WAY 3D➔2D CONVERSION STUDIO ==================== */}
        <div className="lg:col-span-5 flex flex-col bg-white min-h-0 overflow-hidden">
          {/* Right Panel Navigation Tabs */}
          <div className="bg-slate-100 border-b border-slate-200 px-2.5 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar mouse-scrollable whitespace-nowrap shrink-0">
            <button
              type="button"
              onClick={() => setActiveRightTab('rounds_and_2d_sync')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-all ${
                activeRightTab === 'rounds_and_2d_sync'
                  ? 'bg-emerald-600 text-white font-black shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>1. Stitched 3D Rounds &amp; 3D➔2D Sync</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveRightTab('cross_round_continuity')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-all ${
                activeRightTab === 'cross_round_continuity'
                  ? 'bg-indigo-600 text-white font-black shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <Compass className="w-3.5 h-3.5 shrink-0" />
              <span>
                2. Cross-Round 3D Continuity (
                {corridorAnalysis?.crossRoundStructures.length || 0})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveRightTab('longitudinal_analytics')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-all ${
                activeRightTab === 'longitudinal_analytics'
                  ? 'bg-sky-600 text-white font-black shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <Activity className="w-3.5 h-3.5 shrink-0" />
              <span>3. Chainage Profile &amp; 3D Stereonet</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveRightTab('export_audit')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-all ${
                activeRightTab === 'export_audit'
                  ? 'bg-slate-900 text-white font-black shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>4. Export 3D Audit (.CSV / .DXF)</span>
            </button>
          </div>

          {/* ==================== TAB 1: STITCHED 3D ROUNDS & STRICT ONE-WAY 3D ➔ 2D CONVERSION ==================== */}
          {activeRightTab === 'rounds_and_2d_sync' && corridorAnalysis && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Architectural Clarification Card: Why 3D Twin & Continuous 3D Twin Convert One-Way to 2D Face Mapping */}
              <div className="bg-gradient-to-br from-emerald-50 via-white to-sky-50 border-2 border-emerald-400 rounded-xl p-3 shadow-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Strict One-Way Architecture: 3D Analysis ➔ 2D Face Mapping
                    </h3>
                  </div>
                  {lastAutoSyncInfo && (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono font-bold text-[10px]">
                      Synced {lastAutoSyncInfo.syncedCount} Round(s) @{' '}
                      {lastAutoSyncInfo.timestampLabel}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-700 leading-relaxed">
                  <strong>1. 3D Analysis First:</strong> Both{' '}
                  <strong>3D Digital Twin Tunnel</strong> and{' '}
                  <strong>3D Digital Twin Continuous Tunnel Log</strong> are
                  engineered for full 3D structural, overbreak, and cross-round
                  continuity analysis from 20-photo stereo geometry. Because raw
                  3D rock meshes cannot directly host 2D engineering documentation,
                  all rounds logged for this Project &amp; Location automatically
                  unfold and sync <strong>one-way (3D ➔ 2D)</strong> into normal{' '}
                  <strong>Underground Face Mapping</strong>.
                </p>

                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-[10.5px] text-rose-950">
                  <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Reverse Sync Blocked (2D ↛ 3D):</strong> Data created
                    only in normal 2D Underground Face Mapping cannot sync back to
                    3D Digital Twin because 2D sketches do not carry 20-photo
                    stereo depth, 3D surface normals, or real-edge 3D rock meshes.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      handleConvertAndOpen2DFaceMapping(
                        selectedRoundId || undefined,
                        'field_canvas'
                      )
                    }
                    className="py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                    <span>Open Selected Round in 2D Face Mapping</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleConvertAndOpen2DFaceMapping(
                        selectedRoundId || undefined,
                        'strip_align'
                      )
                    }
                    className="py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Sync All &amp; Open 2D Continuous Strip Log</span>
                  </button>
                </div>
              </div>

              {/* Corridor Summary Metrics Strip */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-center">
                  <div className="text-[9.5px] font-bold uppercase text-slate-500">
                    Total Drive
                  </div>
                  <div className="text-sm font-mono font-black text-slate-900">
                    {corridorAnalysis.totalMappedLengthM.toFixed(1)}m
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 text-center">
                  <div className="text-[9.5px] font-bold uppercase text-amber-800">
                    Total Overbreak
                  </div>
                  <div className="text-sm font-mono font-black text-amber-950">
                    {corridorAnalysis.cumulativeOverbreakM3.toFixed(1)}m³
                  </div>
                </div>
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-2 text-center">
                  <div className="text-[9.5px] font-bold uppercase text-sky-800">
                    Mean Q / RMR₈₉
                  </div>
                  <div className="text-sm font-mono font-black text-sky-950">
                    {corridorAnalysis.meanCorridorQValue.toFixed(1)} /{' '}
                    {corridorAnalysis.meanCorridorRmr89}
                  </div>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-2 text-center">
                  <div className="text-[9.5px] font-bold uppercase text-indigo-800">
                    Linked 3D Planes
                  </div>
                  <div className="text-sm font-mono font-black text-indigo-950">
                    {corridorAnalysis.crossRoundStructures.length}
                  </div>
                </div>
              </div>

              {/* Stitched 3D Rounds List (Ordered by Chainage) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Stitched 3D Excavation Rounds ({corridorAnalysis.stitchedRounds.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAppendNextConnectedRound}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Append Next 3D Round</span>
                  </button>
                </div>

                {corridorAnalysis.stitchedRounds.map((seg) => {
                  const isSel = seg.round.id === selectedRoundId;
                  return (
                    <div
                      key={seg.round.id}
                      onClick={() => {
                        setSelectedRoundId(seg.round.id);
                        setSelectedChainageM(
                          Number(
                            (
                              (seg.round.chainageFromM + seg.round.chainageToM) *
                              0.5
                            ).toFixed(2)
                          )
                        );
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSel
                          ? 'bg-sky-50/80 border-2 border-sky-500 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-black text-xs">
                            Round #{seg.round.roundNumber}
                          </span>
                          <span className="font-mono font-extrabold text-xs text-slate-900">
                            CH {seg.round.chainageFromM.toFixed(1)}m →{' '}
                            {seg.round.chainageToM.toFixed(1)}m (
                            {seg.round.pullLengthM.toFixed(1)}m)
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono font-bold text-[10px]">
                          3D➔2D Synced
                        </span>
                      </div>

                      <div className="mt-2 grid grid-cols-4 gap-1.5 text-[10.5px] font-mono">
                        <div className="bg-slate-100 rounded px-2 py-1 text-slate-800">
                          3D Joints: <strong>{seg.validJointCount}</strong>
                        </div>
                        <div className="bg-amber-50 rounded px-2 py-1 text-amber-900">
                          Overbreak:{' '}
                          <strong>{seg.overbreakVolumeM3.toFixed(1)}m³</strong>
                        </div>
                        <div className="bg-sky-50 rounded px-2 py-1 text-sky-900">
                          Q-Index: <strong>{seg.estimatedQValue.toFixed(1)}</strong>
                        </div>
                        <div className="bg-indigo-50 rounded px-2 py-1 text-indigo-900">
                          RMR₈₉: <strong>{seg.estimatedRmr89}</strong>
                        </div>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!activeProject || !activeLocation) return;
                            onOpenSingleRoundIn3DTwin(
                              activeProject.id,
                              activeLocation.id,
                              seg.round.id,
                              'joint_dip_inspector_window'
                            );
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold text-[10.5px] flex items-center gap-1 cursor-pointer"
                        >
                          <Compass className="w-3 h-3 text-indigo-600" />
                          <span>Inspect / Edit 3D Joints</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!activeProject || !activeLocation) return;
                            onOpenSingleRoundIn3DTwin(
                              activeProject.id,
                              activeLocation.id,
                              seg.round.id,
                              'unfold_3d_to_2d'
                            );
                          }}
                          className="px-2.5 py-1 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-900 border border-violet-300 font-bold text-[10.5px] flex items-center gap-1 cursor-pointer"
                        >
                          <Box className="w-3 h-3 text-violet-600" />
                          <span>Open 3D→2D Window in Twin</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConvertAndOpen2DFaceMapping(
                              seg.round.id,
                              'field_canvas'
                            );
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10.5px] flex items-center gap-1 cursor-pointer ml-auto"
                        >
                          <Layers className="w-3 h-3" />
                          <span>Convert ➔ 2D Face Mapping</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================== TAB 2: CROSS-ROUND 3D JOINT, BEDDING & FAULT CONTINUITY ==================== */}
          {activeRightTab === 'cross_round_continuity' && corridorAnalysis && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-2.5 text-xs text-indigo-950">
                <strong>Multi-Round 3D Structural Continuity Engine:</strong>{' '}
                Automatically links 3D joints, bedding planes, and faults across
                consecutive 3D Digital Twin rounds using spherical normal
                alignment (&le;18&deg;), zone proximity, and strike projection.
                Click any structure below to highlight its 3D continuity ribbon
                in the corridor viewport.
              </div>

              {corridorAnalysis.crossRoundStructures.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-600">
                  Add at least 2 connected rounds to compute cross-round 3D
                  structural persistence ribbons.
                </div>
              ) : (
                <div className="space-y-2">
                  {corridorAnalysis.crossRoundStructures.map((link) => {
                    const isSel = selectedContinuityId === link.id;
                    return (
                      <div
                        key={link.id}
                        onClick={() =>
                          setSelectedContinuityId((prev) =>
                            prev === link.id ? null : link.id
                          )
                        }
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isSel
                            ? 'bg-amber-50 border-2 border-amber-500 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: link.colorHex }}
                            />
                            <span className="font-mono font-black text-xs text-slate-900">
                              {link.code} • {link.setId}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-950 font-mono font-bold text-[10px]">
                            Spans Rounds{' '}
                            {link.spannedRoundNumbers
                              .map((n) => `#${n}`)
                              .join(' → ')}
                          </span>
                        </div>

                        <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10.5px] font-mono">
                          <div className="bg-slate-100 rounded px-2 py-1 text-slate-800">
                            Dip / DipDir:{' '}
                            <strong>
                              {link.meanDipDeg}° / {link.meanDipDirectionDeg}°
                            </strong>
                          </div>
                          <div className="bg-slate-100 rounded px-2 py-1 text-slate-800">
                            3D Persistence:{' '}
                            <strong>
                              {link.cumulativePersistenceM.toFixed(1)}m
                            </strong>
                          </div>
                          <div className="bg-slate-100 rounded px-2 py-1 text-slate-800">
                            Fisher κ / Conf:{' '}
                            <strong>
                              {link.meanFisherKappa} ({link.meanConfidencePct}%)
                            </strong>
                          </div>
                        </div>

                        <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-slate-600 font-mono">
                          <span>
                            Zones: <strong>{link.zoneSummary}</strong>
                          </span>
                          <span>
                            Chainage: CH {link.chainageStartM.toFixed(1)}m →{' '}
                            {link.chainageEndM.toFixed(1)}m
                          </span>
                          <span>
                            Mean Aperture: {link.meanApertureMm.toFixed(1)}mm
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB 3: LONGITUDINAL CHAINAGE PROFILE & MULTI-ROUND 3D STEREONET ==================== */}
          {activeRightTab === 'longitudinal_analytics' && corridorAnalysis && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Longitudinal Chainage Analytics Chart */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Longitudinal Chainage Profile (3D Overbreak, Q &amp; RMR₈₉)
                  </h4>
                  <span className="text-[10px] font-mono font-bold text-slate-500">
                    CH {corridorAnalysis.startChainageM.toFixed(1)}m →{' '}
                    {corridorAnalysis.endChainageM.toFixed(1)}m
                  </span>
                </div>

                <svg
                  viewBox="0 0 460 175"
                  className="w-full h-44 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  {/* Horizontal Grid Lines */}
                  {[30, 65, 100, 135].map((y) => (
                    <line
                      key={y}
                      x1={42}
                      y1={y}
                      x2={440}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeWidth={1}
                    />
                  ))}
                  {/* Bars & Polylines per Round */}
                  {corridorAnalysis.stitchedRounds.map((seg, idx) => {
                    const count = Math.max(
                      1,
                      corridorAnalysis.stitchedRounds.length
                    );
                    const slotW = 380 / count;
                    const cx = 50 + idx * slotW + slotW * 0.5;
                    const barW = Math.min(44, slotW * 0.55);

                    const obVol = seg.overbreakVolumeM3;
                    const maxObVol = Math.max(
                      25,
                      ...corridorAnalysis.stitchedRounds.map(
                        (s) => s.overbreakVolumeM3
                      )
                    );
                    const obH = Math.min(95, (obVol / maxObVol) * 95);
                    const rmrY = 140 - (seg.estimatedRmr89 / 100) * 105;

                    return (
                      <g key={seg.round.id}>
                        {/* Overbreak Volume Bar */}
                        <rect
                          x={cx - barW * 0.5}
                          y={140 - obH}
                          width={barW}
                          height={obH}
                          rx={4}
                          fill="#f59e0b"
                          opacity={0.85}
                        />
                        <text
                          x={cx}
                          y={140 - obH - 4}
                          textAnchor="middle"
                          fontSize={9}
                          fontWeight="bold"
                          fill="#92400e"
                        >
                          {obVol.toFixed(1)}m³
                        </text>

                        {/* RMR89 Node */}
                        <circle
                          cx={cx}
                          cy={rmrY}
                          r={4.5}
                          fill="#0284c7"
                          stroke="#ffffff"
                          strokeWidth={1.5}
                        />
                        <text
                          x={cx}
                          y={rmrY - 7}
                          textAnchor="middle"
                          fontSize={9}
                          fontWeight="bold"
                          fill="#0369a1"
                        >
                          RMR {seg.estimatedRmr89} (Q={seg.estimatedQValue.toFixed(1)})
                        </text>

                        {/* X-Axis Round & Chainage Label */}
                        <text
                          x={cx}
                          y={156}
                          textAnchor="middle"
                          fontSize={9.5}
                          fontWeight="bold"
                          fill="#0f172a"
                        >
                          R-{seg.round.roundNumber} (CH{' '}
                          {seg.round.chainageFromM.toFixed(0)}–
                          {seg.round.chainageToM.toFixed(0)}m)
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Multi-Round Lower-Hemisphere Equal-Area 3D Stereonet & Eigenvalue Fabric */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Corridor Lower-Hemisphere Stereonet &amp; 3D Eigenvalue Tensor
                  </h4>
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 border border-indigo-200 font-mono font-bold text-[10px]">
                    {corridorStats.shapeCategory} (K={corridorStats.woodcockK})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <svg
                    viewBox="-115 -115 230 230"
                    className="w-44 h-44 mx-auto bg-slate-50 rounded-full border border-slate-200"
                  >
                    <circle
                      cx={0}
                      cy={0}
                      r={95}
                      fill="#ffffff"
                      stroke="#334155"
                      strokeWidth={1.5}
                    />
                    <circle
                      cx={0}
                      cy={0}
                      r={63}
                      fill="none"
                      stroke="#cbd5e1"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={0}
                      cy={0}
                      r={31}
                      fill="none"
                      stroke="#cbd5e1"
                      strokeDasharray="3 3"
                    />
                    <line
                      x1={-95}
                      y1={0}
                      x2={95}
                      y2={0}
                      stroke="#cbd5e1"
                      strokeWidth={1}
                    />
                    <line
                      x1={0}
                      y1={-95}
                      x2={0}
                      y2={95}
                      stroke="#cbd5e1"
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={-100}
                      textAnchor="middle"
                      fontSize={9}
                      fontWeight="bold"
                      fill="#0f172a"
                    >
                      N
                    </text>

                    {/* Plot poles of all validated 3D joints across the stitched corridor */}
                    {corridorAnalysis.stitchedRounds.flatMap((seg) =>
                      seg.world3DJoints
                        .filter(
                          (j) => j.status !== 'Rejected Shadow / Disturbance'
                        )
                        .map((j) => {
                          const poleTrendDeg = (j.dipDirectionDeg + 180) % 360;
                          const polePlungeDeg = 90 - j.dipDeg;
                          const r =
                            95 *
                            Math.SQRT2 *
                            Math.sin(
                              ((90 - polePlungeDeg) * 0.5 * Math.PI) / 180
                            );
                          const rad = ((poleTrendDeg - 90) * Math.PI) / 180;
                          const px = r * Math.cos(rad);
                          const py = r * Math.sin(rad);
                          return (
                            <circle
                              key={`${seg.round.id}-${j.id}`}
                              cx={px}
                              cy={py}
                              r={3.5}
                              fill={j.colorHex}
                              stroke="#0f172a"
                              strokeWidth={0.6}
                            />
                          );
                        })
                    )}
                  </svg>

                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">
                        Normalized 3D Orientation Eigenvalues
                      </div>
                      <div className="mt-1 grid grid-cols-3 gap-1 text-center">
                        <div className="bg-white border border-slate-200 rounded p-1">
                          <div className="text-[9px] text-slate-500">λ₁</div>
                          <div className="font-black text-slate-900">
                            {corridorAnalysis.globalEigenvalues[0]}
                          </div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded p-1">
                          <div className="text-[9px] text-slate-500">λ₂</div>
                          <div className="font-black text-slate-900">
                            {corridorAnalysis.globalEigenvalues[1]}
                          </div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded p-1">
                          <div className="text-[9px] text-slate-500">λ₃</div>
                          <div className="font-black text-slate-900">
                            {corridorAnalysis.globalEigenvalues[2]}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950">
                      <div>
                        Corridor Min Factor of Safety:{' '}
                        <strong>{corridorStats.minFoS.toFixed(2)}</strong>
                      </div>
                      <div>
                        Total 3D Key-Block Wedges:{' '}
                        <strong>
                          {corridorStats.totalWedgesCount} (
                          {corridorAnalysis.totalCriticalWedges} Critical)
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 4: EXPORT CONTINUOUS 3D AUDIT (.CSV / .DXF) ==================== */}
          {activeRightTab === 'export_audit' && corridorAnalysis && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3 shadow-xs">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Export Multi-Round 3D Digital Twin Corridor Deliverables
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Export the stitched multi-round 3D Digital Twin corridor audit
                  table (<strong>.CSV</strong>) or 3D CAD geometry (
                  <strong>.DXF</strong> with 3D joint traces, 3D dip polygons,
                  design wireframes, and cross-round 3D continuity ribbons), or
                  convert directly into the 2D Underground Face Mapping &amp; Strip
                  Log workspace for official engineering sheet printing.
                </p>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      exportContinuous3DDigitalTwinAuditToCSV(corridorAnalysis)
                    }
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center justify-between cursor-pointer shadow-xs"
                  >
                    <span className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-emerald-400" />
                      <span>
                        Export Continuous 3D Corridor Audit Spreadsheet (.CSV)
                      </span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-300">
                      Rounds + Cross-Round 3D Links
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      exportContinuous3DDigitalTwinCorridorToDXF(corridorAnalysis)
                    }
                    className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center justify-between cursor-pointer shadow-xs"
                  >
                    <span className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-amber-300" />
                      <span>
                        Export Multi-Round 3D CAD Corridor &amp; Ribbons (.DXF)
                      </span>
                    </span>
                    <span className="font-mono text-[10px] text-indigo-100">
                      AutoCAD / Civil 3D Ready
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleConvertAndOpen2DFaceMapping(
                        selectedRoundId || undefined,
                        'field_canvas'
                      )
                    }
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-between cursor-pointer shadow-xs"
                  >
                    <span className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-white" />
                      <span>
                        Convert 3D Corridor ➔ Open 2D Underground Face Mapping
                      </span>
                    </span>
                    <span className="font-mono text-[10px] text-emerald-100">
                      Add Lithology &amp; Print 2D Report
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
