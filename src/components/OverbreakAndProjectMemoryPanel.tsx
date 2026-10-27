import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ConnectedSurveyProfile,
  Joint,
  JointSet,
  MappingWorkspaceMode,
  OutputSheetMode,
  OverbreakReasonCategory,
  OverbreakUndercutAnalysis,
  PlaneSurfaceConfig,
  QIndexParameters,
  RmrParameters,
  RockMassSummaryTable,
  SavedDesignGeometryRecord,
  SavedProjectRecord,
  SurfaceType,
  SurveyControlPoint,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import {
  parseSurveyControlPointsFromText,
  sortControlPointsAroundPerimeter,
} from '../engine/overbreakEngine';
import { computeAdvancedOverbreakPrediction } from '../engine/supportSpotBoltFailureEngine';
import { projectJointToAllSurfacesAndLookAhead, JointLookAheadProjectionResult } from '../engine/orientationEngine';
import { analyzeMultiRoundTrendAndLookAhead, MultiRoundTrendAndLookAheadReport } from '../engine/kinematicsSupportAndDxfEngine';
import {
  computeSectionToSectionVolumes,
  exportProjectHierarchyRegisterToCSV,
  filterSavedProjects,
  groupSavedProjectsByHierarchy,
} from '../engine/projectMemoryEngine';
import { SheetSettingsAndStorageEditor } from './SheetSettingsAndStorageEditor';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  Camera,
  CheckCircle2,
  Compass,
  Crosshair,
  Database,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FolderOpen,
  Layers,
  Link2,
  Lock,
  PanelLeft,
  PanelRight,
  Plus,
  Save,
  Search,
  Shield,
  Smartphone,
  Sparkles,
  Trash2,
  TrendingUp,
  Unlink,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import { ThemeToggleButton } from '../context/ThemeContext';
import {
  FieldExcavationRound,
  FieldMappingStoreState,
  loadFieldMappingStore,
  saveFieldMappingStore,
} from '../engine/fieldMappingEngine';
import {
  countAllPhotosInStore,
  deleteFieldExcavationRound,
  editFieldExcavationRoundMetadata,
  editPhotogrammetryProjectRecord,
  exportCompleteEswaAppPackageToFile,
  exportSingleFieldRoundToFile,
  exportSinglePhotogrammetryRecordToFile,
  FirebaseGoogleUser,
  importEswaUniversalPackageFromFile,
  loadCombinedFieldStore,
  moveFieldExcavationRound,
  movePhotogrammetryProjectRecord,
  saveFieldMappingResumeState,
} from '../engine/userCloudAndPackageEngine';

interface OverbreakAnalysisPanelProps {
  activeSurface: SurfaceType;
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  controlPoints: SurveyControlPoint[];
  surveyProfile: ConnectedSurveyProfile;
  analysis: OverbreakUndercutAnalysis;
  selectedControlPointId: string | null;
  onSelectControlPointId: (id: string | null) => void;
  onUpdateControlPoints: ( next: SurveyControlPoint[] ) => void;
  onUpdateSurveyProfile: (updater: (prev: ConnectedSurveyProfile) => ConnectedSurveyProfile) => void;
  onGenerateSampleAsBuiltProfile: () => void;
  onOpenProjectMemoryModal: () => void;
  onOpenExportSheet?: (mode?: OutputSheetMode) => void;
  joints?: Joint[];
  jointSets?: JointSet[];
  qIndexParams?: QIndexParameters;
  rmrParams?: RmrParameters;
  rockMassSummary?: RockMassSummaryTable;
  onUpdateRockMassSummary?: (next: RockMassSummaryTable) => void;
  savedProjects?: SavedProjectRecord[];
  embedded?: boolean;
  onSwitchToFaceSurface?: () => void;
  onClose: () => void;
  onStatusMessage?: (msg: string) => void;
}

const OverbreakAnalysisPanelComponent: React.FC<OverbreakAnalysisPanelProps> = ({
  activeSurface,
  geometry,
  settings,
  controlPoints,
  surveyProfile,
  analysis,
  selectedControlPointId,
  onSelectControlPointId,
  onUpdateControlPoints,
  onUpdateSurveyProfile,
  onGenerateSampleAsBuiltProfile,
  onOpenProjectMemoryModal,
  onOpenExportSheet,
  joints = [],
  jointSets = [],
  qIndexParams,
  rmrParams,
  rockMassSummary,
  onUpdateRockMassSummary,
  savedProjects = [],
  embedded = false,
  onSwitchToFaceSurface,
  onClose,
  onStatusMessage,
}) => {
  const [subTab, setSubTab] = useState<
    'profile_points' | 'quantities' | 'reasons' | 'round_trends' | 'look_ahead' | 'ai_predictor'
  >('quantities');
  const [lookAheadDist, setLookAheadDist] = useState<3 | 6 | 9>(3);
  const [customNextPullPredictionNote, setCustomNextPullPredictionNote] = useState<string>('');
  const [customMitigationNote, setCustomMitigationNote] = useState<string>('');

  // 1. Multi-Round Trend Comparison (Previous vs Current Round)
  const multiRoundReport = useMemo<MultiRoundTrendAndLookAheadReport>(() => {
    return analyzeMultiRoundTrendAndLookAhead({
      previousRounds: savedProjects || [],
      currentRound: {
        id: settings.tunnelName,
        settings,
        geometry,
        joints: joints || [],
        qIndexParams,
        rmrParams,
        quantitySummary: {
          overbreakVolumeM3:
            analysis.overbreakVolumeCubicMeters ??
            analysis.overbreakAreaSqMeters * (settings.roundLength || 3.5),
        },
      },
      geometry,
      settings,
      lookAheadMeters: [3, 6, 9],
    });
  }, [
    savedProjects,
    settings,
    geometry,
    joints,
    qIndexParams,
    rmrParams,
    analysis.overbreakVolumeCubicMeters,
    analysis.overbreakAreaSqMeters,
  ]);

  // 2. 3D Forward Look-Ahead Projections across all Face Joints (+3m, +6m, +9m)
  const jointLookAheads = useMemo<JointLookAheadProjectionResult[]>(() => {
    const list = joints || [];
    return list.map((j) =>
      projectJointToAllSurfacesAndLookAhead(
        j,
        geometry.width,
        geometry.height,
        settings.driveDirection || 70,
        [3, 6, 9]
      )
    );
  }, [joints, geometry.width, geometry.height, settings.driveDirection]);

  const aiOverbreakPrediction = useMemo(
    () =>
      computeAdvancedOverbreakPrediction(
        geometry,
        settings,
        analysis,
        joints,
        jointSets,
        qIndexParams || {
          rqd: 68,
          jn: 6,
          jnDescription: 'Two joint sets plus random',
          jr: 2,
          jrDescription: 'Smooth, undulating',
          ja: 2,
          jaDescription: 'Slightly altered joint walls',
          jw: 1,
          jwDescription: 'Dry excavations or minor inflow',
          srf: 2.5,
          srfDescription: 'Low stress, near surface',
          esr: 1.0,
        },
        rmrParams || {
          version: 'RMR89',
          strengthInputType: 'UCS_MPA',
          intactStrengthValueMPa: 75,
          intactStrengthDescription: '50–100 MPa (Strong)',
          intactStrengthRating: 7,
          rqdPercent: 68,
          rqdDescription: '50–75% (Fair)',
          rqdRating: 13,
          spacingMeters: 0.35,
          spacingDescription: '0.2–0.6 m (Moderate)',
          spacingRating: 10,
          conditionRating: 20,
          conditionDescription: 'Slightly rough',
          conditionSubRatings: {
            useDetailedSubRatings: true,
            persistenceValue: '1–3 m',
            persistenceRating: 4,
            apertureValue: '0.1–1.0 mm',
            apertureRating: 4,
            roughnessValue: 'Slightly rough',
            roughnessRating: 5,
            infillingValue: 'Hard < 5 mm',
            infillingRating: 4,
            weatheringValue: 'Slightly weathered',
            weatheringRating: 5,
          },
          groundwaterInflowLPerMin10m: 2,
          groundwaterRating: 15,
          groundwaterDescription: 'Dry',
          orientationAdjustmentRating: -5,
          orientationFavourability: 'Fair',
          paramStatus: {
            intactStrength: 'USER_ENTERED',
            rqd: 'USER_ENTERED',
            spacing: 'USER_ENTERED',
            condition: 'USER_ENTERED',
            groundwater: 'USER_ENTERED',
            orientationAdjustment: 'USER_ENTERED',
          },
          userConfirmed: true,
        },
        rockMassSummary || {
          rockType: settings.lithology || 'Quartzite',
          rockUnit: 'Main Unit',
          weatheringGrade: 'W2 (Slightly Weathered)',
          strengthGrade: 'R4 (Strong, 50–100 MPa)',
          foliationBeddingSpacing: '0.2–0.6 m (Moderately Spaced)',
          groundwaterCondition: 'Dry to Damp',
          overbreakCondition: 'Minor wedge overbreak',
          installedSupport: 'Systematic Rockbolts + 50mm SFRS',
          geologistRemarks: '',
        },
        savedProjects
      ),
    [geometry, settings, analysis, joints, jointSets, qIndexParams, rmrParams, rockMassSummary, savedProjects]
  );

  const handleApplyAiOverbreakDiagnosisToAllZones = () => {
    const nextOverrides: ConnectedSurveyProfile['zoneReasonOverrides'] = {
      ...(surveyProfile.zoneReasonOverrides || {}),
    };
    aiOverbreakPrediction.zonePredictions.forEach((zp) => {
      nextOverrides[zp.zoneId] = {
        zoneId: zp.zoneId,
        category: zp.predictedCategory,
        reasonDetail: `${zp.primaryMechanism} — ${zp.detailedExplanation}`,
        linkedJointSets: zp.controllingJointSets,
      };
    });

    onUpdateSurveyProfile((prev) => ({
      ...prev,
      overallOverbreakCategory: aiOverbreakPrediction.overallDominantCategory,
      overallOverbreakReason: aiOverbreakPrediction.advanceLevelRootCauseSummary,
      zoneReasonOverrides: nextOverrides,
    }));

    if (rockMassSummary && onUpdateRockMassSummary) {
      onUpdateRockMassSummary({
        ...rockMassSummary,
        overbreakCondition: `${aiOverbreakPrediction.overallDominantCategory} (${aiOverbreakPrediction.geologicalSharePct}% Geol / ${aiOverbreakPrediction.mechanicalSharePct}% Mech) · Next Pull Pred: ${aiOverbreakPrediction.nextPullPredictedOverbreakPct}% (${aiOverbreakPrediction.nextPullPredictedMaxRadialM}m max)`,
      });
    }

    onStatusMessage?.(
      `AI Overbreak Diagnosis Applied: ${aiOverbreakPrediction.overallDominantCategory} (${aiOverbreakPrediction.geologicalSharePct}% Geological / ${aiOverbreakPrediction.mechanicalSharePct}% Mechanical) + Next Pull Prediction (${aiOverbreakPrediction.nextPullPredictedOverbreakPct}%).`
    );
  };
  const [showImportBox, setShowImportBox] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>(
    'CP1, -4.20, 0.00\nCP2, -4.35, 2.20\nCP3, -4.28, 4.25\nCP4, -3.15, 6.18\nCP5, 0.00, 7.62\nCP6, 3.28, 6.24\nCP7, 4.42, 4.20\nCP8, 4.02, 2.10\nCP9, 4.20, 0.00'
  );
  const [dockSide, setDockSide] = useState<'left' | 'right'>('right');
  const [panelWidthPx, setPanelWidthPx] = useState<number>(384);
  const [resizingState, setResizingState] = useState<{
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    if (!resizingState) return;
    const onMove = (ev: MouseEvent | PointerEvent) => {
      const dx = ev.clientX - resizingState.startX;
      const delta = dockSide === 'right' ? -dx : dx;
      setPanelWidthPx(
        Math.max(280, Math.min(720, Math.round(resizingState.startWidth + delta)))
      );
    };
    const onUp = () => setResizingState(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [resizingState, dockSide]);

  // Radial Overbreak (Crown, Left Wall & Right Wall Overbreak) is strictly plotted on the Tunnel Face ('face') cross-section
  const surfaceCPs = useMemo(
    () => controlPoints.filter((c) => c.surface === 'face'),
    [controlPoints]
  );

  const connectedIdSet = useMemo(
    () => new Set(surveyProfile.orderedControlPointIds),
    [surveyProfile.orderedControlPointIds]
  );

  // Connect all visible surface control points in perimeter sequence
  const handleAutoConnectPerimeter = () => {
    if (surfaceCPs.length < 2) {
      onStatusMessage?.('Add at least 2 Survey Control Points (or load Sample Profile) first.');
      return;
    }
    const sortedIds = sortControlPointsAroundPerimeter(surfaceCPs, geometry);
    onUpdateSurveyProfile((prev) => ({
      ...prev,
      surface: 'face',
      orderedControlPointIds: sortedIds,
      isClosed: true,
      visible: true,
    }));
    onSwitchToFaceSurface?.();
    onStatusMessage?.(
      `Connected ${sortedIds.length} survey control points (${sortedIds
        .map((id) => surfaceCPs.find((c) => c.id === id)?.label || id)
        .join(' → ')}) around tunnel profile.`
    );
  };

  // Connect in current creation order
  const handleConnectInOrder = () => {
    if (surfaceCPs.length < 2) {
      onStatusMessage?.('Place at least 2 Survey Control Points to connect a profile.');
      return;
    }
    const ids = surfaceCPs.map((c) => c.id);
    onUpdateSurveyProfile((prev) => ({
      ...prev,
      surface: 'face',
      orderedControlPointIds: ids,
      visible: true,
    }));
    onSwitchToFaceSurface?.();
    onStatusMessage?.(
      `Connected ${ids.length} control points in sequence: ${surfaceCPs
        .map((c) => c.label)
        .join(' → ')}.`
    );
  };

  // Disconnect all segments
  const handleDisconnectAll = () => {
    onUpdateSurveyProfile((prev) => ({
      ...prev,
      orderedControlPointIds: [],
    }));
    onStatusMessage?.(
      'Disconnected survey profile segments. Isolated control points remain editable.'
    );
  };

  // Toggle whether a single CP is in the connected profile sequence
  const handleTogglePointInSequence = (cpId: string) => {
    if (surveyProfile.locked) return;
    onUpdateSurveyProfile((prev) => {
      const exists = prev.orderedControlPointIds.includes(cpId);
      const nextIds = exists
        ? prev.orderedControlPointIds.filter((id) => id !== cpId)
        : [...prev.orderedControlPointIds, cpId];
      return {
        ...prev,
        orderedControlPointIds: nextIds,
      };
    });
  };

  // Move a connected CP up or down in the sequence
  const handleMovePointInSequence = (cpId: string, direction: -1 | 1) => {
    if (surveyProfile.locked) return;
    onUpdateSurveyProfile((prev) => {
      const idx = prev.orderedControlPointIds.indexOf(cpId);
      if (idx === -1) return prev;
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= prev.orderedControlPointIds.length) return prev;
      const copy = [...prev.orderedControlPointIds];
      const [item] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, item);
      return {
        ...prev,
        orderedControlPointIds: copy,
      };
    });
  };

  // Insert a new control point midway between connected point i and i+1
  const handleInsertMidpointAfter = (cpId: string) => {
    if (surveyProfile.locked) return;
    const seq = surveyProfile.orderedControlPointIds;
    const idx = seq.indexOf(cpId);
    if (idx === -1 || seq.length < 2) return;
    const nextId = seq[(idx + 1) % seq.length];
    const cpA = surfaceCPs.find((c) => c.id === cpId);
    const cpB = surfaceCPs.find((c) => c.id === nextId);
    if (!cpA || !cpB) return;

    const midPt = {
      x: Number(((cpA.point.x + cpB.point.x) / 2).toFixed(2)),
      y: Number(((cpA.point.y + cpB.point.y) / 2).toFixed(2)),
    };
    const newCp: SurveyControlPoint = {
      id: `cp-ins-${Date.now()}`,
      label: `CP${surfaceCPs.length + 1}`,
      surface: 'face',
      point: midPt,
      color: '#10B981',
      visible: true,
      locked: false,
    };

    onUpdateControlPoints([...controlPoints, newCp]);
    onUpdateSurveyProfile((prev) => {
      const copy = [...prev.orderedControlPointIds];
      copy.splice(idx + 1, 0, newCp.id);
      return {
        ...prev,
        orderedControlPointIds: copy,
      };
    });
    onSelectControlPointId(newCp.id);
    onStatusMessage?.(`Inserted ${newCp.label} at (${midPt.x.toFixed(2)}m, ${midPt.y.toFixed(2)}m).`);
  };

  // Import survey points from text (strictly onto Tunnel Face cross-section for Crown & Wall radial overbreak)
  const handleImportSurveyText = () => {
    const parsed = parseSurveyControlPointsFromText(
      importText,
      'face',
      surfaceCPs.length
    );
    if (parsed.length === 0) {
      onStatusMessage?.('No valid X, Y survey coordinates found in text.');
      return;
    }
    const otherSurfaceCPs = controlPoints.filter((c) => c.surface !== 'face');
    onUpdateControlPoints([...otherSurfaceCPs, ...parsed]);
    onUpdateSurveyProfile((prev) => ({
      ...prev,
      surface: 'face',
      orderedControlPointIds: parsed.map((c) => c.id),
      isClosed: true,
      visible: true,
    }));
    onSwitchToFaceSurface?.();
    setShowImportBox(false);
    onStatusMessage?.(
      `Imported & connected ${parsed.length} surveyed profile control points.`
    );
  };

  return (
    <aside
      style={embedded ? undefined : { width: `${panelWidthPx}px` }}
      className={
        embedded
          ? 'relative w-full flex-1 bg-[#111621] flex flex-col min-h-0 text-xs font-mono overflow-hidden'
          : `relative max-w-[52vw] bg-[#111621] ${
              dockSide === 'left' ? 'order-first border-r' : 'order-last border-l'
            } border-slate-800 flex flex-col h-full text-xs font-mono shrink-0 z-20 transition-[width] duration-75`
      }
    >
      {/* Interactive Drag-to-Resize Handle (Drag Edge to Expand or Shrink) */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          setResizingState({ startX: e.clientX, startWidth: panelWidthPx });
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          setResizingState({ startX: e.clientX, startWidth: panelWidthPx });
        }}
        title="Drag edge left or right to expand or shrink panel"
        className={`flex items-center justify-center absolute top-0 bottom-0 w-3 cursor-col-resize z-30 group hover:bg-sky-500/10 transition-colors ${
          dockSide === 'left' ? '-right-1.5' : '-left-1.5'
        }`}
      >
        <div className="h-20 w-1.5 rounded-full bg-slate-300 group-hover:bg-sky-500 transition-colors" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 border-b border-slate-200 gap-1">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-rose-600 shrink-0" />
          <div className="truncate">
            <div className="font-display font-bold text-slate-900 text-xs tracking-wide truncate">
              OVERBREAK &amp; UNDERCUT ANALYSIS
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              Drag edge to expand · Design ({geometry.width.toFixed(2)}m × {geometry.height.toFixed(2)}m)
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setDockSide((s) => (s === 'right' ? 'left' : 'right'))}
            className="px-1.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] flex items-center gap-0.5 cursor-pointer"
            title="Move Panel to Left or Right Side"
          >
            {dockSide === 'right' ? <PanelLeft className="w-3 h-3" /> : <PanelRight className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdateSurveyProfile((prev) => ({ ...prev, visible: !prev.visible }))
            }
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            title={surveyProfile.visible ? 'Hide Overbreak/Undercut Layer' : 'Show Layer'}
          >
            {surveyProfile.visible ? (
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdateSurveyProfile((prev) => ({ ...prev, locked: !prev.locked }))
            }
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            title={surveyProfile.locked ? 'Unlock Survey Profile' : 'Lock Survey Profile'}
          >
            {surveyProfile.locked ? (
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Unlock className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white"
            title="Close Overbreak Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Realistic Tunnel Geometry Rule Banner: Why Crown & Wall Overbreak is Plotted on Tunnel Face */}
      {activeSurface !== 'face' ? (
        <div className="mx-2.5 mt-2 p-2.5 rounded-lg bg-amber-950/80 border border-amber-500/60 text-amber-100 space-y-1.5">
          <div className="text-[10px] font-black text-amber-300 uppercase tracking-wide">
            Not Possible on Unwrapped {activeSurface === 'crown' ? 'Crown' : activeSurface === 'leftWall' ? 'Left Wall' : 'Right Wall'} View
          </div>
          <p className="text-[10px] leading-relaxed text-amber-100/90">
            Radial Overbreak in the <strong>Crown</strong> and <strong>Walls</strong> cannot be geometrically plotted on a flat 2D unwrapped Wall/Crown plane. That is why{' '}
            <strong>Crown Overbreak, Left Wall Overbreak &amp; Right Wall Overbreak are realistically plotted on the Tunnel Face (1. Face)</strong> cross-section!
          </p>
          {onSwitchToFaceSurface && (
            <button
              type="button"
              onClick={onSwitchToFaceSurface}
              className="w-full py-1.5 px-2.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] cursor-pointer"
            >
              Switch to 1. Face (Plot Crown &amp; Wall Overbreak) →
            </button>
          )}
        </div>
      ) : (
        <div className="mx-2.5 mt-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-[10px] text-emerald-200 leading-relaxed">
          <strong className="text-emerald-300">Realistic Tunnel Shape (1. Face Cross-Section):</strong>{' '}
          Crown Arch Overbreak, Left Wall Overbreak &amp; Right Wall Overbreak are plotted here on the Face cross-section (since radial overbreak is not geometrically possible on flat unwrapped Wall/Crown views).
        </div>
      )}

      {/* Quick Action Bar */}
      <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={surveyProfile.locked}
            onClick={onGenerateSampleAsBuiltProfile}
            className="flex items-center justify-center gap-1 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold rounded text-[11px]"
            title="Place Survey Control Points around the tunnel perimeter for as-built profile adjustment"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Auto-Place Perimeter Pts
          </button>
          <button
            type="button"
            disabled={surveyProfile.locked || surfaceCPs.length < 2}
            onClick={handleAutoConnectPerimeter}
            className="flex items-center justify-center gap-1 px-2 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-semibold rounded text-[11px]"
            title="Connect all control points in clockwise sequence around tunnel perimeter"
          >
            <Link2 className="w-3.5 h-3.5" />
            Connect Perimeter ({surfaceCPs.length})
          </button>
        </div>

        <div className="flex items-center justify-between gap-1.5">
          <button
            type="button"
            disabled={surveyProfile.locked || surfaceCPs.length < 2}
            onClick={handleConnectInOrder}
            className="flex-1 py-1 px-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 rounded text-[10px]"
          >
            Connect CP1→CPn
          </button>
          <button
            type="button"
            disabled={surveyProfile.locked || surveyProfile.orderedControlPointIds.length === 0}
            onClick={handleDisconnectAll}
            className="flex items-center gap-1 py-1 px-2 bg-slate-800 hover:bg-rose-950/60 disabled:opacity-40 text-slate-300 hover:text-rose-200 border border-slate-700 rounded text-[10px]"
          >
            <Unlink className="w-3 h-3" />
            Disconnect
          </button>
          <button
            type="button"
            onClick={() => setShowImportBox((p) => !p)}
            className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded text-[10px]"
          >
            Import XY
          </button>
        </div>

        {showImportBox && (
          <div className="p-2 bg-slate-950 border border-slate-700 rounded space-y-1.5">
            <div className="text-[10px] text-slate-400">
              Paste Survey Control Points (`Label, X(m), Y(m)`):
            </div>
            <textarea
              rows={4}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full p-1.5 bg-slate-900 border border-slate-700 rounded text-[10px] text-slate-200 font-mono"
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setShowImportBox(false)}
                className="px-2 py-1 text-[10px] text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportSurveyText}
                className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[10px] font-semibold"
              >
                Import &amp; Connect
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sub-navigation Tabs */}
      <div className="grid grid-cols-3 sm:grid-cols-6 bg-[#0B0E14] border-b border-slate-800 p-1 gap-1">
        <button
          type="button"
          onClick={() => setSubTab('quantities')}
          className={`py-1.5 px-1 rounded text-[10px] font-semibold transition-colors cursor-pointer text-center ${
            subTab === 'quantities'
              ? 'bg-cyan-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          1. Quantities
        </button>
        <button
          type="button"
          onClick={() => setSubTab('profile_points')}
          className={`py-1.5 px-1 rounded text-[10px] font-semibold transition-colors cursor-pointer text-center ${
            subTab === 'profile_points'
              ? 'bg-cyan-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          2. CPs ({analysis.connectedPointsCount})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('reasons')}
          className={`py-1.5 px-1 rounded text-[10px] font-semibold transition-colors cursor-pointer text-center ${
            subTab === 'reasons'
              ? 'bg-cyan-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          3. Reasons
        </button>
        <button
          type="button"
          onClick={() => setSubTab('round_trends')}
          className={`py-1.5 px-1 rounded text-[10px] font-bold transition-colors cursor-pointer text-center flex items-center justify-center gap-1 ${
            subTab === 'round_trends'
              ? 'bg-cyan-600 text-white shadow'
              : 'text-cyan-400 hover:text-cyan-200 hover:bg-slate-900'
          }`}
        >
          <TrendingUp className="w-3 h-3" />
          <span>4. Trends (Δ)</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('look_ahead')}
          className={`py-1.5 px-1 rounded text-[10px] font-bold transition-colors cursor-pointer text-center flex items-center justify-center gap-1 ${
            subTab === 'look_ahead'
              ? 'bg-amber-600 text-white shadow'
              : 'text-amber-400 hover:text-amber-200 hover:bg-slate-900'
          }`}
        >
          <Compass className="w-3 h-3" />
          <span>5. Look-Ahead</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('ai_predictor')}
          className={`py-1.5 px-1 rounded text-[10px] font-bold transition-colors cursor-pointer text-center flex items-center justify-center gap-1 ${
            subTab === 'ai_predictor'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-emerald-400 hover:text-emerald-200 bg-emerald-950/30'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          <span>6. AI Predict</span>
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {!analysis.hasConnectedProfile && (
          <div className="p-3 bg-amber-950/40 border border-amber-600/50 rounded text-[11px] text-amber-200 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              No Connected Survey Profile Yet
            </div>
            <p className="text-[10px] text-amber-200/90 leading-relaxed">
              Isolated control points alone do not define a complete tunnel profile. Click{' '}
              <strong>&quot;Load Sample As-Built&quot;</strong> or place Control Points on the
              canvas and click <strong>&quot;Connect Perimeter&quot;</strong> (CP1 → CP2 → CP3 →
              ...) to calculate Overbreak and Undercut.
            </p>
          </div>
        )}

        {subTab === 'quantities' && (
          <>
            {/* Reference Design vs Surveyed As-Built Summary */}
            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded space-y-1.5">
              <div className="text-[10px] font-bold text-cyan-400 border-b border-slate-800 pb-1 flex items-center justify-between">
                <span>PROFILE COMPARISON ({settings.faceChainage})</span>
                <span className="text-slate-400">{geometry.source.toUpperCase()}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2 bg-slate-950 rounded border border-slate-800/90">
                  <div className="text-[10px] text-slate-400">Design Area</div>
                  <div className="text-sm font-bold text-cyan-300">
                    {analysis.designAreaSqMeters.toFixed(2)} m²
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Perim: {analysis.designPerimeterMeters.toFixed(2)} m
                  </div>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800/90">
                  <div className="text-[10px] text-slate-400">Surveyed As-Built</div>
                  <div className="text-sm font-bold text-emerald-300">
                    {analysis.hasConnectedProfile
                      ? `${analysis.surveyedAreaSqMeters.toFixed(2)} m²`
                      : '—'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Perim:{' '}
                    {analysis.hasConnectedProfile
                      ? `${analysis.surveyedPerimeterMeters.toFixed(2)} m`
                      : 'Not connected'}
                  </div>
                </div>
              </div>
            </div>

            {/* Pull / Chainage Interval Configuration for Volume Calculation */}
            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={surveyProfile.useValidPullInterval}
                    onChange={(e) =>
                      onUpdateSurveyProfile((prev) => ({
                        ...prev,
                        useValidPullInterval: e.target.checked,
                        pullIntervalMeters:
                          e.target.checked && (!prev.pullIntervalMeters || prev.pullIntervalMeters <= 0)
                            ? settings.roundLength || 3.5
                            : prev.pullIntervalMeters,
                      }))
                    }
                    className="rounded border-slate-700 bg-slate-950 text-cyan-500"
                  />
                  Valid Pull / Chainage Interval (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  disabled={!surveyProfile.useValidPullInterval}
                  value={surveyProfile.pullIntervalMeters ?? ''}
                  placeholder="e.g. 3.50"
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    onUpdateSurveyProfile((prev) => ({
                      ...prev,
                      pullIntervalMeters: Number.isNaN(val) ? null : val,
                    }));
                  }}
                  className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right text-cyan-300 font-bold"
                />
              </div>
              <div
                className={`text-[10px] px-2 py-1 rounded border ${
                  analysis.hasValidVolumeInterval
                    ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                    : 'bg-amber-950/50 border-amber-700/60 text-amber-300 font-semibold'
                }`}
              >
                {analysis.volumeStatusMessage}
              </div>
            </div>

            {/* OVERBREAK CARD (Outside Design Boundary) */}
            <div className="p-2.5 bg-rose-950/20 border border-rose-500/40 rounded space-y-1.5">
              <div className="flex items-center justify-between border-b border-rose-900/50 pb-1">
                <span className="font-bold text-rose-300">
                  OVERBREAK (OUTSIDE DESIGN)
                </span>
                <span className="px-1.5 py-0.5 bg-rose-950 text-rose-300 rounded text-[10px] border border-rose-700/50">
                  {analysis.overbreakRegions.length} Zone(s)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Area:</span>
                  <strong className="text-rose-300">
                    {analysis.overbreakAreaSqMeters.toFixed(2)} m²
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Overbreak %:</span>
                  <strong className="text-rose-300">
                    {analysis.overbreakPercentage.toFixed(2)}%
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Max Radial:</span>
                  <strong className="text-slate-100">
                    {analysis.maxRadialOverbreakMeters.toFixed(3)} m
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Min Radial:</span>
                  <strong className="text-slate-100">
                    {analysis.minRadialOverbreakMeters.toFixed(3)} m
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Avg Radial:</span>
                  <strong className="text-slate-100">
                    {analysis.avgRadialOverbreakMeters.toFixed(3)} m
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Perimeter:</span>
                  <strong className="text-slate-100">
                    {analysis.overbreakPerimeterMeters.toFixed(2)} m
                  </strong>
                </div>
              </div>
              <div className="pt-1 border-t border-rose-900/40 flex items-center justify-between text-[11px]">
                <span className="text-slate-300">Overbreak Volume:</span>
                {analysis.overbreakVolumeCubicMeters !== null ? (
                  <strong className="text-rose-300 text-xs">
                    {analysis.overbreakVolumeCubicMeters.toFixed(2)} m³
                  </strong>
                ) : (
                  <span className="text-[10px] text-amber-300">
                    Volume requires valid chainage/pull interval.
                  </span>
                )}
              </div>
            </div>

            {/* UNDERCUT CARD (Inside Design Boundary) */}
            <div className="p-2.5 bg-amber-950/20 border border-amber-500/40 rounded space-y-1.5">
              <div className="flex items-center justify-between border-b border-amber-900/50 pb-1">
                <span className="font-bold text-amber-300">
                  UNDERCUT (INSIDE DESIGN)
                </span>
                <span className="px-1.5 py-0.5 bg-amber-950 text-amber-300 rounded text-[10px] border border-amber-700/50">
                  {analysis.undercutRegions.length} Zone(s)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Area:</span>
                  <strong className="text-amber-300">
                    {analysis.undercutAreaSqMeters.toFixed(2)} m²
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Undercut %:</span>
                  <strong className="text-amber-300">
                    {analysis.undercutPercentage.toFixed(2)}%
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Max Undercut:</span>
                  <strong className="text-slate-100">
                    {analysis.maxRadialUndercutMeters.toFixed(3)} m
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Avg Undercut:</span>
                  <strong className="text-slate-100">
                    {analysis.avgRadialUndercutMeters.toFixed(3)} m
                  </strong>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-slate-400">Affected Perimeter:</span>
                  <strong className="text-slate-100">
                    {analysis.undercutPerimeterMeters.toFixed(2)} m
                  </strong>
                </div>
              </div>
              <div className="pt-1 border-t border-amber-900/40 flex items-center justify-between text-[11px]">
                <span className="text-slate-300">Undercut Volume:</span>
                {analysis.undercutVolumeCubicMeters !== null ? (
                  <strong className="text-amber-300 text-xs">
                    {analysis.undercutVolumeCubicMeters.toFixed(2)} m³
                  </strong>
                ) : (
                  <span className="text-[10px] text-amber-300">
                    Volume requires valid chainage/pull interval.
                  </span>
                )}
              </div>
            </div>

            {/* Direct Button to Open Overbreak & Engineering Quantity Sheet */}
            {onOpenExportSheet && (
              <button
                type="button"
                onClick={() => onOpenExportSheet('ENGINEERING_QUANTITY_SHEET')}
                className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded flex items-center justify-center gap-2 text-[11px] font-bold shadow cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                Open Overbreak &amp; Engineering Quantity Sheet →
              </button>
            )}

            {/* Multi-Section Volume & Project File Memory Shortcut */}
            <button
              type="button"
              onClick={onOpenProjectMemoryModal}
              className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-700/50 rounded flex items-center justify-center gap-2 text-[11px] font-semibold"
            >
              <Database className="w-3.5 h-3.5" />
              Project Memory &amp; Section-to-Section Volumes
            </button>
          </>
        )}

        {subTab === 'profile_points' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-800">
              <label className="flex items-center gap-1.5 text-[11px] text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={surveyProfile.isClosed}
                  disabled={surveyProfile.locked}
                  onChange={(e) =>
                    onUpdateSurveyProfile((prev) => ({
                      ...prev,
                      isClosed: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-700 bg-slate-950 text-emerald-500"
                />
                Close Profile Loop (CPn → CP1)
              </label>
              <span className="text-[10px] text-emerald-400">
                {surveyProfile.orderedControlPointIds.length} Connected
              </span>
            </div>

            <div className="text-[10px] text-slate-400">
              Connected Sequence:{' '}
              <strong className="text-emerald-300">
                {surveyProfile.orderedControlPointIds.length > 0
                  ? surveyProfile.orderedControlPointIds
                      .map((id) => surfaceCPs.find((c) => c.id === id)?.label || '?')
                      .join(' → ') + (surveyProfile.isClosed ? ' → Close' : '')
                  : 'None (Click Connect Perimeter above)'}
              </strong>
            </div>

            {/* Ordered Control Points Table */}
            <div className="space-y-1.5">
              {surfaceCPs.length === 0 ? (
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded text-center text-slate-400 text-[11px]">
                  No survey control points on this surface yet. Click on the canvas or click
                  &quot;Load Sample As-Built&quot;.
                </div>
              ) : (
                surfaceCPs.map((cp) => {
                  const seqIdx = surveyProfile.orderedControlPointIds.indexOf(cp.id);
                  const isConnected = connectedIdSet.has(cp.id);
                  const isSel = selectedControlPointId === cp.id;
                  return (
                    <div
                      key={cp.id}
                      onClick={() => onSelectControlPointId(cp.id)}
                      className={`p-2 rounded border transition-colors cursor-pointer space-y-1.5 ${
                        isSel
                          ? 'bg-emerald-950/50 border-emerald-500/60'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={isConnected}
                            disabled={surveyProfile.locked}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleTogglePointInSequence(cp.id);
                            }}
                            title="Include/exclude control point in connected profile"
                            className="rounded border-slate-700 bg-slate-950 text-emerald-500"
                          />
                          <span className="font-bold text-emerald-300">{cp.label}</span>
                          {seqIdx >= 0 && (
                            <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-700/60 rounded text-[9px]">
                              #{seqIdx + 1}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {isConnected && (
                            <>
                              <button
                                type="button"
                                disabled={surveyProfile.locked || seqIdx <= 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMovePointInSequence(cp.id, -1);
                                }}
                                className="p-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded"
                                title="Move earlier in sequence"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={
                                  surveyProfile.locked ||
                                  seqIdx >= surveyProfile.orderedControlPointIds.length - 1
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMovePointInSequence(cp.id, 1);
                                }}
                                className="p-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded"
                                title="Move later in sequence"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={surveyProfile.locked}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInsertMidpointAfter(cp.id);
                                }}
                                className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-[9px]"
                                title="Insert new point after this CP along segment"
                              >
                                +Ins
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            disabled={surveyProfile.locked || cp.locked}
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateControlPoints(
                                controlPoints.filter((item) => item.id !== cp.id)
                              );
                              onUpdateSurveyProfile((prev) => ({
                                ...prev,
                                orderedControlPointIds: prev.orderedControlPointIds.filter(
                                  (id) => id !== cp.id
                                ),
                              }));
                            }}
                            className="p-0.5 text-slate-400 hover:text-rose-400"
                            title="Delete Control Point"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <label className="flex items-center gap-1 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                          <span className="text-[9px] text-slate-500">X:</span>
                          <input
                            type="number"
                            step="0.02"
                            disabled={surveyProfile.locked || cp.locked}
                            value={cp.point.x}
                            onChange={(e) => {
                              const nx = parseFloat(e.target.value);
                              if (Number.isNaN(nx)) return;
                              onUpdateControlPoints(
                                controlPoints.map((item) =>
                                  item.id === cp.id
                                    ? { ...item, point: { x: nx, y: item.point.y } }
                                    : item
                                )
                              );
                            }}
                            className="w-full bg-transparent text-slate-100 text-[10px] focus:outline-none"
                          />
                          <span className="text-[9px] text-slate-500">m</span>
                        </label>
                        <label className="flex items-center gap-1 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                          <span className="text-[9px] text-slate-500">Y:</span>
                          <input
                            type="number"
                            step="0.02"
                            disabled={surveyProfile.locked || cp.locked}
                            value={cp.point.y}
                            onChange={(e) => {
                              const ny = parseFloat(e.target.value);
                              if (Number.isNaN(ny)) return;
                              onUpdateControlPoints(
                                controlPoints.map((item) =>
                                  item.id === cp.id
                                    ? { ...item, point: { x: item.point.x, y: ny } }
                                    : item
                                )
                              );
                            }}
                            className="w-full bg-transparent text-slate-100 text-[10px] focus:outline-none"
                          />
                          <span className="text-[9px] text-slate-500">m</span>
                        </label>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {subTab === 'reasons' && (
          <div className="space-y-3">
            {/* One-Click AI Overbreak Root-Cause Diagnosis Banner */}
            <div className="p-2.5 bg-emerald-950/30 border border-emerald-500/50 rounded space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  AI ROOT-CAUSE: {aiOverbreakPrediction.overallDominantCategory} ({aiOverbreakPrediction.geologicalSharePct}% GEOL / {aiOverbreakPrediction.mechanicalSharePct}% MECH)
                </span>
              </div>
              <p className="text-[10px] text-slate-300 leading-relaxed">
                {aiOverbreakPrediction.advanceLevelRootCauseSummary}
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={handleApplyAiOverbreakDiagnosisToAllZones}
                  className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold cursor-pointer"
                >
                  Apply AI Root-Cause Diagnosis to All Zones
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('ai_predictor')}
                  className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-600/40 rounded text-[10px] font-semibold cursor-pointer"
                >
                  Advance Forecast →
                </button>
              </div>
            </div>

            {/* Overall Default Overbreak & Undercut Reason Categories */}
            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded space-y-2">
              <div className="text-[10px] font-bold text-cyan-400">
                PRIMARY OVERBREAK &amp; UNDERCUT CLASSIFICATION
              </div>

              <label className="block space-y-1">
                <span className="text-[10px] text-rose-300 font-semibold">
                  Overall Overbreak Category:
                </span>
                <select
                  value={surveyProfile.overallOverbreakCategory}
                  onChange={(e) =>
                    onUpdateSurveyProfile((prev) => ({
                      ...prev,
                      overallOverbreakCategory: e.target.value as OverbreakReasonCategory,
                    }))
                  }
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-100 text-[11px]"
                >
                  <option value="GEOLOGICAL">
                    GEOLOGICAL (Wedge / Joint Intersection / Shear Zone / Foliation)
                  </option>
                  <option value="MECHANICAL_EXCAVATION">
                    MECHANICAL / EXCAVATION (Profile Deviation / Scaling)
                  </option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-[10px] text-slate-400">Overbreak Engineering Remarks:</span>
                <input
                  type="text"
                  value={surveyProfile.overallOverbreakReason}
                  onChange={(e) =>
                    onUpdateSurveyProfile((prev) => ({
                      ...prev,
                      overallOverbreakReason: e.target.value,
                    }))
                  }
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-100 text-[11px]"
                />
              </label>

              <label className="block space-y-1 pt-1 border-t border-slate-800">
                <span className="text-[10px] text-amber-300 font-semibold">
                  Overall Undercut Category:
                </span>
                <select
                  value={surveyProfile.overallUndercutCategory}
                  onChange={(e) =>
                    onUpdateSurveyProfile((prev) => ({
                      ...prev,
                      overallUndercutCategory: e.target.value as OverbreakReasonCategory,
                    }))
                  }
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-100 text-[11px]"
                >
                  <option value="MECHANICAL_EXCAVATION">
                    MECHANICAL / EXCAVATION (Tight Toe / Under-Excavation / Scaling)
                  </option>
                  <option value="GEOLOGICAL">
                    GEOLOGICAL (Massive Competent Quartzite / Hard Dyke Ledge)
                  </option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-[10px] text-slate-400">Undercut Engineering Remarks:</span>
                <input
                  type="text"
                  value={surveyProfile.overallUndercutReason}
                  onChange={(e) =>
                    onUpdateSurveyProfile((prev) => ({
                      ...prev,
                      overallUndercutReason: e.target.value,
                    }))
                  }
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-100 text-[11px]"
                />
              </label>
            </div>

            {/* Per-Zone Reason Recording */}
            {[...analysis.overbreakRegions, ...analysis.undercutRegions].map((zone) => {
              const isOB = zone.type === 'OVERBREAK';
              return (
                <div
                  key={zone.id}
                  className={`p-2.5 rounded border space-y-1.5 ${
                    isOB
                      ? 'bg-rose-950/20 border-rose-500/40'
                      : 'bg-amber-950/20 border-amber-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-bold ${isOB ? 'text-rose-300' : 'text-amber-300'}`}>
                      {zone.id}: {zone.locationLabel}
                    </span>
                    <span className="text-[10px] text-slate-300">
                      {zone.areaSqMeters.toFixed(2)} m² (Max {zone.maxRadialMeters.toFixed(2)}m)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="space-y-0.5">
                      <span className="text-[9px] text-slate-400">Reason Category</span>
                      <select
                        value={zone.reasonCategory}
                        onChange={(e) => {
                          const cat = e.target.value as OverbreakReasonCategory;
                          onUpdateSurveyProfile((prev) => ({
                            ...prev,
                            zoneReasonOverrides: {
                              ...prev.zoneReasonOverrides,
                              [zone.id]: {
                                zoneId: zone.id,
                                category: cat,
                                reasonDetail: zone.reasonDetail,
                                linkedJointSets: zone.linkedJointSets,
                              },
                            },
                          }));
                        }}
                        className="w-full px-1.5 py-1 bg-slate-950 border border-slate-700 rounded text-[10px] text-slate-100"
                      >
                        <option value="GEOLOGICAL">GEOLOGICAL</option>
                        <option value="MECHANICAL_EXCAVATION">MECHANICAL / EXCAV.</option>
                      </select>
                    </label>

                    <label className="space-y-0.5">
                      <span className="text-[9px] text-slate-400">Linked Joint Sets</span>
                      <input
                        type="text"
                        value={zone.linkedJointSets}
                        placeholder="e.g. J1 + J2"
                        onChange={(e) => {
                          const setsVal = e.target.value;
                          onUpdateSurveyProfile((prev) => ({
                            ...prev,
                            zoneReasonOverrides: {
                              ...prev.zoneReasonOverrides,
                              [zone.id]: {
                                zoneId: zone.id,
                                category: zone.reasonCategory,
                                reasonDetail: zone.reasonDetail,
                                linkedJointSets: setsVal,
                              },
                            },
                          }));
                        }}
                        className="w-full px-1.5 py-1 bg-slate-950 border border-slate-700 rounded text-[10px] text-slate-100"
                      />
                    </label>
                  </div>

                  <label className="block space-y-0.5">
                    <span className="text-[9px] text-slate-400">Specific Cause / Remarks</span>
                    <input
                      type="text"
                      value={zone.reasonDetail}
                      onChange={(e) => {
                        const detailVal = e.target.value;
                        onUpdateSurveyProfile((prev) => ({
                          ...prev,
                          zoneReasonOverrides: {
                            ...prev.zoneReasonOverrides,
                            [zone.id]: {
                              zoneId: zone.id,
                              category: zone.reasonCategory,
                              reasonDetail: detailVal,
                              linkedJointSets: zone.linkedJointSets,
                            },
                          },
                        }));
                      }}
                      className="w-full px-1.5 py-1 bg-slate-950 border border-slate-700 rounded text-[10px] text-slate-100"
                    />
                  </label>
                </div>
              );
            })}
          </div>
        )}

        {subTab === 'ai_predictor' && (
          <div className="space-y-3">
            {/* 1. Advance-Level Root Cause Breakdown: Geological vs. Mechanical Overbreak */}
            <div className="p-2.5 bg-slate-900 border border-emerald-500/50 rounded space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  ADVANCE-LEVEL AI OVERBREAK ROOT-CAUSE DIAGNOSIS
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 text-[9px] font-bold">
                  {aiOverbreakPrediction.overallDominantCategory === 'GEOLOGICAL'
                    ? 'GEOLOGICAL DOMINANT'
                    : 'MECHANICAL / EXCAVATION'}
                </span>
              </div>

              {/* Progress Split Bar: Geological vs Mechanical */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-semibold">
                  <span className="text-rose-300">
                    Geological (Wedge/Joint/Shear): {aiOverbreakPrediction.geologicalSharePct}%
                  </span>
                  <span className="text-amber-300">
                    Mechanical (Profile/Excavation): {aiOverbreakPrediction.mechanicalSharePct}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                  <div
                    style={{ width: `${aiOverbreakPrediction.geologicalSharePct}%` }}
                    className="bg-rose-500 h-full"
                  />
                  <div
                    style={{ width: `${aiOverbreakPrediction.mechanicalSharePct}%` }}
                    className="bg-amber-500 h-full"
                  />
                </div>
              </div>

              <p className="text-[10px] text-slate-200 leading-relaxed bg-slate-950 p-2 rounded border border-slate-800">
                {aiOverbreakPrediction.advanceLevelRootCauseSummary}
              </p>

              <button
                type="button"
                onClick={handleApplyAiOverbreakDiagnosisToAllZones}
                className="w-full py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold cursor-pointer shadow"
              >
                Apply AI Diagnosis &amp; Joint Links to All Overbreak Zones
              </button>
            </div>

            {/* 2. Next-Pull Advance Overbreak Forecast (Editable by User) */}
            <div className="p-2.5 bg-slate-900 border border-cyan-500/50 rounded space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                <span className="text-[10px] font-bold text-cyan-300">
                  NEXT PULL ADVANCE FORECAST (+{(settings.roundLength || 3.5).toFixed(1)}m ROUND)
                </span>
                <span className="text-[10px] font-bold text-amber-300">
                  Pred OB: {aiOverbreakPrediction.nextPullPredictedOverbreakPct}%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-400">Predicted Next-Pull Area</div>
                  <div className="text-sm font-bold text-rose-300">
                    {aiOverbreakPrediction.nextPullPredictedOverbreakAreaSqM.toFixed(2)} m² (
                    {aiOverbreakPrediction.nextPullPredictedOverbreakPct}%)
                  </div>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-400">Predicted Max Radial Depth</div>
                  <div className="text-sm font-bold text-amber-300">
                    {aiOverbreakPrediction.nextPullPredictedMaxRadialM.toFixed(2)} m
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-300 bg-slate-950 p-2 rounded border border-slate-800">
                <strong className="text-cyan-300 block mb-0.5">Critical Sectors Ahead:</strong>
                {customNextPullPredictionNote || aiOverbreakPrediction.nextPullCriticalSectors}
              </div>

              <label className="block space-y-0.5">
                <span className="text-[9px] text-slate-400">
                  Recommended Excavation &amp; Pre-Support Mitigation (User Editable):
                </span>
                <textarea
                  rows={2}
                  value={
                    customMitigationNote || aiOverbreakPrediction.recommendedSupportMitigation
                  }
                  onChange={(e) => {
                    setCustomMitigationNote(e.target.value);
                    onUpdateSurveyProfile((prev) => ({
                      ...prev,
                      overallOverbreakReason: e.target.value,
                    }));
                  }}
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-[10px] text-slate-100"
                />
              </label>
            </div>

            {/* 3. Per-Zone AI Geological vs Mechanical Breakdown */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-slate-300">
                ZONE-BY-ZONE AI DIAGNOSTIC &amp; SPOT BOLTING REQUIREMENT
              </div>
              {aiOverbreakPrediction.zonePredictions.map((zp) => (
                <div
                  key={zp.zoneId}
                  className="p-2.5 bg-slate-900 border border-slate-800 rounded space-y-1.5 text-[10px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-300">
                      {zp.zoneId} · {zp.locationLabel}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        zp.predictedCategory === 'GEOLOGICAL'
                          ? 'bg-rose-950 text-rose-300 border border-rose-700/60'
                          : 'bg-amber-950 text-amber-300 border border-amber-700/60'
                      }`}
                    >
                      {zp.predictedCategory} ({zp.confidencePct}% Conf)
                    </span>
                  </div>
                  <div className="text-cyan-300 font-semibold">{zp.primaryMechanism}</div>
                  <p className="text-slate-300 leading-relaxed">{zp.detailedExplanation}</p>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[9px] text-slate-400">
                    <span>Controlling Sets: {zp.controllingJointSets}</span>
                    <span className="text-emerald-300 font-bold">
                      Spot Bolts Needed: {zp.recommendedSpotBolts} nos
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. PREVIOUS-TO-CURRENT ROUND TREND COMPARATOR */}
        {subTab === 'round_trends' && (
          <div className="space-y-3">
            {/* Round Delta Header Banner */}
            <div className="p-3 bg-slate-900 border border-slate-800 rounded space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                <span className="font-bold text-cyan-300 text-xs flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Multi-Round Trend Comparison ({multiRoundReport.chainageInterval})
                </span>
                <span className="text-[10px] text-slate-400">
                  Historical Baseline: <strong>{savedProjects.length} saved round(s)</strong>
                </span>
              </div>

              {multiRoundReport.deltas.deteriorationRateWarning ? (
                <div className="p-2 rounded bg-rose-950/50 border border-rose-600 text-rose-200 text-[10px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-rose-100 block">RAPID ROCK MASS DEGRADATION WARNING:</strong>
                    {multiRoundReport.deltas.deteriorationDescription}
                  </div>
                </div>
              ) : (
                <div className="p-2 rounded bg-emerald-950/30 border border-emerald-600/50 text-emerald-200 text-[10px] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Ground conditions and overbreak rates are stable or improving relative to the preceding excavation round.</span>
                </div>
              )}
            </div>

            {/* 6 Key Geotechnical & Overbreak Delta KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {/* Q-Index Delta */}
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400">Barton Q-Index (ΔQ)</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">
                    {qIndexParams ? ((qIndexParams.rqd / (qIndexParams.jn || 9)) * ((qIndexParams.jr || 1.5) / (qIndexParams.ja || 1.0)) * ((qIndexParams.jw || 1.0) / (qIndexParams.srf || 1.0))).toFixed(2) : '10.00'}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      (multiRoundReport.deltas.deltaQ ?? 0) >= 0
                        ? 'bg-emerald-950 text-emerald-300'
                        : 'bg-rose-950 text-rose-300'
                    }`}
                  >
                    {(multiRoundReport.deltas.deltaQ ?? 0) >= 0 ? '+' : ''}
                    {multiRoundReport.deltas.deltaQ !== null ? multiRoundReport.deltas.deltaQ : '0.00'}
                  </span>
                </div>
              </div>

              {/* RMR Delta */}
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400">Bieniawski RMR89 (ΔRMR)</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-emerald-300">
                    {rmrParams
                      ? (rmrParams.intactStrengthRating || 7) +
                        (rmrParams.rqdRating || 13) +
                        (rmrParams.spacingRating || 10) +
                        (rmrParams.conditionRating || 20) +
                        (rmrParams.groundwaterRating || 15)
                      : 65}{' '}
                    pts
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      (multiRoundReport.deltas.deltaRMR ?? 0) >= 0
                        ? 'bg-emerald-950 text-emerald-300'
                        : 'bg-rose-950 text-rose-300'
                    }`}
                  >
                    {(multiRoundReport.deltas.deltaRMR ?? 0) >= 0 ? '+' : ''}
                    {multiRoundReport.deltas.deltaRMR !== null ? multiRoundReport.deltas.deltaRMR : '0.0'} pts
                  </span>
                </div>
              </div>

              {/* RQD Delta */}
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400">RQD &amp; Spacing (ΔRQD)</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-cyan-300">
                    {qIndexParams?.rqd ?? 80}%
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      (multiRoundReport.deltas.deltaRQD ?? 0) >= 0
                        ? 'bg-emerald-950 text-emerald-300'
                        : 'bg-rose-950 text-rose-300'
                    }`}
                  >
                    {(multiRoundReport.deltas.deltaRQD ?? 0) >= 0 ? '+' : ''}
                    {multiRoundReport.deltas.deltaRQD !== null ? multiRoundReport.deltas.deltaRQD : '0.0'}%
                  </span>
                </div>
              </div>

              {/* Overbreak Rate Delta */}
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400">Linear Overbreak Rate</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-amber-300">
                    {(
                      (analysis.overbreakVolumeCubicMeters ??
                        analysis.overbreakAreaSqMeters * (settings.roundLength || 3.5)) /
                      Math.max(1, settings.roundLength || 3.5)
                    ).toFixed(2)}{' '}
                    m³/m
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      multiRoundReport.deltas.deltaOverbreakM3PerM <= 0
                        ? 'bg-emerald-950 text-emerald-300'
                        : 'bg-rose-950 text-rose-300'
                    }`}
                  >
                    {multiRoundReport.deltas.deltaOverbreakM3PerM > 0 ? '+' : ''}
                    {multiRoundReport.deltas.deltaOverbreakM3PerM} m³/m
                  </span>
                </div>
              </div>

              {/* Max Radial Overbreak */}
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400">Max Radial Overbreak</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-rose-400">
                    +{(analysis.maxRadialOverbreakMeters * 100).toFixed(1)} cm
                  </span>
                  <span className="text-[9px] text-slate-400">
                    Crown (11:00)
                  </span>
                </div>
              </div>

              {/* Critical Wedge Fallout Weight */}
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-[10px] text-slate-400">Critical Wedge Fallout</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">
                    {multiRoundReport.lookAheadPredictions.at3mMeters.crownWedgeWeightTonnes} t
                  </span>
                  <span className="text-[9px] text-emerald-300 font-bold">
                    Water: 0 L/min
                  </span>
                </div>
              </div>
            </div>

            {/* Automated Overbreak Root-Cause Diagnosis (Contractual Proof) */}
            <div className="p-3 bg-gradient-to-br from-slate-900 to-[#0B1220] border border-cyan-800/60 rounded space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="font-bold text-cyan-300 text-xs flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5" />
                  Automated Overbreak Root-Cause Diagnosis (Contractual Proof)
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-200 font-bold text-[9px]">
                  {multiRoundReport.overbreakDiagnosis.dominantType.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[10px] space-y-1.5 leading-relaxed">
                <div>
                  <strong className="text-slate-300">Geotechnical Analysis: </strong>
                  <span className="text-slate-200">{multiRoundReport.overbreakDiagnosis.explanation}</span>
                </div>
                {multiRoundReport.overbreakDiagnosis.geologicalWedgeSector && (
                  <div className="text-amber-300 font-bold">
                    Recurring Keyblock Sector: {multiRoundReport.overbreakDiagnosis.geologicalWedgeSector}
                  </div>
                )}
                <div className="pt-1 border-t border-slate-800 text-slate-400">
                  <strong className="text-slate-300">Engineering Directive: </strong>
                  {multiRoundReport.engineeringMemo}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. FUTURE ROUND LOOK-AHEAD PREDICTOR (+3m, +6m, +9m) */}
        {subTab === 'look_ahead' && (
          <div className="space-y-3">
            {/* Distance Selector Pills */}
            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-cyan-300 text-xs flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" />
                3D Forward Look-Ahead Predictor
              </span>
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { dist: 3, label: '+3.0m [Next Round]' },
                    { dist: 6, label: '+6.0m [2 Rounds Ahead]' },
                    { dist: 9, label: '+9.0m [3 Rounds Ahead]' },
                  ] as const
                ).map((d) => (
                  <button
                    key={d.dist}
                    type="button"
                    onClick={() => setLookAheadDist(d.dist)}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      lookAheadDist === d.dist
                        ? 'bg-amber-600 text-white shadow'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Predicted Face & Crown Cross-Section Diagram */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1 text-[11px] font-bold text-cyan-300">
                <span>Predicted Cross-Section at Z = +{lookAheadDist}.0m Ahead of Face</span>
                <span className="text-[10px] text-amber-300">
                  Anticipated Crown Fallout: {lookAheadDist === 3 ? multiRoundReport.lookAheadPredictions.at3mMeters.crownWedgeWeightTonnes : lookAheadDist === 6 ? multiRoundReport.lookAheadPredictions.at6mMeters.crownWedgeWeightTonnes : 18.5} t
                </span>
              </div>

              <div className="bg-[#070B12] border border-slate-800 rounded p-2 flex flex-col items-center justify-center">
                <svg viewBox="0 0 320 200" className="w-full max-w-[280px] h-auto">
                  <rect x="0" y="0" width="320" height="200" fill="#0A0E17" />
                  {/* Excavation Profile at +Zm */}
                  <path
                    d="M 60 180 L 60 100 C 60 45, 100 15, 160 15 C 220 15, 260 45, 260 100 L 260 180 Z"
                    fill="#0F172A"
                    stroke="#38BDF8"
                    strokeWidth="2"
                    strokeDasharray={lookAheadDist > 3 ? '4,3' : 'none'}
                  />

                  {/* Crown Zone Arch Reference (10:00 - 02:00) */}
                  <path
                    d="M 85 60 C 105 25, 130 18, 160 18 C 190 18, 215 25, 235 60"
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="3"
                    opacity="0.6"
                  />

                  {/* Projected Joints at +Zm */}
                  {jointLookAheads.map((jla, idx) => {
                    const faceMatch = jla.lookAheadFaces.find((f) => f.distanceM === lookAheadDist);
                    const yElev = faceMatch ? 180 - faceMatch.centerlineElevationM * 18 : 100;
                    const strokeCol = faceMatch?.intersectsCrown ? '#EF4444' : '#38BDF8';
                    return (
                      <g key={jla.jointId || idx}>
                        <line
                          x1="70"
                          y1={Math.max(20, Math.min(175, yElev - 15))}
                          x2="250"
                          y2={Math.max(20, Math.min(175, yElev + 15))}
                          stroke={strokeCol}
                          strokeWidth="2.5"
                          strokeDasharray={faceMatch?.intersectsCrown ? '4,2' : 'none'}
                        />
                        <text
                          x="255"
                          y={Math.max(25, Math.min(175, yElev + 15))}
                          fontSize="8"
                          fontWeight="700"
                          fill={strokeCol}
                        >
                          {jla.set}
                        </text>
                      </g>
                    );
                  })}

                  <text x="160" y="12" textAnchor="middle" fontSize="8" fontWeight="700" fill="#F59E0B">
                    CROWN ARCH (10:00 - 02:00)
                  </text>
                  <text x="160" y="195" textAnchor="middle" fontSize="8" fill="#64748B">
                    Chainage: {settings.faceChainage || 'CH 00+000'} + {lookAheadDist}m
                  </text>
                </svg>
              </div>

              <div className="text-[10px] text-center text-slate-400">
                Red dashed lines = Joints migrating upward into the Crown Arch · Yellow arc = Crown Canopy Zone
              </div>
            </div>

            {/* Upward Migration Alerts */}
            {jointLookAheads.some((j) => j.migratingUpwardIntoCrown) && (
              <div className="p-2.5 rounded bg-rose-950/50 border border-rose-600 text-rose-100 text-[10px] space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  FORWARD JOINT DAYLIGHTING DETECTED!
                </div>
                {jointLookAheads
                  .filter((j) => j.migratingUpwardIntoCrown)
                  .map((j) => (
                    <div key={j.jointId} className="leading-snug">
                      • {j.warningMessage || `Joint ${j.set} will daylight into CROWN ARCH at ~Z=+${j.crownDaylightDistanceM}m!`}
                    </div>
                  ))}
              </div>
            )}

            {/* FOREPOLING / SPILING CANOPY PRESCRIPTION CARD */}
            <div className={`p-3 rounded-lg border space-y-2.5 ${
              multiRoundReport.forepolingCanopy.recommended
                ? 'bg-amber-950/40 border-amber-500/80'
                : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="font-bold text-xs flex items-center gap-1.5 text-amber-300">
                  <Shield className="w-3.5 h-3.5" />
                  Forepoling / Spiling Canopy Prescription
                </span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                  multiRoundReport.forepolingCanopy.recommended
                    ? 'bg-amber-600 text-white'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                }`}>
                  {multiRoundReport.forepolingCanopy.recommended ? 'CANOPY MANDATORY' : 'NOT REQUIRED'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Forepole Pipe Count:</span>
                  <strong className="text-white text-xs">{multiRoundReport.forepolingCanopy.pipeCount} Nos</strong>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Pipe Spec &amp; Length:</span>
                  <strong className="text-cyan-300 text-xs">
                    Ø{multiRoundReport.forepolingCanopy.pipeDiameterMm}mm × {multiRoundReport.forepolingCanopy.pipeLengthM}m
                  </strong>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Look-Out Angle:</span>
                  <strong className="text-amber-300 text-xs">{multiRoundReport.forepolingCanopy.lookOutAngleDeg}°</strong>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Installation Sector:</span>
                  <strong className="text-white">{multiRoundReport.forepolingCanopy.clockSector}</strong>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Overlap Between Pulls:</span>
                  <strong className="text-white">{multiRoundReport.forepolingCanopy.overlapLengthM} m</strong>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Max Recommended Pull:</span>
                  <strong className="text-emerald-300 font-bold">
                    {multiRoundReport.forepolingCanopy.recommended ? '1.50m - 2.00m' : '3.00m - 3.50m'}
                  </strong>
                </div>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-300 leading-relaxed">
                <strong>Justification: </strong>
                {multiRoundReport.forepolingCanopy.triggerReason}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export const OverbreakAnalysisPanel = React.memo(OverbreakAnalysisPanelComponent);

// ============================================================================
// SYSTEMATIC DATA STORAGE, IMPORT & EXPORT MANAGER
// ============================================================================

export type DataStorageTabId =
  | 'field_data'
  | 'projects'
  | 'import_export'
  | 'sheet_settings'
  | 'volumes'
  | 'geometries';

type StorageDomainFilter = 'ALL' | 'UNDERGROUND' | 'SURFACE';

function parseProjectDomainMeta(rawProjectName: string): {
  cleanName: string;
  domainKey: 'TUNNEL' | 'BENCH' | 'TRENCH' | 'SLOPE' | 'ROCK_SURFACE';
  category: 'UNDERGROUND' | 'SURFACE';
  badgeLabel: string;
} {
  const trimmed = (rawProjectName || '').trim();
  const match = trimmed.match(/^\[(TUNNEL|BENCH|TRENCH|SLOPE|ROCK_SURFACE)\]\s*(.*)$/i);
  if (match) {
    const dom = match[1].toUpperCase() as
      | 'TUNNEL'
      | 'BENCH'
      | 'TRENCH'
      | 'SLOPE'
      | 'ROCK_SURFACE';
    const cleanName = match[2].trim() || 'Mapping Project';
    if (dom === 'TUNNEL') {
      return {
        cleanName,
        domainKey: 'TUNNEL',
        category: 'UNDERGROUND',
        badgeLabel: 'Underground Face Mapping',
      };
    }
    const subLabels: Record<string, string> = {
      BENCH: 'Surface · Bench',
      TRENCH: 'Surface · Trench',
      SLOPE: 'Surface · Slope',
      ROCK_SURFACE: 'Surface · Rock Surface',
    };
    return {
      cleanName,
      domainKey: dom,
      category: 'SURFACE',
      badgeLabel: subLabels[dom] || 'Surface Mapping',
    };
  }
  return {
    cleanName: trimmed || 'Underground Tunnel Project',
    domainKey: 'TUNNEL',
    category: 'UNDERGROUND',
    badgeLabel: 'Underground Face Mapping',
  };
}

interface ProjectMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: DataStorageTabId;
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  onUpdateSettings: React.Dispatch<React.SetStateAction<TunnelSettings>>;
  savedProjects: SavedProjectRecord[];
  onRefreshSavedProjects?: (nextRecords: SavedProjectRecord[]) => void;
  onRefreshProjectsState?: (nextRecords: SavedProjectRecord[]) => void;
  onSaveCurrentProject: () => void;
  onLoadProjectRecord: (record: SavedProjectRecord) => void;
  onDeleteProjectRecord: (id: string) => void;
  onImportProjectRecordFile: (file: File) => void;
  onExportCurrentProjectFile: () => void;
  savedGeometries: SavedDesignGeometryRecord[];
  onSaveCurrentGeometryToLibrary: (customName: string) => void;
  onLoadDesignGeometry: (geomRecord: SavedDesignGeometryRecord) => void;
  onDeleteDesignGeometry: (id: string) => void;
  onCreateCompanionSectionForVolumeTest: () => void;
  onOpenFieldRoundInWorkspace?: (
    roundId: string,
    projectId?: string,
    locationId?: string,
    domain?: 'TUNNEL' | 'BENCH' | 'TRENCH' | 'SLOPE' | 'ROCK_SURFACE'
  ) => void;
  googleUser?: FirebaseGoogleUser | null;
}

const ProjectMemoryModalContent: React.FC<ProjectMemoryModalProps> = ({
  isOpen,
  onClose,
  savedProjects,
  onRefreshSavedProjects,
  onRefreshProjectsState,
  onOpenFieldRoundInWorkspace,
  googleUser,
}) => {
  const [domainFilter, setDomainFilter] = useState<StorageDomainFilter>('ALL');
  const [fieldStore, setFieldStore] = useState<FieldMappingStoreState>(() =>
    loadCombinedFieldStore()
  );
  const [fieldSearchQuery, setFieldSearchQuery] = useState<string>('');
  const [statusBanner, setStatusBanner] = useState<string>('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [expandedDetailsRoundId, setExpandedDetailsRoundId] = useState<string | null>(null);

  // Inline Edit & Move state for Mapping Files (Rounds)
  const [editingFieldRoundId, setEditingFieldRoundId] = useState<string | null>(null);
  const [fieldEditForm, setFieldEditForm] = useState<{
    projectName: string;
    locationName: string;
    chainageFrom: string;
    chainageTo: string;
    pullLengthMeters: number;
    tunnelDriveDirection: number;
    modeOfExcavation: string;
    geologistName: string;
    dateAndTimeOfExcavation: string;
  }>({
    projectName: '',
    locationName: '',
    chainageFrom: '',
    chainageTo: '',
    pullLengthMeters: 3.0,
    tunnelDriveDirection: 45,
    modeOfExcavation: 'Drill & Blast',
    geologistName: '',
    dateAndTimeOfExcavation: '',
  });

  const [movingFieldRoundId, setMovingFieldRoundId] = useState<string | null>(null);
  const [moveTargetProjectId, setMoveTargetProjectId] = useState<string>('');
  const [moveTargetLocationId, setMoveTargetLocationId] = useState<string>('');
  const [moveNewProjectName, setMoveNewProjectName] = useState<string>('');
  const [moveNewLocationName, setMoveNewLocationName] = useState<string>('');

  const universalPackageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFieldStore(loadCombinedFieldStore());
    }
  }, [isOpen]);

  const totalPhotosCount = useMemo(
    () => countAllPhotosInStore(fieldStore, savedProjects),
    [fieldStore, savedProjects]
  );

  const handleUniversalPackageFileImport = async (file: File) => {
    try {
      const summary = await importEswaUniversalPackageFromFile(file, importMode);
      const refreshedField = loadCombinedFieldStore();
      setFieldStore(refreshedField);
      try {
        const rawProjs = localStorage.getItem('akash_tunnel_saved_projects_v20_fresh');
        if (rawProjs) {
          const parsedProjs = JSON.parse(rawProjs);
          onRefreshSavedProjects?.(parsedProjs);
          onRefreshProjectsState?.(parsedProjs);
        }
      } catch {
        // Ignore
      }
      setStatusBanner(summary.message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to import package file.';
      setStatusBanner(`Import error: ${msg}`);
    }
  };

  const handleExportSystematicCSV = () => {
    const header = [
      'Domain',
      'Project Name',
      'Location',
      'Chainage From (m)',
      'Chainage To (m)',
      'Pull (m)',
      'Direction (deg)',
      'Excavation Mode',
      'Date & Time',
      'Geologist',
      'Q-Value',
      'RMR',
      'GSI',
      'Support Class',
      'Joint Traces',
      'Photos Count',
    ];
    const rows: string[][] = [header];

    fieldStore.projects.forEach((proj) => {
      const meta = parseProjectDomainMeta(proj.projectName);
      const projRounds = fieldStore.rounds.filter((r) => r.projectId === proj.id);
      projRounds.forEach((rd) => {
        const loc = proj.locations.find((l) => l.id === rd.locationId);
        const qVal =
          rd.qSystem && rd.qSystem.jn > 0 && rd.qSystem.ja > 0 && rd.qSystem.srf > 0
            ? (
                (rd.qSystem.rqd / rd.qSystem.jn) *
                (rd.qSystem.jr / rd.qSystem.ja) *
                (rd.qSystem.jw / rd.qSystem.srf)
              ).toFixed(2)
            : '-';
        const rmrVal = rd.rmrSystem
          ? String(
              (rd.rmrSystem.ucsRating || 0) +
                (rd.rmrSystem.rqdRating || 0) +
                (rd.rmrSystem.spacingRating || 0) +
                (rd.rmrSystem.conditionRating || 0) +
                (rd.rmrSystem.waterRating || 0) +
                (rd.rmrSystem.orientationAdj || 0)
            )
          : '-';
        const photoCount = rd.collectedPhotos?.length || 0;
        rows.push([
          meta.badgeLabel,
          meta.cleanName,
          loc?.name || 'Main Location',
          String(rd.chainageFrom || ''),
          String(rd.chainageTo || ''),
          String(rd.pullLengthMeters || ''),
          String(rd.tunnelDriveDirection || ''),
          String(rd.modeOfExcavation || ''),
          String(rd.dateAndTimeOfExcavation || ''),
          String(rd.geologistName || rd.contractorGeologistName || ''),
          qVal,
          rmrVal,
          String(rd.gsiValue ?? '-'),
          String(rd.supportSystem?.supportClass || 'Class III'),
          String(rd.jointTraces?.length || 0),
          String(photoCount),
        ]);
      });
    });

    const csvText = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ESWA_Mapping_Files_Summary_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const startEditFieldRound = (round: FieldExcavationRound) => {
    const proj = fieldStore.projects.find((p) => p.id === round.projectId);
    const loc = proj?.locations.find((l) => l.id === round.locationId);
    setEditingFieldRoundId(round.id);
    setMovingFieldRoundId(null);
    setFieldEditForm({
      projectName: proj?.projectName || 'Underground Tunnel Project',
      locationName: loc?.name || 'Main Tunnel Heading',
      chainageFrom: round.chainageFrom,
      chainageTo: round.chainageTo,
      pullLengthMeters: round.pullLengthMeters,
      tunnelDriveDirection: round.tunnelDriveDirection,
      modeOfExcavation: round.modeOfExcavation || 'Drill & Blast',
      geologistName: round.geologistName || round.contractorGeologistName || '',
      dateAndTimeOfExcavation: round.dateAndTimeOfExcavation || '',
    });
  };

  const saveEditFieldRound = (roundId: string) => {
    editFieldExcavationRoundMetadata(roundId, fieldEditForm);
    setFieldStore(loadCombinedFieldStore());
    setEditingFieldRoundId(null);
    setStatusBanner(
      `Updated mapping file CH ${fieldEditForm.chainageFrom}m → ${fieldEditForm.chainageTo}m.`
    );
  };

  const startMoveFieldRound = (round: FieldExcavationRound) => {
    setMovingFieldRoundId(round.id);
    setEditingFieldRoundId(null);
    setMoveTargetProjectId(round.projectId);
    setMoveTargetLocationId(round.locationId);
    setMoveNewProjectName('');
    setMoveNewLocationName('');
  };

  const confirmMoveFieldRound = (roundId: string) => {
    moveFieldExcavationRound(
      roundId,
      moveTargetProjectId,
      moveTargetLocationId,
      moveNewProjectName,
      moveNewLocationName
    );
    setFieldStore(loadCombinedFieldStore());
    setMovingFieldRoundId(null);
    setStatusBanner('Moved mapping file to selected Project & Location.');
  };

  const handleDeleteFieldRound = (roundId: string) => {
    deleteFieldExcavationRound(roundId);
    setFieldStore(loadCombinedFieldStore());
    setStatusBanner('Deleted mapping file from storage.');
  };

  const visibleProjects = useMemo(() => {
    return fieldStore.projects.filter((proj) => {
      const meta = parseProjectDomainMeta(proj.projectName);
      if (domainFilter === 'UNDERGROUND' && meta.category !== 'UNDERGROUND') return false;
      if (domainFilter === 'SURFACE' && meta.category !== 'SURFACE') return false;
      return true;
    });
  }, [fieldStore.projects, domainFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 backdrop-blur-sm p-2 sm:p-4">
      <div className="w-full max-w-5xl max-h-[92vh] bg-[#FFFBF8] border-2 border-orange-300 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs font-mono text-stone-900">
        {/* Top Systematic Header + Direct Import / Export Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 bg-[#FFF4E8] border-b border-orange-200">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-orange-600 shrink-0" />
            <div>
              <div className="font-display font-black text-sm sm:text-base tracking-wide text-stone-900">
                DATA STORAGE, IMPORT &amp; EXPORT
              </div>
              <div className="text-[11px] text-stone-600">
                Systematic Project &amp; Mapping File Manager · Quick File Access, Details &amp; Backup
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Import Mode Selector + Import Button */}
            <div className="flex items-center bg-white border border-emerald-300 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setImportMode('merge')}
                className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer ${
                  importMode === 'merge'
                    ? 'bg-emerald-600 text-white'
                    : 'text-stone-600 hover:bg-emerald-50'
                }`}
                title="Merge imported files with existing workspace data"
              >
                Merge
              </button>
              <button
                type="button"
                onClick={() => setImportMode('replace')}
                className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer ${
                  importMode === 'replace'
                    ? 'bg-amber-600 text-white'
                    : 'text-stone-600 hover:bg-amber-50'
                }`}
                title="Replace existing workspace data with imported file"
              >
                Replace
              </button>
            </div>

            <input
              ref={universalPackageInputRef}
              type="file"
              accept=".json,.eswa.json,.akash.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUniversalPackageFileImport(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => universalPackageInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-xs cursor-pointer"
              title="Import .eswa.json file from PC or Mobile"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import File</span>
            </button>

            <button
              type="button"
              onClick={() => exportCompleteEswaAppPackageToFile(googleUser)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-[11px] shadow-xs cursor-pointer"
              title="Export all Projects, Mapping Files & Photos into a single .eswa.json file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export All (.eswa.json)</span>
            </button>

            <button
              type="button"
              onClick={handleExportSystematicCSV}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-orange-50 text-stone-800 border border-orange-300 font-bold text-[11px] cursor-pointer"
              title="Export systematic CSV summary table of all mapping files"
            >
              <Download className="w-3.5 h-3.5 text-orange-600" />
              <span>CSV Summary</span>
            </button>

            <ThemeToggleButton compact />
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-orange-100 cursor-pointer"
              title="Close Data Storage"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Notification Banner */}
        {statusBanner && (
          <div className="px-5 py-2 bg-emerald-50 border-b border-emerald-300 text-emerald-900 flex items-center justify-between gap-2 text-[11px] font-bold">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {statusBanner}
            </span>
            <button
              type="button"
              onClick={() => setStatusBanner('')}
              className="text-emerald-700 hover:text-emerald-950 text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Systematic Filter & Quick Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 sm:px-5 py-2.5 bg-[#FFF8F1] border-b border-orange-200 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'ALL', label: `All Files (${fieldStore.rounds.length})` },
                { id: 'UNDERGROUND', label: 'Underground Face Mapping' },
                { id: 'SURFACE', label: 'Surface Mapping' },
              ] as { id: StorageDomainFilter; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setDomainFilter(item.id)}
                className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                  domainFilter === item.id
                    ? 'bg-orange-600 text-white shadow-2xs'
                    : 'bg-white text-stone-700 border border-orange-200 hover:bg-orange-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 flex-1 sm:flex-initial justify-end min-w-[240px]">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search Project, Location, Chainage, Geologist..."
                value={fieldSearchQuery}
                onChange={(e) => setFieldSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-orange-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:border-orange-500"
              />
            </div>
            <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-100/80 text-orange-900 border border-orange-200 text-[11px] font-bold whitespace-nowrap">
              <Camera className="w-3.5 h-3.5 text-orange-600" />
              {totalPhotosCount} Photos
            </span>
          </div>
        </div>

        {/* Systematic Project -> Location -> Mapping File List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {visibleProjects.length === 0 ? (
            <div className="p-8 bg-white border border-orange-200 rounded-xl text-center text-stone-600 space-y-2">
              <div className="font-bold text-stone-800 text-sm">No Mapping Files Found</div>
              <div className="text-xs text-stone-500">
                Create a project in Underground Face Mapping or Surface Mapping, or click{' '}
                <strong>Import File</strong> above to restore a saved <code>.eswa.json</code> backup.
              </div>
            </div>
          ) : (
            visibleProjects.map((proj) => {
              const domainMeta = parseProjectDomainMeta(proj.projectName);
              const projRounds = fieldStore.rounds
                .filter((r) => r.projectId === proj.id)
                .filter((r) => {
                  if (!fieldSearchQuery.trim()) return true;
                  const q = fieldSearchQuery.trim().toLowerCase();
                  const locName =
                    proj.locations.find((l) => l.id === r.locationId)?.name || '';
                  return (
                    domainMeta.cleanName.toLowerCase().includes(q) ||
                    domainMeta.badgeLabel.toLowerCase().includes(q) ||
                    locName.toLowerCase().includes(q) ||
                    String(r.chainageFrom).toLowerCase().includes(q) ||
                    String(r.chainageTo).toLowerCase().includes(q) ||
                    String(r.geologistName || '').toLowerCase().includes(q)
                  );
                });

              if (projRounds.length === 0 && fieldSearchQuery.trim()) return null;

              return (
                <div
                  key={proj.id}
                  className="p-4 bg-white border border-orange-200 rounded-xl space-y-3 shadow-2xs"
                >
                  {/* Project Header Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-orange-200 pb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                          domainMeta.category === 'SURFACE'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-orange-100 text-orange-900 border-orange-300'
                        }`}
                      >
                        {domainMeta.badgeLabel}
                      </span>
                      <span className="font-display font-bold text-stone-900 text-xs sm:text-sm">
                        {domainMeta.cleanName}
                      </span>
                      {(proj.clientName || proj.contractorName) && (
                        <span className="text-[11px] text-stone-500">
                          ({[proj.clientName, proj.contractorName].filter(Boolean).join(' · ')})
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-orange-700">
                      {projRounds.length} File(s) · {proj.locations.length} Location(s)
                    </span>
                  </div>

                  {/* Files List inside Project */}
                  {projRounds.length === 0 ? (
                    <div className="p-3 text-center text-stone-500 text-xs">
                      No mapping files saved under this project yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {projRounds.map((rd) => {
                        const loc = proj.locations.find((l) => l.id === rd.locationId);
                        const photoCount = rd.collectedPhotos?.length || 0;
                        const isEditing = editingFieldRoundId === rd.id;
                        const isMoving = movingFieldRoundId === rd.id;
                        const isDetailsOpen = expandedDetailsRoundId === rd.id;

                        const qVal =
                          rd.qSystem &&
                          rd.qSystem.jn > 0 &&
                          rd.qSystem.ja > 0 &&
                          rd.qSystem.srf > 0
                            ? (
                                (rd.qSystem.rqd / rd.qSystem.jn) *
                                (rd.qSystem.jr / rd.qSystem.ja) *
                                (rd.qSystem.jw / rd.qSystem.srf)
                              ).toFixed(2)
                            : '—';

                        const rmrVal = rd.rmrSystem
                          ? (rd.rmrSystem.ucsRating || 0) +
                            (rd.rmrSystem.rqdRating || 0) +
                            (rd.rmrSystem.spacingRating || 0) +
                            (rd.rmrSystem.conditionRating || 0) +
                            (rd.rmrSystem.waterRating || 0) +
                            (rd.rmrSystem.orientationAdj || 0)
                          : '—';

                        const enabledSets = Object.values(rd.discontinuitySets || {}).filter(
                          (s) => s.enabled
                        );

                        return (
                          <div
                            key={rd.id}
                            className="p-3 bg-[#FFFDF9] border border-orange-200 rounded-xl space-y-2.5 transition-all"
                          >
                            {/* File Main Summary Row */}
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded font-bold text-xs">
                                    CH {rd.chainageFrom}m → {rd.chainageTo}m
                                  </span>
                                  <span className="px-2 py-0.5 bg-orange-50 text-stone-800 border border-orange-200 rounded text-[11px] font-semibold">
                                    Location: {loc?.name || 'Main Heading'}
                                  </span>
                                  <span className="text-[11px] text-stone-600">
                                    Pull: {rd.pullLengthMeters}m · Dir: N
                                    {String(rd.tunnelDriveDirection).padStart(3, '0')}° ·{' '}
                                    {rd.dateAndTimeOfExcavation}
                                  </span>
                                </div>

                                <div className="text-[11px] text-stone-600 flex flex-wrap items-center gap-3">
                                  <span className="font-semibold text-orange-700">
                                    Photos: {photoCount}
                                  </span>
                                  <span>Joint Traces: {rd.jointTraces?.length || 0}</span>
                                  <span>
                                    Q: <strong>{qVal}</strong> · RMR: <strong>{rmrVal}</strong> ·
                                    GSI: <strong>{rd.gsiValue ?? '—'}</strong>
                                  </span>
                                  <span>
                                    Support:{' '}
                                    <strong>{rd.supportSystem?.supportClass || 'Class III'}</strong>
                                  </span>
                                  {(rd.geologistName || rd.contractorGeologistName) && (
                                    <span>
                                      Geologist:{' '}
                                      <strong>
                                        {rd.geologistName || rd.contractorGeologistName}
                                      </strong>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Clean Action Buttons */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextStore: FieldMappingStoreState = {
                                      ...fieldStore,
                                      activeProjectId: rd.projectId,
                                      activeLocationId: rd.locationId,
                                      activeRoundId: rd.id,
                                    };
                                    saveFieldMappingStore(nextStore, rd.mappingDomain);
                                    saveFieldMappingResumeState(
                                      {
                                        stage: 'field_canvas',
                                        mappingDomain: rd.mappingDomain,
                                        activeProjectId: rd.projectId,
                                        activeLocationId: rd.locationId,
                                        activeRoundId: rd.id,
                                        activePanel: 'face',
                                        is3DMappingMode: false,
                                        chainageLabel: `CH ${rd.chainageFrom}m–${rd.chainageTo}m`,
                                        locationLabel: loc?.name || domainMeta.cleanName,
                                        stageLabel: 'Face Canvas',
                                        updatedAt: new Date().toISOString(),
                                      },
                                      rd.mappingDomain
                                    );
                                    onOpenFieldRoundInWorkspace?.(
                                      rd.id,
                                      rd.projectId,
                                      rd.locationId,
                                      domainMeta.domainKey
                                    );
                                    onClose();
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg text-[11px] cursor-pointer"
                                  title="Open this mapping file directly in the workspace"
                                >
                                  <FolderOpen className="w-3.5 h-3.5" />
                                  <span>Open File</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedDetailsRoundId(isDetailsOpen ? null : rd.id)
                                  }
                                  className={`flex items-center gap-1 px-2.5 py-1.5 border font-bold rounded-lg text-[11px] cursor-pointer ${
                                    isDetailsOpen
                                      ? 'bg-orange-100 text-orange-900 border-orange-400'
                                      : 'bg-white hover:bg-orange-50 text-stone-800 border-orange-300'
                                  }`}
                                  title="View full geological details, joint sets, Q/RMR/GSI & photos"
                                >
                                  <Eye className="w-3.5 h-3.5 text-orange-600" />
                                  <span>{isDetailsOpen ? 'Hide Details' : 'Details'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => exportSingleFieldRoundToFile(rd.id)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold rounded-lg text-[11px] cursor-pointer"
                                  title="Export this single mapping file (.eswa.json) with all its photos"
                                >
                                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Export</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    isEditing
                                      ? setEditingFieldRoundId(null)
                                      : startEditFieldRound(rd)
                                  }
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-orange-50 text-stone-800 border border-orange-300 font-bold rounded-lg text-[11px] cursor-pointer"
                                  title="Edit file metadata"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-orange-600" />
                                  <span>Edit</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    isMoving
                                      ? setMovingFieldRoundId(null)
                                      : startMoveFieldRound(rd)
                                  }
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-orange-50 text-stone-800 border border-orange-300 font-bold rounded-lg text-[11px] cursor-pointer"
                                  title="Move file to another Project or Location"
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Move</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteFieldRound(rd.id)}
                                  className="p-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg cursor-pointer"
                                  title="Delete mapping file"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Systematic Expandable File Details Panel */}
                            {isDetailsOpen && (
                              <div className="p-3.5 bg-white border border-orange-200 rounded-xl space-y-3 text-[11px]">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  {/* Box 1: Excavation & Rock Mass Summary */}
                                  <div className="p-2.5 bg-[#FFF8F1] border border-orange-200 rounded-lg space-y-1">
                                    <div className="font-bold text-orange-900 border-b border-orange-200 pb-1">
                                      1. Excavation &amp; Geology
                                    </div>
                                    <div>
                                      <span className="text-stone-500">Mode / Approach:</span>{' '}
                                      <strong>
                                        {rd.modeOfExcavation || 'Drill & Blast'} ·{' '}
                                        {rd.excavationApproach || 'Full Face'}
                                      </strong>
                                    </div>
                                    <div>
                                      <span className="text-stone-500">Weathering / Strength:</span>{' '}
                                      <strong>
                                        {rd.weatheringIndex || 'WII'} · {rd.strengthIndex || 'S3'}
                                      </strong>
                                    </div>
                                    <div>
                                      <span className="text-stone-500">Stability:</span>{' '}
                                      <strong>{rd.faceStabilityStatus || 'Stable'}</strong>
                                    </div>
                                    <div>
                                      <span className="text-stone-500">Lithology / Strokes:</span>{' '}
                                      <strong>{rd.lithologyStrokes?.length || 0} mapped</strong>
                                    </div>
                                    {rd.geologicalDescription && (
                                      <div className="text-stone-700 pt-0.5">
                                        <span className="text-stone-500">Notes:</span>{' '}
                                        {rd.geologicalDescription}
                                      </div>
                                    )}
                                  </div>

                                  {/* Box 2: Rock Mass Ratings (Q, RMR, GSI) */}
                                  <div className="p-2.5 bg-[#FFF8F1] border border-orange-200 rounded-lg space-y-1">
                                    <div className="font-bold text-orange-900 border-b border-orange-200 pb-1">
                                      2. Classification (Q / RMR / GSI)
                                    </div>
                                    <div>
                                      <span className="text-stone-500">Barton Q-Value:</span>{' '}
                                      <strong className="text-orange-700">{qVal}</strong>{' '}
                                      <span className="text-[10px] text-stone-500">
                                        (RQD {rd.qSystem?.rqd ?? '-'}, Jn {rd.qSystem?.jn ?? '-'},
                                        Jr {rd.qSystem?.jr ?? '-'}, Ja {rd.qSystem?.ja ?? '-'})
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-stone-500">Bieniawski RMR:</span>{' '}
                                      <strong className="text-emerald-700">{rmrVal}</strong>
                                    </div>
                                    <div>
                                      <span className="text-stone-500">Hoek-Brown GSI:</span>{' '}
                                      <strong className="text-indigo-700">
                                        {rd.gsiValue ?? '—'}
                                      </strong>
                                    </div>
                                    <div>
                                      <span className="text-stone-500">Support Class:</span>{' '}
                                      <strong>
                                        {rd.supportSystem?.supportClass || 'Class III'}
                                      </strong>
                                    </div>
                                    {rd.surveyOverbreak && (
                                      <div>
                                        <span className="text-stone-500">Overbreak:</span>{' '}
                                        <strong className="text-rose-700">
                                          {rd.surveyOverbreak.overbreakPercent?.toFixed(1) || 0}% (
                                          {rd.surveyOverbreak.overbreakVolumeM3?.toFixed(2) || 0}{' '}
                                          m³)
                                        </strong>
                                      </div>
                                    )}
                                  </div>

                                  {/* Box 3: Discontinuity Sets Summary */}
                                  <div className="p-2.5 bg-[#FFF8F1] border border-orange-200 rounded-lg space-y-1">
                                    <div className="font-bold text-orange-900 border-b border-orange-200 pb-1">
                                      3. Joint Sets ({enabledSets.length})
                                    </div>
                                    {enabledSets.length === 0 ? (
                                      <div className="text-stone-500">No joint sets enabled.</div>
                                    ) : (
                                      <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                                        {enabledSets.map((s) => (
                                          <div
                                            key={s.setId}
                                            className="flex items-center justify-between gap-2 text-[10px] border-b border-orange-100 pb-0.5"
                                          >
                                            <span className="font-bold text-stone-900">
                                              {s.setId}: {s.dipDirectionFrom}°–{s.dipDirectionTo}° /{' '}
                                              {s.dipAmountFrom}°–{s.dipAmountTo}°
                                            </span>
                                            <span className="text-stone-600 truncate">
                                              {s.spacing} · {s.roughness}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Captured Photos Preview Strip */}
                                {rd.collectedPhotos && rd.collectedPhotos.length > 0 && (
                                  <div className="space-y-1.5 pt-1">
                                    <div className="font-bold text-stone-700 text-[10px] uppercase tracking-wider">
                                      Captured &amp; Fitted Field Photos ({rd.collectedPhotos.length})
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                      {rd.collectedPhotos.map((ph) => (
                                        <div
                                          key={ph.id}
                                          className="border border-orange-200 rounded-lg overflow-hidden bg-stone-100 flex flex-col"
                                        >
                                          <img
                                            src={ph.dataUrl}
                                            alt={ph.label}
                                            className="w-full h-16 object-cover"
                                          />
                                          <div className="px-1.5 py-1 bg-white text-[9px] text-stone-700 truncate font-semibold">
                                            {ph.panelLabel || ph.panel.toUpperCase()}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Inline Edit Form */}
                            {isEditing && (
                              <div className="p-3 bg-orange-50/70 border border-orange-300 rounded-xl space-y-2.5">
                                <div className="font-bold text-orange-900 text-[11px]">
                                  EDIT MAPPING FILE DETAILS
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                  <label className="space-y-0.5">
                                    <span className="text-[10px] text-stone-600">Project Name</span>
                                    <input
                                      type="text"
                                      value={fieldEditForm.projectName}
                                      onChange={(e) =>
                                        setFieldEditForm((p) => ({
                                          ...p,
                                          projectName: e.target.value,
                                        }))
                                      }
                                      className="w-full px-2 py-1 bg-white border border-orange-300 rounded text-stone-900"
                                    />
                                  </label>
                                  <label className="space-y-0.5">
                                    <span className="text-[10px] text-stone-600">Location Name</span>
                                    <input
                                      type="text"
                                      value={fieldEditForm.locationName}
                                      onChange={(e) =>
                                        setFieldEditForm((p) => ({
                                          ...p,
                                          locationName: e.target.value,
                                        }))
                                      }
                                      className="w-full px-2 py-1 bg-white border border-orange-300 rounded text-stone-900"
                                    />
                                  </label>
                                  <label className="space-y-0.5">
                                    <span className="text-[10px] text-stone-600">
                                      Chainage From (m)
                                    </span>
                                    <input
                                      type="text"
                                      value={fieldEditForm.chainageFrom}
                                      onChange={(e) =>
                                        setFieldEditForm((p) => ({
                                          ...p,
                                          chainageFrom: e.target.value,
                                        }))
                                      }
                                      className="w-full px-2 py-1 bg-white border border-orange-300 rounded text-stone-900 font-bold"
                                    />
                                  </label>
                                  <label className="space-y-0.5">
                                    <span className="text-[10px] text-stone-600">
                                      Chainage To (m)
                                    </span>
                                    <input
                                      type="text"
                                      value={fieldEditForm.chainageTo}
                                      onChange={(e) =>
                                        setFieldEditForm((p) => ({
                                          ...p,
                                          chainageTo: e.target.value,
                                        }))
                                      }
                                      className="w-full px-2 py-1 bg-white border border-orange-300 rounded text-stone-900 font-bold"
                                    />
                                  </label>
                                  <label className="space-y-0.5">
                                    <span className="text-[10px] text-stone-600">Pull (m)</span>
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={fieldEditForm.pullLengthMeters}
                                      onChange={(e) =>
                                        setFieldEditForm((p) => ({
                                          ...p,
                                          pullLengthMeters: parseFloat(e.target.value) || 3.0,
                                        }))
                                      }
                                      className="w-full px-2 py-1 bg-white border border-orange-300 rounded text-stone-900"
                                    />
                                  </label>
                                  <label className="space-y-0.5">
                                    <span className="text-[10px] text-stone-600">
                                      Direction Azimuth (°)
                                    </span>
                                    <input
                                      type="number"
                                      value={fieldEditForm.tunnelDriveDirection}
                                      onChange={(e) =>
                                        setFieldEditForm((p) => ({
                                          ...p,
                                          tunnelDriveDirection: parseFloat(e.target.value) || 0,
                                        }))
                                      }
                                      className="w-full px-2 py-1 bg-white border border-orange-300 rounded text-stone-900"
                                    />
                                  </label>
                                  <label className="space-y-0.5">
                                    <span className="text-[10px] text-stone-600">
                                      Geologist Name
                                    </span>
                                    <input
                                      type="text"
                                      value={fieldEditForm.geologistName}
                                      onChange={(e) =>
                                        setFieldEditForm((p) => ({
                                          ...p,
                                          geologistName: e.target.value,
                                        }))
                                      }
                                      className="w-full px-2 py-1 bg-white border border-orange-300 rounded text-stone-900"
                                    />
                                  </label>
                                  <label className="space-y-0.5">
                                    <span className="text-[10px] text-stone-600">Date &amp; Time</span>
                                    <input
                                      type="text"
                                      value={fieldEditForm.dateAndTimeOfExcavation}
                                      onChange={(e) =>
                                        setFieldEditForm((p) => ({
                                          ...p,
                                          dateAndTimeOfExcavation: e.target.value,
                                        }))
                                      }
                                      className="w-full px-2 py-1 bg-white border border-orange-300 rounded text-stone-900"
                                    />
                                  </label>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingFieldRoundId(null)}
                                    className="px-3 py-1 rounded bg-white border border-stone-300 text-stone-700 font-semibold cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => saveEditFieldRound(rd.id)}
                                    className="px-3.5 py-1 rounded bg-orange-600 hover:bg-orange-500 text-white font-bold cursor-pointer"
                                  >
                                    Save Changes
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Inline Move Form */}
                            {isMoving && (
                              <div className="p-3 bg-indigo-50/70 border border-indigo-300 rounded-xl space-y-2.5">
                                <div className="font-bold text-indigo-900 text-[11px]">
                                  MOVE MAPPING FILE TO ANOTHER PROJECT OR LOCATION
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                  <label className="space-y-1">
                                    <span className="text-[10px] text-stone-700">
                                      Target Project
                                    </span>
                                    <select
                                      value={moveTargetProjectId}
                                      onChange={(e) => {
                                        const pid = e.target.value;
                                        setMoveTargetProjectId(pid);
                                        const foundP = fieldStore.projects.find(
                                          (p) => p.id === pid
                                        );
                                        if (foundP && foundP.locations[0]) {
                                          setMoveTargetLocationId(foundP.locations[0].id);
                                        } else {
                                          setMoveTargetLocationId('__NEW_LOCATION__');
                                        }
                                      }}
                                      className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded text-stone-900"
                                    >
                                      {fieldStore.projects.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {parseProjectDomainMeta(p.projectName).cleanName}
                                        </option>
                                      ))}
                                      <option value="__NEW_PROJECT__">
                                        + Create New Project...
                                      </option>
                                    </select>
                                  </label>

                                  {moveTargetProjectId === '__NEW_PROJECT__' ? (
                                    <label className="space-y-1">
                                      <span className="text-[10px] text-stone-700">
                                        New Project &amp; Location Name
                                      </span>
                                      <div className="grid grid-cols-2 gap-1.5">
                                        <input
                                          type="text"
                                          placeholder="New Project Name..."
                                          value={moveNewProjectName}
                                          onChange={(e) => setMoveNewProjectName(e.target.value)}
                                          className="px-2 py-1.5 bg-white border border-indigo-300 rounded text-stone-900"
                                        />
                                        <input
                                          type="text"
                                          placeholder="New Location Name..."
                                          value={moveNewLocationName}
                                          onChange={(e) => setMoveNewLocationName(e.target.value)}
                                          className="px-2 py-1.5 bg-white border border-indigo-300 rounded text-stone-900"
                                        />
                                      </div>
                                    </label>
                                  ) : (
                                    <label className="space-y-1">
                                      <span className="text-[10px] text-stone-700">
                                        Target Location
                                      </span>
                                      <select
                                        value={moveTargetLocationId}
                                        onChange={(e) => setMoveTargetLocationId(e.target.value)}
                                        className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded text-stone-900"
                                      >
                                        {(
                                          fieldStore.projects.find(
                                            (p) => p.id === moveTargetProjectId
                                          )?.locations || []
                                        ).map((l) => (
                                          <option key={l.id} value={l.id}>
                                            {l.name}
                                          </option>
                                        ))}
                                        <option value="__NEW_LOCATION__">
                                          + Create New Location in this Project...
                                        </option>
                                      </select>
                                    </label>
                                  )}
                                </div>

                                {moveTargetProjectId !== '__NEW_PROJECT__' &&
                                  moveTargetLocationId === '__NEW_LOCATION__' && (
                                    <input
                                      type="text"
                                      placeholder="Enter New Location Name..."
                                      value={moveNewLocationName}
                                      onChange={(e) => setMoveNewLocationName(e.target.value)}
                                      className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded text-stone-900"
                                    />
                                  )}

                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setMovingFieldRoundId(null)}
                                    className="px-3 py-1 rounded bg-white border border-stone-300 text-stone-700 font-semibold cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => confirmMoveFieldRound(rd.id)}
                                    className="px-3.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                                  >
                                    Confirm Move
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export const ProjectMemoryModal = React.memo<ProjectMemoryModalProps>((props) => {
  if (!props.isOpen) return null;
  return <ProjectMemoryModalContent {...props} />;
});
ProjectMemoryModal.displayName = 'ProjectMemoryModal';



