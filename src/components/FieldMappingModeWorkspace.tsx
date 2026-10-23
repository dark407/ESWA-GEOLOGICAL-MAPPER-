import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookmarkCheck,
  Box,
  Camera,
  Check,
  CheckCircle2,
  CircleDot,
  Columns,
  Compass,
  Crosshair,
  Droplets,
  Eraser,
  Eye,
  FileSpreadsheet,
  FolderPlus,
  Layers,
  MapPin,
  Move,
  Paintbrush,
  Pencil,
  Pickaxe,
  Plus,
  Redo2,
  RotateCcw,
  Search,
  Settings,
  Sliders,
  Sparkles,
  Trash2,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import { IndustryMode, JointSet, SurfaceType } from '../types/tunnel';
import { AdvancedGeologicalAnalysisModal } from './AdvancedGeologicalAnalysisModal';
import { MiningStopeFaceInspectorModal } from './MiningStopeFaceInspectorModal';
import { TbmShieldInspectorModal } from './TbmShieldInspectorModal';
import { NatmJoint3DInspectorModal } from './NatmJoint3DInspectorModal';
import {
  getCrownStrikePair,
} from '../engine/joint3DInspectorEngine';
import {
  addAndRememberCustomRock,
  autoComputeOrientationFromPlot,
  buildDipSurfaceOutlineAndCentroid,
  buildDipSurfacePolygonWithOutlineSnap,
  buildSmoothSvgPath,
  clampPointToFieldPanelOutline,
  clipSegmentToFieldPanelOutline,
  computeDisplayPanelGeometry,
  computeFieldQValue,
  computeFaceTunnelOutlineDetails,
  computePanelCanvasGeometry,
  computePhysicalMetricPoints,
  computeTCanvasLayout,
  computeTraceInlineLabelPlacements,
  computeTraceScreenDipTickVector,
  createDefaultExcavationRound,
  estimateTraceOrientationFromGeometry,
  getFieldPanelTransform,
  interpolateCatmullRomSpline,
  isPanelAtIdealPosition,
  isPointInsideFieldPanelOutline,
  mapPanelPointToUnfoldedBox,
  mapUnfoldedBoxPointToPanel,
  panelPointToTCanvasPoint,
  resolveTCanvasPanelAtPoint,
  saveIdealPanelTransform,
  snapPointToExactFieldPanelOutline,
  tCanvasPointToPanelPoint,
  FIELD_EXTENDED_ROCK_SUGGESTIONS,
  FIELD_EXTENDED_VEIN_FOLIATION_SUGGESTIONS,
  FIELD_FAULT_ELEMENT_ROLES,
  FIELD_FAULT_SUBTYPE_CATALOG,
  FIELD_FOLD_ELEMENT_ROLES,
  FIELD_FOLD_SUBTYPE_CATALOG,
  FIELD_JOINT_GROUP_COLORS,
  FIELD_LITHOLOGY_CATALOG,
  FIELD_LITHOLOGY_COLOR_FAMILIES,
  FIELD_PANEL_DISPLAY_LABELS,
  FIELD_STRUCTURAL_FEATURE_CATALOG,
  FIELD_TUNNEL_SHAPES,
  FIELD_VEIN_AND_FOLIATION_CATALOG,
  FIELD_WATER_CATALOG,
  FieldCanvasSnapshot,
  FieldCollectedPhoto,
  FieldDipPlaneSurface,
  FieldDiscontinuitySetRecord,
  FieldExcavationRound,
  FieldFaultElementRole,
  FieldFaultSubType,
  FieldFoldElementRole,
  FieldFoldSubType,
  FieldJointGroupingId,
  FieldJointSetId,
  FieldJointTrace,
  FieldLithologyId,
  FieldLithologyStroke,
  FieldMappingStoreState,
  FieldPanelId,
  FieldPoint2D,
  FieldProjectItem,
  FieldRememberedRockItem,
  FieldStructuralFeature,
  FieldStructuralFeatureType,
  FieldTransformStageMode,
  FieldTunnelLocationItem,
  FieldTunnelShapeType,
  FieldWaterCondition,
  FieldWaterMark,
  getFieldPhotoFitConfig,
  loadFieldMappingStore,
  processCleanFieldCameraFrame,
  pruneFullyErasedLithologyStrokes,
  resolveLithologyFamilyForHex,
  resolveRockDisplayInfo,
  saveFieldMappingStore,
  smoothFieldTracePoints,
} from '../engine/fieldMappingEngine';
import {
  evaluateCustomProfileGeometry,
} from '../engine/customProfileEngine';
import {
  FieldCanvasGeometryReferenceOverlay,
  FieldLiveCompassInclinometer,
  FieldMonochromeGeologicalPatterns,
  FieldStructuralFeatureSvgRenderer,
  FieldVeinFoliationBandSvgElement,
  FieldVeinFoliationSymbolPreviewSvg,
  FieldWaterConditionGlyph,
  FieldWaterSymbolPreviewSvg,
  FieldWaterSymbolSvgRenderer,
} from './FieldMappingCompassAndPatterns';
import {
  FieldStripAlignmentStage,
  FieldTwoPageReportAndTemplateStage,
} from './FieldMappingReportAndParamsStages';
import {
  FieldDiscontinuitySetsStage,
  FieldRockMassClassificationsStage,
  FieldSupportSystemStage,
  FieldSurveyOverbreakStage,
} from './FieldAdvancedStages';
import {
  Tunnel3DPhotoCanvas,
} from './Tunnel3DPhotoCanvas';
import {
  Field3DTunnelGeologicalReportStage,
  FieldCanvasAdvanceMatlabPanel,
  FieldFourPhotoUploadStage,
  FieldInBuiltCameraStage,
  FieldPhotoFitStage,
  FieldSvgMatlabFilterDefs,
  FieldTwoPagePhotoReportStage,
  FittedPanelPhotoSvgImage,
} from './FieldPhotoFitAndReportsStages';
import {
  FreeformCustomProfileEditor,
} from './FreeformCustomProfileEditor';
import {
  Field3DNewTraceUnfoldedSyncBox,
  Field3DSyncTraceState,
  Field3DTunnelCanvas,
  getFieldToolCursorDataUri,
} from './Field3DTunnelCanvas';
import {
  createTunnelGeometry,
} from '../engine/geometryEngine';
import {
  generateSampleTunnelPhotograph,
} from '../engine/sampleFieldData';
import {
  ProfileType,
  TunnelGeometry,
  SavedProjectRecord,
  Joint,
} from '../types/tunnel';
import {
  loadAllContinuousStripDatasets,
  parsePullIntervalFromRecord,
  saveAllContinuousStripDatasets,
  syncSavedProjectsIntoStripDatasets,
} from '../engine/continuous3DStripEngine';
import {
  createDefaultQIndexParameters,
} from '../engine/photoWarpEngine';
import {
  EswaAppBackgroundWatermark,
  EswaTunnelLogo,
} from './EswaBrandIdentity';
import {
  ThemeToggleButton,
} from '../context/ThemeContext';
import {
  GlobalSettingsModal,
} from './GlobalSettingsModal';
import {
  FIELD_STAGE_LABELS,
  getActiveGeologistProfile,
  GeologistUserProfile,
  loadFieldMappingResumeState,
  saveFieldMappingResumeState,
  stampGeologistSignatureIntoRound,
  syncFieldMappingRoundForAiTraining,
} from '../engine/userCloudAndPackageEngine';
import {
  FaceCompletionAndReviewBar,
} from './DeviceIdReviewAndNotificationCenter';
import {
  evaluateSurfaceStabilityAndRomanaSmr,
  getSurfacePanelLabelMap,
  loadSavedSurfaceGeometryParameters,
  MappingDomainType,
  saveSurfaceGeometryParameters,
  saveSurfaceMappingResumeState,
  SurfaceGeometryParameters,
  SurfaceMappingSubType,
} from '../engine/surfaceMappingEngine';

interface FieldMappingModeWorkspaceProps {
  onBackToWelcome?: () => void;
  onExitToWelcome?: () => void;
  onOpenDataStorage?: () => void;
  onOpenCoreLogging?: () => void;
  onOpenContinuousTunnelLog?: () => void;
  initialWorkflowMode?: 'photo_mapping' | 'field_mapping';
  onChangeWorkflowMode?: (mode: 'photo_mapping' | 'field_mapping') => void;
  resumeAtLastStage?: boolean;
  initialStage?: FieldWorkflowStage;
  initialMappingDomain?: MappingDomainType;
  onChangeMappingDomain?: (domain: MappingDomainType) => void;
  industryMode?: IndustryMode;
  onChangeIndustryMode?: (mode: IndustryMode) => void;
}

export type FieldWorkflowStage =
  | 'project_setup'
  | 'excavation_round'
  | 'camera_prompt'
  | 'photo_fit'
  | 'field_canvas'
  | 'joint_grouping'
  | 'strip_align'
  | 'discontinuity_sets'
  | 'q_rmr_gsi'
  | 'support_system'
  | 'survey_overbreak'
  | 'discontinuity_q_rmr'
  | 'word_template_export'
  | 'photo_2d_report'
  | 'advance_analysis'
  | 'geology_3d_report';

export type SplitPhotoFilterType =
  | 'normal'
  | 'negative'
  | 'bw_contrast'
  | 'rgb_red'
  | 'rgb_green'
  | 'rgb_blue'
  | 'ridge_edge'
  | 'clahe'
  | 'thermal'
  | 'sepia';

export const SPLIT_PHOTO_FILTER_LABELS: Record<SplitPhotoFilterType, string> = {
  normal: 'Original',
  negative: 'Negative (Invert)',
  bw_contrast: 'High B&W',
  rgb_red: 'Red (Iron Oxide)',
  rgb_green: 'Green (Chlorite)',
  rgb_blue: 'Blue (Seepage)',
  ridge_edge: 'Ridge (Edges)',
  clahe: 'CLAHE (Stretch)',
  thermal: 'Thermal Heatmap',
  sepia: 'Sepia Warm',
};

type FieldCanvasTool =
  | '1_lithology'
  | '2_vein_foliation'
  | '3_joint_trace'
  | '4_dip_surface'
  | '5_geo_feature'
  | '6_water_mark'
  | 'eraser';

export const FieldMappingModeWorkspace: React.FC<FieldMappingModeWorkspaceProps> = ({
  onBackToWelcome,
  onExitToWelcome,
  onOpenDataStorage,
  onOpenCoreLogging,
  onOpenContinuousTunnelLog,
  initialWorkflowMode = 'field_mapping',
  resumeAtLastStage = false,
  initialStage,
  initialMappingDomain = 'TUNNEL',
  onChangeMappingDomain,
  industryMode: propIndustryMode,
  onChangeIndustryMode,
}) => {
  const [currentIndustryMode, setCurrentIndustryMode] = useState<IndustryMode>(() => {
    if (propIndustryMode) return propIndustryMode;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('eswa_active_industry_mode_v1');
      if (saved === 'NATM' || saved === 'TBM' || saved === 'MINING') {
        return saved as IndustryMode;
      }
    }
    return 'NATM';
  });

  const [isMiningInspectorOpen, setIsMiningInspectorOpen] = useState<boolean>(false);
  const [isTbmInspectorOpen, setIsTbmInspectorOpen] = useState<boolean>(false);

  const handleModeSwitch = (m: IndustryMode) => {
    setCurrentIndustryMode(m);
    try {
      localStorage.setItem('eswa_active_industry_mode_v1', m);
    } catch {
      // Ignore
    }
    if (onChangeIndustryMode) {
      onChangeIndustryMode(m);
    }
  };

  const savedResume = useMemo(() => loadFieldMappingResumeState(), []);
  const [workflowMode, setWorkflowMode] = useState<'field_mapping' | 'photo_mapping'>(
    initialWorkflowMode
  );
  const [mappingDomain, setMappingDomain] = useState<MappingDomainType>(initialMappingDomain);
  const [surfaceParams, setSurfaceParams] = useState<SurfaceGeometryParameters>(() =>
    loadSavedSurfaceGeometryParameters(
      initialMappingDomain !== 'TUNNEL' ? (initialMappingDomain as SurfaceMappingSubType) : 'BENCH'
    )
  );
  const [showSurfaceConfigBar, setShowSurfaceConfigBar] = useState<boolean>(
    initialMappingDomain !== 'TUNNEL'
  );
  const [isGlobalSettingsOpen, setIsGlobalSettingsOpen] = useState(false);
  const [activeGeologist, setActiveGeologist] = useState<GeologistUserProfile | null>(() =>
    getActiveGeologistProfile()
  );

  useEffect(() => {
    const handleProfileChange = () => {
      setActiveGeologist(getActiveGeologistProfile());
    };
    window.addEventListener('eswa-geologist-profile-changed', handleProfileChange);
    return () => window.removeEventListener('eswa-geologist-profile-changed', handleProfileChange);
  }, []);

  const mappingDomainRef = useRef<MappingDomainType>(mappingDomain);
  mappingDomainRef.current = mappingDomain;

  useEffect(() => {
    setWorkflowMode(initialWorkflowMode);
  }, [initialWorkflowMode]);

  useEffect(() => {
    if (initialMappingDomain !== mappingDomain) {
      saveFieldMappingStore(latestStoreRef.current, mappingDomain);
      setMappingDomain(initialMappingDomain);
      mappingDomainRef.current = initialMappingDomain;
      const nextStore = loadFieldMappingStore(initialMappingDomain);
      setStore(nextStore);
      latestStoreRef.current = nextStore;
    }
    if (initialMappingDomain !== 'TUNNEL') {
      setSurfaceParams((prev) => {
        const next =
          prev.subType === initialMappingDomain
            ? prev
            : loadSavedSurfaceGeometryParameters(initialMappingDomain as SurfaceMappingSubType);
        saveSurfaceGeometryParameters(next);
        return next;
      });
      setShowSurfaceConfigBar(true);
    } else {
      setShowSurfaceConfigBar(false);
    }
  }, [initialMappingDomain]);

  const handleSelectMappingDomain = (nextDomain: MappingDomainType) => {
    if (nextDomain === mappingDomain) return;
    // 1. Immediately flush/save active store to current domain's isolated key
    saveFieldMappingStore(latestStoreRef.current, mappingDomain);

    // 2. Switch domain
    setMappingDomain(nextDomain);
    mappingDomainRef.current = nextDomain;
    if (onChangeMappingDomain) onChangeMappingDomain(nextDomain);

    // 3. Load target domain's independent store
    const nextStore = loadFieldMappingStore(nextDomain);
    setStore(nextStore);
    latestStoreRef.current = nextStore;

    // 4. Update surface geometry parameters
    if (nextDomain !== 'TUNNEL') {
      const loaded = loadSavedSurfaceGeometryParameters(nextDomain as SurfaceMappingSubType);
      const updated = { ...loaded, subType: nextDomain as SurfaceMappingSubType };
      setSurfaceParams(updated);
      saveSurfaceGeometryParameters(updated);
      setShowSurfaceConfigBar(true);
    } else {
      setShowSurfaceConfigBar(false);
    }
  };

  const domainPanelMap = useMemo(() => getSurfacePanelLabelMap(mappingDomain), [mappingDomain]);

  const formatProjectNameForDomain = (rawName: string): string => {
    if (mappingDomain === 'TUNNEL') return rawName;
    if (/tunnel|hrt|adit|cavern/i.test(rawName)) {
      if (mappingDomain === 'BENCH') return 'Open-Pit & Quarry Bench Mapping Project';
      if (mappingDomain === 'TRENCH') return 'Geological Trench & Test-Pit Logging Project';
      if (mappingDomain === 'SLOPE') return 'Engineered & Natural Slope Mapping Project';
      return 'General Rock Surface & Outcrop Mapping Project';
    }
    return rawName;
  };

  const formatLocationNameForDomain = (rawLocName: string): string => {
    if (mappingDomain === 'TUNNEL') return rawLocName;
    if (/tunnel|hrt|adit|heading|shaft/i.test(rawLocName)) {
      if (mappingDomain === 'BENCH') return surfaceParams.benchNumberLabel || 'Bench Level BL-1240';
      if (mappingDomain === 'TRENCH') return surfaceParams.trenchIdLabel || 'Trench TR-01';
      if (mappingDomain === 'SLOPE') return surfaceParams.slopeIdLabel || 'Cut Slope CS-01';
      return surfaceParams.rockSurfaceIdLabel || 'Rock Exposure RS-01';
    }
    return rawLocName;
  };
  const formatDomainProjName = formatProjectNameForDomain;
  const formatDomainLocName = formatLocationNameForDomain;

  // 100% Automatic Persistent Store - strictly isolated by mapping domain
  const [store, setStore] = useState<FieldMappingStoreState>(() => {
    const loaded = loadFieldMappingStore(initialMappingDomain);
    if (resumeAtLastStage && savedResume) {
      return {
        ...loaded,
        activeProjectId: savedResume.activeProjectId || loaded.activeProjectId,
        activeLocationId: savedResume.activeLocationId || loaded.activeLocationId,
        activeRoundId: savedResume.activeRoundId || loaded.activeRoundId,
      };
    }
    return loaded;
  });
  const [stage, setStage] = useState<FieldWorkflowStage>(() => {
    if (initialStage) return initialStage;
    if (resumeAtLastStage && savedResume?.stage) {
      return savedResume.stage as FieldWorkflowStage;
    }
    return 'project_setup';
  });

  // Underground Mine Geology interactive sub-tool & interval hover states
  const [activeMineSubTool, setActiveMineSubTool] = useState<
    'none' | 'channel_line' | 'ore_waste_line'
  >('none');
  const [hoveredMineIntervalId, setHoveredMineIntervalId] = useState<string | null>(null);
  const [isAdvanceGeologicalAnalysisOpen, setIsAdvanceGeologicalAnalysisOpen] = useState<boolean>(false);

  // Ensure Field Mapping never lands on 'photo_fit'
  useEffect(() => {
    if (workflowMode === 'field_mapping' && stage === 'photo_fit') {
      setStage('field_canvas');
    }
  }, [workflowMode, stage]);


  // Debounced auto-save strictly to active mapping domain
  const latestStoreRef = useRef(store);
  latestStoreRef.current = store;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveFieldMappingStore(latestStoreRef.current, mappingDomainRef.current);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [store]);

  useEffect(() => {
    const flushStoreNow = () => {
      saveFieldMappingStore(latestStoreRef.current, mappingDomainRef.current);
    };
    window.addEventListener('beforeunload', flushStoreNow);
    return () => {
      flushStoreNow();
      window.removeEventListener('beforeunload', flushStoreNow);
    };
  }, []);

  // Active Project, Location, and Excavation Round
  const activeProject = useMemo(() => {
    const rawProj =
      store.projects.find((p) => p.id === store.activeProjectId) || store.projects[0] || null;
    if (!rawProj) return null;
    if (mappingDomain !== 'TUNNEL') {
      return {
        ...rawProj,
        projectName: formatProjectNameForDomain(rawProj.projectName),
      };
    }
    return rawProj;
  }, [store.projects, store.activeProjectId, mappingDomain]);

  const activeLocation = useMemo(() => {
    if (!activeProject) return null;
    const rawLoc =
      activeProject.locations.find((l) => l.id === store.activeLocationId) ||
      activeProject.locations[0] ||
      null;
    if (!rawLoc) return null;
    if (mappingDomain !== 'TUNNEL') {
      const nextW =
        mappingDomain === 'TRENCH'
          ? Math.max(0.8, Number(surfaceParams.trenchWidthMeters) || 2.0)
          : mappingDomain === 'ROCK_SURFACE'
          ? Math.max(1.5, Number(surfaceParams.rockExposureWidthMeters) || 12.0)
          : Math.max(2.0, Number(surfaceParams.exposureLengthMeters) || rawLoc.widthM || 15.0);
      const nextH =
        mappingDomain === 'TRENCH'
          ? Math.max(0.8, Number(surfaceParams.trenchDepthMeters) || 2.5)
          : mappingDomain === 'SLOPE'
          ? Math.max(2.0, Number(surfaceParams.slopeHeightMeters) || 18.0)
          : mappingDomain === 'ROCK_SURFACE'
          ? Math.max(1.5, Number(surfaceParams.rockExposureHeightMeters) || 8.0)
          : Math.max(1.5, Number(surfaceParams.benchHeightMeters) || 10.0);
      return {
        ...rawLoc,
        name: formatLocationNameForDomain(rawLoc.name),
        shape: 'rectangular' as FieldTunnelShapeType,
        widthM: nextW,
        heightM: nextH,
        wallHeightM: nextH,
        defaultDriveAzimuth: Number(surfaceParams.faceDipDirectionDeg) || rawLoc.defaultDriveAzimuth,
        singlePanelOnly:
          mappingDomain === 'ROCK_SURFACE' && surfaceParams.rockSurfaceLayoutMode === 'SINGLE_PANEL',
      } as FieldTunnelLocationItem;
    }
    return rawLoc;
  }, [activeProject, store.activeLocationId, mappingDomain, surfaceParams]);

  const activeRound = useMemo(() => {
    if (!activeProject || !activeLocation) return null;
    const found = store.rounds.find(
      (r) =>
        r.id === store.activeRoundId &&
        r.projectId === activeProject.id &&
        r.locationId === activeLocation.id
    );
    if (found) return found;
    return (
      store.rounds.find(
        (r) => r.projectId === activeProject.id && r.locationId === activeLocation.id
      ) || null
    );
  }, [store.rounds, store.activeRoundId, activeProject, activeLocation]);

  // Automatic non-blocking telemetry sync for AI training on key workflow milestones
  useEffect(() => {
    if (!activeRound) return;
    if (stage === 'joint_grouping' || stage === 'strip_align') {
      syncFieldMappingRoundForAiTraining(
        activeRound,
        activeProject || undefined,
        activeLocation || undefined,
        'MANUAL_TRACE_SAVED'
      );
    } else if (stage === 'support_system' || stage === 'survey_overbreak') {
      syncFieldMappingRoundForAiTraining(
        activeRound,
        activeProject || undefined,
        activeLocation || undefined,
        'GEOTECH_CALCULATED'
      );
    } else if (
      stage === 'word_template_export' ||
      stage === 'photo_2d_report' ||
      stage === 'advance_analysis' ||
      stage === 'geology_3d_report'
    ) {
      syncFieldMappingRoundForAiTraining(
        activeRound,
        activeProject || undefined,
        activeLocation || undefined,
        'EXPORT_GENERATED'
      );
    }
  }, [stage, activeRound?.id, activeProject, activeLocation]);

  // Continuous background synchronization:
  // Whenever traces or parameters update on Face, Left Wall, Crown, or Right Wall,
  // automatically synchronize with continuous 3D strip datasets in the background!
  useEffect(() => {
    if (!activeRound || !activeLocation) return;
    try {
      const fromSt = activeRound.chainageFrom || '';
      const toSt = activeRound.chainageTo || '';
      const pullLen = activeRound.pullLengthMeters || 3.5;
      const liveInterval = parsePullIntervalFromRecord(
        fromSt,
        toSt,
        pullLen
      );
      const projName = (activeProject?.projectName || 'Tunnel Project').trim();
      const locName = (activeLocation.name || 'Main Tunnel').trim();

      const convertedJoints: Joint[] = activeRound.jointTraces.map((tr) => {
        const metricPts =
          tr.metricPoints && tr.metricPoints.length === tr.points.length
            ? tr.metricPoints
            : computePhysicalMetricPoints(tr.points, tr.panel, activeLocation, activeRound);
        return {
          id: tr.id,
          surface:
            tr.panel === 'left_wall'
              ? 'leftWall'
              : tr.panel === 'right_wall'
              ? 'rightWall'
              : tr.panel === 'crown'
              ? 'crown'
              : 'face',
          geometry: metricPts,
          traceAngle: tr.strike || 0,
          strike: tr.strike || 0,
          dip: tr.dipAmount || 45,
          dipDirection: tr.dipDirection || 90,
          set: tr.setId || 'J1',
          featureType: 'joint',
          confidence: 'High',
          confidenceScore: 0.9,
          confidenceBreakdown: { detection: 90, trace: 90, geometric: 90, orientation: 90 },
          source: 'MANUAL',
          accepted: true,
          persistenceMeters: tr.traceLengthM || 1.5,
          orientationStatus: tr.editedByCompass ? 'DIRECTLY_MEASURED' : 'GEOMETRICALLY_CALCULATED',
        };
      });

      const defQ = createDefaultQIndexParameters();
      const syntheticRecord: SavedProjectRecord = {
        id: `auto-round-${activeRound.id}`,
        projectName: projName,
        tunnelName: locName,
        location: locName,
        chainage: fromSt || `RD ${liveInterval.fromRd}m - ${liveInterval.toRd}m`,
        faceChainage: toSt || `RD ${liveInterval.toRd}m`,
        numericChainageMeters: liveInterval.toRd,
        date: activeRound.createdAt || activeRound.dateAndTimeOfExcavation || new Date().toISOString().slice(0, 10),
        savedAt: new Date().toISOString(),
        mappingMode: 'tunnel_3d',
        geometry: {
          width: activeLocation.widthM,
          height: activeLocation.heightM,
          wallHeight: activeLocation.wallHeightM || activeLocation.heightM * 0.58,
          leftWallArcLength: activeLocation.wallHeightM || 4.2,
          rightWallArcLength: activeLocation.wallHeightM || 4.2,
          crownArcLength: activeLocation.widthM * 1.25,
          crownGeometry: 'horseshoe',
          crownRadius: activeLocation.widthM * 0.5,
          crossSectionPoints: [],
          units: 'm',
          source: 'manual',
        },
        settings: {
          projectName: projName,
          tunnelName: locName,
          location: locName,
          driveDirectionInput: String(activeRound.tunnelDriveDirection || 0),
          driveDirection: activeRound.tunnelDriveDirection || 0,
          chainage: fromSt || `RD ${liveInterval.fromRd}m - ${liveInterval.toRd}m`,
          faceChainage: toSt || `RD ${liveInterval.toRd}m`,
          roundLength: pullLen,
          date: activeRound.createdAt || activeRound.dateAndTimeOfExcavation || new Date().toISOString().slice(0, 10),
          mappedBy: activeRound.geologistName || 'Geologist',
          lithology: activeRound.lithologyStrokes?.[0]?.rockName || 'Rock Mass',
        },
        joints: convertedJoints,
        customJointSetOverrides: {},
        qIndexParams: {
          ...defQ,
          rqd: activeRound.qSystem?.rqd ?? 75,
          jn: activeRound.qSystem?.jn ?? 9,
          jr: activeRound.qSystem?.jr ?? 1.5,
          ja: activeRound.qSystem?.ja ?? 2,
          jw: activeRound.qSystem?.jw ?? 1,
          srf: activeRound.qSystem?.srf ?? 2.5,
          qValue: computeFieldQValue(activeRound.qSystem).qValue,
        },
        rmrParams: {
          intactStrengthRating: activeRound.rmrSystem?.ucsRating ?? 12,
          rqdRating: activeRound.rmrSystem?.rqdRating ?? 17,
          spacingRating: activeRound.rmrSystem?.spacingRating ?? 10,
          conditionRating: activeRound.rmrSystem?.conditionRating ?? 20,
          groundwaterRating: activeRound.rmrSystem?.waterRating ?? 10,
          orientationAdjustmentRating: activeRound.rmrSystem?.orientationAdj ?? -5,
        } as any,
      } as any;

      const existing = loadAllContinuousStripDatasets();
      const updated = syncSavedProjectsIntoStripDatasets(existing, [syntheticRecord]);
      saveAllContinuousStripDatasets(updated);
    } catch {
      // Non-blocking background sync
    }
  }, [
    activeRound?.jointTraces,
    activeRound?.chainageFrom,
    activeRound?.chainageTo,
    activeRound?.pullLengthMeters,
    activeRound?.tunnelDriveDirection,
    activeLocation,
    activeProject,
  ]);

  // Automatically stamp active geologist name & PNG signature into active round based on role
  useEffect(() => {
    if (!activeRound?.id || !activeGeologist) return;
    setStore((prev) => {
      const idx = prev.rounds.findIndex((r) => r.id === activeRound.id);
      if (idx === -1) return prev;
      const target = prev.rounds[idx];
      const stamped = stampGeologistSignatureIntoRound(target, activeGeologist);
      if (
        stamped.contractorGeologistSign === target.contractorGeologistSign &&
        stamped.contractorGeologistName === target.contractorGeologistName &&
        stamped.consultantGeologistSign === target.consultantGeologistSign &&
        stamped.consultantGeologistName === target.consultantGeologistName &&
        stamped.clientGeologistSign === target.clientGeologistSign &&
        stamped.clientGeologistName === target.clientGeologistName
      ) {
        return prev;
      }
      const nextRounds = [...prev.rounds];
      nextRounds[idx] = stamped;
      return { ...prev, rounds: nextRounds };
    });
  }, [activeRound?.id, activeGeologist?.id, activeGeologist?.pngSignatureDataUrl]);

  // Stage 1: New Project & New Tunnel Location Modal / Form state
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjClient, setNewProjClient] = useState('');
  const [newProjContractor, setNewProjContractor] = useState('');
  const [newProjConsultant, setNewProjConsultant] = useState('');

  const [showNewLocationForm, setShowNewLocationForm] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocShape, setNewLocShape] = useState<FieldTunnelShapeType>('d_shaped');
  const [newLocWidth, setNewLocWidth] = useState(8.5);
  const [newLocHeight, setNewLocHeight] = useState(7.5);
  const [newLocAzimuth, setNewLocAzimuth] = useState(45);
  const [newLocCustomPoints, setNewLocCustomPoints] = useState<
    { x: number; y: number }[] | undefined
  >(undefined);
  const [newLocCustomGeometry, setNewLocCustomGeometry] = useState<
    TunnelGeometry | undefined
  >(undefined);
  const [customBuilderTarget, setCustomBuilderTarget] = useState<
    'new_location' | 'active_location' | null
  >(null);

  // Sequential Setup Window step: Surface Type (for Surface Mapping) -> 1. Project -> 2. Location -> 3. Face / Station
  const [setupWindowStep, setSetupWindowStep] = useState<
    'surface_type' | 'project' | 'location' | 'face'
  >(() => (initialMappingDomain !== 'TUNNEL' && !resumeAtLastStage ? 'surface_type' : 'project'));
  const [setupLayoutMode, setSetupLayoutMode] = useState<'wizard' | 'columns'>('wizard');

  // New Face / Station modal state (asks Face Details + Field vs Photogrammetry Method)
  const [showNewFaceModal, setShowNewFaceModal] = useState(false);
  const [newFaceChainageFrom, setNewFaceChainageFrom] = useState('100.0');
  const [newFacePullLength, setNewFacePullLength] = useState(3.0);
  const [newFaceGeologist, setNewFaceGeologist] = useState('Site Engineering Geologist');
  const [newFaceExcavationMode, setNewFaceExcavationMode] = useState('Drill & Blast (Full Face)');
  const [newFaceMethod, setNewFaceMethod] = useState<'field_mapping' | 'photo_mapping'>(
    initialWorkflowMode
  );

  // Photogrammetry Dual-Canvas Face Mapping States (Clean Outline on Left + Rock Photo on Right, Crown on Bottom)
  const [confirmedPhotoJointIds, setConfirmedPhotoJointIds] = useState<Set<string>>(() => new Set());
  const [isPeekingTracesOnPhoto, setIsPeekingTracesOnPhoto] = useState<boolean>(false);
  const [pendingPhotogrammetryJoint, setPendingPhotogrammetryJoint] = useState<FieldJointTrace | null>(null);
  const [photogrammetryDuplicateWarning, setPhotogrammetryDuplicateWarning] = useState<{
    matchId: string;
    distance: number;
  } | null>(null);

  // Photogrammetry Dual-Canvas View & Realtime Sync States
  const [isPhotogrammetryDualCanvas, setIsPhotogrammetryDualCanvas] = useState<boolean>(true);
  const [syncPhotoZoomPan, setSyncPhotoZoomPan] = useState<boolean>(true);
  const [photoBrightness, setPhotoBrightness] = useState<number>(100);
  const [photoContrast, setPhotoContrast] = useState<number>(100);
  const [photoMatlabFilter, setPhotoMatlabFilter] = useState<boolean>(false);
  const [splitPhotoFilter, setSplitPhotoFilter] = useState<SplitPhotoFilterType>('normal');
  const [syncCursorCoord, setSyncCursorCoord] = useState<FieldPoint2D | null>(null);
  const [dualCanvasMobileTab, setDualCanvasMobileTab] = useState<'map' | 'photo' | 'split'>('map');
  const [photoCanvasViewMode, setPhotoCanvasViewMode] = useState<'2d' | '3d'>('2d');
  const [photoCanvasTheme, setPhotoCanvasTheme] = useState<'light' | 'dark'>('light');
  const photoCanvasSvgRef = useRef<SVGSVGElement | null>(null);

  // Default authentic high-contrast rock photograph if user hasn't uploaded one yet
  const defaultSampleFacePhoto = useMemo(() => {
    if (!activeLocation) return '';
    try {
      const geom =
        activeLocation.customGeometry ||
        createTunnelGeometry(
          activeLocation.widthM || 8.5,
          activeLocation.heightM || 7.5,
          4.0,
          'd_shaped'
        );
      return generateSampleTunnelPhotograph('face', geom);
    } catch {
      return '';
    }
  }, [activeLocation]);

  const effectiveFacePhotoDataUrl = useMemo(() => {
    const p = activeRound?.collectedPhotos.slice().reverse().find((ph) => ph.panel === 'face');
    return p?.dataUrl || defaultSampleFacePhoto;
  }, [activeRound?.collectedPhotos, defaultSampleFacePhoto]);

  // Shift key peeking: hold Shift to temporarily reveal confirmed joints over rock photo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsPeekingTracesOnPhoto(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsPeekingTracesOnPhoto(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);



  // Stage 4: Field Mapping Canvas State (Single Panel in Stage 4; Full 4-Panel in Stage 5 Group Joints; or 3D Tunnel Mode)
  const [activePanel, setActivePanel] = useState<FieldPanelId>(() =>
    resumeAtLastStage && savedResume?.activePanel ? savedResume.activePanel : 'face'
  );

  const activePanelUploadedPhoto = useMemo(() => {
    return (
      activeRound?.collectedPhotos
        .slice()
        .reverse()
        .find(
          (ph) =>
            ph.panel === activePanel &&
            Boolean(ph.dataUrl && ph.dataUrl.trim().length > 0)
        ) || null
    );
  }, [activeRound?.collectedPhotos, activePanel]);

  const hasPhotoForActivePanel = Boolean(activePanelUploadedPhoto?.dataUrl);

  const effectiveActivePanelPhotoDataUrl = useMemo(() => {
    if (activePanelUploadedPhoto?.dataUrl) {
      return activePanelUploadedPhoto.dataUrl;
    }
    // Only fall back to sample photo on the face if user has not uploaded one yet in photogrammetry mode
    if (workflowMode === 'photo_mapping' && activePanel === 'face') {
      return defaultSampleFacePhoto;
    }
    return '';
  }, [activePanelUploadedPhoto, activePanel, workflowMode, defaultSampleFacePhoto]);

  // Split option is shown ONLY in photogrammetry mode AND ONLY if a photo is uploaded for the active portion
  const canShowSplitOption =
    workflowMode === 'photo_mapping' && hasPhotoForActivePanel;

  // Auto-collapse split view if current panel has no photo or in field mapping mode
  useEffect(() => {
    if (!canShowSplitOption && dualCanvasMobileTab === 'split') {
      setDualCanvasMobileTab('map');
    }
  }, [canShowSplitOption, dualCanvasMobileTab]);
  const [is3DMappingMode, setIs3DMappingMode] = useState<boolean>(() =>
    resumeAtLastStage && typeof savedResume?.is3DMappingMode === 'boolean'
      ? savedResume.is3DMappingMode
      : false
  );
  const [syncTrace3DState, setSyncTrace3DState] = useState<Field3DSyncTraceState | null>(null);

  // Automatically persist where the user is working (debounced so it never blocks drawing)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveFieldMappingResumeState({
        stage,
        activeProjectId: activeProject?.id || store.activeProjectId,
        activeLocationId: activeLocation?.id || store.activeLocationId,
        activeRoundId: activeRound?.id || store.activeRoundId,
        activePanel,
        is3DMappingMode,
        chainageLabel: activeRound
          ? `CH ${activeRound.chainageFrom}m–${activeRound.chainageTo}m`
          : 'Field Session',
        locationLabel: activeLocation?.name || activeProject?.projectName || 'Tunnel Heading',
        stageLabel: FIELD_STAGE_LABELS[stage] || stage,
        updatedAt: new Date().toISOString(),
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    stage,
    activeProject?.id,
    activeProject?.projectName,
    activeLocation?.id,
    activeLocation?.name,
    activeRound?.id,
    activeRound?.chainageFrom,
    activeRound?.chainageTo,
    store.activeProjectId,
    store.activeLocationId,
    store.activeRoundId,
    activePanel,
    is3DMappingMode,
  ]);

  const canvasViewMode: 'unfolded_t' | 'single_panel' =
    stage === 'joint_grouping' ? 'unfolded_t' : 'single_panel';
  const drawingPanelRef = useRef<FieldPanelId>('face');
  const [activeTool, setActiveTool] = useState<FieldCanvasTool>('1_lithology');
  const [selectedRockType, setSelectedRockType] = useState<FieldLithologyId>('quartzite');
  const [lithologySubMode, setLithologySubMode] = useState<'paint' | 'erase_area'>('paint');
  const [showOtherRockSearch, setShowOtherRockSearch] = useState(false);
  const [rockSearchQuery, setRockSearchQuery] = useState('');

  // Canvas Zoom In / Zoom Out & Pan state (1000x1000 world space)
  const [canvasZoom, setCanvasZoom] = useState<number>(1);
  const [canvasPan, setCanvasPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isCanvasPanMode, setIsCanvasPanMode] = useState<boolean>(false);
  const [panDragOrigin, setPanDragOrigin] = useState<{
    clientX: number;
    clientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  // Panel Move / Rotate / MirrorVertical / MirrorHorizontal state for Left Wall, Crown, Right Wall (non-Face panels)
  const [isPanelMoveMode, setIsPanelMoveMode] = useState<boolean>(false);
  const [transformTargetPanel, setTransformTargetPanel] = useState<
    'left_wall' | 'crown' | 'right_wall'
  >('crown');
  const [panelMoveDrag, setPanelMoveDrag] = useState<{
    panel: 'left_wall' | 'crown' | 'right_wall';
    startSvgX: number;
    startSvgY: number;
    startOffsetX: number;
    startOffsetY: number;
    isTCanvas: boolean;
  } | null>(null);

  const activeStageTransformMode: FieldTransformStageMode =
    stage === 'joint_grouping' ? 'joint_grouping' : 'field_canvas';

  useEffect(() => {
    if (
      activePanel === 'left_wall' ||
      activePanel === 'crown' ||
      activePanel === 'right_wall'
    ) {
      setTransformTargetPanel(activePanel);
    } else if (stage === 'field_canvas') {
      setIsPanelMoveMode(false);
    }
  }, [activePanel, stage]);

  // If custom tunnel shape leaves a portion open (no wall/crown), ensure activePanel & transformTargetPanel fall back to an available panel
  useEffect(() => {
    if (!activeLocation || !activeRound) return;
    const fGeom = computePanelCanvasGeometry('face', activeLocation, activeRound);
    if (
      (activePanel === 'left_wall' && !fGeom.hasLeftWall) ||
      (activePanel === 'crown' && !fGeom.hasCrown) ||
      (activePanel === 'right_wall' && !fGeom.hasRightWall)
    ) {
      setActivePanel('face');
    }
    if (
      (transformTargetPanel === 'left_wall' && !fGeom.hasLeftWall) ||
      (transformTargetPanel === 'crown' && !fGeom.hasCrown) ||
      (transformTargetPanel === 'right_wall' && !fGeom.hasRightWall)
    ) {
      if (fGeom.hasCrown) setTransformTargetPanel('crown');
      else if (fGeom.hasLeftWall) setTransformTargetPanel('left_wall');
      else if (fGeom.hasRightWall) setTransformTargetPanel('right_wall');
    }
  }, [activeLocation, activeRound, activePanel, transformTargetPanel]);

  const updatePanelTransform = (
    panel: 'left_wall' | 'crown' | 'right_wall',
    updater: (
      prev: ReturnType<typeof getFieldPanelTransform>
    ) => ReturnType<typeof getFieldPanelTransform>
  ) => {
    const mode: FieldTransformStageMode =
      stage === 'joint_grouping' ? 'joint_grouping' : 'field_canvas';
    updateActiveRound((r) => {
      const current = getFieldPanelTransform(r, panel, mode);
      const next = updater(current);
      // Persist as Ideal Position so all rounds retain the user's preferred panel orientation/position
      saveIdealPanelTransform(panel, next, mode);
      if (mode === 'joint_grouping') {
        return {
          ...r,
          groupJointPanelTransforms: {
            ...(r.groupJointPanelTransforms || {}),
            [panel]: next,
          },
        };
      }
      return {
        ...r,
        panelTransforms: {
          ...(r.panelTransforms || {}),
          [panel]: next,
        },
      };
    });
  };

  const lockCurrentPanelAsIdealPosition = (panel: 'left_wall' | 'crown' | 'right_wall') => {
    if (!activeRound) return;
    const mode: FieldTransformStageMode =
      stage === 'joint_grouping' ? 'joint_grouping' : 'field_canvas';
    const current = getFieldPanelTransform(activeRound, panel, mode);
    saveIdealPanelTransform(panel, current, mode);
    setIsPanelMoveMode(false);
    setStore((prev) => ({
      ...prev,
      idealPanelTransforms:
        mode === 'field_canvas'
          ? { ...(prev.idealPanelTransforms || {}), [panel]: current }
          : prev.idealPanelTransforms,
      idealGroupJointPanelTransforms:
        mode === 'joint_grouping'
          ? { ...(prev.idealGroupJointPanelTransforms || {}), [panel]: current }
          : prev.idealGroupJointPanelTransforms,
      rounds: prev.rounds.map((r) =>
        mode === 'joint_grouping'
          ? {
              ...r,
              groupJointPanelTransforms: {
                ...(r.groupJointPanelTransforms || {}),
                [panel]: current,
              },
            }
          : {
              ...r,
              panelTransforms: {
                ...(r.panelTransforms || {}),
                [panel]: current,
              },
            }
      ),
    }));
  };

  // Tool 2: Vein Band vs Foliation Plane Direction sub-mode + Other / Search Vein & Foliation
  const [veinOrFoliationSubMode, setVeinOrFoliationSubMode] = useState<
    'vein_band' | 'foliation_plane'
  >('vein_band');
  const [selectedVeinRockId, setSelectedVeinRockId] = useState<string>('quartz_vein');
  const [showOtherVeinSearch, setShowOtherVeinSearch] = useState(false);
  const [veinSearchQuery, setVeinSearchQuery] = useState('');

  // Tool 5: Structural / Geological Feature type
  const [selectedGeoFeatureType, setSelectedGeoFeatureType] =
    useState<FieldStructuralFeatureType>('fault');
  // Fault & Fold structural options
  const [selectedFaultSubType, setSelectedFaultSubType] =
    useState<FieldFaultSubType>('normal');
  const [selectedFaultElementRole, setSelectedFaultElementRole] =
    useState<FieldFaultElementRole>('fault_plane');
  const [showHwFwBadges, setShowHwFwBadges] = useState<boolean>(true);
  const [selectedFoldSubType, setSelectedFoldSubType] =
    useState<FieldFoldSubType>('anticline');
  const [selectedFoldElementRole, setSelectedFoldElementRole] =
    useState<FieldFoldElementRole>('fold_axis');
  const [showFoldLimbCrestBadges, setShowFoldLimbCrestBadges] = useState<boolean>(true);

  // Lithology Custom Colour & Gradient Picker + Alternating Sedimentary/Metamorphic Bands
  const [activeColorFamilyId, setActiveColorFamilyId] = useState<string>('red');
  const [alternatingBandMode, setAlternatingBandMode] = useState<boolean>(false);
  const [alternatingRockIds, setAlternatingRockIds] = useState<string[]>([
    'sandstone',
    'shale',
  ]);
  const [alternatingSpacingPx, setAlternatingSpacingPx] = useState<number>(18);
  const [alternatingAngleDeg, setAlternatingAngleDeg] = useState<number>(() => {
    return activeRound.alternateLithologyConfig?.angleDeg ?? -22;
  });
  const [lithologyPatternAngle, setLithologyPatternAngle] = useState<number>(() => {
    return activeRound.lithologyPatternAngle ?? 0;
  });

  // Collapsible & Draggable Left and Right sidebars on Stage 4 / Stage 5 Canvas (Prioritizes Canvas on Android & Compact screens)
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return true;
    return false;
  });
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1280) return true;
    return false;
  });
  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1280) return Math.min(240, Math.max(190, Math.floor(window.innerWidth * 0.22)));
    return 264;
  });
  const [rightSidebarWidth, setRightSidebarWidth] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1280) return Math.min(250, Math.max(190, Math.floor(window.innerWidth * 0.22)));
    return 276;
  });
  const [draggingSidebarSide, setDraggingSidebarSide] = useState<'left' | 'right' | null>(null);
  const workspaceColumnsRef = useRef<HTMLDivElement | null>(null);
  const sidebarDragRef = useRef<{
    side: 'left' | 'right';
    startX: number;
    wasCollapsed: boolean;
    moved: boolean;
  } | null>(null);

  const startSidebarDrag = (side: 'left' | 'right', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sidebarDragRef.current = {
      side,
      startX: e.clientX,
      wasCollapsed: side === 'left' ? leftSidebarCollapsed : rightSidebarCollapsed,
      moved: false,
    };
    setDraggingSidebarSide(side);
  };

  useEffect(() => {
    if (!draggingSidebarSide) return;

    const handleWindowPointerMove = (ev: PointerEvent) => {
      const drag = sidebarDragRef.current;
      if (!drag) return;
      if (Math.abs(ev.clientX - drag.startX) > 4) {
        drag.moved = true;
      }
      if (!drag.moved) return;

      const containerEl = workspaceColumnsRef.current;
      const rect = containerEl?.getBoundingClientRect();
      const containerLeft = rect ? rect.left : 0;
      const containerRight = rect ? rect.right : window.innerWidth;
      const containerWidth = rect ? rect.width : window.innerWidth;
      const maxAllowedWidth = Math.max(220, Math.min(540, Math.floor(containerWidth * 0.44)));

      if (drag.side === 'left') {
        const rawLeftW = ev.clientX - containerLeft;
        if (rawLeftW < 105) {
          setLeftSidebarCollapsed(true);
        } else {
          setLeftSidebarCollapsed(false);
          setLeftSidebarWidth(Math.max(155, Math.min(maxAllowedWidth, Math.round(rawLeftW))));
        }
      } else {
        const rawRightW = containerRight - ev.clientX;
        if (rawRightW < 105) {
          setRightSidebarCollapsed(true);
        } else {
          setRightSidebarCollapsed(false);
          setRightSidebarWidth(Math.max(155, Math.min(maxAllowedWidth, Math.round(rawRightW))));
        }
      }
    };

    const handleWindowPointerUp = () => {
      const drag = sidebarDragRef.current;
      if (drag && !drag.moved) {
        if (drag.side === 'left') {
          setLeftSidebarCollapsed((prev) => {
            const next = !prev;
            if (!next && leftSidebarWidth < 160) setLeftSidebarWidth(264);
            return next;
          });
        } else {
          setRightSidebarCollapsed((prev) => {
            const next = !prev;
            if (!next && rightSidebarWidth < 160) setRightSidebarWidth(276);
            return next;
          });
        }
      }
      sidebarDragRef.current = null;
      setDraggingSidebarSide(null);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [draggingSidebarSide, leftSidebarWidth, rightSidebarWidth]);

  // Tool 6: Water Condition
  const [selectedWaterCondition, setSelectedWaterCondition] =
    useState<FieldWaterCondition>('Dripping');

  // Tool 7 / Stage 5: Active Joint Grouping Set (J1..J5, JR1, JR2, J-Bedding, J-Random, unassigned)
  const [activeGroupingSet, setActiveGroupingSet] = useState<FieldJointGroupingId>('J1');

  // Brush radius, Lithology Symbol Density, Vein/Foliation Band Size, Symbol Size & Density, Joint Pencil Size, Feature Pencil/Symbol Size & Density
  const [brushRadius, setBrushRadius] = useState<number>(36);
  const [lithologySymbolDensity, setLithologySymbolDensity] = useState<number>(85);
  const [veinBandSymbolDensity, setVeinBandSymbolDensity] = useState<number>(85);
  const [veinBandSymbolSize, setVeinBandSymbolSize] = useState<number>(100);
  const [veinBandThicknessPx, setVeinBandThicknessPx] = useState<number>(28);
  const [jointPencilSizePx, setJointPencilSizePx] = useState<number>(3.8);
  const [geoFeaturePencilSizePx, setGeoFeaturePencilSizePx] = useState<number>(4.2);
  const [geoFeatureSymbolSize, setGeoFeatureSymbolSize] = useState<number>(100);
  const [geoFeatureSymbolDensity, setGeoFeatureSymbolDensity] = useState<number>(100);
  const [pencilLineMode, setPencilLineMode] = useState<'smooth' | 'linear'>('smooth');
  const [selectedVeinBandId, setSelectedVeinBandId] = useState<string | null>(null);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedDipSurfaceId, setSelectedDipSurfaceId] = useState<string | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [is3DJointInspectorOpen, setIs3DJointInspectorOpen] = useState<boolean>(false);
  const [inspectedJointId, setInspectedJointId] = useState<string | null>(null);
  const [showPhotoUnderlay, setShowPhotoUnderlay] = useState<boolean>(true);

  // Drawing sub-tool ('pencil' | 'brush' | 'spline' | 'polyline') for ALL features other than Mark Water ('6_water_mark') & Erase ('eraser')
  type FeatureDrawSubTool = 'pencil' | 'brush' | 'spline' | 'polyline';
  const [featureDrawSubTools, setFeatureDrawSubTools] = useState<
    Record<string, FeatureDrawSubTool>
  >({
    '1_lithology': 'brush',
    '2_vein_foliation': 'pencil',
    '3_joint_trace': 'pencil',
    '4_dip_surface': 'pencil',
    '5_geo_feature': 'pencil',
  });

  const hasFourDrawSubTools =
    activeTool === '1_lithology' ||
    activeTool === '2_vein_foliation' ||
    activeTool === '3_joint_trace' ||
    activeTool === '4_dip_surface' ||
    activeTool === '5_geo_feature';

  const activeDrawSubTool: FeatureDrawSubTool = hasFourDrawSubTools
    ? featureDrawSubTools[activeTool] || (activeTool === '1_lithology' ? 'brush' : 'pencil')
    : 'brush';

  const isPencilTool =
    hasFourDrawSubTools &&
    (activeDrawSubTool === 'pencil' ||
      activeDrawSubTool === 'spline' ||
      activeDrawSubTool === 'polyline');
  const effectivePencilLineMode: 'smooth' | 'linear' =
    activeDrawSubTool === 'polyline' ? 'linear' : 'smooth';

  // Live Stagnant Compass & Inclinometer state (0..360 deg Dip Dir, 0..90 deg Dip Amt, Crown ±90°)
  const [liveDipDirection, setLiveDipDirection] = useState<number>(135);
  const [liveDipAmount, setLiveDipAmount] = useState<number>(62);
  const [liveCrownSign, setLiveCrownSign] = useState<'+90' | '-90'>('+90');

  // Undo / Redo Stacks per Round
  const [undoStack, setUndoStack] = useState<FieldCanvasSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<FieldCanvasSnapshot[]>([]);

  // Active Drawing Points inside the 1000x1000 SVG ViewBox
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<FieldPoint2D[]>([]);
  const [outlineSnapPreviewPt, setOutlineSnapPreviewPt] = useState<{
    panel: FieldPanelId;
    point: FieldPoint2D;
  } | null>(null);
  const [hoverPanelPt, setHoverPanelPt] = useState<{
    panel: FieldPanelId;
    point: FieldPoint2D;
  } | null>(null);

  // Pending resumable 2D trace (for Pencil, Spline & Polyline tools across all 5 geological features)
  const [pending2DTrace, setPending2DTrace] = useState<{
    tool: FieldCanvasTool;
    subTool?: FeatureDrawSubTool;
    panel: FieldPanelId;
    points: FieldPoint2D[];
    dipDirection: number;
    dipAmount: number;
  } | null>(null);

  const setActiveDrawSubToolForCurrentFeature = (nextSubTool: FeatureDrawSubTool) => {
    if (!hasFourDrawSubTools) return;
    if (pending2DTrace && pending2DTrace.points.length >= 2) {
      commitPending2DTraceToRound(pending2DTrace);
    } else if (pending2DTrace) {
      setPending2DTrace(null);
    }
    setFeatureDrawSubTools((prev) => ({
      ...prev,
      [activeTool]: nextSubTool,
    }));
    if (activeTool === '1_lithology' && lithologySubMode === 'erase_area') {
      setLithologySubMode('paint');
    }
    if (nextSubTool === 'polyline') {
      setPencilLineMode('linear');
    } else if (nextSubTool === 'pencil' || nextSubTool === 'spline') {
      setPencilLineMode('smooth');
    }
  };

  const renderFeatureDrawSubToolSelector = (compact = false) => {
    if (!hasFourDrawSubTools) return null;
    const subToolItems: { id: FeatureDrawSubTool; label: string; title: string }[] = [
      {
        id: 'pencil',
        label: 'Pencil',
        title: 'Pencil Tool — Freehand trace (snaps cleanly to exact tunnel outline)',
      },
      {
        id: 'brush',
        label: 'Brush',
        title: 'Brush Tool — Paint stroke/surface using Brush Size',
      },
      {
        id: 'spline',
        label: 'Spline',
        title: 'Spline Tool — Click points or drag to form a smooth curved spline trace from exact outline',
      },
      {
        id: 'polyline',
        label: 'Polyline',
        title: 'Polyline Tool — Click vertices or drag straight segments from exact outline',
      },
    ];
    return (
      <div
        className={
          compact
            ? 'inline-flex items-center rounded-lg bg-slate-950 p-0.5 border border-amber-500/40 gap-0.5'
            : 'grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-xl border border-amber-500/40'
        }
      >
        {subToolItems.map((item) => {
          const isSel =
            activeDrawSubTool === item.id &&
            !(activeTool === '1_lithology' && lithologySubMode === 'erase_area');
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveDrawSubToolForCurrentFeature(item.id)}
              title={item.title}
              className={`${
                compact ? 'px-2 py-0.5 text-[10px]' : 'py-1 px-1 text-[10px]'
              } rounded-lg font-black flex items-center justify-center gap-1 transition-all cursor-pointer ${
                isSel
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              {item.id === 'pencil' && <Pencil className="w-3 h-3 shrink-0" />}
              {item.id === 'brush' && <Paintbrush className="w-3 h-3 shrink-0" />}
              {item.id === 'spline' && (
                <svg
                  viewBox="0 0 24 24"
                  className="w-3 h-3 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                >
                  <path d="M3 18C7 6 17 18 21 6" />
                  <circle cx="3" cy="18" r="2" fill="currentColor" />
                  <circle cx="12" cy="12" r="2" fill="currentColor" />
                  <circle cx="21" cy="6" r="2" fill="currentColor" />
                </svg>
              )}
              {item.id === 'polyline' && (
                <svg
                  viewBox="0 0 24 24"
                  className="w-3 h-3 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 18 9 8 15 15 21 6" />
                  <circle cx="3" cy="18" r="2" fill="currentColor" />
                  <circle cx="9" cy="8" r="2" fill="currentColor" />
                  <circle cx="15" cy="15" r="2" fill="currentColor" />
                  <circle cx="21" cy="6" r="2" fill="currentColor" />
                </svg>
              )}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    if (!isPencilTool && pending2DTrace) {
      if (pending2DTrace.points.length >= 2) {
        commitPending2DTraceToRound(pending2DTrace);
      } else {
        setPending2DTrace(null);
      }
    }
  }, [isPencilTool]);
  // Pointer start screen-space tracker
  const pointerStartClientRef = useRef<{ x: number; y: number; movedEnough: boolean } | null>(
    null
  );
  // Stage 1 Project Settings & Chainage From-To Grouping state
  const [showProjectSettingsBox, setShowProjectSettingsBox] = useState<boolean>(false);
  const [chainageGroupIntervalM, setChainageGroupIntervalM] = useState<number>(25);
  const [selectedChainageBucket, setSelectedChainageBucket] = useState<string>('ALL');
  const [roundFilterQuery, setRoundFilterQuery] = useState<string>('');
  const [pendingDeleteConfirm, setPendingDeleteConfirm] = useState<{
    kind: 'project' | 'location' | 'round';
    id: string;
    label: string;
  } | null>(null);

  const handleConfirmDeleteItem = () => {
    if (!pendingDeleteConfirm) return;
    const { kind, id } = pendingDeleteConfirm;
    setStore((prev) => {
      if (kind === 'project') {
        const nextProjects = prev.projects.filter((p) => p.id !== id);
        const nextRounds = prev.rounds.filter((r) => r.projectId !== id);
        const nextProj =
          prev.activeProjectId === id
            ? nextProjects[0] || null
            : nextProjects.find((p) => p.id === prev.activeProjectId) || nextProjects[0] || null;
        const nextLocId =
          prev.activeProjectId === id
            ? nextProj?.locations[0]?.id || null
            : prev.activeLocationId;
        const nextRoundId =
          nextRounds.find(
            (r) => r.projectId === nextProj?.id && r.locationId === nextLocId
          )?.id || null;
        return {
          ...prev,
          projects: nextProjects,
          rounds: nextRounds,
          activeProjectId: nextProj?.id || null,
          activeLocationId: nextLocId,
          activeRoundId: nextRoundId,
        };
      }
      if (kind === 'location') {
        const nextProjects = prev.projects.map((p) =>
          p.id === prev.activeProjectId
            ? { ...p, locations: p.locations.filter((l) => l.id !== id) }
            : p
        );
        const nextRounds = prev.rounds.filter((r) => r.locationId !== id);
        const currentProj = nextProjects.find((p) => p.id === prev.activeProjectId) || null;
        const nextLocId =
          prev.activeLocationId === id
            ? currentProj?.locations[0]?.id || null
            : prev.activeLocationId;
        const nextRoundId =
          nextRounds.find(
            (r) => r.projectId === currentProj?.id && r.locationId === nextLocId
          )?.id || null;
        return {
          ...prev,
          projects: nextProjects,
          rounds: nextRounds,
          activeLocationId: nextLocId,
          activeRoundId: nextRoundId,
        };
      }
      // kind === 'round'
      const nextRounds = prev.rounds.filter((r) => r.id !== id);
      const nextRoundId =
        prev.activeRoundId === id
          ? nextRounds.find(
              (r) =>
                r.projectId === prev.activeProjectId &&
                r.locationId === prev.activeLocationId
            )?.id || null
          : prev.activeRoundId;
      return {
        ...prev,
        rounds: nextRounds,
        activeRoundId: nextRoundId,
      };
    });
    setPendingDeleteConfirm(null);
  };

  const canvasSvgRef = useRef<SVGSVGElement | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);

  // Multi-touch 2-finger pinch-to-zoom & 2-finger pan state refs
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const isPinchingRef = useRef<boolean>(false);
  const pinchStateRef = useRef<{
    startDist: number;
    startMidX: number;
    startMidY: number;
    startZoom: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  // Non-passive PC mouse wheel scroll & laptop trackpad pinch-zoom listener anchored at cursor
  useEffect(() => {
    const el = canvasWrapperRef.current;
    if (!el) return;
    const onWheelNonPassive = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const svg = canvasSvgRef.current;
      const rect = (svg || el).getBoundingClientRect();
      const factor = e.ctrlKey
        ? Math.exp(-e.deltaY * 0.014)
        : e.deltaY < 0
        ? 1.15
        : 1 / 1.15;

      setCanvasZoom((prevZoom) => {
        // Infinite zoom in and out: down to 0.02 (super macro) and up to 250.0 (micro-crack detail)
        const nextZoom = Math.max(0.02, Math.min(250.0, Number((prevZoom * factor).toFixed(4))));
        const normX = (e.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
        const normY = (e.clientY - rect.top) / Math.max(1, rect.height) - 0.5;
        const shiftX = normX * (1000 / prevZoom - 1000 / nextZoom);
        const shiftY = normY * (1000 / prevZoom - 1000 / nextZoom);
        const maxOffset = Math.max(1500, (5000 / nextZoom) + 3000);
        setCanvasPan((prevPan) => ({
          x: Math.max(-maxOffset, Math.min(maxOffset, prevPan.x + shiftX)),
          y: Math.max(-maxOffset, Math.min(maxOffset, prevPan.y + shiftY)),
        }));
        return nextZoom;
      });
    };
    el.addEventListener('wheel', onWheelNonPassive, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNonPassive);
  }, [stage]);

  // Update helpers
  const updateActiveProject = (updater: (prev: FieldProjectItem) => FieldProjectItem) => {
    if (!activeProject) return;
    setStore((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === activeProject.id ? updater(p) : p)),
    }));
  };

  const activeRoundRef = useRef(activeRound);
  activeRoundRef.current = activeRound;

  const updateActiveRound = React.useCallback(
    (updater: (prev: FieldExcavationRound) => FieldExcavationRound) => {
      const currentRoundId = activeRoundRef.current?.id;
      if (!currentRoundId) return;
      setStore((prev) => ({
        ...prev,
        rounds: prev.rounds.map((r) => {
          if (r.id !== currentRoundId) return r;
          const updated = updater(r);
          return {
            ...updated,
            updatedAt: new Date().toISOString(),
            discontinuitySets: autoComputeOrientationFromPlot(
              updated.jointTraces,
              updated.dipPlaneSurfaces,
              updated.discontinuitySets
            ),
          };
        }),
      }));
    },
    []
  );

  const pushUndoSnapshot = React.useCallback(() => {
    const r = activeRoundRef.current;
    if (!r) return;
    const snap: FieldCanvasSnapshot = {
      lithologyStrokes: r.lithologyStrokes,
      jointTraces: r.jointTraces,
      dipPlaneSurfaces: r.dipPlaneSurfaces,
      structuralFeatures: r.structuralFeatures || [],
      waterMarks: r.waterMarks,
    };
    setUndoStack((prev) => [...prev.slice(-29), snap]);
    setRedoStack([]);
  }, []);

  const handleSelectTraceId3D = React.useCallback((id: string | null, panel?: FieldPanelId) => {
    setSelectedTraceId(id);
    if (panel) setActivePanel(panel);
    const tr = activeRoundRef.current?.jointTraces.find((t) => t.id === id);
    if (tr) {
      setLiveDipDirection(tr.dipDirection);
      setLiveDipAmount(tr.dipAmount);
    }
  }, []);

  const handleSetLiveOrientation3D = React.useCallback((dipDir: number, dipAmt: number) => {
    setLiveDipDirection(dipDir);
    setLiveDipAmount(dipAmt);
  }, []);

  const handleUndo = () => {
    if (!activeRound || undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    const currentSnap: FieldCanvasSnapshot = {
      lithologyStrokes: activeRound.lithologyStrokes,
      jointTraces: activeRound.jointTraces,
      dipPlaneSurfaces: activeRound.dipPlaneSurfaces,
      structuralFeatures: activeRound.structuralFeatures || [],
      waterMarks: activeRound.waterMarks,
    };
    setRedoStack((prev) => [...prev, currentSnap]);
    setUndoStack((prev) => prev.slice(0, -1));
    updateActiveRound((r) => ({
      ...r,
      lithologyStrokes: last.lithologyStrokes,
      jointTraces: last.jointTraces,
      dipPlaneSurfaces: last.dipPlaneSurfaces,
      structuralFeatures: last.structuralFeatures,
      waterMarks: last.waterMarks,
    }));
  };

  const handleRedo = () => {
    if (!activeRound || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    const currentSnap: FieldCanvasSnapshot = {
      lithologyStrokes: activeRound.lithologyStrokes,
      jointTraces: activeRound.jointTraces,
      dipPlaneSurfaces: activeRound.dipPlaneSurfaces,
      structuralFeatures: activeRound.structuralFeatures || [],
      waterMarks: activeRound.waterMarks,
    };
    setUndoStack((prev) => [...prev, currentSnap]);
    setRedoStack((prev) => prev.slice(0, -1));
    updateActiveRound((r) => ({
      ...r,
      lithologyStrokes: next.lithologyStrokes,
      jointTraces: next.jointTraces,
      dipPlaneSurfaces: next.dipPlaneSurfaces,
      structuralFeatures: next.structuralFeatures,
      waterMarks: next.waterMarks,
    }));
  };

  /**
   * EXACT SVG MATRIX COORDINATE LOCATOR:
   * Uses `svg.createSVGPoint()` and `svg.getScreenCTM().inverse()` so touch/stylus/mouse coordinates
   * map with 100% sub-pixel accuracy inside the `0 0 1000 1000` viewBox regardless of aspect ratio or zoom!
   */
  const getNormalizedCanvasPoint = (e: React.PointerEvent<SVGSVGElement>): FieldPoint2D => {
    const svg = (e.currentTarget as SVGSVGElement) || canvasSvgRef.current;
    if (!svg) return { x: 500, y: 500 };

    const ctm = svg.getScreenCTM();
    if (ctm) {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const transformed = pt.matrixTransform(ctm.inverse());
      return {
        x: Math.max(2, Math.min(998, Number(transformed.x.toFixed(1)))),
        y: Math.max(2, Math.min(998, Number(transformed.y.toFixed(1)))),
      };
    }

    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 1000;
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 1000;
    return {
      x: Math.max(2, Math.min(998, Number(x.toFixed(1)))),
      y: Math.max(2, Math.min(998, Number(y.toFixed(1)))),
    };
  };

  // Helper: Shortest distance from point P to segment AB
  const distToSegment = (p: FieldPoint2D, a: FieldPoint2D, b: FieldPoint2D): number => {
    const l2 = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
    if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
  };

  // Automatically prune any lithology strokes that have been completely erased on the canvas
  useEffect(() => {
    if (!activeRound || !activeRound.lithologyStrokes || activeRound.lithologyStrokes.length === 0) {
      return;
    }
    const pruned = pruneFullyErasedLithologyStrokes(activeRound.lithologyStrokes);
    if (pruned.length !== activeRound.lithologyStrokes.length) {
      updateActiveRound((r) => ({
        ...r,
        lithologyStrokes: pruneFullyErasedLithologyStrokes(r.lithologyStrokes),
      }));
    }
  }, [activeRound?.id, activeRound?.lithologyStrokes]);

  // Eraser at point: Erases Joint Traces, Vein/Foliation Bands, Dip Surfaces, Structural Features & Water Marks,
  // and if no overlay feature is hit at that point, also erases Rock Lithology ('region_fill') strokes!
  const eraseNearPoint = (pt: FieldPoint2D, targetPanel: FieldPanelId = activePanel) => {
    if (!activeRound) return;
    const hitRadius = Math.max(28, brushRadius);
    const nearPointsOrSegments = (pts: FieldPoint2D[], extraRadius = 0) => {
      if (!pts || pts.length === 0) return false;
      const r = hitRadius + extraRadius;
      if (pts.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) <= r)) return true;
      for (let i = 0; i < pts.length - 1; i++) {
        if (distToSegment(pt, pts[i], pts[i + 1]) <= r) return true;
      }
      return false;
    };

    updateActiveRound((r) => {
      const nextTraces = r.jointTraces.filter(
        (t) => t.panel !== targetPanel || !nearPointsOrSegments(t.points, 6)
      );
      const nextDipSurfaces = r.dipPlaneSurfaces.filter(
        (d) =>
          d.panel !== targetPanel ||
          !nearPointsOrSegments(
            d.outlinePolygon?.length ? d.outlinePolygon : d.points,
            d.brushRadius * 0.5
          )
      );
      const nextFeatures = (r.structuralFeatures || []).filter(
        (f) => f.panel !== targetPanel || !nearPointsOrSegments(f.points, 8)
      );
      const nextWater = r.waterMarks.filter(
        (w) => w.panel !== targetPanel || !nearPointsOrSegments(w.points, 12)
      );
      const hitOverlay =
        nextTraces.length !== r.jointTraces.length ||
        nextDipSurfaces.length !== r.dipPlaneSurfaces.length ||
        nextFeatures.length !== (r.structuralFeatures || []).length ||
        nextWater.length !== r.waterMarks.length ||
        r.lithologyStrokes.some(
          (s) =>
            s.panel === targetPanel &&
            (s.mode === 'vein_band' || s.mode === 'foliation_plane') &&
            nearPointsOrSegments(s.points, s.brushRadius * 0.4)
        );

      const filteredLith = r.lithologyStrokes.filter((s) => {
        if (s.panel !== targetPanel) return true;
        if (s.mode === 'vein_band' || s.mode === 'foliation_plane') {
          return !nearPointsOrSegments(s.points, s.brushRadius * 0.4);
        }
        if (s.mode === 'region_fill' && !hitOverlay) {
          return !nearPointsOrSegments(s.points, s.brushRadius * 0.65);
        }
        return true;
      });

      return {
        ...r,
        lithologyStrokes: pruneFullyErasedLithologyStrokes(filteredLith),
        jointTraces: nextTraces,
        dipPlaneSurfaces: nextDipSurfaces,
        structuralFeatures: nextFeatures,
        waterMarks: nextWater,
      };
    });
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!activeRound) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // 2-Finger Touch Pinch-to-Zoom & 2-Finger Pan
    if (activePointersRef.current.size >= 2) {
      isPinchingRef.current = true;
      setIsDrawing(false);
      setCurrentPoints([]);
      setPanDragOrigin(null);
      const pts = Array.from(activePointersRef.current.values());
      const p1 = pts[0];
      const p2 = pts[1];
      const startDist = Math.max(12, Math.hypot(p2.x - p1.x, p2.y - p1.y));
      const startMidX = (p1.x + p2.x) / 2;
      const startMidY = (p1.y + p2.y) / 2;
      pinchStateRef.current = {
        startDist,
        startMidX,
        startMidY,
        startZoom: canvasZoom,
        startPanX: canvasPan.x,
        startPanY: canvasPan.y,
      };
      return;
    }

    if (isCanvasPanMode || e.button === 1) {
      setPanDragOrigin({
        clientX: e.clientX,
        clientY: e.clientY,
        startPanX: canvasPan.x,
        startPanY: canvasPan.y,
      });
      return;
    }

    const rawPt = getNormalizedCanvasPoint(e);
    if (!activeLocation) return;

    // Handle Panel Move Mode for Left Wall, Crown, Right Wall (excludes Face)
    const canMovePanel =
      isPanelMoveMode && (stage === 'joint_grouping' || activePanel !== 'face');
    if (canMovePanel) {
      let moveTarget: 'left_wall' | 'crown' | 'right_wall' =
        activePanel !== 'face' ? activePanel : transformTargetPanel;
      if (canvasViewMode === 'unfolded_t') {
        const hit = resolveTCanvasPanelAtPoint(rawPt, activeLocation, activeRound, 14);
        if (hit && hit !== 'face') {
          moveTarget = hit;
          setActivePanel(hit);
          setTransformTargetPanel(hit);
        }
      }
      const curTr = getFieldPanelTransform(activeRound, moveTarget, activeStageTransformMode);
      setPanelMoveDrag({
        panel: moveTarget,
        startSvgX: rawPt.x,
        startSvgY: rawPt.y,
        startOffsetX: canvasViewMode === 'unfolded_t' ? curTr.tOffsetX : curTr.offsetX,
        startOffsetY: canvasViewMode === 'unfolded_t' ? curTr.tOffsetY : curTr.offsetY,
        isTCanvas: canvasViewMode === 'unfolded_t',
      });
      return;
    }

    let targetPanel: FieldPanelId = activePanel;
    let panelSpacePt: FieldPoint2D = rawPt;

    if (canvasViewMode === 'unfolded_t') {
      const hitPanel = resolveTCanvasPanelAtPoint(rawPt, activeLocation, activeRound, 36);
      if (!hitPanel) {
        return;
      }
      targetPanel = hitPanel;
      drawingPanelRef.current = hitPanel;
      if (activePanel !== hitPanel) {
        setActivePanel(hitPanel);
      }
      if (hitPanel !== 'face') {
        setTransformTargetPanel(hitPanel);
      }
      panelSpacePt = tCanvasPointToPanelPoint(rawPt, hitPanel, activeLocation, activeRound);

      // In Stage 5 (Group Joints), tapping or brushing near any Joint Trace or Dip Surface assigns it to activeGroupingSet
      if (stage === 'joint_grouping') {
        const hitRadius = 30;
        const isNearPolyline = (pts: FieldPoint2D[], tol: number) => {
          if (!pts || pts.length === 0) return false;
          if (pts.some((p) => Math.hypot(p.x - panelSpacePt.x, p.y - panelSpacePt.y) <= tol)) {
            return true;
          }
          for (let i = 0; i < pts.length - 1; i++) {
            if (distToSegment(panelSpacePt, pts[i], pts[i + 1]) <= tol) {
              return true;
            }
          }
          return false;
        };

        const nearTrace = activeRound.jointTraces.find(
          (tr) => tr.panel === hitPanel && isNearPolyline(tr.points, hitRadius)
        );
        if (nearTrace) {
          setSelectedTraceId(nearTrace.id);
          setSelectedDipSurfaceId(null);
          setLiveDipDirection(nearTrace.dipDirection);
          setLiveDipAmount(nearTrace.dipAmount);
          if (nearTrace.setId !== activeGroupingSet) {
            pushUndoSnapshot();
            updateActiveRound((r) => ({
              ...r,
              jointTraces: r.jointTraces.map((t) =>
                t.id === nearTrace.id
                  ? {
                      ...t,
                      setId: activeGroupingSet,
                      label: activeGroupingSet === 'unassigned' ? 'J' : activeGroupingSet,
                    }
                  : t
              ),
            }));
          }
          return;
        }

        const nearDipSurf = activeRound.dipPlaneSurfaces.find(
          (ds) =>
            ds.panel === hitPanel &&
            isNearPolyline(
              ds.outlinePolygon?.length ? ds.outlinePolygon : ds.points,
              hitRadius + 14
            )
        );
        if (nearDipSurf) {
          setSelectedDipSurfaceId(nearDipSurf.id);
          setSelectedTraceId(null);
          setLiveDipDirection(nearDipSurf.dipDirection);
          setLiveDipAmount(nearDipSurf.dipAmount);
          if (nearDipSurf.setId !== activeGroupingSet) {
            pushUndoSnapshot();
            updateActiveRound((r) => ({
              ...r,
              dipPlaneSurfaces: r.dipPlaneSurfaces.map((d) =>
                d.id === nearDipSurf.id ? { ...d, setId: activeGroupingSet } : d
              ),
            }));
          }
          return;
        }
        return;
      }
    } else {
      drawingPanelRef.current = activePanel;
      const dispGeom = computeDisplayPanelGeometry(
        activePanel,
        activeLocation,
        activeRound,
        activeStageTransformMode
      );
      // Generous 52px outer catch zone around the tunnel outline so starting near the outline
      // (inside or slightly outside) always captures the stroke and snaps to the exact outline!
      const catchPad = 52;
      if (
        rawPt.x < dispGeom.boxX - catchPad ||
        rawPt.x > dispGeom.boxX + dispGeom.boxW + catchPad ||
        rawPt.y < dispGeom.boxY - catchPad ||
        rawPt.y > dispGeom.boxY + dispGeom.boxH + catchPad
      ) {
        return;
      }
      if (activePanel !== 'face') {
        const canonGeom = computePanelCanvasGeometry(activePanel, activeLocation, activeRound);
        panelSpacePt = mapUnfoldedBoxPointToPanel(
          rawPt,
          activePanel,
          canonGeom,
          { x: dispGeom.boxX, y: dispGeom.boxY, w: dispGeom.boxW, h: dispGeom.boxH },
          activeRound,
          activeStageTransformMode
        );
      }
      if (
        !isPointInsideFieldPanelOutline(
          panelSpacePt,
          activePanel,
          activeLocation,
          activeRound,
          catchPad
        )
      ) {
        return;
      }
    }

    // Snap start point to the exact tunnel outline when starting near the outline (within 30 SVG units inside or 52 outside)
    const shouldSnapOutline =
      activeTool !== 'eraser' &&
      activeTool !== '6_water_mark' &&
      (activeDrawSubTool === 'pencil' ||
        activeDrawSubTool === 'spline' ||
        activeDrawSubTool === 'polyline');
    const snapResult = shouldSnapOutline
      ? snapPointToExactFieldPanelOutline(
          panelSpacePt,
          targetPanel,
          activeLocation,
          activeRound,
          30
        )
      : {
          point: clampPointToFieldPanelOutline(
            panelSpacePt,
            targetPanel,
            activeLocation,
            activeRound,
            0
          ),
          snapped: false,
        };
    const pt = snapResult.point;
    if (snapResult.snapped) {
      setOutlineSnapPreviewPt({ panel: targetPanel, point: pt });
    } else {
      setOutlineSnapPreviewPt(null);
    }

    if (activeTool === 'eraser') {
      pushUndoSnapshot();
      setIsDrawing(true);
      eraseNearPoint(pt, targetPanel);
      return;
    }

    // If switching panels or tools while a pending 2D trace exists, commit it first
    if (
      pending2DTrace &&
      (pending2DTrace.panel !== targetPanel ||
        pending2DTrace.tool !== activeTool ||
        (pending2DTrace.subTool && pending2DTrace.subTool !== activeDrawSubTool))
    ) {
      if (pending2DTrace.points.length >= 2) {
        commitPending2DTraceToRound(pending2DTrace);
      }
      setPending2DTrace(null);
    }

    pointerStartClientRef.current = {
      x: e.clientX,
      y: e.clientY,
      movedEnough: true,
    };
    setIsDrawing(true);
    setCurrentPoints([pt]);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Handle 2-Finger Touch Pinch-to-Zoom & 2-Finger Pan
    if (activePointersRef.current.size >= 2 && pinchStateRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const p1 = pts[0];
      const p2 = pts[1];
      const currDist = Math.max(12, Math.hypot(p2.x - p1.x, p2.y - p1.y));
      const currMidX = (p1.x + p2.x) / 2;
      const currMidY = (p1.y + p2.y) / 2;
      const ps = pinchStateRef.current;

      const scaleRatio = currDist / ps.startDist;
      // Infinite zoom with touch fingers: down to 0.02 and up to 250.0
      const nextZoom = Math.max(0.02, Math.min(250.0, Number((ps.startZoom * scaleRatio).toFixed(4))));
      const svg = canvasSvgRef.current;
      const rect = svg?.getBoundingClientRect();
      const viewSpan = 1000 / Math.max(0.02, nextZoom);
      const scaleX = viewSpan / Math.max(1, rect?.width || 600);
      const scaleY = viewSpan / Math.max(1, rect?.height || 600);

      const panDx = (ps.startMidX - currMidX) * scaleX;
      const panDy = (ps.startMidY - currMidY) * scaleY;
      const normMidX = rect ? (ps.startMidX - rect.left) / Math.max(1, rect.width) - 0.5 : 0;
      const normMidY = rect ? (ps.startMidY - rect.top) / Math.max(1, rect.height) - 0.5 : 0;
      const zoomShiftX = normMidX * (1000 / ps.startZoom - 1000 / nextZoom);
      const zoomShiftY = normMidY * (1000 / ps.startZoom - 1000 / nextZoom);

      const maxOffset = Math.max(1500, (5000 / nextZoom) + 3000);
      setCanvasZoom(nextZoom);
      setCanvasPan({
        x: Math.max(-maxOffset, Math.min(maxOffset, ps.startPanX + zoomShiftX + panDx)),
        y: Math.max(-maxOffset, Math.min(maxOffset, ps.startPanY + zoomShiftY + panDy)),
      });
      return;
    }

    if (isPinchingRef.current) return;

    if (panDragOrigin) {
      const svg = canvasSvgRef.current;
      const rect = svg?.getBoundingClientRect();
      const viewSpan = 1000 / Math.max(0.02, canvasZoom);
      const scaleX = viewSpan / Math.max(1, rect?.width || 600);
      const scaleY = viewSpan / Math.max(1, rect?.height || 600);
      const dx = (panDragOrigin.clientX - e.clientX) * scaleX;
      const dy = (panDragOrigin.clientY - e.clientY) * scaleY;
      const maxOffset = Math.max(1500, (5000 / Math.max(0.02, canvasZoom)) + 3000);
      setCanvasPan({
        x: Math.max(-maxOffset, Math.min(maxOffset, panDragOrigin.startPanX + dx)),
        y: Math.max(-maxOffset, Math.min(maxOffset, panDragOrigin.startPanY + dy)),
      });
      return;
    }

    if (panelMoveDrag) {
      const rawPt = getNormalizedCanvasPoint(e);
      const dx = Number((rawPt.x - panelMoveDrag.startSvgX).toFixed(1));
      const dy = Number((rawPt.y - panelMoveDrag.startSvgY).toFixed(1));
      updatePanelTransform(panelMoveDrag.panel, (prev) =>
        panelMoveDrag.isTCanvas
          ? {
              ...prev,
              tOffsetX: Number(
                Math.max(-360, Math.min(360, panelMoveDrag.startOffsetX + dx)).toFixed(1)
              ),
              tOffsetY: Number(
                Math.max(-320, Math.min(320, panelMoveDrag.startOffsetY + dy)).toFixed(1)
              ),
            }
          : {
              ...prev,
              offsetX: Number(
                Math.max(-360, Math.min(360, panelMoveDrag.startOffsetX + dx)).toFixed(1)
              ),
              offsetY: Number(
                Math.max(-320, Math.min(320, panelMoveDrag.startOffsetY + dy)).toFixed(1)
              ),
            }
      );
      return;
    }

    if (!activeLocation || !activeRound) return;
    const rawPt = getNormalizedCanvasPoint(e);
    // Cursor coordinate tracking disabled per user preference
    const hoverTargetPanel =
      canvasViewMode === 'unfolded_t'
        ? isDrawing
          ? drawingPanelRef.current
          : resolveTCanvasPanelAtPoint(rawPt, activeLocation, activeRound, 36) || activePanel
        : activePanel;
    const panelSpacePt =
      canvasViewMode === 'unfolded_t'
        ? tCanvasPointToPanelPoint(rawPt, hoverTargetPanel, activeLocation, activeRound)
        : hoverTargetPanel !== 'face'
        ? (() => {
            const canonGeom = computePanelCanvasGeometry(
              hoverTargetPanel,
              activeLocation,
              activeRound
            );
            const dispGeom = computeDisplayPanelGeometry(
              hoverTargetPanel,
              activeLocation,
              activeRound,
              activeStageTransformMode
            );
            return mapUnfoldedBoxPointToPanel(
              rawPt,
              hoverTargetPanel,
              canonGeom,
              { x: dispGeom.boxX, y: dispGeom.boxY, w: dispGeom.boxW, h: dispGeom.boxH },
              activeRound,
              activeStageTransformMode
            );
          })()
        : rawPt;

    // Only update hoverPanelPt when actively previewing a multi-click Spline or Polyline trace!
    // Eliminates 60fps full-workspace React re-renders when simply moving the mouse over the 2D canvas.
    if (
      !isDrawing &&
      stage === 'field_canvas' &&
      pending2DTrace &&
      pending2DTrace.panel === hoverTargetPanel &&
      (activeDrawSubTool === 'spline' || activeDrawSubTool === 'polyline') &&
      isPointInsideFieldPanelOutline(panelSpacePt, hoverTargetPanel, activeLocation, activeRound, 48)
    ) {
      const snapCheck = snapPointToExactFieldPanelOutline(
        panelSpacePt,
        hoverTargetPanel,
        activeLocation,
        activeRound,
        28
      );
      setHoverPanelPt({
        panel: hoverTargetPanel,
        point: snapCheck.snapped
          ? snapCheck.point
          : clampPointToFieldPanelOutline(
              panelSpacePt,
              hoverTargetPanel,
              activeLocation,
              activeRound,
              0
            ),
      });
    } else if (!isDrawing && hoverPanelPt) {
      setHoverPanelPt(null);
    }

    if (!isDrawing) return;
    const targetPanel = canvasViewMode === 'unfolded_t' ? drawingPanelRef.current : activePanel;

    const isInside = isPointInsideFieldPanelOutline(
      panelSpacePt,
      targetPanel,
      activeLocation,
      activeRound,
      0
    );

    if (activeTool === 'eraser') {
      if (isInside) {
        eraseNearPoint(
          clampPointToFieldPanelOutline(panelSpacePt, targetPanel, activeLocation, activeRound, 0),
          targetPanel
        );
      }
      return;
    }

    const last = currentPoints[currentPoints.length - 1];
    let pt: FieldPoint2D;
    if (isInside) {
      pt = clampPointToFieldPanelOutline(panelSpacePt, targetPanel, activeLocation, activeRound, 0);
    } else if (last) {
      // Clip stroke cleanly right where it crosses the exact tunnel outline boundary
      pt = clipSegmentToFieldPanelOutline(
        last,
        panelSpacePt,
        targetPanel,
        activeLocation,
        activeRound,
        0
      );
    } else {
      return;
    }

    if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 1.5) return;

    const nextPts = [...currentPoints, pt];
    setCurrentPoints(nextPts);

    // Real-time accurate Dip Direction & Dip Amount calculation
    if (
      activeRound &&
      nextPts.length >= 2 &&
      (activeTool === '3_joint_trace' ||
        activeTool === '2_vein_foliation' ||
        activeTool === '5_geo_feature' ||
        activeTool === '4_dip_surface')
    ) {
      const combinedPts =
        pending2DTrace &&
        pending2DTrace.tool === activeTool &&
        pending2DTrace.panel === targetPanel
          ? [...pending2DTrace.points, ...nextPts]
          : nextPts;
      const chord = Math.hypot(
        combinedPts[combinedPts.length - 1].x - combinedPts[0].x,
        combinedPts[combinedPts.length - 1].y - combinedPts[0].y
      );
      if (chord >= 4) {
        const liveEst = estimateTraceOrientationFromGeometry(
          combinedPts,
          targetPanel,
          activeRound.tunnelDriveDirection,
          liveCrownSign,
          activeLocation?.widthM || 8.4,
          activeLocation?.heightM || 7.2
        );
        setLiveDipDirection(liveEst.dipDirection);
        setLiveDipAmount(liveEst.dipAmount);
      }
    }
  };

  // Shapes a trace according to its subTool ('pencil' | 'spline' | 'polyline') and snaps start/end points to exact outline if near
  const shapeTracePointsForSubTool = (
    rawPts: FieldPoint2D[],
    subTool: FeatureDrawSubTool,
    targetPanel: FieldPanelId
  ): FieldPoint2D[] => {
    if (!activeLocation || !activeRound || rawPts.length === 0) return rawPts;
    const clamped = rawPts.map((p) =>
      clampPointToFieldPanelOutline(p, targetPanel, activeLocation, activeRound, 0)
    );
    const startSnap = snapPointToExactFieldPanelOutline(
      clamped[0],
      targetPanel,
      activeLocation,
      activeRound,
      30
    );
    const endSnap = snapPointToExactFieldPanelOutline(
      clamped[clamped.length - 1],
      targetPanel,
      activeLocation,
      activeRound,
      30
    );
    const anchored = [...clamped];
    anchored[0] = startSnap.point;
    anchored[anchored.length - 1] = endSnap.point;

    if (anchored.length < 2) return anchored;

    if (subTool === 'polyline') {
      return anchored;
    }
    if (subTool === 'spline') {
      const splined = interpolateCatmullRomSpline(anchored, 10).map((p) =>
        clampPointToFieldPanelOutline(p, targetPanel, activeLocation, activeRound, 0)
      );
      if (splined.length >= 2) {
        splined[0] = startSnap.point;
        splined[splined.length - 1] = endSnap.point;
      }
      return splined;
    }
    // 'pencil'
    const smoothed = smoothFieldTracePoints(anchored).map((p) =>
      clampPointToFieldPanelOutline(p, targetPanel, activeLocation, activeRound, 0)
    );
    if (smoothed.length >= 2) {
      smoothed[0] = startSnap.point;
      smoothed[smoothed.length - 1] = endSnap.point;
    }
    return smoothed;
  };

  // Commit a resumable 2D trace (Pencil, Spline, or Polyline) when the user clicks "✓ Confirm" or switches tools
  const commitPending2DTraceToRound = (
    pendingItem = pending2DTrace
  ) => {
    if (!pendingItem || !activeRound || !activeLocation) return;
    const {
      tool: pTool,
      subTool: pSubTool = activeDrawSubTool,
      panel: targetPanel,
      points: rawPendingPts,
    } = pendingItem;
    if (rawPendingPts.length < 2) {
      setPending2DTrace(null);
      return;
    }
    const clampAllToOutline = (ptsArr: FieldPoint2D[]) =>
      ptsArr.map((p) =>
        clampPointToFieldPanelOutline(p, targetPanel, activeLocation, activeRound, 0)
      );

    const effectiveToolLineMode: 'smooth' | 'linear' =
      pSubTool === 'polyline' ? 'linear' : 'smooth';
    const shapedPts = shapeTracePointsForSubTool(rawPendingPts, pSubTool, targetPanel);

    const est = estimateTraceOrientationFromGeometry(
      shapedPts,
      targetPanel,
      activeRound.tunnelDriveDirection,
      liveCrownSign,
      activeLocation.widthM,
      activeLocation.heightM
    );
    setLiveDipDirection(est.dipDirection);
    setLiveDipAmount(est.dipAmount);
    pushUndoSnapshot();

    if (pTool === '1_lithology') {
      const rockInfo = resolveRockDisplayInfo(selectedRockType, store.rememberedRocks);
      const customRockColor = (activeRound.rockCustomColors || {})[selectedRockType];
      const isAltBands = alternatingBandMode && alternatingRockIds.length >= 2;
      const altNames = isAltBands
        ? alternatingRockIds.map(
            (rid) => resolveRockDisplayInfo(rid, store.rememberedRocks).name
          )
        : undefined;
      const currentDensity =
        activeRound.lithologyDensityByRock?.[selectedRockType] ??
        activeRound.lithologyDensityByRock?.[rockInfo.patternId] ??
        activeRound.lithologySymbolDensity ??
        lithologySymbolDensity;
      const currentRockAngle =
        activeRound.lithologyAngleByRock?.[selectedRockType] ??
        activeRound.lithologyAngleByRock?.[rockInfo.patternId] ??
        activeRound.lithologyPatternAngle ??
        lithologyPatternAngle ??
        0;
      const stroke: FieldLithologyStroke = {
        id: `lith-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        panel: targetPanel,
        rockType: selectedRockType,
        rockName: isAltBands ? altNames!.join(' / ') : rockInfo.name,
        rockCode: rockInfo.code,
        color: customRockColor || rockInfo.color,
        fillColor: customRockColor || rockInfo.fillColor,
        customColor: customRockColor,
        patternId: rockInfo.patternId,
        patternAngleDeg: currentRockAngle,
        mode: 'region_fill',
        points: shapedPts,
        brushRadius,
        symbolDensity: currentDensity,
        lineMode: effectiveToolLineMode,
        alternatingRockIds: isAltBands ? [...alternatingRockIds] : undefined,
        alternateRockTypes: isAltBands ? [...alternatingRockIds] : undefined,
        alternatingRockNames: altNames,
        alternatingSpacingPx: isAltBands ? alternatingSpacingPx : undefined,
        alternateSpacingPx: isAltBands ? alternatingSpacingPx : undefined,
        alternateAngleDeg: isAltBands ? alternatingAngleDeg : undefined,
      };
      updateActiveRound((r) => ({
        ...r,
        lithologyDensityByRock: {
          ...(r.lithologyDensityByRock || {}),
          [selectedRockType]: currentDensity,
          [rockInfo.patternId]: currentDensity,
        },
        lithologyStrokes: pruneFullyErasedLithologyStrokes([
          ...r.lithologyStrokes,
          stroke,
        ]),
      }));
    } else if (pTool === '2_vein_foliation') {
      const catalogMatch = FIELD_VEIN_AND_FOLIATION_CATALOG.find(
        (v) => v.id === selectedVeinRockId
      );
      const resolvedMeta = resolveRockDisplayInfo(selectedVeinRockId, store.rememberedRocks);
      const veinMeta = catalogMatch || {
        id: selectedVeinRockId,
        name: resolvedMeta.name,
        code: resolvedMeta.code,
        patternId: resolvedMeta.patternId || 'quartz_vein',
      };
      const effectiveBandThickness =
        activeRound.veinBandThicknessByType?.[veinMeta.id] ??
        activeRound.veinBandThicknessByType?.[veinMeta.patternId] ??
        activeRound.defaultBandThicknessPx ??
        veinBandThicknessPx;
      const effectiveBandDensity =
        activeRound.veinBandDensityByType?.[veinMeta.id] ??
        activeRound.veinBandDensityByType?.[veinMeta.patternId] ??
        activeRound.veinBandSymbolDensity ??
        veinBandSymbolDensity;
      const effectiveBandSymSize =
        activeRound.veinBandSymbolSizeByType?.[veinMeta.id] ??
        activeRound.veinBandSymbolSizeByType?.[veinMeta.patternId] ??
        activeRound.veinBandSymbolSize ??
        veinBandSymbolSize;
      const stroke: FieldLithologyStroke = {
        id: `vein-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        panel: targetPanel,
        rockType: veinMeta.id,
        rockName: veinMeta.name,
        patternId: veinMeta.patternId,
        mode: 'vein_band',
        points: shapedPts,
        brushRadius: Math.max(1, Math.round(effectiveBandThickness / 2)),
        bandThicknessPx: effectiveBandThickness,
        symbolSize: effectiveBandSymSize,
        symbolDensity: effectiveBandDensity,
        lineMode: effectiveToolLineMode,
        foliationDipDirection: est.dipDirection,
        foliationDipAmount: est.dipAmount,
      };
      setSelectedVeinBandId(stroke.id);
      setSelectedTraceId(null);
      setSelectedDipSurfaceId(null);
      setSelectedFeatureId(null);
      updateActiveRound((r) => ({
        ...r,
        veinBandThicknessByType: {
          ...(r.veinBandThicknessByType || {}),
          [veinMeta.id]: effectiveBandThickness,
          [veinMeta.patternId]: effectiveBandThickness,
        },
        veinBandDensityByType: {
          ...(r.veinBandDensityByType || {}),
          [veinMeta.id]: effectiveBandDensity,
          [veinMeta.patternId]: effectiveBandDensity,
        },
        veinBandSymbolSizeByType: {
          ...(r.veinBandSymbolSizeByType || {}),
          [veinMeta.id]: effectiveBandSymSize,
          [veinMeta.patternId]: effectiveBandSymSize,
        },
        lithologyStrokes: [...r.lithologyStrokes, stroke],
      }));
    } else if (pTool === '3_joint_trace') {
      const newTrace: FieldJointTrace = {
        id: `jtr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: 'J',
        panel: targetPanel,
        points: shapedPts,
        dipDirection: est.dipDirection,
        dipAmount: est.dipAmount,
        strike: est.strike,
        crownDipSign: liveCrownSign,
        setId: 'unassigned',
        editedByCompass: false,
        traceLengthM: est.traceLengthM,
        metricPoints: computePhysicalMetricPoints(shapedPts, targetPanel, activeLocation, activeRound),
        strokeWidthPx: jointPencilSizePx,
        lineMode: effectiveToolLineMode,
      };
      setSelectedTraceId(newTrace.id);
      setSelectedDipSurfaceId(null);
      setSelectedVeinBandId(null);
      setSelectedFeatureId(null);
      updateActiveRound((r) => ({
        ...r,
        jointTraces: [...r.jointTraces, newTrace],
      }));
      if (workflowMode === 'photo_mapping') {
        const existing = activeRound.jointTraces.filter((t) => t.panel === targetPanel);
        for (const ex of existing) {
          if (ex.points.length >= 2 && newTrace.points.length >= 2) {
            const p0 = newTrace.points[0];
            const pEnd = newTrace.points[newTrace.points.length - 1];
            const pMid = newTrace.points[Math.floor(newTrace.points.length / 2)];
            const ex0 = ex.points[0];
            const exEnd = ex.points[ex.points.length - 1];
            const exMid = ex.points[Math.floor(ex.points.length / 2)];
            const d0 = Math.min(Math.hypot(p0.x - ex0.x, p0.y - ex0.y), Math.hypot(p0.x - exEnd.x, p0.y - exEnd.y));
            const dEnd = Math.min(Math.hypot(pEnd.x - ex0.x, pEnd.y - exEnd.y), Math.hypot(pEnd.x - exEnd.x, pEnd.y - exEnd.y));
            const dMid = Math.hypot(pMid.x - exMid.x, pMid.y - exMid.y);
            const avgD = (d0 + dEnd + dMid) / 3;
            if (avgD < 25) {
              setPhotogrammetryDuplicateWarning({ matchId: ex.id, distance: avgD });
              break;
            }
          }
        }
        setPendingPhotogrammetryJoint(newTrace);
      }
    } else if (pTool === '4_dip_surface') {
      const { outlinePolygon } = buildDipSurfacePolygonWithOutlineSnap(
        shapedPts,
        targetPanel,
        activeLocation,
        activeRound
      );
      const clampedOutlinePolygon = clampAllToOutline(outlinePolygon);
      const newSurf: FieldDipPlaneSurface = {
        id: `dips-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: 'Dip Surface',
        panel: targetPanel,
        points: shapedPts,
        outlinePolygon: clampedOutlinePolygon,
        brushRadius: 6,
        dipDirection: est.dipDirection,
        dipAmount: est.dipAmount,
        strike: est.strike,
        setId: 'unassigned',
        lineMode: effectiveToolLineMode,
      };
      setSelectedDipSurfaceId(newSurf.id);
      setSelectedTraceId(null);
      setSelectedVeinBandId(null);
      setSelectedFeatureId(null);
      updateActiveRound((r) => ({
        ...r,
        dipPlaneSurfaces: [...r.dipPlaneSurfaces, newSurf],
      }));
    } else if (pTool === '5_geo_feature') {
      const meta =
        FIELD_STRUCTURAL_FEATURE_CATALOG.find((f) => f.id === selectedGeoFeatureType) ||
        FIELD_STRUCTURAL_FEATURE_CATALOG[0];
      const isFaultLike =
        selectedGeoFeatureType === 'fault' ||
        selectedGeoFeatureType === 'thrust_fault' ||
        selectedGeoFeatureType === 'shear_zone';
      const isFoldLike = selectedGeoFeatureType === 'fold_axis';
      const feat: FieldStructuralFeature = {
        id: `sfeat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        panel: targetPanel,
        featureType: selectedGeoFeatureType,
        label: meta.shortCode,
        points: shapedPts,
        dipDirection: est.dipDirection,
        dipAmount: est.dipAmount,
        strokeWidthPx: geoFeaturePencilSizePx,
        symbolSize: geoFeatureSymbolSize,
        symbolDensity: geoFeatureSymbolDensity,
        lineMode: effectiveToolLineMode,
        faultSubType: isFaultLike ? selectedFaultSubType : undefined,
        faultElementRole: isFaultLike ? selectedFaultElementRole : undefined,
        showHwFwBadges: isFaultLike ? showHwFwBadges : undefined,
        foldSubType: isFoldLike ? selectedFoldSubType : undefined,
        foldElementRole: isFoldLike ? selectedFoldElementRole : undefined,
        showFoldLimbCrestBadges: isFoldLike ? showFoldLimbCrestBadges : undefined,
      };
      setSelectedFeatureId(feat.id);
      setSelectedTraceId(null);
      setSelectedDipSurfaceId(null);
      setSelectedVeinBandId(null);
      updateActiveRound((r) => ({
        ...r,
        structuralFeatures: [...(r.structuralFeatures || []), feat],
      }));
    }
    setPending2DTrace(null);
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchStateRef.current = null;
    }
    if (isPinchingRef.current) {
      if (activePointersRef.current.size === 0) {
        isPinchingRef.current = false;
      }
      setIsDrawing(false);
      setCurrentPoints([]);
      return;
    }

    if (panDragOrigin) {
      setPanDragOrigin(null);
      return;
    }
    if (panelMoveDrag) {
      setPanelMoveDrag(null);
      return;
    }
    if (!isDrawing || !activeRound || !activeLocation) return;
    setIsDrawing(false);

    if (activeTool === 'eraser') {
      setCurrentPoints([]);
      return;
    }

    if (currentPoints.length === 0) return;
    const targetPanel = canvasViewMode === 'unfolded_t' ? drawingPanelRef.current : activePanel;

    const clampAllToOutline = (ptsArr: FieldPoint2D[]) =>
      ptsArr.map((p) =>
        clampPointToFieldPanelOutline(p, targetPanel, activeLocation, activeRound, 0)
      );

    // Handle Pencil, Spline, and Polyline sub-tools across all 5 features (1_lithology .. 5_geo_feature)
    const isUsingEraseArea =
      activeTool === '1_lithology' && lithologySubMode === 'erase_area';

    if (hasFourDrawSubTools && !isUsingEraseArea && activeDrawSubTool !== 'brush') {
      const rawClampedSeg = clampAllToOutline(currentPoints);
      const snappedFirst = snapPointToExactFieldPanelOutline(
        rawClampedSeg[0],
        targetPanel,
        activeLocation,
        activeRound,
        30
      ).point;
      const snappedLast = snapPointToExactFieldPanelOutline(
        rawClampedSeg[rawClampedSeg.length - 1],
        targetPanel,
        activeLocation,
        activeRound,
        30
      ).point;
      const segChord = Math.hypot(
        snappedLast.x - snappedFirst.x,
        snappedLast.y - snappedFirst.y
      );

      let nextPendingPts: FieldPoint2D[] = [];
      const existingPendingPts =
        pending2DTrace &&
        pending2DTrace.tool === activeTool &&
        pending2DTrace.subTool === activeDrawSubTool &&
        pending2DTrace.panel === targetPanel
          ? pending2DTrace.points
          : [];

      if (activeDrawSubTool === 'polyline') {
        if (segChord < 6) {
          // Point-by-point vertex click
          nextPendingPts = [...existingPendingPts, snappedFirst];
        } else {
          // Straight dragged segment
          nextPendingPts =
            existingPendingPts.length > 0
              ? [...existingPendingPts, snappedLast]
              : [snappedFirst, snappedLast];
        }
      } else if (activeDrawSubTool === 'spline') {
        if (segChord < 6) {
          // Point-by-point spline control node click
          nextPendingPts = [...existingPendingPts, snappedFirst];
        } else {
          // Dragged curve: extract 3–5 representative control points preserving exact snapped endpoints
          const midIdx = Math.floor(rawClampedSeg.length / 2);
          const q1Idx = Math.floor(rawClampedSeg.length / 4);
          const q3Idx = Math.floor((rawClampedSeg.length * 3) / 4);
          const sampled =
            rawClampedSeg.length >= 8
              ? [
                  snappedFirst,
                  rawClampedSeg[q1Idx],
                  rawClampedSeg[midIdx],
                  rawClampedSeg[q3Idx],
                  snappedLast,
                ]
              : rawClampedSeg.length >= 4
              ? [snappedFirst, rawClampedSeg[midIdx], snappedLast]
              : [snappedFirst, snappedLast];
          nextPendingPts =
            existingPendingPts.length > 0
              ? [...existingPendingPts, ...sampled.slice(1)]
              : sampled;
        }
      } else {
        // 'pencil' freehand trace: anchor start and end points onto the exact tunnel outline when near
        const anchoredSeg = [...rawClampedSeg];
        anchoredSeg[0] = snappedFirst;
        anchoredSeg[anchoredSeg.length - 1] = snappedLast;
        if (anchoredSeg.length === 1) {
          if (existingPendingPts.length > 0) {
            nextPendingPts = [...existingPendingPts, snappedFirst];
          } else {
            // Single click/tap near outline starts the trace anchor on the exact outline!
            nextPendingPts = [snappedFirst];
          }
        } else {
          nextPendingPts =
            existingPendingPts.length > 0
              ? [...existingPendingPts, ...anchoredSeg]
              : anchoredSeg;
        }
      }

      const previewPtsForEst =
        nextPendingPts.length >= 2
          ? shapeTracePointsForSubTool(nextPendingPts, activeDrawSubTool, targetPanel)
          : nextPendingPts;
      const est =
        previewPtsForEst.length >= 2
          ? estimateTraceOrientationFromGeometry(
              previewPtsForEst,
              targetPanel,
              activeRound.tunnelDriveDirection,
              liveCrownSign,
              activeLocation.widthM,
              activeLocation.heightM
            )
          : {
              dipDirection: liveDipDirection,
              dipAmount: liveDipAmount,
              strike: (liveDipDirection - 90 + 360) % 360,
              traceLengthM: 0.5,
            };

      if (previewPtsForEst.length >= 2) {
        setLiveDipDirection(est.dipDirection);
        setLiveDipAmount(est.dipAmount);
      }
      setPending2DTrace({
        tool: activeTool,
        subTool: activeDrawSubTool,
        panel: targetPanel,
        points: nextPendingPts,
        dipDirection: est.dipDirection,
        dipAmount: est.dipAmount,
      });
      setCurrentPoints([]);
      pointerStartClientRef.current = null;
      return;
    }

    pushUndoSnapshot();

    // 1. Rock Lithology (Brush & Lithology Eraser — Supports Custom Colour & Alternating Bands!)
    if (activeTool === '1_lithology') {
      const pts = clampAllToOutline(
        currentPoints.length === 1
          ? [currentPoints[0], { x: currentPoints[0].x + 2, y: currentPoints[0].y + 2 }]
          : currentPoints
      );

      if (lithologySubMode === 'erase_area') {
        const eraseStroke: FieldLithologyStroke = {
          id: `lith-erase-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          panel: targetPanel,
          rockType: selectedRockType,
          rockName: 'Lithology Erase',
          mode: 'lithology_erase',
          points: pts,
          brushRadius,
        };
        updateActiveRound((r) => ({
          ...r,
          lithologyStrokes: pruneFullyErasedLithologyStrokes([
            ...r.lithologyStrokes,
            eraseStroke,
          ]),
        }));
        setCurrentPoints([]);
        return;
      }

      const rockInfo = resolveRockDisplayInfo(selectedRockType, store.rememberedRocks);
      const customRockColor = (activeRound.rockCustomColors || {})[selectedRockType];
      const isAltBands = alternatingBandMode && alternatingRockIds.length >= 2;
      const altNames = isAltBands
        ? alternatingRockIds.map(
            (rid) => resolveRockDisplayInfo(rid, store.rememberedRocks).name
          )
        : undefined;
      const currentDensity =
        activeRound.lithologyDensityByRock?.[selectedRockType] ??
        activeRound.lithologyDensityByRock?.[rockInfo.patternId] ??
        activeRound.lithologySymbolDensity ??
        lithologySymbolDensity;
      const currentRockAngle =
        activeRound.lithologyAngleByRock?.[selectedRockType] ??
        activeRound.lithologyAngleByRock?.[rockInfo.patternId] ??
        activeRound.lithologyPatternAngle ??
        lithologyPatternAngle ??
        0;
      const stroke: FieldLithologyStroke = {
        id: `lith-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        panel: targetPanel,
        rockType: selectedRockType,
        rockName: isAltBands ? altNames!.join(' / ') : rockInfo.name,
        rockCode: rockInfo.code,
        color: customRockColor || rockInfo.color,
        fillColor: customRockColor || rockInfo.fillColor,
        customColor: customRockColor,
        patternId: rockInfo.patternId,
        patternAngleDeg: currentRockAngle,
        mode: 'region_fill',
        points: pts,
        brushRadius,
        symbolDensity: currentDensity,
        alternatingRockIds: isAltBands ? [...alternatingRockIds] : undefined,
        alternateRockTypes: isAltBands ? [...alternatingRockIds] : undefined,
        alternatingRockNames: altNames,
        alternatingSpacingPx: isAltBands ? alternatingSpacingPx : undefined,
        alternateSpacingPx: isAltBands ? alternatingSpacingPx : undefined,
        alternateAngleDeg: isAltBands ? alternatingAngleDeg : undefined,
      };
      updateActiveRound((r) => ({
        ...r,
        lithologyDensityByRock: {
          ...(r.lithologyDensityByRock || {}),
          [selectedRockType]: currentDensity,
          [rockInfo.patternId]: currentDensity,
        },
        lithologyStrokes: pruneFullyErasedLithologyStrokes([
          ...r.lithologyStrokes,
          stroke,
        ]),
      }));
      setCurrentPoints([]);
      return;
    }

    // 2. Unified Vein & Foliation Band (Brush mode)
    if (activeTool === '2_vein_foliation') {
      const catalogMatch = FIELD_VEIN_AND_FOLIATION_CATALOG.find(
        (v) => v.id === selectedVeinRockId
      );
      const resolvedMeta = resolveRockDisplayInfo(selectedVeinRockId, store.rememberedRocks);
      const veinMeta = catalogMatch || {
        id: selectedVeinRockId,
        name: resolvedMeta.name,
        code: resolvedMeta.code,
        patternId: resolvedMeta.patternId || 'quartz_vein',
      };
      const pts = shapeTracePointsForSubTool(
        currentPoints.length === 1
          ? [currentPoints[0], { x: currentPoints[0].x + 55, y: currentPoints[0].y - 22 }]
          : currentPoints,
        'pencil',
        targetPanel
      );
      const computedOri = estimateTraceOrientationFromGeometry(
        pts,
        targetPanel,
        activeRound.tunnelDriveDirection,
        liveCrownSign,
        activeLocation.widthM,
        activeLocation.heightM
      );
      setLiveDipDirection(computedOri.dipDirection);
      setLiveDipAmount(computedOri.dipAmount);

      const effectiveBandThickness =
        activeDrawSubTool === 'brush'
          ? Math.max(8, brushRadius)
          : activeRound.veinBandThicknessByType?.[veinMeta.id] ??
            activeRound.veinBandThicknessByType?.[veinMeta.patternId] ??
            activeRound.defaultBandThicknessPx ??
            veinBandThicknessPx;
      const effectiveBandDensity =
        activeRound.veinBandDensityByType?.[veinMeta.id] ??
        activeRound.veinBandDensityByType?.[veinMeta.patternId] ??
        activeRound.veinBandSymbolDensity ??
        veinBandSymbolDensity;

      const stroke: FieldLithologyStroke = {
        id: `vein-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        panel: targetPanel,
        rockType: veinMeta.id,
        rockName: veinMeta.name,
        patternId: veinMeta.patternId,
        mode: 'vein_band',
        points: pts,
        brushRadius: Math.max(1, Math.round(effectiveBandThickness / 2)),
        bandThicknessPx: effectiveBandThickness,
        symbolDensity: effectiveBandDensity,
        foliationDipDirection: computedOri.dipDirection,
        foliationDipAmount: computedOri.dipAmount,
      };
      setSelectedVeinBandId(stroke.id);
      setSelectedTraceId(null);
      setSelectedDipSurfaceId(null);
      setSelectedFeatureId(null);
      updateActiveRound((r) => ({
        ...r,
        veinBandThicknessByType: {
          ...(r.veinBandThicknessByType || {}),
          [veinMeta.id]: effectiveBandThickness,
          [veinMeta.patternId]: effectiveBandThickness,
        },
        veinBandDensityByType: {
          ...(r.veinBandDensityByType || {}),
          [veinMeta.id]: effectiveBandDensity,
          [veinMeta.patternId]: effectiveBandDensity,
        },
        lithologyStrokes: [...r.lithologyStrokes, stroke],
      }));
      setCurrentPoints([]);
      return;
    }

    // 3. Draw Joint Trace (Brush mode)
    if (activeTool === '3_joint_trace') {
      const rawPts =
        currentPoints.length === 1
          ? [
              { x: Math.max(10, currentPoints[0].x - 45), y: Math.max(10, currentPoints[0].y - 25) },
              { x: Math.min(990, currentPoints[0].x + 45), y: Math.min(990, currentPoints[0].y + 25) },
            ]
          : currentPoints;
      const smoothed = shapeTracePointsForSubTool(rawPts, 'pencil', targetPanel);
      const est = estimateTraceOrientationFromGeometry(
        smoothed,
        targetPanel,
        activeRound.tunnelDriveDirection,
        liveCrownSign,
        activeLocation.widthM,
        activeLocation.heightM
      );
      setLiveDipDirection(est.dipDirection);
      setLiveDipAmount(est.dipAmount);

      const newTrace: FieldJointTrace = {
        id: `jtr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: 'J',
        panel: targetPanel,
        points: smoothed,
        dipDirection: est.dipDirection,
        dipAmount: est.dipAmount,
        strike: est.strike,
        crownDipSign: liveCrownSign,
        setId: 'unassigned',
        editedByCompass: false,
        traceLengthM: est.traceLengthM,
        metricPoints: computePhysicalMetricPoints(smoothed, targetPanel, activeLocation, activeRound),
        strokeWidthPx:
          activeDrawSubTool === 'brush'
            ? Math.max(2, Math.min(16, Number((brushRadius / 4).toFixed(1))))
            : jointPencilSizePx,
      };

      setSelectedTraceId(newTrace.id);
      setSelectedDipSurfaceId(null);
      setSelectedVeinBandId(null);
      setSelectedFeatureId(null);
      updateActiveRound((r) => ({
        ...r,
        jointTraces: [...r.jointTraces, newTrace],
      }));
      if (workflowMode === 'photo_mapping') {
        const existing = activeRound.jointTraces.filter((t) => t.panel === targetPanel);
        for (const ex of existing) {
          if (ex.points.length >= 2 && newTrace.points.length >= 2) {
            const p0 = newTrace.points[0];
            const pEnd = newTrace.points[newTrace.points.length - 1];
            const pMid = newTrace.points[Math.floor(newTrace.points.length / 2)];
            const ex0 = ex.points[0];
            const exEnd = ex.points[ex.points.length - 1];
            const exMid = ex.points[Math.floor(ex.points.length / 2)];
            const d0 = Math.min(Math.hypot(p0.x - ex0.x, p0.y - ex0.y), Math.hypot(p0.x - exEnd.x, p0.y - exEnd.y));
            const dEnd = Math.min(Math.hypot(pEnd.x - ex0.x, pEnd.y - exEnd.y), Math.hypot(pEnd.x - exEnd.x, pEnd.y - exEnd.y));
            const dMid = Math.hypot(pMid.x - exMid.x, pMid.y - exMid.y);
            const avgD = (d0 + dEnd + dMid) / 3;
            if (avgD < 25) {
              setPhotogrammetryDuplicateWarning({ matchId: ex.id, distance: avgD });
              break;
            }
          }
        }
        setPendingPhotogrammetryJoint(newTrace);
      }
      setCurrentPoints([]);
      return;
    }

    // 4. Dip Plane Surface (Brush mode)
    if (activeTool === '4_dip_surface') {
      const pts = clampAllToOutline(
        currentPoints.length === 1
          ? [currentPoints[0], { x: currentPoints[0].x + 28, y: currentPoints[0].y + 18 }]
          : smoothFieldTracePoints(currentPoints)
      );
      const chord = Math.hypot(
        pts[pts.length - 1].x - pts[0].x,
        pts[pts.length - 1].y - pts[0].y
      );
      const computedSurfOri =
        chord >= 2
          ? estimateTraceOrientationFromGeometry(
              pts,
              targetPanel,
              activeRound.tunnelDriveDirection,
              liveCrownSign,
              activeLocation.widthM,
              activeLocation.heightM
            )
          : {
              dipDirection: liveDipDirection,
              dipAmount: liveDipAmount,
              strike: (liveDipDirection - 90 + 360) % 360,
            };
      setLiveDipDirection(computedSurfOri.dipDirection);
      setLiveDipAmount(computedSurfOri.dipAmount);
      const { outlinePolygon } = buildDipSurfaceOutlineAndCentroid(pts, brushRadius);
      const clampedOutlinePolygon = clampAllToOutline(outlinePolygon);
      const newSurf: FieldDipPlaneSurface = {
        id: `dips-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: 'Dip Surface',
        panel: targetPanel,
        points: pts,
        outlinePolygon: clampedOutlinePolygon,
        brushRadius,
        dipDirection: computedSurfOri.dipDirection,
        dipAmount: computedSurfOri.dipAmount,
        strike: computedSurfOri.strike,
        setId: 'unassigned',
      };
      setSelectedDipSurfaceId(newSurf.id);
      setSelectedTraceId(null);
      setSelectedVeinBandId(null);
      setSelectedFeatureId(null);
      updateActiveRound((r) => ({
        ...r,
        dipPlaneSurfaces: [...r.dipPlaneSurfaces, newSurf],
      }));
      setCurrentPoints([]);
      return;
    }

    // 5. Geological / Structural Features (Brush mode)
    if (activeTool === '5_geo_feature') {
      const meta =
        FIELD_STRUCTURAL_FEATURE_CATALOG.find((f) => f.id === selectedGeoFeatureType) ||
        FIELD_STRUCTURAL_FEATURE_CATALOG[0];
      const pts = shapeTracePointsForSubTool(
        currentPoints.length === 1
          ? [
              { x: Math.max(20, currentPoints[0].x - 60), y: currentPoints[0].y - 24 },
              { x: Math.min(980, currentPoints[0].x + 60), y: Math.min(980, currentPoints[0].y + 24) },
            ]
          : currentPoints,
        'pencil',
        targetPanel
      );
      const featOri = estimateTraceOrientationFromGeometry(
        pts,
        targetPanel,
        activeRound.tunnelDriveDirection,
        liveCrownSign,
        activeLocation.widthM,
        activeLocation.heightM
      );
      setLiveDipDirection(featOri.dipDirection);
      setLiveDipAmount(featOri.dipAmount);
      const isFaultLike =
        selectedGeoFeatureType === 'fault' ||
        selectedGeoFeatureType === 'thrust_fault' ||
        selectedGeoFeatureType === 'shear_zone';
      const isFoldLike = selectedGeoFeatureType === 'fold_axis';
      const feat: FieldStructuralFeature = {
        id: `sfeat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        panel: targetPanel,
        featureType: selectedGeoFeatureType,
        label: meta.shortCode,
        points: pts,
        dipDirection: featOri.dipDirection,
        dipAmount: featOri.dipAmount,
        strokeWidthPx:
          activeDrawSubTool === 'brush'
            ? Math.max(2.5, Math.min(16, Number((brushRadius / 4).toFixed(1))))
            : geoFeaturePencilSizePx,
        symbolSize: geoFeatureSymbolSize,
        symbolDensity: geoFeatureSymbolDensity,
        faultSubType: isFaultLike ? selectedFaultSubType : undefined,
        faultElementRole: isFaultLike ? selectedFaultElementRole : undefined,
        showHwFwBadges: isFaultLike ? showHwFwBadges : undefined,
        foldSubType: isFoldLike ? selectedFoldSubType : undefined,
        foldElementRole: isFoldLike ? selectedFoldElementRole : undefined,
        showFoldLimbCrestBadges: isFoldLike ? showFoldLimbCrestBadges : undefined,
      };
      setSelectedFeatureId(feat.id);
      setSelectedTraceId(null);
      setSelectedDipSurfaceId(null);
      setSelectedVeinBandId(null);
      updateActiveRound((r) => ({
        ...r,
        structuralFeatures: [...(r.structuralFeatures || []), feat],
      }));
      setCurrentPoints([]);
      return;
    }

    // 6. Mark Water (Damp, Wet, Dripping, Flowing, High Pressure with hydrogeological symbols)
    if (activeTool === '6_water_mark') {
      const pts = clampAllToOutline(
        currentPoints.length === 1
          ? [currentPoints[0]]
          : smoothFieldTracePoints(currentPoints)
      );
      const wm: FieldWaterMark = {
        id: `wtr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        panel: targetPanel,
        condition: selectedWaterCondition,
        points: pts,
        brushRadius: Math.max(24, brushRadius),
      };
      updateActiveRound((r) => ({
        ...r,
        waterMarks: [...r.waterMarks, wm],
      }));
      setCurrentPoints([]);
    }
  };

  // Live Compass & Inclinometer reflection onto selected Joint Trace, Vein/Foliation Band, Structural Feature, or Dip Plane Surface
  const handleCompassDipDirectionChange = (newDipDir: number) => {
    setLiveDipDirection(newDipDir);
    if (!activeRound) return;
    const newStrike = (newDipDir - 90 + 360) % 360;
    if (selectedTraceId) {
      updateActiveRound((r) => ({
        ...r,
        jointTraces: r.jointTraces.map((tr) =>
          tr.id === selectedTraceId
            ? { ...tr, dipDirection: newDipDir, strike: newStrike, editedByCompass: true }
            : tr
        ),
      }));
    } else if (selectedDipSurfaceId) {
      updateActiveRound((r) => ({
        ...r,
        dipPlaneSurfaces: r.dipPlaneSurfaces.map((ds) =>
          ds.id === selectedDipSurfaceId
            ? { ...ds, dipDirection: newDipDir, strike: newStrike }
            : ds
        ),
      }));
    } else if (selectedVeinBandId) {
      updateActiveRound((r) => ({
        ...r,
        lithologyStrokes: r.lithologyStrokes.map((st) =>
          st.id === selectedVeinBandId
            ? { ...st, foliationDipDirection: newDipDir }
            : st
        ),
      }));
    } else if (selectedFeatureId) {
      updateActiveRound((r) => ({
        ...r,
        structuralFeatures: (r.structuralFeatures || []).map((ft) =>
          ft.id === selectedFeatureId ? { ...ft, dipDirection: newDipDir } : ft
        ),
      }));
    }
  };

  const handleCompassDipAmountChange = (newDipAmt: number) => {
    setLiveDipAmount(newDipAmt);
    if (!activeRound) return;
    if (selectedTraceId) {
      updateActiveRound((r) => ({
        ...r,
        jointTraces: r.jointTraces.map((tr) =>
          tr.id === selectedTraceId
            ? { ...tr, dipAmount: newDipAmt, editedByCompass: true }
            : tr
        ),
      }));
    } else if (selectedDipSurfaceId) {
      updateActiveRound((r) => ({
        ...r,
        dipPlaneSurfaces: r.dipPlaneSurfaces.map((ds) =>
          ds.id === selectedDipSurfaceId ? { ...ds, dipAmount: newDipAmt } : ds
        ),
      }));
    } else if (selectedVeinBandId) {
      updateActiveRound((r) => ({
        ...r,
        lithologyStrokes: r.lithologyStrokes.map((st) =>
          st.id === selectedVeinBandId
            ? { ...st, foliationDipAmount: newDipAmt }
            : st
        ),
      }));
    } else if (selectedFeatureId) {
      updateActiveRound((r) => ({
        ...r,
        structuralFeatures: (r.structuralFeatures || []).map((ft) =>
          ft.id === selectedFeatureId ? { ...ft, dipAmount: newDipAmt } : ft
        ),
      }));
    }
  };

  const handleRecalculateSelectedFromTrace = () => {
    if (!activeRound || !activeLocation) return;
    if (selectedTraceId) {
      const tr = activeRound.jointTraces.find((t) => t.id === selectedTraceId);
      if (tr && tr.points.length >= 2) {
        const est = estimateTraceOrientationFromGeometry(
          tr.points,
          tr.panel,
          activeRound.tunnelDriveDirection,
          liveCrownSign,
          activeLocation.widthM,
          activeLocation.heightM
        );
        setLiveDipDirection(est.dipDirection);
        setLiveDipAmount(est.dipAmount);
        updateActiveRound((r) => ({
          ...r,
          jointTraces: r.jointTraces.map((item) =>
            item.id === tr.id
              ? {
                  ...item,
                  dipDirection: est.dipDirection,
                  dipAmount: est.dipAmount,
                  strike: est.strike,
                  traceLengthM: est.traceLengthM,
                  editedByCompass: false,
                }
              : item
          ),
        }));
      }
    } else if (selectedVeinBandId) {
      const st = activeRound.lithologyStrokes.find((s) => s.id === selectedVeinBandId);
      if (st && st.points.length >= 2) {
        const est = estimateTraceOrientationFromGeometry(
          st.points,
          st.panel,
          activeRound.tunnelDriveDirection,
          liveCrownSign,
          activeLocation.widthM,
          activeLocation.heightM
        );
        setLiveDipDirection(est.dipDirection);
        setLiveDipAmount(est.dipAmount);
        updateActiveRound((r) => ({
          ...r,
          lithologyStrokes: r.lithologyStrokes.map((item) =>
            item.id === st.id
              ? {
                  ...item,
                  foliationDipDirection: est.dipDirection,
                  foliationDipAmount: est.dipAmount,
                }
              : item
          ),
        }));
      }
    } else if (selectedFeatureId) {
      const ft = (activeRound.structuralFeatures || []).find(
        (f) => f.id === selectedFeatureId
      );
      if (ft && ft.points.length >= 2) {
        const est = estimateTraceOrientationFromGeometry(
          ft.points,
          ft.panel,
          activeRound.tunnelDriveDirection,
          liveCrownSign,
          activeLocation.widthM,
          activeLocation.heightM
        );
        setLiveDipDirection(est.dipDirection);
        setLiveDipAmount(est.dipAmount);
        updateActiveRound((r) => ({
          ...r,
          structuralFeatures: (r.structuralFeatures || []).map((item) =>
            item.id === ft.id
              ? {
                  ...item,
                  dipDirection: est.dipDirection,
                  dipAmount: est.dipAmount,
                }
              : item
          ),
        }));
      }
    } else if (selectedDipSurfaceId) {
      const ds = activeRound.dipPlaneSurfaces.find((d) => d.id === selectedDipSurfaceId);
      if (ds && ds.points.length >= 2) {
        const est = estimateTraceOrientationFromGeometry(
          ds.points,
          ds.panel,
          activeRound.tunnelDriveDirection,
          liveCrownSign,
          activeLocation.widthM,
          activeLocation.heightM
        );
        setLiveDipDirection(est.dipDirection);
        setLiveDipAmount(est.dipAmount);
        updateActiveRound((r) => ({
          ...r,
          dipPlaneSurfaces: r.dipPlaneSurfaces.map((item) =>
            item.id === ds.id
              ? {
                  ...item,
                  dipDirection: est.dipDirection,
                  dipAmount: est.dipAmount,
                  strike: est.strike,
                }
              : item
          ),
        }));
      }
    }
  };

  const handleCrownSignChange = (sign: '+90' | '-90') => {
    setLiveCrownSign(sign);
    if (!activeRound || !selectedTraceId) return;
    updateActiveRound((r) => ({
      ...r,
      jointTraces: r.jointTraces.map((tr) => {
        if (tr.id !== selectedTraceId) return tr;
        const nextDipDir =
          sign === '+90' ? (tr.strike + 90) % 360 : (tr.strike - 90 + 360) % 360;
        setLiveDipDirection(nextDipDir);
        return { ...tr, crownDipSign: sign, dipDirection: nextDipDir };
      }),
    }));
  };

  // Filtered rock suggestions based on search query & tunnel location
  const filteredRockSuggestions = useMemo(() => {
    const q = rockSearchQuery.trim().toLowerCase();
    const locName = (activeLocation?.name || '').toLowerCase();
    const list = FIELD_EXTENDED_ROCK_SUGGESTIONS.filter((r) => {
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.locationHint && r.locationHint.toLowerCase().includes(q))
      );
    });
    // Prioritize rocks matching location hint if any
    return list.sort((a, b) => {
      const aMatch = a.locationHint && locName.includes(a.locationHint.toLowerCase()) ? -1 : 0;
      const bMatch = b.locationHint && locName.includes(b.locationHint.toLowerCase()) ? -1 : 0;
      return aMatch - bMatch;
    });
  }, [rockSearchQuery, activeLocation]);

  // Select or create a remembered custom rock from the search box
  const handleChooseOrRememberRock = (
    rockName: string,
    code?: string,
    patternId = 'granite',
    category = 'Custom / Remembered'
  ) => {
    const updatedStore = addAndRememberCustomRock(
      store,
      activeLocation?.id || null,
      rockName,
      code,
      patternId,
      category,
      activeLocation?.name
    );
    setStore(updatedStore);
    const idSlug = rockName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_');
    setSelectedRockType(idSlug);
    setShowOtherRockSearch(false);
    setRockSearchQuery('');
  };

  // Filtered Vein & Foliation suggestions for Tool 2 "Other / Search Band"
  const filteredVeinSuggestions = useMemo(() => {
    const q = veinSearchQuery.trim().toLowerCase();
    if (!q) return FIELD_EXTENDED_VEIN_FOLIATION_SUGGESTIONS;
    return FIELD_EXTENDED_VEIN_FOLIATION_SUGGESTIONS.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.code.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q)
    );
  }, [veinSearchQuery]);

  // Select or create a remembered custom Vein / Foliation Band from Tool 2 search box
  const handleChooseOrRememberVeinBand = (
    bandName: string,
    code?: string,
    patternId?: string,
    category = 'Vein / Foliation Band'
  ) => {
    const lower = bandName.toLowerCase();
    const resolvedPattern =
      patternId ||
      (lower.includes('foliation') ||
      lower.includes('cleavage') ||
      lower.includes('schist') ||
      lower.includes('s1') ||
      lower.includes('s2') ||
      lower.includes('s3')
        ? 'band_foliation_s1'
        : lower.includes('shear') ||
          lower.includes('gouge') ||
          lower.includes('mylonite') ||
          lower.includes('breccia') ||
          lower.includes('fault')
        ? 'shear_zone'
        : lower.includes('shale') ||
          lower.includes('clay') ||
          lower.includes('seam') ||
          lower.includes('coal') ||
          lower.includes('graphite')
        ? 'shale_vein'
        : lower.includes('pegmatite') || lower.includes('aplite') || lower.includes('tourmaline')
        ? 'band_pegmatite'
        : lower.includes('dyke') || lower.includes('dolerite') || lower.includes('mafic')
        ? 'band_mafic_dyke'
        : lower.includes('bed') || lower.includes('chert') || lower.includes('s0')
        ? 'band_bedding_s0'
        : 'quartz_vein');

    const updatedStore = addAndRememberCustomRock(
      store,
      activeLocation?.id || null,
      bandName,
      code,
      resolvedPattern,
      `Vein/Band • ${category}`,
      activeLocation?.name
    );
    setStore(updatedStore);
    const existingExt = FIELD_EXTENDED_VEIN_FOLIATION_SUGGESTIONS.find(
      (v) => v.name.toLowerCase() === bandName.trim().toLowerCase()
    );
    const idSlug = existingExt
      ? existingExt.id
      : bandName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_');
    setSelectedVeinRockId(idSlug);
    setShowOtherVeinSearch(false);
    setVeinSearchQuery('');
  };

  // Current panel items for Stage 4 Canvas
  const panelPhoto = useMemo(
    () =>
      activeRound?.collectedPhotos
        .slice()
        .reverse()
        .find((p) => p.panel === activePanel) || null,
    [activeRound?.collectedPhotos, activePanel]
  );

  const panelLithStrokes = useMemo(
    () => (activeRound?.lithologyStrokes || []).filter((s) => s.panel === activePanel),
    [activeRound?.lithologyStrokes, activePanel]
  );

  const panelTraces = useMemo(
    () => (activeRound?.jointTraces || []).filter((t) => t.panel === activePanel),
    [activeRound?.jointTraces, activePanel]
  );

  const panelTraceLabelMap = useMemo(
    () => computeTraceInlineLabelPlacements(panelTraces),
    [panelTraces]
  );

  const panelDipSurfaces = useMemo(
    () => (activeRound?.dipPlaneSurfaces || []).filter((d) => d.panel === activePanel),
    [activeRound?.dipPlaneSurfaces, activePanel]
  );

  const panelStructuralFeatures = useMemo(
    () => (activeRound?.structuralFeatures || []).filter((f) => f.panel === activePanel),
    [activeRound?.structuralFeatures, activePanel]
  );

  const panelWaterMarks = useMemo(
    () => (activeRound?.waterMarks || []).filter((w) => w.panel === activePanel),
    [activeRound?.waterMarks, activePanel]
  );

  // Exact proportional canvas geometry for the active panel (Face, Crown, Left Wall, Right Wall)
  const activePanelGeom = useMemo(() => {
    if (!activeLocation || !activeRound) {
      return {
        boxX: 90,
        boxY: 105,
        boxW: 790,
        boxH: 720,
        panelWidthM: 8.5,
        panelHeightM: 7.5,
        tunnelW: 8.5,
        tunnelH: 7.5,
        splHeightM: 4.0,
        crownRiseM: 3.5,
        splRatio: 4.0 / 7.5,
        pullM: 3.0,
        crownLengthM: 11.8,
        pxPerMeter: 92,
      };
    }
    return computePanelCanvasGeometry(activePanel, activeLocation, activeRound);
  }, [activePanel, activeLocation, activeRound]);

  // Remembered rocks combining location remembered rocks + store remembered rocks
  const rememberedRocksList: FieldRememberedRockItem[] = useMemo(() => {
    const map = new Map<string, FieldRememberedRockItem>();
    for (const r of store.rememberedRocks || []) map.set(r.id, r);
    for (const r of activeLocation?.rememberedRockTypes || []) map.set(r.id, r);
    return Array.from(map.values());
  }, [store.rememberedRocks, activeLocation?.rememberedRockTypes]);

  // Create new project handler
  const handleCreateProject = () => {
    if (!newProjName.trim()) return;
    const projId = `fproj-${Date.now()}`;
    const locId = `floc-${Date.now() + 1}`;
    const defaultLoc: FieldTunnelLocationItem = {
      id: locId,
      name: 'Main Drive - Face 1',
      shape: 'd_shaped',
      widthM: 8.5,
      heightM: 7.5,
      wallHeightM: 4.0,
      crownRadiusM: 4.25,
      defaultDriveAzimuth: 45,
      defaultExcavationMode: 'Drill & Blast (Full Face)',
      defaultExcavationApproach: 'Heading & Bench',
      rememberedRockTypes: [],
    };
    const newProj: FieldProjectItem = {
      id: projId,
      projectName: newProjName.trim(),
      clientName: newProjClient.trim() || 'Client',
      contractorName: newProjContractor.trim() || 'Contractor',
      consultantName: newProjConsultant.trim() || 'Consultant',
      createdAt: new Date().toISOString(),
      locations: [defaultLoc],
      customWordTemplate: null,
    };
    const newRound = createDefaultExcavationRound(projId, defaultLoc, '100.0', 3.0);
    setStore((prev) => ({
      ...prev,
      projects: [...prev.projects, newProj],
      rounds: [newRound, ...prev.rounds],
      activeProjectId: projId,
      activeLocationId: locId,
      activeRoundId: newRound.id,
    }));
    setNewProjName('');
    setShowNewProjectForm(false);
    setSetupWindowStep('location');
  };

  // Create new tunnel location handler
  const handleCreateLocation = () => {
    if (!activeProject || !newLocName.trim()) return;
    const locId = `floc-${Date.now()}`;
    const loc: FieldTunnelLocationItem = {
      id: locId,
      name: newLocName.trim(),
      shape: newLocShape,
      widthM: Number(newLocWidth) || 8.5,
      heightM: Number(newLocHeight) || 7.5,
      wallHeightM: Number((Number(newLocHeight) * 0.55).toFixed(2)),
      crownRadiusM: Number((Number(newLocWidth) * 0.5).toFixed(2)),
      defaultDriveAzimuth: Number(newLocAzimuth) || 45,
      defaultExcavationMode: 'Drill & Blast (Full Face)',
      defaultExcavationApproach: 'Full Face',
      customCrossSectionPoints: newLocCustomPoints,
      customGeometry: newLocCustomGeometry,
      rememberedRockTypes: [],
    };
    const newRound = createDefaultExcavationRound(activeProject.id, loc, '0+100.0', 3.0);
    setStore((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === activeProject.id ? { ...p, locations: [...p.locations, loc] } : p
      ),
      rounds: [newRound, ...prev.rounds],
      activeLocationId: locId,
      activeRoundId: newRound.id,
    }));
    setNewLocName('');
    setShowNewLocationForm(false);
    setSetupWindowStep('face');
  };

  // Open New Face / Station dialog to ask Details + Field vs Photogrammetry Method
  const handleStartNewRoundForLocation = (loc: FieldTunnelLocationItem) => {
    if (!activeProject) return;
    const existingForLoc = store.rounds.filter(
      (r) => r.projectId === activeProject.id && r.locationId === loc.id
    );
    const lastChainage =
      existingForLoc.length > 0 ? existingForLoc[0].chainageTo : '100.0';
    setStore((prev) => ({
      ...prev,
      activeLocationId: loc.id,
    }));
    setNewFaceChainageFrom(lastChainage);
    setNewFacePullLength(3.0);
    setNewFaceExcavationMode(loc.defaultExcavationMode || 'Drill & Blast (Full Face)');
    setNewFaceMethod(workflowMode);
    setSetupWindowStep('face');
    setShowNewFaceModal(true);
  };

  const handleConfirmCreateNewFace = () => {
    if (!activeProject || !activeLocation) return;
    const baseRound = createDefaultExcavationRound(
      activeProject.id,
      activeLocation,
      newFaceChainageFrom.trim() || '100.0',
      Math.max(0.1, Number(newFacePullLength) || 3.0)
    );
    const newRound: FieldExcavationRound = {
      ...baseRound,
      geologistName: newFaceGeologist.trim() || 'Site Engineering Geologist',
      modeOfExcavation: newFaceExcavationMode.trim() || baseRound.modeOfExcavation,
      mappingMethod: newFaceMethod,
      completionStatus: 'in_progress',
      reviewStatus: 'none',
    };
    setWorkflowMode(newFaceMethod);
    setStore((prev) => ({
      ...prev,
      rounds: [newRound, ...prev.rounds],
      activeLocationId: activeLocation.id,
      activeRoundId: newRound.id,
    }));
    setShowNewFaceModal(false);
    setStage('excavation_round');
  };

  // Update a Discontinuity Set record in Stage 6
  const handleUpdateDiscontinuitySet = (
    setId: FieldJointSetId,
    patch: Partial<FieldDiscontinuitySetRecord>
  ) => {
    updateActiveRound((r) => ({
      ...r,
      discontinuitySets: {
        ...r.discontinuitySets,
        [setId]: {
          ...r.discontinuitySets[setId],
          ...patch,
        },
      },
    }));
  };

  // Helper to update Chainage From or Pull and automatically recalculate Chainage To
  const handleUpdateChainageAndPull = (newChainageFrom: string, newPullM: number) => {
    const parsedFrom = parseFloat(newChainageFrom.replace(/[^0-9.]/g, '')) || 0;
    const pull = Math.max(0.1, Number(newPullM) || 0);
    const computedTo = (parsedFrom + pull).toFixed(1);
    updateActiveRound((r) => ({
      ...r,
      chainageFrom: newChainageFrom,
      pullLengthMeters: pull,
      chainageTo: computedTo,
    }));
  };

  const isReportStage =
    stage === 'word_template_export' ||
    stage === 'photo_2d_report' ||
    stage === 'advance_analysis' ||
    stage === 'geology_3d_report';

  const surfaceSmrAnalysis = useMemo(() => {
    if (mappingDomain === 'TUNNEL') return null;
    const rawDiscontinuitySets = activeRound?.discontinuitySets
      ? Array.isArray(activeRound.discontinuitySets)
        ? activeRound.discontinuitySets
        : Object.values(activeRound.discontinuitySets)
      : [];
    const sets = rawDiscontinuitySets
      .filter((ds) => ds && ds.enabled !== false)
      .map((ds) => ({
        id: ds.setId || 'J1',
        meanDip: Number(ds.dipAmount) || 55,
        meanDipDirection: Number(ds.dipDirection) || 120,
      }));
    const fallbackSets =
      sets.length > 0
        ? sets
        : [
            {
              id: 'J1',
              meanDip: 58,
              meanDipDirection: surfaceParams.faceDipDirectionDeg,
            },
            {
              id: 'J2',
              meanDip: 66,
              meanDipDirection: (surfaceParams.faceDipDirectionDeg + 75) % 360,
            },
          ];
    const rmrVal = Number(activeRound?.rmrTotal) || 64;
    return evaluateSurfaceStabilityAndRomanaSmr(surfaceParams, rmrVal, fallbackSets);
  }, [mappingDomain, activeRound?.discontinuitySets, activeRound?.rmrTotal, surfaceParams]);

  useEffect(() => {
    if (mappingDomain !== 'TUNNEL') {
      saveSurfaceMappingResumeState({
        subType: mappingDomain as SurfaceMappingSubType,
        workflowMode: 'FIELD',
        stageOrScreen: stage,
        projectName: activeProject?.projectName || 'Surface Project',
        locationName: activeLocation?.name || surfaceParams.benchNumberLabel,
        stationLabel: activeRound
          ? `ST ${activeRound.chainageFrom}m–${activeRound.chainageTo}m`
          : surfaceParams.benchNumberLabel,
        updatedAt: new Date().toISOString(),
      });
    }
  }, [
    mappingDomain,
    stage,
    activeProject?.projectName,
    activeLocation?.name,
    activeRound,
    surfaceParams.benchNumberLabel,
  ]);

  const handleApplySurfaceDimensionsToLocation = () => {
    if (!activeProject || !activeLocation) return;
    const nextW =
      mappingDomain === 'TRENCH'
        ? Math.max(0.8, Number(surfaceParams.trenchWidthMeters) || 2.0)
        : mappingDomain === 'ROCK_SURFACE'
        ? Math.max(1.5, Number(surfaceParams.rockExposureWidthMeters) || 12.0)
        : Math.max(2.0, Number(surfaceParams.exposureLengthMeters) || 15.0);
    const nextH =
      mappingDomain === 'TRENCH'
        ? Math.max(0.8, Number(surfaceParams.trenchDepthMeters) || 2.5)
        : mappingDomain === 'SLOPE'
        ? Math.max(2.0, Number(surfaceParams.slopeHeightMeters) || 18.0)
        : mappingDomain === 'ROCK_SURFACE'
        ? Math.max(1.5, Number(surfaceParams.rockExposureHeightMeters) || 8.0)
        : Math.max(1.5, Number(surfaceParams.benchHeightMeters) || 10.0);

    setStore((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === activeProject.id
          ? {
              ...p,
              locations: p.locations.map((l) =>
                l.id === activeLocation.id
                  ? {
                      ...l,
                      shape: 'rectangular',
                      widthM: nextW,
                      heightM: nextH,
                      wallHeightM: nextH,
                    }
                  : l
              ),
            }
          : p
      ),
    }));
  };

  return (
    <div
      className={`relative h-dvh w-full max-w-full min-h-0 overflow-hidden flex flex-col select-none ${
        isReportStage ? 'bg-white text-slate-900' : 'bg-transparent text-slate-100'
      }`}
    >
      {/* Subtle Background ESWA Official Logo Watermark & Geological Orange Map (No Logo Watermark on Canvas Areas or Reports) */}
      <EswaAppBackgroundWatermark
        visible={!isReportStage}
        showLogoWatermark={
          !isReportStage &&
          stage !== 'field_canvas' &&
          stage !== 'joint_grouping' &&
          stage !== 'photo_fit'
        }
      />

      {/* ==================== TOP HORIZONTAL FIELD BAR ==================== */}
      <header className="relative z-20 eswa-landscape-compact-header min-h-10 h-11 px-2 sm:px-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0 overflow-x-auto no-scrollbar mouse-scrollable touch-pan-x">
        <div className="flex items-center gap-1.5 shrink-0">
          <EswaTunnelLogo size="xs" variant="emblem" />
          <button
            type="button"
            onClick={() => {
              if (onBackToWelcome) onBackToWelcome();
              else if (onExitToWelcome) onExitToWelcome();
            }}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] flex items-center gap-1 border border-slate-700 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-orange-500" />
            <span>Menu</span>
          </button>

          {/* Top-Left High-Contrast Segmented 3-Mode Selector (NATM | TBM | MINING) */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-700/80 shadow-xs shrink-0">
            {(['NATM', 'TBM', 'MINING'] as IndustryMode[]).map((m) => {
              const isAct = currentIndustryMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleModeSwitch(m)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    isAct
                      ? m === 'NATM'
                        ? 'bg-amber-500 text-slate-950 font-black shadow'
                        : m === 'TBM'
                        ? 'bg-cyan-500 text-slate-950 font-black shadow'
                        : 'bg-emerald-500 text-slate-950 font-black shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={
                    m === 'NATM'
                      ? 'NATM: New Austrian Tunnelling Method'
                      : m === 'TBM'
                      ? 'TBM: Shield Tunnel Boring Machine'
                      : 'MINING: Underground Hardrock Mining Stope & Grade Control'
                  }
                >
                  {m}
                </button>
              );
            })}
          </div>

          {currentIndustryMode === 'MINING' && (
            <button
              type="button"
              onClick={() => setIsMiningInspectorOpen(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30 transition-all cursor-pointer shadow-sm shrink-0"
              title="Open Mining Stope, Veins & Mathews Stability Inspector"
            >
              <Pickaxe className="w-3 h-3 text-amber-400" />
              <span>Stope &amp; Veins</span>
            </button>
          )}

          {currentIndustryMode === 'TBM' && (
            <button
              type="button"
              onClick={() => setIsTbmInspectorOpen(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 hover:bg-cyan-500/30 transition-all cursor-pointer shadow-sm shrink-0"
              title="Open TBM Shield & Ring Inspector"
            >
              <CircleDot className="w-3 h-3 text-cyan-400" />
              <span>TBM Shield</span>
            </button>
          )}
        </div>

        {/* Horizontal Field & Photo Mapping Workflow Navigation */}
        <div className="flex items-center gap-1 shrink-0">
          {(
            (workflowMode === 'field_mapping'
              ? [
                  ['project_setup', '1. Project & Data'],
                  [
                    'excavation_round',
                    mappingDomain === 'TUNNEL'
                      ? '2. Round & Pull'
                      : `2. ${domainPanelMap.domainTitle.replace(' Mapping', '')} Station`,
                  ],
                  [
                    'field_canvas',
                    mappingDomain === 'TUNNEL'
                      ? '3. Face Canvas'
                      : `3. ${domainPanelMap.face.shortLabel}`,
                  ],
                  [
                    'joint_grouping',
                    mappingDomain === 'TRENCH' ? '4. Unrolled 3-Panel Log' : '4. Group Joints',
                  ],
                  ['strip_align', '5. Strip Log'],
                  ['discontinuity_sets', '6. Discontinuity Sets'],
                  [
                    'q_rmr_gsi',
                    mappingDomain === 'TUNNEL' ? '7. Q / RMR / GSI' : '7. SMR / RMR / GSI',
                  ],
                  [
                    'support_system',
                    mappingDomain === 'TUNNEL' ? '8. Support System' : '8. Surface Stabilization',
                  ],
                  [
                    'survey_overbreak',
                    mappingDomain === 'TUNNEL' ? '9. Survey & OB' : '9. Crest/Toe Survey',
                  ],
                  ['word_template_export', '10. Clean Report'],
                  ['photo_2d_report', '11. 2D Photo Report'],
                  ['advance_analysis', '12. Advance Analysis'],
                ]
              : [
                  ['project_setup', '1. Project & Data'],
                  [
                    'excavation_round',
                    mappingDomain === 'TUNNEL'
                      ? '2. Round & Pull'
                      : `2. ${domainPanelMap.domainTitle.replace(' Mapping', '')} Station`,
                  ],
                  ['camera_prompt', '3. Upload Photos'],
                  ['photo_fit', '4. Photo Fit'],
                  [
                    'field_canvas',
                    mappingDomain === 'TUNNEL'
                      ? '5. Face Canvas'
                      : `5. ${domainPanelMap.face.shortLabel}`,
                  ],
                  [
                    'joint_grouping',
                    mappingDomain === 'TRENCH' ? '6. Unrolled 3-Panel Log' : '6. Group Joints',
                  ],
                  ['strip_align', '7. Strip Log'],
                  ['discontinuity_sets', '8. Discontinuity Sets'],
                  [
                    'q_rmr_gsi',
                    mappingDomain === 'TUNNEL' ? '9. Q / RMR / GSI' : '9. SMR / RMR / GSI',
                  ],
                  [
                    'support_system',
                    mappingDomain === 'TUNNEL' ? '10. Support System' : '10. Surface Stabilization',
                  ],
                  [
                    'survey_overbreak',
                    mappingDomain === 'TUNNEL' ? '11. Survey & OB' : '11. Crest/Toe Survey',
                  ],
                  ['word_template_export', '12. Clean Report'],
                  ['photo_2d_report', '13. 2D Photo Report'],
                  ['advance_analysis', '14. Advance Analysis'],
                ]) as [FieldWorkflowStage, string][]
          ).map(([stKey, label]) => {
            const isAdv = stKey === 'advance_analysis';
            const isActive = stage === stKey;
            return (
              <button
                key={stKey}
                onClick={() => {
                  if (pending2DTrace) {
                    commitPending2DTraceToRound(pending2DTrace);
                  }
                  setStage(stKey);
                }}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] sm:text-[11px] font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1 ${
                  isActive
                    ? isAdv
                      ? 'bg-amber-500 text-slate-950 font-black shadow-[0_2px_12px_rgba(245,158,11,0.55)] ring-2 ring-amber-300'
                      : 'bg-orange-500 text-white shadow-[0_2px_10px_rgba(234,88,12,0.38)]'
                    : isAdv
                    ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40 hover:bg-amber-900/80 hover:text-amber-200'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
                title={
                  isAdv
                    ? 'Advance Geological Analysis: Wedge FoS, 4-Surface Apparent Dip, Face Look-Ahead & Inflow'
                    : label
                }
              >
                {isAdv && <Zap className="w-3.5 h-3.5 fill-current" />}
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {activeGeologist && (
            <button
              type="button"
              onClick={() => setIsGlobalSettingsOpen(true)}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                activeGeologist.role === 'Contractor'
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                  : activeGeologist.role === 'PMC'
                  ? 'bg-blue-500/10 text-blue-300 border-blue-500/30 hover:bg-blue-500/20'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
              }`}
              title={`Active Geologist: ${activeGeologist.name} (${activeGeologist.role}) - Click to switch profile`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold">[{activeGeologist.role}]</span>
              <span className="truncate max-w-[110px]">{activeGeologist.name}</span>
            </button>
          )}

          {onOpenContinuousTunnelLog && (
            <button
              type="button"
              onClick={onOpenContinuousTunnelLog}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 hover:text-cyan-200 border border-cyan-500/40 shadow-xs transition-all cursor-pointer"
              title="Launch Continuous 3D Tunnel Strip Log & Multi-Pull CAD"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden xl:inline">Continuous 3D Log</span>
            </button>
          )}

          {onOpenCoreLogging && (
            <button
              type="button"
              onClick={onOpenCoreLogging}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 hover:text-emerald-200 border border-emerald-500/40 shadow-xs transition-all cursor-pointer"
              title="Open Diamond Drill Core Logging & RQD/Box Photography"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden xl:inline">Core Logging</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsGlobalSettingsOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 shadow-sm transition-all cursor-pointer"
            title="Open Global Settings (Google Account, Device ID, Multi-Device Project Sync, Geologist Profiles & Signatures)"
          >
            <Settings className="w-3.5 h-3.5 text-orange-400" />
            <span className="hidden md:inline">Settings</span>
          </button>

          <ThemeToggleButton compact />
          <div className="hidden md:flex items-center gap-1 text-[10.5px] text-emerald-500 font-semibold shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Saved</span>
          </div>
        </div>
      </header>

      <div
        key={stage}
        className="relative z-10 flex-1 min-h-0 flex flex-col overflow-hidden eswa-stage-transition"
      >

      {/* ==================== STAGE 1: SEQUENTIAL PROJECT -> LOCATION -> FACE / STATION WINDOWS ==================== */}
      {stage === 'project_setup' && (
        <div className="flex-1 min-h-0 flex flex-col gap-2 p-2 sm:p-2.5 overflow-y-auto md:overflow-hidden touch-pan-y">
          {/* Sequential Window Stepper Bar */}
          <div className="bg-slate-900/95 border border-slate-800 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {mappingDomain !== 'TUNNEL' && (
                <>
                  <button
                    type="button"
                    onClick={() => setSetupWindowStep('surface_type')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                      setupWindowStep === 'surface_type'
                        ? 'bg-orange-500 text-slate-950 shadow'
                        : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>0. Surface Type: {mappingDomain.replace('_', ' ')}</span>
                  </button>
                  <span className="text-slate-600 text-xs font-black">→</span>
                </>
              )}
              <button
                type="button"
                onClick={() => setSetupWindowStep('project')}
                className={`px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                  setupWindowStep === 'project'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>
                  1. Project Window ({activeProject ? formatDomainProjName(activeProject.projectName) : 'Select'})
                </span>
              </button>
              <span className="text-slate-600 text-xs font-black">→</span>
              <button
                type="button"
                onClick={() => setSetupWindowStep('location')}
                className={`px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                  setupWindowStep === 'location'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>
                  2. Location Window ({activeLocation ? formatDomainLocName(activeLocation.name) : 'Select'})
                </span>
              </button>
              <span className="text-slate-600 text-xs font-black">→</span>
              <button
                type="button"
                onClick={() => setSetupWindowStep('face')}
                className={`px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                  setupWindowStep === 'face'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'bg-slate-800 text-emerald-300 hover:bg-slate-700'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>
                  3. {mappingDomain === 'TUNNEL' ? 'Face Window' : 'Station / Face Window'}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setSetupLayoutMode((m) => (m === 'wizard' ? 'columns' : 'wizard'))
                }
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-bold text-slate-300 cursor-pointer"
                title="Switch between Step-by-Step Window view and 3-Column Overview"
              >
                {setupLayoutMode === 'wizard' ? 'Show All 3 Columns' : 'Step-by-Step Windows'}
              </button>
            </div>
          </div>

          {/* STEP 0 (SURFACE MAPPING ONLY): FIRST ASK BENCH, TRENCH, ROCK SURFACE, OR SLOPE */}
          {mappingDomain !== 'TUNNEL' &&
            setupLayoutMode === 'wizard' &&
            setupWindowStep === 'surface_type' && (
              <div className="flex-1 min-h-0 bg-slate-900/95 border border-amber-500/40 rounded-2xl p-4 sm:p-6 flex flex-col justify-between overflow-y-auto">
                <div className="max-w-3xl mx-auto w-full space-y-4">
                  <div className="text-center space-y-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-black uppercase tracking-wider">
                      Surface Mapping Setup • Step 0
                    </span>
                    <h2 className="text-lg sm:text-xl font-black text-white">
                      Select Surface Mapping Structure Type
                    </h2>
                    <p className="text-xs text-slate-400">
                      Choose whether you are mapping a Bench, Trench, Exposed Rock Surface, or Cut/Natural Slope. Then proceed to Project → Location → Face/Station.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(
                      [
                        {
                          id: 'BENCH' as MappingDomainType,
                          title: '1. Bench Mapping',
                          subtitle: 'Open-Pit Quarry & Mine Bench Face + Berm Width & Romana SMR',
                          badge: 'Bench Face & Berm',
                        },
                        {
                          id: 'TRENCH' as MappingDomainType,
                          title: '2. Trench Mapping',
                          subtitle: 'Unrolled 3-Panel Trench Log (Left Wall • Floor • Right Wall)',
                          badge: '3-Panel Trench',
                        },
                        {
                          id: 'ROCK_SURFACE' as MappingDomainType,
                          title: '3. Surface / Outcrop Mapping',
                          subtitle: '1-Panel or Multi-Panel Exposed Rock Surface Window Mapping',
                          badge: 'Rock Surface',
                        },
                        {
                          id: 'SLOPE' as MappingDomainType,
                          title: '4. Slope Mapping',
                          subtitle: 'Engineered Cut Slope & Natural Rock Slope Kinematic & SMR Analysis',
                          badge: 'Cut / Natural Slope',
                        },
                      ]
                    ).map((item) => {
                      const active = mappingDomain === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            handleSelectMappingDomain(item.id);
                            setSetupWindowStep('project');
                          }}
                          className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                            active
                              ? 'bg-amber-500/20 border-amber-400 shadow-lg'
                              : 'bg-slate-950/80 border-slate-800 hover:border-amber-500/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-black text-white">{item.title}</span>
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                              {item.badge}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300">{item.subtitle}</p>
                          <div className="text-[11px] font-black text-amber-400 flex items-center justify-end gap-1 pt-1">
                            <span>Select &amp; Continue to Project Window →</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

          {!(
            mappingDomain !== 'TUNNEL' &&
            setupLayoutMode === 'wizard' &&
            setupWindowStep === 'surface_type'
          ) && (
            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-2.5 overflow-y-auto md:overflow-hidden touch-pan-y">
          {/* Col 1-4: Window 1 - Projects List */}
          <div
            className={`${
              setupLayoutMode === 'wizard'
                ? setupWindowStep === 'project'
                  ? 'md:col-span-12 max-w-4xl mx-auto w-full'
                  : 'hidden'
                : 'md:col-span-4'
            } min-h-[220px] md:min-h-0 h-full bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-col overflow-hidden`}
          >
            <div className="flex items-center justify-between mb-2 gap-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <FolderPlus className="w-4 h-4" />
                1. First Window: Select Existing Project or Create New
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowProjectSettingsBox((v) => !v)}
                  className={`px-2 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 border cursor-pointer ${
                    showProjectSettingsBox
                      ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-cyan-500/40'
                  }`}
                  title="Project Settings & Chainage Data Grouping"
                >
                  <Sliders className="w-3 h-3" />
                  Project Settings
                </button>
                <button
                  onClick={() => setShowNewProjectForm(!showNewProjectForm)}
                  className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New
                </button>
              </div>
            </div>

            {showProjectSettingsBox && activeProject && (
              <div className="bg-slate-950 border border-cyan-500/50 rounded-xl p-2.5 mb-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-black uppercase tracking-wider text-cyan-300">
                    Project Settings &amp; Data Grouping ({activeProject.projectName})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowProjectSettingsBox(false)}
                    className="text-slate-400 hover:text-white text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="block text-[9.5px] text-slate-400">Project Name</label>
                    <input
                      type="text"
                      value={activeProject.projectName}
                      onChange={(e) =>
                        updateActiveProject((p) => ({ ...p, projectName: e.target.value }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] text-slate-400">Client Name</label>
                    <input
                      type="text"
                      value={activeProject.clientName}
                      onChange={(e) =>
                        updateActiveProject((p) => ({ ...p, clientName: e.target.value }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] text-slate-400">Contractor</label>
                    <input
                      type="text"
                      value={activeProject.contractorName}
                      onChange={(e) =>
                        updateActiveProject((p) => ({ ...p, contractorName: e.target.value }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] text-slate-400">Consultant</label>
                    <input
                      type="text"
                      value={activeProject.consultantName}
                      onChange={(e) =>
                        updateActiveProject((p) => ({ ...p, consultantName: e.target.value }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                </div>
                <div className="pt-1.5 border-t border-slate-800">
                  <label className="block text-[10px] font-bold text-cyan-300 mb-1">
                    {mappingDomain === 'TUNNEL'
                      ? 'Face Data Chainage Grouping Range (From → To)'
                      : `${domainPanelMap.domainTitle} Station Grouping Range (From → To)`}
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {[10, 20, 25, 50, 100].map((span) => (
                      <button
                        key={span}
                        type="button"
                        onClick={() => {
                          setChainageGroupIntervalM(span);
                          setSelectedChainageBucket('ALL');
                        }}
                        className={`py-1 rounded text-[10px] font-black border cursor-pointer ${
                          chainageGroupIntervalM === span
                            ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                        }`}
                      >
                        {span}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {showNewProjectForm && (
              <div className="bg-slate-950 border border-amber-500/40 rounded-lg p-2.5 mb-2 space-y-2">
                <input
                  type="text"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  placeholder={
                    mappingDomain === 'TUNNEL'
                      ? 'Project Name (e.g. Himalayan HEP Lot-2)'
                      : `Project Name (e.g. ${domainPanelMap.domainTitle} Lot-1)`
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                />
                <div className="grid grid-cols-3 gap-1.5">
                  <input
                    type="text"
                    value={newProjClient}
                    onChange={(e) => setNewProjClient(e.target.value)}
                    placeholder="Client"
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={newProjContractor}
                    onChange={(e) => setNewProjContractor(e.target.value)}
                    placeholder="Contractor"
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={newProjConsultant}
                    onChange={(e) => setNewProjConsultant(e.target.value)}
                    placeholder="Consultant"
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                  />
                </div>
                <button
                  onClick={handleCreateProject}
                  className="w-full py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                >
                  Save Project
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {store.projects.map((proj) => {
                const isSelected = activeProject?.id === proj.id;
                return (
                  <div
                    key={proj.id}
                    onClick={() => {
                      setStore((prev) => ({
                        ...prev,
                        activeProjectId: proj.id,
                        activeLocationId: proj.locations[0]?.id || null,
                      }));
                      setSetupWindowStep('location');
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 shadow'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-sm text-white truncate">
                        {formatDomainProjName(proj.projectName)}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeleteConfirm({
                            kind: 'project',
                            id: proj.id,
                            label: formatDomainProjName(proj.projectName),
                          });
                        }}
                        className="p-1 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-800/50 text-rose-300 cursor-pointer shrink-0"
                        title="Delete Project"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Client: {proj.clientName} • Contractor: {proj.contractorName}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-amber-400 font-semibold">
                        {proj.locations.length}{' '}
                        {mappingDomain === 'TUNNEL'
                          ? 'Tunnel Location(s)'
                          : `${domainPanelMap.domainTitle} Sector(s)`}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10.5px]">
                        Select Project → Location Window
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Col 5-8: Window 2 - Locations / Surface Sectors & Geometry */}
          <div
            className={`${
              setupLayoutMode === 'wizard'
                ? setupWindowStep === 'location'
                  ? 'md:col-span-12 max-w-4xl mx-auto w-full'
                  : 'hidden'
                : 'md:col-span-4'
            } min-h-[240px] md:min-h-0 h-full bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-col overflow-hidden`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {setupLayoutMode === 'wizard' && (
                  <button
                    type="button"
                    onClick={() => setSetupWindowStep('project')}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer"
                  >
                    ← Back to Projects
                  </button>
                )}
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {mappingDomain === 'TUNNEL'
                  ? '2. Tunnel Location, Shape & Size'
                  : mappingDomain === 'BENCH'
                  ? '2. Bench Sector, Height & Berm Width'
                  : mappingDomain === 'TRENCH'
                  ? '2. Trench Sector, Width & Depth'
                  : mappingDomain === 'ROCK_SURFACE'
                  ? '2. Rock Surface Sector & Window Size'
                  : '2. Slope Sector, Height & Angle'}
              </h2>
              </div>
              <button
                onClick={() => {
                  if (mappingDomain !== 'TUNNEL') {
                    setNewLocShape('rectangular');
                  }
                  setShowNewLocationForm(!showNewLocationForm);
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {mappingDomain === 'TUNNEL' ? 'Add Location' : 'Add Sector'}
              </button>
            </div>

            {showNewLocationForm && (
              <div className="bg-slate-950 border border-amber-500/40 rounded-lg p-2.5 mb-2 space-y-2">
                <input
                  type="text"
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  placeholder={
                    mappingDomain === 'TUNNEL'
                      ? 'Tunnel Location (e.g. Headrace Tunnel Adit-2)'
                      : mappingDomain === 'BENCH'
                      ? 'Bench Sector (e.g. Pit Bench RL 280–270m North)'
                      : mappingDomain === 'TRENCH'
                      ? 'Trench Sector (e.g. Foundation Trench TR-01)'
                      : mappingDomain === 'ROCK_SURFACE'
                      ? 'Rock Surface Sector (e.g. Outcrop Window RS-01)'
                      : 'Slope Sector (e.g. Portal Cut Slope CS-01)'
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                />
                {mappingDomain === 'TUNNEL' ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[10px] text-slate-400">Tunnel Shape</label>
                      <select
                        value={newLocShape}
                        onChange={(e) => {
                          const val = e.target.value as FieldTunnelShapeType;
                          setNewLocShape(val);
                          if (val === 'freeform_custom') {
                            setCustomBuilderTarget('new_location');
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      >
                        {FIELD_TUNNEL_SHAPES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">Drive Azimuth (°)</label>
                      <input
                        type="number"
                        min={0}
                        max={360}
                        value={newLocAzimuth}
                        onChange={(e) => setNewLocAzimuth(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[10px] text-slate-400">Surface Geometry</label>
                      <input
                        type="text"
                        readOnly
                        value={
                          mappingDomain === 'BENCH'
                            ? 'Bench Face & Berm (Rectangular)'
                            : mappingDomain === 'TRENCH'
                            ? '3-Panel Trench Log (L-Wall/Floor/R-Wall)'
                            : mappingDomain === 'ROCK_SURFACE'
                            ? 'Exposed Rock Surface Window'
                            : 'Cut / Natural Slope Face (Rectangular)'
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-amber-300 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">
                        {mappingDomain === 'TRENCH'
                          ? 'Trench Axis Azimuth (°)'
                          : 'Face Dip Direction (°)'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={360}
                        value={newLocAzimuth}
                        onChange={(e) => setNewLocAzimuth(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="block text-[10px] text-slate-400">
                      {mappingDomain === 'TUNNEL'
                        ? 'Width / Span (m)'
                        : mappingDomain === 'TRENCH'
                        ? 'Trench Width Wt (m)'
                        : 'Exposure Length / Width (m)'}
                    </label>
                    <input
                      type="number"
                      step={0.1}
                      value={newLocWidth}
                      onChange={(e) => setNewLocWidth(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">
                      {mappingDomain === 'TUNNEL'
                        ? 'Height (m)'
                        : mappingDomain === 'BENCH'
                        ? 'Bench Height Hb (m)'
                        : mappingDomain === 'TRENCH'
                        ? 'Trench Depth Dt (m)'
                        : mappingDomain === 'ROCK_SURFACE'
                        ? 'Exposure Height Hr (m)'
                        : 'Slope Height Hs (m)'}
                    </label>
                    <input
                      type="number"
                      step={0.1}
                      value={newLocHeight}
                      onChange={(e) => setNewLocHeight(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCreateLocation}
                  className="w-full py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                >
                  {mappingDomain === 'TUNNEL'
                    ? 'Create Tunnel Location'
                    : `Create ${domainPanelMap.domainTitle} Sector`}
                </button>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto touch-pan-y space-y-2 pr-1">
              {activeProject?.locations.map((loc) => {
                const isSelected = activeLocation?.id === loc.id;
                const displayW =
                  mappingDomain !== 'TUNNEL' && isSelected ? activeLocation.widthM : loc.widthM;
                const displayH =
                  mappingDomain !== 'TUNNEL' && isSelected ? activeLocation.heightM : loc.heightM;
                return (
                  <div
                    key={loc.id}
                    onClick={() => {
                      setStore((prev) => ({
                        ...prev,
                        activeLocationId: loc.id,
                      }));
                      setSetupWindowStep('face');
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 shadow'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-white truncate">
                        {formatDomainLocName(loc.name)}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-[10px] uppercase">
                          {mappingDomain === 'TUNNEL'
                            ? loc.shape.replace(/_/g, ' ')
                            : `${mappingDomain} PROFILE`}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDeleteConfirm({
                              kind: 'location',
                              id: loc.id,
                              label: formatDomainLocName(loc.name),
                            });
                          }}
                          className="p-1 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-800/50 text-rose-300 cursor-pointer"
                          title="Delete Location / Sector"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-slate-300 mt-1 font-mono">
                      {mappingDomain === 'TUNNEL' ? (
                        <>
                          Size: <strong>{displayW}m (W)</strong> × <strong>{displayH}m (H)</strong>{' '}
                          • Drive: N{String(loc.defaultDriveAzimuth).padStart(3, '0')}°
                        </>
                      ) : mappingDomain === 'BENCH' ? (
                        <>
                          Bench Face: <strong>{displayW}m Span</strong> ×{' '}
                          <strong>{surfaceParams.benchHeightMeters}m Hb</strong> • Berm:{' '}
                          <strong>{surfaceParams.bermWidthMeters}m</strong> • Dip Dir:{' '}
                          <strong>
                            {String(surfaceParams.faceDipDirectionDeg).padStart(3, '0')}°/
                            {surfaceParams.faceDipAngleDeg}°
                          </strong>
                        </>
                      ) : mappingDomain === 'TRENCH' ? (
                        <>
                          Trench: <strong>{surfaceParams.trenchWidthMeters}m Wt</strong> ×{' '}
                          <strong>{surfaceParams.trenchDepthMeters}m Dt</strong> • Axis:{' '}
                          <strong>
                            N{String(surfaceParams.faceDipDirectionDeg).padStart(3, '0')}°
                          </strong>
                        </>
                      ) : mappingDomain === 'ROCK_SURFACE' ? (
                        <>
                          Rock Surface: <strong>{displayW}m Wr</strong> ×{' '}
                          <strong>{displayH}m Hr</strong> • Dip:{' '}
                          <strong>
                            {String(surfaceParams.faceDipDirectionDeg).padStart(3, '0')}°/
                            {surfaceParams.faceDipAngleDeg}°
                          </strong>{' '}
                          •{' '}
                          <strong>
                            {surfaceParams.rockSurfaceSinglePanelOnly
                              ? '1-Panel Window'
                              : 'Multi-Panel'}
                          </strong>
                        </>
                      ) : (
                        <>
                          Slope: <strong>{displayW}m Span</strong> ×{' '}
                          <strong>{surfaceParams.slopeHeightMeters}m Hs</strong> • Angle:{' '}
                          <strong>{surfaceParams.overallSlopeAngleDeg}°</strong> • Dip Dir:{' '}
                          <strong>
                            {String(surfaceParams.faceDipDirectionDeg).padStart(3, '0')}°
                          </strong>
                        </>
                      )}
                    </div>

                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between gap-2"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStore((prev) => ({
                            ...prev,
                            activeLocationId: loc.id,
                          }));
                          setSetupWindowStep('face');
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer"
                      >
                        Open Face Window (View / Create Faces) →
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartNewRoundForLocation(loc);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
                      >
                        + New Face
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Col 9-12: Window 3 - Stored Mapping Rounds / Stations with Completion & Review Status */}
          <div
            className={`${
              setupLayoutMode === 'wizard'
                ? setupWindowStep === 'face'
                  ? 'md:col-span-12 max-w-5xl mx-auto w-full'
                  : 'hidden'
                : 'md:col-span-4'
            } min-h-[220px] md:min-h-0 h-full bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-col overflow-hidden`}
          >
            <div className="flex items-center justify-between mb-1.5 shrink-0 gap-2">
              <div className="flex items-center gap-2">
                {setupLayoutMode === 'wizard' && (
                  <button
                    type="button"
                    onClick={() => setSetupWindowStep('location')}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer"
                  >
                    ← Back to Locations
                  </button>
                )}
                <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  {mappingDomain === 'TUNNEL'
                    ? '3. Third Window: Face Data & Completion / Review Status'
                    : `3. Third Window: ${domainPanelMap.domainTitle} Stations & Status`}
                </h2>
              </div>
              {activeLocation && (
                <button
                  onClick={() => handleStartNewRoundForLocation(activeLocation)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1 cursor-pointer shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {mappingDomain === 'TUNNEL'
                    ? 'New Face (Ask Details & Method)'
                    : `New ${mappingDomain === 'BENCH' ? 'Bench' : mappingDomain === 'TRENCH' ? 'Trench' : 'Slope'} Face`}
                </button>
              )}
            </div>

            {/* New Face Details & Field vs Photogrammetry Method Modal / Card */}
            {showNewFaceModal && activeLocation && (
              <div className="mb-3 p-3.5 rounded-xl bg-slate-950 border-2 border-emerald-500/60 shadow-2xl space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                      Create New {mappingDomain === 'TUNNEL' ? 'Tunnel Face' : `${domainPanelMap.domainTitle} Station`}
                    </span>
                    <h3 className="text-sm font-black text-white">
                      Enter Face Details &amp; Choose Mapping Method (Field or Photogrammetry)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewFaceModal(false)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-0.5">
                      Chainage From (m)
                    </label>
                    <input
                      type="text"
                      value={newFaceChainageFrom}
                      onChange={(e) => setNewFaceChainageFrom(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-0.5">
                      Pull / Advance Length (m)
                    </label>
                    <input
                      type="number"
                      step={0.1}
                      min={0.1}
                      value={newFacePullLength}
                      onChange={(e) => setNewFacePullLength(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-0.5">
                      Geologist Name
                    </label>
                    <input
                      type="text"
                      value={newFaceGeologist}
                      onChange={(e) => setNewFaceGeologist(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-0.5">
                      Excavation Method
                    </label>
                    <input
                      type="text"
                      value={newFaceExcavationMode}
                      onChange={(e) => setNewFaceExcavationMode(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10.5px] font-black uppercase tracking-wider text-amber-300 mb-1.5">
                    Select Mapping Method for This Face:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewFaceMethod('field_mapping')}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        newFaceMethod === 'field_mapping'
                          ? 'bg-emerald-500/20 border-emerald-400 shadow'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-300">
                          1. Field Mapping Method
                        </span>
                        {newFaceMethod === 'field_mapping' && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-black">
                            ✓ Selected
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1">
                        In-built Field Camera capture + direct 2D &amp; 3D structural, lithology, support, and survey canvas mapping.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewFaceMethod('photo_mapping')}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        newFaceMethod === 'photo_mapping'
                          ? 'bg-cyan-500/20 border-cyan-400 shadow'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-cyan-300">
                          2. Photogrammetry Method
                        </span>
                        {newFaceMethod === 'photo_mapping' && (
                          <span className="px-2 py-0.5 rounded bg-cyan-500 text-slate-950 text-[10px] font-black">
                            ✓ Selected
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1">
                        Upload Face/Wall/Crown photos + warp &amp; fit photos to profile shape + photo-based 2D &amp; 3D tracing.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowNewFaceModal(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCreateNewFace}
                    className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer shadow"
                  >
                    Create Face &amp; Start {newFaceMethod === 'photo_mapping' ? 'Photogrammetry' : 'Field Mapping'} →
                  </button>
                </div>
              </div>
            )}

            {(() => {
              const locRounds = store.rounds
                .filter(
                  (r) =>
                    r.projectId === activeProject?.id && r.locationId === activeLocation?.id
                )
                .sort((a, b) => {
                  const ca = parseFloat(String(a.chainageFrom).replace(/[^0-9.]/g, '')) || 0;
                  const cb = parseFloat(String(b.chainageFrom).replace(/[^0-9.]/g, '')) || 0;
                  return ca - cb;
                });

              const span = Math.max(5, chainageGroupIntervalM || 25);
              const bucketMap = new Map<string, FieldExcavationRound[]>();
              for (const rd of locRounds) {
                const chVal = parseFloat(String(rd.chainageFrom).replace(/[^0-9.]/g, '')) || 0;
                const bStart = Math.floor(chVal / span) * span;
                const bEnd = bStart + span;
                const key = `CH ${bStart}m – ${bEnd}m`;
                const arr = bucketMap.get(key) || [];
                arr.push(rd);
                bucketMap.set(key, arr);
              }
              const bucketKeys = Array.from(bucketMap.keys());
              const effectiveBucket =
                selectedChainageBucket !== 'ALL' && bucketMap.has(selectedChainageBucket)
                  ? selectedChainageBucket
                  : 'ALL';

              const visibleRounds = (
                effectiveBucket === 'ALL' ? locRounds : bucketMap.get(effectiveBucket) || []
              ).filter((rd) => {
                if (!roundFilterQuery.trim()) return true;
                const q = roundFilterQuery.trim().toLowerCase();
                return (
                  String(rd.chainageFrom).toLowerCase().includes(q) ||
                  String(rd.chainageTo).toLowerCase().includes(q) ||
                  String(rd.geologistName || '').toLowerCase().includes(q)
                );
              });

              return (
                <>
                  {/* Chainage From-To Group Filter Pills + Quick Search */}
                  <div className="space-y-1.5 mb-2 shrink-0">
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                      <button
                        type="button"
                        onClick={() => setSelectedChainageBucket('ALL')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black whitespace-nowrap border cursor-pointer ${
                          effectiveBucket === 'ALL'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        All ({locRounds.length})
                      </button>
                      {bucketKeys.map((bKey) => {
                        const cnt = bucketMap.get(bKey)?.length || 0;
                        const active = effectiveBucket === bKey;
                        return (
                          <button
                            key={bKey}
                            type="button"
                            onClick={() => setSelectedChainageBucket(bKey)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold whitespace-nowrap border cursor-pointer ${
                              active
                                ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                                : 'bg-slate-950 text-amber-300 border-slate-800 hover:border-amber-500/40'
                            }`}
                          >
                            {bKey} ({cnt})
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="text"
                      value={roundFilterQuery}
                      onChange={(e) => setRoundFilterQuery(e.target.value)}
                      placeholder={
                        mappingDomain === 'TUNNEL'
                          ? 'Filter face by Chainage From / To (e.g. 103.0)...'
                          : `Filter ${domainPanelMap.domainTitle} station by Chainage...`
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-white"
                    />
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto touch-pan-y space-y-2 pr-1">
                    {visibleRounds.map((rd) => {
                      const isSel = activeRound?.id === rd.id;
                      const roundLabel = `${mappingDomain === 'TUNNEL' ? 'CH' : 'ST'} ${rd.chainageFrom}m → ${rd.chainageTo}m`;
                      const isCompleted =
                        rd.completionStatus === 'completed' || rd.reviewStatus === 'approved';
                      const isReviewReq =
                        rd.completionStatus === 'review_required' ||
                        rd.reviewStatus === 'pending_review';
                      const isChangesReq = rd.reviewStatus === 'changes_requested';
                      return (
                        <div
                          key={rd.id}
                          onClick={() => {
                            if (rd.mappingMethod) {
                              setWorkflowMode(rd.mappingMethod);
                            }
                            setStore((prev) => ({ ...prev, activeRoundId: rd.id }));
                            setStage('excavation_round');
                          }}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                            isSel
                              ? 'bg-emerald-500/15 border-emerald-400 shadow'
                              : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono font-bold text-sm text-white truncate">
                                {roundLabel}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase ${
                                  rd.mappingMethod === 'photo_mapping'
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                }`}
                              >
                                {rd.mappingMethod === 'photo_mapping'
                                  ? 'Photogrammetry'
                                  : 'Field Mapping'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Outside Completion & Review Status Badge */}
                              {isCompleted ? (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950 font-black text-[10px] flex items-center gap-1 shadow">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  {rd.reviewStatus === 'approved'
                                    ? 'Approved & Completed'
                                    : 'Completed'}
                                </span>
                              ) : isChangesReq ? (
                                <span className="px-2 py-0.5 rounded-md bg-rose-500 text-white font-black text-[10px]">
                                  ! Changes Requested
                                </span>
                              ) : isReviewReq ? (
                                <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[10px]">
                                  ⏳ Review Required
                                  {rd.reviewerDeviceId ? ` (${rd.reviewerDeviceId})` : ''}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-bold">
                                  In Progress
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                                {mappingDomain === 'TUNNEL'
                                  ? `Pull: ${rd.pullLengthMeters}m`
                                  : `Span: ${rd.pullLengthMeters}m`}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPendingDeleteConfirm({
                                    kind: 'round',
                                    id: rd.id,
                                    label: roundLabel,
                                  });
                                }}
                                className="p-1 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-800/50 text-rose-300 cursor-pointer"
                                title="Delete Face Round / Station"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="text-[10.5px] text-slate-400 mt-0.5">
                            {mappingDomain === 'TUNNEL' ? (
                              <>
                                {rd.modeOfExcavation} • Drive N
                                {String(rd.tunnelDriveDirection).padStart(3, '0')}° • Support:{' '}
                                {rd.supportSystem?.supportClass ||
                                  rd.supportSystem?.rockClass ||
                                  'Class III'}
                              </>
                            ) : (
                              <>
                                {surfaceParams.benchNumberLabel} • Dip Dir{' '}
                                {String(surfaceParams.faceDipDirectionDeg).padStart(3, '0')}°/
                                {surfaceParams.faceDipAngleDeg}° •{' '}
                                {surfaceSmrAnalysis
                                  ? `SMR ${surfaceSmrAnalysis.governingSmrScore} (Class ${surfaceSmrAnalysis.governingSmrClass})`
                                  : surfaceParams.excavationMethod}
                              </>
                            )}
                          </div>
                          {rd.reviewerRemarks && (
                            <div className="mt-1 px-2 py-1 rounded bg-slate-900 border border-amber-500/30 text-[10px] text-amber-200">
                              <strong>Reviewer Remark:</strong> {rd.reviewerRemarks}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (rd.mappingMethod) setWorkflowMode(rd.mappingMethod);
                                setStore((prev) => ({ ...prev, activeRoundId: rd.id }));
                                setStage('field_canvas');
                              }}
                              className="px-2 py-1 rounded bg-amber-500 text-slate-950 font-bold text-[10.5px] cursor-pointer"
                            >
                              {mappingDomain === 'TUNNEL'
                                ? 'Face Canvas'
                                : domainPanelMap.face.shortLabel}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
          </div>
          )}

          {/* Delete Confirmation Modal */}
          {pendingDeleteConfirm && (
            <div
              onClick={() => setPendingDeleteConfirm(null)}
              className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="max-w-sm w-full bg-slate-900 border border-rose-500/50 rounded-2xl p-5 shadow-2xl space-y-4"
              >
                <div className="flex items-center gap-2.5 text-rose-400">
                  <Trash2 className="w-5 h-5 shrink-0" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    Confirm Delete
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Are you sure you want to delete{' '}
                  <strong className="text-amber-300">{pendingDeleteConfirm.label}</strong>?
                  {pendingDeleteConfirm.kind === 'project'
                    ? ' This will also remove all locations and rounds inside this project.'
                    : pendingDeleteConfirm.kind === 'location'
                    ? ' This will also remove all saved rounds inside this location.'
                    : ' This action cannot be undone.'}
                </p>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setPendingDeleteConfirm(null)}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteItem}
                    className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider cursor-pointer shadow-lg"
                  >
                    Yes, Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== STAGE 2: EXCAVATION ROUND (TUNNEL) OR SURFACE STATION & GEOMETRY DETAILS (BENCH / TRENCH / SLOPE) ==================== */}
      {stage === 'excavation_round' && activeProject && activeLocation && activeRound && (
        <div className="flex-1 min-h-0 flex items-start justify-center p-2 sm:p-4 overflow-y-auto touch-pan-y">
          <div className="w-full max-w-4xl my-auto bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-2xl space-y-3 sm:space-y-4">
            {mappingDomain === 'TUNNEL' ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div>
                    <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-amber-400">
                      Face Mapping Excavation Round Details
                    </h2>
                    <p className="text-xs text-slate-400">
                      Location: <strong>{activeLocation.name}</strong> (
                      {activeLocation.shape.replace(/_/g, ' ').toUpperCase()} —{' '}
                      {activeLocation.widthM}m W × {activeLocation.heightM}m H)
                    </p>
                  </div>
                </div>

                {/* Chainage From, PULL (m), Chainage To, Last Support Chainage */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Chainage From (m)
                    </label>
                    <input
                      type="text"
                      value={activeRound.chainageFrom}
                      onChange={(e) =>
                        handleUpdateChainageAndPull(e.target.value, activeRound.pullLengthMeters)
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-amber-400 mb-1">
                      Pull / Advance Length (m)
                    </label>
                    <input
                      type="number"
                      step={0.1}
                      min={0.1}
                      max={50}
                      value={activeRound.pullLengthMeters}
                      onChange={(e) =>
                        handleUpdateChainageAndPull(
                          activeRound.chainageFrom,
                          Number(e.target.value)
                        )
                      }
                      className="w-full bg-amber-500/10 border-2 border-amber-400 rounded-lg px-3 py-2 text-sm font-mono font-black text-amber-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Chainage To (m) [Auto / Edit]
                    </label>
                    <input
                      type="text"
                      value={activeRound.chainageTo}
                      onChange={(e) =>
                        updateActiveRound((r) => ({ ...r, chainageTo: e.target.value }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-emerald-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Chainage of Last Support (m)
                    </label>
                    <input
                      type="text"
                      value={activeRound.chainageOfLastSupport}
                      onChange={(e) =>
                        updateActiveRound((r) => ({
                          ...r,
                          chainageOfLastSupport: e.target.value,
                        }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-cyan-300"
                    />
                  </div>
                </div>

                {/* Date & Time, Mode of Excavation, Tunnel Drive Direction, Excavation Approach */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Date &amp; Time of Excavation
                    </label>
                    <input
                      type="datetime-local"
                      value={activeRound.dateAndTimeOfExcavation}
                      onChange={(e) =>
                        updateActiveRound((r) => ({
                          ...r,
                          dateAndTimeOfExcavation: e.target.value,
                        }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Mode of Excavation
                    </label>
                    <select
                      value={activeRound.modeOfExcavation}
                      onChange={(e) =>
                        updateActiveRound((r) => ({ ...r, modeOfExcavation: e.target.value }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                    >
                      {[
                        'Drill & Blast (Full Face)',
                        'Drill & Blast (Controlled)',
                        'Roadheader / Mechanical',
                        'TBM',
                        'Hydraulic Breaker / NATM',
                      ].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-400 mb-1">
                      Tunnel Drive Direction (0°–360°)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={360}
                      value={activeRound.tunnelDriveDirection}
                      onChange={(e) =>
                        updateActiveRound((r) => ({
                          ...r,
                          tunnelDriveDirection: Number(e.target.value),
                        }))
                      }
                      className="w-full bg-slate-950 border border-amber-500/50 rounded-lg px-3 py-2 text-sm font-mono font-bold text-amber-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Excavation Approach
                    </label>
                    <select
                      value={activeRound.excavationApproach}
                      onChange={(e) =>
                        updateActiveRound((r) => ({ ...r, excavationApproach: e.target.value }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                    >
                      {[
                        'Full Face',
                        'Top Heading & Bench',
                        'Heading Only',
                        'Bench Only',
                        'Multiple Drift / Side Drift',
                      ].map((ap) => (
                        <option key={ap} value={ap}>
                          {ap}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={() => setStage('project_setup')}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    ← Back to Locations
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    {workflowMode === 'field_mapping' && (
                      <button
                        type="button"
                        onClick={() => setStage('field_canvas')}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs border border-emerald-500/40 cursor-pointer"
                      >
                        Skip Field Camera → Face Canvas
                      </button>
                    )}
                    <button
                      onClick={() => setStage('camera_prompt')}
                      className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer"
                    >
                      {workflowMode === 'field_mapping'
                        ? 'Save Round & Open Field Camera →'
                        : 'Save Round Details & Upload 4 Photos →'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div>
                    <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-amber-400">
                      {mappingDomain === 'BENCH'
                        ? 'Bench Mapping Station & Bench Geometry Details'
                        : mappingDomain === 'TRENCH'
                        ? 'Trench Mapping Station & 3-Wall Log Geometry Details'
                        : 'Slope Mapping Station & Cut / Natural Slope Details'}
                    </h2>
                    <p className="text-xs text-slate-400">
                      Sector: <strong>{surfaceParams.benchNumberLabel}</strong> (
                      {mappingDomain} RECTANGULAR PROFILE — {activeLocation.widthM}m Span ×{' '}
                      {activeLocation.heightM}m Height)
                    </p>
                  </div>
                  {surfaceSmrAnalysis && (
                    <div className="px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-xs font-mono text-amber-300 font-bold">
                      Romana SMR: {surfaceSmrAnalysis.governingSmrScore} (Class{' '}
                      {surfaceSmrAnalysis.governingSmrClass} — {surfaceSmrAnalysis.stabilityLabel})
                    </div>
                  )}
                </div>

                {/* Row 1: Station Chainage From, Mapped Bay Span (m), Station Chainage To, Bench/Trench/Slope ID */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Station / Chainage From (m)
                    </label>
                    <input
                      type="text"
                      value={activeRound.chainageFrom}
                      onChange={(e) =>
                        handleUpdateChainageAndPull(e.target.value, activeRound.pullLengthMeters)
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-amber-400 mb-1">
                      {mappingDomain === 'TRENCH'
                        ? 'Trench Log Bay Length (m)'
                        : 'Mapped Bay / Window Span (m)'}
                    </label>
                    <input
                      type="number"
                      step={0.5}
                      min={0.5}
                      max={200}
                      value={activeRound.pullLengthMeters}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 10;
                        handleUpdateChainageAndPull(activeRound.chainageFrom, val);
                        const nextSurf = { ...surfaceParams, exposureLengthMeters: val };
                        setSurfaceParams(nextSurf);
                        saveSurfaceGeometryParameters(nextSurf);
                      }}
                      className="w-full bg-amber-500/10 border-2 border-amber-400 rounded-lg px-3 py-2 text-sm font-mono font-black text-amber-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Station / Chainage To (m)
                    </label>
                    <input
                      type="text"
                      value={activeRound.chainageTo}
                      onChange={(e) =>
                        updateActiveRound((r) => ({ ...r, chainageTo: e.target.value }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-emerald-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      {mappingDomain === 'BENCH'
                        ? 'Bench ID & RL Label'
                        : mappingDomain === 'TRENCH'
                        ? 'Trench ID & Reference'
                        : 'Slope Cut / Sector ID'}
                    </label>
                    <input
                      type="text"
                      value={surfaceParams.benchNumberLabel}
                      onChange={(e) => {
                        const next = { ...surfaceParams, benchNumberLabel: e.target.value };
                        setSurfaceParams(next);
                        saveSurfaceGeometryParameters(next);
                        updateActiveRound((r) => ({
                          ...r,
                          chainageOfLastSupport: e.target.value,
                        }));
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-cyan-300"
                    />
                  </div>
                </div>

                {/* Row 2: Dedicated Bench / Trench / Slope Geometry Parameters */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 bg-slate-950/80 border border-amber-500/30 rounded-xl p-3">
                  {mappingDomain === 'BENCH' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-amber-300 mb-1">
                          Bench Height Hb (m)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={surfaceParams.benchHeightMeters}
                          onChange={(e) => {
                            const next = {
                              ...surfaceParams,
                              benchHeightMeters: parseFloat(e.target.value) || 10,
                            };
                            setSurfaceParams(next);
                            saveSurfaceGeometryParameters(next);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-amber-300 mb-1">
                          Berm Width Wb (m)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={surfaceParams.bermWidthMeters}
                          onChange={(e) => {
                            const next = {
                              ...surfaceParams,
                              bermWidthMeters: parseFloat(e.target.value) || 5,
                            };
                            setSurfaceParams(next);
                            saveSurfaceGeometryParameters(next);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Crest Elevation RL (m)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={surfaceParams.crestElevationRl}
                          onChange={(e) => {
                            const next = {
                              ...surfaceParams,
                              crestElevationRl: parseFloat(e.target.value) || 280,
                            };
                            setSurfaceParams(next);
                            saveSurfaceGeometryParameters(next);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-emerald-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Toe Elevation RL (m)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={surfaceParams.toeElevationRl}
                          onChange={(e) => {
                            const next = {
                              ...surfaceParams,
                              toeElevationRl: parseFloat(e.target.value) || 270,
                            };
                            setSurfaceParams(next);
                            saveSurfaceGeometryParameters(next);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-cyan-300"
                        />
                      </div>
                    </>
                  )}

                  {mappingDomain === 'TRENCH' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-amber-300 mb-1">
                          Trench Depth Dt (m)
                        </label>
                        <input
                          type="number"
                          step="0.2"
                          value={surfaceParams.trenchDepthMeters}
                          onChange={(e) => {
                            const next = {
                              ...surfaceParams,
                              trenchDepthMeters: parseFloat(e.target.value) || 2.5,
                            };
                            setSurfaceParams(next);
                            saveSurfaceGeometryParameters(next);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-amber-300 mb-1">
                          Trench Width Wt (m)
                        </label>
                        <input
                          type="number"
                          step="0.2"
                          value={surfaceParams.trenchWidthMeters}
                          onChange={(e) => {
                            const next = {
                              ...surfaceParams,
                              trenchWidthMeters: parseFloat(e.target.value) || 2.0,
                            };
                            setSurfaceParams(next);
                            saveSurfaceGeometryParameters(next);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Soil / Overburden (m)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={surfaceParams.overburdenThicknessMeters}
                          onChange={(e) => {
                            const next = {
                              ...surfaceParams,
                              overburdenThicknessMeters: parseFloat(e.target.value) || 0.5,
                            };
                            setSurfaceParams(next);
                            saveSurfaceGeometryParameters(next);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-emerald-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Floor Invert RL (m)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={surfaceParams.toeElevationRl}
                          onChange={(e) => {
                            const next = {
                              ...surfaceParams,
                              toeElevationRl: parseFloat(e.target.value) || 245,
                            };
                            setSurfaceParams(next);
                            saveSurfaceGeometryParameters(next);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-cyan-300"
                        />
                      </div>
                    </>
                  )}

                  {mappingDomain === 'SLOPE' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-amber-300 mb-1">
                          Overall Slope Height Hs (m)
                        </label>
                        <input
                          type="number"
                          step="1"
                          value={surfaceParams.slopeHeightMeters}
                          onChange={(e) => {
                            const next = {
                              ...surfaceParams,
                              slopeHeightMeters: parseFloat(e.target.value) || 20,
                            };
                            setSurfaceParams(next);
                            saveSurfaceGeometryParameters(next);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-amber-300 mb-1">
                          Overall Slope Angle (°)
                        </label>
                        <input
                          type="number"
                          step="1"
                          value={surfaceParams.overallSlopeAngleDeg}
                          onChange={(e) => {
                            const next = {
                              ...surfaceParams,
                              overallSlopeAngleDeg: parseFloat(e.target.value) || 55,
                            };
                            setSurfaceParams(next);
                            saveSurfaceGeometryParameters(next);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          No. of Catch Berms
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          value={surfaceParams.numberOfBenches}
                          onChange={(e) => {
                            const next = {
                              ...surfaceParams,
                              numberOfBenches: Math.max(1, parseInt(e.target.value, 10) || 1),
                            };
                            setSurfaceParams(next);
                            saveSurfaceGeometryParameters(next);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-emerald-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          Catch Berm Width (m)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={surfaceParams.bermWidthMeters}
                          onChange={(e) => {
                            const next = {
                              ...surfaceParams,
                              bermWidthMeters: parseFloat(e.target.value) || 4,
                            };
                            setSurfaceParams(next);
                            saveSurfaceGeometryParameters(next);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-cyan-300"
                        />
                      </div>
                    </>
                  )}

                  {mappingDomain === 'ROCK_SURFACE' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-amber-300 mb-1">
                          Rock Exposure Width Wr (m)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={surfaceParams.rockExposureWidthMeters}
                          onChange={(e) => {
                            const next = {
                              ...surfaceParams,
                              rockExposureWidthMeters: parseFloat(e.target.value) || 12,
                            };
                            setSurfaceParams(next);
                            saveSurfaceGeometryParameters(next);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-amber-300 mb-1">
                          Rock Exposure Height Hr (m)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={surfaceParams.rockExposureHeightMeters}
                          onChange={(e) => {
                            const next = {
                              ...surfaceParams,
                              rockExposureHeightMeters: parseFloat(e.target.value) || 8,
                            };
                            setSurfaceParams(next);
                            saveSurfaceGeometryParameters(next);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-emerald-300 mb-1">
                          Active Canvas Panels (1-Panel vs Multi-Panel)
                        </label>
                        <select
                          value={surfaceParams.rockSurfaceSinglePanelOnly ? 'single' : 'multi'}
                          onChange={(e) => {
                            const next = {
                              ...surfaceParams,
                              rockSurfaceSinglePanelOnly: e.target.value === 'single',
                            };
                            setSurfaceParams(next);
                            saveSurfaceGeometryParameters(next);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-emerald-300"
                        >
                          <option value="single">1-Panel Rock Surface Window Only</option>
                          <option value="multi">
                            Multi-Panel Rock Exposure (Main Window + Overhang/Ledge + Flanks)
                          </option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {/* Row 3: Date & Time, Surface Excavation Method (F4), Face Dip Direction & Dip Angle, Surface Configuration */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Date &amp; Time of Mapping
                    </label>
                    <input
                      type="datetime-local"
                      value={activeRound.dateAndTimeOfExcavation}
                      onChange={(e) =>
                        updateActiveRound((r) => ({
                          ...r,
                          dateAndTimeOfExcavation: e.target.value,
                        }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Excavation Method (Romana F4)
                    </label>
                    <select
                      value={surfaceParams.excavationMethod}
                      onChange={(e) => {
                        const method = e.target
                          .value as SurfaceGeometryParameters['excavationMethod'];
                        const next = { ...surfaceParams, excavationMethod: method };
                        setSurfaceParams(next);
                        saveSurfaceGeometryParameters(next);
                        updateActiveRound((r) => ({ ...r, modeOfExcavation: method }));
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                    >
                      <option value="NATURAL_SLOPE">Natural Slope (F4 = +15)</option>
                      <option value="PRESPLITTING">Presplitting (F4 = +10)</option>
                      <option value="SMOOTH_BLASTING">Smooth Blasting (F4 = +8)</option>
                      <option value="MECHANICAL">Mechanical / Ripping / Trench (F4 = 0)</option>
                      <option value="NORMAL_BLASTING">Normal Bench / Slope Blasting (F4 = -8)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-400 mb-1">
                      {mappingDomain === 'TRENCH'
                        ? 'Trench Axis Azimuth / Wall Dip (°)'
                        : 'Face Dip Direction / Angle (°)'}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={360}
                        value={surfaceParams.faceDipDirectionDeg}
                        onChange={(e) => {
                          const dir = Number(e.target.value) || 0;
                          const next = { ...surfaceParams, faceDipDirectionDeg: dir };
                          setSurfaceParams(next);
                          saveSurfaceGeometryParameters(next);
                          updateActiveRound((r) => ({
                            ...r,
                            tunnelDriveDirection: dir,
                          }));
                        }}
                        className="w-1/2 bg-slate-950 border border-amber-500/50 rounded-lg px-2.5 py-2 text-sm font-mono font-bold text-amber-300"
                        title="Face Dip Direction (0°–360°)"
                      />
                      <input
                        type="number"
                        min={15}
                        max={90}
                        value={surfaceParams.faceDipAngleDeg}
                        onChange={(e) => {
                          const dip = Number(e.target.value) || 75;
                          const next = { ...surfaceParams, faceDipAngleDeg: dip };
                          setSurfaceParams(next);
                          saveSurfaceGeometryParameters(next);
                        }}
                        className="w-1/2 bg-slate-950 border border-amber-500/50 rounded-lg px-2.5 py-2 text-sm font-mono font-bold text-cyan-300"
                        title="Face / Batter Dip Angle (°)"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      {mappingDomain === 'BENCH'
                        ? 'Bench Layout Configuration'
                        : mappingDomain === 'TRENCH'
                        ? 'Trench Logging Layout'
                        : mappingDomain === 'ROCK_SURFACE'
                        ? 'Rock Surface Exposure Type'
                        : 'Slope Profile Configuration'}
                    </label>
                    <select
                      value={activeRound.excavationApproach}
                      onChange={(e) =>
                        updateActiveRound((r) => ({ ...r, excavationApproach: e.target.value }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                    >
                      {(mappingDomain === 'BENCH'
                        ? [
                            'Single Bench Face & Catch Berm',
                            'Double Bench Stack (Multi-Berm)',
                            'Quarry Production Bench',
                            'Haul Road Cut Bench',
                            'Final Pit Wall Batter & Berm',
                          ]
                        : mappingDomain === 'TRENCH'
                        ? [
                            'Unrolled 3-Panel Log (Left Wall + Floor + Right Wall)',
                            'Vertical Shear / Fault Investigation Trench',
                            'Foundation Cut & Key Trench',
                            'Stepped / Benched Deep Trench',
                          ]
                        : mappingDomain === 'ROCK_SURFACE'
                        ? [
                            'Natural Outcrop Window Mapping',
                            'Foundation Bedrock Exposure',
                            'Quarry / Road Cut Rock Face',
                            'Abutment / Spillway Rock Exposure',
                          ]
                        : [
                            'Engineered Cut Slope with Catch Berms',
                            'Natural Hill / Valley Rock Slope',
                            'Portal / Dam Abutment Cut Slope',
                            'Highway / Railway Rock Cut Batter',
                          ]
                      ).map((ap) => (
                        <option key={ap} value={ap}>
                          {ap}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={() => setStage('project_setup')}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    ← Back to {domainPanelMap.domainTitle} Sectors
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    {workflowMode === 'field_mapping' ? (
                      <button
                        type="button"
                        onClick={() => {
                          handleApplySurfaceDimensionsToLocation();
                          setStage('field_canvas');
                        }}
                        className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer flex items-center gap-2"
                      >
                        <span>
                          {`Save ${domainPanelMap.domainTitle.replace(' Mapping', '')} Station & Open Canvas →`}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          handleApplySurfaceDimensionsToLocation();
                          setStage('camera_prompt');
                        }}
                        className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg cursor-pointer flex items-center gap-2"
                      >
                        <span>
                          {`Save ${domainPanelMap.domainTitle.replace(' Mapping', '')} Station & Upload Photos →`}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ==================== STAGE 3: FIELD CAMERA & PHOTO UPLOAD ==================== */}
      {stage === 'camera_prompt' &&
        activeRound &&
        activeProject &&
        activeLocation &&
        (workflowMode === 'photo_mapping' ? (
          <FieldFourPhotoUploadStage
            activeProject={activeProject}
            activeLocation={activeLocation}
            activeRound={activeRound}
            mappingDomain={mappingDomain}
            onUpdateRound={updateActiveRound}
            onBackToRoundDetails={() => setStage('excavation_round')}
            onProceedToPhotoFit={() => setStage('photo_fit')}
          />
        ) : (
          <FieldInBuiltCameraStage
            activeProject={activeProject}
            activeLocation={activeLocation}
            activeRound={activeRound}
            mappingDomain={mappingDomain}
            onUpdateRound={updateActiveRound}
            onBackToRoundDetails={() => setStage('excavation_round')}
            onSkipOrProceedToCanvas={() => setStage('field_canvas')}
          />
        ))}

      {/* ==================== STAGE 4: INTERACTIVE PHOTO FIT TO SHAPE & SIZE (PHOTOGRAMMETRY ONLY) ==================== */}
      {stage === 'photo_fit' &&
        workflowMode === 'photo_mapping' &&
        activeRound &&
        activeProject &&
        activeLocation && (
          <FieldPhotoFitStage
            activeLocation={activeLocation}
            activeRound={activeRound}
            mappingDomain={mappingDomain}
            onUpdateRound={updateActiveRound}
            onBackToUpload={() => setStage('camera_prompt')}
            onProceedToFaceCanvas={() => setStage('field_canvas')}
          />
        )}

      {/* ==================== STAGE 4 (FACE CANVAS) & STAGE 5 (GROUP JOINTS ON FULL 4-PANEL CANVAS) ==================== */}
      {(stage === 'field_canvas' || stage === 'joint_grouping') &&
        activeProject &&
        activeLocation &&
        activeRound && (
        <div
          ref={workspaceColumnsRef}
          className={`flex-1 min-h-0 flex items-stretch p-1 overflow-hidden bg-transparent ${
            draggingSidebarSide ? 'select-none' : ''
          }`}
        >
          {/* LEFT COLUMN: Collapsible Rectangular Strip when collapsed | Left Tool Inspector (Catalog, Selection & Fault/Fold Types) when expanded */}
          {leftSidebarCollapsed ? (
            <button
              type="button"
              onPointerDown={(e) => startSidebarDrag('left', e)}
              className="w-9 shrink-0 min-h-0 h-full bg-slate-900/95 hover:bg-slate-800 border-2 border-amber-500/60 rounded-xl flex flex-col items-center justify-between py-3 px-1 cursor-ew-resize touch-none shadow-lg group transition-colors"
              title="Tap or drag right to expand Left Tool Inspector Sidebar"
            >
              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px]">
                ▶
              </span>
              <span
                className="text-[10px] font-black uppercase tracking-widest text-amber-300 group-hover:text-white select-none"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                TOOL INSPECTOR • DRAG OR TAP TO EXPAND
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            </button>
          ) : (
          <div
            style={{ width: `${leftSidebarWidth}px` }}
            className="shrink-0 min-h-0 h-full bg-slate-900/95 border border-slate-800 rounded-xl p-1.5 flex flex-col justify-between overflow-hidden"
          >
            {/* Collapse / Drag-Resize Left Sidebar Header Bar */}
            <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800 shrink-0 gap-1">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-400 truncate">
                {stage === 'joint_grouping' ? 'Joint Sets Palette' : 'Tool Inspector'}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setLeftSidebarCollapsed(true)}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-black text-[9px] flex items-center gap-0.5 cursor-pointer border border-slate-700"
                  title="Shrink / Collapse Left Tool Inspector (or drag right edge)"
                >
                  <span>◀ Shrink</span>
                </button>
              </div>
            </div>
            {stage === 'joint_grouping' ? (
              <div className="flex-1 min-h-0 overflow-y-auto touch-pan-y space-y-2 pr-0.5">
                <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-2">
                  <div className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                    5. Group Joints (All 4 Panels)
                  </div>
                  <p className="text-[10px] text-slate-300 mt-0.5 leading-snug">
                    1. Choose a Joint Set below (`J1`–`J5`, `J-Bedding`, `J-Random`).
                    <br />
                    2. Tap any Joint Trace or Dip Surface on <strong>{domainPanelMap.face.shortLabel}</strong>, <strong>{domainPanelMap.leftWall.shortLabel}</strong>, <strong>{domainPanelMap.crown.shortLabel}</strong>, or <strong>{domainPanelMap.rightWall.shortLabel}</strong> to group it!
                  </p>
                </div>

                {/* One-Click Auto-Group & Reset Buttons */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      pushUndoSnapshot();
                      updateActiveRound((r) => {
                        const allItems = [
                          ...r.jointTraces.map((t) => ({
                            id: t.id,
                            dir: t.dipDirection,
                            dip: t.dipAmount,
                          })),
                          ...r.dipPlaneSurfaces.map((d) => ({
                            id: d.id,
                            dir: d.dipDirection,
                            dip: d.dipAmount,
                          })),
                        ];
                        const clusters: { setId: FieldJointSetId; dir: number; dip: number }[] = [];
                        const candidateSets: FieldJointSetId[] = [
                          'J1',
                          'J2',
                          'J3',
                          'J4',
                          'J5',
                          'JR1',
                          'JR2',
                        ];
                        const assignedMap: Record<string, FieldJointSetId> = {};
                        for (const it of allItems) {
                          let matched: FieldJointSetId | null = null;
                          for (const c of clusters) {
                            const rawDiff = Math.abs(it.dir - c.dir) % 360;
                            const dirDiff = rawDiff > 180 ? 360 - rawDiff : rawDiff;
                            const dipDiff = Math.abs(it.dip - c.dip);
                            if (dirDiff <= 28 && dipDiff <= 22) {
                              matched = c.setId;
                              break;
                            }
                          }
                          if (!matched) {
                            const idx = Math.min(clusters.length, candidateSets.length - 1);
                            matched = candidateSets[idx];
                            if (clusters.length < candidateSets.length) {
                              clusters.push({ setId: matched, dir: it.dir, dip: it.dip });
                            }
                          }
                          assignedMap[it.id] = matched;
                        }
                        return {
                          ...r,
                          jointTraces: r.jointTraces.map((t) => ({
                            ...t,
                            setId: assignedMap[t.id] || 'J1',
                            label: assignedMap[t.id] || 'J1',
                          })),
                          dipPlaneSurfaces: r.dipPlaneSurfaces.map((d) => ({
                            ...d,
                            setId: assignedMap[d.id] || 'J1',
                          })),
                        };
                      });
                    }}
                    className="py-1.5 px-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10.5px] flex items-center justify-center gap-1 shadow cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Auto-Group Sets</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      pushUndoSnapshot();
                      updateActiveRound((r) => ({
                        ...r,
                        jointTraces: r.jointTraces.map((t) => ({
                          ...t,
                          setId: 'unassigned',
                          label: 'J',
                        })),
                        dipPlaneSurfaces: r.dipPlaneSurfaces.map((d) => ({
                          ...d,
                          setId: 'unassigned',
                        })),
                      }));
                    }}
                    className="py-1.5 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 font-bold text-[10.5px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3 shrink-0" />
                    <span>Reset All to J</span>
                  </button>
                </div>

                {/* Joint Set Palette Buttons */}
                <div className="space-y-1">
                  {(
                    [
                      'J1',
                      'J2',
                      'J3',
                      'J4',
                      'J5',
                      'J-Bedding',
                      'J-Random',
                      'JR1',
                      'JR2',
                      'unassigned',
                    ] as FieldJointGroupingId[]
                  ).map((setKey) => {
                    const meta = FIELD_JOINT_GROUP_COLORS[setKey];
                    const isSel = activeGroupingSet === setKey;
                    const count =
                      activeRound.jointTraces.filter((t) => (t.setId || 'unassigned') === setKey)
                        .length +
                      activeRound.dipPlaneSurfaces.filter(
                        (d) => (d.setId || 'unassigned') === setKey
                      ).length;
                    const setRec =
                      setKey !== 'unassigned' ? activeRound.discontinuitySets[setKey] : null;

                    return (
                      <button
                        key={setKey}
                        type="button"
                        onClick={() => setActiveGroupingSet(setKey)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          isSel
                            ? 'bg-slate-800 border-amber-400 ring-1 ring-amber-400/50 shadow'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/40"
                            style={{ backgroundColor: meta.stroke }}
                          />
                          <div className="truncate">
                            <div className="text-xs font-black text-white leading-tight">
                              {meta.label}
                            </div>
                            {setRec && count > 0 && (
                              <div className="text-[10px] font-mono text-amber-300">
                                {String(setRec.dipDirectionFrom).padStart(3, '0')}°–
                                {String(setRec.dipDirectionTo).padStart(3, '0')}° /{' '}
                                {setRec.dipAmountFrom}°–{setRec.dipAmountTo}°
                              </div>
                            )}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-black shrink-0 ${
                            count > 0
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-900 text-slate-500'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
            <div className="flex-1 min-h-0 overflow-y-auto touch-pan-y space-y-2 pr-0.5">
              {/* ==================== LEFT INSPECTOR: TOOL 1 ROCK LITHOLOGY CATALOG & SEARCH ==================== */}
              {activeTool === '1_lithology' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                      1. Choose Rock Lithology
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowOtherRockSearch(!showOtherRockSearch)}
                      className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[9.5px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Search className="w-3 h-3" />
                      Search
                    </button>
                  </div>

                  {/* 4 Drawing Tools: Pencil, Brush, Spline, Polyline */}
                  {renderFeatureDrawSubToolSelector()}

                  {/* Paint Rock vs Litho Eraser Mode Toggle */}
                  <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setLithologySubMode('paint')}
                      className={`py-1 px-1.5 rounded text-[10px] font-black flex items-center justify-center gap-1 border cursor-pointer ${
                        lithologySubMode === 'paint'
                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                      }`}
                    >
                      <Paintbrush className="w-3 h-3" />
                      Paint Rock
                    </button>
                    <button
                      type="button"
                      onClick={() => setLithologySubMode('erase_area')}
                      className={`py-1 px-1.5 rounded text-[10px] font-black flex items-center justify-center gap-1 border cursor-pointer ${
                        lithologySubMode === 'erase_area'
                          ? 'bg-rose-500 text-white border-rose-300'
                          : 'bg-slate-900 text-rose-300 border-slate-800 hover:text-white'
                      }`}
                    >
                      <Eraser className="w-3 h-3" />
                      Litho Eraser
                    </button>
                  </div>

                  {/* Search & Location Suggestion Box */}
                  {showOtherRockSearch && (
                    <div className="bg-slate-950 border border-amber-500/50 rounded-xl p-2 space-y-1.5">
                      <input
                        type="text"
                        value={rockSearchQuery}
                        onChange={(e) => setRockSearchQuery(e.target.value)}
                        placeholder="Type rock name (e.g. Migmatite...)"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        autoFocus
                      />
                      {rockSearchQuery.trim().length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleChooseOrRememberRock(rockSearchQuery.trim())}
                          className="w-full py-1 px-2 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10.5px] flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <BookmarkCheck className="w-3.5 h-3.5" />
                          Use &amp; Remember "{rockSearchQuery.trim()}"
                        </button>
                      )}
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                        {filteredRockSuggestions.slice(0, 14).map((sug) => (
                          <button
                            key={sug.name}
                            type="button"
                            onClick={() =>
                              handleChooseOrRememberRock(
                                sug.name,
                                sug.code,
                                sug.patternId,
                                sug.category
                              )
                            }
                            className="w-full text-left px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-between text-[11px] cursor-pointer"
                          >
                            <span className="font-bold text-white truncate">{sug.name}</span>
                            <span className="font-mono text-[9.5px] text-amber-400 font-bold">
                              {sug.code}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Remembered Location Rocks */}
                  {rememberedRocksList.length > 0 && (
                    <div className="bg-slate-950 border border-emerald-500/30 rounded-lg p-1.5">
                      <div className="text-[9.5px] font-bold uppercase text-emerald-400 mb-1 flex items-center gap-1">
                        <BookmarkCheck className="w-3 h-3" />
                        Remembered Location Rocks
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {rememberedRocksList.map((rem) => (
                          <button
                            key={rem.id}
                            type="button"
                            onClick={() => setSelectedRockType(rem.id)}
                            className={`px-1.5 py-1 rounded text-left text-[10.5px] font-bold border truncate cursor-pointer ${
                              selectedRockType === rem.id
                                ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                                : 'bg-slate-900 text-emerald-200 border-slate-800'
                            }`}
                          >
                            {rem.name} ({rem.code})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Main Geological Rock Types Grid */}
                  <div className="grid grid-cols-2 gap-1">
                    {FIELD_LITHOLOGY_CATALOG.map((rock) => {
                      const isSel = selectedRockType === rock.id;
                      const customHex = (activeRound.rockCustomColors || {})[rock.id];
                      return (
                        <button
                          key={rock.id}
                          type="button"
                          onClick={() => {
                            setSelectedRockType(rock.id);
                            if (customHex) {
                              setActiveColorFamilyId(resolveLithologyFamilyForHex(customHex));
                            }
                          }}
                          className={`p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                            isSel
                              ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow'
                              : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-bold truncate flex items-center gap-1">
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-slate-900 shrink-0"
                                style={{ backgroundColor: customHex || rock.colorTint }}
                              />
                              {rock.name}
                            </span>
                            <span
                              className={`text-[9.5px] font-mono px-1 rounded ${
                                isSel ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {rock.code}
                            </span>
                          </div>
                          <div
                            className={`text-[8.5px] truncate mt-0.5 ${
                              isSel ? 'text-slate-900' : 'text-slate-500'
                            }`}
                          >
                            {rock.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ==================== LEFT INSPECTOR: TOOL 2 VEIN & FOLIATION BAND CATALOG ==================== */}
              {activeTool === '2_vein_foliation' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                      2. Vein &amp; Foliation Band
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowOtherVeinSearch(!showOtherVeinSearch)}
                      className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[9.5px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Search className="w-3 h-3" />
                      Search
                    </button>
                  </div>

                  {/* 4 Drawing Tools: Pencil, Brush, Spline, Polyline */}
                  {renderFeatureDrawSubToolSelector()}

                  {showOtherVeinSearch && (
                    <div className="bg-slate-950 border border-amber-500/50 rounded-xl p-2 space-y-1.5">
                      <input
                        type="text"
                        value={veinSearchQuery}
                        onChange={(e) => setVeinSearchQuery(e.target.value)}
                        placeholder="Type band (Calcite, Epidote, S2...)"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        autoFocus
                      />
                      {veinSearchQuery.trim().length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleChooseOrRememberVeinBand(veinSearchQuery.trim())}
                          className="w-full py-1 px-2 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10.5px] flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <BookmarkCheck className="w-3.5 h-3.5" />
                          Use &amp; Remember "{veinSearchQuery.trim()}"
                        </button>
                      )}
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                        {filteredVeinSuggestions.map((sug) => (
                          <button
                            key={sug.id}
                            type="button"
                            onClick={() =>
                              handleChooseOrRememberVeinBand(
                                sug.name,
                                sug.code,
                                sug.patternId,
                                sug.category
                              )
                            }
                            className="w-full text-left px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-between text-[11px] cursor-pointer"
                          >
                            <span className="font-bold text-white truncate">{sug.name}</span>
                            <span className="font-mono text-[9.5px] text-amber-400 font-bold">
                              {sug.code}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    {FIELD_VEIN_AND_FOLIATION_CATALOG.map((vf) => {
                      const isSel = selectedVeinRockId === vf.id;
                      return (
                        <button
                          key={vf.id}
                          type="button"
                          onClick={() => {
                            setSelectedVeinRockId(vf.id);
                            setVeinOrFoliationSubMode('vein_band');
                            const matching = activeRound.lithologyStrokes.filter(
                              (s) =>
                                s.panel === activePanel &&
                                (s.mode === 'vein_band' || s.mode === 'foliation_plane') &&
                                s.rockType === vf.id
                            );
                            if (matching.length > 0) {
                              setSelectedVeinBandId(matching[matching.length - 1].id);
                            }
                          }}
                          className={`w-full text-left p-1.5 rounded-lg border transition-all flex items-center gap-2 cursor-pointer ${
                            isSel
                              ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow'
                              : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700'
                          }`}
                        >
                          <FieldVeinFoliationSymbolPreviewSvg
                            patternId={vf.patternId}
                            rockType={vf.id}
                            colorTint={vf.colorTint}
                            colorMode={activeRound.reportColorMode ?? 'color'}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between text-[11px] font-bold gap-1">
                              <span className="truncate">{vf.name}</span>
                              <span
                                className={`font-mono text-[9.5px] px-1 rounded shrink-0 ${
                                  isSel
                                    ? 'bg-slate-950 text-amber-300'
                                    : 'bg-slate-800 text-amber-400'
                                }`}
                              >
                                {vf.code}
                              </span>
                            </div>
                            <div
                              className={`text-[8.5px] truncate mt-0.5 ${
                                isSel ? 'text-slate-900' : 'text-slate-400'
                              }`}
                            >
                              {vf.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ==================== LEFT INSPECTOR: TOOL 3 JOINT TRACE PENCIL SIZE & MAPPED LIST ==================== */}
              {activeTool === '3_joint_trace' && (
                <div className="space-y-2">
                  <div className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                    3. Joint Trace
                  </div>
                  {/* 4 Drawing Tools: Pencil, Brush, Spline, Polyline */}
                  {renderFeatureDrawSubToolSelector()}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                        Joint Trace Pencil Size
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                        {jointPencilSizePx} px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1.5}
                      max={14}
                      step={0.5}
                      value={jointPencilSizePx}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setJointPencilSizePx(val);
                        if (selectedTraceId) {
                          updateActiveRound((r) => ({
                            ...r,
                            jointTraces: r.jointTraces.map((t) =>
                              t.id === selectedTraceId ? { ...t, strokeWidthPx: val } : t
                            ),
                          }));
                        }
                      }}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="grid grid-cols-5 gap-1">
                      {[2, 3.5, 5, 8, 12].map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => {
                            setJointPencilSizePx(sz);
                            if (selectedTraceId) {
                              updateActiveRound((r) => ({
                                ...r,
                                jointTraces: r.jointTraces.map((t) =>
                                  t.id === selectedTraceId ? { ...t, strokeWidthPx: sz } : t
                                ),
                              }));
                            }
                          }}
                          className={`py-1 rounded text-[10px] font-bold border cursor-pointer ${
                            Math.abs(jointPencilSizePx - sz) <= 0.4
                              ? 'bg-amber-500 text-slate-950 border-amber-300'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                          }`}
                        >
                          {sz}px
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mapped Joint Traces on Active Panel */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
                      <span>Mapped Joint Traces ({activePanel.replace('_', ' ')})</span>
                      <span className="font-mono text-amber-400">
                        {activeRound.jointTraces.filter((t) => t.panel === activePanel).length}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
                      {activeRound.jointTraces
                        .filter((t) => t.panel === activePanel)
                        .map((tr, idx) => {
                          const isSel = selectedTraceId === tr.id;
                          return (
                            <div
                              key={tr.id}
                              onClick={() => {
                                setSelectedTraceId(tr.id);
                                setSelectedDipSurfaceId(null);
                                setLiveDipDirection(tr.dipDirection);
                                setLiveDipAmount(tr.dipAmount);
                              }}
                              className={`p-1.5 rounded-lg border text-[10.5px] flex items-center justify-between gap-1 cursor-pointer ${
                                isSel
                                  ? 'bg-slate-800 border-amber-400 text-white'
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <span className="font-bold">
                                #{idx + 1} • {tr.setId === 'unassigned' ? 'J' : tr.setId}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {tr.panel === 'crown' ? (
                                  <span className="font-mono font-bold text-amber-300 text-[10px]">
                                    STR {getCrownStrikePair(((tr.dipDirection - 90) % 360 + 360) % 360).label}
                                  </span>
                                ) : (
                                  <span className="font-mono font-bold text-amber-300">
                                    {String(tr.dipDirection).padStart(3, '0')}°/{tr.dipAmount}°
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTraceId(tr.id);
                                    setInspectedJointId(tr.id);
                                    setIs3DJointInspectorOpen(true);
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 text-[9px] font-bold cursor-pointer transition-all"
                                  title="Inspect joint in 3D"
                                >
                                  3D
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== LEFT INSPECTOR: TOOL 4 DIP PLANE SURFACE ==================== */}
              {activeTool === '4_dip_surface' && (
                <div className="space-y-2">
                  <div className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                    4. Dip Plane Surface
                  </div>
                  {/* 4 Drawing Tools: Pencil, Brush, Spline, Polyline */}
                  {renderFeatureDrawSubToolSelector()}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-[10.5px] text-slate-300 space-y-1">
                    <div className="font-bold text-amber-300">
                      Dip Plane Surface ({activeDrawSubTool.toUpperCase()})
                    </div>
                    <p className="leading-snug text-slate-400">
                      Draw or paint the exposed dip plane boundary with Pencil, Brush, Spline, or Polyline. Traces starting/ending near the tunnel outline snap cleanly along the outline.
                    </p>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
                      <span>Mapped Dip Surfaces ({activePanel.replace('_', ' ')})</span>
                      <span className="font-mono text-amber-400">
                        {activeRound.dipPlaneSurfaces.filter((d) => d.panel === activePanel).length}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
                      {activeRound.dipPlaneSurfaces
                        .filter((d) => d.panel === activePanel)
                        .map((ds, idx) => {
                          const isSel = selectedDipSurfaceId === ds.id;
                          return (
                            <div
                              key={ds.id}
                              onClick={() => {
                                setSelectedDipSurfaceId(ds.id);
                                setSelectedTraceId(null);
                                setLiveDipDirection(ds.dipDirection);
                                setLiveDipAmount(ds.dipAmount);
                              }}
                              className={`p-1.5 rounded-lg border text-[10.5px] flex items-center justify-between gap-1 cursor-pointer ${
                                isSel
                                  ? 'bg-slate-800 border-amber-400 text-white'
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <span className="font-bold">Dip Surface #{idx + 1}</span>
                              <span className="font-mono font-bold text-cyan-300">
                                {String(ds.dipDirection).padStart(3, '0')}°/{ds.dipAmount}°
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== LEFT INSPECTOR: TOOL 5 GEOLOGICAL FEATURES (FAULT, FOLD & STRUCTURAL TYPES) ==================== */}
              {activeTool === '5_geo_feature' && (
                <div className="space-y-2">
                  <div className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                    5. Geological Features
                  </div>

                  {/* 4 Drawing Tools: Pencil, Brush, Spline, Polyline */}
                  {renderFeatureDrawSubToolSelector()}

                  {/* Quick 3-Tab Switcher for FAULT vs FOLD vs OTHER */}
                  <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSelectedGeoFeatureType('fault')}
                      className={`py-1.5 px-1.5 rounded-lg text-[10px] font-black uppercase cursor-pointer transition-all ${
                        selectedGeoFeatureType === 'fault' ||
                        selectedGeoFeatureType === 'thrust_fault' ||
                        selectedGeoFeatureType === 'shear_zone'
                          ? 'bg-rose-500 text-white shadow'
                          : 'bg-slate-900 text-slate-300 hover:text-white'
                      }`}
                    >
                      ⚡ Fault
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedGeoFeatureType('fold_axis')}
                      className={`py-1.5 px-1.5 rounded-lg text-[10px] font-black uppercase cursor-pointer transition-all ${
                        selectedGeoFeatureType === 'fold_axis'
                          ? 'bg-purple-500 text-white shadow'
                          : 'bg-slate-900 text-slate-300 hover:text-white'
                      }`}
                    >
                      〰️ Fold
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedGeoFeatureType('litho_contact')}
                      className={`py-1.5 px-1.5 rounded-lg text-[10px] font-black uppercase cursor-pointer transition-all ${
                        selectedGeoFeatureType === 'litho_contact' ||
                        selectedGeoFeatureType === 'overbreak_cavity'
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'bg-slate-900 text-slate-300 hover:text-white'
                      }`}
                    >
                      📐 Contact
                    </button>
                  </div>

                  {/* DEDICATED FAULT OPTIONS: Fault Type + Fault Plane (FP), Hanging Wall (HW), Foot Wall (FW) */}
                  {(selectedGeoFeatureType === 'fault' ||
                    selectedGeoFeatureType === 'thrust_fault' ||
                    selectedGeoFeatureType === 'shear_zone') && (
                    <div className="bg-slate-950 border border-rose-500/40 rounded-xl p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9.5px] font-black uppercase tracking-wider text-rose-400">
                          Fault Type &amp; Kinematics
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = !showHwFwBadges;
                            setShowHwFwBadges(nextVal);
                            if (selectedFeatureId) {
                              updateActiveRound((r) => ({
                                ...r,
                                structuralFeatures: (r.structuralFeatures || []).map((f) =>
                                  f.id === selectedFeatureId
                                    ? { ...f, showHwFwBadges: nextVal }
                                    : f
                                ),
                              }));
                            }
                          }}
                          className={`px-1.5 py-0.5 rounded text-[8.5px] font-black border cursor-pointer ${
                            showHwFwBadges
                              ? 'bg-rose-500 text-white border-rose-300'
                              : 'bg-slate-900 text-slate-400 border-slate-700'
                          }`}
                        >
                          {showHwFwBadges ? '✓ Auto HW/FW' : 'HW/FW Off'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-1">
                        {FIELD_FAULT_SUBTYPE_CATALOG.map((ft) => {
                          const isSel = selectedFaultSubType === ft.id;
                          return (
                            <button
                              key={ft.id}
                              type="button"
                              onClick={() => {
                                setSelectedFaultSubType(ft.id);
                                if (ft.id === 'thrust') setSelectedGeoFeatureType('thrust_fault');
                                else if (selectedGeoFeatureType === 'thrust_fault')
                                  setSelectedGeoFeatureType('fault');
                                if (selectedFeatureId) {
                                  updateActiveRound((r) => ({
                                    ...r,
                                    structuralFeatures: (r.structuralFeatures || []).map((f) =>
                                      f.id === selectedFeatureId
                                        ? { ...f, faultSubType: ft.id }
                                        : f
                                    ),
                                  }));
                                }
                              }}
                              className={`p-1.5 rounded-lg border text-left cursor-pointer transition-all ${
                                isSel
                                  ? 'bg-rose-500 text-white border-rose-300 font-black shadow'
                                  : 'bg-slate-900 text-slate-200 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] font-bold">
                                <span className="truncate">{ft.name}</span>
                                <span className="font-mono text-[9px] px-1 rounded bg-black/30">
                                  {ft.shortCode}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div>
                        <div className="text-[9px] font-bold uppercase text-slate-300 mb-1">
                          Denote Fault Element on Canvas:
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {FIELD_FAULT_ELEMENT_ROLES.map((role) => {
                            const isRoleSel = selectedFaultElementRole === role.id;
                            return (
                              <button
                                key={role.id}
                                type="button"
                                onClick={() => {
                                  setSelectedFaultElementRole(role.id);
                                  if (selectedFeatureId) {
                                    updateActiveRound((r) => ({
                                      ...r,
                                      structuralFeatures: (r.structuralFeatures || []).map((f) =>
                                        f.id === selectedFeatureId
                                          ? { ...f, faultElementRole: role.id }
                                          : f
                                      ),
                                    }));
                                  }
                                }}
                                className={`p-1 rounded-lg border text-center cursor-pointer transition-all ${
                                  isRoleSel
                                    ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow'
                                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                                }`}
                                title={role.description}
                              >
                                <div className="text-[9.5px] font-black">{role.shortCode}</div>
                                <div className="text-[8px] truncate">{role.name}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DEDICATED FOLD OPTIONS: Fold Type + Fold Axis (FA), Fold Limb, Fold Crest */}
                  {selectedGeoFeatureType === 'fold_axis' && (
                    <div className="bg-slate-950 border border-purple-500/40 rounded-xl p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9.5px] font-black uppercase tracking-wider text-purple-300">
                          Fold Type &amp; Geometry
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = !showFoldLimbCrestBadges;
                            setShowFoldLimbCrestBadges(nextVal);
                            if (selectedFeatureId) {
                              updateActiveRound((r) => ({
                                ...r,
                                structuralFeatures: (r.structuralFeatures || []).map((f) =>
                                  f.id === selectedFeatureId
                                    ? { ...f, showFoldLimbCrestBadges: nextVal }
                                    : f
                                ),
                              }));
                            }
                          }}
                          className={`px-1.5 py-0.5 rounded text-[8.5px] font-black border cursor-pointer ${
                            showFoldLimbCrestBadges
                              ? 'bg-purple-500 text-white border-purple-300'
                              : 'bg-slate-900 text-slate-400 border-slate-700'
                          }`}
                        >
                          {showFoldLimbCrestBadges ? '✓ Crest & Limbs' : 'Crest Off'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-1">
                        {FIELD_FOLD_SUBTYPE_CATALOG.map((fd) => {
                          const isSel = selectedFoldSubType === fd.id;
                          return (
                            <button
                              key={fd.id}
                              type="button"
                              onClick={() => {
                                setSelectedFoldSubType(fd.id);
                                if (selectedFeatureId) {
                                  updateActiveRound((r) => ({
                                    ...r,
                                    structuralFeatures: (r.structuralFeatures || []).map((f) =>
                                      f.id === selectedFeatureId
                                        ? { ...f, foldSubType: fd.id }
                                        : f
                                    ),
                                  }));
                                }
                              }}
                              className={`p-1.5 rounded-lg border text-left cursor-pointer transition-all ${
                                isSel
                                  ? 'bg-purple-500 text-white border-purple-300 font-black shadow'
                                  : 'bg-slate-900 text-slate-200 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] font-bold">
                                <span className="truncate">{fd.name}</span>
                                <span className="font-mono text-[9px] px-1 rounded bg-black/30">
                                  {fd.shortCode}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div>
                        <div className="text-[9px] font-bold uppercase text-slate-300 mb-1">
                          Denote Fold Element on Canvas:
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {FIELD_FOLD_ELEMENT_ROLES.map((role) => {
                            const isRoleSel = selectedFoldElementRole === role.id;
                            return (
                              <button
                                key={role.id}
                                type="button"
                                onClick={() => {
                                  setSelectedFoldElementRole(role.id);
                                  if (selectedFeatureId) {
                                    updateActiveRound((r) => ({
                                      ...r,
                                      structuralFeatures: (r.structuralFeatures || []).map((f) =>
                                        f.id === selectedFeatureId
                                          ? { ...f, foldElementRole: role.id }
                                          : f
                                      ),
                                    }));
                                  }
                                }}
                                className={`p-1 rounded-lg border text-center cursor-pointer transition-all ${
                                  isRoleSel
                                    ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow'
                                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                                }`}
                                title={role.description}
                              >
                                <div className="text-[9.5px] font-black">{role.shortCode}</div>
                                <div className="text-[8px] truncate">{role.name}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    {FIELD_STRUCTURAL_FEATURE_CATALOG.map((feat) => (
                      <button
                        key={feat.id}
                        type="button"
                        onClick={() => setSelectedGeoFeatureType(feat.id)}
                        className={`w-full text-left p-1.5 rounded-lg border transition-all cursor-pointer ${
                          selectedGeoFeatureType === feat.id
                            ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                            : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span>{feat.name}</span>
                          <span className="font-mono text-[10px]">{feat.shortCode}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ==================== LEFT INSPECTOR: TOOL 6 GROUNDWATER SYMBOL CATALOG ==================== */}
              {activeTool === '6_water_mark' && (
                <div className="space-y-2">
                  <div className="text-[11px] font-black uppercase tracking-wider text-sky-400">
                    6. Mark Groundwater / Seepage
                  </div>
                  <div className="space-y-1.5">
                    {FIELD_WATER_CATALOG.map((w) => (
                      <button
                        key={w.condition}
                        type="button"
                        onClick={() => setSelectedWaterCondition(w.condition)}
                        className={`w-full text-left p-1.5 rounded-xl border transition-all flex items-center gap-2 cursor-pointer ${
                          selectedWaterCondition === w.condition
                            ? 'bg-sky-500 text-slate-950 border-sky-300 font-black shadow'
                            : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <FieldWaterSymbolPreviewSvg
                          condition={w.condition}
                          colorMode={activeRound.reportColorMode ?? 'color'}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between text-xs font-bold gap-1">
                            <span>{w.condition}</span>
                            <span
                              className={`font-mono text-[9.5px] px-1.5 py-0.5 rounded shrink-0 ${
                                selectedWaterCondition === w.condition
                                  ? 'bg-slate-950 text-sky-300'
                                  : 'bg-slate-900 text-sky-400'
                              }`}
                            >
                              {w.symbol}
                            </span>
                          </div>
                          <div
                            className={`text-[9.5px] truncate mt-0.5 ${
                              selectedWaterCondition === w.condition
                                ? 'text-slate-900'
                                : 'text-slate-400'
                            }`}
                          >
                            {w.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ==================== LEFT INSPECTOR: ERASER SIZE ==================== */}
              {activeTool === 'eraser' && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-black uppercase text-rose-400">Eraser Size</span>
                    <span className="font-mono font-bold text-amber-400">{brushRadius} px</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={100}
                    step={1}
                    value={brushRadius}
                    onChange={(e) => setBrushRadius(Number(e.target.value))}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                  <div className="grid grid-cols-5 gap-1">
                    {[2, 8, 20, 40, 75].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setBrushRadius(sz)}
                        className={`py-1 rounded text-[10px] font-bold border cursor-pointer ${
                          Math.abs(brushRadius - sz) <= 1
                            ? 'bg-rose-500 text-white border-rose-300'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                        }`}
                      >
                        {sz}px
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Photo Underlay Toggle in Photogrammetry Mode / Field Camera Storage Button in Field Mode */}
            {workflowMode === 'photo_mapping' && panelPhoto && (
              <div className="pt-1.5 mt-1 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPhotoUnderlay(!showPhotoUnderlay)}
                  className="w-full py-1.5 px-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-semibold text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  {showPhotoUnderlay ? 'Hide Photo Underlay' : 'Show Photo Underlay'}
                </button>
              </div>
            )}
            {workflowMode === 'field_mapping' && (
              <div className="pt-1.5 mt-1 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setStage('camera_prompt')}
                  className="w-full py-1.5 px-2 rounded-lg bg-slate-950 border border-emerald-500/40 text-[11px] font-semibold text-emerald-300 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-400" />
                  Field Camera ({activeRound.collectedPhotos.length} Stored)
                </button>
              </div>
            )}
          </div>
          )}

          {/* LEFT DRAG / PUSH RESIZE HANDLE (Drag left to shrink/collapse, drag right to expand) */}
          <div
            onPointerDown={(e) => startSidebarDrag('left', e)}
            onDoubleClick={() => {
              if (leftSidebarCollapsed) {
                setLeftSidebarCollapsed(false);
                setLeftSidebarWidth(264);
              } else {
                setLeftSidebarCollapsed(true);
              }
            }}
            title="Drag or push left/right to shrink or expand Left Sidebar (Tap/Double-click to toggle)"
            className="w-3.5 shrink-0 min-h-0 h-full flex flex-col items-center justify-center cursor-col-resize touch-none select-none group relative z-20"
          >
            <div
              className={`w-[2px] h-full rounded-full transition-colors ${
                draggingSidebarSide === 'left'
                  ? 'bg-amber-400'
                  : 'bg-slate-800/80 group-hover:bg-amber-400/70'
              }`}
            />
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-16 rounded-full border flex flex-col items-center justify-center gap-0.5 shadow-md transition-all ${
                draggingSidebarSide === 'left'
                  ? 'bg-amber-500 text-slate-950 border-amber-200 scale-105'
                  : 'bg-slate-900/95 text-amber-300 border-amber-500/50 group-hover:bg-slate-800 group-hover:border-amber-400 group-hover:text-white'
              }`}
            >
              <span className="text-[7px] font-black leading-none">◀▶</span>
              <span className="w-1 h-1 rounded-full bg-current opacity-80" />
              <span className="w-1 h-1 rounded-full bg-current opacity-80" />
              <span className="w-1 h-1 rounded-full bg-current opacity-80" />
            </div>
          </div>

          {/* CENTER COLUMN: Permanent Top Mapping Tools Bar + Extra-Large High-Accuracy 1:1 SVG Field Mapping Canvas + Bottom Panel Switcher */}
          <div className="flex-1 min-w-0 min-h-0 h-full bg-slate-900 border border-slate-800 rounded-xl p-1 flex flex-col overflow-hidden">
            {/* PERMANENT TOP TOOLS BAR — Always placed on top of the canvas for fast 1-tap access */}
            <div className="bg-slate-950 border border-amber-500/40 rounded-lg px-2 py-1 mb-0.5 flex flex-wrap items-center justify-between gap-1.5 shrink-0">
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    ['1_lithology', '1. Rock Lithology', Paintbrush],
                    ['2_vein_foliation', '2. Vein & Foliation', Layers],
                    ['3_joint_trace', '3. Joint Trace', Pencil],
                    ['4_dip_surface', '4. Dip Plane Surface', Pencil],
                    ['5_geo_feature', '5. Geological Features', Sparkles],
                    ['6_water_mark', '6. Mark Water', Droplets],
                    ['eraser', 'Erase', Eraser],
                  ] as [FieldCanvasTool, string, any][]
                ).map(([tId, lbl, IconC]) => (
                  <button
                    key={tId}
                    type="button"
                    onClick={() => {
                      if (stage === 'joint_grouping') setStage('field_canvas');
                      setActiveTool(tId);
                    }}
                    className={`px-2 py-1 rounded-lg text-[10.5px] font-black flex items-center gap-1 cursor-pointer transition-all ${
                      stage === 'field_canvas' && activeTool === tId
                        ? tId === 'eraser'
                          ? 'bg-rose-500 text-white shadow'
                          : 'bg-amber-500 text-slate-950 shadow'
                        : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                    }`}
                  >
                    <IconC className="w-3.5 h-3.5" />
                    <span>{lbl}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10.5px] font-bold text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  title="Undo"
                >
                  <Undo2 className="w-3 h-3" />
                  <span>Undo</span>
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10.5px] font-bold text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  title="Redo"
                >
                  <Redo2 className="w-3 h-3" />
                  <span>Redo</span>
                </button>
              </div>
            </div>
            {/* Top Canvas Bar: Panel Transform Image Buttons (Move, Rotate, Mirror Vertical, Mirror Horizontal for Left Wall / Crown / Right Wall) + Zoom & Colour Toggle */}
            {!(stage === 'field_canvas' && is3DMappingMode) && (
            <div className="flex items-center justify-between px-1 pb-0.5 mb-0.5 border-b border-slate-800 shrink-0 gap-1">
              {stage === 'joint_grouping' || activePanel !== 'face' ? (
                (() => {
                  const targetP: 'left_wall' | 'crown' | 'right_wall' =
                    activePanel !== 'face' ? activePanel : transformTargetPanel;
                  const tr = getFieldPanelTransform(
                    activeRound,
                    targetP,
                    activeStageTransformMode
                  );
                  const fGeomForTabs = computePanelCanvasGeometry(
                    'face',
                    activeLocation,
                    activeRound
                  );
                  const hasTransform =
                    tr.rotationDeg !== 0 ||
                    tr.mirrorH ||
                    tr.mirrorV ||
                    tr.offsetX !== 0 ||
                    tr.offsetY !== 0 ||
                    tr.tOffsetX !== 0 ||
                    tr.tOffsetY !== 0;

                  return (
                    <div className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar">
                      {stage === 'joint_grouping' && (
                        <div className="inline-flex items-center rounded-lg bg-slate-950 p-0.5 border border-slate-800 gap-0.5 shrink-0">
                          {(
                            [
                              ...(fGeomForTabs.hasLeftWall
                                ? ([['left_wall', domainPanelMap.leftWall.shortLabel]] as [
                                    'left_wall' | 'crown' | 'right_wall',
                                    string,
                                  ][])
                                : []),
                              ...(fGeomForTabs.hasCrown
                                ? ([['crown', domainPanelMap.crown.shortLabel]] as [
                                    'left_wall' | 'crown' | 'right_wall',
                                    string,
                                  ][])
                                : []),
                              ...(fGeomForTabs.hasRightWall
                                ? ([['right_wall', domainPanelMap.rightWall.shortLabel]] as [
                                    'left_wall' | 'crown' | 'right_wall',
                                    string,
                                  ][])
                                : []),
                            ]
                          ).map(([pid, lbl]) => {
                            const isSel = targetP === pid;
                            return (
                              <button
                                key={pid}
                                type="button"
                                onClick={() => {
                                  setTransformTargetPanel(pid);
                                  setActivePanel(pid);
                                }}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase transition-all cursor-pointer ${
                                  isSel
                                    ? 'bg-amber-500 text-slate-950 shadow'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                                title={`Select ${lbl} for Move / Rotate / Mirror`}
                              >
                                {lbl}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* 1. MOVE BUTTON */}
                      <button
                        type="button"
                        onClick={() => setIsPanelMoveMode((m) => !m)}
                        className={`px-2 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 shrink-0 transition-all cursor-pointer ${
                          isPanelMoveMode
                            ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                            : 'bg-slate-950 text-slate-200 border-slate-700 hover:border-amber-400/60 hover:text-white'
                        }`}
                        title="Move Panel (Drag on canvas to reposition panel & outline reference)"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="w-3.5 h-3.5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="5 9 2 12 5 15" />
                          <polyline points="9 5 12 2 15 5" />
                          <polyline points="15 19 12 22 9 19" />
                          <polyline points="19 9 22 12 19 15" />
                          <line x1="2" y1="12" x2="22" y2="12" />
                          <line x1="12" y1="2" x2="12" y2="22" />
                        </svg>
                        <span>Move</span>
                      </button>

                      {/* 2. ROTATE 90° BUTTON */}
                      <button
                        type="button"
                        onClick={() =>
                          updatePanelTransform(targetP, (prev) => ({
                            ...prev,
                            rotationDeg: (((prev.rotationDeg + 90) % 360) as
                              | 0
                              | 90
                              | 180
                              | 270),
                          }))
                        }
                        className={`px-2 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 shrink-0 transition-all cursor-pointer ${
                          tr.rotationDeg !== 0
                            ? 'bg-sky-500 text-slate-950 border-sky-300 shadow'
                            : 'bg-slate-950 text-slate-200 border-slate-700 hover:border-sky-400/60 hover:text-white'
                        }`}
                        title="Rotate Panel 90° (Swaps X/Y axes while keeping 1m×1m square grid & outline reference in place)"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="w-3.5 h-3.5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                          <path d="M21 3v5h-5" />
                        </svg>
                        <span>Rotate{tr.rotationDeg ? ` ${tr.rotationDeg}°` : ''}</span>
                      </button>

                      {/* 3. VERTICAL MIRROR BUTTON */}
                      <button
                        type="button"
                        onClick={() =>
                          updatePanelTransform(targetP, (prev) => ({
                            ...prev,
                            mirrorV: !prev.mirrorV,
                          }))
                        }
                        className={`px-2 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 shrink-0 transition-all cursor-pointer ${
                          tr.mirrorV
                            ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow'
                            : 'bg-slate-950 text-slate-200 border-slate-700 hover:border-emerald-400/60 hover:text-white'
                        }`}
                        title="Vertical Mirror (Flip Top ↔ Bottom with outline reference updated in place)"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="w-3.5 h-3.5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 12h18" strokeDasharray="3 2" />
                          <polygon points="12 3 7 9 17 9" />
                          <polygon points="12 21 7 15 17 15" />
                        </svg>
                        <span>Mirror V</span>
                      </button>

                      {/* 4. HORIZONTAL MIRROR BUTTON */}
                      <button
                        type="button"
                        onClick={() =>
                          updatePanelTransform(targetP, (prev) => ({
                            ...prev,
                            mirrorH: !prev.mirrorH,
                          }))
                        }
                        className={`px-2 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 shrink-0 transition-all cursor-pointer ${
                          tr.mirrorH
                            ? 'bg-violet-500 text-white border-violet-300 shadow'
                            : 'bg-slate-950 text-slate-200 border-slate-700 hover:border-violet-400/60 hover:text-white'
                        }`}
                        title="Horizontal Mirror (Flip Left ↔ Right with outline reference & Drive direction updated in place)"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="w-3.5 h-3.5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 3v18" strokeDasharray="3 2" />
                          <polygon points="3 12 9 7 9 17" />
                          <polygon points="21 12 15 7 15 17" />
                        </svg>
                        <span>Mirror H</span>
                      </button>

                      {/* 5. IDEAL POSITION LOCK / STATUS BUTTON */}
                      <button
                        type="button"
                        onClick={() => lockCurrentPanelAsIdealPosition(targetP)}
                        className={`px-2 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 shrink-0 transition-all cursor-pointer ${
                          isPanelAtIdealPosition(activeRound, targetP, activeStageTransformMode) &&
                          !isPanelMoveMode
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                            : 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                        }`}
                        title="Lock current position & orientation as the Ideal Position across all rounds"
                      >
                        <Check className="w-3 h-3" />
                        <span>
                          {isPanelAtIdealPosition(activeRound, targetP, activeStageTransformMode) &&
                          !isPanelMoveMode
                            ? 'Ideal Position'
                            : 'Set Ideal Position'}
                        </span>
                      </button>

                      {hasTransform && (
                        <button
                          type="button"
                          onClick={() => {
                            const zeroTr = {
                              offsetX: 0,
                              offsetY: 0,
                              tOffsetX: 0,
                              tOffsetY: 0,
                              rotationDeg: 0 as const,
                              mirrorH: false,
                              mirrorV: false,
                            };
                            saveIdealPanelTransform(targetP, zeroTr, activeStageTransformMode);
                            updatePanelTransform(targetP, () => zeroTr);
                          }}
                          className="px-1.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-bold flex items-center gap-0.5 shrink-0 cursor-pointer"
                          title="Reset Move, Rotate & Mirror to 0°"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-center gap-1 min-w-0" />
              )}

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Touch Pinch / PC Scroll Zoom Status & 100% Reset Pill (Zoom with Mouse Wheel or 2-Finger Touch Pinch) */}
                <div className="inline-flex items-center rounded-lg bg-slate-950 p-0.5 border border-slate-700 gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCanvasZoom(1);
                      setCanvasPan({ x: 0, y: 0 });
                      setIsCanvasPanMode(false);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-amber-300 hover:bg-slate-800 cursor-pointer transition-colors"
                    title="Zoom with Mouse Wheel or 2-Finger Touch Pinch. Click to reset to 100%."
                  >
                    {Math.round(canvasZoom * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCanvasPanMode((p) => !p)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5 cursor-pointer ${
                      isCanvasPanMode
                        ? 'bg-sky-500 text-slate-950 font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Toggle 1-Finger Pan / Move Canvas Mode"
                  >
                    <Move className="w-3 h-3" />
                    <span className="hidden sm:inline">Pan</span>
                  </button>
                </div>

                {/* 4 Drawing Tools (Pencil, Brush, Spline, Polyline) in Top Bar for all features except Mark Water */}
                {stage === 'field_canvas' && hasFourDrawSubTools && (
                  <div className="inline-flex items-center gap-1">
                    {renderFeatureDrawSubToolSelector(true)}
                    {pending2DTrace && pending2DTrace.points.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => commitPending2DTraceToRound(pending2DTrace)}
                        className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black cursor-pointer"
                        title="Confirm current trace"
                      >
                        ✓ Confirm
                      </button>
                    )}
                  </div>
                )}

                {/* Advance (MATLAB Filters & Feature Detection) Toggle on Option Side */}
                {stage === 'field_canvas' && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !activeRound.advanceCanvasEnabled;
                      updateActiveRound((r) => ({ ...r, advanceCanvasEnabled: nextVal }));
                      if (nextVal) {
                        setRightSidebarCollapsed(false);
                      }
                    }}
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border transition-all cursor-pointer ${
                      activeRound.advanceCanvasEnabled
                        ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                        : 'bg-slate-950 text-amber-300 border-amber-500/40 hover:bg-slate-800'
                    }`}
                    title="Toggle Advance MATLAB Image Filters & Auto Feature Detection on Option Side (When off: Normal Field Map)"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{activeRound.advanceCanvasEnabled ? 'Advance: ON' : 'Advance'}</span>
                  </button>
                )}

                {/* Dual Canvas (Photogrammetry Mode: Tunnel Portion Rock Photo + Realtime Sync) */}
                {stage === 'field_canvas' && canShowSplitOption && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsPhotogrammetryDualCanvas((prev) => {
                        const next = !prev;
                        if (next && dualCanvasMobileTab === 'map') {
                          setDualCanvasMobileTab('split');
                        }
                        return next;
                      });
                    }}
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border transition-all cursor-pointer ${
                      isPhotogrammetryDualCanvas
                        ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow font-black'
                        : 'bg-slate-950 text-cyan-300 border-cyan-500/40 hover:bg-slate-800'
                    }`}
                    title={`Toggle Dual Canvas Mode: Tunnel ${FIELD_PANEL_DISPLAY_LABELS[activePanel] || activePanel} Photo on right canvas with real-time synchronization`}
                  >
                    <Columns className="w-3 h-3" />
                    <span>{isPhotogrammetryDualCanvas ? 'Dual Canvas: ON' : 'Dual Canvas'}</span>
                  </button>
                )}

                {/* 3D Joint Inspector (Orientation, Intersections, Persistence Analysis) */}
                {stage === 'field_canvas' && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = selectedTraceId || activeRound.jointTraces[0]?.id;
                      if (targetId) {
                        setInspectedJointId(targetId);
                        setIs3DJointInspectorOpen(true);
                      } else {
                        // Create a default joint trace on active panel so the inspector is ready immediately
                        const newTr: FieldJointTrace = {
                          id: `JT-${Date.now().toString(36).toUpperCase()}`,
                          panel: activePanel,
                          points: [
                            { x: 250, y: 350 },
                            { x: 500, y: 450 },
                            { x: 750, y: 550 },
                          ],
                          dipDirection: activeRound.tunnelDriveDirection || 135,
                          dipAmount: 65,
                          strike: ((activeRound.tunnelDriveDirection || 135) - 90 + 360) % 360,
                          setId: 'J1',
                          strokeWidthPx: 3.8,
                          lineMode: 'smooth',
                        };
                        updateActiveRound((r) => ({
                          ...r,
                          jointTraces: [newTr],
                        }));
                        setSelectedTraceId(newTr.id);
                        setInspectedJointId(newTr.id);
                        setIs3DJointInspectorOpen(true);
                      }
                    }}
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border transition-all cursor-pointer ${
                      selectedTraceId
                        ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                        : 'bg-slate-950 text-amber-300 border-amber-500/40 hover:bg-slate-800'
                    }`}
                    title="Open 3D Joint Inspector: 3D Orientation, Multi-Surface Intersections, Trace Extent & Persistence Analysis"
                  >
                    <Box className="w-3 h-3" />
                    <span>3D Joint Inspector</span>
                  </button>
                )}

                {/* Small Top Button for Black & White vs Colour on Canvas */}
                <div className="inline-flex items-center rounded-lg bg-slate-950 p-0.5 border border-slate-700">
                  <button
                    type="button"
                    onClick={() =>
                      updateActiveRound((r) => ({ ...r, reportColorMode: 'bw' }))
                    }
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black transition-all cursor-pointer ${
                      (activeRound.reportColorMode ?? 'color') === 'bw'
                        ? 'bg-slate-200 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Switch Canvas to Black & White Mode"
                  >
                    B&amp;W
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateActiveRound((r) => ({ ...r, reportColorMode: 'color' }))
                    }
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black transition-all cursor-pointer ${
                      (activeRound.reportColorMode ?? 'color') === 'color'
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Switch Canvas to Geological Colour Mode"
                  >
                    Colour
                  </button>
                </div>
              </div>
            </div>
            )}

            {/* Interactive 3D Tunnel Mapping Canvas (when 3D tab selected) OR 1000×1000 2D Field Canvas */}
            {stage === 'field_canvas' && is3DMappingMode ? (
              <Field3DTunnelCanvas
                activeLocation={activeLocation}
                activeRound={activeRound}
                activeTool={activeTool}
                selectedRockType={selectedRockType}
                lithologySubMode={lithologySubMode}
                veinOrFoliationSubMode={veinOrFoliationSubMode}
                selectedVeinRockId={selectedVeinRockId}
                selectedGeoFeatureType={selectedGeoFeatureType}
                selectedFaultSubType={selectedFaultSubType}
                selectedFaultElementRole={selectedFaultElementRole}
                showHwFwBadges={showHwFwBadges}
                selectedFoldSubType={selectedFoldSubType}
                selectedFoldElementRole={selectedFoldElementRole}
                showFoldLimbCrestBadges={showFoldLimbCrestBadges}
                alternatingBandMode={alternatingBandMode}
                alternatingRockIds={alternatingRockIds}
                alternatingSpacingPx={alternatingSpacingPx}
                selectedWaterCondition={selectedWaterCondition}
                activeGroupingSet={activeGroupingSet}
                brushRadius={brushRadius}
                lithologySymbolDensity={lithologySymbolDensity}
                veinBandSymbolDensity={veinBandSymbolDensity}
                veinBandSymbolSize={veinBandSymbolSize}
                veinBandThicknessPx={veinBandThicknessPx}
                jointPencilSizePx={jointPencilSizePx}
                geoFeaturePencilSizePx={geoFeaturePencilSizePx}
                geoFeatureSymbolSize={geoFeatureSymbolSize}
                geoFeatureSymbolDensity={geoFeatureSymbolDensity}
                pencilLineMode={effectivePencilLineMode}
                onChangePencilLineMode={setPencilLineMode}
                liveDipDirection={liveDipDirection}
                liveDipAmount={liveDipAmount}
                liveCrownSign={liveCrownSign}
                rememberedRocksList={rememberedRocksList}
                selectedTraceId={selectedTraceId}
                onSelectTraceId={handleSelectTraceId3D}
                onOpen3DJointInspector={(jointId) => {
                  setSelectedTraceId(jointId);
                  setInspectedJointId(jointId);
                  setIs3DJointInspectorOpen(true);
                }}
                onSetLiveOrientation={handleSetLiveOrientation3D}
                onPushUndo={pushUndoSnapshot}
                onUpdateRound={updateActiveRound}
                onSyncTraceStateChange={setSyncTrace3DState}
              />
            ) : (() => {
              const isDualCanvasActive =
                stage === 'field_canvas' && canShowSplitOption && isPhotogrammetryDualCanvas;
              return (
                <div
                  ref={canvasWrapperRef}
                  className={`flex-1 min-h-0 ${photoCanvasTheme === 'light' ? 'bg-slate-200' : 'bg-slate-950'} overflow-hidden flex flex-col items-stretch justify-center relative touch-none`}
                >
                  {/* Top selector bar containing the view label and the "Map Only" / "Split (Map + 2D Photo)" buttons */}
                  {canShowSplitOption && isDualCanvasActive && (
                    <div
                      className={`flex items-center justify-between px-3 py-1 ${
                        photoCanvasTheme === 'light'
                          ? 'bg-slate-100 border-b border-slate-300 text-slate-700'
                          : 'bg-slate-900 border-b border-slate-800 text-slate-300'
                      } text-[11px] font-semibold shrink-0 select-none z-10 w-full`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                        <span className={`font-semibold ${photoCanvasTheme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
                          {FIELD_PANEL_DISPLAY_LABELS[activePanel] || 'Face'} Canvas
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Theme Toggle in split bar */}
                        <button
                          type="button"
                          onClick={() => setPhotoCanvasTheme((t) => (t === 'light' ? 'dark' : 'light'))}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                            photoCanvasTheme === 'light'
                              ? 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                              : 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700'
                          }`}
                          title="Toggle Light Engineering Mode vs Dark Rock Mode"
                        >
                          {photoCanvasTheme === 'light' ? '☀️ Light' : '🌙 Dark'}
                        </button>
                        <div
                          className={`flex items-center rounded-lg p-0.5 border ${
                            photoCanvasTheme === 'light'
                              ? 'bg-slate-200 border-slate-300'
                              : 'bg-slate-950 border-slate-800'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setDualCanvasMobileTab('map')}
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                              dualCanvasMobileTab === 'map'
                                ? 'bg-cyan-500 text-slate-950 shadow'
                                : photoCanvasTheme === 'light'
                                ? 'text-slate-600 hover:text-slate-900'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Map Only
                          </button>
                          <button
                            type="button"
                            onClick={() => setDualCanvasMobileTab('split')}
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                              dualCanvasMobileTab === 'split'
                                ? 'bg-cyan-500 text-slate-950 shadow font-extrabold ring-1 ring-cyan-300'
                                : photoCanvasTheme === 'light'
                                ? 'text-slate-600 hover:text-slate-900'
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title="Show synchronized 2D Geological Map & Tunnel Outline Fitted Photo side-by-side"
                          >
                            <Columns className="w-3 h-3 shrink-0" />
                            <span>Split (Map + 2D Photo)</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dual or Single Canvas Container */}
                  <div
                    className={`flex-1 min-h-0 overflow-hidden flex ${
                      isDualCanvasActive && dualCanvasMobileTab === 'split' ? 'lg:flex-row gap-1' : ''
                    } items-stretch justify-center relative w-full h-full`}
                  >
                    {/* 1. GEOLOGICAL MAPPING CANVAS PANE */}
                    <div
                      className={`flex-1 min-w-0 min-h-0 flex flex-col ${
                        photoCanvasTheme === 'light' ? 'bg-[#F1F5F9]' : 'bg-[#0B0F19]'
                      } overflow-hidden relative w-full h-full ${
                        isDualCanvasActive && dualCanvasMobileTab === 'photo' ? 'hidden' : 'flex'
                      }`}
                    >
                    <div className="flex-1 min-h-0 relative flex items-center justify-center w-full h-full">
                      <svg
                        ref={canvasSvgRef}
                        viewBox={`${(500 - 500 / canvasZoom + canvasPan.x).toFixed(1)} ${(
                          500 -
                          500 / canvasZoom +
                          canvasPan.y
                        ).toFixed(1)} ${(1000 / canvasZoom).toFixed(1)} ${(1000 / canvasZoom).toFixed(1)}`}
                        preserveAspectRatio="xMidYMid meet"
                        style={{
                          backgroundColor: photoCanvasTheme === 'light' ? '#F8FAFC' : '#0B0F19',
                          width: '100%',
                          height: '100%',
                          maxWidth: '100%',
                          maxHeight: '100%',
                          cursor:
                            isCanvasPanMode ||
                            (isPanelMoveMode && (stage === 'joint_grouping' || activePanel !== 'face'))
                              ? 'grab'
                              : stage === 'field_canvas'
                              ? getFieldToolCursorDataUri(activeTool, lithologySubMode, {
                                  jointColor: (
                                    FIELD_JOINT_GROUP_COLORS[activeGroupingSet] ||
                                    FIELD_JOINT_GROUP_COLORS.unassigned
                                  ).stroke,
                                  rockColor:
                                    (activeRound.rockCustomColors || {})[selectedRockType] ||
                                    resolveRockDisplayInfo(selectedRockType, rememberedRocksList).colorTint,
                                  geoFeatureType: selectedGeoFeatureType,
                                })
                              : 'crosshair',
                        }}
                        onPointerDown={handleCanvasPointerDown}
                        onPointerMove={handleCanvasPointerMove}
                        onPointerUp={handleCanvasPointerUp}
                        onPointerCancel={handleCanvasPointerUp}
                        onPointerLeave={() => setSyncCursorCoord(null)}
                        className="w-full h-full touch-none select-none m-auto transition-all"
                      >
                <FieldMonochromeGeologicalPatterns
                  prefix="fcanv"
                  colorMode={activeRound.reportColorMode ?? 'color'}
                  symbolDensity={activeRound.lithologySymbolDensity ?? lithologySymbolDensity}
                  symbolDensityByPattern={activeRound.lithologyDensityByRock}
                  symbolAngleByPattern={activeRound.lithologyAngleByRock}
                  lithologyPatternAngle={lithologyPatternAngle}
                  alternatingAngleDeg={alternatingAngleDeg}
                  customColorsByRock={activeRound.rockCustomColors}
                  alternatingStrokes={[
                    ...activeRound.lithologyStrokes.filter(
                      (s) =>
                        (s.alternatingRockIds && s.alternatingRockIds.length >= 2) ||
                        (s.alternateRockTypes && s.alternateRockTypes.length >= 2)
                    ),
                    ...(alternatingBandMode && alternatingRockIds.length >= 2
                      ? [
                          {
                            id: 'live-preview',
                            panel: activePanel,
                            rockType: selectedRockType,
                            rockName: 'Live Alternating Preview',
                            mode: 'region_fill' as const,
                            points: [],
                            brushRadius,
                            alternatingRockIds: [...alternatingRockIds],
                            alternateRockTypes: [...alternatingRockIds],
                            alternatingSpacingPx,
                            alternateSpacingPx: alternatingSpacingPx,
                            alternateAngleDeg: alternatingAngleDeg,
                          },
                        ]
                      : []),
                  ]}
                  rememberedRocks={rememberedRocksList}
                  extraLithologyDensities={activeRound.lithologyStrokes
                    .filter(
                      (s) =>
                        s.mode !== 'vein_band' &&
                        s.mode !== 'foliation_plane' &&
                        s.mode !== 'lithology_erase'
                    )
                    .map((s) => {
                      const rm = resolveRockDisplayInfo(s.rockType, rememberedRocksList);
                      const pid = s.patternId || rm.patternId || 'quartzite';
                      const dens = Math.round(
                        s.symbolDensity ??
                          activeRound.lithologyDensityByRock?.[s.rockType] ??
                          activeRound.lithologyDensityByRock?.[pid] ??
                          activeRound.lithologySymbolDensity ??
                          lithologySymbolDensity
                      );
                      const ang = Math.round(
                        s.patternAngleDeg ??
                          activeRound.lithologyAngleByRock?.[s.rockType] ??
                          activeRound.lithologyAngleByRock?.[pid] ??
                          activeRound.lithologyPatternAngle ??
                          lithologyPatternAngle ??
                          0
                      );
                      return { patId: pid, density: dens, angleDeg: ang };
                    })}
                  bandSymbolDensity={activeRound.veinBandSymbolDensity ?? veinBandSymbolDensity}
                />
                <FieldSvgMatlabFilterDefs round={activeRound} idPrefix="fcanv-matlab" />

                {(() => {
                  const tLayout = computeTCanvasLayout(activeLocation, activeRound);
                  const panelsToRender: FieldPanelId[] =
                    canvasViewMode === 'unfolded_t'
                      ? [
                          ...(tLayout.faceGeom.hasLeftWall
                            ? (['left_wall'] as FieldPanelId[])
                            : []),
                          ...(tLayout.faceGeom.hasCrown ? (['crown'] as FieldPanelId[]) : []),
                          ...(tLayout.faceGeom.hasRightWall
                            ? (['right_wall'] as FieldPanelId[])
                            : []),
                          'face',
                        ]
                      : [activePanel];

                  const renderPanelBoxLayer = (panelId: FieldPanelId) => {
                    const isTCanvas = canvasViewMode === 'unfolded_t';
                    const pGeom = computePanelCanvasGeometry(panelId, activeLocation, activeRound);
                    const dispGeom = computeDisplayPanelGeometry(
                      panelId,
                      activeLocation,
                      activeRound,
                      activeStageTransformMode
                    );
                    const targetBox = isTCanvas
                      ? tLayout.boxes[panelId]
                      : {
                          x: dispGeom.boxX,
                          y: dispGeom.boxY,
                          w: dispGeom.boxW,
                          h: dispGeom.boxH,
                        };
                    const scaleFactor = isTCanvas
                      ? Math.min(
                          targetBox.w / Math.max(1, dispGeom.boxW),
                          targetBox.h / Math.max(1, dispGeom.boxH)
                        )
                      : 1;

                    const ptToBox = (p: FieldPoint2D): FieldPoint2D =>
                      isTCanvas
                        ? panelPointToTCanvasPoint(p, panelId, activeLocation, activeRound)
                        : panelId !== 'face'
                        ? mapPanelPointToUnfoldedBox(
                            p,
                            panelId,
                            pGeom,
                            targetBox,
                            activeRound,
                            activeStageTransformMode
                          )
                        : p;

                    const pLithStrokes =
                      stage === 'joint_grouping'
                        ? []
                        : activeRound.lithologyStrokes.filter((s) => s.panel === panelId);
                    const pTraces = activeRound.jointTraces.filter((t) => t.panel === panelId);
                    const pDipSurfaces = activeRound.dipPlaneSurfaces.filter(
                      (d) => d.panel === panelId
                    );
                    const pFeatures =
                      stage === 'joint_grouping'
                        ? []
                        : (activeRound.structuralFeatures || []).filter((f) => f.panel === panelId);
                    const pWaterMarks =
                      stage === 'joint_grouping'
                        ? []
                        : activeRound.waterMarks.filter((w) => w.panel === panelId);
                    const pPhoto =
                      activeRound.collectedPhotos
                        .slice()
                        .reverse()
                        .find((p) => p.panel === panelId) || null;

                    const mappedTracesForLabels = pTraces.map((t) => ({
                      ...t,
                      points: t.points.map(ptToBox),
                    }));
                    const pTraceLabelMap = computeTraceInlineLabelPlacements(mappedTracesForLabels);

                    const clipId = `field-panel-clip-${panelId}`;
                    const faceOutlineDetails =
                      panelId === 'face'
                        ? computeFaceTunnelOutlineDetails(
                            activeLocation,
                            targetBox.x,
                            targetBox.y,
                            targetBox.w,
                            targetBox.h
                          )
                        : null;
                    const faceOutlineD = faceOutlineDetails
                      ? faceOutlineDetails.closedFillPathD
                      : '';
                    const faceWallStrokeD = faceOutlineDetails
                      ? faceOutlineDetails.wallStrokePathD
                      : '';

                    const isPanelActive = activePanel === panelId;
                    const isDrawingOnThisPanel =
                      isDrawing &&
                      (isTCanvas ? drawingPanelRef.current === panelId : activePanel === panelId) &&
                      currentPoints.length > 0;

                    return (
                      <g key={panelId}>
                        <defs>
                          <clipPath id={clipId}>
                            {panelId === 'face' ? (
                              <path d={faceOutlineD} />
                            ) : (
                              <rect
                                x={targetBox.x}
                                y={targetBox.y}
                                width={targetBox.w}
                                height={targetBox.h}
                              />
                            )}
                          </clipPath>
                        </defs>

                        {/* Master Tunnel Surface Interior White Background */}
                        {panelId === 'face' ? (
                          <path d={faceOutlineD} fill="#FFFFFF" />
                        ) : (
                          <rect
                            x={targetBox.x}
                            y={targetBox.y}
                            width={targetBox.w}
                            height={targetBox.h}
                            fill="#FFFFFF"
                            data-ideal-position="true"
                          />
                        )}

                        {/* Clipped Geological Mapping Layers + SPL & Center Line */}
                        <g clipPath={`url(#${clipId})`}>
                          {workflowMode === 'photo_mapping' && pPhoto && showPhotoUnderlay && (
                            <FittedPanelPhotoSvgImage
                              photoUrl={pPhoto.dataUrl}
                              fitConfig={getFieldPhotoFitConfig(activeRound, panelId)}
                              boxX={targetBox.x}
                              boxY={targetBox.y}
                              boxW={targetBox.w}
                              boxH={targetBox.h}
                              filterId={`fcanv-matlab-${panelId}`}
                              overrideOpacity={
                                activeRound.advanceCanvasEnabled
                                  ? Math.max(0.15, Math.min(1, (getFieldPhotoFitConfig(activeRound, panelId).opacityPct ?? 78) / 100))
                                  : 0.45
                              }
                            />
                          )}

                          {/* SPL (Springline) & Center Line (CL) Reference Overlay */}
                          <FieldCanvasGeometryReferenceOverlay
                            activePanel={panelId}
                            location={activeLocation}
                            round={activeRound}
                            boxX={targetBox.x}
                            boxY={targetBox.y}
                            boxW={targetBox.w}
                            boxH={targetBox.h}
                            layer="underlay_grid"
                            stageMode={activeStageTransformMode}
                            mappingDomain={mappingDomain}
                          />

                          {/* 1 & 2. Lithology Region Strokes & Unified Vein / Foliation Bands */}
                          {pLithStrokes.map((st, stIdx) => {
                            if (st.mode === 'lithology_erase') return null;
                            const isBand =
                              st.mode === 'vein_band' || st.mode === 'foliation_plane';
                            const mappedPoints = st.points.map(ptToBox);

                            if (isBand) {
                              const scaledBandStroke: FieldLithologyStroke = {
                                ...st,
                                points: mappedPoints,
                                brushRadius: Math.max(
                                  1,
                                  Math.round(st.brushRadius * scaleFactor)
                                ),
                                bandThicknessPx: st.bandThicknessPx
                                  ? Math.max(2, Math.round(st.bandThicknessPx * scaleFactor))
                                  : undefined,
                              };
                              return (
                                <FieldVeinFoliationBandSvgElement
                                  key={st.id}
                                  stroke={scaledBandStroke}
                                  round={activeRound}
                                  rememberedRocks={rememberedRocksList}
                                  colorMode={activeRound.reportColorMode ?? 'color'}
                                  isSelected={selectedVeinBandId === st.id}
                                  isReportSheet={isTCanvas}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActivePanel(panelId);
                                    setSelectedVeinBandId(st.id);
                                    setSelectedVeinRockId(st.rockType);
                                    const rm = resolveRockDisplayInfo(
                                      st.rockType,
                                      rememberedRocksList
                                    );
                                    const pid = st.patternId || rm.patternId || 'quartz_vein';
                                    const thick =
                                      st.bandThicknessPx ??
                                      activeRound.veinBandThicknessByType?.[st.rockType] ??
                                      activeRound.veinBandThicknessByType?.[pid] ??
                                      st.brushRadius * 2;
                                    const dens =
                                      st.symbolDensity ??
                                      activeRound.veinBandDensityByType?.[st.rockType] ??
                                      activeRound.veinBandDensityByType?.[pid] ??
                                      activeRound.veinBandSymbolDensity ??
                                      veinBandSymbolDensity;
                                    setVeinBandThicknessPx(thick);
                                    setVeinBandSymbolDensity(dens);
                                    if (st.foliationDipDirection !== undefined) {
                                      setLiveDipDirection(st.foliationDipDirection);
                                    }
                                    if (st.foliationDipAmount !== undefined) {
                                      setLiveDipAmount(st.foliationDipAmount);
                                    }
                                  }}
                                />
                              );
                            }

                            const subsequentErases = pLithStrokes
                              .slice(stIdx + 1)
                              .filter((s) => s.mode === 'lithology_erase' && s.points.length > 0);
                            const hasLiveLithErase =
                              isDrawingOnThisPanel &&
                              activeTool === '1_lithology' &&
                              lithologySubMode === 'erase_area';
                            const needsEraseMask = subsequentErases.length > 0 || hasLiveLithErase;
                            const maskId = needsEraseMask ? `fcanv-lith-mask-${st.id}` : undefined;

                            const d =
                              st.lineMode === 'linear'
                                ? mappedPoints
                                    .map(
                                      (p, idx) =>
                                        `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
                                    )
                                    .join(' ')
                                : buildSmoothSvgPath(mappedPoints);
                            const rockMeta = resolveRockDisplayInfo(
                              st.rockType,
                              rememberedRocksList
                            );
                            const patId = st.patternId || rockMeta.patternId || 'quartzite';
                            const rawStrokeW =
                              st.brushRadius <= 8
                                ? Math.max(2, st.brushRadius)
                                : st.brushRadius * 2;
                            const effectiveStrokeWidth = Math.max(
                              2,
                              Math.round(rawStrokeW * scaleFactor)
                            );
                            const indivLithDens = Math.round(
                              st.symbolDensity ??
                                activeRound.lithologyDensityByRock?.[st.rockType] ??
                                activeRound.lithologyDensityByRock?.[patId] ??
                                activeRound.lithologySymbolDensity ??
                                lithologySymbolDensity
                            );
                            const isAltBandStroke =
                              (st.alternatingRockIds && st.alternatingRockIds.length >= 2) ||
                              (st.alternateRockTypes && st.alternateRockTypes.length >= 2);
                            const indivAngle = Math.round(
                              st.patternAngleDeg ??
                                activeRound.lithologyAngleByRock?.[st.rockType] ??
                                activeRound.lithologyAngleByRock?.[patId] ??
                                activeRound.lithologyPatternAngle ??
                                lithologyPatternAngle ??
                                0
                            );
                            const strokePatternUrl = isAltBandStroke
                              ? `url(#fcanv-alt-${st.id})`
                              : indivAngle !== 0
                              ? `url(#fcanv-${patId}-d${indivLithDens}-a${indivAngle})`
                              : `url(#fcanv-${patId}-d${indivLithDens})`;
                            const customRockCol =
                              st.customColor ||
                              (activeRound.rockCustomColors || {})[st.rockType];

                            return (
                              <g key={st.id}>
                                {maskId && (
                                  <defs>
                                    <mask
                                      id={maskId}
                                      maskUnits="userSpaceOnUse"
                                      x="0"
                                      y="0"
                                      width="1000"
                                      height="1000"
                                    >
                                      <rect x="0" y="0" width="1000" height="1000" fill="white" />
                                      {subsequentErases.map((er) => {
                                        const rawErW =
                                          er.brushRadius <= 8
                                            ? Math.max(2, er.brushRadius)
                                            : er.brushRadius * 2;
                                        return (
                                          <path
                                            key={er.id}
                                            d={buildSmoothSvgPath(er.points.map(ptToBox))}
                                            fill="none"
                                            stroke="black"
                                            strokeWidth={Math.max(
                                              2,
                                              Math.round(rawErW * scaleFactor)
                                            )}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        );
                                      })}
                                      {hasLiveLithErase && (
                                        <path
                                          d={buildSmoothSvgPath(currentPoints.map(ptToBox))}
                                          fill="none"
                                          stroke="black"
                                          strokeWidth={Math.max(
                                            2,
                                            Math.round(
                                              (brushRadius <= 8
                                                ? Math.max(2, brushRadius)
                                                : brushRadius * 2) * scaleFactor
                                            )
                                          )}
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      )}
                                    </mask>
                                  </defs>
                                )}
                                {!isAltBandStroke &&
                                  (activeRound.reportColorMode ?? 'color') === 'color' && (
                                    <path
                                      d={d}
                                      fill="none"
                                      stroke={customRockCol || rockMeta.colorTint || '#fef9c3'}
                                      strokeWidth={effectiveStrokeWidth}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      mask={maskId ? `url(#${maskId})` : undefined}
                                    />
                                  )}
                                <path
                                  d={d}
                                  fill="none"
                                  stroke={strokePatternUrl}
                                  strokeWidth={effectiveStrokeWidth}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  mask={maskId ? `url(#${maskId})` : undefined}
                                />
                              </g>
                            );
                          })}

                          {/* 4. Dip Plane Surfaces */}
                          {pDipSurfaces.map((ds) => {
                            const mappedPts = ds.points.map(ptToBox);
                            const { outlinePolygon, centroid } = buildDipSurfaceOutlineAndCentroid(
                              mappedPts,
                              Math.max(4, Math.round(ds.brushRadius * scaleFactor))
                            );
                            const polyPts = (
                              ds.outlinePolygon?.length
                                ? ds.outlinePolygon.map(ptToBox)
                                : outlinePolygon
                            )
                              .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                              .join(' ');
                            const grp =
                              FIELD_JOINT_GROUP_COLORS[ds.setId || 'unassigned'] ||
                              FIELD_JOINT_GROUP_COLORS.unassigned;
                            const isSel = selectedDipSurfaceId === ds.id;
                            const tagPrefix =
                              ds.setId && ds.setId !== 'unassigned' ? `${ds.setId} ` : '';
                            return (
                              <g
                                key={ds.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActivePanel(panelId);
                                  setSelectedDipSurfaceId(ds.id);
                                  setSelectedTraceId(null);
                                  setLiveDipDirection(ds.dipDirection);
                                  setLiveDipAmount(ds.dipAmount);
                                  if (stage === 'joint_grouping' && ds.setId !== activeGroupingSet) {
                                    pushUndoSnapshot();
                                    updateActiveRound((r) => ({
                                      ...r,
                                      dipPlaneSurfaces: r.dipPlaneSurfaces.map((item) =>
                                        item.id === ds.id
                                          ? { ...item, setId: activeGroupingSet }
                                          : item
                                      ),
                                    }));
                                  }
                                }}
                                className="cursor-pointer"
                              >
                                <polygon
                                  points={polyPts}
                                  fill={
                                    ds.setId && ds.setId !== 'unassigned'
                                      ? `${grp.fill}28`
                                      : 'rgba(15, 23, 42, 0.14)'
                                  }
                                  stroke={grp.stroke}
                                  strokeWidth={isSel ? '4' : '2.6'}
                                  strokeDasharray="8,4"
                                />
                                <text
                                  x={centroid.x}
                                  y={centroid.y - 3}
                                  textAnchor="middle"
                                  fontSize={isTCanvas ? '13' : '17'}
                                  fontWeight="900"
                                  fill={grp.stroke}
                                  stroke="#ffffff"
                                  strokeWidth="3.2"
                                  paintOrder="stroke"
                                >
                                  {tagPrefix}Dip Surface
                                </text>
                                <text
                                  x={centroid.x}
                                  y={centroid.y + (isTCanvas ? 11 : 16)}
                                  textAnchor="middle"
                                  fontSize={isTCanvas ? '14' : '18'}
                                  fontWeight="900"
                                  fill={grp.stroke}
                                  stroke="#ffffff"
                                  strokeWidth="3.2"
                                  paintOrder="stroke"
                                >
                                  {String(ds.dipDirection).padStart(3, '0')}° / {ds.dipAmount}°
                                </text>
                              </g>
                            );
                          })}

                          {/* 5. Geological / Structural Features */}
                          {pFeatures.map((feat) => (
                            <FieldStructuralFeatureSvgRenderer
                              key={feat.id}
                              feature={{
                                ...feat,
                                points: feat.points.map(ptToBox),
                              }}
                              scale={isTCanvas ? 0.85 : 1.25}
                              colorMode={activeRound.reportColorMode ?? 'color'}
                              tunnelDriveDirection={activeRound.tunnelDriveDirection}
                              isSelected={selectedFeatureId === feat.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActivePanel(panelId);
                                setSelectedFeatureId(feat.id);
                                setSelectedTraceId(null);
                                setSelectedDipSurfaceId(null);
                                setSelectedVeinBandId(null);
                                setLiveDipDirection(feat.dipDirection);
                                setLiveDipAmount(feat.dipAmount);
                              }}
                            />
                          ))}

                          {/* 6. Water Condition Symbols */}
                          {pWaterMarks.map((wm) => (
                            <FieldWaterSymbolSvgRenderer
                              key={wm.id}
                              water={{
                                ...wm,
                                points: wm.points.map(ptToBox),
                              }}
                              scale={isTCanvas ? 0.85 : 1.25}
                              colorMode={activeRound.reportColorMode ?? 'color'}
                            />
                          ))}

                          {/* 3. Joint Traces */}
                          {pTraces.map((tr) => {
                            const mappedPts = tr.points.map(ptToBox);
                            const d =
                              tr.lineMode === 'linear'
                                ? mappedPts
                                    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                                    .join(' ')
                                : buildSmoothSvgPath(mappedPts);
                            const grpColor =
                              FIELD_JOINT_GROUP_COLORS[tr.setId || 'unassigned'] ||
                              FIELD_JOINT_GROUP_COLORS.unassigned;
                            const isSel = selectedTraceId === tr.id;
                            const baseTrW = Math.max(1.2, Math.min(16, tr.strokeWidthPx ?? 3.6));
                            const isCrownPanel = panelId === 'crown';
                            const crownStrikeVal = ((tr.dipDirection - 90) % 360 + 360) % 360;
                            const crownPair = getCrownStrikePair(crownStrikeVal);
                            const prefixLabel = tr.label || (tr.setId && tr.setId !== 'unassigned' ? tr.setId : 'J');
                            const placement = pTraceLabelMap[tr.id];
                            const inlineText = isCrownPanel
                              ? `${prefixLabel} STR ${crownPair.label}`
                              : `${prefixLabel} ${String(tr.dipDirection).padStart(3, '0')}°/${tr.dipAmount}°`;

                            const {
                              mid,
                              ux: tickUx,
                              uy: tickUy,
                            } = computeTraceScreenDipTickVector(
                              mappedPts,
                              panelId,
                              tr.dipDirection,
                              activeRound.tunnelDriveDirection
                            );
                            const tickLen = isTCanvas ? 12 : 18;
                            const tickX = mid.x + tickUx * tickLen;
                            const tickY = mid.y + tickUy * tickLen;

                            // Bidirectional collinear strike arrows along trace tangent for Crown
                            const midIdx = Math.floor(mappedPts.length / 2);
                            const prevPt = mappedPts[Math.max(0, midIdx - 1)];
                            const nextPt = mappedPts[Math.min(mappedPts.length - 1, midIdx + 1)];
                            const tDx = nextPt.x - prevPt.x || 1;
                            const tDy = nextPt.y - prevPt.y || 0;
                            const tLen = Math.hypot(tDx, tDy) || 1;
                            const sUx = tDx / tLen;
                            const sUy = tDy / tLen;
                            const sArrowLen = isTCanvas ? 14 : 20;
                            const sHead = isTCanvas ? 3.5 : 5;

                            return (
                              <g
                                key={tr.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActivePanel(panelId);
                                  setSelectedTraceId(tr.id);
                                  setSelectedDipSurfaceId(null);
                                  setSelectedVeinBandId(null);
                                  setSelectedFeatureId(null);
                                  setLiveDipDirection(tr.dipDirection);
                                  setLiveDipAmount(tr.dipAmount);
                                  if (tr.strokeWidthPx) setJointPencilSizePx(tr.strokeWidthPx);
                                  if (stage === 'joint_grouping' && tr.setId !== activeGroupingSet) {
                                    pushUndoSnapshot();
                                    updateActiveRound((r) => ({
                                      ...r,
                                      jointTraces: r.jointTraces.map((item) =>
                                        item.id === tr.id
                                          ? {
                                              ...item,
                                              setId: activeGroupingSet,
                                              label:
                                                activeGroupingSet === 'unassigned'
                                                  ? 'J'
                                                  : activeGroupingSet,
                                            }
                                          : item
                                      ),
                                    }));
                                  }
                                }}
                                className="cursor-pointer"
                              >
                                <path
                                  d={d}
                                  fill="none"
                                  stroke={grpColor.stroke}
                                  strokeWidth={
                                    isSel
                                      ? (isTCanvas ? baseTrW * 0.75 : baseTrW) + 1.8
                                      : isTCanvas
                                      ? baseTrW * 0.75
                                      : baseTrW
                                  }
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />

                                {isCrownPanel ? (
                                  /* Crown: Dual opposite strike arrows along trace */
                                  <g>
                                    <line
                                      x1={mid.x - sUx * sArrowLen}
                                      y1={mid.y - sUy * sArrowLen}
                                      x2={mid.x + sUx * sArrowLen}
                                      y2={mid.y + sUy * sArrowLen}
                                      stroke={grpColor.stroke}
                                      strokeWidth={isTCanvas ? '2.4' : '3.2'}
                                      strokeLinecap="round"
                                    />
                                    {/* Forward strike arrow tip */}
                                    <polygon
                                      points={`${mid.x + sUx * sArrowLen},${mid.y + sUy * sArrowLen} ${
                                        mid.x + sUx * (sArrowLen - sHead) - sUy * (sHead * 0.6)
                                      },${mid.y + sUy * (sArrowLen - sHead) + sUx * (sHead * 0.6)} ${
                                        mid.x + sUx * (sArrowLen - sHead) + sUy * (sHead * 0.6)
                                      },${mid.y + sUy * (sArrowLen - sHead) - sUx * (sHead * 0.6)}`}
                                      fill={grpColor.stroke}
                                    />
                                    {/* Opposite strike arrow tip */}
                                    <polygon
                                      points={`${mid.x - sUx * sArrowLen},${mid.y - sUy * sArrowLen} ${
                                        mid.x - sUx * (sArrowLen - sHead) - sUy * (sHead * 0.6)
                                      },${mid.y - sUy * (sArrowLen - sHead) + sUx * (sHead * 0.6)} ${
                                        mid.x - sUx * (sArrowLen - sHead) + sUy * (sHead * 0.6)
                                      },${mid.y - sUy * (sArrowLen - sHead) - sUx * (sHead * 0.6)}`}
                                      fill={grpColor.stroke}
                                    />
                                    <circle cx={mid.x} cy={mid.y} r={isTCanvas ? '2.5' : '3.5'} fill="#ffffff" stroke={grpColor.stroke} strokeWidth="1.5" />
                                  </g>
                                ) : (
                                  /* Face / Sidewalls: Dip-direction arrow */
                                  <g>
                                    <line
                                      x1={mid.x}
                                      y1={mid.y}
                                      x2={tickX}
                                      y2={tickY}
                                      stroke={grpColor.stroke}
                                      strokeWidth={isTCanvas ? '2.1' : '2.8'}
                                    />
                                    <circle
                                      cx={tickX}
                                      cy={tickY}
                                      r={isTCanvas ? '2.2' : '2.8'}
                                      fill={grpColor.stroke}
                                    />
                                  </g>
                                )}

                                {placement && (
                                  <text
                                    x={placement.x}
                                    y={placement.y}
                                    textAnchor="middle"
                                    transform={`rotate(${placement.angleDeg.toFixed(
                                      1
                                    )}, ${placement.x.toFixed(1)}, ${placement.y.toFixed(1)})`}
                                    fontSize={isTCanvas ? '13' : '15.5'}
                                    fontWeight="900"
                                    fontFamily="Arial, sans-serif"
                                    fill={grpColor.stroke}
                                    stroke="#ffffff"
                                    strokeWidth={isTCanvas ? '3.2' : '3.8'}
                                    paintOrder="stroke"
                                  >
                                    {inlineText}
                                  </text>
                                )}
                              </g>
                            );
                          })}

                          {/* Exact Outline Snap Target Ring when hovering or starting/ending near the tunnel outline */}
                          {outlineSnapPreviewPt &&
                            outlineSnapPreviewPt.panel === panelId &&
                            (() => {
                              const snapBoxPt = ptToBox(outlineSnapPreviewPt.point);
                              return (
                                <g className="pointer-events-none">
                                  <circle
                                    cx={snapBoxPt.x}
                                    cy={snapBoxPt.y}
                                    r={isTCanvas ? 5.5 : 8}
                                    fill="none"
                                    stroke="#10b981"
                                    strokeWidth="2.4"
                                  />
                                  <circle
                                    cx={snapBoxPt.x}
                                    cy={snapBoxPt.y}
                                    r={isTCanvas ? 2.2 : 3.2}
                                    fill="#10b981"
                                  />
                                </g>
                              );
                            })()}

                          {/* Active Live Drawing Stroke Preview OR Resumable Pending 2D Trace (Pencil, Spline, Polyline) */}
                          {((isDrawingOnThisPanel && currentPoints.length >= 1) ||
                            (isPencilTool && pending2DTrace && pending2DTrace.panel === panelId)) && (() => {
                            const activePendingPts =
                              isPencilTool &&
                              pending2DTrace &&
                              pending2DTrace.panel === panelId &&
                              (!isDrawingOnThisPanel || pending2DTrace.tool === activeTool)
                                ? pending2DTrace.points
                                : [];
                            const combinedRawPts = [
                              ...activePendingPts,
                              ...(isDrawingOnThisPanel ? currentPoints : []),
                            ];
                            const previewTool =
                              isPencilTool &&
                              pending2DTrace &&
                              pending2DTrace.panel === panelId &&
                              !isDrawingOnThisPanel
                                ? pending2DTrace.tool
                                : activeTool;
                            const previewSubTool: FeatureDrawSubTool =
                              isPencilTool &&
                              pending2DTrace &&
                              pending2DTrace.panel === panelId &&
                              !isDrawingOnThisPanel &&
                              pending2DTrace.subTool
                                ? pending2DTrace.subTool
                                : activeDrawSubTool;

                            // Include rubber-band hover point when in Spline or Polyline mode and not currently dragging
                            const ptsWithHover =
                              !isDrawingOnThisPanel &&
                              (previewSubTool === 'spline' || previewSubTool === 'polyline') &&
                              combinedRawPts.length >= 1 &&
                              hoverPanelPt &&
                              hoverPanelPt.panel === panelId
                                ? [...combinedRawPts, hoverPanelPt.point]
                                : combinedRawPts;

                            const isTraceTool =
                              previewTool === '3_joint_trace' ||
                              previewTool === '2_vein_foliation' ||
                              previewTool === '5_geo_feature' ||
                              previewTool === '4_dip_surface';

                            const canonicalPreviewPts =
                              ptsWithHover.length >= 2 && previewSubTool !== 'brush'
                                ? shapeTracePointsForSubTool(
                                    ptsWithHover,
                                    previewSubTool,
                                    panelId
                                  )
                                : ptsWithHover;
                            const livePreviewPts = canonicalPreviewPts.map(ptToBox);
                            const controlVertexPts = combinedRawPts.map(ptToBox);
                            const isLiveAltLith =
                              previewTool === '1_lithology' &&
                              lithologySubMode !== 'erase_area' &&
                              alternatingBandMode &&
                              alternatingRockIds.length >= 2;
                            const liveRockMeta = resolveRockDisplayInfo(selectedRockType, rememberedRocksList);
                            const livePatId = liveRockMeta.patternId || 'quartzite';
                            const liveLithDens = Math.round(
                              activeRound.lithologyDensityByRock?.[selectedRockType] ??
                                activeRound.lithologyDensityByRock?.[livePatId] ??
                                activeRound.lithologySymbolDensity ??
                                lithologySymbolDensity
                            );
                            const liveAngle = Math.round(
                              activeRound.lithologyAngleByRock?.[selectedRockType] ??
                                activeRound.lithologyAngleByRock?.[livePatId] ??
                                activeRound.lithologyPatternAngle ??
                                lithologyPatternAngle ??
                                0
                            );
                            const liveSingleLithUrl = liveAngle !== 0
                              ? `url(#fcanv-${livePatId}-d${liveLithDens}-a${liveAngle})`
                              : `url(#fcanv-${livePatId}-d${liveLithDens})`;
                            const liveStrokeColor =
                              previewTool === '1_lithology' && lithologySubMode === 'erase_area'
                                ? '#f43f5e'
                                : isLiveAltLith
                                ? 'url(#fcanv-alt-live-preview)'
                                : previewTool === '1_lithology'
                                ? liveSingleLithUrl
                                : previewTool === '3_joint_trace'
                                ? '#0f172a'
                                : previewTool === '6_water_mark'
                                ? '#0284c7'
                                : previewTool === '5_geo_feature'
                                ? '#b91c1c'
                                : '#d97706';
                            const rawLiveW =
                              previewTool === '1_lithology'
                                ? brushRadius <= 8
                                  ? Math.max(2, brushRadius)
                                  : brushRadius * 2
                                : previewTool === '3_joint_trace'
                                ? previewSubTool === 'brush'
                                  ? Math.max(2, Math.min(16, brushRadius / 4))
                                  : jointPencilSizePx
                                : previewTool === '5_geo_feature'
                                ? previewSubTool === 'brush'
                                  ? Math.max(2.5, Math.min(16, brushRadius / 4))
                                  : geoFeaturePencilSizePx
                                : previewTool === '4_dip_surface'
                                ? previewSubTool === 'brush'
                                  ? Math.max(10, brushRadius)
                                  : 3.5
                                : previewTool === '2_vein_foliation'
                                ? previewSubTool === 'brush'
                                  ? Math.max(8, brushRadius)
                                  : activeRound.veinBandThicknessByType?.[selectedVeinRockId] ??
                                    activeRound.defaultBandThicknessPx ??
                                    veinBandThicknessPx
                                : 4;
                            const liveStrokeW = Math.max(
                              1.5,
                              Number((rawLiveW * scaleFactor).toFixed(1))
                            );

                            let liveOriOverlay: React.ReactNode = null;
                            if (isTraceTool && canonicalPreviewPts.length >= 2) {
                              const liveEst = estimateTraceOrientationFromGeometry(
                                canonicalPreviewPts,
                                panelId,
                                activeRound.tunnelDriveDirection,
                                liveCrownSign,
                                activeLocation.widthM,
                                activeLocation.heightM
                              );
                              const {
                                mid,
                                ux: tickUx,
                                uy: tickUy,
                                labelAngleDeg,
                              } = computeTraceScreenDipTickVector(
                                livePreviewPts,
                                panelId,
                                liveEst.dipDirection,
                                activeRound.tunnelDriveDirection
                              );
                              const halfOffset =
                                previewTool === '2_vein_foliation' ? liveStrokeW / 2 : 3;
                              const tickLen = halfOffset + (isTCanvas ? 14 : 22);
                              const tickX = mid.x + tickUx * tickLen;
                              const tickY = mid.y + tickUy * tickLen;

                              const prefixTag =
                                previewTool === '3_joint_trace'
                                  ? 'J'
                                  : previewTool === '2_vein_foliation'
                                  ? resolveRockDisplayInfo(
                                      selectedVeinRockId,
                                      store.rememberedRocks
                                    ).code
                                  : previewTool === '5_geo_feature'
                                  ? FIELD_STRUCTURAL_FEATURE_CATALOG.find(
                                      (f) => f.id === selectedGeoFeatureType
                                    )?.shortCode || 'FLT'
                                  : 'Dip';

                              const isCrownDrawing = panelId === 'crown';
                              const liveCrownPair = getCrownStrikePair(
                                ((liveEst.dipDirection - 90) % 360 + 360) % 360
                              );
                              const liveText = isCrownDrawing
                                ? `${prefixTag} STR ${liveCrownPair.label}`
                                : `${prefixTag} ${String(liveEst.dipDirection).padStart(3, '0')}°/${liveEst.dipAmount}°`;

                              const lblX = mid.x - tickUx * (halfOffset + (isTCanvas ? 10 : 14));
                              const lblY = mid.y - tickUy * (halfOffset + (isTCanvas ? 10 : 14));

                              liveOriOverlay = (
                                <g>
                                  <line
                                    x1={mid.x}
                                    y1={mid.y}
                                    x2={tickX}
                                    y2={tickY}
                                    stroke={liveStrokeColor}
                                    strokeWidth={isTCanvas ? '2.4' : '3.2'}
                                  />
                                  <circle
                                    cx={tickX}
                                    cy={tickY}
                                    r={isTCanvas ? '2.4' : '3.2'}
                                    fill={liveStrokeColor}
                                  />
                                  <text
                                    x={lblX}
                                    y={lblY}
                                    textAnchor="middle"
                                    transform={`rotate(${labelAngleDeg.toFixed(
                                      1
                                    )}, ${lblX.toFixed(1)}, ${lblY.toFixed(1)})`}
                                    fontSize={isTCanvas ? '13.5' : '18'}
                                    fontWeight="900"
                                    fontFamily="Arial, sans-serif"
                                    fill={liveStrokeColor}
                                    stroke="#ffffff"
                                    strokeWidth="3.5"
                                    paintOrder="stroke"
                                  >
                                    {liveText}
                                  </text>
                                </g>
                              );
                            } else if (previewTool === '6_water_mark' && livePreviewPts.length > 0) {
                              const midW = livePreviewPts[Math.floor(livePreviewPts.length / 2)];
                              liveOriOverlay = (
                                <g
                                  transform={`translate(${midW.x}, ${midW.y}) scale(${
                                    isTCanvas ? 0.85 : 1.25
                                  })`}
                                >
                                  <FieldWaterConditionGlyph
                                    condition={selectedWaterCondition}
                                    colorMode={activeRound.reportColorMode ?? 'color'}
                                  />
                                </g>
                              );
                            }

                            const livePathString =
                              livePreviewPts.length >= 2
                                ? previewSubTool === 'polyline'
                                  ? livePreviewPts
                                      .map(
                                        (p, idx) =>
                                          `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
                                      )
                                      .join(' ')
                                  : buildSmoothSvgPath(livePreviewPts)
                                : '';

                            return (
                              <g>
                                {livePathString && (
                                  <path
                                    d={livePathString}
                                    fill="none"
                                    stroke={liveStrokeColor}
                                    strokeWidth={liveStrokeW}
                                    strokeOpacity={
                                      isLiveAltLith
                                        ? 0.92
                                        : previewTool === '1_lithology' ||
                                          previewTool === '4_dip_surface' ||
                                          previewTool === '2_vein_foliation'
                                        ? 0.55
                                        : 0.95
                                    }
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                )}
                                {/* Render start anchor & control point vertices for Pencil, Spline, and Polyline */}
                                {previewSubTool !== 'brush' &&
                                  controlVertexPts.map((vp, vIdx) => {
                                    const isEndpoint =
                                      vIdx === 0 || vIdx === controlVertexPts.length - 1;
                                    if (
                                      previewSubTool === 'pencil' &&
                                      !isEndpoint
                                    ) {
                                      return null;
                                    }
                                    return (
                                      <circle
                                        key={`ctrl-v-${vIdx}`}
                                        cx={vp.x}
                                        cy={vp.y}
                                        r={isEndpoint ? (isTCanvas ? 4 : 5.5) : isTCanvas ? 3 : 4}
                                        fill={vIdx === 0 ? '#10b981' : '#f59e0b'}
                                        stroke="#ffffff"
                                        strokeWidth="1.8"
                                      />
                                    );
                                  })}
                                {liveOriOverlay}
                              </g>
                            );
                          })()}
                        </g>

                        {/* Authoritative Master Tunnel Geometry Outline (omits wall stroke on open/unclosed custom shape portions) */}
                        {panelId === 'face' ? (
                          <path
                            d={faceWallStrokeD}
                            fill="none"
                            stroke={isPanelActive ? '#0284C7' : '#0F172A'}
                            strokeWidth={isPanelActive ? '3.5' : '2.5'}
                          />
                        ) : (
                          <rect
                            x={targetBox.x}
                            y={targetBox.y}
                            width={targetBox.w}
                            height={targetBox.h}
                            fill="none"
                            stroke={isPanelActive ? '#0284C7' : '#0F172A'}
                            strokeWidth={isPanelActive ? '3.5' : '2.5'}
                          />
                        )}

                        {(!isTCanvas || panelId !== 'face') && (
                          <FieldCanvasGeometryReferenceOverlay
                            activePanel={panelId}
                            location={activeLocation}
                            round={activeRound}
                            boxX={targetBox.x}
                            boxY={targetBox.y}
                            boxW={targetBox.w}
                            boxH={targetBox.h}
                            layer="overlay_labels"
                            compact={isTCanvas}
                            isActivePanel={isPanelActive}
                            stageMode={activeStageTransformMode}
                            mappingDomain={mappingDomain}
                          />
                        )}
                      </g>
                    );
                  };

                  return (
                    <>
                      {panelsToRender.map((pid) => renderPanelBoxLayer(pid))}

                      {/* Top Center Face Title & Shape-Adaptive 1m Reference Ticks in 4-Panel Unfolded View */}
                      {canvasViewMode === 'unfolded_t' && (() => {
                        const driveStr = String(activeRound.tunnelDriveDirection).padStart(3, '0');
                        const tFaceDetails = computeFaceTunnelOutlineDetails(
                          activeLocation,
                          tLayout.faceX,
                          tLayout.faceY,
                          tLayout.faceW,
                          tLayout.faceH
                        );
                        return (
                          <g className="pointer-events-none select-none" fontFamily="IBM Plex Mono, monospace">
                            {tFaceDetails.ticks
                              .filter((tk) => tk.zone !== 'invert')
                              .map((tk, idx) => (
                                <line
                                  key={`tface-tk-${idx}`}
                                  x1={tk.x}
                                  y1={tk.y}
                                  x2={tk.x + tk.nx * 7}
                                  y2={tk.y + tk.ny * 7}
                                  stroke="#0369A1"
                                  strokeWidth="1.8"
                                />
                              ))}
                            <text
                              x={tLayout.faceX + tLayout.faceW / 2}
                              y={tLayout.faceY - 14}
                              textAnchor="middle"
                              fontSize="15.5"
                              fontWeight="900"
                              fill={activePanel === 'face' ? '#0284C7' : '#0F172A'}
                              stroke="rgba(255,255,255,0.92)"
                              strokeWidth="3.5"
                              paintOrder="stroke"
                            >
                              {domainPanelMap.face.shortLabel.toUpperCase()} ({tLayout.tunnelW}m W × {tLayout.tunnelH}m {mappingDomain === 'TRENCH' ? 'D' : 'H'} | {mappingDomain === 'TUNNEL' ? 'Drive' : mappingDomain === 'TRENCH' ? 'Axis' : 'Strike'} {driveStr}° ▲)
                            </text>
                          </g>
                        );
                      })()}
                      {/* Synchronized crosshair reticle removed per user preference */}
                    </>
                  );
                })()}
              </svg>

              {/* Resumable 2D Trace Confirmation Bar for Pencil, Spline & Polyline */}
              {isPencilTool && pending2DTrace && (
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 bg-slate-950/95 border-2 border-emerald-400 rounded-xl px-3 py-1.5 shadow-2xl flex flex-wrap items-center gap-2">
                  <div className="text-[11px] font-bold text-slate-200">
                    <span className="text-emerald-400 font-black uppercase mr-1.5">
                      {pending2DTrace.subTool === 'spline'
                        ? 'Spline Trace'
                        : pending2DTrace.subTool === 'polyline'
                        ? 'Polyline Trace'
                        : pending2DTrace.tool === '4_dip_surface'
                        ? 'Dip Surface'
                        : 'Pencil Trace'}
                    </span>
                    {pending2DTrace.points.length >= 2 ? (
                      <span className="font-mono text-amber-300">
                        {String(pending2DTrace.dipDirection).padStart(3, '0')}° /{' '}
                        {pending2DTrace.dipAmount}°
                      </span>
                    ) : (
                      <span className="text-[10px] text-cyan-300">
                        Start anchored on outline — click/drag next point
                      </span>
                    )}
                  </div>
                  {pending2DTrace.points.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => commitPending2DTraceToRound(pending2DTrace)}
                      className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Confirm
                    </button>
                  )}
                  {(pending2DTrace.subTool === 'spline' ||
                    pending2DTrace.subTool === 'polyline') &&
                    pending2DTrace.points.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPending2DTrace((prev) =>
                            prev && prev.points.length > 1
                              ? { ...prev, points: prev.points.slice(0, -1) }
                              : null
                          )
                        }
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold text-xs cursor-pointer"
                      >
                        Undo Pt
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => setPending2DTrace(null)}
                    className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 2. TUNNEL ROCK PHOTO CANVAS (2D OUTLINE-FITTED PORTION PHOTO WITH GEOLOGICAL FILTERS) */}
          {isDualCanvasActive && (
            <div
              className={`flex-1 min-w-0 min-h-0 flex flex-col ${
                photoCanvasTheme === 'light'
                  ? 'bg-slate-100'
                  : 'bg-slate-950'
              } overflow-hidden relative ${
                dualCanvasMobileTab === 'map' ? 'hidden' : 'flex'
              }`}
            >
              {/* Photo Canvas Top Bar with Geological Trace Extraction Filters */}
              <div className={`${
                photoCanvasTheme === 'light'
                  ? 'bg-slate-200 border-b border-slate-300 text-slate-800'
                  : 'bg-slate-900/95 border-b border-slate-800 text-slate-200'
              } px-2 py-1 flex flex-wrap items-center justify-between gap-1 text-[11px] font-bold shrink-0`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Camera className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                  <span className={`${photoCanvasTheme === 'light' ? 'text-cyan-800' : 'text-cyan-300'} font-mono font-bold truncate`}>
                    2. {FIELD_PANEL_DISPLAY_LABELS[activePanel] || activePanel.toUpperCase()} Fitted Photo (2D)
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0 flex-wrap">
                  {/* Filter Dropdown */}
                  <div className="inline-flex items-center bg-slate-950 rounded p-0.5 border border-slate-700 gap-1">
                    <Sliders className="w-3 h-3 text-cyan-400 shrink-0 ml-1" />
                    <select
                      value={splitPhotoFilter}
                      onChange={(e) => setSplitPhotoFilter(e.target.value as SplitPhotoFilterType)}
                      className="bg-slate-900 border-none text-cyan-300 text-[10px] rounded px-1.5 py-0.5 font-bold cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      title="Geological Filters for Joint & Trace Extraction"
                    >
                      <option value="normal">Normal (RGB Clean)</option>
                      <option value="negative">Negative (Invert - Joint Extraction)</option>
                      <option value="bw_contrast">High B&W (Fracture Aperture)</option>
                      <option value="rgb_red">Red Channel (Iron Oxide)</option>
                      <option value="rgb_green">Green Channel (Chlorite)</option>
                      <option value="rgb_blue">Blue Channel (Water Seepage)</option>
                      <option value="ridge_edge">Ridge (Edge Convolution)</option>
                      <option value="clahe">CLAHE (Adaptive Local Contrast)</option>
                      <option value="thermal">Thermal Heatmap (Relief)</option>
                      <option value="sepia">Sepia (Warm Tone)</option>
                    </select>
                  </div>

                  {/* Filter Quick-Buttons for fast one-click toggling */}
                  <div className="hidden sm:inline-flex items-center rounded bg-slate-950 p-0.5 border border-slate-800 gap-0.5">
                    <button
                      type="button"
                      onClick={() => setSplitPhotoFilter('negative')}
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold cursor-pointer transition-colors ${
                        splitPhotoFilter === 'negative'
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Invert photo to extract dark fracture lines on white ground"
                    >
                      Invert
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitPhotoFilter('bw_contrast')}
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold cursor-pointer transition-colors ${
                        splitPhotoFilter === 'bw_contrast'
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="High-contrast black & white for open joints"
                    >
                      B&W
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitPhotoFilter('ridge_edge')}
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold cursor-pointer transition-colors ${
                        splitPhotoFilter === 'ridge_edge'
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Edge detection for crack traces"
                    >
                      Ridge
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitPhotoFilter('rgb_red')}
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold cursor-pointer transition-colors ${
                        splitPhotoFilter === 'rgb_red'
                          ? 'bg-rose-500 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Isolate Red channel (hematite / iron staining)"
                    >
                      Red
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitPhotoFilter('normal')}
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold cursor-pointer transition-colors ${
                        splitPhotoFilter === 'normal'
                          ? 'bg-cyan-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Reset filter to original"
                    >
                      Orig
                    </button>
                  </div>

                  {/* Photo Brightness & Contrast Controls */}
                  <div className="inline-flex items-center bg-slate-950 rounded p-0.5 border border-slate-800 gap-0.5">
                    <button
                      type="button"
                      onClick={() => setPhotoBrightness((b) => Math.max(40, b - 15))}
                      className="px-1 text-[9px] font-mono text-slate-400 hover:text-white cursor-pointer"
                      title="Decrease Photo Brightness"
                    >
                      ☀-
                    </button>
                    <span className="text-[9px] font-mono text-amber-300 px-0.5">{photoBrightness}%</span>
                    <button
                      type="button"
                      onClick={() => setPhotoBrightness((b) => Math.min(220, b + 15))}
                      className="px-1 text-[9px] font-mono text-slate-400 hover:text-white cursor-pointer"
                      title="Increase Photo Brightness"
                    >
                      ☀+
                    </button>
                    <span className="text-slate-700">|</span>
                    <button
                      type="button"
                      onClick={() => setPhotoContrast((c) => Math.max(40, c - 15))}
                      className="px-1 text-[9px] font-mono text-slate-400 hover:text-white cursor-pointer"
                      title="Decrease Photo Contrast"
                    >
                      ◐-
                    </button>
                    <span className="text-[9px] font-mono text-cyan-300 px-0.5">{photoContrast}%</span>
                    <button
                      type="button"
                      onClick={() => setPhotoContrast((c) => Math.min(250, c + 15))}
                      className="px-1 text-[9px] font-mono text-slate-400 hover:text-white cursor-pointer"
                      title="Increase Photo Contrast"
                    >
                      ◐+
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoBrightness(100);
                        setPhotoContrast(100);
                        setSplitPhotoFilter('normal');
                      }}
                      className="px-1 text-[9px] text-slate-400 hover:text-amber-300 cursor-pointer"
                      title="Reset Filters, Brightness, and Contrast to default"
                    >
                      ↺
                    </button>
                  </div>

                  {/* Peek Traces on Photo Toggle */}
                  <button
                    type="button"
                    onClick={() => setIsPeekingTracesOnPhoto((prev) => !prev)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-black flex items-center gap-1 cursor-pointer transition-all ${
                      isPeekingTracesOnPhoto
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                    title="Show/Hide confirmed geological traces over rock photo (or hold Shift)"
                  >
                    <Eye className="w-3 h-3" />
                    <span>{isPeekingTracesOnPhoto ? 'Traces: ON' : 'Peek'}</span>
                  </button>

                  {/* Upload / Change Photo for current portion (face, left_wall, right_wall, crown) */}
                  <label
                    className="px-1.5 py-0.5 rounded bg-cyan-700/80 hover:bg-cyan-600 text-white text-[10px] font-black cursor-pointer flex items-center gap-0.5 shadow-sm"
                    title={`Upload Photo for ${FIELD_PANEL_DISPLAY_LABELS[activePanel] || activePanel}`}
                  >
                    <span>Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const url = ev.target?.result as string;
                            if (url) {
                              updateActiveRound((r) => {
                                const otherPhotos = r.collectedPhotos.filter((p) => p.panel !== activePanel);
                                const newP: FieldCollectedPhoto = {
                                  id: `photo-${activePanel}-${Date.now()}`,
                                  panel: activePanel,
                                  dataUrl: url,
                                  label: `Underground Tunnel ${activePanel} High-Resolution Rock Photo`,
                                  capturedAt: new Date().toISOString(),
                                };
                                return {
                                  ...r,
                                  collectedPhotos: [...otherPhotos, newP],
                                };
                              });
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Photo SVG Canvas with Outline-Fitted Photo & Synced Drawing */}
              <div className={`flex-1 min-h-0 relative flex items-center justify-center ${
                photoCanvasTheme === 'light' ? 'bg-[#E2E8F0]' : 'bg-slate-950'
              }`}>
                <svg
                  ref={photoCanvasSvgRef}
                  viewBox={`${(500 - 500 / canvasZoom + canvasPan.x).toFixed(1)} ${(
                    500 -
                    500 / canvasZoom +
                    canvasPan.y
                  ).toFixed(1)} ${(1000 / canvasZoom).toFixed(1)} ${(1000 / canvasZoom).toFixed(1)}`}
                  preserveAspectRatio="xMidYMid meet"
                  style={{
                    backgroundColor: photoCanvasTheme === 'light' ? '#E2E8F0' : '#020617',
                    cursor:
                      isCanvasPanMode
                        ? 'grab'
                        : getFieldToolCursorDataUri(activeTool, lithologySubMode, {
                            jointColor: (
                              FIELD_JOINT_GROUP_COLORS[activeGroupingSet] ||
                              FIELD_JOINT_GROUP_COLORS.unassigned
                            ).stroke,
                            rockColor:
                              (activeRound.rockCustomColors || {})[selectedRockType] ||
                              resolveRockDisplayInfo(selectedRockType, rememberedRocksList).colorTint,
                            geoFeatureType: selectedGeoFeatureType,
                          }),
                  }}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerCancel={handleCanvasPointerUp}
                  onPointerLeave={() => setSyncCursorCoord(null)}
                  className="w-full h-full touch-none select-none"
                >
                  <defs>
                    {/* Red channel filter for iron oxide staining */}
                    <filter id="split-filter-red-channel" colorInterpolationFilters="sRGB">
                      <feColorMatrix type="matrix" values="1.8 0 0 0 0  0 0.1 0 0 0  0 0 0.1 0 0  0 0 0 1 0" />
                      <feComponentTransfer>
                        <feFuncR type="linear" slope="1.3" intercept="-0.05" />
                      </feComponentTransfer>
                    </filter>

                    {/* Green channel filter for chlorite / epidote seams */}
                    <filter id="split-filter-green-channel" colorInterpolationFilters="sRGB">
                      <feColorMatrix type="matrix" values="0.1 0 0 0 0  0 1.8 0 0 0  0 0 0.1 0 0  0 0 0 1 0" />
                      <feComponentTransfer>
                        <feFuncG type="linear" slope="1.3" intercept="-0.05" />
                      </feComponentTransfer>
                    </filter>

                    {/* Blue channel filter for water seepage & moisture tracking */}
                    <filter id="split-filter-blue-channel" colorInterpolationFilters="sRGB">
                      <feColorMatrix type="matrix" values="0.1 0 0 0 0  0 0.1 0 0 0  0 0 1.9 0 0  0 0 0 1 0" />
                      <feComponentTransfer>
                        <feFuncB type="linear" slope="1.3" intercept="-0.05" />
                      </feComponentTransfer>
                    </filter>

                    {/* Ridge / Edge detection convolution kernel for joint traces */}
                    <filter id="split-filter-ridge" colorInterpolationFilters="sRGB">
                      <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0" />
                      <feConvolveMatrix order="3 3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" />
                      <feComponentTransfer>
                        <feFuncR type="linear" slope="2.4" intercept="0.08" />
                        <feFuncG type="linear" slope="2.4" intercept="0.08" />
                        <feFuncB type="linear" slope="2.4" intercept="0.08" />
                      </feComponentTransfer>
                    </filter>

                    {/* False-color thermal / relief mapping for rock facet gradient */}
                    <filter id="split-filter-thermal" colorInterpolationFilters="sRGB">
                      <feColorMatrix type="matrix" values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0" result="lum" />
                      <feComponentTransfer in="lum">
                        <feFuncR type="table" tableValues="0.05 0.15 0.7 1.0 0.95" />
                        <feFuncG type="table" tableValues="0.05 0.6 0.9 0.3 0.1" />
                        <feFuncB type="table" tableValues="0.7 0.9 0.2 0.05 0.05" />
                      </feComponentTransfer>
                    </filter>
                  </defs>

                  {(() => {
                    const dispGeom = computeDisplayPanelGeometry(
                      activePanel,
                      activeLocation,
                      activeRound,
                      activeStageTransformMode
                    );
                    const targetBox = {
                      x: dispGeom.boxX,
                      y: dispGeom.boxY,
                      w: dispGeom.boxW,
                      h: dispGeom.boxH,
                    };
                    const faceOutline =
                      activePanel === 'face'
                        ? computeFaceTunnelOutlineDetails(
                            activeLocation,
                            targetBox.x,
                            targetBox.y,
                            targetBox.w,
                            targetBox.h
                          )
                        : null;
                    const panelOutlinePathD =
                      faceOutline?.closedFillPathD ||
                      `M ${targetBox.x} ${targetBox.y} L ${targetBox.x + targetBox.w} ${targetBox.y} L ${targetBox.x + targetBox.w} ${targetBox.y + targetBox.h} L ${targetBox.x} ${targetBox.y + targetBox.h} Z`;

                    const clipPathId = `split-panel-clip-${activePanel}`;

                    // Calculate CSS filter based on selected filter mode and user brightness/contrast
                    let computedCssFilter = `brightness(${photoBrightness}%) contrast(${photoContrast}%)`;
                    if (splitPhotoFilter === 'negative') {
                      computedCssFilter = `invert(100%) brightness(${photoBrightness}%) contrast(${photoContrast}%)`;
                    } else if (splitPhotoFilter === 'bw_contrast') {
                      computedCssFilter = `grayscale(100%) contrast(${Math.round(photoContrast * 1.8)}%) brightness(${photoBrightness}%)`;
                    } else if (splitPhotoFilter === 'sepia') {
                      computedCssFilter = `sepia(100%) contrast(${Math.round(photoContrast * 1.3)}%) brightness(${photoBrightness}%)`;
                    } else if (splitPhotoFilter === 'clahe') {
                      computedCssFilter = `contrast(${Math.round(photoContrast * 1.6)}%) saturate(160%) brightness(${photoBrightness}%)`;
                    } else if (splitPhotoFilter === 'rgb_red') {
                      computedCssFilter = `url(#split-filter-red-channel) brightness(${photoBrightness}%) contrast(${photoContrast}%)`;
                    } else if (splitPhotoFilter === 'rgb_green') {
                      computedCssFilter = `url(#split-filter-green-channel) brightness(${photoBrightness}%) contrast(${photoContrast}%)`;
                    } else if (splitPhotoFilter === 'rgb_blue') {
                      computedCssFilter = `url(#split-filter-blue-channel) brightness(${photoBrightness}%) contrast(${photoContrast}%)`;
                    } else if (splitPhotoFilter === 'ridge_edge') {
                      computedCssFilter = `url(#split-filter-ridge) brightness(${photoBrightness}%) contrast(${photoContrast}%)`;
                    } else if (splitPhotoFilter === 'thermal') {
                      computedCssFilter = `url(#split-filter-thermal) brightness(${photoBrightness}%) contrast(${photoContrast}%)`;
                    }

                    return (
                      <>
                        {/* Clipped Outline for Active Portion */}
                        <clipPath id={clipPathId}>
                          <path d={panelOutlinePathD} />
                        </clipPath>

                        {/* Background Tunnel Profile Grid & Outline Area */}
                        <path
                          d={panelOutlinePathD}
                          fill={photoCanvasTheme === 'light' ? '#E2E8F0' : '#1E293B'}
                          stroke="#0284C7"
                          strokeWidth="2.5"
                        />

                        {/* Outline-Fitted Photo for the exact active tunnel portion */}
                        {effectiveActivePanelPhotoDataUrl && (
                          <FittedPanelPhotoSvgImage
                            photoUrl={effectiveActivePanelPhotoDataUrl}
                            fitConfig={getFieldPhotoFitConfig(activeRound, activePanel)}
                            boxX={targetBox.x}
                            boxY={targetBox.y}
                            boxW={targetBox.w}
                            boxH={targetBox.h}
                            clipPathId={clipPathId}
                            cssFilter={computedCssFilter}
                            overrideOpacity={1}
                          />
                        )}

                        {/* Portion-specific Tunnel Reference Grid, Springline (SPL), Centerline (CL) */}
                        <FieldCanvasGeometryReferenceOverlay
                          activePanel={activePanel}
                          location={activeLocation}
                          round={activeRound}
                          boxX={targetBox.x}
                          boxY={targetBox.y}
                          boxW={targetBox.w}
                          boxH={targetBox.h}
                          layer="underlay_grid"
                          stageMode={activeStageTransformMode}
                          mappingDomain={mappingDomain}
                        />

                        {/* Outer Profile Golden Perimeter Line */}
                        <path
                          d={panelOutlinePathD}
                          fill="none"
                          stroke="#F59E0B"
                          strokeWidth="2.5"
                        />

                        {/* Real-time Drawing Stroke overlay (syncs as user draws on either canvas!) */}
                        {isDrawing && currentPoints.length >= 2 && (
                          <path
                            d={buildSmoothSvgPath(currentPoints)}
                            fill="none"
                            stroke={
                              activeTool === '1_lithology'
                                ? '#38BDF8'
                                : (
                                    FIELD_JOINT_GROUP_COLORS[activeGroupingSet] ||
                                    FIELD_JOINT_GROUP_COLORS.unassigned
                                  ).stroke
                            }
                            strokeWidth={Math.max(2.5, Math.min(8, jointPencilSizePx))}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}

                        {/* Real-time Pending 2D Trace overlay */}
                        {pending2DTrace && pending2DTrace.points.length >= 2 && (
                          <path
                            d={buildSmoothSvgPath(pending2DTrace.points)}
                            fill="none"
                            stroke="#FACC15"
                            strokeWidth="3"
                            strokeDasharray="5 3"
                            strokeLinecap="round"
                          />
                        )}

                        {/* Peek Traces on Photo (Confirmed Joint Traces & Geology) */}
                        {isPeekingTracesOnPhoto && (
                          <g className="pointer-events-none opacity-90">
                            {panelTraces.map((trItem) => {
                              const grpCol =
                                FIELD_JOINT_GROUP_COLORS[trItem.setId || 'unassigned'] ||
                                FIELD_JOINT_GROUP_COLORS.unassigned;
                              return (
                                <path
                                  key={`peek-tr-${trItem.id}`}
                                  d={buildSmoothSvgPath(trItem.points)}
                                  fill="none"
                                  stroke={grpCol.stroke}
                                  strokeWidth={Math.max(2, trItem.strokeWidthPx || 2)}
                                  strokeLinecap="round"
                                />
                              );
                            })}
                          </g>
                        )}
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>
          )}
          </div>
        </div>
      );
    })()}

            {/* Bottom Bar: Stage 4 shows Face, Left Wall, Right Wall, Crown, then 3D in that exact sequence; Stage 5 shows Group Joints navigation */}
            <div className="pt-1 mt-0.5 flex items-center justify-between gap-1 shrink-0 overflow-x-auto no-scrollbar touch-pan-x">
              {stage === 'field_canvas' ? (
                <>
                  <div className="flex items-center gap-1 shrink-0">
                    {(() => {
                      const fGeomBottom = computePanelCanvasGeometry(
                        'face',
                        activeLocation,
                        activeRound
                      );
                      const availableTabs: [FieldPanelId, string][] = [
                        ['face', domainPanelMap.face.shortLabel],
                        ...(fGeomBottom.hasLeftWall
                          ? ([['left_wall', domainPanelMap.leftWall.shortLabel]] as [FieldPanelId, string][])
                          : []),
                        ...(fGeomBottom.hasRightWall
                          ? ([['right_wall', domainPanelMap.rightWall.shortLabel]] as [FieldPanelId, string][])
                          : []),
                        ...(fGeomBottom.hasCrown
                          ? ([['crown', domainPanelMap.crown.shortLabel]] as [FieldPanelId, string][])
                          : []),
                      ];
                      return availableTabs.map(([pid, label]) => (
                        <button
                          key={pid}
                          type="button"
                          onClick={() => {
                            setIs3DMappingMode(false);
                            setActivePanel(pid);
                          }}
                          className={`px-3 py-1 rounded-lg text-[10.5px] sm:text-xs font-black uppercase transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                            !is3DMappingMode && activePanel === pid
                              ? 'bg-amber-500 text-slate-950 shadow'
                              : 'bg-slate-800 text-slate-300 hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                      ));
                    })()}
                    <button
                      type="button"
                      onClick={() => setIs3DMappingMode(true)}
                      className={`px-3 py-1 rounded-lg text-[10.5px] sm:text-xs font-black uppercase transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1 ${
                        is3DMappingMode
                          ? 'bg-cyan-500 text-slate-950 shadow'
                          : 'bg-slate-800 text-cyan-300 border border-cyan-500/40 hover:text-white'
                      }`}
                      title={`Switch to 3D ${domainPanelMap.domainTitle} Mapping`}
                    >
                      <span>3D</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setStage('joint_grouping')}
                    className="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10.5px] sm:text-xs uppercase tracking-wider flex items-center gap-1 shadow whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>5. Group Joints (All 4) →</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setStage('field_canvas')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>4. {domainPanelMap.face.shortLabel} Canvas</span>
                  </button>
                  <div className="text-[11px] font-mono text-amber-300 truncate">
                    Grouped:{' '}
                    {
                      activeRound.jointTraces.filter(
                        (t) => t.setId && t.setId !== 'unassigned'
                      ).length
                    }
                    /{activeRound.jointTraces.length} Traces •{' '}
                    {
                      activeRound.dipPlaneSurfaces.filter(
                        (d) => d.setId && d.setId !== 'unassigned'
                      ).length
                    }
                    /{activeRound.dipPlaneSurfaces.length} Surfaces
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setStage('strip_align')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 font-bold text-[10.5px] sm:text-xs shrink-0 cursor-pointer"
                    >
                      6. Strip Align →
                    </button>
                    <button
                      type="button"
                      onClick={() => setStage('discontinuity_sets')}
                      className="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10.5px] sm:text-xs uppercase tracking-wider flex items-center gap-1 shadow whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>7. Discontinuity Sets →</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT DRAG / PUSH RESIZE HANDLE (Drag left to expand, drag right to shrink/collapse) */}
          <div
            onPointerDown={(e) => startSidebarDrag('right', e)}
            onDoubleClick={() => {
              if (rightSidebarCollapsed) {
                setRightSidebarCollapsed(false);
                setRightSidebarWidth(276);
              } else {
                setRightSidebarCollapsed(true);
              }
            }}
            title="Drag or push left/right to expand or shrink Right Sidebar (Tap/Double-click to toggle)"
            className="w-3.5 shrink-0 min-h-0 h-full flex flex-col items-center justify-center cursor-col-resize touch-none select-none group relative z-20"
          >
            <div
              className={`w-[2px] h-full rounded-full transition-colors ${
                draggingSidebarSide === 'right'
                  ? 'bg-amber-400'
                  : 'bg-slate-800/80 group-hover:bg-amber-400/70'
              }`}
            />
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-16 rounded-full border flex flex-col items-center justify-center gap-0.5 shadow-md transition-all ${
                draggingSidebarSide === 'right'
                  ? 'bg-amber-500 text-slate-950 border-amber-200 scale-105'
                  : 'bg-slate-900/95 text-amber-300 border-amber-500/50 group-hover:bg-slate-800 group-hover:border-amber-400 group-hover:text-white'
              }`}
            >
              <span className="text-[7px] font-black leading-none">◀▶</span>
              <span className="w-1 h-1 rounded-full bg-current opacity-80" />
              <span className="w-1 h-1 rounded-full bg-current opacity-80" />
              <span className="w-1 h-1 rounded-full bg-current opacity-80" />
            </div>
          </div>

          {/* RIGHT COLUMN: Collapsible Rectangular Strip when collapsed | Parameters, Styling, Colour Gradient & Live Compass Inspector when expanded */}
          {rightSidebarCollapsed ? (
            <button
              type="button"
              onPointerDown={(e) => startSidebarDrag('right', e)}
              className="w-9 shrink-0 min-h-0 h-full bg-slate-900/95 hover:bg-slate-800 border-2 border-amber-500/60 rounded-xl flex flex-col items-center justify-between py-3 px-1 cursor-ew-resize touch-none shadow-lg group transition-colors"
              title="Tap or drag left to expand Right Parameters & Compass Sidebar"
            >
              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px]">
                ◀
              </span>
              <span
                className="text-[10px] font-black uppercase tracking-widest text-amber-300 group-hover:text-white select-none"
                style={{ writingMode: 'vertical-rl' }}
              >
                PARAMETERS • DRAG OR TAP TO EXPAND
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            </button>
          ) : (
          <div
            style={{ width: `${rightSidebarWidth}px` }}
            className="shrink-0 min-h-0 h-full bg-slate-900/95 border border-slate-800 rounded-xl p-1.5 flex flex-col justify-between overflow-y-auto touch-pan-y"
          >
            {/* Collapse / Drag-Resize Right Sidebar Header Bar */}
            <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800 shrink-0 gap-1">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-400 truncate">
                {stage === 'joint_grouping' ? 'Joints & Compass' : 'Parameters & Compass'}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setRightSidebarCollapsed(true)}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-black text-[9px] flex items-center gap-0.5 cursor-pointer border border-slate-700"
                  title="Shrink / Collapse Right Sidebar (or drag left edge)"
                >
                  <span>Shrink ▶</span>
                </button>
              </div>
            </div>
            {stage === 'field_canvas' && is3DMappingMode && (
              <div className="mb-1.5 shrink-0">
                <Field3DNewTraceUnfoldedSyncBox
                  activeLocation={activeLocation}
                  activeRound={activeRound}
                  syncState={syncTrace3DState}
                  onClearNewTraceSync={() =>
                    setSyncTrace3DState((prev) =>
                      prev ? { ...prev, latestCompletedIds: [] } : null
                    )
                  }
                />
              </div>
            )}
            {stage === 'field_canvas' && activeRound.advanceCanvasEnabled && (
              <div className="mb-2 shrink-0">
                <FieldCanvasAdvanceMatlabPanel
                  activeRound={activeRound}
                  activePanel={activePanel}
                  activeLocation={activeLocation}
                  onUpdateRound={updateActiveRound}
                  onPushUndo={pushUndoSnapshot}
                />
              </div>
            )}
            {stage === 'joint_grouping' ? (
              <div className="space-y-2.5">
                <div className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Joint Sets &amp; Orientation Visualizer
                </div>

                {/* Live Compass & Inclinometer when a Joint Trace or Dip Surface is selected */}
                {(selectedTraceId || selectedDipSurfaceId) && (
                  <FieldLiveCompassInclinometer
                    tunnelDriveAzimuth={activeRound.tunnelDriveDirection}
                    activePanel={activePanel}
                    dipDirection={liveDipDirection}
                    dipAmount={liveDipAmount}
                    strike={(liveDipDirection - 90 + 360) % 360}
                    crownDipSign={liveCrownSign}
                    selectedSetId={
                      activeGroupingSet === 'unassigned' ? 'J1' : activeGroupingSet
                    }
                    showSetSelector={false}
                    modeLabel="Selected Joint Orientation (Live)"
                    onChangeDipDirection={handleCompassDipDirectionChange}
                    onChangeDipAmount={handleCompassDipAmountChange}
                    onChangeCrownDipSign={handleCrownSignChange}
                    onChangeSetId={() => {}}
                    onRecalculateFromTrace={handleRecalculateSelectedFromTrace}
                  />
                )}

                {/* List of all mapped Joint Traces & Dip Surfaces across all 4 panels for easy grouping */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-300">
                    <span>All Mapped Joints (All 4 Panels)</span>
                    <span className="font-mono text-amber-400">
                      {activeRound.jointTraces.length + activeRound.dipPlaneSurfaces.length} total
                    </span>
                  </div>

                  {activeRound.jointTraces.length === 0 &&
                  activeRound.dipPlaneSurfaces.length === 0 ? (
                    <div className="p-3 text-center text-[11px] text-slate-500">
                      No Joint Traces or Dip Surfaces mapped yet. Draw traces on{' '}
                      <button
                        type="button"
                        onClick={() => setStage('field_canvas')}
                        className="text-amber-400 underline font-bold"
                      >
                        4. Face Canvas
                      </button>{' '}
                      first.
                    </div>
                  ) : (
                    <div className="max-h-[340px] overflow-y-auto space-y-1 pr-0.5">
                      {activeRound.jointTraces.map((tr, idx) => {
                        const grpMeta =
                          FIELD_JOINT_GROUP_COLORS[tr.setId || 'unassigned'] ||
                          FIELD_JOINT_GROUP_COLORS.unassigned;
                        const isSel = selectedTraceId === tr.id;
                        return (
                          <div
                            key={tr.id}
                            onClick={() => {
                              setActivePanel(tr.panel);
                              setSelectedTraceId(tr.id);
                              setSelectedDipSurfaceId(null);
                              setLiveDipDirection(tr.dipDirection);
                              setLiveDipAmount(tr.dipAmount);
                            }}
                            className={`p-1.5 rounded-lg border text-[10.5px] cursor-pointer transition-all ${
                              isSel
                                ? 'bg-slate-800 border-amber-400'
                                : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="px-2 py-0.5 rounded font-black text-xs text-white"
                                  style={{ backgroundColor: grpMeta.stroke }}
                                >
                                  {tr.setId === 'unassigned' ? 'J' : tr.setId}
                                </span>
                                <span className="font-bold text-slate-200 uppercase text-xs">
                                  {tr.panel.replace('_', ' ')} #{idx + 1}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-xs text-amber-300">
                                  {String(tr.dipDirection).padStart(3, '0')}°/{tr.dipAmount}°
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTraceId(tr.id);
                                    setInspectedJointId(tr.id);
                                    setIs3DJointInspectorOpen(true);
                                  }}
                                  className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 text-[10px] font-bold cursor-pointer transition-all"
                                  title="Inspect joint in 3D"
                                >
                                  3D
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {(
                                [
                                  'J1',
                                  'J2',
                                  'J3',
                                  'J4',
                                  'J5',
                                  'J-Bedding',
                                  'J-Random',
                                  'unassigned',
                                ] as FieldJointGroupingId[]
                              ).map((sKey) => {
                                const active = (tr.setId || 'unassigned') === sKey;
                                const col = FIELD_JOINT_GROUP_COLORS[sKey].stroke;
                                return (
                                  <button
                                    key={sKey}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      pushUndoSnapshot();
                                      updateActiveRound((r) => ({
                                        ...r,
                                        jointTraces: r.jointTraces.map((item) =>
                                          item.id === tr.id
                                            ? {
                                                ...item,
                                                setId: sKey,
                                                label: sKey === 'unassigned' ? 'J' : sKey,
                                              }
                                            : item
                                        ),
                                      }));
                                    }}
                                    className={`px-2 py-0.5 rounded text-[11px] font-black border cursor-pointer ${
                                      active
                                        ? 'text-white border-white shadow'
                                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                                    }`}
                                    style={active ? { backgroundColor: col } : undefined}
                                  >
                                    {sKey === 'unassigned'
                                      ? 'J'
                                      : sKey === 'J-Bedding'
                                      ? 'S0'
                                      : sKey === 'J-Random'
                                      ? 'JR'
                                      : sKey}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                      {activeRound.dipPlaneSurfaces.map((ds, idx) => {
                        const grpMeta =
                          FIELD_JOINT_GROUP_COLORS[ds.setId || 'unassigned'] ||
                          FIELD_JOINT_GROUP_COLORS.unassigned;
                        const isSel = selectedDipSurfaceId === ds.id;
                        return (
                          <div
                            key={ds.id}
                            onClick={() => {
                              setActivePanel(ds.panel);
                              setSelectedDipSurfaceId(ds.id);
                              setSelectedTraceId(null);
                              setLiveDipDirection(ds.dipDirection);
                              setLiveDipAmount(ds.dipAmount);
                            }}
                            className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                              isSel
                                ? 'bg-slate-800 border-amber-400'
                                : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="px-2 py-0.5 rounded font-black text-xs text-white"
                                  style={{ backgroundColor: grpMeta.stroke }}
                                >
                                  {ds.setId === 'unassigned' ? 'Dip' : ds.setId}
                                </span>
                                <span className="font-bold text-slate-200 uppercase text-xs">
                                  {ds.panel.replace('_', ' ')} Surf #{idx + 1}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-xs text-cyan-300">
                                {String(ds.dipDirection).padStart(3, '0')}°/{ds.dipAmount}°
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {(
                                [
                                  'J1',
                                  'J2',
                                  'J3',
                                  'J4',
                                  'J5',
                                  'J-Bedding',
                                  'J-Random',
                                  'unassigned',
                                ] as FieldJointGroupingId[]
                              ).map((sKey) => {
                                const active = (ds.setId || 'unassigned') === sKey;
                                const col = FIELD_JOINT_GROUP_COLORS[sKey].stroke;
                                return (
                                  <button
                                    key={sKey}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      pushUndoSnapshot();
                                      updateActiveRound((r) => ({
                                        ...r,
                                        dipPlaneSurfaces: r.dipPlaneSurfaces.map((item) =>
                                          item.id === ds.id ? { ...item, setId: sKey } : item
                                        ),
                                      }));
                                    }}
                                    className={`px-2 py-0.5 rounded text-[11px] font-black border cursor-pointer ${
                                      active
                                        ? 'text-white border-white shadow'
                                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                                    }`}
                                    style={active ? { backgroundColor: col } : undefined}
                                  >
                                    {sKey === 'unassigned'
                                      ? 'J'
                                      : sKey === 'J-Bedding'
                                      ? 'S0'
                                      : sKey === 'J-Random'
                                      ? 'JR'
                                      : sKey}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
            <>
            {/* ==================== RIGHT INSPECTOR: TOOL 1 BRUSH SIZE, COLOUR GRADIENT, ALTERNATING BANDS & DENSITY ==================== */}
            {activeTool === '1_lithology' && (
              <div className="space-y-2.5">
                {/* Brush / Lithology Eraser Size Bar */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-300">
                    <span className="font-black uppercase tracking-wider text-amber-400">
                      {lithologySubMode === 'erase_area' ? 'Litho Eraser Size' : 'Lithology Brush Size'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 font-mono font-bold text-amber-300">
                      {brushRadius} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={100}
                    step={1}
                    value={brushRadius}
                    onChange={(e) => setBrushRadius(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="grid grid-cols-5 gap-1">
                    {[2, 8, 20, 40, 75].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setBrushRadius(sz)}
                        className={`py-0.5 rounded text-[9.5px] font-bold border cursor-pointer ${
                          Math.abs(brushRadius - sz) <= 1
                            ? 'bg-amber-500 text-slate-950 border-amber-300'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                        }`}
                      >
                        {sz}px
                      </button>
                    ))}
                  </div>
                </div>

                {/* ==================== PER-LITHOLOGY INDIVIDUAL SYMBOL DENSITY CONTROL (ONLY SHOWN WHEN ROCK IS AVAILABLE ON ACTIVE CANVAS) ==================== */}
                {(() => {
                  const visibleLithStrokes = pruneFullyErasedLithologyStrokes(
                    activeRound.lithologyStrokes
                  ).filter((s) =>
                    is3DMappingMode || canvasViewMode === 'unfolded_t'
                      ? true
                      : s.panel === activePanel
                  );

                  const mappedLithRockTypes = Array.from(
                    new Set(
                      visibleLithStrokes
                        .filter(
                          (s) =>
                            s.mode !== 'vein_band' &&
                            s.mode !== 'foliation_plane' &&
                            s.mode !== 'lithology_erase'
                        )
                        .map((s) => s.rockType)
                    )
                  );

                  // Automatically remove/hide rock density controls if no lithology rock is available on the canvas
                  if (mappedLithRockTypes.length === 0) return null;

                  const effectiveRockType = mappedLithRockTypes.includes(selectedRockType)
                    ? selectedRockType
                    : mappedLithRockTypes[0];
                  const activeRockMeta = resolveRockDisplayInfo(
                    effectiveRockType,
                    rememberedRocksList
                  );
                  const currentRockDensity =
                    activeRound.lithologyDensityByRock?.[effectiveRockType] ??
                    activeRound.lithologyDensityByRock?.[activeRockMeta.patternId] ??
                    activeRound.lithologySymbolDensity ??
                    lithologySymbolDensity;

                  const applyIndividualRockDensity = (nextDens: number) => {
                    setLithologySymbolDensity(nextDens);
                    updateActiveRound((r) => ({
                      ...r,
                      lithologyDensityByRock: {
                        ...(r.lithologyDensityByRock || {}),
                        [effectiveRockType]: nextDens,
                        [activeRockMeta.patternId]: nextDens,
                      },
                      lithologyStrokes: r.lithologyStrokes.map((s) =>
                        s.mode !== 'vein_band' &&
                        s.mode !== 'foliation_plane' &&
                        s.rockType === effectiveRockType
                          ? { ...s, symbolDensity: nextDens }
                          : s
                      ),
                    }));
                  };

                  return (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {mappedLithRockTypes.map((rId) => {
                          const rm = resolveRockDisplayInfo(rId, rememberedRocksList);
                          const rDens =
                            activeRound.lithologyDensityByRock?.[rId] ??
                            activeRound.lithologyDensityByRock?.[rm.patternId] ??
                            activeRound.lithologySymbolDensity ??
                            85;
                          const isCur = effectiveRockType === rId;
                          return (
                            <button
                              key={rId}
                              type="button"
                              onClick={() => setSelectedRockType(rId)}
                              className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border cursor-pointer ${
                                isCur
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                              }`}
                            >
                              {rm.name} ({rm.code}): {rDens}%
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 truncate">
                          Symbols Density — {activeRockMeta.name} ({activeRockMeta.code})
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold shrink-0">
                          {currentRockDensity}%
                        </span>
                      </div>

                      <input
                        type="range"
                        min={30}
                        max={180}
                        step={5}
                        value={currentRockDensity}
                        onChange={(e) => applyIndividualRockDensity(Number(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                      <div className="grid grid-cols-4 gap-1">
                        {(
                          [
                            [45, 'Sparse'],
                            [70, 'Spacious'],
                            [95, 'Normal'],
                            [140, 'Dense'],
                          ] as [number, string][]
                        ).map(([densVal, label]) => {
                          const isPreset = Math.abs(currentRockDensity - densVal) <= 5;
                          return (
                            <button
                              key={label}
                              type="button"
                              onClick={() => applyIndividualRockDensity(densVal)}
                              className={`py-1 rounded text-[10px] font-bold border cursor-pointer ${
                                isPreset
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* ==================== ROCK LITHOLOGY SYMBOL ANGLE (DIP / BEDDING / FOLIATION ORIENTATION) ==================== */}
                {(() => {
                  const activeRockMeta = resolveRockDisplayInfo(
                    selectedRockType,
                    rememberedRocksList
                  );
                  const currentRockAngle =
                    activeRound.lithologyAngleByRock?.[selectedRockType] ??
                    activeRound.lithologyAngleByRock?.[activeRockMeta.patternId] ??
                    activeRound.lithologyPatternAngle ??
                    lithologyPatternAngle ??
                    0;

                  const applyRockAngle = (angleVal: number) => {
                    const normalized = Math.max(-180, Math.min(180, Math.round(angleVal)));
                    setLithologyPatternAngle(normalized);
                    updateActiveRound((r) => ({
                      ...r,
                      lithologyPatternAngle: normalized,
                      lithologyAngleByRock: {
                        ...(r.lithologyAngleByRock || {}),
                        [selectedRockType]: normalized,
                        [activeRockMeta.patternId]: normalized,
                      },
                      lithologyStrokes: r.lithologyStrokes.map((s) =>
                        s.rockType === selectedRockType &&
                        s.mode === 'region_fill' &&
                        (!s.alternatingRockIds || s.alternatingRockIds.length < 2)
                          ? { ...s, patternAngleDeg: normalized }
                          : s
                      ),
                    }));
                  };

                  return (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-amber-400 truncate">
                            Symbol Angle — {activeRockMeta.name} ({activeRockMeta.code})
                          </div>
                          <div className="text-[9px] text-slate-400">
                            Rotates pattern symbols (bedding, foliation, cleavage)
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Mini interactive compass angle indicator */}
                          <div
                            className="w-7 h-7 rounded-full bg-slate-900 border border-amber-400/60 relative flex items-center justify-center shadow-inner"
                            title={`Current Symbol Dip Angle: ${currentRockAngle}°`}
                          >
                            <div className="absolute w-full h-[1px] bg-slate-700/60" />
                            <div
                              className="absolute w-6 h-[2px] bg-amber-400 rounded-full transition-transform duration-150"
                              style={{ transform: `rotate(${currentRockAngle}deg)` }}
                            />
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-300 z-10" />
                          </div>
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                            {currentRockAngle > 0 ? `+${currentRockAngle}°` : `${currentRockAngle}°`}
                          </span>
                        </div>
                      </div>

                      {/* Angle Slider (-90° to +90°) */}
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-slate-400 shrink-0">-90°</span>
                        <input
                          type="range"
                          min={-90}
                          max={90}
                          step={5}
                          value={currentRockAngle}
                          onChange={(e) => applyRockAngle(Number(e.target.value))}
                          className="w-full accent-amber-400 cursor-pointer"
                        />
                        <span className="text-[9px] font-mono text-slate-400 shrink-0">+90°</span>
                      </div>

                      {/* Quick Angle Presets */}
                      <div className="grid grid-cols-5 gap-1">
                        {(
                          [
                            [-60, '-60°'],
                            [-45, '-45°'],
                            [-30, '-30°'],
                            [0, '0° Flat'],
                            [30, '+30°'],
                            [45, '+45°'],
                            [60, '+60°'],
                            [90, '90° Vert'],
                            [-90, '-90° Vert'],
                            [180, '180°'],
                          ] as [number, string][]
                        ).map(([angVal, label]) => {
                          const isSel = currentRockAngle === angVal;
                          return (
                            <button
                              key={`ang-${angVal}`}
                              type="button"
                              onClick={() => applyRockAngle(angVal)}
                              className={`py-0.5 px-1 rounded text-[9px] font-bold border cursor-pointer transition-all ${
                                isSel
                                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow font-black'
                                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* ==================== ROCK COLOUR & SMALL SIDE GRADIENT BOX PICKER ==================== */}
                {(() => {
                  const activeRockMeta = resolveRockDisplayInfo(
                    selectedRockType,
                    rememberedRocksList
                  );
                  const currentRockHex =
                    (activeRound.rockCustomColors || {})[selectedRockType] ||
                    activeRockMeta.colorTint ||
                    '#fecaca';
                  const activeFam =
                    FIELD_LITHOLOGY_COLOR_FAMILIES.find((f) => f.id === activeColorFamilyId) ||
                    FIELD_LITHOLOGY_COLOR_FAMILIES[0];

                  const applyRockCustomColor = (hex: string) => {
                    updateActiveRound((r) => ({
                      ...r,
                      rockCustomColors: {
                        ...(r.rockCustomColors || {}),
                        [selectedRockType]: hex,
                      },
                      lithologyStrokes: r.lithologyStrokes.map((s) =>
                        s.rockType === selectedRockType &&
                        s.mode !== 'vein_band' &&
                        s.mode !== 'foliation_plane'
                          ? { ...s, customColor: hex, fillColor: hex, color: hex }
                          : s
                      ),
                    }));
                  };

                  return (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 truncate">
                          Rock Colour — {activeRockMeta.name} ({activeRockMeta.code})
                        </span>
                        <span
                          className="px-2 py-0.5 rounded border border-slate-700 font-mono text-[9.5px] font-bold text-slate-950 shadow-inner"
                          style={{ backgroundColor: currentRockHex }}
                        >
                          {currentRockHex}
                        </span>
                      </div>

                      {/* Left Base Colour Swatches + Side Small Gradient Box */}
                      <div className="grid grid-cols-12 gap-2 items-stretch">
                        {/* Base Colour Families (Red, Orange, Amber, Green, Teal, Blue, Purple, Slate) */}
                        <div className="col-span-5 grid grid-cols-2 gap-1">
                          {FIELD_LITHOLOGY_COLOR_FAMILIES.map((fam) => {
                            const isFamSel = activeColorFamilyId === fam.id;
                            return (
                              <button
                                key={fam.id}
                                type="button"
                                onClick={() => {
                                  setActiveColorFamilyId(fam.id);
                                  applyRockCustomColor(fam.shades[2]);
                                }}
                                className={`px-1.5 py-1 rounded text-[9.5px] font-bold flex items-center gap-1 border cursor-pointer transition-all ${
                                  isFamSel
                                    ? 'bg-slate-800 text-white border-amber-400 shadow'
                                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                                }`}
                                title={`Choose ${fam.label} colour family`}
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-sm border border-black/40 shrink-0"
                                  style={{ backgroundColor: fam.baseHex }}
                                />
                                <span className="truncate">{fam.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Side Small Gradient Box for Selected Colour Family */}
                        <div className="col-span-7 bg-slate-900 border border-slate-700 rounded-lg p-2 flex flex-col justify-between">
                          <div className="flex items-center justify-between text-[9.5px] font-bold text-slate-300 mb-1">
                            <span>{activeFam.label} Gradient Box</span>
                            <span className="text-[8.5px] text-amber-300">Pick Shade</span>
                          </div>
                          {/* Continuous visual gradient bar */}
                          <div
                            className="h-3.5 w-full rounded border border-slate-600 mb-1.5"
                            style={{
                              background: `linear-gradient(90deg, ${activeFam.shades.join(', ')})`,
                            }}
                          />
                          {/* 6 Pickable Gradient Shade Swatches */}
                          <div className="grid grid-cols-6 gap-1">
                            {activeFam.shades.map((shHex, idx) => {
                              const isShadeActive =
                                currentRockHex.toLowerCase() === shHex.toLowerCase();
                              return (
                                <button
                                  key={shHex}
                                  type="button"
                                  onClick={() => applyRockCustomColor(shHex)}
                                  className={`h-6 rounded border transition-all cursor-pointer ${
                                    isShadeActive
                                      ? 'border-2 border-white scale-105 shadow-md'
                                      : 'border-slate-700 hover:border-amber-300'
                                  }`}
                                  style={{ backgroundColor: shHex }}
                                  title={`Pick ${activeFam.label} shade ${idx + 1} (${shHex})`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ==================== ALTERNATING SEDIMENTARY & METAMORPHIC BANDS (2 OR 3 LITHOLOGIES + SPACING) ==================== */}
                <div className="bg-slate-950 border border-cyan-500/40 rounded-xl p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                        Alternate Lithology Bands (2–3 Rocks)
                      </div>
                      <div className="text-[9px] text-slate-400">
                        Sedimentary / Metamorphic interbedded alternating bands on canvas
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextMode = !alternatingBandMode;
                        setAlternatingBandMode(nextMode);
                        // Also apply or clear on existing active-panel region_fill strokes so the user sees it immediately on canvas
                        if (nextMode && alternatingRockIds.length >= 2) {
                          const altNames = alternatingRockIds.map(
                            (rid) => resolveRockDisplayInfo(rid, rememberedRocksList).name
                          );
                          updateActiveRound((r) => {
                            const panelRegionStrokes = r.lithologyStrokes.filter(
                              (s) => s.panel === activePanel && s.mode === 'region_fill'
                            );
                            if (panelRegionStrokes.length === 0) return r;
                            const hasAnyAlt = panelRegionStrokes.some(
                              (s) => s.alternatingRockIds && s.alternatingRockIds.length >= 2
                            );
                            const targetStrokeId =
                              panelRegionStrokes[panelRegionStrokes.length - 1].id;
                            return {
                              ...r,
                              lithologyStrokes: r.lithologyStrokes.map((s) => {
                                if (
                                  s.panel === activePanel &&
                                  s.mode === 'region_fill' &&
                                  (hasAnyAlt
                                    ? s.alternatingRockIds && s.alternatingRockIds.length >= 2
                                    : s.id === targetStrokeId)
                                ) {
                                  return {
                                    ...s,
                                    rockName: altNames.join(' / '),
                                    alternatingRockIds: [...alternatingRockIds],
                                    alternateRockTypes: [...alternatingRockIds],
                                    alternatingRockNames: altNames,
                                    alternatingSpacingPx,
                                    alternateSpacingPx: alternatingSpacingPx,
                                  };
                                }
                                return s;
                              }),
                            };
                          });
                        }
                      }}
                      className={`px-2 py-1 rounded text-[9.5px] font-black uppercase border cursor-pointer transition-all ${
                        alternatingBandMode
                          ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
                      }`}
                    >
                      {alternatingBandMode ? '✓ Active' : 'Enable'}
                    </button>
                  </div>

                  {alternatingBandMode && (
                    <div className="space-y-2 pt-1.5 border-t border-slate-800">
                      <div className="flex items-center justify-between text-[9.5px]">
                        <span className="text-slate-300 font-bold">
                          Selected Alternating Rocks ({alternatingRockIds.length}/3):
                        </span>
                        <span className="font-mono text-cyan-300 font-bold">
                          {alternatingRockIds
                            .map((id) => resolveRockDisplayInfo(id, rememberedRocksList).code)
                            .join(' ⇄ ')}
                        </span>
                      </div>

                      {/* Quick 2 or 3 Rock Multi-Selector */}
                      <div className="grid grid-cols-3 gap-1 max-h-28 overflow-y-auto pr-0.5">
                        {FIELD_LITHOLOGY_CATALOG.map((r) => {
                          const idxInAlt = alternatingRockIds.indexOf(r.id);
                          const isChosen = idxInAlt !== -1;
                          return (
                            <button
                              key={`alt-${r.id}`}
                              type="button"
                              onClick={() => {
                                let computedNext: string[] = alternatingRockIds;
                                if (alternatingRockIds.includes(r.id)) {
                                  if (alternatingRockIds.length > 2) {
                                    computedNext = alternatingRockIds.filter((x) => x !== r.id);
                                  }
                                } else if (alternatingRockIds.length >= 3) {
                                  computedNext = [
                                    alternatingRockIds[1],
                                    alternatingRockIds[2],
                                    r.id,
                                  ];
                                } else {
                                  computedNext = [...alternatingRockIds, r.id];
                                }
                                setAlternatingRockIds(computedNext);
                                const altNames = computedNext.map(
                                  (rid) => resolveRockDisplayInfo(rid, rememberedRocksList).name
                                );
                                updateActiveRound((roundPrev) => ({
                                  ...roundPrev,
                                  lithologyStrokes: roundPrev.lithologyStrokes.map((s) =>
                                    s.panel === activePanel &&
                                    ((s.alternatingRockIds && s.alternatingRockIds.length >= 2) ||
                                      (s.alternateRockTypes && s.alternateRockTypes.length >= 2))
                                      ? {
                                          ...s,
                                          rockName: altNames.join(' / '),
                                          alternatingRockIds: [...computedNext],
                                          alternateRockTypes: [...computedNext],
                                          alternatingRockNames: altNames,
                                          alternatingSpacingPx,
                                          alternateSpacingPx: alternatingSpacingPx,
                                        }
                                      : s
                                  ),
                                }));
                              }}
                              className={`px-1.5 py-1 rounded text-[9.5px] font-bold border text-left truncate flex items-center justify-between cursor-pointer ${
                                isChosen
                                  ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-black'
                                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                              }`}
                            >
                              <span className="truncate">{r.code}</span>
                              {isChosen && (
                                <span className="px-1 rounded bg-slate-950 text-cyan-300 text-[8.5px] font-mono">
                                  #{idxInAlt + 1}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Lithology Band Spacing Control */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold uppercase text-cyan-300">
                            Lithology Band Spacing
                          </span>
                          <span className="px-2 py-0.5 rounded bg-cyan-500/20 font-mono text-[10px] font-bold text-cyan-300">
                            {alternatingSpacingPx} px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={8}
                          max={48}
                          step={2}
                          value={alternatingSpacingPx}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setAlternatingSpacingPx(val);
                            updateActiveRound((r) => ({
                              ...r,
                              lithologyStrokes: r.lithologyStrokes.map((s) =>
                                (s.alternatingRockIds && s.alternatingRockIds.length >= 2) ||
                                (s.alternateRockTypes && s.alternateRockTypes.length >= 2)
                                  ? {
                                      ...s,
                                      alternatingSpacingPx: val,
                                      alternateSpacingPx: val,
                                    }
                                  : s
                              ),
                            }));
                          }}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                        <div className="grid grid-cols-4 gap-1 mt-1">
                          {(
                            [
                              [10, 'Thin (10px)'],
                              [18, 'Med (18px)'],
                              [28, 'Wide (28px)'],
                              [40, 'Broad (40px)'],
                            ] as [number, string][]
                          ).map(([spVal, lbl]) => (
                            <button
                              key={lbl}
                              type="button"
                              onClick={() => {
                                setAlternatingSpacingPx(spVal);
                                updateActiveRound((r) => ({
                                  ...r,
                                  lithologyStrokes: r.lithologyStrokes.map((s) =>
                                    (s.alternatingRockIds && s.alternatingRockIds.length >= 2) ||
                                    (s.alternateRockTypes && s.alternateRockTypes.length >= 2)
                                      ? {
                                          ...s,
                                          alternatingSpacingPx: spVal,
                                          alternateSpacingPx: spVal,
                                        }
                                      : s
                                  ),
                                }));
                              }}
                              className={`py-0.5 rounded text-[9px] font-bold border cursor-pointer ${
                                Math.abs(alternatingSpacingPx - spVal) <= 2
                                  ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                              }`}
                            >
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Alternating Strata & Symbols Angle Control (Interbedding Dip) */}
                      <div className="pt-2 border-t border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-black uppercase text-cyan-300">
                              Alternating Bands &amp; Symbols Angle
                            </span>
                            <div className="text-[8.5px] text-slate-400">
                              Rotates alternating strata bands and lithology symbols together
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Mini rotating strata preview */}
                            <div
                              className="w-7 h-7 rounded-lg bg-slate-900 border border-cyan-400/60 overflow-hidden relative flex items-center justify-center shadow-inner"
                              title={`Current Alternating Angle: ${alternatingAngleDeg}°`}
                            >
                              <div
                                className="w-10 h-10 flex flex-col justify-center gap-0.5 transition-transform duration-150"
                                style={{ transform: `rotate(${alternatingAngleDeg}deg)` }}
                              >
                                <div className="w-full h-1 bg-cyan-400/80 rounded-full" />
                                <div className="w-full h-1 bg-amber-400/80 rounded-full" />
                                <div className="w-full h-1 bg-teal-400/80 rounded-full" />
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-cyan-500/20 font-mono text-[10px] font-bold text-cyan-300">
                              {alternatingAngleDeg > 0 ? `+${alternatingAngleDeg}°` : `${alternatingAngleDeg}°`}
                            </span>
                          </div>
                        </div>

                        {/* Angle Slider (-90° to +90°) */}
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-slate-400 shrink-0">-90°</span>
                          <input
                            type="range"
                            min={-90}
                            max={90}
                            step={5}
                            value={alternatingAngleDeg}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setAlternatingAngleDeg(val);
                              updateActiveRound((r) => ({
                                ...r,
                                alternateLithologyConfig: {
                                  ...(r.alternateLithologyConfig || {
                                    enabled: true,
                                    count: (alternatingRockIds.length as 2 | 3) || 2,
                                    rockTypes: alternatingRockIds,
                                    spacingPx: alternatingSpacingPx,
                                    angleDeg: val,
                                  }),
                                  angleDeg: val,
                                },
                                lithologyStrokes: r.lithologyStrokes.map((s) =>
                                  (s.alternatingRockIds && s.alternatingRockIds.length >= 2) ||
                                  (s.alternateRockTypes && s.alternateRockTypes.length >= 2)
                                    ? {
                                        ...s,
                                        alternateAngleDeg: val,
                                      }
                                    : s
                                ),
                              }));
                            }}
                            className="w-full accent-cyan-400 cursor-pointer"
                          />
                          <span className="text-[9px] font-mono text-slate-400 shrink-0">+90°</span>
                        </div>

                        {/* Quick Presets for Alternating Bands */}
                        <div className="grid grid-cols-5 gap-1">
                          {(
                            [
                              [-60, '-60°'],
                              [-45, '-45°'],
                              [-22, '-22° Nat'],
                              [0, '0° Flat'],
                              [30, '+30°'],
                              [45, '+45°'],
                              [60, '+60°'],
                              [90, '90° Vert'],
                              [-90, '-90° Vert'],
                              [180, '180°'],
                            ] as [number, string][]
                          ).map(([angVal, lbl]) => {
                            const isAltSel = alternatingAngleDeg === angVal;
                            return (
                              <button
                                key={`alt-ang-${angVal}`}
                                type="button"
                                onClick={() => {
                                  setAlternatingAngleDeg(angVal);
                                  updateActiveRound((r) => ({
                                    ...r,
                                    alternateLithologyConfig: {
                                      ...(r.alternateLithologyConfig || {
                                        enabled: true,
                                        count: (alternatingRockIds.length as 2 | 3) || 2,
                                        rockTypes: alternatingRockIds,
                                        spacingPx: alternatingSpacingPx,
                                        angleDeg: angVal,
                                      }),
                                      angleDeg: angVal,
                                    },
                                    lithologyStrokes: r.lithologyStrokes.map((s) =>
                                      (s.alternatingRockIds && s.alternatingRockIds.length >= 2) ||
                                      (s.alternateRockTypes && s.alternateRockTypes.length >= 2)
                                        ? {
                                            ...s,
                                            alternateAngleDeg: angVal,
                                          }
                                        : s
                                    ),
                                  }));
                                }}
                                className={`py-0.5 px-1 rounded text-[9px] font-bold border cursor-pointer transition-all ${
                                  isAltSel
                                    ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-black'
                                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
                                }`}
                              >
                                {lbl}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================== RIGHT INSPECTOR: TOOL 2 VEIN & FOLIATION BAND THICKNESS, SYMBOL SIZE, SYMBOL DENSITY & COMPASS ==================== */}
            {activeTool === '2_vein_foliation' && (
              <div className="space-y-2.5">
                <div className="text-xs font-black uppercase tracking-wider text-amber-400">
                  2. Vein &amp; Foliation Parameters
                </div>
                {(() => {
                  const drawnBandTypeIds: string[] = Array.from(
                    new Set<string>(
                      activeRound.lithologyStrokes
                        .filter(
                          (s) =>
                            (s.mode === 'vein_band' || s.mode === 'foliation_plane') &&
                            (is3DMappingMode || canvasViewMode === 'unfolded_t'
                              ? true
                              : s.panel === activePanel)
                        )
                        .map((s) => String(s.rockType))
                    )
                  );

                  const isSelectedBandAvailable = drawnBandTypeIds.includes(selectedVeinRockId);
                  const catalogBand = FIELD_VEIN_AND_FOLIATION_CATALOG.find(
                    (v) => v.id === selectedVeinRockId
                  );
                  const resolvedBand = resolveRockDisplayInfo(
                    selectedVeinRockId,
                    store.rememberedRocks
                  );
                  const activeBandMeta = catalogBand || {
                    id: selectedVeinRockId,
                    name: resolvedBand.name,
                    code: resolvedBand.code,
                    patternId: resolvedBand.patternId || 'quartz_vein',
                  };
                  const activeBandPatId = activeBandMeta.patternId;

                  const matchingBandStrokes = activeRound.lithologyStrokes.filter(
                    (s) =>
                      (s.mode === 'vein_band' || s.mode === 'foliation_plane') &&
                      s.rockType === selectedVeinRockId
                  );
                  const currentBandThick = Math.max(
                    2,
                    Math.round(
                      activeRound.veinBandThicknessByType?.[selectedVeinRockId] ??
                        activeRound.veinBandThicknessByType?.[activeBandPatId] ??
                        matchingBandStrokes[matchingBandStrokes.length - 1]?.bandThicknessPx ??
                        activeRound.defaultBandThicknessPx ??
                        veinBandThicknessPx
                    )
                  );

                  const currentBandSymSize = Math.max(
                    40,
                    Math.round(
                      activeRound.veinBandSymbolSizeByType?.[selectedVeinRockId] ??
                        activeRound.veinBandSymbolSizeByType?.[activeBandPatId] ??
                        matchingBandStrokes[matchingBandStrokes.length - 1]?.symbolSize ??
                        activeRound.veinBandSymbolSize ??
                        veinBandSymbolSize
                    )
                  );

                  const currentBandDensity = Math.max(
                    10,
                    Math.round(
                      activeRound.veinBandDensityByType?.[selectedVeinRockId] ??
                        activeRound.veinBandDensityByType?.[activeBandPatId] ??
                        matchingBandStrokes[matchingBandStrokes.length - 1]?.symbolDensity ??
                        activeRound.veinBandSymbolDensity ??
                        veinBandSymbolDensity
                    )
                  );

                  const applyIndividualBandThickness = (nextThick: number) => {
                    const clampedThick = Math.max(2, Math.min(92, nextThick));
                    setVeinBandThicknessPx(clampedThick);
                    updateActiveRound((r) => ({
                      ...r,
                      veinBandThicknessByType: {
                        ...(r.veinBandThicknessByType || {}),
                        [selectedVeinRockId]: clampedThick,
                        [activeBandPatId]: clampedThick,
                      },
                      lithologyStrokes: r.lithologyStrokes.map((s) =>
                        (s.mode === 'vein_band' || s.mode === 'foliation_plane') &&
                        (s.rockType === selectedVeinRockId || s.id === selectedVeinBandId)
                          ? {
                              ...s,
                              bandThicknessPx: clampedThick,
                              brushRadius: Math.max(1, Math.round(clampedThick / 2)),
                            }
                          : s
                      ),
                    }));
                  };

                  const applyIndividualBandSymbolSize = (nextSize: number) => {
                    const clampedSize = Math.max(40, Math.min(200, nextSize));
                    setVeinBandSymbolSize(clampedSize);
                    updateActiveRound((r) => ({
                      ...r,
                      veinBandSymbolSize: clampedSize,
                      veinBandSymbolSizeByType: {
                        ...(r.veinBandSymbolSizeByType || {}),
                        [selectedVeinRockId]: clampedSize,
                        [activeBandPatId]: clampedSize,
                      },
                      lithologyStrokes: r.lithologyStrokes.map((s) =>
                        (s.mode === 'vein_band' || s.mode === 'foliation_plane') &&
                        (s.rockType === selectedVeinRockId || s.id === selectedVeinBandId)
                          ? {
                              ...s,
                              symbolSize: clampedSize,
                            }
                          : s
                      ),
                    }));
                  };

                  const applyIndividualBandDensity = (nextDens: number) => {
                    const clampedDens = Math.max(10, Math.min(200, nextDens));
                    setVeinBandSymbolDensity(clampedDens);
                    updateActiveRound((r) => ({
                      ...r,
                      veinBandDensityByType: {
                        ...(r.veinBandDensityByType || {}),
                        [selectedVeinRockId]: clampedDens,
                        [activeBandPatId]: clampedDens,
                      },
                      lithologyStrokes: r.lithologyStrokes.map((s) =>
                        (s.mode === 'vein_band' || s.mode === 'foliation_plane') &&
                        (s.rockType === selectedVeinRockId || s.id === selectedVeinBandId)
                          ? {
                              ...s,
                              symbolDensity: clampedDens,
                            }
                          : s
                      ),
                    }));
                  };

                  return (
                    <>
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 space-y-2.5">
                        {/* Quick switcher for mapped band types available on canvas */}
                        {drawnBandTypeIds.length > 0 && (
                          <div className="flex flex-wrap gap-1 pb-1.5 border-b border-slate-800/80">
                            {drawnBandTypeIds.map((bId) => {
                              const bMeta =
                                FIELD_VEIN_AND_FOLIATION_CATALOG.find((v) => v.id === bId) ||
                                resolveRockDisplayInfo(bId, store.rememberedRocks);
                              const bThick = Math.round(
                                activeRound.veinBandThicknessByType?.[bId] ??
                                  activeRound.lithologyStrokes.find(
                                    (s) =>
                                      (s.mode === 'vein_band' || s.mode === 'foliation_plane') &&
                                      s.rockType === bId
                                  )?.bandThicknessPx ??
                                  28
                              );
                              const bDens = Math.round(
                                activeRound.veinBandDensityByType?.[bId] ??
                                  activeRound.lithologyStrokes.find(
                                    (s) =>
                                      (s.mode === 'vein_band' || s.mode === 'foliation_plane') &&
                                      s.rockType === bId
                                  )?.symbolDensity ??
                                  85
                              );
                              const isCur = selectedVeinRockId === bId;
                              return (
                                <button
                                  key={bId}
                                  type="button"
                                  onClick={() => setSelectedVeinRockId(bId)}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                                    isCur
                                      ? 'bg-amber-500 text-slate-950 border-amber-300'
                                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                                  }`}
                                >
                                  {bMeta.code}: {bThick}px · {bDens}%
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* 1. Band Showing Thickness (2px to 92px) */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 truncate">
                              Band Thickness — {activeBandMeta.code}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold shrink-0">
                              {currentBandThick} px
                            </span>
                          </div>
                          <input
                            type="range"
                            min={2}
                            max={92}
                            step={1}
                            value={currentBandThick}
                            onChange={(e) => applyIndividualBandThickness(Number(e.target.value))}
                            className="w-full accent-amber-500 cursor-pointer"
                          />
                          <div className="grid grid-cols-5 gap-1 mt-1.5">
                            {(
                              [
                                [2, '2px'],
                                [8, '8px'],
                                [18, '18px'],
                                [30, '30px'],
                                [52, '52px'],
                              ] as [number, string][]
                            ).map(([thickVal, label]) => {
                              const isPreset = Math.abs(currentBandThick - thickVal) <= 1;
                              return (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() => applyIndividualBandThickness(thickVal)}
                                  className={`py-1 rounded text-[10px] font-bold border cursor-pointer ${
                                    isPreset
                                      ? 'bg-amber-500 text-slate-950 border-amber-300'
                                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 2. Band Symbol Size (40% to 200%) */}
                        <div className="pt-2 border-t border-slate-800/80">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase text-cyan-400 truncate">
                              Symbol Size — {activeBandMeta.code}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-cyan-500/20 font-mono text-[10px] font-bold text-cyan-300 shrink-0">
                              {currentBandSymSize}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={40}
                            max={200}
                            step={5}
                            value={currentBandSymSize}
                            onChange={(e) => applyIndividualBandSymbolSize(Number(e.target.value))}
                            className="w-full accent-cyan-400 cursor-pointer"
                          />
                          <div className="grid grid-cols-4 gap-1 mt-1.5">
                            {(
                              [
                                [60, 'Small'],
                                [100, 'Normal'],
                                [140, 'Large'],
                                [180, 'X-Large'],
                              ] as [number, string][]
                            ).map(([szVal, label]) => {
                              const isPreset = Math.abs(currentBandSymSize - szVal) <= 5;
                              return (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() => applyIndividualBandSymbolSize(szVal)}
                                  className={`py-1 rounded text-[10px] font-bold border cursor-pointer ${
                                    isPreset
                                      ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 3. Band Symbol Density (10% to 200%) */}
                        <div className="pt-2 border-t border-slate-800/80">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase text-emerald-400 truncate">
                              Symbol Density — {activeBandMeta.code}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 font-mono text-[10px] font-bold text-emerald-300 shrink-0">
                              {currentBandDensity}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={10}
                            max={200}
                            step={5}
                            value={currentBandDensity}
                            onChange={(e) => applyIndividualBandDensity(Number(e.target.value))}
                            className="w-full accent-emerald-500 cursor-pointer"
                          />
                          <div className="grid grid-cols-5 gap-1 mt-1.5">
                            {(
                              [
                                [15, '15%'],
                                [45, '45%'],
                                [80, '80%'],
                                [100, '100%'],
                                [150, '150%'],
                              ] as [number, string][]
                            ).map(([densVal, label]) => {
                              const isPreset = Math.abs(currentBandDensity - densVal) <= 5;
                              return (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() => applyIndividualBandDensity(densVal)}
                                  className={`py-1 rounded text-[10px] font-bold border cursor-pointer ${
                                    isPreset
                                      ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {isSelectedBandAvailable && (
                        <FieldLiveCompassInclinometer
                          tunnelDriveAzimuth={activeRound.tunnelDriveDirection}
                          activePanel={activePanel}
                          dipDirection={liveDipDirection}
                          dipAmount={liveDipAmount}
                          strike={(liveDipDirection - 90 + 360) % 360}
                          crownDipSign={liveCrownSign}
                          selectedSetId="J-Bedding"
                          showSetSelector={false}
                          modeLabel="Vein / Foliation Band Direction & Dip"
                          onChangeDipDirection={(nextDir) => {
                            setLiveDipDirection(nextDir);
                            updateActiveRound((r) => {
                              const panelBands = r.lithologyStrokes.filter(
                                (s) =>
                                  s.panel === activePanel &&
                                  (s.mode === 'vein_band' || s.mode === 'foliation_plane')
                              );
                              const targetBandId =
                                selectedVeinBandId &&
                                panelBands.some((b) => b.id === selectedVeinBandId)
                                  ? selectedVeinBandId
                                  : panelBands.length > 0
                                  ? panelBands[panelBands.length - 1].id
                                  : null;
                              if (!targetBandId) return r;
                              return {
                                ...r,
                                lithologyStrokes: r.lithologyStrokes.map((s) =>
                                  s.id === targetBandId ? { ...s, foliationDipDirection: nextDir } : s
                                ),
                              };
                            });
                          }}
                          onChangeDipAmount={(nextAmt) => {
                            setLiveDipAmount(nextAmt);
                            updateActiveRound((r) => {
                              const panelBands = r.lithologyStrokes.filter(
                                (s) =>
                                  s.panel === activePanel &&
                                  (s.mode === 'vein_band' || s.mode === 'foliation_plane')
                              );
                              const targetBandId =
                                selectedVeinBandId &&
                                panelBands.some((b) => b.id === selectedVeinBandId)
                                  ? selectedVeinBandId
                                  : panelBands.length > 0
                                  ? panelBands[panelBands.length - 1].id
                                  : null;
                              if (!targetBandId) return r;
                              return {
                                ...r,
                                lithologyStrokes: r.lithologyStrokes.map((s) =>
                                  s.id === targetBandId ? { ...s, foliationDipAmount: nextAmt } : s
                                ),
                              };
                            });
                          }}
                          onChangeCrownDipSign={setLiveCrownSign}
                          onChangeSetId={() => {}}
                          onRecalculateFromTrace={handleRecalculateSelectedFromTrace}
                        />
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* ==================== TOOL 3 & TOOL 4: JOINT TRACE PENCIL SIZE BAR + COMPASS & INCLINOMETER ==================== */}
            {(activeTool === '3_joint_trace' || activeTool === '4_dip_surface') && (
              <div className="space-y-2.5">
                {activeTool === '3_joint_trace' && (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                        Joint Trace Pencil Size
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                        {jointPencilSizePx} px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1.5}
                      max={14}
                      step={0.5}
                      value={jointPencilSizePx}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setJointPencilSizePx(val);
                        if (selectedTraceId) {
                          updateActiveRound((r) => ({
                            ...r,
                            jointTraces: r.jointTraces.map((t) =>
                              t.id === selectedTraceId ? { ...t, strokeWidthPx: val } : t
                            ),
                          }));
                        }
                      }}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="grid grid-cols-5 gap-1">
                      {[2, 3.5, 5, 8, 12].map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => {
                            setJointPencilSizePx(sz);
                            if (selectedTraceId) {
                              updateActiveRound((r) => ({
                                ...r,
                                jointTraces: r.jointTraces.map((t) =>
                                  t.id === selectedTraceId ? { ...t, strokeWidthPx: sz } : t
                                ),
                              }));
                            }
                          }}
                          className={`py-1 rounded text-[10px] font-bold border cursor-pointer ${
                            Math.abs(jointPencilSizePx - sz) <= 0.4
                              ? 'bg-amber-500 text-slate-950 border-amber-300'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                          }`}
                        >
                          {sz}px
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(activeTool === '3_joint_trace'
                  ? activeRound.jointTraces.length > 0 || (isDrawing && currentPoints.length >= 2)
                  : activeRound.dipPlaneSurfaces.length > 0 || (isDrawing && currentPoints.length >= 2)) ? (
                  <FieldLiveCompassInclinometer
                    tunnelDriveAzimuth={activeRound.tunnelDriveDirection}
                    activePanel={activePanel}
                    dipDirection={liveDipDirection}
                    dipAmount={liveDipAmount}
                    strike={(liveDipDirection - 90 + 360) % 360}
                    crownDipSign={liveCrownSign}
                    selectedSetId="J1"
                    showSetSelector={false}
                    modeLabel={
                      activeTool === '3_joint_trace'
                        ? 'Joint Trace Compass & Inclinometer (Live)'
                        : 'Dip Surface Compass & Inclinometer (Live)'
                    }
                    onChangeDipDirection={handleCompassDipDirectionChange}
                    onChangeDipAmount={handleCompassDipAmountChange}
                    onChangeCrownDipSign={handleCrownSignChange}
                    onChangeSetId={() => {}}
                    onRecalculateFromTrace={handleRecalculateSelectedFromTrace}
                  />
                ) : (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-400">
                    Draw a{' '}
                    <strong className="text-amber-300">
                      {activeTool === '3_joint_trace' ? 'Joint Trace' : 'Dip Plane Surface'}
                    </strong>{' '}
                    on the canvas to display its live Compass &amp; Inclinometer controls.
                  </div>
                )}
              </div>
            )}

            {/* ==================== RIGHT INSPECTOR: TOOL 5 GEOLOGICAL FEATURE PENCIL SIZE, SYMBOL SIZE, SYMBOL DENSITY & COMPASS ==================== */}
            {activeTool === '5_geo_feature' && (
              <div className="space-y-2.5">
                <div className="text-xs font-black uppercase tracking-wider text-amber-400">
                  5. Geological Feature Parameters
                </div>
                {/* Geological Feature Pencil Size, Symbol Size & Symbol Density Controls */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 space-y-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                        Feature Pencil Size
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                        {geoFeaturePencilSizePx} px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1.5}
                      max={14}
                      step={0.5}
                      value={geoFeaturePencilSizePx}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setGeoFeaturePencilSizePx(val);
                        updateActiveRound((r) => ({
                          ...r,
                          structuralFeatures: (r.structuralFeatures || []).map((f) =>
                            f.id === selectedFeatureId || f.featureType === selectedGeoFeatureType
                              ? { ...f, strokeWidthPx: val }
                              : f
                          ),
                        }));
                      }}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="grid grid-cols-5 gap-1 mt-1">
                      {[2, 3.5, 5, 8, 12].map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => {
                            setGeoFeaturePencilSizePx(sz);
                            updateActiveRound((r) => ({
                              ...r,
                              structuralFeatures: (r.structuralFeatures || []).map((f) =>
                                f.id === selectedFeatureId || f.featureType === selectedGeoFeatureType
                                  ? { ...f, strokeWidthPx: sz }
                                  : f
                              ),
                            }));
                          }}
                          className={`py-1 rounded text-[10px] font-bold border cursor-pointer ${
                            Math.abs(geoFeaturePencilSizePx - sz) <= 0.4
                              ? 'bg-amber-500 text-slate-950 border-amber-300'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                          }`}
                        >
                          {sz}px
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase text-cyan-400">
                        Feature Symbol Size
                      </span>
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 font-mono text-[10px] font-bold text-cyan-300">
                        {geoFeatureSymbolSize}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={40}
                      max={220}
                      step={5}
                      value={geoFeatureSymbolSize}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setGeoFeatureSymbolSize(val);
                        updateActiveRound((r) => ({
                          ...r,
                          structuralFeatures: (r.structuralFeatures || []).map((f) =>
                            f.id === selectedFeatureId || f.featureType === selectedGeoFeatureType
                              ? { ...f, symbolSize: val }
                              : f
                          ),
                        }));
                      }}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                    <div className="grid grid-cols-4 gap-1 mt-1">
                      {(
                        [
                          [60, 'Small'],
                          [100, 'Normal'],
                          [140, 'Large'],
                          [180, 'X-Large'],
                        ] as [number, string][]
                      ).map(([szVal, label]) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            setGeoFeatureSymbolSize(szVal);
                            updateActiveRound((r) => ({
                              ...r,
                              structuralFeatures: (r.structuralFeatures || []).map((f) =>
                                f.id === selectedFeatureId || f.featureType === selectedGeoFeatureType
                                  ? { ...f, symbolSize: szVal }
                                  : f
                              ),
                            }));
                          }}
                          className={`py-1 rounded text-[10px] font-bold border cursor-pointer ${
                            Math.abs(geoFeatureSymbolSize - szVal) <= 5
                              ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase text-emerald-400">
                        Feature Symbol Density
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 font-mono text-[10px] font-bold text-emerald-300">
                        {geoFeatureSymbolDensity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={200}
                      step={5}
                      value={geoFeatureSymbolDensity}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setGeoFeatureSymbolDensity(val);
                        updateActiveRound((r) => ({
                          ...r,
                          structuralFeatures: (r.structuralFeatures || []).map((f) =>
                            f.id === selectedFeatureId || f.featureType === selectedGeoFeatureType
                              ? { ...f, symbolDensity: val }
                              : f
                          ),
                        }));
                      }}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                    <div className="grid grid-cols-4 gap-1 mt-1">
                      {(
                        [
                          [50, 'Sparse'],
                          [100, 'Normal'],
                          [140, 'Dense'],
                          [180, 'V.Dense'],
                        ] as [number, string][]
                      ).map(([densVal, label]) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            setGeoFeatureSymbolDensity(densVal);
                            updateActiveRound((r) => ({
                              ...r,
                              structuralFeatures: (r.structuralFeatures || []).map((f) =>
                                f.id === selectedFeatureId || f.featureType === selectedGeoFeatureType
                                  ? { ...f, symbolDensity: densVal }
                                  : f
                              ),
                            }));
                          }}
                          className={`py-1 rounded text-[10px] font-bold border cursor-pointer ${
                            Math.abs(geoFeatureSymbolDensity - densVal) <= 5
                              ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {((activeRound.structuralFeatures || []).some(
                  (f) => f.featureType === selectedGeoFeatureType
                ) ||
                  (isDrawing && currentPoints.length >= 2)) && (
                  <FieldLiveCompassInclinometer
                    tunnelDriveAzimuth={activeRound.tunnelDriveDirection}
                    activePanel={activePanel}
                    dipDirection={liveDipDirection}
                    dipAmount={liveDipAmount}
                    strike={(liveDipDirection - 90 + 360) % 360}
                    crownDipSign={liveCrownSign}
                    selectedSetId="J1"
                    showSetSelector={false}
                    modeLabel="Fault / Feature Dip Direction & Dip (Live)"
                    onChangeDipDirection={handleCompassDipDirectionChange}
                    onChangeDipAmount={handleCompassDipAmountChange}
                    onChangeCrownDipSign={handleCrownSignChange}
                    onChangeSetId={() => {}}
                    onRecalculateFromTrace={handleRecalculateSelectedFromTrace}
                  />
                )}
              </div>
            )}

            {/* ==================== TOOL 6: MARK WATER CONDITIONS ==================== */}
            {activeTool === '6_water_mark' && (
              <div className="space-y-2.5">
                <div className="text-xs font-black uppercase tracking-wider text-sky-400">
                  6. Mark Groundwater / Seepage Symbol
                </div>
                <div className="space-y-1.5">
                  {FIELD_WATER_CATALOG.map((w) => (
                    <button
                      key={w.condition}
                      onClick={() => setSelectedWaterCondition(w.condition)}
                      className={`w-full text-left p-2 rounded-xl border transition-all flex items-center gap-2.5 cursor-pointer ${
                        selectedWaterCondition === w.condition
                          ? 'bg-sky-500 text-slate-950 border-sky-300 font-black shadow'
                          : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <FieldWaterSymbolPreviewSvg
                        condition={w.condition}
                        colorMode={activeRound.reportColorMode ?? 'color'}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-xs font-bold gap-1">
                          <span>{w.condition}</span>
                          <span
                            className={`font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                              selectedWaterCondition === w.condition
                                ? 'bg-slate-950 text-sky-300'
                                : 'bg-slate-900 text-sky-400'
                            }`}
                          >
                            {w.symbol}
                          </span>
                        </div>
                        <div
                          className={`text-[10px] truncate mt-0.5 ${
                            selectedWaterCondition === w.condition
                              ? 'text-slate-900'
                              : 'text-slate-400'
                          }`}
                        >
                          {w.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            </>
            )}
          </div>
          )}
        </div>
      )}

      {/* ==================== STAGE 6: WALL & CROWN UNFOLDED STRIP ALIGNMENT ==================== */}
      {stage === 'strip_align' && activeLocation && activeRound && (
        <FieldStripAlignmentStage
          activeLocation={activeLocation}
          activeRound={activeRound}
          onUpdateRound={updateActiveRound}
          onBackToCanvas={() => setStage('joint_grouping')}
          onCompleteAndContinue={() => setStage('discontinuity_sets')}
        />
      )}

      {/* ==================== STAGE 7: DEDICATED DISCONTINUITY SETS (WITH CUSTOM OPTIONS) ==================== */}
      {(stage === 'discontinuity_sets' || stage === 'discontinuity_q_rmr') && activeRound && (
        <FieldDiscontinuitySetsStage
          activeProject={activeProject}
          activeLocation={activeLocation}
          activeRound={activeRound}
          onUpdateProject={updateActiveProject}
          onUpdateRound={updateActiveRound}
          onUpdateSetRecord={handleUpdateDiscontinuitySet}
          onBackToStripAlign={() => setStage('strip_align')}
          onContinueToClassifications={() => setStage('q_rmr_gsi')}
        />
      )}

      {/* ==================== STAGE 8: DEDICATED Q-SYSTEM, RMR89 & GSI SHEET ==================== */}
      {stage === 'q_rmr_gsi' && activeRound && (
        <FieldRockMassClassificationsStage
          activeRound={activeRound}
          onUpdateRound={updateActiveRound}
          onBackToSets={() => setStage('discontinuity_sets')}
          onContinueToSupport={() => setStage('support_system')}
        />
      )}

      {/* ==================== STAGE 9: DEDICATED SUPPORT SYSTEM (2D DRAWING + 3D SPOT BOLTS) ==================== */}
      {stage === 'support_system' && activeLocation && activeRound && (
        <FieldSupportSystemStage
          activeLocation={activeLocation}
          activeRound={activeRound}
          onUpdateRound={updateActiveRound}
          onBackToClassifications={() => setStage('q_rmr_gsi')}
          onContinueToSurvey={() => setStage('survey_overbreak')}
        />
      )}

      {/* ==================== STAGE 10: DEDICATED TUNNEL FACE SURVEY & OVERBREAK ==================== */}
      {stage === 'survey_overbreak' && activeLocation && activeRound && (
        <FieldSurveyOverbreakStage
          activeProject={activeProject}
          activeLocation={activeLocation}
          activeRound={activeRound}
          onUpdateProject={updateActiveProject}
          onUpdateRound={updateActiveRound}
          onBackToSupport={() => setStage('support_system')}
          onContinueToReport={() => setStage('word_template_export')}
        />
      )}

      {/* ==================== STAGE 12: CLEAN PROFESSIONAL GEOLOGICAL REPORT + SAVE TO PROJECT 1 ==================== */}
      {stage === 'word_template_export' && activeProject && activeLocation && activeRound && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="bg-slate-900 border-b border-slate-800 px-3 py-1.5 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                Report Suite:
              </span>
              <button
                type="button"
                onClick={() => setStage('word_template_export')}
                className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[11px] cursor-pointer"
              >
                1. Standard 2-Page {domainPanelMap.domainTitle} Report
              </button>
              <button
                type="button"
                onClick={() => setStage('photo_2d_report')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 font-black text-[11px] cursor-pointer"
              >
                2. 2D Photo Report (Page 1 {domainPanelMap.face.shortLabel} • Page 2 {domainPanelMap.crown.shortLabel} &amp; Flanks) →
              </button>
              <button
                type="button"
                onClick={() => setStage('advance_analysis')}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 font-black text-[11px] cursor-pointer flex items-center gap-1.5"
                title="Advance Geological Analysis: Wedge FoS, 4-Surface Apparent Dip, Face Look-Ahead Extrapolation & Inflow"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>3. Advance Geological Analysis →</span>
              </button>
            </div>
          </div>
          <FaceCompletionAndReviewBar
            activeProject={activeProject}
            activeLocation={activeLocation}
            activeRound={activeRound}
            mappingDomain={mappingDomain}
            onUpdateRound={(patch) => {
              updateActiveRound((r) => ({ ...r, ...patch }));
              saveFieldMappingStore(latestStoreRef.current);
            }}
            onReturnToFaceList={() => {
              saveFieldMappingStore(latestStoreRef.current);
              setSetupWindowStep('face');
              setStage('project_setup');
            }}
          />
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <FieldTwoPageReportAndTemplateStage
              activeProject={activeProject}
              activeLocation={activeLocation}
              activeRound={activeRound}
              onUpdateProject={updateActiveProject}
              onUpdateRound={updateActiveRound}
              onBackToParams={() => setStage('survey_overbreak')}
              onSaveAndReturnToProjectSetup={() => {
                saveFieldMappingStore(store);
                setStage('photo_2d_report');
              }}
            />
          </div>
        </div>
      )}

      {/* ==================== STAGE 13: 2-PAGE 2D PHOTO REPORT (PAGE 1 FACE PHOTO + PAGE 2 CROWN TOP & WALLS BOTTOM) ==================== */}
      {stage === 'photo_2d_report' && activeProject && activeLocation && activeRound && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <FaceCompletionAndReviewBar
            activeProject={activeProject}
            activeLocation={activeLocation}
            activeRound={activeRound}
            mappingDomain={mappingDomain}
            onUpdateRound={(patch) => {
              updateActiveRound((r) => ({ ...r, ...patch }));
              saveFieldMappingStore(latestStoreRef.current);
            }}
            onReturnToFaceList={() => {
              saveFieldMappingStore(latestStoreRef.current);
              setSetupWindowStep('face');
              setStage('project_setup');
            }}
          />
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <FieldTwoPagePhotoReportStage
              activeProject={activeProject}
              activeLocation={activeLocation}
              activeRound={activeRound}
              rememberedRocks={rememberedRocksList}
              onUpdateRound={updateActiveRound}
              onBackToCleanReport={() => setStage('word_template_export')}
              onProceedTo3DReport={() => setStage('advance_analysis')}
            />
          </div>
        </div>
      )}

      {/* ==================== STAGE 12 / 14: ADVANCE GEOLOGICAL ANALYSIS VIEW (Directly Embedded, Replaces 3D Report) ==================== */}
      {(stage === 'advance_analysis' || stage === 'geology_3d_report') && activeProject && activeLocation && activeRound && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <FaceCompletionAndReviewBar
            activeProject={activeProject}
            activeLocation={activeLocation}
            activeRound={activeRound}
            mappingDomain={mappingDomain}
            onUpdateRound={(patch) => {
              updateActiveRound((r) => ({ ...r, ...patch }));
              saveFieldMappingStore(latestStoreRef.current);
            }}
            onReturnToFaceList={() => {
              saveFieldMappingStore(latestStoreRef.current);
              setSetupWindowStep('face');
              setStage('project_setup');
            }}
          />
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-950">
            <AdvancedGeologicalAnalysisModal
              fullPage
              isOpen={true}
              onClose={() => setStage('photo_2d_report')}
              geometry={createTunnelGeometry(
                activeLocation?.widthM || 8.5,
                activeLocation?.heightM || 7.5,
                activeLocation?.wallHeightM || 4.2,
                activeLocation?.shape === 'horseshoe' ? 'horseshoe' : 'd_shaped'
              )}
              settings={{
                projectName: activeProject?.projectName || 'Tunnel Field Project',
                tunnelName: activeLocation?.name || 'Heading 1',
                location: activeLocation?.name || '',
                locationName: activeLocation?.name || 'Active Face',
                driveDirectionInput: `N ${Math.round(activeRound?.tunnelDriveDirection ?? activeLocation?.defaultDriveAzimuth ?? 0)}° E`,
                driveDirection: activeRound?.tunnelDriveDirection ?? activeLocation?.defaultDriveAzimuth ?? 0,
                chainage: `RD ${activeRound?.chainageFrom || '0.00'}m - ${activeRound?.chainageTo || '3.00'}m`,
                faceChainage: `RD ${activeRound?.chainageTo || '3.00'}m`,
                roundLength: activeRound?.pullLengthMeters || 3.0,
                date: activeRound?.dateAndTimeOfExcavation || new Date().toISOString().slice(0, 10),
                mappedBy: activeRound?.geologistName || 'Geologist',
                lithology: activeRound?.rockType || 'Granite',
              }}
              joints={(activeRound?.jointTraces || []).map((t) => ({
                id: t.id,
                surface: (t.panel === 'left_wall' ? 'leftWall' : t.panel === 'right_wall' ? 'rightWall' : t.panel) as SurfaceType,
                points: t.points.map((p) => ({ x: p.x, y: p.y })),
                dipDirection: t.dipDirection ?? 135,
                dip: t.dipAmount ?? 65,
                strike: t.strike ?? 45,
                set: t.setId || 'J1',
                persistenceMeters: (t as any).lengthMeters || 3.0,
                spacingMeters: 0.8,
                roughness: 'ROUGH_PLANAR' as const,
                apertureMm: 1.5,
                weathering: 'SLIGHTLY_WEATHERED' as const,
                infilling: 'NONE' as const,
                seepageCondition: 'DRY' as const,
                visible: true,
              })) as unknown as Joint[]}
              jointSets={
                activeRound?.discontinuitySets && Array.isArray(activeRound.discontinuitySets) && activeRound.discontinuitySets.length > 0
                  ? activeRound.discontinuitySets.map((s, idx) => ({
                      id: s.setId || `J${idx + 1}`,
                      name: `Joint Set ${s.setId || `J${idx + 1}`}`,
                      color: idx === 0 ? '#ef4444' : idx === 1 ? '#3b82f6' : idx === 2 ? '#10b981' : '#f59e0b',
                      meanDipDirection: Number(s.dipDirection) || (idx === 0 ? 135 : idx === 1 ? 225 : 315),
                      meanDip: Number(s.dipAmount) || (idx === 0 ? 70 : idx === 1 ? 65 : 45),
                      spacing: '0.45m',
                      persistence: '3.2m',
                      jrc: 8,
                      jcs: 85,
                      roughness: 'Rough planar',
                      traceCount: (activeRound?.jointTraces || []).filter((t) => t.setId === s.setId).length || 3,
                    })) as unknown as JointSet[]
                  : ['J1', 'J2', 'J3'].map((s, idx) => ({
                      id: s,
                      name: `Joint Set ${s}`,
                      color: idx === 0 ? '#ef4444' : idx === 1 ? '#3b82f6' : idx === 2 ? '#10b981' : '#f59e0b',
                      meanDipDirection: idx === 0 ? 135 : idx === 1 ? 225 : 315,
                      meanDip: idx === 0 ? 70 : idx === 1 ? 65 : 45,
                      spacing: '0.45m',
                      persistence: '3.2m',
                      jrc: 8,
                      jcs: 85,
                      roughness: 'Rough planar',
                      traceCount: 4,
                    })) as unknown as JointSet[]
              }
            />
          </div>
        </div>
      )}

      {/* ==================== CUSTOM TUNNEL SHAPE BUILDER MODAL (SAME AS PHOTOGRAMMETRY) ==================== */}
      {customBuilderTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto">
          <FreeformCustomProfileEditor
            geometry={
              (customBuilderTarget === 'new_location'
                ? newLocCustomGeometry
                : activeLocation?.customGeometry) ||
              createTunnelGeometry(
                customBuilderTarget === 'new_location'
                  ? newLocWidth
                  : activeLocation?.widthM || 8.5,
                customBuilderTarget === 'new_location'
                  ? newLocHeight
                  : activeLocation?.heightM || 7.5,
                4.0,
                'd_shaped',
                4.25
              )
            }
            settings={{
              projectName: activeProject?.projectName || 'Tunnel Project',
              tunnelName: activeLocation?.name || newLocName || 'Main Tunnel',
              driveDirectionInput: String(
                activeLocation?.defaultDriveAzimuth || newLocAzimuth || 45
              ),
              driveDirection: Number(
                activeLocation?.defaultDriveAzimuth || newLocAzimuth || 45
              ),
              chainage: `${activeRound?.chainageFrom || '100.0'} - ${
                activeRound?.chainageTo || '103.0'
              }`,
              faceChainage: activeRound?.chainageTo || '103.0',
              roundLength: 3.0,
              date: new Date().toISOString().slice(0, 10),
              mappedBy: activeRound?.geologistName || 'Site Engineering Geologist',
              lithology: 'Quartzite',
            }}
            savedGeometries={[]}
            chainageSchedule={[]}
            initialTab="freeform_canvas"
            onApplyGeometry={(nextGeometry: TunnelGeometry) => {
              const evalProf = nextGeometry.customProfile
                ? evaluateCustomProfileGeometry(nextGeometry.customProfile)
                : null;
              const pts =
                evalProf && evalProf.crossSectionPoints.length >= 2
                  ? evalProf.crossSectionPoints
                  : nextGeometry.crossSectionPoints &&
                    nextGeometry.crossSectionPoints.length >= 2
                  ? nextGeometry.crossSectionPoints
                  : undefined;
              const spanW = Number(
                (evalProf?.width || nextGeometry.width || 8.5).toFixed(2)
              );
              const totalH = Number(
                (evalProf?.height || nextGeometry.height || 7.5).toFixed(2)
              );
              const wallH = Number(
                (
                  evalProf?.wallHeight ||
                  nextGeometry.wallHeight ||
                  totalH * 0.55
                ).toFixed(2)
              );

              if (customBuilderTarget === 'new_location') {
                setNewLocShape('freeform_custom');
                setNewLocWidth(spanW);
                setNewLocHeight(totalH);
                setNewLocCustomPoints(pts);
                setNewLocCustomGeometry(nextGeometry);
              } else if (activeLocation) {
                updateActiveProject((p) => ({
                  ...p,
                  locations: p.locations.map((l) =>
                    l.id === activeLocation.id
                      ? {
                          ...l,
                          shape: 'freeform_custom',
                          widthM: spanW,
                          heightM: totalH,
                          wallHeightM: wallH,
                          crownLengthM: evalProf
                            ? Number(evalProf.crownArcLength.toFixed(2))
                            : undefined,
                          leftWallLengthM: evalProf
                            ? Number(evalProf.leftWallArcLength.toFixed(2))
                            : undefined,
                          rightWallLengthM: evalProf
                            ? Number(evalProf.rightWallArcLength.toFixed(2))
                            : undefined,
                          customCrossSectionPoints: pts,
                          customGeometry: nextGeometry,
                        }
                      : l
                  ),
                }));
              }
              setCustomBuilderTarget(null);
            }}
            onSaveToGeometryLibrary={() => {}}
            onDeleteSavedGeometry={() => {}}
            onUpdateChainageSchedule={() => {}}
            onBack={() => setCustomBuilderTarget(null)}
          />
        </div>
      )}

      <GlobalSettingsModal
        isOpen={isGlobalSettingsOpen}
        onClose={() => setIsGlobalSettingsOpen(false)}
        onActiveProfileChanged={(p) => setActiveGeologist(p)}
      />

      <MiningStopeFaceInspectorModal
        isOpen={isMiningInspectorOpen}
        onClose={() => setIsMiningInspectorOpen(false)}
        settings={{
          projectName: activeProject?.projectName || 'Project',
          tunnelName: activeLocation?.name || 'Excavation',
          location: activeLocation?.name || 'Heading',
          locationName: activeLocation?.name || 'Heading',
          driveDirectionInput: `${activeLocation?.defaultDriveAzimuth ?? 45}°`,
          driveDirection: activeLocation?.defaultDriveAzimuth ?? 45,
          chainage: activeRound ? `CH ${activeRound.chainageFrom}m → ${activeRound.chainageTo}m` : 'Ch. 0+100',
          faceChainage: activeRound ? `CH ${activeRound.chainageTo}m` : 'Ch. 0+100',
          roundLength: activeRound?.pullLengthMeters || 3.0,
          date: activeRound?.dateAndTimeOfExcavation || new Date().toISOString().slice(0, 10),
          mappedBy: activeRound?.geologistName || 'Engineering Geologist',
          lithology: activeRound?.rockType || 'Quartzite',
          industryMode: currentIndustryMode,
        }}
        geometry={
          createTunnelGeometry(
            activeLocation?.widthM || 8.5,
            activeLocation?.heightM || 7.5,
            activeLocation?.wallHeightM || 4.0,
            (activeLocation?.shape === 'horseshoe' ? 'horseshoe' : 'd_shaped') as ProfileType
          )
        }
        joints={[]}
        qIndexParams={createDefaultQIndexParameters()}
        onUpdateMiningSettings={() => {}}
      />

      <TbmShieldInspectorModal
        isOpen={isTbmInspectorOpen}
        onClose={() => setIsTbmInspectorOpen(false)}
        settings={{
          projectName: activeProject?.projectName || 'Project',
          tunnelName: activeLocation?.name || 'Excavation',
          location: activeLocation?.name || 'Heading',
          locationName: activeLocation?.name || 'Heading',
          driveDirectionInput: `${activeLocation?.defaultDriveAzimuth ?? 45}°`,
          driveDirection: activeLocation?.defaultDriveAzimuth ?? 45,
          chainage: activeRound ? `CH ${activeRound.chainageFrom}m → ${activeRound.chainageTo}m` : 'Ch. 0+100',
          faceChainage: activeRound ? `CH ${activeRound.chainageTo}m` : 'Ch. 0+100',
          roundLength: activeRound?.pullLengthMeters || 3.0,
          date: activeRound?.dateAndTimeOfExcavation || new Date().toISOString().slice(0, 10),
          mappedBy: activeRound?.geologistName || 'Engineering Geologist',
          lithology: activeRound?.rockType || 'Quartzite',
          industryMode: currentIndustryMode,
        }}
        geometry={
          createTunnelGeometry(
            activeLocation?.widthM || 8.5,
            activeLocation?.heightM || 7.5,
            activeLocation?.wallHeightM || 4.0,
            (activeLocation?.shape === 'horseshoe' ? 'horseshoe' : 'd_shaped') as ProfileType
          )
        }
        onUpdateTbmParams={() => {}}
      />

      {/* NATM 3D Joint Inspector Modal */}
      {is3DJointInspectorOpen && (
        <NatmJoint3DInspectorModal
          isOpen={is3DJointInspectorOpen}
          onClose={() => setIs3DJointInspectorOpen(false)}
          activeJoint={
            (activeRound.jointTraces.find((t) => t.id === inspectedJointId) ||
              activeRound.jointTraces.find((t) => t.id === selectedTraceId) ||
              activeRound.jointTraces[0]) as FieldJointTrace
          }
          allRoundJoints={activeRound.jointTraces}
          tunnelGeometry={{
            widthM: activeLocation?.widthM || 8.5,
            heightM: activeLocation?.heightM || 7.5,
            wallHeightM: activeLocation?.wallHeightM || 4.2,
            pullLengthM: activeRound?.pullLengthMeters || 3.0,
            driveAzimuthDeg: activeRound?.tunnelDriveDirection ?? activeLocation?.defaultDriveAzimuth,
            currentChainageM: activeRound ? parseFloat(activeRound.chainageTo) || 100 : 100,
            tunnelShape: activeLocation?.shape === 'horseshoe' ? 'horseshoe' : 'd_shaped',
          }}
          onSaveJoint={(updated) => {
            updateActiveRound((r) => ({
              ...r,
              jointTraces: r.jointTraces.map((t) => (t.id === updated.id ? updated : t)),
            }));
            setLiveDipDirection(updated.dipDirection);
            setLiveDipAmount(updated.dipAmount);
          }}
        />
      )}

      </div>
    </div>
  );
};
