import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Calculator,
  CheckCircle2,
  Code2,
  Compass,
  Copy,
  Download,
  Eye,
  GitMerge,
  Layers,
  Play,
  Ruler,
  Sliders,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  Joint,
  JointSet,
  PhotoSurface,
  Point2D,
  SurfaceType,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import {
  ContinuousTunnelStripDataset as ContinuousStripDataset,
  ContinuousStripTrace,
  resolveStripTraceColor,
} from '../engine/continuous3DStripEngine';
import {
  extractRealtimeMatlabTraceAtUV,
  extractTwoPointMatlabSnakeTrace,
  FaceCollinearJoinCandidate,
  FaceToWallCrossProductPair,
  getJointSetId,
  getJointTraceAngle,
  runFullMatlabJointMatrixAnalysis,
  runTraicAiFractureTraceSegmentation,
  TraicExtractionEngineMode,
  TraicSegmentedTraceCandidate,
  TraicSegmentationParams,
  TraicSegmentationResult,
  WallCrownSvdJoinCandidate,
} from '../engine/matlabJointMatrixEngine';

export type MatlabAnalyzerTab =
  | 'TRAIC_AI_SEGMENTATION'
  | 'JOINT_NETWORK_3D_PCA_SVD'
  | 'FACE_JOIN_AND_BLOCKS'
  | 'WALL_CROWN_3D_SVD'
  | 'FACE_WALL_CROSS_PRODUCT'
  | 'MATLAB_SCRIPT_CONSOLE';

type TraicVisualStage =
  | 'CLAHE_NORMALIZED'
  | 'PROBABILITY_HEATMAP'
  | 'SKELETON_MASK'
  | 'PHASE_CONGRUENCY_STEGER'
  | 'VECTOR_TRACES_OVERLAY';

type TraicInteractiveToolMode =
  | 'SELECT_INSPECT'
  | 'ONE_CLICK_SEED_SNAKE'
  | 'TWO_POINT_GEODESIC_SNAKE'
  | 'ROI_BOX_EXTRACT';

interface MatlabJointAnalyzerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: MatlabAnalyzerTab;
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  photos?: Record<SurfaceType, PhotoSurface>;
  activeSurface?: SurfaceType;
  joints: Joint[];
  jointSets: JointSet[];
  onUpdateJoints?: (nextJoints: Joint[]) => void;
  stripDataset?: ContinuousStripDataset | null;
  onUpdateStripDataset?: (
    updater: (prev: ContinuousStripDataset) => ContinuousStripDataset
  ) => void;
  onStatusMessage?: (msg: string) => void;
}

export const MatlabJointAnalyzerModal: React.FC<MatlabJointAnalyzerModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'TRAIC_AI_SEGMENTATION',
  geometry,
  settings,
  photos,
  activeSurface = 'face',
  joints,
  jointSets,
  onUpdateJoints,
  stripDataset,
  onUpdateStripDataset,
  onStatusMessage,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [activeTab, setActiveTab] = useState<MatlabAnalyzerTab>(initialTab);
  const [selectedFacePairId, setSelectedFacePairId] = useState<string | null>(null);
  const [selectedSvdJoinId, setSelectedSvdJoinId] = useState<string | null>(null);
  const [selectedCrossId, setSelectedCrossId] = useState<string | null>(null);
  const [selected3DPlaneJointId, setSelected3DPlaneJointId] = useState<string | null>(null);
  const [dfnFilterSetId, setDfnFilterSetId] = useState<string>('ALL');
  const [dfnCameraYawDeg, setDfnCameraYawDeg] = useState<number>(-34);
  const [dfnCameraPitchDeg, setDfnCameraPitchDeg] = useState<number>(24);
  const [showDfnDiscs, setShowDfnDiscs] = useState<boolean>(true);
  const [showDfnNormals, setShowDfnNormals] = useState<boolean>(true);
  const [showDfnSpacingBars, setShowDfnSpacingBars] = useState<boolean>(true);
  const [copiedScript, setCopiedScript] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // TRaiC AI Fracture & Trace Segmentation State
  const [traicSurface, setTraicSurface] = useState<SurfaceType>(activeSurface);
  const [traicVisualStage, setTraicVisualStage] =
    useState<TraicVisualStage>('VECTOR_TRACES_OVERLAY');
  const [traicParams, setTraicParams] = useState<TraicSegmentationParams>({
    probabilityThreshold: 0.42,
    minPersistenceMeters: 0.5,
    collinearLinkGapMeters: 0.45,
    spurPruneIterations: 5,
    extractionEngine: 'HYBRID_ENSEMBLE',
    activeContourIterations: 6,
    roiBoxUV: null,
  });
  const [traicResult, setTraicResult] = useState<TraicSegmentationResult | null>(
    null
  );
  const [selectedTraicTraceIds, setSelectedTraicTraceIds] = useState<Set<string>>(
    new Set()
  );
  const [isRunningTraic, setIsRunningTraic] = useState(false);

  // Real-Time Interactive MATLAB Trace Extraction Tools (Hover Seed Snake, 2-Pt Geodesic Snake, ROI Box)
  const [traicToolMode, setTraicToolMode] =
    useState<TraicInteractiveToolMode>('ONE_CLICK_SEED_SNAKE');
  const [hoverPreviewCandidate, setHoverPreviewCandidate] =
    useState<TraicSegmentedTraceCandidate | null>(null);
  const [twoPtStartUV, setTwoPtStartUV] = useState<Point2D | null>(null);
  const [roiDragStartUV, setRoiDragStartUV] = useState<Point2D | null>(null);
  const [roiDraftUV, setRoiDraftUV] = useState<{
    minU: number;
    minV: number;
    maxU: number;
    maxV: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setTraicSurface(activeSurface);
      setHoverPreviewCandidate(null);
      setTwoPtStartUV(null);
      setRoiDragStartUV(null);
    }
  }, [isOpen, initialTab, activeSurface]);

  // Run TRaiC AI Fracture & Trace Segmentation whenever modal opens or surface/params change
  const executeTraicSegmentation = async (
    targetSurf: SurfaceType = traicSurface,
    customParams: TraicSegmentationParams = traicParams
  ) => {
    setIsRunningTraic(true);
    try {
      const res = await runTraicAiFractureTraceSegmentation(
        targetSurf,
        photos?.[targetSurf],
        geometry,
        settings,
        customParams
      );
      setTraicResult(res);
      setSelectedTraicTraceIds(new Set(res.segmentedTraces.map((t) => t.id)));
    } finally {
      setIsRunningTraic(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      executeTraicSegmentation(traicSurface, traicParams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, traicSurface]);

  const report = useMemo(
    () =>
      runFullMatlabJointMatrixAnalysis(
        joints,
        geometry,
        settings,
        stripDataset
      ),
    [joints, geometry, settings, stripDataset]
  );

  if (!isOpen) return null;

  const faceJoints = joints.filter(
    (j) => j.surface === 'face' && j.geometry && j.geometry.length >= 2
  );

  const getSetColor = (setId: string) => {
    const found = jointSets.find((s) => s.id === setId);
    return found?.color || resolveStripTraceColor(setId, 'Joint');
  };

  // Handler: Apply Selected TRaiC Segmented Traces to Active Surface
  const handleApplyTraicTracesToWorkspace = () => {
    if (!onUpdateJoints || !traicResult) return;
    const chosen = traicResult.segmentedTraces
      .filter((t) => selectedTraicTraceIds.has(t.id))
      .map((t) => t.jointObject);
    if (chosen.length === 0) return;

    onUpdateJoints([...joints, ...chosen]);
    const surfLabel =
      traicSurface === 'face'
        ? '1. Face'
        : traicSurface === 'crown'
        ? '2. Crown'
        : traicSurface === 'leftWall'
        ? '3. Left Wall'
        : '4. Right Wall';
    const msg = `TRaiC AI Fracture & Trace Segmentation: Added ${chosen.length} segmented discontinuity trace(s) to ${surfLabel} (P₂₁=${traicResult.meanFractureDensityP21} m/m²).`;
    setBannerNotice(msg);
    onStatusMessage?.(msg);
  };

  // Handler: Join a single collinear pair of Face joints while preserving exact Dip, Dip Direction & Trace Angle
  const handleJoinFaceCollinearPair = (cand: FaceCollinearJoinCandidate) => {
    if (!onUpdateJoints) return;
    const totalLengthM = cand.mergedPoints2D.reduce((acc, pt, idx, arr) => {
      if (idx === 0) return 0;
      return acc + Math.hypot(pt.x - arr[idx - 1].x, pt.y - arr[idx - 1].y);
    }, 0);

    const mergedJoint: Joint = {
      ...cand.jointA,
      geometry: cand.mergedPoints2D,
      aiOriginalGeometry: cand.mergedPoints2D,
      persistenceMeters: Number(totalLengthM.toFixed(2)),
      dip: cand.preservedDip,
      dipDirection: cand.preservedDipDirection,
      traceAngle: cand.preservedTraceAngleDeg,
      annotationNote: `MATLAB 2D PCA Collinear Joined (${cand.jointA.id} + ${cand.jointB.id}, σ_⊥=${cand.perpendicularResidualM}m)`,
    };

    const nextJoints = joints
      .filter((j) => j.id !== cand.jointB.id)
      .map((j) => (j.id === cand.jointA.id ? mergedJoint : j));

    onUpdateJoints(nextJoints);
    const msg = `MATLAB PCA Joined Face traces ${cand.jointA.id} + ${cand.jointB.id} (${cand.setId}) with σ_⊥=${cand.perpendicularResidualM}m while preserving DipDir/Dip ${cand.preservedDipDirection}°/${cand.preservedDip}°.`;
    setBannerNotice(msg);
    onStatusMessage?.(msg);
  };

  // Handler: Join ALL collinear Face joint pairs in one click
  const handleJoinAllFaceCollinear = () => {
    if (!onUpdateJoints || report.faceCollinearCandidates.length === 0) return;
    const consumedIds = new Set<string>();
    const replacements = new Map<string, Joint>();
    const toRemove = new Set<string>();
    let joinedCount = 0;

    for (const cand of report.faceCollinearCandidates) {
      if (
        consumedIds.has(cand.jointA.id) ||
        consumedIds.has(cand.jointB.id)
      ) {
        continue;
      }
      consumedIds.add(cand.jointA.id);
      consumedIds.add(cand.jointB.id);
      toRemove.add(cand.jointB.id);

      const totalLengthM = cand.mergedPoints2D.reduce((acc, pt, idx, arr) => {
        if (idx === 0) return 0;
        return acc + Math.hypot(pt.x - arr[idx - 1].x, pt.y - arr[idx - 1].y);
      }, 0);

      replacements.set(cand.jointA.id, {
        ...cand.jointA,
        geometry: cand.mergedPoints2D,
        aiOriginalGeometry: cand.mergedPoints2D,
        persistenceMeters: Number(totalLengthM.toFixed(2)),
        dip: cand.preservedDip,
        dipDirection: cand.preservedDipDirection,
        traceAngle: cand.preservedTraceAngleDeg,
      });
      joinedCount++;
    }

    const nextJoints = joints
      .filter((j) => !toRemove.has(j.id))
      .map((j) => replacements.get(j.id) || j);

    onUpdateJoints(nextJoints);
    const msg = `MATLAB Auto-Joined ${joinedCount} collinear Face joint pair(s) while preserving exact Trace & Dip angles.`;
    setBannerNotice(msg);
    onStatusMessage?.(msg);
  };

  // Handler: Add sample split collinear Face traces so user can test MATLAB joining anytime
  const handleAddSampleSplitFaceTraces = () => {
    if (!onUpdateJoints) return;
    const w = geometry.width || 6.0;
    const h = geometry.height || (geometry.wallHeight || 4.2) + 2.5;
    const now = Date.now();
    const defaultBreakdown = {
      detection: 92,
      trace: 90,
      geometric: 91,
      orientation: 89,
    };
    const sampleJoints: Joint[] = [
      {
        id: `F-MAT-${now}-1A`,
        set: 'J1',
        featureType: 'joint',
        surface: 'face',
        geometry: [
          { x: Number((-w * 0.38).toFixed(2)), y: Number((h * 0.22).toFixed(2)) },
          { x: Number((-w * 0.08).toFixed(2)), y: Number((h * 0.44).toFixed(2)) },
        ],
        persistenceMeters: 2.6,
        traceAngle: 36.5,
        apparentDip: 36.5,
        dip: 62,
        dipDirection: 135,
        strike: 45,
        orientationStatus: 'DIRECTLY_MEASURED',
        confidence: 'High',
        confidenceScore: 0.92,
        confidenceBreakdown: defaultBreakdown,
        source: 'AI_HYBRID',
        accepted: true,
        roughness: 'Rough / Undulating',
        infilling: 'Clean',
        apertureMm: '1.5 mm',
        waterCondition: 'Dry',
      },
      {
        id: `F-MAT-${now}-1B`,
        set: 'J1',
        featureType: 'joint',
        surface: 'face',
        geometry: [
          { x: Number((w * 0.04).toFixed(2)), y: Number((h * 0.53).toFixed(2)) },
          { x: Number((w * 0.36).toFixed(2)), y: Number((h * 0.77).toFixed(2)) },
        ],
        persistenceMeters: 2.8,
        traceAngle: 36.8,
        apparentDip: 36.8,
        dip: 62,
        dipDirection: 135,
        strike: 45,
        orientationStatus: 'DIRECTLY_MEASURED',
        confidence: 'High',
        confidenceScore: 0.91,
        confidenceBreakdown: defaultBreakdown,
        source: 'AI_HYBRID',
        accepted: true,
        roughness: 'Rough / Undulating',
        infilling: 'Clean',
        apertureMm: '1.5 mm',
        waterCondition: 'Dry',
      },
      {
        id: `F-MAT-${now}-2X`,
        set: 'J2',
        featureType: 'joint',
        surface: 'face',
        geometry: [
          { x: Number((-w * 0.32).toFixed(2)), y: Number((h * 0.76).toFixed(2)) },
          { x: Number((w * 0.34).toFixed(2)), y: Number((h * 0.24).toFixed(2)) },
        ],
        persistenceMeters: 5.1,
        traceAngle: 141.5,
        apparentDip: 38.5,
        dip: 58,
        dipDirection: 245,
        strike: 155,
        orientationStatus: 'DIRECTLY_MEASURED',
        confidence: 'High',
        confidenceScore: 0.93,
        confidenceBreakdown: defaultBreakdown,
        source: 'AI_HYBRID',
        accepted: true,
        roughness: 'Smooth / Planar',
        infilling: 'Quartz',
        apertureMm: '2.0 mm',
        waterCondition: 'Dry',
      },
    ];
    onUpdateJoints([...joints, ...sampleJoints]);
    setBannerNotice(
      'Added split collinear J1 Face segments + intersecting J2 trace. Click "Join Pair" to merge via MATLAB 2D PCA!'
    );
  };

  // Handler: Join a single 3D Strip SVD Coplanar Candidate
  const handleJoinStripSvdCandidate = (cand: WallCrownSvdJoinCandidate) => {
    if (!onUpdateStripDataset || !stripDataset) return;
    onUpdateStripDataset((prev) => {
      const nextTraces: ContinuousStripTrace[] = [];
      for (const tr of prev.traces) {
        if (tr.id === cand.traceBId) continue;
        if (tr.id === cand.traceAId) {
          nextTraces.push({
            ...tr,
            points: cand.mergedStripPts,
            aiAlignedPoints: cand.mergedStripPts,
            dipDirectionDeg: cand.preservedDipDirectionDeg,
            dipDeg: cand.preservedDipDeg,
          });
        } else {
          nextTraces.push(tr);
        }
      }
      return { ...prev, traces: nextTraces };
    });
    const msg = `MATLAB 3D SVD Joined Strip Traces (${cand.labelA} + ${cand.labelB}) with RMS=${cand.rmsCoplanarityErrorM}m while keeping DipDir/Dip ${cand.preservedDipDirectionDeg}°/${cand.preservedDipDeg}° identical.`;
    setBannerNotice(msg);
    onStatusMessage?.(msg);
  };

  // Handler: Auto-Join all high-confidence 3D Strip SVD Coplanar Candidates
  const handleJoinAllStripSvdCandidates = () => {
    if (!onUpdateStripDataset || !stripDataset || report.wallCrownJoinCandidates.length === 0)
      return;
    const consumed = new Set<string>();
    const removeIds = new Set<string>();
    const updates = new Map<string, Point2D[]>();
    let count = 0;

    for (const cand of report.wallCrownJoinCandidates) {
      if (consumed.has(cand.traceAId) || consumed.has(cand.traceBId)) continue;
      consumed.add(cand.traceAId);
      consumed.add(cand.traceBId);
      removeIds.add(cand.traceBId);
      updates.set(cand.traceAId, cand.mergedStripPts);
      count++;
    }

    onUpdateStripDataset((prev) => ({
      ...prev,
      traces: prev.traces
        .filter((t) => !removeIds.has(t.id))
        .map((t) => {
          const mergedPts = updates.get(t.id);
          return mergedPts
            ? { ...t, points: mergedPts, aiAlignedPoints: mergedPts }
            : t;
        }),
    }));

    const msg = `MATLAB 3D SVD Auto-Joined ${count} coplanar Wall/Crown trace pair(s) across the 90°-CW 3D strip.`;
    setBannerNotice(msg);
    onStatusMessage?.(msg);
  };

  // Handler: Apply Cross-Product True Dip & Dip Direction to matched Face & Wall joints
  const handleApplyCrossProductOrientation = (pair: FaceToWallCrossProductPair) => {
    if (!onUpdateJoints) return;
    const nextJoints = joints.map((j) => {
      if (j.id === pair.faceJoint.id || j.id === pair.wallJoint.id) {
        return {
          ...j,
          dipDirection: pair.trueDipDirectionDeg,
          dip: pair.trueDipDeg,
          strike: pair.trueStrikeDeg,
          orientationStatus: 'DIRECTLY_MEASURED' as const,
        };
      }
      return j;
    });
    onUpdateJoints(nextJoints);
    const msg = `Applied MATLAB Cross-Product (n = t_face × t_wall) True Orientation ${String(pair.trueDipDirectionDeg).padStart(3, '0')}/${String(pair.trueDipDeg).padStart(2, '0')} to ${getJointSetId(pair.faceJoint)}.`;
    setBannerNotice(msg);
    onStatusMessage?.(msg);
  };

  // Download MATLAB .m script
  const handleDownloadMatlabScript = () => {
    const blob = new Blob([report.matlabScriptCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eswa_traic_matlab_joint_matrix_${(settings.chainage || 'tunnel').replace(/[^a-zA-Z0-9_-]/g, '_')}.m`;
    a.click();
    URL.revokeObjectURL(url);
    setBannerNotice('Downloaded runnable TRaiC + MATLAB script (.m) for desktop MATLAB.');
  };

  // Download 3D Matrix CSV
  const handleDownloadMatrixCsv = () => {
    const rows: string[] = [
      'TraceID,SourceType,SetID,PointCount,Sigma1,Sigma2,Sigma3,RMS_Residual_m,Normal_X,Normal_Y,Normal_Z,Preserved_DipDir_Deg,Preserved_Dip_Deg',
    ];
    for (const p of report.wallCrownSvdPlanes) {
      rows.push(
        `${p.traceId},${p.sourceType},${p.setId},${p.pointCount},${p.singularValues[0]},${p.singularValues[1]},${p.singularValues[2]},${p.rmsPlanarityResidualM},${p.unitNormal3D.x},${p.unitNormal3D.y},${p.unitNormal3D.z},${p.preservedDipDirectionDeg},${p.preservedDipDeg}`
      );
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eswa_3d_svd_joint_matrix.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setBannerNotice('Exported 3D SVD Joint Matrix (.csv) for MATLAB / Excel.');
  };

  // Handler: Sync 3D PCA/SVD Dip, Dip Direction, 3D Persistence & Set Spacing to mapped joints
  const handleSync3DPcaSvdToProject = () => {
    if (!onUpdateJoints) return;
    const nodeByJointId = new Map(
      report.jointNetwork3DPcaSvd.planeNodes.map((n) => [n.jointId, n])
    );
    const setSummaryById = new Map(
      report.jointNetwork3DPcaSvd.setSummaries.map((s) => [s.setId, s])
    );

    const nextJoints = joints.map((j) => {
      const node = nodeByJointId.get(j.id);
      if (!node) return j;
      const setSum = setSummaryById.get(node.setId);
      const spacingVal =
        node.normalSpacingToPrevMeters ?? setSum?.meanNormalSpacingMeters ?? 0.65;
      return {
        ...j,
        dipDirection: node.pcaDipDirectionDeg,
        dip: node.pcaDipDeg,
        strike: node.pcaStrikeDeg,
        persistenceMeters: node.tracePersistence3DMeters,
        trueSpacingMeters: spacingVal,
        annotationNote: `3D PCA/SVD Plane Fit: DipDir/Dip=${String(node.pcaDipDirectionDeg).padStart(3, '0')}/${String(node.pcaDipDeg).padStart(2, '0')} | L_3D=${node.tracePersistence3DMeters}m | S_normal=${spacingVal}m`,
      };
    });

    onUpdateJoints(nextJoints);
    const msg = `Synced 3D PCA/SVD Plane Fitting (Dip, Dip Direction, 3D Persistence L_3D, and True Normal Spacing S_normal) across ${report.jointNetwork3DPcaSvd.planeNodes.length} joint trace(s).`;
    setBannerNotice(msg);
    onStatusMessage?.(msg);
  };

  // Handler: Export 3D Joint Network & Plane Fitting (PCA/SVD) CSV
  const handleDownload3DPlaneNetworkCsv = () => {
    const rows: string[] = [
      'JointID,Surface,SetID,Vertices,Centroid_X,Centroid_Y,Centroid_Z,Sigma1,Sigma2,Sigma3,PlanarityIndex,RMS_Residual_m,Normal_Vx,Normal_Vy,Normal_Vz,DipDirection_Deg,Dip_Deg,Strike_Deg,Persistence_3D_m,Chord_3D_m,NormalProj_d_m,TrueNormalSpacing_S_m',
    ];
    for (const n of report.jointNetwork3DPcaSvd.planeNodes) {
      rows.push(
        `${n.jointId},${n.surface},${n.setId},${n.vertexCount},${n.centroid3D.x},${n.centroid3D.y},${n.centroid3D.z},${n.singularValues[0]},${n.singularValues[1]},${n.singularValues[2]},${n.planarityIndex},${n.rmsResidualMeters},${n.unitNormalV3.x},${n.unitNormalV3.y},${n.unitNormalV3.z},${n.pcaDipDirectionDeg},${n.pcaDipDeg},${n.pcaStrikeDeg},${n.tracePersistence3DMeters},${n.chordLength3DMeters},${n.normalProjectionMeters},${n.normalSpacingToPrevMeters ?? ''}`
      );
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eswa_3d_pca_svd_plane_persistence_spacing.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setBannerNotice('Exported 3D PCA/SVD Plane Fitting, Persistence & Normal Spacing (.csv).');
  };

  // Face SVG coordinate mapping helper
  const totalH = geometry.height || (geometry.wallHeight || 4.2) + 2.5;
  const faceSvgW = 540;
  const faceSvgH = 380;
  const pad = 38;
  const scaleFace = Math.min(
    (faceSvgW - pad * 2) / Math.max(1, geometry.width || 6.0),
    (faceSvgH - pad * 2) / Math.max(1, totalH)
  );
  const mapFacePt = (pt: Point2D) => ({
    x: faceSvgW * 0.5 + pt.x * scaleFace,
    y: faceSvgH - pad - pt.y * scaleFace,
  });

  const boundaryPoly = geometry.crossSectionPoints || [];
  const boundarySvgStr = boundaryPoly
    .map((pt) => {
      const sp = mapFacePt(pt);
      return `${sp.x.toFixed(1)},${sp.y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3">
      <div
        className={`w-full max-w-[1440px] h-[92vh] rounded-xl border flex flex-col overflow-hidden shadow-2xl ${
          isLight
            ? 'bg-slate-50 border-slate-300 text-slate-900'
            : 'bg-[#080D18] border-[#1E2F4D] text-slate-100'
        }`}
      >
        {/* ====================================================================
            TOP HEADER & TAB NAVIGATION
           ==================================================================== */}
        <header
          className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
            isLight
              ? 'bg-white border-slate-200'
              : 'bg-[#0C1424] border-[#1E2F4D]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight flex items-center gap-2">
                <span>TRaiC AI Fracture Segmentation &amp; MATLAB Joint Matrix Lab</span>
                <span className="text-xs font-mono font-normal text-amber-400">
                  · Frangi/Skeleton Segmentation + 2D PCA + 90° CW 3D SVD
                </span>
              </h2>
              <p
                className={`text-xs ${
                  isLight ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                TRaiC-style AI fracture &amp; trace segmentation (<code className="font-mono">adapthisteq → fibermetric → bwmorph('skel')</code>) + MATLAB PCA/SVD trace joining across Face, Wall &amp; Crown.
              </p>
            </div>
          </div>

          {/* 5 Interactive Functional Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div
              className={`flex flex-wrap items-center p-1 rounded-lg border ${
                isLight
                  ? 'bg-slate-100 border-slate-200'
                  : 'bg-[#070B14] border-[#1E2F4D]'
              }`}
            >
              <button
                onClick={() => setActiveTab('TRAIC_AI_SEGMENTATION')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'TRAIC_AI_SEGMENTATION'
                    ? 'bg-fuchsia-600 text-white font-bold shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                TRaiC AI Segmentation ({traicResult?.segmentedTraces.length || 0})
              </button>

              <button
                onClick={() => setActiveTab('JOINT_NETWORK_3D_PCA_SVD')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'JOINT_NETWORK_3D_PCA_SVD'
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                3D Plane Fit: Dip, Persistence &amp; Spacing (
                {report.jointNetwork3DPcaSvd.planeNodes.length})
              </button>

              <button
                onClick={() => setActiveTab('FACE_JOIN_AND_BLOCKS')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'FACE_JOIN_AND_BLOCKS'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <GitMerge className="w-3.5 h-3.5" />
                Face PCA Joiner ({report.faceCollinearCandidates.length})
              </button>

              <button
                onClick={() => setActiveTab('WALL_CROWN_3D_SVD')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'WALL_CROWN_3D_SVD'
                    ? 'bg-cyan-600 text-white font-bold shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Wall/Crown 3D SVD (90° CW) ({report.wallCrownSvdPlanes.length})
              </button>

              <button
                onClick={() => setActiveTab('FACE_WALL_CROSS_PRODUCT')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'FACE_WALL_CROSS_PRODUCT'
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                Face × Wall True Dip ({report.faceToWallCrossProducts.length})
              </button>

              <button
                onClick={() => setActiveTab('MATLAB_SCRIPT_CONSOLE')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'MATLAB_SCRIPT_CONSOLE'
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                MATLAB .m Script
              </button>
            </div>

            <button
              onClick={onClose}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer ${
                isLight
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300'
                  : 'bg-rose-950/70 hover:bg-rose-900 text-rose-200 border-rose-500/40'
              }`}
            >
              <X className="w-4 h-4" />
              Close
            </button>
          </div>
        </header>

        {/* Optional Action Notice Bar */}
        {bannerNotice && (
          <div className="px-4 py-2 bg-emerald-600/20 border-b border-emerald-500/40 flex items-center justify-between text-xs text-emerald-300 shrink-0">
            <div className="flex items-center gap-2 font-mono">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{bannerNotice}</span>
            </div>
            <button
              onClick={() => setBannerNotice(null)}
              className="text-emerald-300 hover:text-white text-xs underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ====================================================================
            MAIN BODY CONTENT (5 TABS)
           ==================================================================== */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* ==================================================================
              TAB 0: TRaiC + MATLAB REAL-TIME FRACTURE & TRACE SEGMENTATION STUDIO
             ================================================================== */}
          {activeTab === 'TRAIC_AI_SEGMENTATION' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left 7 Columns: Interactive 5-Stage TRaiC + MATLAB Real-Time Extraction Canvas */}
              <div className="lg:col-span-7 space-y-4">
                <div
                  className={`rounded-xl border p-4 ${
                    isLight
                      ? 'bg-white border-slate-200'
                      : 'bg-[#0C1424] border-[#1E2F4D]'
                  }`}
                >
                  {/* Row 1: Surface Selector + 4 MATLAB Extraction Engines */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      {(
                        [
                          { id: 'face', label: '1. Face' },
                          { id: 'crown', label: '2. Crown' },
                          { id: 'leftWall', label: '3. Left Wall' },
                          { id: 'rightWall', label: '4. Right Wall' },
                        ] as const
                      ).map((surf) => (
                        <button
                          key={surf.id}
                          onClick={() => setTraicSurface(surf.id)}
                          className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-colors cursor-pointer ${
                            traicSurface === surf.id
                              ? 'bg-fuchsia-600 text-white'
                              : isLight
                              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {surf.label}
                        </button>
                      ))}
                    </div>

                    {/* MATLAB Extraction Engine Selector */}
                    <div className="flex flex-wrap items-center gap-1">
                      {(
                        [
                          {
                            id: 'HYBRID_ENSEMBLE',
                            label: 'MATLAB Hybrid Ensemble',
                          },
                          {
                            id: 'MATLAB_PHASE_SKEL',
                            label: "PhaseCong + bwmorph('skel')",
                          },
                          {
                            id: 'STEGER_ACTIVE_SNAKE',
                            label: 'Steger + ActiveContour Snake',
                          },
                          {
                            id: 'RADON_HOUGH_GEODESIC',
                            label: 'Radon/Hough + Geodesic',
                          },
                        ] as { id: TraicExtractionEngineMode; label: string }[]
                      ).map((eng) => {
                        const activeEng =
                          (traicParams.extractionEngine || 'HYBRID_ENSEMBLE') ===
                          eng.id;
                        return (
                          <button
                            key={eng.id}
                            onClick={() => {
                              const next = {
                                ...traicParams,
                                extractionEngine: eng.id,
                              };
                              setTraicParams(next);
                              executeTraicSegmentation(traicSurface, next);
                            }}
                            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                              activeEng
                                ? 'bg-cyan-500 text-slate-950 shadow-2xs'
                                : isLight
                                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                : 'bg-slate-900 text-slate-300 border border-slate-700 hover:border-cyan-500/50'
                            }`}
                          >
                            {eng.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Row 2: Visual Diagnostic Stage Selector + Real-Time Interactive Extraction Tools */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pt-2 border-t border-slate-800/60">
                    <div className="flex flex-wrap items-center gap-1">
                      {(
                        [
                          { id: 'CLAHE_NORMALIZED', label: '1. CLAHE (adapthisteq)' },
                          { id: 'PROBABILITY_HEATMAP', label: '2. Frangi (fibermetric)' },
                          { id: 'PHASE_CONGRUENCY_STEGER', label: '3. PhaseCong + Steger' },
                          { id: 'SKELETON_MASK', label: "4. Skeleton (bwmorph)" },
                          { id: 'VECTOR_TRACES_OVERLAY', label: '5. Vector Traces' },
                        ] as const
                      ).map((st) => (
                        <button
                          key={st.id}
                          onClick={() => setTraicVisualStage(st.id)}
                          className={`px-2 py-1 rounded-md text-[10.5px] font-mono font-semibold transition-colors cursor-pointer ${
                            traicVisualStage === st.id
                              ? 'bg-amber-500 text-slate-950 font-bold'
                              : isLight
                              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              : 'bg-[#070B14] text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>

                    {/* Interactive Real-Time Canvas Tools */}
                    <div className="flex flex-wrap items-center gap-1">
                      {(
                        [
                          {
                            id: 'ONE_CLICK_SEED_SNAKE',
                            label: '⚡ Real-Time 1-Click Seed Snake',
                          },
                          {
                            id: 'TWO_POINT_GEODESIC_SNAKE',
                            label: '🧲 2-Pt Geodesic Snake',
                          },
                          {
                            id: 'ROI_BOX_EXTRACT',
                            label: '🔲 ROI Box Extract',
                          },
                          {
                            id: 'SELECT_INSPECT',
                            label: '🖱️ Toggle Traces',
                          },
                        ] as { id: TraicInteractiveToolMode; label: string }[]
                      ).map((tl) => (
                        <button
                          key={tl.id}
                          onClick={() => {
                            setTraicToolMode(tl.id);
                            setTwoPtStartUV(null);
                            setHoverPreviewCandidate(null);
                          }}
                          className={`px-2 py-1 rounded text-[10.5px] font-mono font-bold transition-colors cursor-pointer ${
                            traicToolMode === tl.id
                              ? 'bg-emerald-500 text-slate-950 shadow-2xs'
                              : isLight
                              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              : 'bg-slate-900 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-950/40'
                          }`}
                        >
                          {tl.label}
                        </button>
                      ))}
                      {traicParams.roiBoxUV && (
                        <button
                          onClick={() => {
                            const next = { ...traicParams, roiBoxUV: null };
                            setTraicParams(next);
                            setRoiDraftUV(null);
                            executeTraicSegmentation(traicSurface, next);
                          }}
                          className="px-2 py-1 rounded text-[10px] font-mono font-bold bg-rose-600 text-white cursor-pointer"
                        >
                          Clear ROI
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Interactive Segmentation Viewport with Real-Time (<1.5ms) Hover & Click Extraction */}
                  <div className="rounded-lg border border-slate-800 bg-[#050912] p-2 flex flex-col items-center">
                    {traicResult ? (
                      <svg
                        viewBox={`0 0 ${traicResult.imageWidth} ${traicResult.imageHeight}`}
                        className={`w-full max-h-[420px] select-none rounded ${
                          traicToolMode === 'SELECT_INSPECT'
                            ? 'cursor-pointer'
                            : 'cursor-crosshair'
                        }`}
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const u = Math.max(
                            0.01,
                            Math.min(0.99, (e.clientX - rect.left) / Math.max(1, rect.width))
                          );
                          const v = Math.max(
                            0.01,
                            Math.min(0.99, (e.clientY - rect.top) / Math.max(1, rect.height))
                          );

                          if (traicToolMode === 'ROI_BOX_EXTRACT' && roiDragStartUV) {
                            setRoiDraftUV({
                              minU: Math.min(roiDragStartUV.x, u),
                              minV: Math.min(roiDragStartUV.y, v),
                              maxU: Math.max(roiDragStartUV.x, u),
                              maxV: Math.max(roiDragStartUV.y, v),
                            });
                            return;
                          }

                          if (traicToolMode === 'ONE_CLICK_SEED_SNAKE') {
                            const liveCand = extractRealtimeMatlabTraceAtUV(
                              traicResult.ridgeField,
                              { x: u, y: v },
                              traicSurface,
                              photos?.[traicSurface],
                              geometry,
                              settings
                            );
                            setHoverPreviewCandidate(liveCand);
                          } else if (
                            traicToolMode === 'TWO_POINT_GEODESIC_SNAKE' &&
                            twoPtStartUV
                          ) {
                            const liveSnake = extractTwoPointMatlabSnakeTrace(
                              traicResult.ridgeField,
                              twoPtStartUV,
                              { x: u, y: v },
                              traicSurface,
                              photos?.[traicSurface],
                              geometry,
                              settings
                            );
                            setHoverPreviewCandidate(liveSnake);
                          } else {
                            setHoverPreviewCandidate(null);
                          }
                        }}
                        onMouseLeave={() => {
                          if (!twoPtStartUV) setHoverPreviewCandidate(null);
                        }}
                        onMouseDown={(e) => {
                          if (traicToolMode !== 'ROI_BOX_EXTRACT') return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const u = Math.max(
                            0.01,
                            Math.min(0.99, (e.clientX - rect.left) / Math.max(1, rect.width))
                          );
                          const v = Math.max(
                            0.01,
                            Math.min(0.99, (e.clientY - rect.top) / Math.max(1, rect.height))
                          );
                          setRoiDragStartUV({ x: u, y: v });
                          setRoiDraftUV({ minU: u, minV: v, maxU: u, maxV: v });
                        }}
                        onMouseUp={() => {
                          if (
                            traicToolMode === 'ROI_BOX_EXTRACT' &&
                            roiDragStartUV &&
                            roiDraftUV
                          ) {
                            setRoiDragStartUV(null);
                            if (
                              roiDraftUV.maxU - roiDraftUV.minU > 0.05 &&
                              roiDraftUV.maxV - roiDraftUV.minV > 0.05
                            ) {
                              const next = { ...traicParams, roiBoxUV: roiDraftUV };
                              setTraicParams(next);
                              executeTraicSegmentation(traicSurface, next);
                            }
                          }
                        }}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const u = Math.max(
                            0.01,
                            Math.min(0.99, (e.clientX - rect.left) / Math.max(1, rect.width))
                          );
                          const v = Math.max(
                            0.01,
                            Math.min(0.99, (e.clientY - rect.top) / Math.max(1, rect.height))
                          );

                          if (traicToolMode === 'ONE_CLICK_SEED_SNAKE') {
                            const extracted =
                              hoverPreviewCandidate ||
                              extractRealtimeMatlabTraceAtUV(
                                traicResult.ridgeField,
                                { x: u, y: v },
                                traicSurface,
                                photos?.[traicSurface],
                                geometry,
                                settings
                              );
                            if (extracted) {
                              setTraicResult((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      segmentedTraces: [
                                        extracted,
                                        ...prev.segmentedTraces,
                                      ],
                                    }
                                  : prev
                              );
                              setSelectedTraicTraceIds((prev) => {
                                const next = new Set(prev);
                                next.add(extracted.id);
                                return next;
                              });
                              setBannerNotice(
                                `Real-Time MATLAB Sub-Pixel Seed + ActiveContour Snake extracted ${extracted.setId} (${String(
                                  extracted.dipDirectionDeg
                                ).padStart(3, '0')}/${String(extracted.dipDeg).padStart(
                                  2,
                                  '0'
                                )}, L=${extracted.persistenceMeters}m, JRC=${extracted.jrcRoughness}).`
                              );
                            }
                          } else if (traicToolMode === 'TWO_POINT_GEODESIC_SNAKE') {
                            if (!twoPtStartUV) {
                              setTwoPtStartUV({ x: u, y: v });
                            } else {
                              const extracted = extractTwoPointMatlabSnakeTrace(
                                traicResult.ridgeField,
                                twoPtStartUV,
                                { x: u, y: v },
                                traicSurface,
                                photos?.[traicSurface],
                                geometry,
                                settings
                              );
                              setTwoPtStartUV(null);
                              setHoverPreviewCandidate(null);
                              if (extracted) {
                                setTraicResult((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        segmentedTraces: [
                                          extracted,
                                          ...prev.segmentedTraces,
                                        ],
                                      }
                                    : prev
                                );
                                setSelectedTraicTraceIds((prev) => {
                                  const next = new Set(prev);
                                  next.add(extracted.id);
                                  return next;
                                });
                                setBannerNotice(
                                  `MATLAB 2-Point Dijkstra Geodesic + ActiveContour Snake locked exact trace (${String(
                                    extracted.dipDirectionDeg
                                  ).padStart(3, '0')}/${String(extracted.dipDeg).padStart(
                                    2,
                                    '0'
                                  )}, L=${extracted.persistenceMeters}m).`
                                );
                              }
                            }
                          }
                        }}
                      >
                        {/* Background Stage Raster */}
                        <image
                          href={
                            traicVisualStage === 'CLAHE_NORMALIZED'
                              ? traicResult.claheNormalizedDataUrl
                              : traicVisualStage === 'PROBABILITY_HEATMAP'
                              ? traicResult.fractureProbabilityHeatmapDataUrl
                              : traicVisualStage === 'PHASE_CONGRUENCY_STEGER'
                              ? traicResult.phaseCongruencyStegerDataUrl
                              : traicVisualStage === 'SKELETON_MASK'
                              ? traicResult.skeletonBinaryMaskDataUrl
                              : traicResult.claheNormalizedDataUrl
                          }
                          x="0"
                          y="0"
                          width={traicResult.imageWidth}
                          height={traicResult.imageHeight}
                          preserveAspectRatio="none"
                        />

                        {/* Active or Draft ROI Box */}
                        {(roiDraftUV || traicParams.roiBoxUV) && (
                          <rect
                            x={
                              (roiDraftUV || traicParams.roiBoxUV)!.minU *
                              traicResult.imageWidth
                            }
                            y={
                              (roiDraftUV || traicParams.roiBoxUV)!.minV *
                              traicResult.imageHeight
                            }
                            width={
                              ((roiDraftUV || traicParams.roiBoxUV)!.maxU -
                                (roiDraftUV || traicParams.roiBoxUV)!.minU) *
                              traicResult.imageWidth
                            }
                            height={
                              ((roiDraftUV || traicParams.roiBoxUV)!.maxV -
                                (roiDraftUV || traicParams.roiBoxUV)!.minV) *
                              traicResult.imageHeight
                            }
                            fill="rgba(34, 211, 238, 0.08)"
                            stroke="#22d3ee"
                            strokeWidth="1.8"
                            strokeDasharray="5,3"
                          />
                        )}

                        {/* Skeleton Topological Branchpoints & Endpoints */}
                        {(traicVisualStage === 'SKELETON_MASK' ||
                          traicVisualStage === 'VECTOR_TRACES_OVERLAY') && (
                          <g>
                            {traicResult.skeletonBranchPointsUV.map((bp, idx) => (
                              <circle
                                key={`bp-${idx}`}
                                cx={bp.x * traicResult.imageWidth}
                                cy={bp.y * traicResult.imageHeight}
                                r="3.2"
                                fill="#f43f5e"
                                stroke="#ffffff"
                                strokeWidth="0.8"
                              />
                            ))}
                            {traicResult.skeletonEndPointsUV.map((ep, idx) => (
                              <circle
                                key={`ep-${idx}`}
                                cx={ep.x * traicResult.imageWidth}
                                cy={ep.y * traicResult.imageHeight}
                                r="2.3"
                                fill="#eab308"
                              />
                            ))}
                          </g>
                        )}

                        {/* Vectorized & PCA-Linked Fracture Polylines */}
                        {traicResult.segmentedTraces.map((tr) => {
                          const isChecked = selectedTraicTraceIds.has(tr.id);
                          const ptsStr = tr.uvPoints
                            .map(
                              (p) =>
                                `${(p.x * traicResult.imageWidth).toFixed(1)},${(
                                  p.y * traicResult.imageHeight
                                ).toFixed(1)}`
                            )
                            .join(' ');
                          const midPt =
                            tr.uvPoints[Math.floor(tr.uvPoints.length / 2)];
                          const mx = midPt.x * traicResult.imageWidth;
                          const my = midPt.y * traicResult.imageHeight;
                          const col = getSetColor(tr.setId);

                          return (
                            <g
                              key={tr.id}
                              onClick={(e) => {
                                if (traicToolMode === 'SELECT_INSPECT') {
                                  e.stopPropagation();
                                  setSelectedTraicTraceIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(tr.id)) next.delete(tr.id);
                                    else next.add(tr.id);
                                    return next;
                                  });
                                }
                              }}
                              className="cursor-pointer"
                              opacity={isChecked ? 1 : 0.28}
                            >
                              <polyline
                                points={ptsStr}
                                fill="none"
                                stroke="#050811"
                                strokeWidth="4.2"
                                strokeLinecap="round"
                              />
                              <polyline
                                points={ptsStr}
                                fill="none"
                                stroke={col}
                                strokeWidth="2.4"
                                strokeLinecap="round"
                              />
                              <text
                                x={mx}
                                y={my - 5}
                                textAnchor="middle"
                                fontSize="9.5"
                                fontFamily="monospace"
                                fontWeight="800"
                                fill={col}
                                stroke="#050811"
                                strokeWidth="2.4"
                                paintOrder="stroke"
                              >
                                {tr.setId} {String(tr.dipDirectionDeg).padStart(3, '0')}/
                                {String(tr.dipDeg).padStart(2, '0')} ({tr.persistenceMeters}m)
                              </text>
                            </g>
                          );
                        })}

                        {/* 2-Point Geodesic Start Anchor */}
                        {twoPtStartUV && (
                          <circle
                            cx={twoPtStartUV.x * traicResult.imageWidth}
                            cy={twoPtStartUV.y * traicResult.imageHeight}
                            r="5.5"
                            fill="#10b981"
                            stroke="#ffffff"
                            strokeWidth="1.8"
                          />
                        )}

                        {/* REAL-TIME (<1.5ms) LIVE HOVER / SNAKE TRACE PREVIEW */}
                        {hoverPreviewCandidate && (
                          <g className="pointer-events-none">
                            <polyline
                              points={hoverPreviewCandidate.uvPoints
                                .map(
                                  (p) =>
                                    `${(p.x * traicResult.imageWidth).toFixed(1)},${(
                                      p.y * traicResult.imageHeight
                                    ).toFixed(1)}`
                                )
                                .join(' ')}
                              fill="none"
                              stroke="#22d3ee"
                              strokeWidth="5.5"
                              strokeOpacity="0.35"
                              strokeLinecap="round"
                            />
                            <polyline
                              points={hoverPreviewCandidate.uvPoints
                                .map(
                                  (p) =>
                                    `${(p.x * traicResult.imageWidth).toFixed(1)},${(
                                      p.y * traicResult.imageHeight
                                    ).toFixed(1)}`
                                )
                                .join(' ')}
                              fill="none"
                              stroke="#00ffaa"
                              strokeWidth="2.5"
                              strokeDasharray="4,2"
                              strokeLinecap="round"
                            />
                            {hoverPreviewCandidate.uvPoints.length > 0 && (
                              <text
                                x={
                                  hoverPreviewCandidate.uvPoints[
                                    Math.floor(hoverPreviewCandidate.uvPoints.length / 2)
                                  ].x * traicResult.imageWidth
                                }
                                y={
                                  hoverPreviewCandidate.uvPoints[
                                    Math.floor(hoverPreviewCandidate.uvPoints.length / 2)
                                  ].y *
                                    traicResult.imageHeight -
                                  8
                                }
                                textAnchor="middle"
                                fontSize="10"
                                fontFamily="monospace"
                                fontWeight="800"
                                fill="#00ffaa"
                                stroke="#050811"
                                strokeWidth="2.6"
                                paintOrder="stroke"
                              >
                                LIVE MATLAB SNAKE: {hoverPreviewCandidate.setId}{' '}
                                {String(hoverPreviewCandidate.dipDirectionDeg).padStart(3, '0')}/
                                {String(hoverPreviewCandidate.dipDeg).padStart(2, '0')} (
                                {hoverPreviewCandidate.persistenceMeters}m · JRC{' '}
                                {hoverPreviewCandidate.jrcRoughness}) — CLICK TO EXTRACT
                              </text>
                            )}
                          </g>
                        )}
                      </svg>
                    ) : (
                      <div className="h-[340px] flex items-center justify-center text-xs font-mono text-slate-400">
                        Running TRaiC + MATLAB Multi-Engine Fracture Segmentation...
                      </div>
                    )}

                    {traicResult && (
                      <div className="w-full flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 px-2 pt-2 border-t border-slate-800/80">
                        <span>
                          Traces: <strong className="text-white">{traicResult.segmentedTraces.length}</strong> ·{' '}
                          Nodes: {traicResult.skeletonBranchPointsUV.length} X/Y-Branches,{' '}
                          {traicResult.skeletonEndPointsUV.length} Tips
                        </span>
                        <span className="text-emerald-400 font-bold">
                          {traicToolMode === 'ONE_CLICK_SEED_SNAKE'
                            ? '⚡ Hover any rock crack for live <1.5ms MATLAB Snake preview & Click to lock!'
                            : traicToolMode === 'TWO_POINT_GEODESIC_SNAKE'
                            ? twoPtStartUV
                              ? '🧲 Move to end of fracture & Click 2nd point to lock Geodesic Snake'
                              : '🧲 Click start of any fracture to begin 2-Point Geodesic Snake'
                            : traicToolMode === 'ROI_BOX_EXTRACT'
                            ? '🔲 Drag a box over any fracture zone to run targeted MATLAB extraction'
                            : `P₂₁: ${traicResult.meanFractureDensityP21} m/m² · ${traicResult.processingTimeMs} ms`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* TRaiC + MATLAB Segmentation & Active Contour Snake Parameter Sliders */}
                <div
                  className={`rounded-xl border p-4 ${
                    isLight
                      ? 'bg-white border-slate-200'
                      : 'bg-[#0C1424] border-[#1E2F4D]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-fuchsia-400 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5" />
                      MATLAB PhaseCongruency · Steger Sub-Pixel · ActiveContour Snake Parameters
                    </h4>
                    <button
                      onClick={() => executeTraicSegmentation(traicSurface, traicParams)}
                      disabled={isRunningTraic}
                      className="px-3 py-1 rounded-md bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      {isRunningTraic ? 'Segmenting...' : 'Re-Run MATLAB Extraction'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs font-mono">
                    <label className="block space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Prob Threshold</span>
                        <span className="text-fuchsia-400 font-bold">
                          {traicParams.probabilityThreshold.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.2}
                        max={0.8}
                        step={0.02}
                        value={traicParams.probabilityThreshold}
                        onChange={(e) => {
                          const next = {
                            ...traicParams,
                            probabilityThreshold: parseFloat(e.target.value),
                          };
                          setTraicParams(next);
                          executeTraicSegmentation(traicSurface, next);
                        }}
                        className="w-full accent-fuchsia-500 cursor-pointer"
                      />
                    </label>

                    <label className="block space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Min Length (m)</span>
                        <span className="text-cyan-400 font-bold">
                          {traicParams.minPersistenceMeters.toFixed(2)} m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.3}
                        max={2.2}
                        step={0.05}
                        value={traicParams.minPersistenceMeters}
                        onChange={(e) => {
                          const next = {
                            ...traicParams,
                            minPersistenceMeters: parseFloat(e.target.value),
                          };
                          setTraicParams(next);
                          executeTraicSegmentation(traicSurface, next);
                        }}
                        className="w-full accent-cyan-500 cursor-pointer"
                      />
                    </label>

                    <label className="block space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">PCA Link Gap</span>
                        <span className="text-emerald-400 font-bold">
                          {traicParams.collinearLinkGapMeters.toFixed(2)} m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={1.4}
                        step={0.05}
                        value={traicParams.collinearLinkGapMeters}
                        onChange={(e) => {
                          const next = {
                            ...traicParams,
                            collinearLinkGapMeters: parseFloat(e.target.value),
                          };
                          setTraicParams(next);
                          executeTraicSegmentation(traicSurface, next);
                        }}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </label>

                    <label className="block space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Spur Prune</span>
                        <span className="text-amber-400 font-bold">
                          {traicParams.spurPruneIterations} px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={12}
                        step={1}
                        value={traicParams.spurPruneIterations}
                        onChange={(e) => {
                          const next = {
                            ...traicParams,
                            spurPruneIterations: parseInt(e.target.value, 10),
                          };
                          setTraicParams(next);
                          executeTraicSegmentation(traicSurface, next);
                        }}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </label>

                    <label className="block space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Snake Lock</span>
                        <span className="text-sky-400 font-bold">
                          {traicParams.activeContourIterations ?? 6} iter
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={12}
                        step={1}
                        value={traicParams.activeContourIterations ?? 6}
                        onChange={(e) => {
                          const next = {
                            ...traicParams,
                            activeContourIterations: parseInt(e.target.value, 10),
                          };
                          setTraicParams(next);
                          executeTraicSegmentation(traicSurface, next);
                        }}
                        className="w-full accent-sky-500 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Right 5 Columns: Segmented Trace Candidates List & Apply Button */}
              <div className="lg:col-span-5 space-y-4">
                <div
                  className={`rounded-xl border p-4 ${
                    isLight
                      ? 'bg-white border-slate-200'
                      : 'bg-[#0C1424] border-[#1E2F4D]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-sm font-bold">
                        Extracted Exact Traces ({selectedTraicTraceIds.size}/
                        {traicResult?.segmentedTraces.length || 0})
                      </h3>
                      <p className="text-xs text-slate-400">
                        Sub-pixel Steger + Kovesi Phase Congruency + <code className="font-mono">bwmorph('skel')</code> + ActiveContour Snake.
                      </p>
                    </div>
                    {onUpdateJoints && (
                      <button
                        onClick={handleApplyTraicTracesToWorkspace}
                        disabled={selectedTraicTraceIds.size === 0}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Apply ({selectedTraicTraceIds.size}) to Canvas
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-[490px] overflow-y-auto pr-1 mt-3">
                    {(traicResult?.segmentedTraces || []).map((tr, idx) => {
                      const isChecked = selectedTraicTraceIds.has(tr.id);
                      return (
                        <div
                          key={tr.id}
                          onClick={() => {
                            setSelectedTraicTraceIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(tr.id)) next.delete(tr.id);
                              else next.add(tr.id);
                              return next;
                            });
                          }}
                          className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                            isChecked
                              ? 'border-fuchsia-500/70 bg-fuchsia-950/20'
                              : isLight
                              ? 'bg-slate-50 border-slate-200 opacity-60'
                              : 'bg-[#080E1A] border-slate-800 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-mono text-xs font-bold">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="accent-fuchsia-500 cursor-pointer"
                              />
                              <span
                                style={{ color: getSetColor(tr.setId) }}
                                className="font-extrabold"
                              >
                                {tr.setId}
                              </span>
                              <span>Trace #{idx + 1}</span>
                              <span className="text-cyan-400">
                                {String(tr.dipDirectionDeg).padStart(3, '0')}/
                                {String(tr.dipDeg).padStart(2, '0')}
                              </span>
                            </div>
                            <span className="text-xs font-mono font-bold text-emerald-400">
                              P={tr.probabilityScore}% · SNR={tr.subPixelSnrDb ?? 24.5}dB
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-2 text-[11px] font-mono text-slate-400">
                            <div>Len: {tr.persistenceMeters}m</div>
                            <div>Angle: {tr.traceAngleDeg}°</div>
                            <div>JRC: {tr.jrcRoughness}</div>
                            <div>Skel: {tr.skeletonPixelCount}px</div>
                            <div>PCA Linked: {tr.collinearMergedCount}</div>
                            <div>Vertices: {tr.meterPoints.length}</div>
                          </div>
                          {tr.engineSourceLabel && (
                            <div className="mt-1.5 text-[10px] font-mono text-cyan-300/80 truncate">
                              Engine: {tr.engineSourceLabel}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================
              TAB 1B: 3D JOINT NETWORK & PLANE FITTING (PCA / SVD)
              Fits 3D planes to trace vertices to calculate Dip, Dip Direction,
              Trace Persistence (L_3D), and True Normal Set Spacing (S_normal)
             ================================================================== */}
          {activeTab === 'JOINT_NETWORK_3D_PCA_SVD' && (
            <div className="space-y-4">
              {/* Top Mathematical Banner + Global 3D Rock Mass Metrics */}
              <div
                className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-4 ${
                  isLight
                    ? 'bg-white border-slate-200'
                    : 'bg-[#0C1424] border-[#1E2F4D]'
                }`}
              >
                <div className="max-w-3xl">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-sky-300 font-mono text-[11px] font-bold">
                      PCA / SVD 3D PLANE FITTING
                    </span>
                    <h3 className="text-sm font-bold">
                      3D Joint Network &amp; Plane Fitting — Dip, Dip Direction, Trace Persistence &amp; True Set Spacing
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Centers 3D trace vertices <code className="text-sky-300">A = P_3D - mean(P_3D)</code>, decomposes{' '}
                    <code className="text-amber-300">[U, S, V] = svd(A, 'econ')</code> to extract the plane normal{' '}
                    <code className="text-emerald-300">n = V(:,3)</code> (Dip &amp; Dip Direction), integrates 3D curvilinear arc length{' '}
                    <code className="text-fuchsia-300">L_3D = Σ||p_(k+1) - p_k||</code> (Persistence), and projects plane centroids onto set normal{' '}
                    <code className="text-cyan-300">d_i = c_i · n_set</code> to compute true perpendicular spacing{' '}
                    <code className="text-cyan-300">S_normal = Δd_i</code>.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 font-mono text-xs">
                    <span className="text-slate-400">Volumetric J_v: </span>
                    <strong className="text-sky-400">
                      {report.jointNetwork3DPcaSvd.volumetricJointCountJv} joints/m³
                    </strong>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 font-mono text-xs">
                    <span className="text-slate-400">3D Palmström RQD: </span>
                    <strong className="text-emerald-400">
                      {report.jointNetwork3DPcaSvd.theoretical3DRqdPct}%
                    </strong>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 font-mono text-xs">
                    <span className="text-slate-400">Mean Block V_b: </span>
                    <strong className="text-amber-300">
                      {report.jointNetwork3DPcaSvd.estimatedMeanBlockVolumeM3} m³
                    </strong>
                  </div>

                  {onUpdateJoints && (
                    <button
                      onClick={handleSync3DPcaSvdToProject}
                      className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Sync 3D Dip, Persistence &amp; Spacing to Project
                    </button>
                  )}

                  <button
                    onClick={handleDownload3DPlaneNetworkCsv}
                    className="px-3 py-2 rounded-lg border border-sky-500/50 hover:bg-sky-950/40 text-sky-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export 3D Planes CSV
                  </button>
                </div>
              </div>

              {/* Main 12-Column Grid: Left 7 Cols = Interactive 3D Isometric DFN & Plane Viewer | Right 5 Cols = Set Spacing & Persistence Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left 7 Columns: 3D Isometric Discrete Fracture Network (DFN) & Normal Spacing Canvas */}
                <div className="lg:col-span-7 space-y-4">
                  <div
                    className={`rounded-xl border p-4 ${
                      isLight
                        ? 'bg-white border-slate-200'
                        : 'bg-[#0C1424] border-[#1E2F4D]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                          Interactive 3D Discrete Fracture Network (DFN) — Fitted PCA Planes &amp; Normal Spacing Bars
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Rotate the 3D tunnel excavation to inspect fitted 3D fracture discs, unit normal vectors V(:,3), and true perpendicular set spacing S_normal = Δd.
                        </p>
                      </div>

                      {/* Set Filter Pills */}
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          onClick={() => setDfnFilterSetId('ALL')}
                          className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold cursor-pointer ${
                            dfnFilterSetId === 'ALL'
                              ? 'bg-sky-500 text-slate-950'
                              : 'bg-slate-900 text-slate-300 border border-slate-700'
                          }`}
                        >
                          All Sets ({report.jointNetwork3DPcaSvd.planeNodes.length})
                        </button>
                        {report.jointNetwork3DPcaSvd.setSummaries.map((s) => (
                          <button
                            key={s.setId}
                            onClick={() => setDfnFilterSetId(s.setId)}
                            className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold cursor-pointer ${
                              dfnFilterSetId === s.setId
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-900 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {s.setId} ({s.jointCount})
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3D Isometric SVG Viewport */}
                    {(() => {
                      const svgW = 680;
                      const svgH = 400;
                      const yawRad = (dfnCameraYawDeg * Math.PI) / 180;
                      const pitchRad = (dfnCameraPitchDeg * Math.PI) / 180;
                      const cosY = Math.cos(yawRad);
                      const sinY = Math.sin(yawRad);
                      const cosP = Math.cos(pitchRad);
                      const sinP = Math.sin(pitchRad);

                      const tW = geometry.width || 6.0;
                      const wallH = geometry.wallHeight || 4.2;
                      const totH = geometry.height || wallH + 2.5;
                      const roundL = settings.roundLength || 4.0;
                      const scale3D = Math.min(svgW, svgH) / Math.max(9.5, tW * 1.65, roundL * 1.8);

                      const project3D = (pt: { x: number; y: number; z: number }) => {
                        const cx = pt.x;
                        const cy = pt.y - totH * 0.45;
                        const cz = pt.z - roundL * 0.45;
                        const rx = cx * cosY + cz * sinY;
                        const rz = -cx * sinY + cz * cosY;
                        const ry = cy * cosP - rz * sinP;
                        const depth = cy * sinP + rz * cosP;
                        return {
                          sx: svgW * 0.5 + rx * scale3D,
                          sy: svgH * 0.54 - ry * scale3D,
                          depth,
                        };
                      };

                      // Build 3D Tunnel Arch Rings at z = 0 (Face) and z = roundL (Back of Pull)
                      const buildArchPoints3D = (zVal: number) => {
                        const halfW = tW * 0.5;
                        const archH = Math.max(0.5, totH - wallH);
                        const pts: { x: number; y: number; z: number }[] = [
                          { x: -halfW, y: 0, z: zVal },
                          { x: -halfW, y: wallH, z: zVal },
                        ];
                        for (let s = 1; s <= 12; s++) {
                          const u = s / 12;
                          const th = Math.PI * (1 - u);
                          pts.push({
                            x: Math.cos(th) * halfW,
                            y: wallH + Math.sin(th) * archH,
                            z: zVal,
                          });
                        }
                        pts.push({ x: halfW, y: 0, z: zVal });
                        return pts;
                      };

                      const frontArch = buildArchPoints3D(0);
                      const backArch = buildArchPoints3D(roundL);
                      const frontStr = frontArch
                        .map((p) => {
                          const sp = project3D(p);
                          return `${sp.sx.toFixed(1)},${sp.sy.toFixed(1)}`;
                        })
                        .join(' ');
                      const backStr = backArch
                        .map((p) => {
                          const sp = project3D(p);
                          return `${sp.sx.toFixed(1)},${sp.sy.toFixed(1)}`;
                        })
                        .join(' ');

                      const visibleNodes = report.jointNetwork3DPcaSvd.planeNodes.filter(
                        (n) => dfnFilterSetId === 'ALL' || n.setId === dfnFilterSetId
                      );
                      const visibleSets = report.jointNetwork3DPcaSvd.setSummaries.filter(
                        (s) => dfnFilterSetId === 'ALL' || s.setId === dfnFilterSetId
                      );

                      return (
                        <div className="rounded-lg border border-slate-800 bg-[#050912] overflow-hidden">
                          <svg
                            viewBox={`0 0 ${svgW} ${svgH}`}
                            className="w-full h-auto block select-none"
                          >
                            {/* Subtle Background Grid */}
                            <defs>
                              <pattern
                                id="dfnGrid"
                                width="28"
                                height="28"
                                patternUnits="userSpaceOnUse"
                              >
                                <path
                                  d="M 28 0 L 0 0 0 28"
                                  fill="none"
                                  stroke="#1e293b"
                                  strokeWidth="0.6"
                                />
                              </pattern>
                            </defs>
                            <rect width={svgW} height={svgH} fill="url(#dfnGrid)" />

                            {/* Back Tunnel Arch Wireframe (z = roundLength) */}
                            <polygon
                              points={backStr}
                              fill="rgba(15, 23, 42, 0.35)"
                              stroke="#334155"
                              strokeWidth="1.2"
                              strokeDasharray="4,3"
                            />

                            {/* Longitudinal Tunnel Ribs connecting z=0 to z=roundL */}
                            {[0, 1, 7, 13, 14].map((idx) => {
                              const pF = project3D(frontArch[idx]);
                              const pB = project3D(backArch[idx]);
                              return (
                                <line
                                  key={`rib-${idx}`}
                                  x1={pF.sx}
                                  y1={pF.sy}
                                  x2={pB.sx}
                                  y2={pB.sy}
                                  stroke="#334155"
                                  strokeWidth="1.1"
                                  strokeDasharray="3,3"
                                />
                              );
                            })}

                            {/* Front Tunnel Face Arch Wireframe (z = 0) */}
                            <polygon
                              points={frontStr}
                              fill="rgba(30, 41, 59, 0.18)"
                              stroke="#64748b"
                              strokeWidth="1.8"
                            />

                            {/* Fitted 3D PCA/SVD Fracture Discs & Trace Polylines */}
                            {visibleNodes.map((node) => {
                              const col = getSetColor(node.setId);
                              const isSel = selected3DPlaneJointId === node.jointId;
                              const discSvgStr = node.discPolygon3D
                                .map((p) => {
                                  const sp = project3D(p);
                                  return `${sp.sx.toFixed(1)},${sp.sy.toFixed(1)}`;
                                })
                                .join(' ');
                              const traceSvgStr = node.points3D
                                .map((p) => {
                                  const sp = project3D(p);
                                  return `${sp.sx.toFixed(1)},${sp.sy.toFixed(1)}`;
                                })
                                .join(' ');
                              const cProj = project3D(node.centroid3D);
                              const nTip = project3D({
                                x: node.centroid3D.x + node.unitNormalV3.x * 0.85,
                                y: node.centroid3D.y + node.unitNormalV3.y * 0.85,
                                z: node.centroid3D.z + node.unitNormalV3.z * 0.85,
                              });

                              return (
                                <g
                                  key={node.jointId}
                                  onClick={() => setSelected3DPlaneJointId(node.jointId)}
                                  className="cursor-pointer"
                                >
                                  {showDfnDiscs && (
                                    <polygon
                                      points={discSvgStr}
                                      fill={col}
                                      fillOpacity={isSel ? 0.38 : 0.18}
                                      stroke={isSel ? '#ffffff' : col}
                                      strokeWidth={isSel ? 2.0 : 1.1}
                                      strokeDasharray={isSel ? undefined : '3,2'}
                                    />
                                  )}

                                  {/* Actual 3D Mapped Trace Vertices */}
                                  <polyline
                                    points={traceSvgStr}
                                    fill="none"
                                    stroke={isSel ? '#38bdf8' : col}
                                    strokeWidth={isSel ? 3.4 : 2.5}
                                  />

                                  {/* Centroid Node */}
                                  <circle
                                    cx={cProj.sx}
                                    cy={cProj.sy}
                                    r={isSel ? 4.5 : 3.2}
                                    fill={col}
                                    stroke="#0f172a"
                                    strokeWidth="1.2"
                                  />

                                  {/* 3D Unit Normal Vector Arrow V(:,3) */}
                                  {showDfnNormals && (
                                    <g>
                                      <line
                                        x1={cProj.sx}
                                        y1={cProj.sy}
                                        x2={nTip.sx}
                                        y2={nTip.sy}
                                        stroke="#34d399"
                                        strokeWidth="1.6"
                                      />
                                      <circle
                                        cx={nTip.sx}
                                        cy={nTip.sy}
                                        r="2.4"
                                        fill="#34d399"
                                      />
                                    </g>
                                  )}

                                  {/* Label showing Set, DipDir/Dip, and 3D Persistence L_3D */}
                                  <text
                                    x={cProj.sx + 6}
                                    y={cProj.sy - 6}
                                    fontSize="8.5"
                                    fontFamily="monospace"
                                    fontWeight="700"
                                    fill={isSel ? '#ffffff' : '#e2e8f0'}
                                  >
                                    {node.setId} ({String(node.pcaDipDirectionDeg).padStart(3, '0')}/
                                    {String(node.pcaDipDeg).padStart(2, '0')}) L={node.tracePersistence3DMeters}m
                                  </text>
                                </g>
                              );
                            })}

                            {/* True Perpendicular Set Spacing Bars (S_normal = Δd along set mean normal) */}
                            {showDfnSpacingBars &&
                              visibleSets.map((setSum) =>
                                setSum.spacingBars3D.map((bar, bIdx) => {
                                  const p1 = project3D(bar.p1);
                                  const p2 = project3D(bar.p2);
                                  const midX = (p1.sx + p2.sx) * 0.5;
                                  const midY = (p1.sy + p2.sy) * 0.5;
                                  return (
                                    <g key={`sbar-${setSum.setId}-${bIdx}`}>
                                      <line
                                        x1={p1.sx}
                                        y1={p1.sy}
                                        x2={p2.sx}
                                        y2={p2.sy}
                                        stroke="#fbbf24"
                                        strokeWidth="2.2"
                                        strokeDasharray="4,2"
                                      />
                                      <circle cx={p1.sx} cy={p1.sy} r="2.8" fill="#fbbf24" />
                                      <circle cx={p2.sx} cy={p2.sy} r="2.8" fill="#fbbf24" />
                                      <rect
                                        x={midX - 28}
                                        y={midY - 8}
                                        width="56"
                                        height="14"
                                        rx="3"
                                        fill="rgba(15,23,42,0.88)"
                                        stroke="#f59e0b"
                                        strokeWidth="0.8"
                                      />
                                      <text
                                        x={midX}
                                        y={midY + 2}
                                        textAnchor="middle"
                                        fontSize="8"
                                        fontFamily="monospace"
                                        fontWeight="700"
                                        fill="#fde68a"
                                      >
                                        S_⊥={bar.spacingMeters}m
                                      </text>
                                    </g>
                                  );
                                })
                              )}

                            {/* HUD Legend */}
                            <text
                              x={14}
                              y={20}
                              fontSize="9.5"
                              fontFamily="monospace"
                              fontWeight="700"
                              fill="#38bdf8"
                            >
                              3D SVD PLANE FITTING (PCA) · TUNNEL FACE (Z=0) → EXCAVATION SPAN (Z={roundL}m)
                            </text>
                            <text
                              x={14}
                              y={svgH - 12}
                              fontSize="8.5"
                              fontFamily="monospace"
                              fill="#94a3b8"
                            >
                              Green Arrows = Unit Normal V(:,3) · Dashed Gold Bars = True Perpendicular Spacing S_normal (m)
                            </text>
                          </svg>

                          {/* Interactive 3D Camera & Layer Controls Bar */}
                          <div className="px-3 py-2.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                            <div className="flex flex-wrap items-center gap-4">
                              <label className="flex items-center gap-2 text-slate-300">
                                <span>3D Yaw ({dfnCameraYawDeg}°):</span>
                                <input
                                  type="range"
                                  min={-80}
                                  max={80}
                                  value={dfnCameraYawDeg}
                                  onChange={(e) => setDfnCameraYawDeg(Number(e.target.value))}
                                  className="w-24 accent-sky-400 cursor-pointer"
                                />
                              </label>
                              <label className="flex items-center gap-2 text-slate-300">
                                <span>Pitch ({dfnCameraPitchDeg}°):</span>
                                <input
                                  type="range"
                                  min={-15}
                                  max={65}
                                  value={dfnCameraPitchDeg}
                                  onChange={(e) => setDfnCameraPitchDeg(Number(e.target.value))}
                                  className="w-24 accent-sky-400 cursor-pointer"
                                />
                              </label>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={showDfnDiscs}
                                  onChange={(e) => setShowDfnDiscs(e.target.checked)}
                                  className="accent-sky-400"
                                />
                                <span>3D Planes</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer text-emerald-300">
                                <input
                                  type="checkbox"
                                  checked={showDfnNormals}
                                  onChange={(e) => setShowDfnNormals(e.target.checked)}
                                  className="accent-emerald-400"
                                />
                                <span>Normals V(:,3)</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer text-amber-300">
                                <input
                                  type="checkbox"
                                  checked={showDfnSpacingBars}
                                  onChange={(e) => setShowDfnSpacingBars(e.target.checked)}
                                  className="accent-amber-400"
                                />
                                <span>Spacing Bars (S_⊥)</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Right 5 Columns: Discontinuity Set 3D Persistence & True Normal Spacing Summary */}
                <div className="lg:col-span-5 space-y-4">
                  <div
                    className={`rounded-xl border p-4 ${
                      isLight
                        ? 'bg-white border-slate-200'
                        : 'bg-[#0C1424] border-[#1E2F4D]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <Ruler className="w-4 h-4" />
                        Set-Wise 3D Orientation, Persistence &amp; True Normal Spacing
                      </h4>
                      <span className="text-[11px] font-mono text-slate-400">
                        ISRM Classification
                      </span>
                    </div>

                    <div className="space-y-3 max-h-[430px] overflow-y-auto pr-1">
                      {report.jointNetwork3DPcaSvd.setSummaries.map((s) => (
                        <div
                          key={s.setId}
                          className={`p-3 rounded-lg border ${
                            isLight
                              ? 'bg-slate-50 border-slate-200'
                              : 'bg-[#080E1A] border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-full inline-block"
                                style={{ backgroundColor: getSetColor(s.setId) }}
                              />
                              <span className="font-mono text-xs font-bold">
                                Set {s.setId} ({s.jointCount} Planes)
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold">
                              Mean DipDir/Dip: {String(s.meanDipDirectionDeg).padStart(3, '0')}°/
                              {String(s.meanDipDeg).padStart(2, '0')}° (κ={s.fisherKappa})
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5 font-mono text-[11px]">
                            <div className="p-2 rounded bg-slate-950/60 border border-slate-800/90">
                              <div className="text-slate-400">3D Trace Persistence (L_3D)</div>
                              <div className="text-sm font-bold text-fuchsia-300 mt-0.5">
                                {s.meanPersistenceMeters} m{' '}
                                <span className="text-[10px] font-normal text-slate-400">
                                  ({s.minPersistenceMeters}–{s.maxPersistenceMeters} m)
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                ISRM: {s.isrmPersistenceClass}
                              </div>
                            </div>

                            <div className="p-2 rounded bg-slate-950/60 border border-slate-800/90">
                              <div className="text-slate-400">True Normal Spacing (S_normal)</div>
                              <div className="text-sm font-bold text-amber-300 mt-0.5">
                                {s.meanNormalSpacingMeters} m{' '}
                                <span className="text-[10px] font-normal text-slate-400">
                                  ({s.minNormalSpacingMeters}–{s.maxNormalSpacingMeters} m)
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                ISRM: {s.isrmSpacingClass}
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 text-[11px] font-mono text-cyan-300 flex items-center justify-between">
                            <span>
                              Set Mean Normal n_set = [{s.meanNormal3D.x}, {s.meanNormal3D.y},{' '}
                              {s.meanNormal3D.z}]
                            </span>
                            <span>Strike: {String(s.meanStrikeDeg).padStart(3, '0')}°</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Full-Width Table: Every Trace's 3D PCA/SVD Plane Fit, Persistence, and Perpendicular Spacing */}
              <div
                className={`rounded-xl border p-4 ${
                  isLight
                    ? 'bg-white border-slate-200'
                    : 'bg-[#0C1424] border-[#1E2F4D]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                    Vertex-Level 3D Plane Fitting Matrix ([U, S, V] = svd(A)) — Dip, Dip Direction, Persistence &amp; Normal Spacing
                  </h4>
                  <span className="text-xs font-mono text-slate-400">
                    Click any row to highlight its 3D plane disc &amp; normal vector in the viewer above
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[260px]">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-400 text-[11px]">
                        <th className="py-1.5 pr-2">Joint ID</th>
                        <th className="py-1.5 px-2">Surface</th>
                        <th className="py-1.5 px-2">Set</th>
                        <th className="py-1.5 px-2">3D Centroid [X, Y, Z] (m)</th>
                        <th className="py-1.5 px-2">SVD [σ₁, σ₂, σ₃]</th>
                        <th className="py-1.5 px-2">Unit Normal V(:,3)</th>
                        <th className="py-1.5 px-2">DipDir / Dip</th>
                        <th className="py-1.5 px-2">3D Persistence (L_3D)</th>
                        <th className="py-1.5 px-2">Normal Proj (d_i)</th>
                        <th className="py-1.5 pl-2">True Spacing (S_⊥)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.jointNetwork3DPcaSvd.planeNodes.map((n) => {
                        const isSel = selected3DPlaneJointId === n.jointId;
                        return (
                          <tr
                            key={n.jointId}
                            onClick={() => setSelected3DPlaneJointId(n.jointId)}
                            className={`border-b border-slate-800/70 cursor-pointer transition-colors ${
                              isSel ? 'bg-sky-950/40' : 'hover:bg-slate-800/30'
                            }`}
                          >
                            <td className="py-1.5 pr-2 font-bold text-sky-300">
                              {n.jointId}
                            </td>
                            <td className="py-1.5 px-2 text-slate-300">{n.surface}</td>
                            <td className="py-1.5 px-2 font-bold text-amber-300">{n.setId}</td>
                            <td className="py-1.5 px-2 text-slate-300">
                              [{n.centroid3D.x}, {n.centroid3D.y}, {n.centroid3D.z}]
                            </td>
                            <td className="py-1.5 px-2 text-slate-400">
                              [{n.singularValues[0]}, {n.singularValues[1]}, {n.singularValues[2]}]
                            </td>
                            <td className="py-1.5 px-2 text-cyan-300">
                              [{n.unitNormalV3.x}, {n.unitNormalV3.y}, {n.unitNormalV3.z}]
                            </td>
                            <td className="py-1.5 px-2 font-bold text-emerald-400">
                              {String(n.pcaDipDirectionDeg).padStart(3, '0')}°/
                              {String(n.pcaDipDeg).padStart(2, '0')}°
                            </td>
                            <td className="py-1.5 px-2 font-bold text-fuchsia-300">
                              {n.tracePersistence3DMeters} m
                            </td>
                            <td className="py-1.5 px-2 text-slate-300">
                              {n.normalProjectionMeters} m
                            </td>
                            <td className="py-1.5 pl-2 font-bold text-amber-300">
                              {n.normalSpacingToPrevMeters !== null
                                ? `${n.normalSpacingToPrevMeters} m`
                                : 'Ref Plane (d₀)'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================
              TAB 1: TUNNEL FACE (1. FACE) JOINT JOINING & BLOCK/OVERBREAK MATRIX
             ================================================================== */}
          {activeTab === 'FACE_JOIN_AND_BLOCKS' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7 space-y-4">
                <div
                  className={`rounded-xl border p-4 ${
                    isLight
                      ? 'bg-white border-slate-200'
                      : 'bg-[#0C1424] border-[#1E2F4D]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <h3 className="text-sm font-bold">
                        Tunnel Face (1. Face) — MATLAB 2D PCA Collinear Join &amp; X/T Node Graph
                      </h3>
                      <p className="text-xs text-slate-400">
                        Eigenvalue ratio λ₁/(λ₁+λ₂) detects broken segments along the same plane; 2×2 matrix solver finds X-nodes, T-nodes &amp; perimeter wedges.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {onUpdateJoints && (
                        <button
                          onClick={handleAddSampleSplitFaceTraces}
                          className="px-2.5 py-1.5 rounded-lg border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold cursor-pointer"
                        >
                          + Add Sample Split Face Traces
                        </button>
                      )}
                      {onUpdateJoints && report.faceCollinearCandidates.length > 0 && (
                        <button
                          onClick={handleJoinAllFaceCollinear}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <GitMerge className="w-3.5 h-3.5" />
                          Join All Collinear Face Traces ({report.faceCollinearCandidates.length})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Interactive Face SVG */}
                  <div className="rounded-lg border border-slate-800 bg-[#050912] p-2 flex flex-col items-center">
                    <svg
                      viewBox={`0 0 ${faceSvgW} ${faceSvgH}`}
                      className="w-full max-h-[380px] select-none"
                    >
                      <defs>
                        <pattern
                          id="matlabFaceGrid"
                          width="30"
                          height="30"
                          patternUnits="userSpaceOnUse"
                        >
                          <path
                            d="M 30 0 L 0 0 0 30"
                            fill="none"
                            stroke="#1e293b"
                            strokeWidth="0.6"
                          />
                        </pattern>
                      </defs>
                      <rect width={faceSvgW} height={faceSvgH} fill="url(#matlabFaceGrid)" />

                      <polygon
                        points={boundarySvgStr}
                        fill="#0f172a"
                        fillOpacity="0.85"
                        stroke="#38bdf8"
                        strokeWidth="2"
                      />

                      {report.faceBlocks.map((blk) => {
                        const polyPts = blk.vertices
                          .map((v) => {
                            const sp = mapFacePt(v);
                            return `${sp.x.toFixed(1)},${sp.y.toFixed(1)}`;
                          })
                          .join(' ');
                        const centSp = mapFacePt(blk.centroid);
                        return (
                          <g key={blk.id}>
                            <polygon
                              points={polyPts}
                              fill={blk.isPerimeterWedge ? '#f43f5e' : '#f59e0b'}
                              fillOpacity="0.22"
                              stroke={blk.isPerimeterWedge ? '#fb7185' : '#fbbf24'}
                              strokeWidth="1.4"
                              strokeDasharray="3,2"
                            />
                            <text
                              x={centSp.x}
                              y={centSp.y}
                              textAnchor="middle"
                              fontSize="8.5"
                              fontFamily="monospace"
                              fontWeight="700"
                              fill="#fde68a"
                            >
                              {blk.areaSqM}m² ({blk.estimatedWedgeVolumeM3}m³)
                            </text>
                          </g>
                        );
                      })}

                      {faceJoints.map((fj) => {
                        const ptsStr = fj.geometry
                          .map((pt) => {
                            const sp = mapFacePt(pt);
                            return `${sp.x.toFixed(1)},${sp.y.toFixed(1)}`;
                          })
                          .join(' ');
                        const midPt = mapFacePt(
                          fj.geometry[Math.floor(fj.geometry.length / 2)]
                        );
                        const setId = getJointSetId(fj);
                        const color = getSetColor(setId);
                        return (
                          <g key={fj.id}>
                            <polyline
                              points={ptsStr}
                              fill="none"
                              stroke={color}
                              strokeWidth="2.4"
                              strokeLinecap="round"
                            />
                            <text
                              x={midPt.x + 6}
                              y={midPt.y - 6}
                              fontSize="9.5"
                              fontFamily="monospace"
                              fontWeight="700"
                              fill={color}
                            >
                              {setId} ({String(fj.dipDirection ?? 0).padStart(3, '0')}/
                              {String(fj.dip ?? 0).padStart(2, '0')})
                            </text>
                          </g>
                        );
                      })}

                      {report.faceCollinearCandidates.map((cand) => {
                        const isSelected = selectedFacePairId === cand.id;
                        const bStr = cand.bridgePoints2D
                          .map((pt) => {
                            const sp = mapFacePt(pt);
                            return `${sp.x.toFixed(1)},${sp.y.toFixed(1)}`;
                          })
                          .join(' ');
                        const midSp = mapFacePt(cand.bridgePoints2D[1]);
                        return (
                          <g
                            key={cand.id}
                            onClick={() => setSelectedFacePairId(cand.id)}
                            className="cursor-pointer"
                          >
                            <polyline
                              points={bStr}
                              fill="none"
                              stroke={isSelected ? '#10b981' : '#f59e0b'}
                              strokeWidth={isSelected ? 3.5 : 2.5}
                              strokeDasharray="5,4"
                            />
                            <circle
                              cx={midSp.x}
                              cy={midSp.y}
                              r="5"
                              fill="#10b981"
                              stroke="#ffffff"
                              strokeWidth="1.2"
                            />
                            <text
                              x={midSp.x}
                              y={midSp.y - 8}
                              textAnchor="middle"
                              fontSize="8.5"
                              fontFamily="monospace"
                              fontWeight="700"
                              fill="#6ee7b7"
                            >
                              JOIN Δ={cand.endpointGapM}m (σ⊥={cand.perpendicularResidualM}m)
                            </text>
                          </g>
                        );
                      })}

                      {report.faceIntersections.map((node) => {
                        const sp = mapFacePt(node.point2D);
                        const fill =
                          node.type === 'X_NODE'
                            ? '#f43f5e'
                            : node.type === 'T_NODE'
                            ? '#eab308'
                            : '#38bdf8';
                        return (
                          <g key={node.id}>
                            <circle
                              cx={sp.x}
                              cy={sp.y}
                              r={node.type === 'X_NODE' ? 4.5 : 3.8}
                              fill={fill}
                              stroke="#090d16"
                              strokeWidth="1.2"
                            />
                            <text
                              x={sp.x + 6}
                              y={sp.y + 3}
                              fontSize="8"
                              fontFamily="monospace"
                              fill={fill}
                            >
                              {node.type === 'X_NODE'
                                ? `X (${node.intersectionAngleDeg}°)`
                                : node.type === 'T_NODE'
                                ? 'T'
                                : `EXIT→${node.perimeterZone}`}
                            </text>
                          </g>
                        );
                      })}
                    </svg>

                    <div className="w-full flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 px-2 pt-2 border-t border-slate-800/80">
                      <span>
                        Face Joints: {faceJoints.length} · Collinear Bridges:{' '}
                        {report.faceCollinearCandidates.length}
                      </span>
                      <span>
                        X/T Nodes: {report.faceIntersections.length} · Keyblocks/Wedges:{' '}
                        {report.faceBlocks.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Multi-Angle Virtual Scanline RQD(theta) Matrix Table */}
                <div
                  className={`rounded-xl border p-4 ${
                    isLight
                      ? 'bg-white border-slate-200'
                      : 'bg-[#0C1424] border-[#1E2F4D]'
                  }`}
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                    MATLAB Multi-Angle Virtual Scanline RQD(θ) Matrix — Priest &amp; Hudson (1976)
                  </h4>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 text-xs font-mono">
                    {report.directionalRqdProfile.map((sample) => (
                      <div
                        key={sample.angleDeg}
                        className={`p-2 rounded-lg border ${
                          isLight
                            ? 'bg-slate-50 border-slate-200'
                            : 'bg-[#080E1A] border-slate-800'
                        }`}
                      >
                        <div className="text-[10px] text-slate-400">
                          θ = {sample.angleDeg}°
                        </div>
                        <div className="font-bold text-cyan-400">
                          RQD {sample.theoreticalRqdPct}%
                        </div>
                        <div className="text-[10px] text-slate-500">
                          λ={sample.frequencyLambda}/m (N={sample.interceptCount})
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right 5 Columns: Collinear Candidates List + Block/Overbreak Matrix */}
              <div className="lg:col-span-5 space-y-4">
                <div
                  className={`rounded-xl border p-4 ${
                    isLight
                      ? 'bg-white border-slate-200'
                      : 'bg-[#0C1424] border-[#1E2F4D]'
                  }`}
                >
                  <h3 className="text-sm font-bold mb-1">
                    2D PCA Covariance Collinear Face Join Candidates
                  </h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Each candidate pair is tested with C = (1/N) XᵀX. Joining merges the broken segments while keeping exact Trace &amp; Dip angles.
                  </p>

                  {report.faceCollinearCandidates.length === 0 ? (
                    <div className="p-4 rounded-lg border border-dashed border-slate-700 text-center space-y-2">
                      <p className="text-xs text-slate-400">
                        No split collinear joint pairs detected on the current Tunnel Face.
                      </p>
                      {onUpdateJoints && (
                        <button
                          onClick={handleAddSampleSplitFaceTraces}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                        >
                          Generate Sample Split Face Traces to Test
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[310px] overflow-y-auto pr-1">
                      {report.faceCollinearCandidates.map((cand) => (
                        <div
                          key={cand.id}
                          onClick={() => setSelectedFacePairId(cand.id)}
                          className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                            selectedFacePairId === cand.id
                              ? 'border-emerald-500 bg-emerald-950/20'
                              : isLight
                              ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                              : 'bg-[#080E1A] border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-mono text-xs font-bold">
                              <span className="text-amber-400">{cand.setId}</span> ·{' '}
                              {cand.jointA.id} ↔ {cand.jointB.id}
                            </div>
                            <span className="text-xs font-mono text-emerald-400 font-bold">
                              {cand.confidencePct}% Match
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-2 text-[11px] font-mono text-slate-400">
                            <div>Gap: {cand.endpointGapM}m</div>
                            <div>Δθ: {cand.angleDiffDeg}°</div>
                            <div>σ_⊥: {cand.perpendicularResidualM}m</div>
                            <div>λ₁: {cand.eigenvalues2D[0]}</div>
                            <div>λ₂: {cand.eigenvalues2D[1]}</div>
                            <div>
                              Dip: {String(cand.preservedDipDirection).padStart(3, '0')}/
                              {String(cand.preservedDip).padStart(2, '0')}
                            </div>
                          </div>

                          {onUpdateJoints && (
                            <div className="mt-2.5 flex justify-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleJoinFaceCollinearPair(cand);
                                }}
                                className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <GitMerge className="w-3.5 h-3.5" />
                                Join Pair (Preserve {cand.preservedDipDirection}°/{cand.preservedDip}°)
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Face Blocks & Perimeter Breakout Wedges */}
                <div
                  className={`rounded-xl border p-4 ${
                    isLight
                      ? 'bg-white border-slate-200'
                      : 'bg-[#0C1424] border-[#1E2F4D]'
                  }`}
                >
                  <h3 className="text-sm font-bold mb-1">
                    Face Intersection Network &amp; Overbreak Block Polygons
                  </h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Blocks formed by intersecting Face joints and excavation perimeter boundaries.
                  </p>
                  {report.faceBlocks.length === 0 ? (
                    <p className="text-xs text-slate-400 font-mono">
                      Draw or generate at least 2 intersecting joints on the Face to compute block areas and wedge volumes.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {report.faceBlocks.map((blk) => (
                        <div
                          key={blk.id}
                          className={`p-2.5 rounded-lg border font-mono text-xs flex items-center justify-between ${
                            isLight
                              ? 'bg-slate-50 border-slate-200'
                              : 'bg-[#080E1A] border-slate-800'
                          }`}
                        >
                          <div>
                            <div className="font-bold text-amber-300">
                              {blk.isPerimeterWedge
                                ? `Perimeter Breakout Wedge (${blk.perimeterZone})`
                                : `Face Rock Block (${blk.id})`}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Area: {blk.areaSqM} m² · Perim: {blk.perimeterM} m · Est. Vol:{' '}
                              {blk.estimatedWedgeVolumeM3} m³
                            </div>
                          </div>
                          <span
                            className={`text-[11px] font-bold ${
                              blk.stabilityStatus === 'CRITICAL_OVERBREAK_KEYBLOCK'
                                ? 'text-rose-400'
                                : blk.stabilityStatus === 'POTENTIAL_FALL'
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {blk.stabilityStatus.replace(/_/g, ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================
              TAB 2: WALL & CROWN (90° CW 3D) SVD COPLANARITY & TRACE JOINING
             ================================================================== */}
          {activeTab === 'WALL_CROWN_3D_SVD' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7 space-y-4">
                <div
                  className={`rounded-xl border p-4 ${
                    isLight
                      ? 'bg-white border-slate-200'
                      : 'bg-[#0C1424] border-[#1E2F4D]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <h3 className="text-sm font-bold">
                        Wall &amp; Crown (90° Clockwise 2D→3D) — 3D SVD Coplanarity &amp; Sinusoidal Arch Solver
                      </h3>
                      <p className="text-xs text-slate-400">
                        Unwrapped horizontal 2D traces rotate 90° CW (u₃d = 1 − v₂d, v₃d = u₂d) into vertical 3D strip zones while keeping Trace &amp; Dip angles identical.
                      </p>
                    </div>
                    {onUpdateStripDataset && report.wallCrownJoinCandidates.length > 0 && (
                      <button
                        onClick={handleJoinAllStripSvdCandidates}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <GitMerge className="w-3.5 h-3.5" />
                        Auto-Join Coplanar 3D Strip Traces ({report.wallCrownJoinCandidates.length})
                      </button>
                    )}
                  </div>

                  {/* 3D Strip SVG Preview with SVD Coplanar Bridges */}
                  {(() => {
                    const svgW = 680;
                    const svgH = 340;
                    const padL = 70;
                    const padR = 24;
                    const padT = 26;
                    const padB = 30;
                    const plotW = svgW - padL - padR;
                    const plotH = svgH - padT - padB;

                    const startRd = stripDataset ? stripDataset.viewFromRd : 0;
                    const endRd = stripDataset
                      ? Math.max(stripDataset.viewToRd, startRd + 10)
                      : Math.max(4, settings.roundLength || 4);
                    const lwH =
                      (stripDataset?.leftWallArcLengthM ?? stripDataset?.leftWallHeightM) ||
                      geometry.leftWallArcLength ||
                      geometry.wallHeight ||
                      4.2;
                    const crW =
                      (stripDataset?.crownArcLengthM ?? stripDataset?.crownWidthM) ||
                      geometry.crownArcLength ||
                      geometry.width * 1.25 ||
                      6.0;
                    const rwH =
                      (stripDataset?.rightWallArcLengthM ?? stripDataset?.rightWallHeightM) ||
                      geometry.rightWallArcLength ||
                      geometry.wallHeight ||
                      4.2;
                    const totalPerim = Math.max(1, lwH + crW + rwH);

                    const mapStripToSvg = (pt: Point2D) => ({
                      x:
                        padL +
                        ((pt.x - startRd) / Math.max(1, endRd - startRd)) * plotW,
                      y: padT + (pt.y / Math.max(1, totalPerim)) * plotH,
                    });

                    const yLwEnd = padT + (lwH / totalPerim) * plotH;
                    const yCrEnd = padT + ((lwH + crW) / totalPerim) * plotH;

                    return (
                      <div className="rounded-lg border border-slate-800 bg-[#050912] p-2">
                        <svg
                          viewBox={`0 0 ${svgW} ${svgH}`}
                          className="w-full max-h-[340px] select-none"
                        >
                          <rect
                            x={padL}
                            y={padT}
                            width={plotW}
                            height={yLwEnd - padT}
                            fill="#0ea5e9"
                            fillOpacity="0.08"
                            stroke="#1e293b"
                          />
                          <rect
                            x={padL}
                            y={yLwEnd}
                            width={plotW}
                            height={yCrEnd - yLwEnd}
                            fill="#6366f1"
                            fillOpacity="0.08"
                            stroke="#1e293b"
                          />
                          <rect
                            x={padL}
                            y={yCrEnd}
                            width={plotW}
                            height={padT + plotH - yCrEnd}
                            fill="#06b6d4"
                            fillOpacity="0.08"
                            stroke="#1e293b"
                          />

                          <line
                            x1={padL}
                            y1={yLwEnd}
                            x2={padL + plotW}
                            y2={yLwEnd}
                            stroke="#38bdf8"
                            strokeWidth="1.2"
                            strokeDasharray="5,4"
                          />
                          <line
                            x1={padL}
                            y1={yCrEnd}
                            x2={padL + plotW}
                            y2={yCrEnd}
                            stroke="#38bdf8"
                            strokeWidth="1.2"
                            strokeDasharray="5,4"
                          />

                          <text
                            x={padL - 8}
                            y={(padT + yLwEnd) * 0.5}
                            textAnchor="end"
                            fontSize="9.5"
                            fontFamily="monospace"
                            fontWeight="700"
                            fill="#38bdf8"
                          >
                            LEFT WALL
                          </text>
                          <text
                            x={padL - 8}
                            y={(yLwEnd + yCrEnd) * 0.5}
                            textAnchor="end"
                            fontSize="9.5"
                            fontFamily="monospace"
                            fontWeight="700"
                            fill="#818cf8"
                          >
                            CROWN ARCH
                          </text>
                          <text
                            x={padL - 8}
                            y={(yCrEnd + padT + plotH) * 0.5}
                            textAnchor="end"
                            fontSize="9.5"
                            fontFamily="monospace"
                            fontWeight="700"
                            fill="#22d3ee"
                          >
                            RIGHT WALL
                          </text>

                          {(stripDataset?.traces || []).map((tr) => {
                            const pStr = tr.points
                              .map((p) => {
                                const sp = mapStripToSvg(p);
                                return `${sp.x.toFixed(1)},${sp.y.toFixed(1)}`;
                              })
                              .join(' ');
                            const col = resolveStripTraceColor(
                              tr.setId,
                              tr.structureType
                            );
                            const mid = mapStripToSvg(
                              tr.points[Math.floor(tr.points.length / 2)]
                            );
                            return (
                              <g key={tr.id}>
                                <polyline
                                  points={pStr}
                                  fill="none"
                                  stroke={col}
                                  strokeWidth="2.2"
                                />
                                <text
                                  x={mid.x}
                                  y={mid.y - 5}
                                  textAnchor="middle"
                                  fontSize="8.5"
                                  fontFamily="monospace"
                                  fontWeight="700"
                                  fill={col}
                                >
                                  {tr.setId} ({tr.orientationLabel})
                                </text>
                              </g>
                            );
                          })}

                          {report.wallCrownJoinCandidates.map((cand) => {
                            const isSel = selectedSvdJoinId === cand.id;
                            const bStr = cand.sinusoidalBridgeStripPts
                              .map((p) => {
                                const sp = mapStripToSvg(p);
                                return `${sp.x.toFixed(1)},${sp.y.toFixed(1)}`;
                              })
                              .join(' ');
                            const mid = mapStripToSvg(
                              cand.sinusoidalBridgeStripPts[
                                Math.floor(cand.sinusoidalBridgeStripPts.length / 2)
                              ]
                            );
                            return (
                              <g
                                key={cand.id}
                                onClick={() => setSelectedSvdJoinId(cand.id)}
                                className="cursor-pointer"
                              >
                                <polyline
                                  points={bStr}
                                  fill="none"
                                  stroke={isSel ? '#10b981' : '#f59e0b'}
                                  strokeWidth={isSel ? 3.4 : 2.4}
                                  strokeDasharray="5,3"
                                />
                                <circle
                                  cx={mid.x}
                                  cy={mid.y}
                                  r="4.5"
                                  fill="#10b981"
                                  stroke="#ffffff"
                                  strokeWidth="1.2"
                                />
                                <text
                                  x={mid.x}
                                  y={mid.y - 7}
                                  textAnchor="middle"
                                  fontSize="8"
                                  fontFamily="monospace"
                                  fontWeight="700"
                                  fill="#6ee7b7"
                                >
                                  SVD RMS={cand.rmsCoplanarityErrorM}m
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    );
                  })()}
                </div>

                {/* Table of Individual 3D SVD Plane Fits */}
                <div
                  className={`rounded-xl border p-4 ${
                    isLight
                      ? 'bg-white border-slate-200'
                      : 'bg-[#0C1424] border-[#1E2F4D]'
                  }`}
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">
                    3D Singular Value Decomposition [U, S, V] = svd(A) Per Trace
                  </h4>
                  <div className="overflow-x-auto max-h-[220px]">
                    <table className="w-full text-left text-xs font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-slate-700 text-slate-400 text-[11px]">
                          <th className="py-1.5 pr-2">Trace / Set</th>
                          <th className="py-1.5 px-2">Singular Values [σ₁, σ₂, σ₃]</th>
                          <th className="py-1.5 px-2">Unit Normal V(:,3)</th>
                          <th className="py-1.5 px-2">RMS Residual</th>
                          <th className="py-1.5 pl-2">Preserved DipDir/Dip</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.wallCrownSvdPlanes.map((p) => (
                          <tr
                            key={p.traceId}
                            className="border-b border-slate-800/70 hover:bg-slate-800/30"
                          >
                            <td className="py-1.5 pr-2 font-bold text-amber-300">
                              {p.setId} ({p.traceId.slice(0, 10)})
                            </td>
                            <td className="py-1.5 px-2 text-slate-300">
                              [{p.singularValues[0]}, {p.singularValues[1]}, {p.singularValues[2]}]
                            </td>
                            <td className="py-1.5 px-2 text-cyan-300">
                              [{p.unitNormal3D.x}, {p.unitNormal3D.y}, {p.unitNormal3D.z}]
                            </td>
                            <td className="py-1.5 px-2 text-emerald-400">
                              {p.rmsPlanarityResidualM} m
                            </td>
                            <td className="py-1.5 pl-2 font-bold">
                              {String(p.preservedDipDirectionDeg).padStart(3, '0')}/
                              {String(p.preservedDipDeg).padStart(2, '0')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right 5 Columns: Coplanar Join Candidates List */}
              <div className="lg:col-span-5 space-y-4">
                <div
                  className={`rounded-xl border p-4 ${
                    isLight
                      ? 'bg-white border-slate-200'
                      : 'bg-[#0C1424] border-[#1E2F4D]'
                  }`}
                >
                  <h3 className="text-sm font-bold mb-1">
                    3D SVD Coplanar Join Candidates (Wall ↔ Crown ↔ Pulls)
                  </h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Combines 3D arch points from both traces into matrix A, computes σ₃ coplanarity error, and fits a sinusoidal bridge curve while preserving exact Dip &amp; Dip Direction.
                  </p>

                  {report.wallCrownJoinCandidates.length === 0 ? (
                    <div className="p-4 rounded-lg border border-dashed border-slate-700 text-xs text-slate-400 font-mono">
                      Open this analyzer from the 3D Strip Logger or add multiple Wall/Crown traces to evaluate cross-surface SVD coplanar joins.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[510px] overflow-y-auto pr-1">
                      {report.wallCrownJoinCandidates.map((cand) => (
                        <div
                          key={cand.id}
                          onClick={() => setSelectedSvdJoinId(cand.id)}
                          className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                            selectedSvdJoinId === cand.id
                              ? 'border-cyan-400 bg-cyan-950/25'
                              : isLight
                              ? 'bg-slate-50 border-slate-200'
                              : 'bg-[#080E1A] border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-amber-300">
                              {cand.labelA} ↔ {cand.labelB}
                            </span>
                            <span className="font-mono text-xs font-bold text-emerald-400">
                              {cand.confidencePct}% Coplanar
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 mt-1">
                            {cand.surfaceA} → {cand.surfaceB} · Gap: {cand.gapDistanceM}m · RMS σ₃/√N:{' '}
                            {cand.rmsCoplanarityErrorM}m
                          </div>
                          <div className="text-[11px] font-mono text-cyan-300 mt-1">
                            SVD Normal V(:,3) = [{cand.combinedNormal3D.x},{' '}
                            {cand.combinedNormal3D.y}, {cand.combinedNormal3D.z}] · ΔNormal:{' '}
                            {cand.normalAngleDiffDeg}°
                          </div>
                          {onUpdateStripDataset && (
                            <div className="mt-2.5 flex justify-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleJoinStripSvdCandidate(cand);
                                }}
                                className="px-3 py-1 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <GitMerge className="w-3.5 h-3.5" />
                                Join via 3D SVD (Keep {cand.preservedDipDirectionDeg}°/
                                {cand.preservedDipDeg}°)
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================
              TAB 3: FACE <-> WALL/CROWN 3D VECTOR CROSS-PRODUCT TRUE DIP SOLVER
             ================================================================== */}
          {activeTab === 'FACE_WALL_CROSS_PRODUCT' && (
            <div className="space-y-4">
              <div
                className={`rounded-xl border p-4 ${
                  isLight
                    ? 'bg-white border-slate-200'
                    : 'bg-[#0C1424] border-[#1E2F4D]'
                }`}
              >
                <h3 className="text-sm font-bold mb-1">
                  Face ↔ Wall/Crown Perimeter Handshake &amp; 3D Vector Cross-Product True Dip Solver
                </h3>
                <p className="text-xs text-slate-400">
                  When a joint trace on the Tunnel Face (<code className="text-amber-300">t_face</code>) meets a corresponding trace on the Left Wall, Crown Arch, or Right Wall (<code className="text-cyan-300">t_wall</code>, rotated 90° CW into 3D), their vector cross-product{' '}
                  <code className="text-emerald-300">n = (t_face × t_wall) / ||t_face × t_wall||</code>{' '}
                  uniquely solves the exact 3D plane normal!
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.faceToWallCrossProducts.map((pair) => (
                  <div
                    key={pair.id}
                    onClick={() => setSelectedCrossId(pair.id)}
                    className={`rounded-xl border p-4 transition-colors cursor-pointer ${
                      selectedCrossId === pair.id
                        ? 'border-indigo-400 bg-indigo-950/20'
                        : isLight
                        ? 'bg-white border-slate-200'
                        : 'bg-[#0C1424] border-[#1E2F4D]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-mono text-xs font-bold">
                        <span className="text-amber-400">{getJointSetId(pair.faceJoint)}</span> · Face (
                        {pair.faceJoint.id}) × {pair.wallSurface} ({pair.wallJoint.id})
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {pair.confidencePct}% Handshake
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 font-mono text-[11px]">
                      <div>
                        <div className="text-slate-400">Face Vector t_face</div>
                        <div className="text-amber-300 font-bold">
                          [{pair.faceUnitVector3D.x}, {pair.faceUnitVector3D.y},{' '}
                          {pair.faceUnitVector3D.z}]
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">Wall Vector t_wall (90° CW)</div>
                        <div className="text-cyan-300 font-bold">
                          [{pair.wallUnitVector3D.x}, {pair.wallUnitVector3D.y},{' '}
                          {pair.wallUnitVector3D.z}]
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">Normal n = t_f × t_w</div>
                        <div className="text-emerald-300 font-bold">
                          [{pair.crossProductNormal3D.x}, {pair.crossProductNormal3D.y},{' '}
                          {pair.crossProductNormal3D.z}]
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-xs font-mono">
                      <div>
                        Solved True Orientation:{' '}
                        <strong className="text-emerald-400">
                          {String(pair.trueDipDirectionDeg).padStart(3, '0')}/
                          {String(pair.trueDipDeg).padStart(2, '0')}
                        </strong>{' '}
                        (Strike {String(pair.trueStrikeDeg).padStart(3, '0')}° · 3D Angle{' '}
                        {pair.intersectionAngle3DDeg}°)
                      </div>

                      {onUpdateJoints && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplyCrossProductOrientation(pair);
                          }}
                          className="px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer"
                        >
                          Apply True Dip/DipDir
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================================================================
              TAB 4: LIVE MATLAB (.M) SCRIPT & NUMERICAL MATRIX CONSOLE
             ================================================================== */}
          {activeTab === 'MATLAB_SCRIPT_CONSOLE' && (
            <div className="space-y-4">
              <div
                className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${
                  isLight
                    ? 'bg-white border-slate-200'
                    : 'bg-[#0C1424] border-[#1E2F4D]'
                }`}
              >
                <div>
                  <h3 className="text-sm font-bold">
                    Runnable Desktop MATLAB Script (.m) — TRaiC Segmentation + 3D SVD Solver
                  </h3>
                  <p className="text-xs text-slate-400">
                    Includes MATLAB <code className="text-fuchsia-300">adapthisteq / fibermetric / bwmorph('skel')</code> segmentation code, 90°-CW Wall/Crown 3D coordinates, <code className="text-amber-300">svd(A, 'econ')</code>, and <code className="text-cyan-300">cross(t_face, t_wall)</code>.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(report.matlabScriptCode);
                      setCopiedScript(true);
                      setTimeout(() => setCopiedScript(false), 2000);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-600 hover:border-slate-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedScript ? 'Copied .m Code!' : 'Copy MATLAB .m Code'}
                  </button>

                  <button
                    onClick={handleDownloadMatlabScript}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download MATLAB Script (.m)
                  </button>

                  <button
                    onClick={handleDownloadMatrixCsv}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export 3D SVD Matrix (.CSV)
                  </button>
                </div>
              </div>

              <pre className="p-4 rounded-xl border border-slate-800 bg-[#050811] text-emerald-300 font-mono text-xs overflow-x-auto max-h-[540px] leading-relaxed">
                {report.matlabScriptCode}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
