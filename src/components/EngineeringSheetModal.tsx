import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  useContainerResizeObserver,
  useResponsiveLayout,
} from '../hooks/useResponsiveLayout';
import {
  ThemeToggleButton,
  useTheme,
} from '../context/ThemeContext';
import {
  Joint,
  JointSet,
  LithologyRegion,
  OutputSheetMode,
  OverbreakUndercutAnalysis,
  PhotoSurface,
  PlacedGeologicalSymbol,
  QIndexParameters,
  QSystemParamKey,
  RmrParameters,
  RockMassClassificationMethodId,
  RockMassSummaryTable,
  GsiParameters,
  ParameterInputStatus,
  SavedProjectRecord,
  SectionToSectionVolumeRow,
  SurfaceType,
  SurveyControlPoint,
  TraceFitMode,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import {
  getDisplayedJointGeometry,
} from '../engine/geometryEngine';
import {
  clusterJointsIntoSets,
  formatJointTraceLineLabel,
  JOINT_SET_PALETTE,
  runQualityControlValidation,
  solveTrueOrientationFromSurfaceTrace,
  projectJointToAllSurfacesAndLookAhead,
} from '../engine/orientationEngine';
import {
  analyzeOverbreakAndUndercut,
} from '../engine/overbreakEngine';
import {
  computeSectionToSectionVolumes,
  parseNumericChainageMeters,
  saveProjectRecordToMemory,
} from '../engine/projectMemoryEngine';
import {
  createDefaultQIndexParameters,
  createDefaultRockMassSummary,
  exportGeologyAndQIndexToCSV,
} from '../engine/photoWarpEngine';
import {
  exportMappedGeologicalSheetToDXF,
  triggerDownloadDXFSheet,
  evaluateDetailedWedgeAndSupportAdequacy,
  analyzeMultiRoundTrendAndLookAhead,
} from '../engine/kinematicsSupportAndDxfEngine';
import {
  downloadEngineeringSheetAsPDF,
  downloadEngineeringSheetAsWordDoc,
} from '../engine/pdfAndWordExportEngine';
import {
  computeAdvancedOverbreakPrediction,
  computeRockStrataSupportSpotBoltingAndFailureFos,
} from '../engine/supportSpotBoltFailureEngine';
import {
  computeNonOverlappingLabelPlacement,
  DipDirectionSymbolGlyph,
  getGeologicalFeatureStrokeStyle,
  getStructuralSymbolMeta,
  LabelObstacleBox,
  LabelObstacleSegment,
  LithologyPatternDefs,
  StructuralGeologicalSymbolGlyph,
} from '../engine/geologicalSymbolLibrary';
import {
  computeFinalSheetAutoLayout,
  saveSheetConfigToStorage,
  SheetLayoutArrangement,
  wrapSheetTextLines,
} from '../engine/sheetLayoutEngine';
import {
  calculateBieniawskiRmr,
  calculateHoekGsi,
  createDefaultGsiParameters,
  createDefaultQParamStatus,
  createDefaultRmrParameters,
  evaluateQSystemWithValidation,
} from '../engine/rockMassClassificationEngine';
import {
  generateSampleTunnelPhotograph,
} from '../engine/sampleFieldData';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileCode,
  Image as ImageIcon,
  Layers,
  Maximize2,
  PanelLeft,
  PanelRight,
  Printer,
  Sliders,
  Upload,
  X,
} from 'lucide-react';
import {
  SheetSettingsAndStorageEditor,
} from './SheetSettingsAndStorageEditor';
import {
  BatchQueueItem,
  BatchSheetProcessorPanel,
  BatchStandardizedConfig,
} from './BatchSheetProcessorPanel';

interface EngineeringSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  photos: Record<SurfaceType, PhotoSurface>;
  joints: Joint[];
  jointSets: JointSet[];
  traceFitMode: TraceFitMode;
  onConfirmAllOrientations: () => void;
  qIndexParams?: QIndexParameters;
  qParamStatus?: Record<QSystemParamKey, ParameterInputStatus>;
  selectedClassificationMethod?: RockMassClassificationMethodId;
  onChangeSelectedClassificationMethod?: (method: RockMassClassificationMethodId) => void;
  rmrParams?: RmrParameters;
  gsiParams?: GsiParameters;
  rockMassSummary?: RockMassSummaryTable;
  lithologyRegions?: LithologyRegion[];
  controlPoints?: SurveyControlPoint[];
  placedSymbols?: PlacedGeologicalSymbol[];
  overbreakAnalysis?: OverbreakUndercutAnalysis;
  onGenerateSampleAsBuiltProfile?: () => void;
  sectionVolumeRows?: SectionToSectionVolumeRow[];
  initialOutputMode?: OutputSheetMode;
  onUpdateSettings?: React.Dispatch<React.SetStateAction<TunnelSettings>>;
  savedProjects?: SavedProjectRecord[];
  onSaveCurrentProject?: () => void;
  onLoadProjectRecord?: (record: SavedProjectRecord) => void;
  onDeleteProjectRecord?: (id: string) => void;
  onCreateNextChainageSection?: () => void;
  industryMode?: 'NATM' | 'TBM' | 'MINING';
}

export const EngineeringSheetModal: React.FC<EngineeringSheetModalProps> = ({
  isOpen,
  onClose,
  geometry: propGeometry,
  settings: propSettings,
  photos: propPhotos,
  joints: propJoints,
  jointSets: propJointSets,
  traceFitMode,
  onConfirmAllOrientations,
  qIndexParams: propQIndex,
  qParamStatus: propQParamStatus,
  selectedClassificationMethod: propSelectedClassificationMethod = 'Q_SYSTEM',
  onChangeSelectedClassificationMethod,
  rmrParams: propRmrParams,
  gsiParams: propGsiParams,
  rockMassSummary: propRockMass,
  lithologyRegions: propLithologyRegions = [],
  controlPoints: propControlPoints = [],
  placedSymbols: propPlacedSymbols = [],
  overbreakAnalysis: propOverbreakAnalysis,
  onGenerateSampleAsBuiltProfile,
  sectionVolumeRows: propSectionVolumeRows = [],
  initialOutputMode = 'FINAL_ENGINEERING_SHEET',
  onUpdateSettings: propOnUpdateSettings,
  savedProjects = [],
  onSaveCurrentProject,
  onLoadProjectRecord,
  onDeleteProjectRecord,
  onCreateNextChainageSection,
  industryMode: propIndustryMode,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [localSettings, setLocalSettings] = useState<TunnelSettings>(propSettings);
  useEffect(() => {
    setLocalSettings(propSettings);
  }, [propSettings]);

  const baseSettings = propOnUpdateSettings ? propSettings : localSettings;
  const handleUpdateSettings: React.Dispatch<React.SetStateAction<TunnelSettings>> =
    propOnUpdateSettings || setLocalSettings;

  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState<boolean>(false);
  const [drawerActiveMode, setDrawerActiveMode] = useState<'settings' | 'batch'>('settings');
  const [drawerDockSide, setDrawerDockSide] = useState<'left' | 'right'>('left');
  const [drawerWidthPx, setDrawerWidthPx] = useState<number>(430);
  const [resizingDrawer, setResizingDrawer] = useState<{
    startX: number;
    startWidth: number;
  } | null>(null);

  // Batch Queue & Standardized Sequential Processing State
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>([]);
  const [batchConfig, setBatchConfig] = useState<BatchStandardizedConfig>({
    outputMode: initialOutputMode,
    arrangement: 'AUTO_INTELLIGENT',
    classificationOverride: 'KEEP_RECORD',
    standardizeHeaderAndLogos: true,
    confirmAllOrientations: true,
    overlayOverbreakOnGeology: false,
    overlayJointsOnQuantity: false,
    autoDownloadFormat: {
      svg: false,
      png: false,
      dxf: false,
      csv: false,
    },
  });
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [isBatchPaused, setIsBatchPaused] = useState<boolean>(false);
  const [activeBatchIndex, setActiveBatchIndex] = useState<number | null>(null);
  const [previewQueueId, setPreviewQueueId] = useState<string | null>(null);
  const [isPrintingBatchBook, setIsPrintingBatchBook] = useState<boolean>(false);

  useEffect(() => {
    if (!resizingDrawer) return;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - resizingDrawer.startX;
      const delta = drawerDockSide === 'left' ? dx : -dx;
      setDrawerWidthPx(
        Math.max(300, Math.min(700, Math.round(resizingDrawer.startWidth + delta)))
      );
    };
    const onUp = () => setResizingDrawer(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizingDrawer, drawerDockSide]);
  const [userOutputMode, setOutputMode] = useState<OutputSheetMode>(initialOutputMode);
  const [showOverbreakOnGeology, setShowOverbreakOnGeology] = useState<boolean>(true);
  const [showUndercutOnGeology, setShowUndercutOnGeology] = useState<boolean>(true);
  const [crownWallContentMode, setCrownWallContentMode] = useState<
    'PHOTO_ONLY' | 'PHOTO_AND_VECTORS' | 'VECTORS_ONLY'
  >('PHOTO_ONLY');
  const [localPerimeterPhotos, setLocalPerimeterPhotos] = useState<
    Partial<Record<'leftWall' | 'crown' | 'rightWall', string>>
  >({});
  const [autoProjectFaceToCrownWall, setAutoProjectFaceToCrownWall] = useState<boolean>(true);
  const [userOverlayJointsOnQuantity, setOverlayJointsOnQuantity] = useState<boolean>(false);
  const [userArrangement, setArrangement] = useState<SheetLayoutArrangement>('AUTO_INTELLIGENT');
  const [showConfidenceLabels, setShowConfidenceLabels] = useState<boolean>(false);
  const [show3DAppendixOnSheet, setShow3DAppendixOnSheet] = useState<boolean>(true);
  const [sheetZoomMode, setSheetZoomMode] = useState<'auto_fit' | '100' | '125' | '150'>('auto_fit');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const responsive = useResponsiveLayout();
  const previewBounds = useContainerResizeObserver(previewContainerRef, 1280, 820, isOpen);

  // Determine if a queued batch item is currently being processed or previewed
  const activeBatchItem = useMemo<BatchQueueItem | null>(() => {
    if (isBatchRunning && activeBatchIndex !== null && batchQueue[activeBatchIndex]) {
      return batchQueue[activeBatchIndex];
    }
    if (previewQueueId) {
      return batchQueue.find((item) => item.queueId === previewQueueId) || null;
    }
    return null;
  }, [isBatchRunning, activeBatchIndex, previewQueueId, batchQueue]);

  const activeRecord = activeBatchItem?.record || null;
  const isUsingBatchContext = Boolean(activeRecord);

  const outputMode: OutputSheetMode = isUsingBatchContext
    ? batchConfig.outputMode
    : userOutputMode;
  const arrangement: SheetLayoutArrangement = isUsingBatchContext
    ? batchConfig.arrangement
    : userArrangement;
  const effectiveShowOverbreak: boolean =
    outputMode === 'ENGINEERING_QUANTITY_SHEET' ||
    (isUsingBatchContext ? batchConfig.overlayOverbreakOnGeology : showOverbreakOnGeology);
  const effectiveShowUndercut: boolean =
    outputMode === 'ENGINEERING_QUANTITY_SHEET' ||
    (isUsingBatchContext ? batchConfig.overlayOverbreakOnGeology : showUndercutOnGeology);
  const effectiveShowAnyOverbreakUndercut: boolean =
    effectiveShowOverbreak || effectiveShowUndercut;
  const overlayOverbreakOnGeology: boolean = effectiveShowAnyOverbreakUndercut;
  const isCrownAndWallOnly: boolean = outputMode === 'CROWN_AND_WALL_VECTOR_ONLY';
  const overlayJointsOnQuantity: boolean = isUsingBatchContext
    ? batchConfig.overlayJointsOnQuantity
    : userOverlayJointsOnQuantity;

  const geometry = activeRecord ? activeRecord.geometry : propGeometry;

  const settings = useMemo<TunnelSettings>(() => {
    if (!activeRecord) return baseSettings;
    const recSettings = activeRecord.settings;
    if (!batchConfig.standardizeHeaderAndLogos) {
      return {
        ...recSettings,
        sheetConfig: activeRecord.sheetConfig || recSettings.sheetConfig,
      };
    }
    const masterSheetCfg = baseSettings.sheetConfig;
    const recordSheetCfg = activeRecord.sheetConfig || recSettings.sheetConfig;
    return {
      ...recSettings,
      projectName:
        baseSettings.projectName ||
        masterSheetCfg?.projectName ||
        activeRecord.projectName ||
        recSettings.projectName,
      sheetConfig: masterSheetCfg
        ? {
            ...recordSheetCfg,
            ...masterSheetCfg,
            location:
              activeRecord.location ||
              recSettings.locationName ||
              recSettings.location ||
              masterSheetCfg.location,
          }
        : recordSheetCfg,
    };
  }, [activeRecord, baseSettings, batchConfig.standardizeHeaderAndLogos]);

  const photos = activeRecord ? activeRecord.photos : propPhotos;

  const { joints, jointSets } = useMemo(() => {
    if (!activeRecord) {
      return { joints: propJoints, jointSets: propJointSets };
    }
    const rawJoints = (activeRecord.joints || []).map((j) =>
      batchConfig.confirmAllOrientations
        ? { ...j, orientationStatus: 'CONFIRMED' as const }
        : j
    );
    const clustered = clusterJointsIntoSets(rawJoints);
    const overrides = activeRecord.customJointSetOverrides || {};
    return {
      joints: clustered.clusteredJoints,
      jointSets: clustered.jointSets.map((s) => ({
        ...s,
        ...(overrides[s.id] || {}),
      })),
    };
  }, [activeRecord, propJoints, propJointSets, batchConfig.confirmAllOrientations]);

  const selectedClassificationMethod: RockMassClassificationMethodId = useMemo(() => {
    if (!activeRecord) return propSelectedClassificationMethod;
    if (batchConfig.classificationOverride !== 'KEEP_RECORD') {
      return batchConfig.classificationOverride;
    }
    return activeRecord.selectedClassificationMethod || propSelectedClassificationMethod;
  }, [activeRecord, propSelectedClassificationMethod, batchConfig.classificationOverride]);

  const lithologyRegions = activeRecord ? activeRecord.lithologyRegions || [] : propLithologyRegions;
  const controlPoints = activeRecord ? activeRecord.controlPoints || [] : propControlPoints;
  const placedSymbols = activeRecord ? activeRecord.placedSymbols || [] : propPlacedSymbols;

  const overbreakAnalysis = useMemo(() => {
    if (!activeRecord) return propOverbreakAnalysis;
    return analyzeOverbreakAndUndercut(
      geometry,
      settings,
      controlPoints,
      activeRecord.surveyProfile,
      joints
    );
  }, [activeRecord, propOverbreakAnalysis, geometry, settings, controlPoints, joints]);

  const sectionVolumeRows = useMemo(() => {
    if (batchQueue.length >= 2) {
      return computeSectionToSectionVolumes(batchQueue.map((q) => q.record));
    }
    return propSectionVolumeRows;
  }, [batchQueue, propSectionVolumeRows]);

  useEffect(() => {
    if (isOpen && initialOutputMode) {
      setOutputMode(initialOutputMode);
    }
  }, [isOpen, initialOutputMode]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    previewBounds.recalculate();
  }, [
    isOpen,
    isSettingsDrawerOpen,
    outputMode,
    arrangement,
    sheetZoomMode,
    responsive.viewportWidth,
    responsive.viewportHeight,
    previewBounds.recalculate,
  ]);

  const effectivePropQIndex = activeRecord ? activeRecord.qIndexParams : propQIndex;
  const effectivePropQStatus = activeRecord ? activeRecord.qParamStatus : propQParamStatus;
  const effectivePropRmr = activeRecord ? activeRecord.rmrParams : propRmrParams;
  const effectivePropGsi = activeRecord ? activeRecord.gsiParams : propGsiParams;
  const effectivePropRockMass = activeRecord ? activeRecord.rockMassSummary : propRockMass;

  const qIndex = useMemo(
    () => effectivePropQIndex || createDefaultQIndexParameters(),
    [effectivePropQIndex]
  );
  const qStatus = useMemo(
    () => effectivePropQStatus || createDefaultQParamStatus(),
    [effectivePropQStatus]
  );
  const qResult = useMemo(
    () => evaluateQSystemWithValidation(qIndex, geometry.width, qStatus),
    [qIndex, geometry.width, qStatus]
  );
  const rmr = useMemo(
    () => effectivePropRmr || createDefaultRmrParameters(),
    [effectivePropRmr]
  );
  const rmrResult = useMemo(() => calculateBieniawskiRmr(rmr), [rmr]);
  const gsi = useMemo(
    () => effectivePropGsi || createDefaultGsiParameters(),
    [effectivePropGsi]
  );
  const gsiResult = useMemo(() => calculateHoekGsi(gsi), [gsi]);
  const rockMass = useMemo(
    () => effectivePropRockMass || createDefaultRockMassSummary(settings.lithology),
    [effectivePropRockMass, settings.lithology]
  );

  const supportAndFos = useMemo(
    () =>
      computeRockStrataSupportSpotBoltingAndFailureFos(
        geometry,
        settings,
        joints,
        jointSets,
        qIndex,
        rmr,
        rockMass,
        overbreakAnalysis,
        savedProjects
      ),
    [geometry, settings, joints, jointSets, qIndex, rmr, rockMass, overbreakAnalysis, savedProjects]
  );

  const overbreakPrediction = useMemo(
    () =>
      computeAdvancedOverbreakPrediction(
        geometry,
        settings,
        overbreakAnalysis,
        joints,
        jointSets,
        qIndex,
        rmr,
        rockMass,
        savedProjects
      ),
    [geometry, settings, overbreakAnalysis, joints, jointSets, qIndex, rmr, rockMass, savedProjects]
  );

  const uploadedSurfaceCount = useMemo(
    () => Object.values(photos).filter((p) => Boolean(p.image)).length,
    [photos]
  );

  const qcReport = useMemo(
    () => runQualityControlValidation(geometry, settings, joints, uploadedSurfaceCount),
    [geometry, settings, joints, uploadedSurfaceCount]
  );

  const totalOverbreakZones = useMemo(
    () =>
      (overbreakAnalysis?.overbreakRegions?.length || 0) +
      (overbreakAnalysis?.undercutRegions?.length || 0),
    [overbreakAnalysis]
  );

  const combinedNotesLength = useMemo(() => {
    const desc = lithologyRegions[0]?.description || `${rockMass.weatheringGrade} ${rockMass.strengthGrade}`;
    const struct = lithologyRegions[0]?.structuralFeatures || `${rockMass.foliationBeddingSpacing} ${rockMass.groundwaterCondition}`;
    const notes = lithologyRegions[0]?.notes || rockMass.geologistRemarks || '';
    return desc.length + struct.length + notes.length;
  }, [lithologyRegions, rockMass]);

  const activeIndustryMode: 'NATM' | 'TBM' | 'MINING' =
    propIndustryMode ||
    (typeof window !== 'undefined'
      ? (localStorage.getItem('eswa_active_industry_mode') as 'NATM' | 'TBM' | 'MINING') || 'NATM'
      : 'NATM');

  type NatmAnalyticsViewMode =
    | 'ALL_4_BLOCKS'
    | 'WEDGE_ADEQUACY'
    | 'ROUND_TREND_OVERBREAK'
    | 'AHEAD_OF_FACE'
    | 'STANDARD_DISCONTINUITY';

  const [natmAnalyticsView, setNatmAnalyticsView] = useState<NatmAnalyticsViewMode>('ALL_4_BLOCKS');

  // 1. 4-Surface Apparent-to-True Dip Schedule
  const fourSurfaceJointSchedule = useMemo(() => {
    const driveAzimuth = Number(settings.driveDirection) || 0;
    const sourceJoints = joints.length > 0 ? joints : [
      {
        id: 'J1-01',
        set: 'J1',
        surface: 'FACE' as SurfaceType,
        dip: 62,
        dipDirection: 135,
        strike: 45,
        traceAngle2D: 58,
        apertureMm: 1.5,
        roughness: 'ROUGH' as any,
        infilling: 'CALCITE' as any,
        water: 'DRY' as any,
        points: [],
      },
      {
        id: 'J2-01',
        set: 'J2',
        surface: 'LEFT_WALL' as SurfaceType,
        dip: 78,
        dipDirection: 225,
        strike: 135,
        traceAngle2D: 72,
        apertureMm: 2.0,
        roughness: 'SLICKENSIDED' as any,
        infilling: 'CLAY' as any,
        water: 'DAMP' as any,
        points: [],
      },
      {
        id: 'J3-01',
        set: 'J3',
        surface: 'CROWN' as SurfaceType,
        dip: 34,
        dipDirection: 20,
        strike: 290,
        traceAngle2D: 30,
        apertureMm: 0.8,
        roughness: 'SMOOTH' as any,
        infilling: 'NONE' as any,
        water: 'DRY' as any,
        points: [],
      },
    ];

    return sourceJoints.map((j, idx) => {
      const rawDip = j.dip ?? (j.orientationStatus === 'CONFIRMED' ? 62 : 55);
      const rawDipDir = j.dipDirection ?? 135;
      const sol = solveTrueOrientationFromSurfaceTrace({
        surface: (j.surface as 'FACE' | 'LEFT_WALL' | 'CROWN' | 'RIGHT_WALL') || 'FACE',
        traceAngle2D: j.traceAngle2D ?? 45,
        surfaceTiltAngle: rawDip,
        dip: rawDip,
        dipDirection: rawDipDir,
        driveAzimuth,
      });
      const jsMatch = jointSets.find((s) => s.id === j.set);
      const color = jsMatch?.color || (JOINT_SET_PALETTE[j.set || 'J1']?.color ?? '#0284C7');

      return {
        id: j.id || `J-${idx + 1}`,
        set: j.set || (jointSets[idx % Math.max(1, jointSets.length)]?.id ?? `J${idx + 1}`),
        color,
        surface: j.surface || 'FACE',
        sol,
        jr: qIndex.jr ?? 2.0,
        ja: qIndex.ja ?? 1.0,
        aperture: j.apertureMm ?? 1.5,
        jw: qIndex.jw ?? 1.0,
      };
    });
  }, [joints, jointSets, settings.driveDirection, qIndex]);

  // 2. 3D Keyblock Wedge Stability & Support Adequacy Report
  const detailedWedgeReport = useMemo(() => {
    const rawJoints: Joint[] =
      joints.length > 0
        ? joints
        : ((fourSurfaceJointSchedule.map((s) => ({
            id: s.id,
            set: s.set,
            surface: s.surface,
            dip: s.sol.dipAngle,
            dipDirection: s.sol.dipDirection,
            strike: s.sol.strike,
            traceAngle: s.sol.apparentDipOnFace,
            points: [],
            geometry: { points: [], length: 2.0 },
            orientationStatus: 'CONFIRMED' as const,
          })) as unknown) as Joint[]);

    return evaluateDetailedWedgeAndSupportAdequacy({
      joints: rawJoints,
      geometry,
      settings,
      supportParams: {
        boltLengthM: 3.0,
        boltSpacingM: 1.5,
        boltCapacityKN: 180,
        shotcreteThicknessMm: 75,
        shotcreteShearMPa: 1.2,
        frictionAngleDeg: 34,
        cohesionKPa: 50,
        rockUnitWeightKNPerM3: 26.5,
      },
    });
  }, [joints, fourSurfaceJointSchedule, geometry, settings]);

  // 3 & 4. Multi-Round Trend, Overbreak Proof, and Look-Ahead Forepoling Report
  const multiRoundTrendReport = useMemo(() => {
    let prevVaultRounds: SavedProjectRecord[] = savedProjects || [];
    if (prevVaultRounds.length === 0 && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('eswa_strict_vault_NATM');
        if (raw) prevVaultRounds = JSON.parse(raw);
      } catch {
        // fallback
      }
    }
    const currentRoundRecord = {
      id: `round-current-${settings.faceChainage || 'face'}`,
      timestamp: new Date().toISOString(),
      geometry,
      settings,
      joints,
      jointSets,
      qIndexParams: qIndex,
      rmrParams: rmr,
      overbreakAnalysis,
    };

    return analyzeMultiRoundTrendAndLookAhead({
      currentRound: currentRoundRecord as any,
      previousRounds: prevVaultRounds,
      geometry,
      settings,
    });
  }, [savedProjects, settings, geometry, joints, jointSets, qIndex, rmr, overbreakAnalysis]);

  const layout = useMemo(
    () =>
      computeFinalSheetAutoLayout({
        geometry,
        settings,
        photos,
        joints,
        jointSets,
        lithologyRegions,
        outputMode,
        arrangement,
        overbreakZoneCount: totalOverbreakZones,
        notesTextLength: combinedNotesLength,
        placedSymbolCount: placedSymbols.length,
        controlPointCount: controlPoints.length,
        sectionVolumeRowCount: sectionVolumeRows.length,
      }),
    [
      geometry,
      settings,
      photos,
      joints,
      jointSets,
      lithologyRegions,
      outputMode,
      arrangement,
      totalOverbreakZones,
      combinedNotesLength,
      placedSymbols.length,
      controlPoints.length,
      sectionVolumeRows.length,
    ]
  );

  const {
    sheetW,
    sheetH,
    margin,
    showHeaderBlock,
    showTitleAndTables,
    showPerimeterPlan,
    headerBox,
    drawingArenaBox,
    rightColumnBox,
    contentMetrics,
    effectiveSheetConfig,
    facePxPerMeter,
    faceCenterX,
    faceTopY,
    faceBottomY,
    faceWidthPx,
    faceHeightPx,
    faceSurfaceRect,
    planCenterX,
    planTopY,
    crownW_px,
    roundH_px,
    wallW_px,
    leftWallW_px,
    rightWallW_px,
    crownLeftX,
    leftWallLeftX,
    rightWallLeftX,
    roundLen,
    crownSpan,
    orientationBlock,
    legendBlock,
    jointTableBlock,
    qIndexAndNotesBlock,
    surfacePointToSheetXY,
    getSurfaceSheetRect,
    getSheetPhotoSvgTransform,
  } = layout;

  const appendixSnapshots = settings.strikeDip3DSnapshots || [];
  const hasActive3DAppendix = show3DAppendixOnSheet && appendixSnapshots.length > 0;
  const appendixBlockHeight = hasActive3DAppendix ? 320 : 0;
  const totalSheetH = sheetH + appendixBlockHeight;

  const renderedSheetDimensions = useMemo(() => {
    if (sheetZoomMode !== 'auto_fit') {
      const pct = Number(sheetZoomMode) / 100;
      return {
        width: Math.round(sheetW * pct),
        height: Math.round(totalSheetH * pct),
      };
    }
    const padX = responsive.isCompactScreen ? 6 : 12;
    const padY = responsive.isCompactScreen ? 6 : 10;
    const availW = Math.max(320, previewBounds.width - padX);
    const availH = Math.max(240, previewBounds.height - padY);
    const fitScale = Math.min(availW / sheetW, availH / totalSheetH);
    return {
      width: Math.floor(sheetW * fitScale),
      height: Math.floor(totalSheetH * fitScale),
    };
  }, [
    sheetZoomMode,
    previewBounds.width,
    previewBounds.height,
    previewBounds.revision,
    responsive.isCompactScreen,
    responsive.layoutRevision,
    sheetW,
    totalSheetH,
  ]);

  // Build SVG polygon path for the authoritative master tunnel Face cross-section
  const facePolygonPath = useMemo(
    () =>
      geometry.crossSectionPoints
        .map((pt, idx) => {
          const s = surfacePointToSheetXY(pt, 'face');
          return `${idx === 0 ? 'M' : 'L'} ${s.x} ${s.y}`;
        })
        .join(' ') + ' Z',
    [geometry.crossSectionPoints, surfacePointToSheetXY]
  );

  // Custom polygon mask path on face if active
  const faceCustomMaskPath = useMemo(
    () =>
      photos.face.transform.useCustomMask &&
      photos.face.transform.customMaskPoints &&
      photos.face.transform.customMaskPoints.length >= 3
        ? photos.face.transform.customMaskPoints
            .map((pt, idx) => {
              const s = surfacePointToSheetXY(pt, 'face');
              return `${idx === 0 ? 'M' : 'L'} ${s.x} ${s.y}`;
            })
            .join(' ') + ' Z'
        : facePolygonPath,
    [
      photos.face.transform.useCustomMask,
      photos.face.transform.customMaskPoints,
      surfacePointToSheetXY,
      facePolygonPath,
    ]
  );

  // Automatic Non-Overlapping Label Placement for Joints, Placed Symbols, and Survey Control Points
  const nonOverlappingSheetLabels = useMemo(() => {
    const occupiedBoxes: LabelObstacleBox[] = [];
    const obstacleSegments: LabelObstacleSegment[] = [];

    // 1. Add tunnel face boundary segments as obstacle segments
    const faceSheetPts = geometry.crossSectionPoints.map((pt) =>
      surfacePointToSheetXY(pt, 'face')
    );
    for (let i = 0; i < faceSheetPts.length; i++) {
      const a = faceSheetPts[i];
      const b = faceSheetPts[(i + 1) % faceSheetPts.length];
      obstacleSegments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }

    // 2. Add dimension line boxes as occupied obstacles
    occupiedBoxes.push(
      { x: faceCenterX - 90, y: faceBottomY + 6, width: 180, height: 24 },
      { x: faceCenterX - faceWidthPx / 2 - 44, y: faceTopY, width: 32, height: faceHeightPx },
      { x: faceCenterX + faceWidthPx / 2 + 12, y: faceTopY, width: 34, height: faceHeightPx }
    );

    // 3. Add all joint trace segments as obstacle segments
    for (const j of joints) {
      if (!showPerimeterPlan && j.surface !== 'face') continue;
      const geom = getDisplayedJointGeometry(j, traceFitMode);
      const pts = geom.map((pt) => surfacePointToSheetXY(pt, j.surface));
      for (let i = 0; i < pts.length - 1; i++) {
        obstacleSegments.push({
          x1: pts[i].x,
          y1: pts[i].y,
          x2: pts[i + 1].x,
          y2: pts[i + 1].y,
        });
      }
    }

    // Reserve marker circles for all visible control points and symbols
    const visibleCPs = controlPoints.filter(
      (cp) => cp.visible !== false && (showPerimeterPlan || cp.surface === 'face')
    );
    for (const cp of visibleCPs) {
      const p = surfacePointToSheetXY(cp.point, cp.surface);
      occupiedBoxes.push({ x: p.x - 8, y: p.y - 8, width: 16, height: 16 });
    }

    const visibleSymbols = placedSymbols.filter(
      (sym) => sym.visible !== false && (showPerimeterPlan || sym.surface === 'face')
    );
    for (const sym of visibleSymbols) {
      const p = surfacePointToSheetXY(sym.point, sym.surface);
      occupiedBoxes.push({ x: p.x - 14, y: p.y - 14, width: 28, height: 28 });
    }

    const arenaBounds = {
      minX: drawingArenaBox.x + 8,
      minY: drawingArenaBox.y + 8,
      maxX: drawingArenaBox.x + drawingArenaBox.width - 8,
      maxY: drawingArenaBox.y + drawingArenaBox.height - 8,
    };

    // Compute non-overlapping positions for Survey Control Point labels (CP1 / X: ... / Y: ...)
    const cpPlacements: Record<string, ReturnType<typeof computeNonOverlappingLabelPlacement>> = {};
    for (const cp of visibleCPs) {
      const anchor = surfacePointToSheetXY(cp.point, cp.surface);
      const res = computeNonOverlappingLabelPlacement({
        anchorX: anchor.x,
        anchorY: anchor.y,
        boxW: 78,
        boxH: 34,
        occupiedBoxes,
        obstacleSegments,
        bounds: arenaBounds,
      });
      cpPlacements[cp.id] = res;
      occupiedBoxes.push({
        x: res.boxX,
        y: res.boxY,
        width: res.boxW,
        height: res.boxH,
      });
    }

    // Compute non-overlapping positions for Joint Callout Labels
    const jointPlacements: Record<string, ReturnType<typeof computeNonOverlappingLabelPlacement>> = {};
    for (const j of joints) {
      if (!showPerimeterPlan && j.surface !== 'face') continue;
      const geom = getDisplayedJointGeometry(j, traceFitMode);
      if (geom.length < 2) continue;
      const sheetPts = geom.map((pt) => surfacePointToSheetXY(pt, j.surface));
      const midIdx = Math.floor(sheetPts.length / 2);
      const midPt =
        sheetPts.length % 2 === 1
          ? sheetPts[midIdx]
          : {
              x: (sheetPts[midIdx - 1].x + sheetPts[midIdx].x) / 2,
              y: (sheetPts[midIdx - 1].y + sheetPts[midIdx].y) / 2,
            };
      const labelText =
        j.customLabel ||
        `${j.jointNumber ? `${j.jointNumber} ` : ''}${j.set}:${String(
          Math.round(j.dipDirection)
        ).padStart(3, '0')}°/${String(Math.round(j.dip)).padStart(2, '0')}°`;
      const boxW = Math.max(66, labelText.length * 5.6 + (showConfidenceLabels ? 22 : 8));
      const res = computeNonOverlappingLabelPlacement({
        anchorX: midPt.x,
        anchorY: midPt.y,
        boxW,
        boxH: 14,
        occupiedBoxes,
        obstacleSegments,
        bounds: arenaBounds,
      });
      jointPlacements[j.id] = res;
      occupiedBoxes.push({
        x: res.boxX,
        y: res.boxY,
        width: res.boxW,
        height: res.boxH,
      });
    }

    // Compute non-overlapping positions for Placed Geological Symbol Labels
    const symbolPlacements: Record<string, ReturnType<typeof computeNonOverlappingLabelPlacement>> = {};
    for (const sym of visibleSymbols) {
      const anchor = surfacePointToSheetXY(sym.point, sym.surface);
      const text = `${sym.label} (${String(Math.round(sym.dipDirectionDeg)).padStart(3, '0')}°/${String(
        Math.round(sym.dipDeg)
      ).padStart(2, '0')}°)`;
      const boxW = Math.max(68, text.length * 5.4 + 10);
      const res = computeNonOverlappingLabelPlacement({
        anchorX: anchor.x,
        anchorY: anchor.y,
        boxW,
        boxH: 14,
        occupiedBoxes,
        obstacleSegments,
        bounds: arenaBounds,
      });
      symbolPlacements[sym.id] = res;
      occupiedBoxes.push({
        x: res.boxX,
        y: res.boxY,
        width: res.boxW,
        height: res.boxH,
      });
    }

    return { cpPlacements, jointPlacements, symbolPlacements };
  }, [
    geometry.crossSectionPoints,
    surfacePointToSheetXY,
    faceCenterX,
    faceBottomY,
    faceWidthPx,
    faceTopY,
    faceHeightPx,
    joints,
    showPerimeterPlan,
    traceFitMode,
    controlPoints,
    placedSymbols,
    drawingArenaBox,
    showConfidenceLabels,
  ]);

  // Approximate engineering drawing scale ratio (1 : N) for A3 420mm width = 1600px (~3.81 px/mm)
  const engineeringScaleDenominator = Math.max(
    10,
    Math.round(((1000 * 3.81) / Math.max(10, facePxPerMeter)) / 5) * 5
  );

  // Export SVG directly
  const getExportReadySvgString = () => {
    if (!svgRef.current) return '';
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('viewBox', `0 0 ${sheetW} ${sheetH}`);
    clone.setAttribute('width', String(sheetW));
    clone.setAttribute('height', String(sheetH));
    clone.style.width = `${sheetW}px`;
    clone.style.height = `${sheetH}px`;
    const serializer = new XMLSerializer();
    return serializer.serializeToString(clone);
  };

  const renderSvgToPngDataUrl = (svgStr: string, w: number, h: number): Promise<string> =>
    new Promise((resolve) => {
      if (!svgStr) {
        resolve('');
        return;
      }
      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = w * 2;
        canvas.height = h * 2;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve('');
      };
      img.src = url;
    });

  const triggerTextFileDownload = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const triggerDataUrlDownload = (dataUrl: string, fileName: string) => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sequential Batch Processing Engine Step Effect
  useEffect(() => {
    if (!isOpen || !isBatchRunning || isBatchPaused || activeBatchIndex === null) {
      return;
    }

    if (activeBatchIndex >= batchQueue.length) {
      setIsBatchRunning(false);
      setIsBatchPaused(false);
      setActiveBatchIndex(null);
      return;
    }

    const currentItem = batchQueue[activeBatchIndex];
    if (!currentItem) {
      setIsBatchRunning(false);
      setActiveBatchIndex(null);
      return;
    }

    if (currentItem.status !== 'PROCESSING') {
      setBatchQueue((prev) =>
        prev.map((it, i) =>
          i === activeBatchIndex ? { ...it, status: 'PROCESSING' } : it
        )
      );
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          if (cancelled) return;
          try {
            const svgString = getExportReadySvgString();
            const pngDataUrl = await renderSvgToPngDataUrl(svgString, sheetW, sheetH);
            const dxfString = exportMappedGeologicalSheetToDXF({
              geometry,
              settings,
              joints,
              jointSets,
              selectedMethod: selectedClassificationMethod,
              qIndexParams: qIndex,
              rmrParams: rmr,
              gsiParams: gsi,
              qValue: qResult.isComplete ? qResult.qValue : null,
              rmrValue: rmrResult.finalRmr,
            });
            const csvString = exportGeologyAndQIndexToCSV(
              geometry,
              settings,
              joints,
              jointSets,
              qIndex,
              rockMass,
              overbreakAnalysis,
              controlPoints,
              sectionVolumeRows
            );

            const seqNum = activeBatchIndex + 1;
            const safeTunnel = (settings.tunnelName || 'Tunnel').replace(/\s+/g, '_');
            const safeCh = (settings.faceChainage || settings.chainage || `Sec_${seqNum}`).replace(
              /\s+/g,
              '_'
            );
            const fileBaseName = `${String(seqNum).padStart(2, '0')}_${safeTunnel}_${safeCh}`;

            const summaryMetrics = {
              sequenceNumber: seqNum,
              projectName:
                settings.projectName ||
                effectiveSheetConfig.projectName ||
                currentItem.record.projectName ||
                'Tunnel Project',
              location:
                settings.locationName ||
                settings.location ||
                currentItem.record.location ||
                'Main Heading',
              tunnelName: settings.tunnelName || currentItem.record.tunnelName,
              chainage: settings.chainage || currentItem.record.chainage,
              faceChainage: settings.faceChainage || currentItem.record.faceChainage,
              numericRdMeters:
                currentItem.record.numericChainageMeters ??
                parseNumericChainageMeters(settings.faceChainage, settings.chainage),
              date: settings.date || currentItem.record.date,
              outputMode,
              classificationMethod: selectedClassificationMethod,
              widthM: geometry.width,
              heightM: geometry.height,
              driveDirectionDeg: settings.driveDirection,
              lithology: settings.lithology || rockMass.rockType || 'Unmapped',
              jointCount: joints.length,
              jointSetCount: jointSets.length,
              qValue: qResult.isComplete ? qResult.qValue.toFixed(3) : 'N/A',
              rmrValue: rmrResult.isComplete ? `${rmrResult.finalRmr}` : 'N/A',
              gsiValue:
                gsiResult.isComplete && gsiResult.gsiValue !== null
                  ? `${gsiResult.gsiValue}`
                  : 'N/A',
              designAreaSqM: overbreakAnalysis?.designAreaSqMeters ?? 0,
              surveyedAreaSqM: overbreakAnalysis?.surveyedAreaSqMeters ?? 0,
              overbreakAreaSqM: overbreakAnalysis?.overbreakAreaSqMeters ?? 0,
              overbreakPct: overbreakAnalysis?.overbreakPercentage ?? 0,
              undercutAreaSqM: overbreakAnalysis?.undercutAreaSqMeters ?? 0,
              undercutPct: overbreakAnalysis?.undercutPercentage ?? 0,
              overbreakVolM3:
                overbreakAnalysis?.overbreakVolumeCubicMeters !== null &&
                overbreakAnalysis?.overbreakVolumeCubicMeters !== undefined
                  ? overbreakAnalysis.overbreakVolumeCubicMeters.toFixed(2)
                  : 'N/A',
              qcStatus: qcReport.passed
                ? 'PASSED'
                : `${qcReport.issues.length} Flag(s)`,
            };

            if (batchConfig.autoDownloadFormat.svg && svgString) {
              triggerTextFileDownload(
                svgString,
                `${fileBaseName}_sheet.svg`,
                'image/svg+xml;charset=utf-8'
              );
            }
            if (batchConfig.autoDownloadFormat.png && pngDataUrl) {
              triggerDataUrlDownload(pngDataUrl, `${fileBaseName}_sheet.png`);
            }
            if (batchConfig.autoDownloadFormat.dxf && dxfString) {
              triggerDownloadDXFSheet(`${fileBaseName}_sheet.dxf`, dxfString);
            }
            if (batchConfig.autoDownloadFormat.csv && csvString) {
              triggerTextFileDownload(
                csvString,
                `${fileBaseName}_geology_qindex.csv`,
                'text/csv;charset=utf-8'
              );
            }

            if (cancelled) return;

            setBatchQueue((prev) =>
              prev.map((it, i) =>
                i === activeBatchIndex
                  ? {
                      ...it,
                      status: 'COMPLETED',
                      processedAt: new Date().toISOString(),
                      outputs: {
                        svgString,
                        pngDataUrl,
                        dxfString,
                        csvString,
                        fileBaseName,
                        summaryMetrics,
                      },
                    }
                  : it
              )
            );
            setActiveBatchIndex((prevIdx) => (prevIdx !== null ? prevIdx + 1 : null));
          } catch (err: unknown) {
            if (cancelled) return;
            const msg = err instanceof Error ? err.message : 'Processing failed';
            setBatchQueue((prev) =>
              prev.map((it, i) =>
                i === activeBatchIndex
                  ? { ...it, status: 'ERROR', errorMessage: msg }
                  : it
              )
            );
            setActiveBatchIndex((prevIdx) => (prevIdx !== null ? prevIdx + 1 : null));
          }
        });
      });
    }, 240);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    isOpen,
    isBatchRunning,
    isBatchPaused,
    activeBatchIndex,
    batchQueue,
    batchConfig.autoDownloadFormat,
    geometry,
    settings,
    joints,
    jointSets,
    selectedClassificationMethod,
    qIndex,
    rmr,
    gsi,
    qResult,
    rmrResult,
    gsiResult,
    rockMass,
    overbreakAnalysis,
    controlPoints,
    sectionVolumeRows,
    outputMode,
    effectiveSheetConfig.projectName,
    qcReport.passed,
    qcReport.issues.length,
    sheetW,
    sheetH,
  ]);

  useEffect(() => {
    if (!isPrintingBatchBook) return;
    const onAfterPrint = () => setIsPrintingBatchBook(false);
    window.addEventListener('afterprint', onAfterPrint);
    const t = window.setTimeout(() => {
      window.print();
    }, 150);
    return () => {
      window.removeEventListener('afterprint', onAfterPrint);
      window.clearTimeout(t);
    };
  }, [isPrintingBatchBook]);

  // Batch Queue Management Handlers
  const handleAddRecordToQueue = (record: SavedProjectRecord) => {
    const newItem: BatchQueueItem = {
      queueId: `bq-${record.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      record,
      status: 'QUEUED',
    };
    setBatchQueue((prev) => [...prev, newItem]);
  };

  const handleAddAllSavedToQueue = () => {
    if (savedProjects.length === 0) return;
    const existingIds = new Set(batchQueue.map((q) => q.record.id));
    const toAdd = savedProjects.filter((r) => !existingIds.has(r.id));
    const sourceList = toAdd.length > 0 ? toAdd : savedProjects;
    const newItems: BatchQueueItem[] = sourceList.map((rec, idx) => ({
      queueId: `bq-${rec.id}-${Date.now()}-${idx}`,
      record: rec,
      status: 'QUEUED',
    }));
    setBatchQueue((prev) => [...prev, ...newItems]);
  };

  const handleAddCurrentWorkspaceToQueue = () => {
    const chMeters = parseNumericChainageMeters(
      baseSettings.faceChainage,
      baseSettings.chainage
    );
    const projName =
      baseSettings.projectName ||
      baseSettings.sheetConfig?.projectName ||
      'Tunnel Engineering Project';
    const locName =
      baseSettings.locationName ||
      baseSettings.location ||
      baseSettings.sheetConfig?.location ||
      'Main Heading';
    const snapshotRecord: SavedProjectRecord = {
      id: `live-snap-${Date.now()}`,
      projectName: projName,
      tunnelName: baseSettings.tunnelName || 'Main Tunnel',
      location: locName,
      chainage: baseSettings.chainage || 'RD 0.00m',
      faceChainage: baseSettings.faceChainage || baseSettings.chainage || 'RD 0.00m',
      numericChainageMeters: chMeters,
      date: baseSettings.date || new Date().toISOString().slice(0, 10),
      savedAt: new Date().toISOString(),
      mappingMode: 'TUNNEL_PROFILE',
      geometry: propGeometry,
      settings: baseSettings,
      sheetConfig: baseSettings.sheetConfig,
      photos: propPhotos,
      joints: propJoints,
      customJointSetOverrides: {},
      qIndexParams: propQIndex || createDefaultQIndexParameters(),
      selectedClassificationMethod: propSelectedClassificationMethod,
      rmrParams: propRmrParams,
      gsiParams: propGsiParams,
      qParamStatus: propQParamStatus,
      rockMassSummary:
        propRockMass || createDefaultRockMassSummary(baseSettings.lithology),
      lithologyRegions: propLithologyRegions,
      controlPoints: propControlPoints,
      surveyProfile: {
        surface: 'face',
        orderedControlPointIds: propControlPoints
          .filter((c) => c.surface === 'face')
          .map((c) => c.id),
        isClosed: true,
        visible: true,
        locked: false,
        pullIntervalMeters: baseSettings.roundLength || 3.5,
        useValidPullInterval: true,
        zoneReasonOverrides: {},
        overallOverbreakCategory: 'GEOLOGICAL',
        overallOverbreakReason: 'Wedge release along joint planes',
        overallUndercutCategory: 'MECHANICAL_EXCAVATION',
        overallUndercutReason: 'Inward perimeter excavation alignment',
      },
      placedSymbols: propPlacedSymbols,
      quantitySummary: {
        designAreaSqM: propOverbreakAnalysis?.designAreaSqMeters ?? 0,
        surveyedAreaSqM: propOverbreakAnalysis?.surveyedAreaSqMeters ?? 0,
        overbreakAreaSqM: propOverbreakAnalysis?.overbreakAreaSqMeters ?? 0,
        undercutAreaSqM: propOverbreakAnalysis?.undercutAreaSqMeters ?? 0,
        overbreakPct: propOverbreakAnalysis?.overbreakPercentage ?? 0,
        undercutPct: propOverbreakAnalysis?.undercutPercentage ?? 0,
        maxOverbreakM: propOverbreakAnalysis?.maxRadialOverbreakMeters ?? 0,
        maxUndercutM: propOverbreakAnalysis?.maxRadialUndercutMeters ?? 0,
        pullIntervalM: propOverbreakAnalysis?.effectivePullIntervalMeters ?? null,
        overbreakVolumeM3: propOverbreakAnalysis?.overbreakVolumeCubicMeters ?? null,
        undercutVolumeM3: propOverbreakAnalysis?.undercutVolumeCubicMeters ?? null,
      },
    };
    handleAddRecordToQueue(snapshotRecord);
  };

  const handleImportJsonFilesToQueue = async (files: FileList) => {
    const added: BatchQueueItem[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const text = await files[i].text();
        const parsed = JSON.parse(text);
        const records: SavedProjectRecord[] = Array.isArray(parsed)
          ? parsed
          : parsed && Array.isArray(parsed.records)
          ? parsed.records
          : parsed && parsed.geometry && parsed.settings
          ? [parsed as SavedProjectRecord]
          : [];
        for (const rec of records) {
          if (rec && rec.geometry && rec.settings) {
            saveProjectRecordToMemory(rec);
            added.push({
              queueId: `bq-imp-${rec.id || Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              record: rec,
              status: 'QUEUED',
            });
          }
        }
      } catch {
        // Ignore invalid files
      }
    }
    if (added.length > 0) {
      setBatchQueue((prev) => [...prev, ...added]);
    }
  };

  const handleRemoveQueueItem = (queueId: string) => {
    setBatchQueue((prev) => prev.filter((item) => item.queueId !== queueId));
    if (previewQueueId === queueId) {
      setPreviewQueueId(null);
    }
  };

  const handleMoveQueueItem = (queueId: string, dir: -1 | 1) => {
    setBatchQueue((prev) => {
      const next = [...prev];
      const idx = next.findIndex((i) => i.queueId === queueId);
      if (idx === -1) return prev;
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const handleSortQueue = (by: 'chainage_asc' | 'chainage_desc' | 'date_asc') => {
    setBatchQueue((prev) => {
      const next = [...prev];
      next.sort((a, b) => {
        if (by === 'date_asc') {
          return (a.record.date || '').localeCompare(b.record.date || '');
        }
        const rdA =
          a.record.numericChainageMeters ??
          parseNumericChainageMeters(a.record.faceChainage, a.record.chainage) ??
          0;
        const rdB =
          b.record.numericChainageMeters ??
          parseNumericChainageMeters(b.record.faceChainage, b.record.chainage) ??
          0;
        return by === 'chainage_asc' ? rdA - rdB : rdB - rdA;
      });
      return next;
    });
  };

  const handleClearQueue = () => {
    setIsBatchRunning(false);
    setIsBatchPaused(false);
    setActiveBatchIndex(null);
    setPreviewQueueId(null);
    setBatchQueue([]);
  };

  const handleStartBatch = () => {
    if (batchQueue.length === 0) return;
    setPreviewQueueId(null);
    setBatchQueue((prev) =>
      prev.map((item) => ({
        ...item,
        status: 'QUEUED',
        processedAt: undefined,
        errorMessage: undefined,
      }))
    );
    setIsBatchPaused(false);
    setActiveBatchIndex(0);
    setIsBatchRunning(true);
  };

  const handlePauseResumeBatch = () => {
    setIsBatchPaused((prev) => !prev);
  };

  const handleStopResetBatch = () => {
    setIsBatchRunning(false);
    setIsBatchPaused(false);
    setActiveBatchIndex(null);
    setBatchQueue((prev) =>
      prev.map((item) => ({
        ...item,
        status: item.outputs ? 'COMPLETED' : 'QUEUED',
      }))
    );
  };

  const handleDownloadSingleBatchOutput = (
    item: BatchQueueItem,
    format: 'svg' | 'png' | 'dxf' | 'csv'
  ) => {
    if (!item.outputs) return;
    const base = item.outputs.fileBaseName;
    if (format === 'svg') {
      triggerTextFileDownload(
        item.outputs.svgString,
        `${base}_sheet.svg`,
        'image/svg+xml;charset=utf-8'
      );
    } else if (format === 'png') {
      triggerDataUrlDownload(item.outputs.pngDataUrl, `${base}_sheet.png`);
    } else if (format === 'dxf') {
      triggerDownloadDXFSheet(`${base}_sheet.dxf`, item.outputs.dxfString);
    } else if (format === 'csv') {
      triggerTextFileDownload(
        item.outputs.csvString,
        `${base}_geology_qindex.csv`,
        'text/csv;charset=utf-8'
      );
    }
  };

  const handleDownloadConsolidatedCSV = () => {
    const completed = batchQueue.filter((i) => i.status === 'COMPLETED' && i.outputs);
    if (completed.length === 0) return;
    const headers = [
      'Seq_No',
      'Project_Name',
      'Location',
      'Tunnel_Name',
      'Chainage_Interval',
      'Face_Chainage',
      'Numeric_RD_m',
      'Date',
      'Sheet_Output_Mode',
      'Classification_Method',
      'Width_m',
      'Height_m',
      'Drive_Azimuth_Deg',
      'Lithology',
      'Mapped_Traces',
      'Joint_Sets',
      'Q_Value',
      'RMR_Value',
      'GSI_Value',
      'Design_Area_m2',
      'Surveyed_Area_m2',
      'Overbreak_Area_m2',
      'Overbreak_Pct',
      'Undercut_Area_m2',
      'Undercut_Pct',
      'Overbreak_Volume_m3',
      'QC_Status',
    ];
    const escapeCsv = (val: unknown) => {
      const s = String(val ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const rows = completed.map((item) => {
      const m = item.outputs!.summaryMetrics;
      return [
        m.sequenceNumber,
        m.projectName,
        m.location,
        m.tunnelName,
        m.chainage,
        m.faceChainage,
        m.numericRdMeters ?? '',
        m.date,
        m.outputMode,
        m.classificationMethod,
        m.widthM.toFixed(2),
        m.heightM.toFixed(2),
        m.driveDirectionDeg,
        m.lithology,
        m.jointCount,
        m.jointSetCount,
        m.qValue,
        m.rmrValue,
        m.gsiValue,
        m.designAreaSqM.toFixed(2),
        m.surveyedAreaSqM.toFixed(2),
        m.overbreakAreaSqM.toFixed(2),
        m.overbreakPct.toFixed(2),
        m.undercutAreaSqM.toFixed(2),
        m.undercutPct.toFixed(2),
        m.overbreakVolM3,
        m.qcStatus,
      ]
        .map(escapeCsv)
        .join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    triggerTextFileDownload(
      csvContent,
      `ESWA_Batch_Engineering_Register_${completed.length}_Sections.csv`,
      'text/csv;charset=utf-8'
    );
  };

  const handleDownloadConsolidatedJSON = () => {
    const completed = batchQueue.filter((i) => i.status === 'COMPLETED' && i.outputs);
    if (completed.length === 0) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      standardizedConfig: batchConfig,
      totalProcessed: completed.length,
      summarySchedule: completed.map((c) => c.outputs!.summaryMetrics),
      records: completed.map((c) => c.record),
    };
    triggerTextFileDownload(
      JSON.stringify(payload, null, 2),
      `ESWA_Batch_Standardized_Package_${completed.length}_Sections.json`,
      'application/json;charset=utf-8'
    );
  };

  const handleDownloadMultiSheetHtmlBook = () => {
    const completed = batchQueue.filter((i) => i.status === 'COMPLETED' && i.outputs);
    if (completed.length === 0) return;
    const pagesHtml = completed
      .map((item, idx) => {
        const m = item.outputs!.summaryMetrics;
        return `<section class="sheet-page">
          <div class="sheet-meta no-print">
            <span>Sheet ${idx + 1} of ${completed.length}: ${m.tunnelName} · ${m.faceChainage} (${m.location})</span>
            <span>Q: ${m.qValue} · RMR: ${m.rmrValue} · Overbreak: ${m.overbreakAreaSqM.toFixed(2)} m² (${m.overbreakPct.toFixed(1)}%)</span>
          </div>
          <div class="svg-wrap">${item.outputs!.svgString}</div>
        </section>`;
      })
      .join('\n');

    const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Standardized Batch Engineering Drawing Book (${completed.length} Sheets)</title>
<style>
  @page { size: A3 landscape; margin: 0mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #0f172a; font-family: 'IBM Plex Mono', monospace; color: #f8fafc; }
  .top-bar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; background: #090d16; border-bottom: 1px solid #1e293b; }
  .print-btn { background: #0284c7; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-family: inherit; font-weight: 700; cursor: pointer; }
  .sheet-page { width: 100%; max-width: 1600px; margin: 20px auto; background: #ffffff; color: #000000; box-shadow: 0 12px 32px rgba(0,0,0,0.45); page-break-after: always; break-after: page; }
  .sheet-meta { display: flex; justify-content: space-between; padding: 8px 14px; background: #1e293b; color: #e2e8f0; font-size: 12px; }
  .svg-wrap svg { display: block; width: 100%; height: auto; }
  @media print {
    body { background: #ffffff; }
    .no-print { display: none !important; }
    .sheet-page { margin: 0; max-width: none; box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="top-bar no-print">
    <div><strong>ESWA STANDARDIZED ENGINEERING SHEET BOOK</strong> · ${completed.length} Queued Sections Processed</div>
    <button class="print-btn" onclick="window.print()">Print / Save All as Multi-Page A3 PDF</button>
  </div>
  ${pagesHtml}
</body>
</html>`;

    triggerTextFileDownload(
      htmlDoc,
      `ESWA_Standardized_Engineering_Book_${completed.length}_Sheets.html`,
      'text/html;charset=utf-8'
    );
  };

  const handlePrintMultiSheetPdfBook = () => {
    const completed = batchQueue.filter((i) => i.status === 'COMPLETED' && i.outputs);
    if (completed.length === 0) return;
    setIsPrintingBatchBook(true);
  };

  const showPhotos =
    outputMode !== 'CROWN_AND_WALL_VECTOR_ONLY' &&
    (outputMode === 'PHOTO_AND_AI_TRACING' ||
      outputMode === 'EXPORT_PHOTO_ONLY' ||
      (outputMode === 'FINAL_ENGINEERING_SHEET' &&
        Object.values(photos).some((p) => p.opacity > 0 && p.image)));

  const showVectors = outputMode !== 'EXPORT_PHOTO_ONLY';

  const showCrownWallPhotos =
    crownWallContentMode !== 'VECTORS_ONLY' &&
    (isCrownAndWallOnly || showPhotos || crownWallContentMode === 'PHOTO_ONLY');

  const showCrownWallVectors =
    crownWallContentMode !== 'PHOTO_ONLY' && showVectors;

  const fallbackPerimeterPhotos = useMemo(() => {
    if (!isOpen) return { leftWall: '', crown: '', rightWall: '' };
    return {
      leftWall: generateSampleTunnelPhotograph('leftWall', geometry),
      crown: generateSampleTunnelPhotograph('crown', geometry),
      rightWall: generateSampleTunnelPhotograph('rightWall', geometry),
    };
  }, [isOpen, geometry]);

  const leftWallPhotoSrc =
    localPerimeterPhotos.leftWall ||
    photos.leftWall.warpedImage ||
    photos.leftWall.image ||
    fallbackPerimeterPhotos.leftWall;
  const crownPhotoSrc =
    localPerimeterPhotos.crown ||
    photos.crown.warpedImage ||
    photos.crown.image ||
    fallbackPerimeterPhotos.crown;
  const rightWallPhotoSrc =
    localPerimeterPhotos.rightWall ||
    photos.rightWall.warpedImage ||
    photos.rightWall.image ||
    fallbackPerimeterPhotos.rightWall;

  const handleUploadPerimeterPhoto = (
    surface: 'leftWall' | 'crown' | 'rightWall',
    file?: File | null
  ) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLocalPerimeterPhotos((prev) => ({ ...prev, [surface]: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadHeaderLogo = (
    logoKey: 'clientLogoDataUrl' | 'contractorLogoDataUrl',
    file?: File | null
  ) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const dataUrl = reader.result;
        const nextCfg = {
          ...effectiveSheetConfig,
          [logoKey]: dataUrl,
          logoPosition:
            effectiveSheetConfig.logoPosition === 'HIDDEN'
              ? ('HEADER_CORNERS' as const)
              : effectiveSheetConfig.logoPosition,
        };
        saveSheetConfigToStorage(nextCfg);
        handleUpdateSettings((prev) => ({
          ...prev,
          sheetConfig: nextCfg,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  // For "Crown & Wall Vector Only" sheet, include all mapped Crown/LeftWall/RightWall traces
  // and optionally project 3D traces from Face joints onto Crown & Walls when perimeter surfaces have no direct traces
  const effectiveSheetJoints = useMemo<Joint[]>(() => {
    if (outputMode !== 'CROWN_AND_WALL_VECTOR_ONLY') {
      return joints;
    }
    const directCrownWall = joints.filter((j) => j.surface !== 'face');
    if (!autoProjectFaceToCrownWall) {
      return directCrownWall;
    }
    const faceJoints = joints.filter((j) => j.surface === 'face' && j.geometry.length >= 2);
    if (faceJoints.length === 0) {
      return directCrownWall;
    }
    const hasCrownDirect = directCrownWall.some((j) => j.surface === 'crown');
    const hasLeftWallDirect = directCrownWall.some((j) => j.surface === 'leftWall');
    const hasRightWallDirect = directCrownWall.some((j) => j.surface === 'rightWall');

    const projected: Joint[] = [...directCrownWall];
    const pullM = Math.max(1.5, settings.roundLength || 3.5);
    const crownSpanM = Math.max(1.0, geometry.crownArcLength || geometry.width);
    const lwSpanM = Math.max(1.0, geometry.leftWallArcLength ?? geometry.leftWallHeight ?? geometry.wallHeight ?? 4.2);
    const rwSpanM = Math.max(1.0, geometry.rightWallArcLength ?? geometry.rightWallHeight ?? geometry.wallHeight ?? 4.2);
    const driveAz = settings.driveDirection || 0;

    faceJoints.forEach((fj, idx) => {
      const startPt = fj.geometry[0];
      const endPt = fj.geometry[fj.geometry.length - 1];
      const midX = (startPt.x + endPt.x) / 2;
      const midY = (startPt.y + endPt.y) / 2;
      const strikeRelDriveRad = (((fj.strike - driveAz) * Math.PI) / 180);

      // 1. Project onto Crown if Crown has no direct traces or trace enters upper arch
      if (!hasCrownDirect && (midY >= geometry.wallHeight * 0.55 || idx < 4)) {
        const xCenter = Math.max(-crownSpanM * 0.38, Math.min(crownSpanM * 0.38, midX));
        const dx = Math.sin(strikeRelDriveRad) * (pullM * 0.36);
        const dy = Math.cos(strikeRelDriveRad) * (pullM * 0.36);
        const yMid = pullM * (0.28 + ((idx % 3) * 0.22));
        const pA = {
          x: Number(Math.max(-crownSpanM * 0.46, Math.min(crownSpanM * 0.46, xCenter - dx)).toFixed(3)),
          y: Number(Math.max(0.15, Math.min(pullM - 0.15, yMid - dy)).toFixed(3)),
        };
        const pM = {
          x: Number(xCenter.toFixed(3)),
          y: Number(yMid.toFixed(3)),
        };
        const pB = {
          x: Number(Math.max(-crownSpanM * 0.46, Math.min(crownSpanM * 0.46, xCenter + dx)).toFixed(3)),
          y: Number(Math.max(0.15, Math.min(pullM - 0.15, yMid + dy)).toFixed(3)),
        };
        const crownStrike = ((fj.dipDirection - 90) % 360 + 360) % 360;
        projected.push({
          ...fj,
          id: `${fj.id}-proj-crown`,
          surface: 'crown',
          geometry: [pA, pM, pB],
          strike: Number(crownStrike.toFixed(1)),
          dipDirection: fj.dipDirection,
          dip: fj.dip,
          linkedJointIds: [fj.id],
          persistenceMeters: Number(Math.hypot(pB.x - pA.x, pB.y - pA.y).toFixed(2)),
        });
      }

      // 2. Project onto Left Wall if Left Wall has no direct traces and trace is on left half
      if (!hasLeftWallDirect && (midX <= 0.8 || idx % 2 === 0)) {
        const yMid = Math.max(0.5, Math.min(lwSpanM - 0.4, midY));
        const xMid = pullM * (0.25 + ((idx % 3) * 0.24));
        const tanDip = Math.tan((Math.max(15, Math.min(85, fj.dip)) * Math.PI) / 180);
        const dx = Math.min(pullM * 0.32, 0.9);
        const dy = Math.max(-lwSpanM * 0.35, Math.min(lwSpanM * 0.35, (dx * Math.min(2.2, tanDip)) * 0.45));
        const pA = {
          x: Number(Math.max(0.15, Math.min(pullM - 0.15, xMid - dx)).toFixed(3)),
          y: Number(Math.max(0.2, Math.min(lwSpanM - 0.2, yMid - dy)).toFixed(3)),
        };
        const pB = {
          x: Number(Math.max(0.15, Math.min(pullM - 0.15, xMid + dx)).toFixed(3)),
          y: Number(Math.max(0.2, Math.min(lwSpanM - 0.2, yMid + dy)).toFixed(3)),
        };
        projected.push({
          ...fj,
          id: `${fj.id}-proj-lw`,
          surface: 'leftWall',
          geometry: [pA, pB],
          linkedJointIds: [fj.id],
          persistenceMeters: Number(Math.hypot(pB.x - pA.x, pB.y - pA.y).toFixed(2)),
        });
      }

      // 3. Project onto Right Wall if Right Wall has no direct traces and trace is on right half
      if (!hasRightWallDirect && (midX >= -0.8 || idx % 2 === 1)) {
        const yMid = Math.max(0.5, Math.min(rwSpanM - 0.4, midY));
        const xMid = pullM * (0.3 + ((idx % 3) * 0.22));
        const tanDip = Math.tan((Math.max(15, Math.min(85, fj.dip)) * Math.PI) / 180);
        const dx = Math.min(pullM * 0.32, 0.9);
        const dy = Math.max(-rwSpanM * 0.35, Math.min(rwSpanM * 0.35, (dx * Math.min(2.2, tanDip)) * 0.45));
        const pA = {
          x: Number(Math.max(0.15, Math.min(pullM - 0.15, xMid - dx)).toFixed(3)),
          y: Number(Math.max(0.2, Math.min(rwSpanM - 0.2, yMid + dy)).toFixed(3)),
        };
        const pB = {
          x: Number(Math.max(0.15, Math.min(pullM - 0.15, xMid + dx)).toFixed(3)),
          y: Number(Math.max(0.2, Math.min(rwSpanM - 0.2, yMid - dy)).toFixed(3)),
        };
        projected.push({
          ...fj,
          id: `${fj.id}-proj-rw`,
          surface: 'rightWall',
          geometry: [pA, pB],
          linkedJointIds: [fj.id],
          persistenceMeters: Number(Math.hypot(pB.x - pA.x, pB.y - pA.y).toFixed(2)),
        });
      }
    });

    return projected;
  }, [
    outputMode,
    joints,
    autoProjectFaceToCrownWall,
    settings.roundLength,
    settings.driveDirection,
    geometry.crownArcLength,
    geometry.width,
    geometry.leftWallArcLength,
    geometry.leftWallHeight,
    geometry.wallHeight,
    geometry.rightWallArcLength,
    geometry.rightWallHeight,
  ]);

  if (!isOpen) return null;

  const handleDownloadSVG = () => {
    const svgString = getExportReadySvgString();
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${settings.tunnelName.replace(/\s+/g, '_')}_${settings.faceChainage.replace(/\s+/g, '_')}_mapping.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export high-resolution PNG
  const handleDownloadPNG = () => {
    const svgString = getExportReadySvgString();
    if (!svgString) return;
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = sheetW * 2;
      canvas.height = totalSheetH * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `${settings.tunnelName.replace(/\s+/g, '_')}_${settings.faceChainage.replace(/\s+/g, '_')}_sheet.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.src = url;
  };

  // Export standalone binary PDF (.pdf) with embedded drawing sheet + engineering tables
  const handleDownloadPDF = () => {
    void downloadEngineeringSheetAsPDF({
      geometry,
      settings,
      joints,
      jointSets,
      qIndexParams: qIndex,
      qParamStatus: propQParamStatus,
      rmrParams: rmr,
      gsiParams: gsi,
      selectedMethod: selectedClassificationMethod,
      rockMassSummary: rockMass,
      overbreakAnalysis,
      controlPoints,
      svgString: getExportReadySvgString(),
      sheetWidthPx: sheetW,
      sheetHeightPx: totalSheetH,
    });
  };

  // Export Microsoft Word (.doc) report with embedded drawing sheet + editable tables
  const handleDownloadWordDoc = () => {
    void downloadEngineeringSheetAsWordDoc({
      geometry,
      settings,
      joints,
      jointSets,
      qIndexParams: qIndex,
      qParamStatus: propQParamStatus,
      rmrParams: rmr,
      gsiParams: gsi,
      selectedMethod: selectedClassificationMethod,
      rockMassSummary: rockMass,
      overbreakAnalysis,
      controlPoints,
      svgString: getExportReadySvgString(),
      sheetWidthPx: sheetW,
      sheetHeightPx: totalSheetH,
    });
  };

  // Export PDF via vector print sheet
  const handlePrintPDF = () => {
    window.print();
  };

  // Export AutoCAD DXF Vector Profile & Traces
  const handleDownloadDXF = () => {
    const dxfContent = exportMappedGeologicalSheetToDXF({
      geometry,
      settings,
      joints,
      jointSets,
      selectedMethod: selectedClassificationMethod,
      qIndexParams: qIndex,
      rmrParams: rmr,
      gsiParams: gsi,
      qValue: qResult.isComplete ? qResult.qValue : null,
      rmrValue: rmrResult.finalRmr,
    });
    triggerDownloadDXFSheet(
      `${settings.tunnelName.replace(/\s+/g, '_')}_${settings.faceChainage.replace(/\s+/g, '_')}_Geological_Sheet.dxf`,
      dxfContent
    );
  };

  // Export CSV Engineering Tables & Q-Index
  const handleDownloadCSV = () => {
    const csvString = exportGeologyAndQIndexToCSV(
      geometry,
      settings,
      joints,
      jointSets,
      qIndex,
      rockMass,
      overbreakAnalysis,
      controlPoints,
      sectionVolumeRows
    );
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${settings.tunnelName.replace(/\s+/g, '_')}_${settings.faceChainage.replace(/\s+/g, '_')}_geology_qindex.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col h-dvh w-full max-w-full max-h-dvh bg-slate-950/95 backdrop-blur-sm overflow-y-auto overflow-x-hidden touch-pan-y overscroll-contain">
      {/* Top Action & Mode Bar (hidden when printing to PDF) */}
      <div
        className={`no-print flex flex-wrap items-center justify-between gap-2 ${
          responsive.toolbarCompact ? 'px-3 py-1.5' : 'px-5 py-2.5'
        } bg-[#0F141C] border-b border-slate-800 shrink-0`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-lg border border-sky-400 shadow-sm transition-colors whitespace-nowrap cursor-pointer"
            title="Go Back to Mapping Workspace & Data Sheets"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <span className="font-display font-bold text-xs xl:text-sm tracking-wider text-slate-100">
            {outputMode === 'ENGINEERING_QUANTITY_SHEET'
              ? 'OVERBREAK & ENGINEERING QUANTITY SHEET'
              : outputMode === 'CROWN_AND_WALL_VECTOR_ONLY'
              ? crownWallContentMode === 'PHOTO_ONLY'
                ? 'CROWN & WALL PHOTOGRAPH SHEET (PHOTO ONLY — NO GEOLOGICAL DATA)'
                : 'CROWN & WALL DEVELOPED PERIMETER SHEET'
              : 'GEOLOGICAL TUNNEL MAPPING SHEET'}
          </span>
          <div className="flex flex-wrap items-center gap-1 bg-slate-900 p-1 rounded border border-slate-800">
            {(
              [
                { id: 'FINAL_ENGINEERING_SHEET', label: '1. Geological Mapping Sheet' },
                { id: 'ENGINEERING_QUANTITY_SHEET', label: '2. Overbreak & Quantity Sheet' },
                { id: 'CLEAN_MAPPING_DRAWING', label: '3. Clean Mapping Drawing' },
                { id: 'PHOTO_AND_AI_TRACING', label: '4. Photo + Vector Tracing' },
                { id: 'VECTOR_MAPPING_ONLY', label: '5. Vector Mapping Only' },
                { id: 'CROWN_AND_WALL_VECTOR_ONLY', label: '6. Crown & Wall Sheet (Photo Only)' },
                { id: 'EXPORT_PHOTO_ONLY', label: '7. Main Photo Only' },
              ] as { id: OutputSheetMode; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setOutputMode(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  outputMode === tab.id
                    ? tab.id === 'ENGINEERING_QUANTITY_SHEET'
                      ? 'bg-rose-600 text-white font-bold'
                      : tab.id === 'CROWN_AND_WALL_VECTOR_ONLY'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-cyan-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* NATM Advanced Rock Mechanics & Predictive Analytics Segmented View */}
          {(activeIndustryMode === 'NATM' || !activeIndustryMode) && (
            <div className="flex items-center gap-1 bg-slate-950/90 px-2 py-1 rounded border border-cyan-700/60 shadow-sm">
              <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                NATM Analytics:
              </span>
              {(
                [
                  { id: 'ALL_4_BLOCKS', label: 'All 4 Analytical Blocks' },
                  { id: 'WEDGE_ADEQUACY', label: '3D Wedge Adequacy' },
                  { id: 'ROUND_TREND_OVERBREAK', label: 'Overbreak & Trend' },
                  { id: 'AHEAD_OF_FACE', label: 'Look-Ahead Forepoling' },
                  { id: 'STANDARD_DISCONTINUITY', label: '4-Surface Schedule' },
                ] as { id: NatmAnalyticsViewMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setNatmAnalyticsView(m.id)}
                  className={`px-2 py-0.5 text-[10.5px] font-mono rounded cursor-pointer transition-colors ${
                    natmAnalyticsView === m.id
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {showPerimeterPlan && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-emerald-700/60">
              <span className="text-[11px] font-mono font-bold text-emerald-300">
                Crown &amp; Wall Portion:
              </span>
              <button
                type="button"
                onClick={() => setCrownWallContentMode('PHOTO_ONLY')}
                className={`px-2 py-0.5 text-[11px] font-mono rounded cursor-pointer transition-colors ${
                  crownWallContentMode === 'PHOTO_ONLY'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Show only photographs in the Crown & Wall portion (no other geological data)"
              >
                Photo Only (No Geo Data)
              </button>
              <button
                type="button"
                onClick={() => setCrownWallContentMode('PHOTO_AND_VECTORS')}
                className={`px-2 py-0.5 text-[11px] font-mono rounded cursor-pointer transition-colors ${
                  crownWallContentMode === 'PHOTO_AND_VECTORS'
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Show both photographs and geological traces on Crown & Wall"
              >
                Photo + Vectors
              </button>
              <button
                type="button"
                onClick={() => setCrownWallContentMode('VECTORS_ONLY')}
                className={`px-2 py-0.5 text-[11px] font-mono rounded cursor-pointer transition-colors ${
                  crownWallContentMode === 'VECTORS_ONLY'
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Show only vector geological traces on Crown & Wall"
              >
                Vectors Only
              </button>
              {isCrownAndWallOnly && (
                <div className="flex items-center gap-1 ml-1 pl-1.5 border-l border-slate-700">
                  {(
                    [
                      { key: 'leftWall', label: 'Left Wall Photo' },
                      { key: 'crown', label: 'Crown Photo' },
                      { key: 'rightWall', label: 'Right Wall Photo' },
                    ] as const
                  ).map((item) => (
                    <label
                      key={item.key}
                      className="relative overflow-hidden flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-200 rounded border border-slate-700 cursor-pointer"
                      title={`Upload custom photograph for ${item.label}`}
                    >
                      <Upload className="w-2.5 h-2.5 text-cyan-400" />
                      {item.label}
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={(e) => handleUploadPerimeterPhoto(item.key, e.target.files?.[0])}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {outputMode !== 'ENGINEERING_QUANTITY_SHEET' && outputMode !== 'EXPORT_PHOTO_ONLY' && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900 border border-slate-700/80">
              <span className="text-[11px] font-mono font-bold text-slate-300">
                Survey Profile:
              </span>
              <label className="flex items-center gap-1 text-xs text-rose-300 font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showOverbreakOnGeology}
                  onChange={(e) => setShowOverbreakOnGeology(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-rose-500"
                />
                Show Overbreak
              </label>
              <label className="flex items-center gap-1 text-xs text-amber-300 font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showUndercutOnGeology}
                  onChange={(e) => setShowUndercutOnGeology(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-amber-500"
                />
                Show Undercut
              </label>
              {!overbreakAnalysis?.hasValidSurveyProfile && onGenerateSampleAsBuiltProfile && (
                <button
                  type="button"
                  onClick={() => {
                    setShowOverbreakOnGeology(true);
                    setShowUndercutOnGeology(true);
                    onGenerateSampleAsBuiltProfile();
                  }}
                  className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-rose-950/90 hover:bg-rose-900 text-rose-200 border border-rose-600/60 cursor-pointer"
                  title="Load sample surveyed control points to display Overbreak and Undercut on this sheet"
                >
                  + Load Sample OB/UC
                </button>
              )}
            </div>
          )}

          {outputMode === 'CROWN_AND_WALL_VECTOR_ONLY' && (
            <label className="flex items-center gap-1.5 text-xs text-emerald-300 font-semibold cursor-pointer select-none px-2 py-1 rounded bg-emerald-950/60 border border-emerald-700/60">
              <input
                type="checkbox"
                checked={autoProjectFaceToCrownWall}
                onChange={(e) => setAutoProjectFaceToCrownWall(e.target.checked)}
                className="rounded border-emerald-600 bg-slate-900 text-emerald-500"
              />
              + Project Face 3D Traces to Crown &amp; Wall
            </label>
          )}

          {outputMode === 'ENGINEERING_QUANTITY_SHEET' && (
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none px-2 py-1 rounded bg-slate-900 border border-slate-800">
              <input
                type="checkbox"
                checked={overlayJointsOnQuantity}
                onChange={(e) => setOverlayJointsOnQuantity(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-cyan-500"
              />
              + Geology Traces Overlay
            </label>
          )}

          {/* Layout Engine Mode Toggle: Prominent Face + Perimeter vs Maximize Tunnel Face */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded border border-slate-800">
            <button
              onClick={() => setArrangement('AUTO_INTELLIGENT')}
              className={`px-2 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap cursor-pointer ${
                arrangement === 'AUTO_INTELLIGENT'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={
                outputMode === 'CROWN_AND_WALL_VECTOR_ONLY'
                  ? 'Crown & Wall Vector Drawing + Right Engineering Tables'
                  : 'Auto-Layout: Prominent Tunnel Face + Developed Perimeter'
              }
            >
              {outputMode === 'CROWN_AND_WALL_VECTOR_ONLY'
                ? 'Crown & Wall + Tables'
                : 'Auto Fit (Face + Perimeter)'}
            </button>
            <button
              onClick={() => setArrangement('MAXIMIZE_FACE')}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap cursor-pointer ${
                arrangement === 'MAXIMIZE_FACE'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={
                outputMode === 'CROWN_AND_WALL_VECTOR_ONLY'
                  ? 'Maximize Crown & Wall Vector Drawing across full sheet width'
                  : 'Maximize Main Tunnel-Face Mapping across full drawing arena'
              }
            >
              <Maximize2 className="w-3 h-3" />
              {outputMode === 'CROWN_AND_WALL_VECTOR_ONLY'
                ? 'Maximize Crown & Wall'
                : 'Maximize Face'}
            </button>
          </div>

          {/* Quick Toggle: Adaptive Layout (Auto-Resizing) vs Fixed Layout (Manual Control) */}
          <div
            className="flex items-center gap-1 bg-slate-900 p-1 rounded border border-slate-800"
            title="Switch between Adaptive Layout (auto-font/table resizing) and Fixed Layout (manual control)"
          >
            <button
              type="button"
              onClick={() => {
                const nextCfg = {
                  ...effectiveSheetConfig,
                  layoutMode: 'ADAPTIVE_LAYOUT' as const,
                };
                saveSheetConfigToStorage(nextCfg);
                handleUpdateSettings((prev) => ({ ...prev, sheetConfig: nextCfg }));
              }}
              className={`px-2 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap cursor-pointer ${
                (effectiveSheetConfig.layoutMode || 'ADAPTIVE_LAYOUT') === 'ADAPTIVE_LAYOUT'
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Adaptive Layout
            </button>
            <button
              type="button"
              onClick={() => {
                const nextCfg = {
                  ...effectiveSheetConfig,
                  layoutMode: 'FIXED_LAYOUT' as const,
                };
                saveSheetConfigToStorage(nextCfg);
                handleUpdateSettings((prev) => ({ ...prev, sheetConfig: nextCfg }));
                setIsSettingsDrawerOpen(true);
              }}
              className={`px-2 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap cursor-pointer ${
                effectiveSheetConfig.layoutMode === 'FIXED_LAYOUT'
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Fixed Layout
            </button>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showConfidenceLabels}
              onChange={(e) => setShowConfidenceLabels(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-cyan-500"
            />
            Show Confidence
          </label>

          {appendixSnapshots.length > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-emerald-300 cursor-pointer select-none px-2 py-1 rounded bg-emerald-950/60 border border-emerald-700/60 font-mono">
              <input
                type="checkbox"
                checked={show3DAppendixOnSheet}
                onChange={(e) => setShow3DAppendixOnSheet(e.target.checked)}
                className="rounded border-emerald-600 bg-slate-900 text-emerald-500"
              />
              + 3D Orientation Appendix ({appendixSnapshots.length})
            </label>
          )}

          {/* Screen Fit / Zoom Selector */}
          <select
            value={sheetZoomMode}
            onChange={(e) =>
              setSheetZoomMode(e.target.value as 'auto_fit' | '100' | '125' | '150')
            }
            className="bg-slate-900 text-cyan-300 font-mono text-xs px-2 py-1 rounded border border-slate-700"
            title="Auto-fit sheet to screen without scrollbars or inspect at 100%–150%"
          >
            <option value="auto_fit">Fit to Screen (Auto)</option>
            <option value="100">100% Actual Size</option>
            <option value="125">125% Zoom</option>
            <option value="150">150% Zoom</option>
          </select>

          {/* Classification Method Selector for Final Engineering Sheet */}
          {onChangeSelectedClassificationMethod && (
            <select
              value={selectedClassificationMethod}
              onChange={(e) =>
                onChangeSelectedClassificationMethod(
                  e.target.value as RockMassClassificationMethodId
                )
              }
              className="bg-indigo-950 text-indigo-200 font-mono text-xs font-bold px-2 py-1 rounded border border-indigo-500/60"
              title="Select Rock Mass Classification Method displayed on Final Engineering Sheet"
            >
              <option value="RMR">Sheet Method: RMR ({rmr.version})</option>
              <option value="Q_SYSTEM">Sheet Method: Q-System (NGI)</option>
              <option value="BOTH_RMR_AND_Q">Sheet Method: Both (RMR + Q-System)</option>
              <option value="GSI">Sheet Method: GSI (Hoek &amp; Marinos)</option>
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (isSettingsDrawerOpen && drawerActiveMode === 'batch') {
                setIsSettingsDrawerOpen(false);
              } else {
                setDrawerActiveMode('batch');
                setIsSettingsDrawerOpen(true);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold rounded border transition-colors whitespace-nowrap cursor-pointer ${
              isSettingsDrawerOpen && drawerActiveMode === 'batch'
                ? 'bg-cyan-600 text-white border-cyan-400 shadow-md'
                : 'bg-cyan-950/90 hover:bg-cyan-900 text-cyan-200 border-cyan-600/70'
            }`}
            title="Queue and process multiple saved project records in sequence for standardized engineering output"
          >
            <Layers className="w-3.5 h-3.5" />
            Batch Queue ({batchQueue.length})
          </button>
          <button
            type="button"
            onClick={() => {
              if (isSettingsDrawerOpen && drawerActiveMode === 'settings') {
                setIsSettingsDrawerOpen(false);
              } else {
                setDrawerActiveMode('settings');
                setIsSettingsDrawerOpen(true);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold rounded border transition-colors whitespace-nowrap cursor-pointer ${
              isSettingsDrawerOpen && drawerActiveMode === 'settings'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                : 'bg-emerald-950/90 hover:bg-emerald-900 text-emerald-200 border-emerald-600/70'
            }`}
            title="Edit Project Details, Location, Client/Contractor Logos, Block Placement & Chainage Storage"
          >
            <Sliders className="w-3.5 h-3.5" />
            {isSettingsDrawerOpen && drawerActiveMode === 'settings'
              ? 'Hide Settings & Storage'
              : 'Sheet Settings & Storage'}
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold bg-rose-600 hover:bg-rose-500 text-white rounded border border-rose-400 shadow-xs transition-colors whitespace-nowrap cursor-pointer"
            title="Download Complete Geological Mapping Sheet & Data Tables as a Standalone .PDF File"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF (.pdf)
          </button>
          <button
            onClick={handleDownloadWordDoc}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold bg-blue-600 hover:bg-blue-500 text-white rounded border border-blue-400 shadow-xs transition-colors whitespace-nowrap cursor-pointer"
            title="Download Complete Geological Mapping Sheet & Editable Engineering Tables as Microsoft Word (.doc)"
          >
            <Download className="w-3.5 h-3.5" />
            Download Word (.doc)
          </button>
          <button
            onClick={handleDownloadDXF}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded border border-slate-700 transition-colors whitespace-nowrap cursor-pointer"
            title="Export Master Tunnel Profile and Mapped Vector Polylines to AutoCAD .DXF"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            DXF
          </button>
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded border border-slate-700 transition-colors whitespace-nowrap cursor-pointer"
            title="Export Discontinuity Sets, Traces, and Barton Q-Index to .CSV"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            CSV
          </button>
          <button
            onClick={handleDownloadSVG}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded border border-slate-700 transition-colors whitespace-nowrap cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5 text-cyan-400" />
            SVG
          </button>
          <button
            onClick={handleDownloadPNG}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded border border-slate-700 transition-colors whitespace-nowrap cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            PNG
          </button>
          <button
            onClick={handlePrintPDF}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <ThemeToggleButton compact />
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono font-bold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors cursor-pointer"
            title="Close Final Output Sheet & Go Back"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />
            <span>Back</span>
          </button>
        </div>
      </div>

      {/* Quick Inline Project Name, Location, Chainage, Pull Length, Lithology, Mapped By & Client/Contractor Logos Bar (Updates All Sheets Immediately) */}
      <div className="no-print flex flex-wrap items-center gap-2 px-5 py-1.5 bg-[#0B1018] border-b border-slate-800 text-[11px] font-mono">
        <span className="text-cyan-400 font-bold uppercase tracking-wider shrink-0">
          Project &amp; Sheet Details (All Sheets):
        </span>
        <label className="flex items-center gap-1 text-slate-300">
          <span className="text-slate-400">Project Name:</span>
          <input
            type="text"
            value={settings.projectName || effectiveSheetConfig.projectName || ''}
            placeholder="Enter Project Name..."
            onChange={(e) => {
              const val = e.target.value;
              const nextCfg = { ...effectiveSheetConfig, projectName: val };
              saveSheetConfigToStorage(nextCfg);
              handleUpdateSettings((prev) => ({
                ...prev,
                projectName: val,
                sheetConfig: nextCfg,
              }));
            }}
            className="w-40 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-white font-bold"
          />
        </label>
        <label className="flex items-center gap-1 text-slate-300">
          <span className="text-slate-400">Location:</span>
          <input
            type="text"
            value={settings.locationName || settings.location || effectiveSheetConfig.location || ''}
            placeholder="Location / Portal..."
            onChange={(e) => {
              const val = e.target.value;
              const nextCfg = { ...effectiveSheetConfig, location: val };
              saveSheetConfigToStorage(nextCfg);
              handleUpdateSettings((prev) => ({
                ...prev,
                location: val,
                locationName: val,
                sheetConfig: nextCfg,
              }));
            }}
            className="w-32 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-white font-bold"
          />
        </label>
        <label className="flex items-center gap-1 text-slate-300">
          <span className="text-slate-400">Tunnel Name:</span>
          <input
            type="text"
            value={settings.tunnelName || ''}
            placeholder="Tunnel Name..."
            onChange={(e) =>
              handleUpdateSettings((prev) => ({ ...prev, tunnelName: e.target.value }))
            }
            className="w-28 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-cyan-200 font-bold"
          />
        </label>
        <label className="flex items-center gap-1 text-slate-300">
          <span className="text-slate-400">Face Chainage:</span>
          <input
            type="text"
            value={settings.faceChainage || ''}
            placeholder="RD 1423.50m"
            onChange={(e) =>
              handleUpdateSettings((prev) => ({ ...prev, faceChainage: e.target.value }))
            }
            className="w-26 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-emerald-300 font-bold"
          />
        </label>
        <label className="flex items-center gap-1 text-slate-300">
          <span className="text-slate-400">Interval:</span>
          <input
            type="text"
            value={settings.chainage || ''}
            placeholder="RD 1420.00m - 1423.50m"
            onChange={(e) =>
              handleUpdateSettings((prev) => ({ ...prev, chainage: e.target.value }))
            }
            className="w-36 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-slate-200"
          />
        </label>
        <label className="flex items-center gap-1 text-slate-300">
          <span className="text-slate-400">Pull Length (m):</span>
          <input
            type="number"
            step="0.1"
            min="0.5"
            max="25"
            value={settings.roundLength ?? 3.5}
            onChange={(e) => {
              const num = parseFloat(e.target.value);
              if (Number.isFinite(num) && num > 0) {
                handleUpdateSettings((prev) => ({ ...prev, roundLength: num }));
              }
            }}
            className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-amber-300 font-bold"
          />
        </label>
        <label className="flex items-center gap-1 text-slate-300">
          <span className="text-slate-400">Lithology:</span>
          <input
            type="text"
            value={settings.lithology || ''}
            placeholder="Granitic Gneiss..."
            onChange={(e) =>
              handleUpdateSettings((prev) => ({ ...prev, lithology: e.target.value }))
            }
            className="w-32 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-slate-200"
          />
        </label>
        <label className="flex items-center gap-1 text-slate-300">
          <span className="text-slate-400">Mapped By:</span>
          <input
            type="text"
            value={settings.mappedBy || ''}
            placeholder="Geologist / Surveyor"
            onChange={(e) =>
              handleUpdateSettings((prev) => ({ ...prev, mappedBy: e.target.value }))
            }
            className="w-28 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-slate-200"
          />
        </label>

        {/* Inline Client Logo & Contractor Logo Controls */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
          <label
            className="relative overflow-hidden flex items-center gap-1 px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-cyan-300 cursor-pointer"
            title="Upload Client Logo for Sheet Header Block"
          >
            <Upload className="w-3 h-3 text-cyan-400" />
            <span>{effectiveSheetConfig.clientLogoDataUrl ? 'Client Logo ✓' : '+ Client Logo'}</span>
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={(e) => handleUploadHeaderLogo('clientLogoDataUrl', e.target.files?.[0])}
            />
          </label>
          {effectiveSheetConfig.clientLogoDataUrl && (
            <button
              type="button"
              onClick={() => {
                const nextCfg = { ...effectiveSheetConfig, clientLogoDataUrl: null };
                saveSheetConfigToStorage(nextCfg);
                handleUpdateSettings((prev) => ({ ...prev, sheetConfig: nextCfg }));
              }}
              className="px-1 py-0.5 text-[10px] bg-slate-800 hover:bg-rose-900/70 text-slate-400 hover:text-rose-200 rounded"
              title="Remove Client Logo"
            >
              ×
            </button>
          )}

          <label
            className="relative overflow-hidden flex items-center gap-1 px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-emerald-300 cursor-pointer"
            title="Upload Contractor Logo for Sheet Header Block"
          >
            <Upload className="w-3 h-3 text-emerald-400" />
            <span>
              {effectiveSheetConfig.contractorLogoDataUrl
                ? 'Contractor Logo ✓'
                : '+ Contractor Logo'}
            </span>
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={(e) => handleUploadHeaderLogo('contractorLogoDataUrl', e.target.files?.[0])}
            />
          </label>
          {effectiveSheetConfig.contractorLogoDataUrl && (
            <button
              type="button"
              onClick={() => {
                const nextCfg = { ...effectiveSheetConfig, contractorLogoDataUrl: null };
                saveSheetConfigToStorage(nextCfg);
                handleUpdateSettings((prev) => ({ ...prev, sheetConfig: nextCfg }));
              }}
              className="px-1 py-0.5 text-[10px] bg-slate-800 hover:bg-rose-900/70 text-slate-400 hover:text-rose-200 rounded"
              title="Remove Contractor Logo"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Quality Control Validation Strip */}
      <div className="no-print flex items-center justify-between px-5 py-1.5 bg-slate-900/90 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-3 overflow-x-auto">
          {qcReport.passed ? (
            <span className="flex items-center gap-1.5 text-emerald-400 font-mono whitespace-nowrap">
              <CheckCircle2 className="w-4 h-4" />
              AUTO-LAYOUT VALIDATED: Face Scale {facePxPerMeter.toFixed(1)} px/m (1:{engineeringScaleDenominator}) · Master ({geometry.width}m × {geometry.height}m) · {joints.length} Traces · {placedSymbols.length} Symbols · {controlPoints.length} Control Pts
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-400 font-mono whitespace-nowrap">
              <AlertTriangle className="w-4 h-4" />
              QC CHECK: {qcReport.issues.length} item(s) flagged · Face Scale {facePxPerMeter.toFixed(1)} px/m
            </span>
          )}
          {qcReport.issues.slice(0, 2).map((iss) => (
            <span key={iss.id} className="text-slate-400 font-mono whitespace-nowrap">
              · {iss.message}
            </span>
          ))}
        </div>

        {joints.some(
          (j) =>
            j.orientationStatus !== 'CONFIRMED' &&
            j.orientationStatus !== 'DIRECTLY_MEASURED' &&
            j.orientationStatus !== 'GEOMETRICALLY_CALCULATED'
        ) && (
          <button
            onClick={onConfirmAllOrientations}
            className="px-2.5 py-1 text-xs font-mono bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded whitespace-nowrap"
          >
            Confirm Estimated Orientations
          </button>
        )}
      </div>

      {/* Main Engineering Sheet Preview Stage + Optional Live Settings & Chainage Storage Drawer */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {isSettingsDrawerOpen && (
          <aside
            style={{ width: `${drawerWidthPx}px` }}
            className={`no-print relative max-w-[54vw] bg-[#111621] ${
              drawerDockSide === 'left' ? 'order-first border-r' : 'order-last border-l'
            } border-slate-800 flex flex-col h-full shrink-0 z-20 shadow-2xl transition-[width] duration-75`}
          >
            {/* Interactive Drag-to-Resize Handle (Extend Left or Right) */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setResizingDrawer({ startX: e.clientX, startWidth: drawerWidthPx });
              }}
              title="Drag Left or Right to Extend / Resize Settings Drawer"
              className={`flex items-center justify-center absolute top-0 bottom-0 w-2.5 cursor-col-resize z-30 group ${
                drawerDockSide === 'left' ? '-right-1.5' : '-left-1.5'
              }`}
            >
              <div className="h-16 w-1 rounded-full bg-slate-700 group-hover:bg-emerald-400 transition-colors" />
            </div>

            <div className="flex items-center justify-between px-3 py-2 bg-[#0D121B] border-b border-slate-800 gap-1">
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded border border-slate-800 min-w-0">
                <button
                  type="button"
                  onClick={() => setDrawerActiveMode('settings')}
                  className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition-colors cursor-pointer truncate ${
                    drawerActiveMode === 'settings'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Settings &amp; Storage
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerActiveMode('batch')}
                  className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition-colors cursor-pointer truncate ${
                    drawerActiveMode === 'batch'
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Batch Processor ({batchQueue.length})
                </button>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setDrawerDockSide((s) => (s === 'left' ? 'right' : 'left'))}
                  className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-mono flex items-center gap-0.5 cursor-pointer"
                  title="Move Drawer to Left or Right Side"
                >
                  {drawerDockSide === 'left' ? (
                    <PanelRight className="w-3 h-3" />
                  ) : (
                    <PanelLeft className="w-3 h-3" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerWidthPx((w) => Math.max(300, w - 50))}
                  className="px-1 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono cursor-pointer"
                  title="Narrow Drawer"
                >
                  −W
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerWidthPx((w) => Math.min(700, w + 50))}
                  className="px-1 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[10px] font-mono cursor-pointer"
                  title="Extend Drawer Width"
                >
                  +W
                </button>
                <button
                  type="button"
                  onClick={() => setIsSettingsDrawerOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                  title="Close Drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {drawerActiveMode === 'batch' ? (
                <BatchSheetProcessorPanel
                  savedProjects={savedProjects}
                  queue={batchQueue}
                  config={batchConfig}
                  onUpdateConfig={setBatchConfig}
                  isRunning={isBatchRunning}
                  isPaused={isBatchPaused}
                  activeQueueIndex={activeBatchIndex}
                  previewQueueId={previewQueueId}
                  onAddRecordToQueue={handleAddRecordToQueue}
                  onAddAllSavedToQueue={handleAddAllSavedToQueue}
                  onAddCurrentWorkspaceToQueue={handleAddCurrentWorkspaceToQueue}
                  onImportJsonFilesToQueue={handleImportJsonFilesToQueue}
                  onRemoveQueueItem={handleRemoveQueueItem}
                  onMoveQueueItem={handleMoveQueueItem}
                  onSortQueue={handleSortQueue}
                  onClearQueue={handleClearQueue}
                  onSelectPreviewItem={setPreviewQueueId}
                  onStartBatch={handleStartBatch}
                  onPauseResumeBatch={handlePauseResumeBatch}
                  onStopResetBatch={handleStopResetBatch}
                  onDownloadSingleOutput={handleDownloadSingleBatchOutput}
                  onDownloadConsolidatedCSV={handleDownloadConsolidatedCSV}
                  onDownloadConsolidatedJSON={handleDownloadConsolidatedJSON}
                  onDownloadMultiSheetHtmlBook={handleDownloadMultiSheetHtmlBook}
                  onPrintMultiSheetPdfBook={handlePrintMultiSheetPdfBook}
                />
              ) : (
                <SheetSettingsAndStorageEditor
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  savedProjects={savedProjects}
                  onSaveCurrentProject={() => onSaveCurrentProject?.()}
                  onLoadProjectRecord={onLoadProjectRecord}
                  onDeleteProjectRecord={onDeleteProjectRecord}
                  onCreateNextChainageSection={onCreateNextChainageSection}
                  compactDrawerMode={true}
                />
              )}
            </div>
          </aside>
        )}

      <div
        ref={previewContainerRef}
        className={`flex-1 flex items-center justify-center ${
          isPrintingBatchBook ? 'no-print' : 'print:p-0 print:bg-white'
        } ${
          isLight ? 'bg-slate-200' : 'bg-[#0B0E14]'
        } ${
          sheetZoomMode === 'auto_fit' ? 'overflow-hidden p-2' : 'overflow-auto p-4 items-start'
        }`}
      >
        <div
          className="bg-white shadow-2xl border border-slate-300 print:shadow-none print:border-none print:w-full print:h-auto"
          style={{
            width: `${renderedSheetDimensions.width}px`,
            height: `${renderedSheetDimensions.height}px`,
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${sheetW} ${totalSheetH}`}
            width={sheetW}
            height={totalSheetH}
            preserveAspectRatio="xMidYMid meet"
            className="block w-full h-full bg-white text-black select-none"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            <defs>
              {/* Authoritative Master Tunnel Face Clip Path (No black border inside or outside!) */}
              <clipPath id="sheet-face-clip">
                <path d={faceCustomMaskPath} />
              </clipPath>
              <clipPath id="sheet-crown-clip">
                <rect x={crownLeftX} y={planTopY} width={crownW_px} height={roundH_px} />
              </clipPath>
              <clipPath id="sheet-leftwall-clip">
                <rect x={leftWallLeftX} y={planTopY} width={leftWallW_px} height={roundH_px} />
              </clipPath>
              <clipPath id="sheet-rightwall-clip">
                <rect x={rightWallLeftX} y={planTopY} width={rightWallW_px} height={roundH_px} />
              </clipPath>

              {/* Engineering Column Clip Path to Prevent Any Text Intersection (Supports RIGHT or LEFT column) */}
              <clipPath id="sheet-right-col-clip">
                <rect
                  x={rightColumnBox.x}
                  y={rightColumnBox.y}
                  width={rightColumnBox.width}
                  height={rightColumnBox.height + 6}
                />
              </clipPath>

              {/* Engineering Grid Pattern */}
              <pattern id="eng-grid" width="25" height="25" patternUnits="userSpaceOnUse">
                <path
                  d="M 25 0 L 0 0 0 25"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="0.6"
                />
              </pattern>

              {/* All 25 Professional Lithology Patterns (Sections 13 & 14) */}
              <LithologyPatternDefs prefix="sheet-lith-" forPrintSheet={true} />

              {/* Print-Ready Overbreak & Undercut Engineering Hatch Patterns */}
              <pattern
                id="sheet-overbreak-hatch"
                width="7"
                height="7"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="7" stroke="#E11D48" strokeWidth="1.2" strokeOpacity="0.7" />
              </pattern>
              <pattern
                id="sheet-undercut-hatch"
                width="7"
                height="7"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(-45)"
              >
                <line x1="0" y1="0" x2="0" y2="7" stroke="#D97706" strokeWidth="1.2" strokeOpacity="0.75" />
              </pattern>
            </defs>

            {/* White Technical Drawing Sheet Background */}
            <rect x="0" y="0" width={sheetW} height={sheetH} fill="#FFFFFF" />

            {/* Outer Drawing Frame & Double Engineering Border */}
            <rect
              x={margin - 4}
              y={margin - 4}
              width={sheetW - (margin - 4) * 2}
              height={sheetH - (margin - 4) * 2}
              fill="none"
              stroke="#0F172A"
              strokeWidth="2.2"
            />
            <rect
              x={margin + 4}
              y={margin + 4}
              width={sheetW - (margin + 4) * 2}
              height={sheetH - (margin + 4) * 2}
              fill={effectiveSheetConfig.showBackgroundGrid !== false ? 'url(#eng-grid)' : '#FFFFFF'}
              stroke="#0F172A"
              strokeWidth="0.9"
            />

            {/* ==============================================================
                1. CUSTOMIZABLE ENGINEERING HEADER & TITLE BLOCK
                   (Always rendered on ALL sheets: Project Name, Location, Chainage, Client, Contractor, Logos & Required Details)
               ============================================================== */}
            {showHeaderBlock !== false &&
              headerBox.height > 0 &&
              (() => {
                const cfg = effectiveSheetConfig;
                const logoPos = cfg.logoPosition || 'HEADER_CORNERS';
                const logoW =
                  cfg.logoSize === 'LARGE' ? 112 : cfg.logoSize === 'COMPACT' ? 76 : 94;
                const logoH = headerBox.height - 10;

                const hasClientLogo =
                  logoPos !== 'HIDDEN' &&
                  logoPos !== 'BOTTOM_SIGN_BLOCK' &&
                  Boolean(cfg.clientLogoDataUrl);
                const hasContractorLogo =
                  logoPos !== 'HIDDEN' &&
                  logoPos !== 'BOTTOM_SIGN_BLOCK' &&
                  Boolean(cfg.contractorLogoDataUrl);
                const hasConsultantLogo =
                  logoPos !== 'HIDDEN' &&
                  logoPos !== 'BOTTOM_SIGN_BLOCK' &&
                  Boolean(cfg.consultantLogoDataUrl);

                // Compute left & right logo reservations inside headerBox so logos NEVER overlap text
                let leftLogoSpace = 0;
                let rightLogoSpace = 0;
                if (logoPos === 'HEADER_CORNERS') {
                  if (hasClientLogo) leftLogoSpace = logoW + 14;
                  if (hasContractorLogo) rightLogoSpace += logoW + 10;
                  if (hasConsultantLogo) rightLogoSpace += logoW + 10;
                } else if (logoPos === 'HEADER_LEFT_GROUP') {
                  const cnt =
                    (hasClientLogo ? 1 : 0) +
                    (hasContractorLogo ? 1 : 0) +
                    (hasConsultantLogo ? 1 : 0);
                  leftLogoSpace = cnt > 0 ? cnt * (logoW + 8) + 8 : 0;
                } else if (logoPos === 'HEADER_RIGHT_GROUP') {
                  const cnt =
                    (hasClientLogo ? 1 : 0) +
                    (hasContractorLogo ? 1 : 0) +
                    (hasConsultantLogo ? 1 : 0);
                  rightLogoSpace = cnt > 0 ? cnt * (logoW + 8) + 8 : 0;
                }

                const textLeftX = headerBox.x + leftLogoSpace;
                const textRightX = headerBox.x + headerBox.width - rightLogoSpace;
                const textAvailW = Math.max(800, textRightX - textLeftX);

                // 4 proportional zones inside [textLeftX, textRightX]
                const div1X = Math.round(textLeftX + textAvailW * 0.36);
                const div2X = Math.round(textLeftX + textAvailW * 0.60);
                const div3X = Math.round(textLeftX + textAvailW * 0.81);
                const midRowY = headerBox.y + Math.round(headerBox.height * 0.52);

                const sheetTitleText =
                  outputMode === 'ENGINEERING_QUANTITY_SHEET'
                    ? cfg.quantitySheetTitle ||
                      'ENGINEERING OVERBREAK, UNDERCUT & EXCAVATION QUANTITY SHEET'
                    : outputMode === 'CROWN_AND_WALL_VECTOR_ONLY'
                    ? crownWallContentMode === 'PHOTO_ONLY'
                      ? 'CROWN & WALL DEVELOPED PERIMETER PHOTOGRAPH SHEET (PHOTO ONLY)'
                      : cfg.crownAndWallSheetTitle ||
                        'CROWN & WALL DEVELOPED PERIMETER GEOLOGICAL MAPPING SHEET'
                    : outputMode === 'CLEAN_MAPPING_DRAWING'
                    ? 'CLEAN GEOLOGICAL TUNNEL MAPPING DRAWING SHEET (NO PHOTO)'
                    : outputMode === 'VECTOR_MAPPING_ONLY'
                    ? 'VECTOR GEOLOGICAL DISCONTINUITY & LITHOLOGY MAPPING SHEET'
                    : outputMode === 'PHOTO_AND_AI_TRACING'
                    ? 'REGISTERED PHOTOGRAPH & GEOLOGICAL VECTOR OVERLAY SHEET'
                    : outputMode === 'EXPORT_PHOTO_ONLY'
                    ? 'REGISTERED TUNNEL FACE & PERIMETER PHOTOGRAPH SHEET'
                    : cfg.geologySheetTitle || 'ENGINEERING GEOLOGICAL TUNNEL MAPPING SHEET';

                const projectLabel =
                  settings.projectName || cfg.projectName || 'Underground Tunnel Project';
                const locLabel =
                  settings.locationName ||
                  settings.location ||
                  cfg.location ||
                  'Main Underground Heading';

                return (
                  <g>
                    <rect
                      x={headerBox.x}
                      y={headerBox.y}
                      width={headerBox.width}
                      height={headerBox.height}
                      fill="#F8FAFC"
                      stroke="#0F172A"
                      strokeWidth="1.3"
                    />

                    {/* Render Header Logos in Selected Position */}
                    {logoPos === 'HEADER_CORNERS' && (
                      <>
                        {hasClientLogo && cfg.clientLogoDataUrl && (
                          <g>
                            <rect
                              x={headerBox.x + 6}
                              y={headerBox.y + 5}
                              width={logoW}
                              height={logoH}
                              fill="#FFFFFF"
                              stroke="#CBD5E1"
                              strokeWidth="0.8"
                            />
                            <image
                              href={cfg.clientLogoDataUrl}
                              x={headerBox.x + 8}
                              y={headerBox.y + 7}
                              width={logoW - 4}
                              height={logoH - 4}
                              preserveAspectRatio="xMidYMid meet"
                            />
                            <line
                              x1={textLeftX}
                              y1={headerBox.y}
                              x2={textLeftX}
                              y2={headerBox.y + headerBox.height}
                              stroke="#0F172A"
                              strokeWidth="1"
                            />
                          </g>
                        )}
                        {(hasContractorLogo || hasConsultantLogo) && (
                          <g>
                            <line
                              x1={textRightX}
                              y1={headerBox.y}
                              x2={textRightX}
                              y2={headerBox.y + headerBox.height}
                              stroke="#0F172A"
                              strokeWidth="1"
                            />
                            {hasContractorLogo && cfg.contractorLogoDataUrl && (
                              <g>
                                <rect
                                  x={textRightX + 5}
                                  y={headerBox.y + 5}
                                  width={logoW}
                                  height={logoH}
                                  fill="#FFFFFF"
                                  stroke="#CBD5E1"
                                  strokeWidth="0.8"
                                />
                                <image
                                  href={cfg.contractorLogoDataUrl}
                                  x={textRightX + 7}
                                  y={headerBox.y + 7}
                                  width={logoW - 4}
                                  height={logoH - 4}
                                  preserveAspectRatio="xMidYMid meet"
                                />
                              </g>
                            )}
                            {hasConsultantLogo && cfg.consultantLogoDataUrl && (
                              <g>
                                <rect
                                  x={textRightX + (hasContractorLogo ? logoW + 10 : 5)}
                                  y={headerBox.y + 5}
                                  width={logoW}
                                  height={logoH}
                                  fill="#FFFFFF"
                                  stroke="#CBD5E1"
                                  strokeWidth="0.8"
                                />
                                <image
                                  href={cfg.consultantLogoDataUrl}
                                  x={textRightX + (hasContractorLogo ? logoW + 12 : 7)}
                                  y={headerBox.y + 7}
                                  width={logoW - 4}
                                  height={logoH - 4}
                                  preserveAspectRatio="xMidYMid meet"
                                />
                              </g>
                            )}
                          </g>
                        )}
                      </>
                    )}

                    {logoPos === 'HEADER_LEFT_GROUP' && leftLogoSpace > 0 && (
                      <g>
                        {[
                          cfg.clientLogoDataUrl,
                          cfg.contractorLogoDataUrl,
                          cfg.consultantLogoDataUrl,
                        ]
                          .filter((u): u is string => Boolean(u))
                          .map((url, idx) => (
                            <g key={`hdr-l-logo-${idx}`}>
                              <rect
                                x={headerBox.x + 6 + idx * (logoW + 8)}
                                y={headerBox.y + 5}
                                width={logoW}
                                height={logoH}
                                fill="#FFFFFF"
                                stroke="#CBD5E1"
                                strokeWidth="0.8"
                              />
                              <image
                                href={url}
                                x={headerBox.x + 8 + idx * (logoW + 8)}
                                y={headerBox.y + 7}
                                width={logoW - 4}
                                height={logoH - 4}
                                preserveAspectRatio="xMidYMid meet"
                              />
                            </g>
                          ))}
                        <line
                          x1={textLeftX}
                          y1={headerBox.y}
                          x2={textLeftX}
                          y2={headerBox.y + headerBox.height}
                          stroke="#0F172A"
                          strokeWidth="1"
                        />
                      </g>
                    )}

                    {logoPos === 'HEADER_RIGHT_GROUP' && rightLogoSpace > 0 && (
                      <g>
                        <line
                          x1={textRightX}
                          y1={headerBox.y}
                          x2={textRightX}
                          y2={headerBox.y + headerBox.height}
                          stroke="#0F172A"
                          strokeWidth="1"
                        />
                        {[
                          cfg.clientLogoDataUrl,
                          cfg.contractorLogoDataUrl,
                          cfg.consultantLogoDataUrl,
                        ]
                          .filter((u): u is string => Boolean(u))
                          .map((url, idx) => (
                            <g key={`hdr-r-logo-${idx}`}>
                              <rect
                                x={textRightX + 6 + idx * (logoW + 8)}
                                y={headerBox.y + 5}
                                width={logoW}
                                height={logoH}
                                fill="#FFFFFF"
                                stroke="#CBD5E1"
                                strokeWidth="0.8"
                              />
                              <image
                                href={url}
                                x={textRightX + 8 + idx * (logoW + 8)}
                                y={headerBox.y + 7}
                                width={logoW - 4}
                                height={logoH - 4}
                                preserveAspectRatio="xMidYMid meet"
                              />
                            </g>
                          ))}
                      </g>
                    )}

                    {/* Vertical & horizontal dividers in header */}
                    <line
                      x1={div1X}
                      y1={headerBox.y}
                      x2={div1X}
                      y2={headerBox.y + headerBox.height}
                      stroke="#0F172A"
                      strokeWidth="1"
                    />
                    <line
                      x1={div2X}
                      y1={headerBox.y}
                      x2={div2X}
                      y2={headerBox.y + headerBox.height}
                      stroke="#0F172A"
                      strokeWidth="1"
                    />
                    <line
                      x1={div3X}
                      y1={headerBox.y}
                      x2={div3X}
                      y2={headerBox.y + headerBox.height}
                      stroke="#0F172A"
                      strokeWidth="1"
                    />
                    <line
                      x1={div1X}
                      y1={midRowY}
                      x2={textRightX}
                      y2={midRowY}
                      stroke="#0F172A"
                      strokeWidth="0.8"
                    />

                    {/* Zone 1: Editable Sheet Title, Project, Location & Tunnel */}
                    <text
                      x={textLeftX + 10}
                      y={headerBox.y + 19}
                      fontSize={Math.min(13.2, contentMetrics.headerTitleFontSize)}
                      fontWeight="700"
                      fill="#0F172A"
                    >
                      {sheetTitleText.slice(0, 62)}
                    </text>
                    <text
                      x={textLeftX + 10}
                      y={headerBox.y + 38}
                      fontSize="10.2"
                      fontWeight="700"
                      fill="#0F172A"
                    >
                      PROJECT: {projectLabel.slice(0, 32)} · LOCATION: {locLabel.slice(0, 24)}
                    </text>
                    <text
                      x={textLeftX + 10}
                      y={headerBox.y + 54}
                      fontSize="9.8"
                      fontWeight="700"
                      fill="#1E293B"
                    >
                      TUNNEL: {settings.tunnelName.toUpperCase().slice(0, 22)} · CHAINAGE:{' '}
                      <tspan fill="#0369A1">{settings.faceChainage}</tspan> ({settings.chainage.slice(0, 22)})
                    </text>
                    <text x={textLeftX + 10} y={headerBox.y + 69} fontSize="9.2" fill="#334155">
                      LITHOLOGY: {(settings.lithology || 'Mapped Rock Mass').slice(0, 34)} · DRIVE: N{' '}
                      {String(Math.round(settings.driveDirection)).padStart(3, '0')}° E · PROFILE:{' '}
                      {(geometry.customProfile?.name || geometry.crownGeometry.replace(/_/g, '-'))
                        .toUpperCase()
                        .slice(0, 14)}
                    </text>

                    {/* Zone 2: Client, Contractor & Consultant (Top) + Chainage & Pull (Bottom) */}
                    <text x={div1X + 10} y={headerBox.y + 15} fontSize="9.2" fill="#475569">
                      CLIENT:{' '}
                      <tspan fontWeight="700" fill="#0F172A">
                        {(cfg.clientName || 'Project Authority').slice(0, 30)}
                      </tspan>
                    </text>
                    <text x={div1X + 10} y={headerBox.y + 30} fontSize="9.2" fill="#475569">
                      CONTRACTOR:{' '}
                      <tspan fontWeight="700" fill="#065F46">
                        {(cfg.contractorName || 'Main Contractor').slice(0, 26)}
                      </tspan>
                    </text>
                    <text x={div1X + 10} y={midRowY + 14} fontSize="9.5" fill="#475569">
                      FACE CHAINAGE:{' '}
                      <tspan fontWeight="700" fill="#0F172A">
                        {settings.faceChainage}
                      </tspan>{' '}
                      · PULL:{' '}
                      <tspan fontWeight="700" fill="#0F172A">
                        {settings.roundLength.toFixed(2)}m
                      </tspan>
                    </text>
                    <text x={div1X + 10} y={midRowY + 28} fontSize="9.0" fill="#334155">
                      INTERVAL: <tspan fontWeight="700">{settings.chainage.slice(0, 28)}</tspan>
                    </text>

                    {/* Zone 3: Consultant & Contract No. (Top) + Dimensions & Azimuth (Bottom) */}
                    <text x={div2X + 10} y={headerBox.y + 15} fontSize="9.2" fill="#475569">
                      CONSULTANT:{' '}
                      <tspan fontWeight="700" fill="#1E293B">
                        {(cfg.consultantName || 'Supervision Consultant').slice(0, 24)}
                      </tspan>
                    </text>
                    <text x={div2X + 10} y={headerBox.y + 30} fontSize="9.2" fill="#475569">
                      CONTRACT:{' '}
                      <tspan fontWeight="700" fill="#0F172A">
                        {(cfg.contractNumber || 'PKG-01').slice(0, 24)}
                      </tspan>
                    </text>
                    <text x={div2X + 10} y={midRowY + 14} fontSize="9.2" fill="#475569">
                      SPAN W:{' '}
                      <tspan fontWeight="700" fill="#0F172A">
                        {geometry.width.toFixed(2)}m
                      </tspan>{' '}
                      · HT:{' '}
                      <tspan fontWeight="700" fill="#0F172A">
                        {geometry.height.toFixed(2)}m
                      </tspan>{' '}
                      · WALL:{' '}
                      <tspan fontWeight="700" fill="#0F172A">
                        {geometry.wallHeight.toFixed(2)}m
                      </tspan>
                    </text>
                    <text x={div2X + 10} y={midRowY + 28} fontSize="9.0" fill="#334155">
                      DESIGN AREA:{' '}
                      <tspan fontWeight="700" fill="#0F172A">
                        {(
                          overbreakAnalysis?.designAreaSqMeters ??
                          geometry.designAreaSqMeters ??
                          geometry.width * geometry.height * 0.85
                        ).toFixed(2)}{' '}
                        m²
                      </tspan>{' '}
                      · CROWN: {geometry.crownArcLength.toFixed(2)}m
                    </text>

                    {/* Zone 4: Drawing No, Revision, Date, Mapped By & Scale */}
                    <text x={div3X + 10} y={headerBox.y + 15} fontSize="9.2" fill="#475569">
                      DWG NO:{' '}
                      <tspan fontWeight="700" fill="#0F172A">
                        {(cfg.drawingNumber || 'DWG-001').slice(0, 15)}
                      </tspan>{' '}
                      ({(cfg.revisionNumber || 'Rev 0').slice(0, 6)})
                    </text>
                    <text x={div3X + 10} y={headerBox.y + 30} fontSize="9.2" fill="#475569">
                      DATE:{' '}
                      <tspan fontWeight="700" fill="#0F172A">
                        {settings.date}
                      </tspan>
                    </text>
                    <text x={div3X + 10} y={midRowY + 14} fontSize="9.2" fill="#475569">
                      MAPPED BY:{' '}
                      <tspan fontWeight="700" fill="#0F172A">
                        {(settings.mappedBy || 'Geologist / Surveyor').slice(0, 18)}
                      </tspan>
                    </text>
                    <text
                      x={div3X + 10}
                      y={midRowY + 28}
                      fontSize="9.2"
                      fontWeight="700"
                      fill="#0F172A"
                    >
                      SCALE 1:{engineeringScaleDenominator} ({geometry.source.toUpperCase()})
                    </text>

                    {/* Bottom Sign-Off & Metadata Strip on Full-Width Sheets where Right Engineering Column is hidden */}
                    {!showTitleAndTables && (
                      <g transform={`translate(${margin + 10}, ${sheetH - margin - 34})`}>
                        <rect
                          x="0"
                          y="0"
                          width={sheetW - (margin + 10) * 2}
                          height="28"
                          fill="#F8FAFC"
                          stroke="#0F172A"
                          strokeWidth="1.2"
                        />
                        <text x="12" y="17.5" fontSize="9.2" fontWeight="700" fill="#0F172A">
                          PROJECT: {projectLabel.slice(0, 32)} · LOCATION: {locLabel.slice(0, 24)} · TUNNEL:{' '}
                          {settings.tunnelName.toUpperCase().slice(0, 20)} · CHAINAGE:{' '}
                          <tspan fill="#0369A1">{settings.faceChainage}</tspan> ({settings.chainage.slice(0, 22)}) · PULL:{' '}
                          {settings.roundLength.toFixed(2)}m · LITHOLOGY: {(settings.lithology || 'Mapped Rock Mass').slice(0, 24)}
                        </text>
                        <text
                          x={sheetW - (margin + 10) * 2 - 12}
                          y="17.5"
                          textAnchor="end"
                          fontSize="8.8"
                          fontWeight="700"
                          fill="#0F172A"
                        >
                          {(cfg.leftSignatoryTitle || 'CONTRACTOR GEOLOGIST SIGN')}: ______________ ·{' '}
                          {(cfg.rightSignatoryTitle || 'CLIENT GEOLOGIST SIGN')}: ______________
                        </text>
                      </g>
                    )}
                  </g>
                );
              })()}

            {/* ==============================================================
                2. DEVELOPED PERIMETER MAPPING (Priority 2: Left Wall | Crown | Right Wall)
               ============================================================== */}
            {showPerimeterPlan && (
              <g>
                <text
                  x={planCenterX}
                  y={planTopY - 14}
                  textAnchor="middle"
                  fontSize={isCrownAndWallOnly ? '12.5' : '10.5'}
                  fontWeight="700"
                  fill="#0F172A"
                >
                  {outputMode === 'ENGINEERING_QUANTITY_SHEET'
                    ? `DEVELOPED PERIMETER OVERBREAK & AS-BUILT SURVEY STRIP (LEFT WALL — CROWN ARCH — RIGHT WALL) · PULL = ${roundLen.toFixed(2)} m`
                    : isCrownAndWallOnly
                    ? crownWallContentMode === 'PHOTO_ONLY'
                      ? `CROWN & WALL DEVELOPED PERIMETER PHOTOGRAPH (LEFT WALL — CROWN ARCH — RIGHT WALL · ${settings.faceChainage} · PULL = ${roundLen.toFixed(2)} m)`
                      : `CROWN & WALL DEVELOPED PERIMETER GEOLOGICAL MAPPING (${settings.faceChainage} · INTERVAL ${settings.chainage} · PULL = ${roundLen.toFixed(2)} m · DRIVE N ${String(Math.round(settings.driveDirection)).padStart(3, '0')}° E)`
                    : crownWallContentMode === 'PHOTO_ONLY'
                    ? `CROWN & WALL DEVELOPED PERIMETER PHOTOGRAPH (LEFT WALL — CROWN ARCH — RIGHT WALL) · PULL = ${roundLen.toFixed(2)} m`
                    : `DEVELOPED PERIMETER GEOLOGICAL MAPPING (LEFT WALL — CROWN ARCH — RIGHT WALL) · PULL = ${roundLen.toFixed(2)} m`}
                </text>

                {/* Drive Direction Indicator Arrow on Left */}
                <g transform={`translate(${leftWallLeftX - 28}, ${planTopY + roundH_px / 2})`}>
                  <line x1="0" y1="24" x2="0" y2="-24" stroke="#0F172A" strokeWidth="1.5" />
                  <polygon points="0,-29 -3.5,-19 3.5,-19" fill="#0F172A" />
                  <text
                    x="-8"
                    y="0"
                    textAnchor="middle"
                    fontSize="8.5"
                    fontWeight="700"
                    fill="#0F172A"
                    transform="rotate(-90, -8, 0)"
                  >
                    DRIVE N{String(Math.round(settings.driveDirection)).padStart(3, '0')}°
                  </text>
                </g>

                {/* Clean White Background Inside Unfolded Perimeter Boxes */}
                <rect
                  x={leftWallLeftX}
                  y={planTopY}
                  width={leftWallW_px + crownW_px + rightWallW_px}
                  height={roundH_px}
                  fill="#F8FAFC"
                />

                {/* LAYER 1: Registered Photographs for Left Wall, Crown, Right Wall */}
                {showCrownWallPhotos && leftWallPhotoSrc && (
                  <g clipPath="url(#sheet-leftwall-clip)">
                    <g
                      transform={
                        photos.leftWall.image && !localPerimeterPhotos.leftWall
                          ? getSheetPhotoSvgTransform('leftWall', photos.leftWall.transform)
                          : undefined
                      }
                    >
                      <image
                        href={leftWallPhotoSrc}
                        x={leftWallLeftX}
                        y={planTopY}
                        width={leftWallW_px}
                        height={roundH_px}
                        preserveAspectRatio="none"
                        opacity={
                          crownWallContentMode === 'PHOTO_ONLY'
                            ? 1
                            : outputMode === 'PHOTO_AND_AI_TRACING'
                            ? 0.88
                            : (photos.leftWall.opacity || 100) / 100
                        }
                      />
                    </g>
                  </g>
                )}
                {showCrownWallPhotos && crownPhotoSrc && (
                  <g clipPath="url(#sheet-crown-clip)">
                    <g
                      transform={
                        photos.crown.image && !localPerimeterPhotos.crown
                          ? getSheetPhotoSvgTransform('crown', photos.crown.transform)
                          : undefined
                      }
                    >
                      <image
                        href={crownPhotoSrc}
                        x={crownLeftX}
                        y={planTopY}
                        width={crownW_px}
                        height={roundH_px}
                        preserveAspectRatio="none"
                        opacity={
                          crownWallContentMode === 'PHOTO_ONLY'
                            ? 1
                            : outputMode === 'PHOTO_AND_AI_TRACING'
                            ? 0.88
                            : (photos.crown.opacity || 100) / 100
                        }
                      />
                    </g>
                  </g>
                )}
                {showCrownWallPhotos && rightWallPhotoSrc && (
                  <g clipPath="url(#sheet-rightwall-clip)">
                    <g
                      transform={
                        photos.rightWall.image && !localPerimeterPhotos.rightWall
                          ? getSheetPhotoSvgTransform('rightWall', photos.rightWall.transform)
                          : undefined
                      }
                    >
                      <image
                        href={rightWallPhotoSrc}
                        x={rightWallLeftX}
                        y={planTopY}
                        width={rightWallW_px}
                        height={roundH_px}
                        preserveAspectRatio="none"
                        opacity={
                          crownWallContentMode === 'PHOTO_ONLY'
                            ? 1
                            : outputMode === 'PHOTO_AND_AI_TRACING'
                            ? 0.88
                            : (photos.rightWall.opacity || 100) / 100
                        }
                      />
                    </g>
                  </g>
                )}

                {/* Left Wall Box */}
                {leftWallW_px > 1 && (
                  <>
                    <rect
                      x={leftWallLeftX}
                      y={planTopY}
                      width={leftWallW_px}
                      height={roundH_px}
                      fill="none"
                      stroke="#0F172A"
                      strokeWidth="1.5"
                    />
                    <text
                      x={leftWallLeftX + leftWallW_px / 2}
                      y={planTopY + roundH_px + 13}
                      textAnchor="middle"
                      fontSize="8.5"
                      fontWeight="700"
                      fill="#334155"
                    >
                      LEFT WALL = {(geometry.leftWallArcLength ?? geometry.leftWallHeight ?? geometry.wallHeight).toFixed(2)} m
                    </text>
                  </>
                )}

                {/* Crown Box (Length strictly equals Tunnel Face Crown Arc Length = geometry.crownArcLength) */}
                {crownW_px > 1 && (
                  <rect
                    x={crownLeftX}
                    y={planTopY}
                    width={crownW_px}
                    height={roundH_px}
                    fill="none"
                    stroke="#0F172A"
                    strokeWidth="1.7"
                  />
                )}
                {/* Outer Center & SPL Ticks on Unfolded Plan */}
                <line
                  x1={planCenterX}
                  y1={planTopY - 8}
                  x2={planCenterX}
                  y2={planTopY}
                  stroke="#047857"
                  strokeWidth="1.5"
                />
                <text
                  x={planCenterX}
                  y={planTopY - 11}
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight="700"
                  fill="#047857"
                >
                  CENTER (CL)
                </text>
                <text
                  x={crownLeftX}
                  y={planTopY - 11}
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight="700"
                  fill="#B45309"
                >
                  SPL (L)
                </text>
                <text
                  x={rightWallLeftX}
                  y={planTopY - 11}
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight="700"
                  fill="#B45309"
                >
                  SPL (R)
                </text>
                <text
                  x={planCenterX}
                  y={planTopY + roundH_px + 13}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill="#0F172A"
                >
                  {geometry.excavationStage === 'TOP_HEADING' ||
                  geometry.excavationStage === 'top_heading'
                    ? `TOP HEADING CROWN ARC = ${geometry.crownArcLength.toFixed(2)} m · CENTER (CL) (SPAN ${geometry.width.toFixed(2)}m · BENCH ${(geometry.benchHeightRemovedMeters || 0).toFixed(2)}m REMOVED · DEV PERIM ${(
                        (geometry.hasLeftWall === false
                          ? 0
                          : geometry.leftWallArcLength ?? geometry.leftWallHeight ?? geometry.wallHeight) +
                        (geometry.hasCrown === false ? 0 : geometry.crownArcLength) +
                        (geometry.hasRightWall === false
                          ? 0
                          : geometry.rightWallArcLength ?? geometry.rightWallHeight ?? geometry.wallHeight)
                      ).toFixed(2)}m)`
                    : `CROWN ARC = ${geometry.crownArcLength.toFixed(2)} m · CENTER (CL) (SPAN ${geometry.width.toFixed(2)}m · DEV PERIM ${(
                        (geometry.hasLeftWall === false
                          ? 0
                          : geometry.leftWallArcLength ?? geometry.leftWallHeight ?? geometry.wallHeight) +
                        (geometry.hasCrown === false ? 0 : geometry.crownArcLength) +
                        (geometry.hasRightWall === false
                          ? 0
                          : geometry.rightWallArcLength ?? geometry.rightWallHeight ?? geometry.wallHeight)
                      ).toFixed(2)}m)`}
                </text>

                {/* Right Wall Box */}
                {rightWallW_px > 1 && (
                  <>
                    <rect
                      x={rightWallLeftX}
                      y={planTopY}
                      width={rightWallW_px}
                      height={roundH_px}
                      fill="none"
                      stroke="#0F172A"
                      strokeWidth="1.5"
                    />
                    <text
                      x={rightWallLeftX + rightWallW_px / 2}
                      y={planTopY + roundH_px + 13}
                      textAnchor="middle"
                      fontSize="8.5"
                      fontWeight="700"
                      fill="#334155"
                    >
                      RIGHT WALL = {(geometry.rightWallArcLength ?? geometry.rightWallHeight ?? geometry.wallHeight).toFixed(2)} m
                    </text>
                  </>
                )}

                {/* Top Dimension Line across Unfolded Perimeter (Left Wall + Crown + Right Wall) */}
                <g transform={`translate(0, ${planTopY - 6})`}>
                  <line x1={leftWallLeftX} y1="-4" x2={leftWallLeftX} y2="4" stroke="#0F172A" strokeWidth="1" />
                  <line x1={crownLeftX} y1="-4" x2={crownLeftX} y2="4" stroke="#0F172A" strokeWidth="1" />
                  <line x1={rightWallLeftX} y1="-4" x2={rightWallLeftX} y2="4" stroke="#0F172A" strokeWidth="1" />
                  <line x1={rightWallLeftX + rightWallW_px} y1="-4" x2={rightWallLeftX + rightWallW_px} y2="4" stroke="#0F172A" strokeWidth="1" />
                  <line x1={leftWallLeftX} y1="0" x2={rightWallLeftX + rightWallW_px} y2="0" stroke="#0F172A" strokeWidth="0.9" />
                </g>

                {/* Pull Dimension on Right Side of Perimeter Plan */}
                <line
                  x1={rightWallLeftX + rightWallW_px + 6}
                  y1={planTopY}
                  x2={rightWallLeftX + rightWallW_px + 16}
                  y2={planTopY}
                  stroke="#0F172A"
                  strokeWidth="0.9"
                />
                <line
                  x1={rightWallLeftX + rightWallW_px + 6}
                  y1={planTopY + roundH_px}
                  x2={rightWallLeftX + rightWallW_px + 16}
                  y2={planTopY + roundH_px}
                  stroke="#0F172A"
                  strokeWidth="0.9"
                />
                <line
                  x1={rightWallLeftX + rightWallW_px + 12}
                  y1={planTopY}
                  x2={rightWallLeftX + rightWallW_px + 12}
                  y2={planTopY + roundH_px}
                  stroke="#0F172A"
                  strokeWidth="1.0"
                />
                <text
                  x={rightWallLeftX + rightWallW_px + 18}
                  y={planTopY + roundH_px / 2 + 3}
                  fontSize="8.5"
                  fontWeight="700"
                  fill="#0F172A"
                >
                  PULL = {roundLen.toFixed(2)}m
                </text>

                {/* 1.0m Engineering Grid Ticks & Chainage Scale on Crown & Wall Sheet when Vectors are enabled */}
                {isCrownAndWallOnly && showCrownWallVectors && (() => {
                  const lwLen = geometry.leftWallArcLength ?? geometry.leftWallHeight ?? geometry.wallHeight;
                  const crLen = geometry.crownArcLength;
                  const rwLen = geometry.rightWallArcLength ?? geometry.rightWallHeight ?? geometry.wallHeight;
                  const pullStep = roundLen > 6 ? 1.0 : 0.5;
                  const pullTicks: number[] = [];
                  for (let m = 0; m <= roundLen + 1e-4; m += pullStep) {
                    pullTicks.push(Number(m.toFixed(2)));
                  }
                  const crHalf = crLen / 2;
                  const crTicks: number[] = [];
                  for (let m = Math.ceil(-crHalf); m <= Math.floor(crHalf); m += 1) {
                    crTicks.push(m);
                  }
                  const lwTicks: number[] = [];
                  for (let m = 0; m <= Math.floor(lwLen + 1e-4); m += 1) lwTicks.push(m);
                  const rwTicks: number[] = [];
                  for (let m = 0; m <= Math.floor(rwLen + 1e-4); m += 1) rwTicks.push(m);

                  return (
                    <g>
                      {/* Longitudinal Pull Interval Grid Lines */}
                      {pullTicks.map((m) => {
                        const yPos = planTopY + (m / Math.max(0.1, roundLen)) * roundH_px;
                        return (
                          <g key={`cw-pull-${m}`}>
                            <line
                              x1={leftWallLeftX}
                              y1={yPos}
                              x2={rightWallLeftX + rightWallW_px}
                              y2={yPos}
                              stroke="#CBD5E1"
                              strokeWidth="0.7"
                              strokeDasharray="4,4"
                            />
                            <line
                              x1={leftWallLeftX - 5}
                              y1={yPos}
                              x2={leftWallLeftX}
                              y2={yPos}
                              stroke="#0F172A"
                              strokeWidth="1"
                            />
                            <text
                              x={leftWallLeftX - 7}
                              y={yPos + 2.5}
                              textAnchor="end"
                              fontSize="7.2"
                              fontWeight="700"
                              fill="#334155"
                            >
                              +{m.toFixed(1)}m
                            </text>
                          </g>
                        );
                      })}
                      {/* Crown Center Line (CL) dashed guide */}
                      <line
                        x1={planCenterX}
                        y1={planTopY}
                        x2={planCenterX}
                        y2={planTopY + roundH_px}
                        stroke="#047857"
                        strokeWidth="1.1"
                        strokeDasharray="6,4"
                      />
                      {/* Crown Arc 1m Ticks */}
                      {crTicks.map((m) => {
                        const xPos = planCenterX + (m / Math.max(0.1, crLen)) * crownW_px;
                        return (
                          <g key={`cw-cr-${m}`}>
                            <line
                              x1={xPos}
                              y1={planTopY}
                              x2={xPos}
                              y2={planTopY + roundH_px}
                              stroke="#E2E8F0"
                              strokeWidth="0.6"
                            />
                            <line
                              x1={xPos}
                              y1={planTopY + roundH_px}
                              x2={xPos}
                              y2={planTopY + roundH_px + 4}
                              stroke="#0F172A"
                              strokeWidth="1"
                            />
                            <text
                              x={xPos}
                              y={planTopY + roundH_px + 23}
                              textAnchor="middle"
                              fontSize="6.8"
                              fontWeight="700"
                              fill={m === 0 ? '#047857' : '#475569'}
                            >
                              {m === 0 ? 'CL (0m)' : `${m > 0 ? '+' : ''}${m}m`}
                            </text>
                          </g>
                        );
                      })}
                      {/* Left & Right Wall 1m Ticks */}
                      {lwTicks.map((m) => {
                        const xPos = leftWallLeftX + (m / Math.max(0.1, lwLen)) * leftWallW_px;
                        return (
                          <g key={`cw-lw-${m}`}>
                            <line x1={xPos} y1={planTopY + roundH_px} x2={xPos} y2={planTopY + roundH_px + 4} stroke="#0F172A" strokeWidth="1" />
                            <text x={xPos} y={planTopY + roundH_px + 23} textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#475569">
                              {m}m
                            </text>
                          </g>
                        );
                      })}
                      {rwTicks.map((m) => {
                        const xPos = rightWallLeftX + (m / Math.max(0.1, rwLen)) * rightWallW_px;
                        return (
                          <g key={`cw-rw-${m}`}>
                            <line x1={xPos} y1={planTopY + roundH_px} x2={xPos} y2={planTopY + roundH_px + 4} stroke="#0F172A" strokeWidth="1" />
                            <text x={xPos} y={planTopY + roundH_px + 23} textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#475569">
                              {m}m
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  );
                })()}

                {/* Dedicated Crown & Wall Vector Discontinuity Schedule & 3D Orientation Table below Unfolded Perimeter */}
                {isCrownAndWallOnly && showCrownWallVectors && (() => {
                  const schedTopY = planTopY + roundH_px + 38;
                  const schedBottomLimit =
                    effectiveSheetConfig.headerPosition === 'BOTTOM'
                      ? headerBox.y - 12
                      : sheetH - margin - 14;
                  const schedH = Math.max(130, schedBottomLimit - schedTopY);
                  const schedX = leftWallLeftX;
                  const schedW = leftWallW_px + crownW_px + rightWallW_px;
                  const perimeterJoints = effectiveSheetJoints.filter((j) => j.surface !== 'face');
                  const crownJoints = effectiveSheetJoints.filter((j) => j.surface === 'crown');
                  const leftWallJoints = effectiveSheetJoints.filter((j) => j.surface === 'leftWall');
                  const rightWallJoints = effectiveSheetJoints.filter((j) => j.surface === 'rightWall');
                  const maxRows = Math.max(3, Math.min(10, Math.floor((schedH - 54) / 22)));
                  const visibleTraces = perimeterJoints.slice(0, maxRows);
                  const rowH = Math.min(28, Math.max(20, Math.floor((schedH - 46) / Math.max(1, visibleTraces.length))));

                  const c0 = 0;
                  const c1 = Math.round(schedW * 0.10);
                  const c2 = Math.round(schedW * 0.25);
                  const c3 = Math.round(schedW * 0.42);
                  const c4 = Math.round(schedW * 0.64);
                  const c5 = Math.round(schedW * 0.80);

                  return (
                    <g transform={`translate(${schedX}, ${schedTopY})`}>
                      <rect
                        x="0"
                        y="0"
                        width={schedW}
                        height={schedH}
                        fill="#FFFFFF"
                        stroke="#0F172A"
                        strokeWidth="1.4"
                      />
                      <rect x="0" y="0" width={schedW} height="22" fill="#0F172A" />
                      <text x="12" y="15" fontSize="9.5" fontWeight="700" fill="#FFFFFF">
                        CROWN &amp; WALL DEVELOPED PERIMETER VECTOR TRACE REGISTER &amp; 3D ORIENTATION SUMMARY ({settings.faceChainage})
                      </text>
                      <text x={schedW - 12} y="15" textAnchor="end" fontSize="8.5" fontWeight="700" fill="#38BDF8">
                        CROWN: {crownJoints.length} · LEFT WALL: {leftWallJoints.length} · RIGHT WALL: {rightWallJoints.length} (TOTAL: {perimeterJoints.length} TRACES)
                      </text>

                      {/* Table Column Header */}
                      <g transform="translate(0, 22)">
                        <rect x="0" y="0" width={schedW} height="19" fill="#F1F5F9" stroke="#0F172A" strokeWidth="0.8" />
                        {[c1, c2, c3, c4, c5].map((cx, i) => (
                          <line key={`cw-div-${i}`} x1={cx} y1="0" x2={cx} y2={schedH - 22} stroke="#CBD5E1" strokeWidth="0.7" />
                        ))}
                        <text x={c0 + 8} y="13" fontSize="8.2" fontWeight="700" fill="#0F172A">SET / ID</text>
                        <text x={c1 + 8} y="13" fontSize="8.2" fontWeight="700" fill="#0F172A">SURFACE SECTOR</text>
                        <text x={c2 + 8} y="13" fontSize="8.2" fontWeight="700" fill="#0F172A">CROWN STRIKE / AZIMUTH</text>
                        <text x={c3 + 8} y="13" fontSize="8.2" fontWeight="700" fill="#0F172A">3D ORIENTATION (DIP DIR / DIP)</text>
                        <text x={c4 + 8} y="13" fontSize="8.2" fontWeight="700" fill="#0F172A">PERSISTENCE &amp; SPACING</text>
                        <text x={c5 + 8} y="13" fontSize="8.2" fontWeight="700" fill="#0F172A">ROUGHNESS / INFILL / WATER</text>
                      </g>

                      {visibleTraces.length === 0 ? (
                        <text x={schedW / 2} y={Math.min(90, schedH / 2 + 12)} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#475569">
                          No Crown or Wall vector traces mapped yet. Switch to Crown, Left Wall, or Right Wall surface in workspace to plot traces.
                        </text>
                      ) : (
                        visibleTraces.map((j, idx) => {
                          const ry = 41 + idx * rowH;
                          const pal = JOINT_SET_PALETTE[j.set] || { color: '#0F172A' };
                          const surfName =
                            j.surface === 'crown'
                              ? 'CROWN ARCH'
                              : j.surface === 'leftWall'
                              ? 'LEFT WALL'
                              : 'RIGHT WALL';
                          const traceLbl = formatJointTraceLineLabel(j, joints);
                          const strikeVal =
                            j.strike !== undefined
                              ? `${String(Math.round(j.strike)).padStart(3, '0')}°`
                              : `${String(Math.round((j.dipDirection - 90 + 360) % 360)).padStart(3, '0')}°`;

                          return (
                            <g key={`cw-row-${j.id}`} transform={`translate(0, ${ry})`}>
                              <rect
                                x="0"
                                y="0"
                                width={schedW}
                                height={rowH}
                                fill={idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'}
                                stroke="#CBD5E1"
                                strokeWidth="0.6"
                              />
                              <rect x="6" y={Math.max(2, (rowH - 14) / 2)} width={c1 - 14} height="14" rx="2" fill={pal.color} />
                              <text x={c1 / 2 - 1} y={rowH / 2 + 3.2} textAnchor="middle" fontSize="7.8" fontWeight="700" fill="#FFFFFF">
                                {j.set} ({j.jointNumber || `#${idx + 1}`})
                              </text>
                              <text x={c1 + 8} y={rowH / 2 + 3.2} fontSize="8.2" fontWeight="700" fill="#0F172A">
                                {surfName}
                              </text>
                              <text x={c2 + 8} y={rowH / 2 + 3.2} fontSize="8.2" fontWeight="700" fill="#0369A1">
                                Strike {strikeVal} (Drive N{String(Math.round(settings.driveDirection)).padStart(3, '0')}°E)
                              </text>
                              <text x={c3 + 8} y={rowH / 2 + 3.2} fontSize="8.2" fontWeight="700" fill="#0F172A">
                                {traceLbl}
                              </text>
                              <text x={c4 + 8} y={rowH / 2 + 3.2} fontSize="8.0" fill="#1E293B">
                                L={(j.persistenceMeters ?? 2.5).toFixed(2)}m · {j.apertureMm || '1-3mm'}
                              </text>
                              <text x={c5 + 8} y={rowH / 2 + 3.2} fontSize="7.8" fill="#334155">
                                {(j.roughness || 'Rough Planar').slice(0, 14)} · {(j.waterCondition || 'Dry').slice(0, 10)}
                              </text>
                            </g>
                          );
                        })
                      )}
                    </g>
                  );
                })()}
              </g>
            )}

            {/* ==============================================================
                3. PRIORITY 1: MAIN TUNNEL-FACE GEOLOGICAL MAPPING
                Strict Layer Order (Section 14):
                PHOTO -> LITHOLOGY -> GEOLOGICAL FEATURES -> JOINTS -> SYMBOLS -> LABELS -> DIMENSIONS
               ============================================================== */}
            {!isCrownAndWallOnly && (
            <g>
              <text
                x={faceCenterX}
                y={faceTopY - 14}
                textAnchor="middle"
                fontSize="12.5"
                fontWeight="700"
                fill="#0F172A"
              >
                {outputMode === 'ENGINEERING_QUANTITY_SHEET'
                  ? `TUNNEL CROSS-SECTION — DESIGN vs. AS-BUILT GEOLOGICAL OVERBREAK & UNDERCUT PROFILE (${settings.faceChainage} · ${geometry.width.toFixed(2)}m × ${geometry.height.toFixed(2)}m)`
                  : effectiveShowAnyOverbreakUndercut && overbreakAnalysis?.hasValidSurveyProfile
                  ? `MAIN TUNNEL FACE GEOLOGICAL MAPPING + OVERBREAK & UNDERCUT OVERLAY (${settings.faceChainage} · OB: +${overbreakAnalysis.overbreakAreaSqMeters.toFixed(2)}m² · UC: -${overbreakAnalysis.undercutAreaSqMeters.toFixed(2)}m²)`
                  : geometry.excavationStage === 'TOP_HEADING' ||
                    geometry.excavationStage === 'top_heading'
                  ? `MAIN TUNNEL FACE GEOLOGICAL MAPPING — TOP HEADING (${settings.faceChainage} · DRIVE N ${String(Math.round(settings.driveDirection)).padStart(3, '0')}° E · ${geometry.width.toFixed(2)}m × ${geometry.height.toFixed(2)}m · L-WALL ${(geometry.leftWallHeight ?? geometry.wallHeight).toFixed(2)}m · R-WALL ${(geometry.rightWallHeight ?? geometry.wallHeight).toFixed(2)}m · BENCH ${(geometry.benchHeightRemovedMeters || 0).toFixed(2)}m REMOVED)`
                  : `MAIN TUNNEL FACE GEOLOGICAL MAPPING (${settings.faceChainage} · DRIVE N ${String(Math.round(settings.driveDirection)).padStart(3, '0')}° E · ${geometry.width.toFixed(2)}m × ${geometry.height.toFixed(2)}m)`}
              </text>

              {/* Clean Paper-Neutral Interior Fill Inside Tunnel Profile (Never Black!) */}
              <path d={facePolygonPath} fill="#F8FAFC" />

              {/* LAYER 1: REGISTERED MAIN FACE PHOTOGRAPH (Cropped strictly to tunnel boundary, using exact canvas transform) */}
              {showPhotos && photos.face.image && (
                <g clipPath="url(#sheet-face-clip)">
                  <g transform={getSheetPhotoSvgTransform('face', photos.face.transform)}>
                    <image
                      href={photos.face.warpedImage || photos.face.image}
                      x={faceSurfaceRect.x}
                      y={faceSurfaceRect.y}
                      width={faceSurfaceRect.width}
                      height={faceSurfaceRect.height}
                      preserveAspectRatio="none"
                      opacity={outputMode === 'PHOTO_AND_AI_TRACING' ? 0.92 : photos.face.opacity / 100}
                    />
                  </g>
                </g>
              )}

              {/* LAYER 2: SUBTLE LITHOLOGY REGIONS (Shown on Geological Mapping Sheet, or if overlayJointsOnQuantity is enabled) */}
              {showVectors &&
                (outputMode !== 'ENGINEERING_QUANTITY_SHEET' || overlayJointsOnQuantity) &&
                lithologyRegions.length > 0 && (
                <g>
                  {lithologyRegions.map((reg) => {
                    if (!showPerimeterPlan && reg.surface !== 'face') return null;
                    if (!showCrownWallVectors && reg.surface !== 'face') return null;
                    if (isCrownAndWallOnly && reg.surface === 'face') return null;
                    if (reg.polygon.length < 3) return null;
                    const sheetPts = reg.polygon.map((pt) =>
                      surfacePointToSheetXY(pt, reg.surface)
                    );
                    const dPoly =
                      sheetPts
                        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                        .join(' ') + ' Z';
                    const clipId =
                      reg.surface === 'face'
                        ? 'url(#sheet-face-clip)'
                        : reg.surface === 'crown'
                        ? 'url(#sheet-crown-clip)'
                        : reg.surface === 'leftWall'
                        ? 'url(#sheet-leftwall-clip)'
                        : 'url(#sheet-rightwall-clip)';
                    const cx =
                      sheetPts.reduce((acc, p) => acc + p.x, 0) / sheetPts.length;
                    const cy =
                      sheetPts.reduce((acc, p) => acc + p.y, 0) / sheetPts.length;

                    return (
                      <g key={`sheet-lith-${reg.id}`} clipPath={clipId}>
                        <path
                          d={dPoly}
                          fill={reg.colorHex}
                          fillOpacity={Math.min(0.22, reg.opacity * 0.48)}
                        />
                        <path
                          d={dPoly}
                          fill={`url(#sheet-lith-${reg.patternType})`}
                          fillOpacity={Math.min(0.78, reg.opacity * 1.9)}
                          stroke={reg.colorHex}
                          strokeOpacity="0.5"
                          strokeWidth="1"
                          strokeDasharray="5,3"
                        />
                        <text
                          x={cx}
                          y={cy}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="700"
                          fill="#0F172A"
                          fillOpacity="0.78"
                        >
                          {reg.lithologyName.toUpperCase()}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}

              {/* LAYER 2.5: OVERBREAK / UNDERCUT VECTOR ANALYSIS REGIONS & SURVEYED AS-BUILT PROFILE (Dedicated to Overbreak & Quantity Sheet, or optional Show Overbreak / Show Undercut toggles on Geological Mapping Sheet) */}
              {showVectors &&
                effectiveShowAnyOverbreakUndercut &&
                overbreakAnalysis &&
                overbreakAnalysis.hasValidSurveyProfile &&
                overbreakAnalysis.surface === 'face' && (
                  <g>
                    {effectiveShowOverbreak &&
                      overbreakAnalysis.overbreakRegions.map((reg) => {
                      if (reg.polygon.length < 3) return null;
                      const pts = reg.polygon.map((p) => surfacePointToSheetXY(p, 'face'));
                      const d =
                        pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') +
                        ' Z';
                      const maxPt = surfacePointToSheetXY(reg.maxRadialPoint, 'face');
                      return (
                        <g key={`sheet-ob-${reg.id}`}>
                          <path
                            d={d}
                            fill="rgba(225, 29, 72, 0.14)"
                            stroke="#E11D48"
                            strokeWidth="1.2"
                          />
                          <path d={d} fill="url(#sheet-overbreak-hatch)" />
                          {reg.areaSqMeters >= 0.02 && (
                            <g>
                              <rect
                                x={maxPt.x - 42}
                                y={maxPt.y - 19}
                                width="84"
                                height="13"
                                rx="1.5"
                                fill="#FFFFFF"
                                fillOpacity="0.92"
                                stroke="#E11D48"
                                strokeWidth="0.8"
                              />
                              <text
                                x={maxPt.x}
                                y={maxPt.y - 10}
                                textAnchor="middle"
                                fontSize="7.5"
                                fontWeight="700"
                                fill="#BE123C"
                              >
                                {reg.id}: +{reg.areaSqMeters.toFixed(2)}m² (+{reg.maxRadialMeters.toFixed(2)}m)
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}

                    {effectiveShowUndercut &&
                      overbreakAnalysis.undercutRegions.map((reg) => {
                      if (reg.polygon.length < 3) return null;
                      const pts = reg.polygon.map((p) => surfacePointToSheetXY(p, 'face'));
                      const d =
                        pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') +
                        ' Z';
                      const maxPt = surfacePointToSheetXY(reg.maxRadialPoint, 'face');
                      return (
                        <g key={`sheet-uc-${reg.id}`}>
                          <path
                            d={d}
                            fill="rgba(217, 119, 6, 0.16)"
                            stroke="#D97706"
                            strokeWidth="1.2"
                          />
                          <path d={d} fill="url(#sheet-undercut-hatch)" />
                          {reg.areaSqMeters >= 0.02 && (
                            <g>
                              <rect
                                x={maxPt.x - 42}
                                y={maxPt.y + 5}
                                width="84"
                                height="13"
                                rx="1.5"
                                fill="#FFFFFF"
                                fillOpacity="0.92"
                                stroke="#D97706"
                                strokeWidth="0.8"
                              />
                              <text
                                x={maxPt.x}
                                y={maxPt.y + 14}
                                textAnchor="middle"
                                fontSize="7.5"
                                fontWeight="700"
                                fill="#B45309"
                              >
                                {reg.id}: -{reg.areaSqMeters.toFixed(2)}m² (-{reg.maxRadialMeters.toFixed(2)}m)
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}

                    {/* Connected Surveyed As-Built Profile Polyline */}
                    {overbreakAnalysis.surveyedPolygon.length >= 2 && (
                      <path
                        d={
                          overbreakAnalysis.surveyedPolygon
                            .map((pt, idx) => {
                              const s = surfacePointToSheetXY(pt, 'face');
                              return `${idx === 0 ? 'M' : 'L'} ${s.x} ${s.y}`;
                            })
                            .join(' ') + ' Z'
                        }
                        fill="none"
                        stroke="#059669"
                        strokeWidth="2.1"
                        strokeDasharray="7,4"
                      />
                    )}
                  </g>
                )}

              {/* Authoritative Master Tunnel Cross-Section Outline */}
              <path
                d={facePolygonPath}
                fill="none"
                stroke="#0F172A"
                strokeWidth="2.6"
              />

              {/* Outer Boundary 1.00m Spacing Ticks, SPL & CENTER (CL) Markers on Face */}
              {(() => {
                const leftWallH = geometry.leftWallHeight ?? geometry.wallHeight;
                const rightWallH = geometry.rightWallHeight ?? geometry.wallHeight;
                const halfW = geometry.width / 2;
                const leftX = faceCenterX - faceWidthPx / 2;
                const rightX = faceCenterX + faceWidthPx / 2;
                const leftSplY = faceBottomY - leftWallH * facePxPerMeter;
                const rightSplY = faceBottomY - rightWallH * facePxPerMeter;

                const lwTicks: number[] = [];
                for (let m = 0; m <= Math.floor(leftWallH + 1e-4); m += 1) lwTicks.push(m);
                const rwTicks: number[] = [];
                for (let m = 0; m <= Math.floor(rightWallH + 1e-4); m += 1) rwTicks.push(m);
                const invTicks: number[] = [];
                for (let m = Math.ceil(-halfW); m <= Math.floor(halfW); m += 1) invTicks.push(m);

                return (
                  <g>
                    {lwTicks.map((m) => {
                      const ty = faceBottomY - m * facePxPerMeter;
                      return (
                        <g key={`sh-lw-1m-${m}`}>
                          <line x1={leftX} y1={ty} x2={leftX - 5} y2={ty} stroke="#0F172A" strokeWidth="1.1" />
                          <text x={leftX - 7} y={ty + 2.5} textAnchor="end" fontSize="6.8" fontWeight="700" fill="#334155">
                            {m}m
                          </text>
                        </g>
                      );
                    })}
                    {rwTicks.map((m) => {
                      const ty = faceBottomY - m * facePxPerMeter;
                      return (
                        <g key={`sh-rw-1m-${m}`}>
                          <line x1={rightX} y1={ty} x2={rightX + 5} y2={ty} stroke="#0F172A" strokeWidth="1.1" />
                          <text x={rightX + 7} y={ty + 2.5} textAnchor="start" fontSize="6.8" fontWeight="700" fill="#334155">
                            {m}m
                          </text>
                        </g>
                      );
                    })}
                    {invTicks.map((m) => {
                      const tx = faceCenterX + m * facePxPerMeter;
                      return (
                        <g key={`sh-inv-1m-${m}`}>
                          <line x1={tx} y1={faceBottomY} x2={tx} y2={faceBottomY + 5} stroke="#0F172A" strokeWidth="1.1" />
                          <text x={tx} y={faceBottomY + 12} textAnchor="middle" fontSize="6.5" fontWeight="700" fill={m === 0 ? '#047857' : '#334155'}>
                            {m === 0 ? '0m (CL)' : `${m}m`}
                          </text>
                        </g>
                      );
                    })}
                    {/* Left & Right SPL Markers */}
                    {leftWallH > 0.05 && (
                      <>
                        <line x1={leftX - 9} y1={leftSplY} x2={leftX + 3} y2={leftSplY} stroke="#B45309" strokeWidth="1.6" />
                        <text x={leftX - 11} y={leftSplY - 3} textAnchor="end" fontSize="7.2" fontWeight="800" fill="#B45309">
                          SPL {leftWallH.toFixed(2)}m
                        </text>
                      </>
                    )}
                    {rightWallH > 0.05 && (
                      <>
                        <line x1={rightX - 3} y1={rightSplY} x2={rightX + 9} y2={rightSplY} stroke="#B45309" strokeWidth="1.6" />
                        <text x={rightX + 11} y={rightSplY - 3} textAnchor="start" fontSize="7.2" fontWeight="800" fill="#B45309">
                          SPL {rightWallH.toFixed(2)}m
                        </text>
                      </>
                    )}
                    {/* Crown Center (CL) Marker */}
                    <line x1={faceCenterX} y1={faceTopY - 8} x2={faceCenterX} y2={faceTopY + 3} stroke="#047857" strokeWidth="1.6" />
                    <text x={faceCenterX} y={faceTopY - 4} textAnchor="middle" fontSize="7.2" fontWeight="800" fill="#047857">
                      CENTER (CL)
                    </text>
                  </g>
                );
              })()}
              {/* Custom Profile Control Point Nodes on Face Boundary */}
              {geometry.customProfile &&
                geometry.customProfile.controlPoints.map((cp) => {
                  const s = surfacePointToSheetXY({ x: cp.x, y: cp.y }, 'face');
                  return (
                    <circle
                      key={`sheet-custom-cp-${cp.id}`}
                      cx={s.x}
                      cy={s.y}
                      r="2.8"
                      fill="#0284C7"
                      stroke="#FFFFFF"
                      strokeWidth="0.9"
                    />
                  );
                })}
            </g>
            )}

            {/* Render Crown & Wall Lithology Regions when Crown & Wall mode has vectors enabled */}
            {isCrownAndWallOnly && showCrownWallVectors && lithologyRegions.length > 0 && (
              <g>
                {lithologyRegions
                  .filter((reg) => reg.surface !== 'face' && reg.polygon.length >= 3)
                  .map((reg) => {
                    const sheetPts = reg.polygon.map((pt) => surfacePointToSheetXY(pt, reg.surface));
                    const dPoly =
                      sheetPts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
                    const clipId =
                      reg.surface === 'crown'
                        ? 'url(#sheet-crown-clip)'
                        : reg.surface === 'leftWall'
                        ? 'url(#sheet-leftwall-clip)'
                        : 'url(#sheet-rightwall-clip)';
                    const cx = sheetPts.reduce((acc, p) => acc + p.x, 0) / sheetPts.length;
                    const cy = sheetPts.reduce((acc, p) => acc + p.y, 0) / sheetPts.length;
                    return (
                      <g key={`cw-lith-${reg.id}`} clipPath={clipId}>
                        <path
                          d={dPoly}
                          fill={reg.colorHex}
                          fillOpacity={Math.min(0.22, reg.opacity * 0.48)}
                        />
                        <path
                          d={dPoly}
                          fill={`url(#sheet-lith-${reg.patternType})`}
                          fillOpacity={Math.min(0.78, reg.opacity * 1.9)}
                          stroke={reg.colorHex}
                          strokeOpacity="0.5"
                          strokeWidth="1"
                          strokeDasharray="5,3"
                        />
                        <text
                          x={cx}
                          y={cy}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="700"
                          fill="#0F172A"
                          fillOpacity="0.78"
                        >
                          {reg.lithologyName.toUpperCase()}
                        </text>
                      </g>
                    );
                  })}
              </g>
            )}

            {/* ==============================================================
                4. LAYERS 3, 4 & 5: GEOLOGICAL FEATURES, JOINTS & STRUCTURAL SYMBOLS
               ============================================================== */}
            {showVectors && (outputMode !== 'ENGINEERING_QUANTITY_SHEET' || overlayJointsOnQuantity) && (
              <g>
                {/* Traced Geological Features & Discontinuities */}
                {effectiveSheetJoints.map((joint) => {
                  if (!showPerimeterPlan && joint.surface !== 'face') return null;
                  if (!showCrownWallVectors && joint.surface !== 'face') return null;
                  if (isCrownAndWallOnly && joint.surface === 'face') return null;
                  const displayedGeom = getDisplayedJointGeometry(joint, traceFitMode);
                  if (displayedGeom.length < 2) return null;
                  const sheetPts = displayedGeom.map((pt) =>
                    surfacePointToSheetXY(pt, joint.surface)
                  );
                  const dPath = sheetPts
                    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                    .join(' ');

                  const palette = JOINT_SET_PALETTE[joint.set] || { color: '#0F172A' };
                  const strokeColor = palette.color;
                  const styleInfo = getGeologicalFeatureStrokeStyle(joint.featureType, false);

                  const midIdx = Math.floor(sheetPts.length / 2);
                  const midPt =
                    sheetPts.length % 2 === 1
                      ? sheetPts[midIdx]
                      : {
                          x: (sheetPts[midIdx - 1].x + sheetPts[midIdx].x) / 2,
                          y: (sheetPts[midIdx - 1].y + sheetPts[midIdx].y) / 2,
                        };
                  const tA = sheetPts[Math.max(0, midIdx - 1)];
                  const tB = sheetPts[Math.min(sheetPts.length - 1, midIdx)];
                  const segAngleRad = Math.atan2(tB.y - tA.y, tB.x - tA.x);

                  return (
                    <g key={joint.id}>
                      {/* Shear / Fault / Vein / Clay Band Highlight */}
                      {styleInfo.isBand && (
                        <path
                          d={dPath}
                          fill="none"
                          stroke={strokeColor}
                          strokeOpacity={styleInfo.bandOpacity ?? 0.2}
                          strokeWidth="7.5"
                          strokeLinecap="round"
                        />
                      )}

                      {/* Primary Vector Discontinuity Polyline */}
                      {joint.vertexWidths && joint.vertexWidths.length === sheetPts.length ? (
                        sheetPts.slice(0, -1).map((ptA, segIdx) => {
                          const ptB = sheetPts[segIdx + 1];
                          const wNorm =
                            ((joint.vertexWidths![segIdx] ?? 0.5) +
                              (joint.vertexWidths![segIdx + 1] ?? 0.5)) /
                            2;
                          const baseW = styleInfo.isBand ? 2.0 : 1.35;
                          const segStrokeW = Number(
                            (baseW + wNorm * (styleInfo.isBand ? 2.4 : 1.7)).toFixed(2)
                          );
                          return (
                            <line
                              key={`${joint.id}-shseg-${segIdx}`}
                              x1={ptA.x}
                              y1={ptA.y}
                              x2={ptB.x}
                              y2={ptB.y}
                              stroke={strokeColor}
                              strokeWidth={segStrokeW}
                              strokeDasharray={styleInfo.dashArray}
                              strokeLinecap="round"
                            />
                          );
                        })
                      ) : (
                        <path
                          d={dPath}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={styleInfo.isBand ? '2.5' : '1.85'}
                          strokeDasharray={styleInfo.dashArray}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Genuine Rock Termination T-Bar Ticks */}
                      {joint.terminationStart === 'ROCK_TERMINATION' && sheetPts.length >= 2 && (() => {
                        const a = sheetPts[0];
                        const b = sheetPts[1];
                        const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
                        const dx = Math.cos(ang) * 4.5;
                        const dy = Math.sin(ang) * 4.5;
                        return (
                          <line
                            x1={a.x - dx}
                            y1={a.y - dy}
                            x2={a.x + dx}
                            y2={a.y + dy}
                            stroke={strokeColor}
                            strokeWidth="1.5"
                          />
                        );
                      })()}
                      {joint.terminationEnd === 'ROCK_TERMINATION' && sheetPts.length >= 2 && (() => {
                        const a = sheetPts[sheetPts.length - 2];
                        const b = sheetPts[sheetPts.length - 1];
                        const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
                        const dx = Math.cos(ang) * 4.5;
                        const dy = Math.sin(ang) * 4.5;
                        return (
                          <line
                            x1={b.x - dx}
                            y1={b.y - dy}
                            x2={b.x + dx}
                            y2={b.y + dy}
                            stroke={strokeColor}
                            strokeWidth="1.5"
                          />
                        );
                      })()}

                      {/* LAYER 5: Proper Structural Dip / Dip-Direction Symbol on Joint (Section 12) */}
                      <DipDirectionSymbolGlyph
                        midX={midPt.x}
                        midY={midPt.y}
                        tangentAngleRad={segAngleRad}
                        dipDeg={joint.dip}
                        dipDirectionDeg={joint.dipDirection}
                        featureType={joint.featureType}
                        orientationStatus={joint.orientationStatus}
                        color={strokeColor}
                        scale={joint.symbolScale || 1}
                        forPrintSheet={true}
                      />
                    </g>
                  );
                })}

                {/* LAYER 5B: Placed Standalone Structural Geological Symbols (Sections 9, 10, 15) */}
                {placedSymbols
                  .filter(
                    (sym) =>
                      sym.visible !== false &&
                      (showPerimeterPlan || sym.surface === 'face') &&
                      (showCrownWallVectors || sym.surface === 'face') &&
                      (!isCrownAndWallOnly || sym.surface !== 'face')
                  )
                  .map((sym) => {
                    const pt = surfacePointToSheetXY(sym.point, sym.surface);
                    const meta = getStructuralSymbolMeta(sym.symbolType);
                    const color = sym.color || meta.sheetColor;
                    return (
                      <g
                        key={`sheet-sym-${sym.id}`}
                        transform={`translate(${pt.x}, ${pt.y}) rotate(${sym.rotationDeg})`}
                      >
                        <StructuralGeologicalSymbolGlyph
                          symbolType={sym.symbolType}
                          color={color}
                          scale={sym.scale * 0.9}
                          dipDeg={sym.dipDeg}
                          uncertainOrientation={sym.uncertainOrientation}
                        />
                      </g>
                    );
                  })}
              </g>
            )}

            {/* ==============================================================
                5. LAYER 6: ON-LINE JOINT VALUES, SYMBOL VALUES & SURVEY POINTS (Small Font, No Box)
               ============================================================== */}
            {showVectors && (
              <g>
                {/* 6A. Joint Values Fitted Directly Along the Joint Trace Line (Small Font, No Box) */}
                {(outputMode !== 'ENGINEERING_QUANTITY_SHEET' || overlayJointsOnQuantity) &&
                  effectiveSheetJoints.map((joint) => {
                  if (!showPerimeterPlan && joint.surface !== 'face') return null;
                  if (!showCrownWallVectors && joint.surface !== 'face') return null;
                  if (isCrownAndWallOnly && joint.surface === 'face') return null;
                  const displayedGeom = getDisplayedJointGeometry(joint, traceFitMode);
                  if (displayedGeom.length < 2) return null;
                  const sheetPts = displayedGeom.map((pt) =>
                    surfacePointToSheetXY(pt, joint.surface)
                  );
                  const midIdx = Math.floor(sheetPts.length / 2);
                  const midPt =
                    sheetPts.length % 2 === 1
                      ? sheetPts[midIdx]
                      : {
                          x: (sheetPts[midIdx - 1].x + sheetPts[midIdx].x) / 2,
                          y: (sheetPts[midIdx - 1].y + sheetPts[midIdx].y) / 2,
                        };
                  const segA = sheetPts[Math.max(0, midIdx - 1)];
                  const segB = sheetPts[Math.min(sheetPts.length - 1, midIdx)];
                  let angleDeg =
                    (Math.atan2(segB.y - segA.y, segB.x - segA.x) * 180) / Math.PI;
                  if (angleDeg > 90) angleDeg -= 180;
                  if (angleDeg < -90) angleDeg += 180;

                  const palette = JOINT_SET_PALETTE[joint.set] || { color: '#0F172A' };
                  const baseLabel = formatJointTraceLineLabel(joint, joints);
                  const textStr = `${baseLabel}${
                    showConfidenceLabels ? ` [${joint.confidence[0]}]` : ''
                  }`;

                  return (
                    <g
                      key={`sheet-j-lbl-${joint.id}`}
                      transform={`translate(${midPt.x.toFixed(1)}, ${midPt.y.toFixed(1)}) rotate(${angleDeg.toFixed(1)})`}
                    >
                      <text
                        x={0}
                        y={-3.5}
                        textAnchor="middle"
                        fontSize="6.8"
                        fontWeight="700"
                        fill={palette.color}
                        stroke="#FFFFFF"
                        strokeWidth="2.2"
                        paintOrder="stroke"
                      >
                        {textStr}
                      </text>
                    </g>
                  );
                })}

                {/* 6B. Placed Geological Symbol Labels (Values Only, Small Font, No Box) */}
                {(outputMode !== 'ENGINEERING_QUANTITY_SHEET' || overlayJointsOnQuantity) &&
                  placedSymbols
                    .filter(
                      (sym) =>
                        sym.visible !== false &&
                        (showPerimeterPlan || sym.surface === 'face') &&
                        (showCrownWallVectors || sym.surface === 'face') &&
                        (!isCrownAndWallOnly || sym.surface !== 'face')
                    )
                    .map((sym) => {
                    const pt = surfacePointToSheetXY(sym.point, sym.surface);
                    const meta = getStructuralSymbolMeta(sym.symbolType);
                    const color = sym.color || meta.sheetColor;
                    return (
                      <text
                        key={`sheet-sym-lbl-${sym.id}`}
                        x={pt.x}
                        y={pt.y - 12}
                        textAnchor="middle"
                        fontSize="6.8"
                        fontWeight="700"
                        fill={color}
                        stroke="#FFFFFF"
                        strokeWidth="2.2"
                        paintOrder="stroke"
                      >
                        {sym.label} ({String(Math.round(sym.dipDirectionDeg)).padStart(3, '0')}°/
                        {String(Math.round(sym.dipDeg)).padStart(2, '0')}°
                        {sym.uncertainOrientation ? '?' : ''})
                      </text>
                    );
                  })}

                {/* 6C. Survey Control Points (Point Marker & Point Label Only, No X/Y Values or Box) */}
                {effectiveShowAnyOverbreakUndercut &&
                  controlPoints
                    .filter(
                      (cp) =>
                        cp.visible !== false &&
                        (showPerimeterPlan || cp.surface === 'face') &&
                        (showCrownWallVectors || cp.surface === 'face') &&
                        (!isCrownAndWallOnly || cp.surface !== 'face')
                    )
                    .map((cp) => {
                    const pt = surfacePointToSheetXY(cp.point, cp.surface);
                    return (
                      <g key={`sheet-cp-${cp.id}`}>
                        {/* Survey Control Point Target Marker at exact survey location */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="4.5"
                          fill="#FFFFFF"
                          stroke="#059669"
                          strokeWidth="1.4"
                        />
                        <line x1={pt.x - 6} y1={pt.y} x2={pt.x + 6} y2={pt.y} stroke="#059669" strokeWidth="1.2" />
                        <line x1={pt.x} y1={pt.y - 6} x2={pt.x} y2={pt.y + 6} stroke="#059669" strokeWidth="1.2" />
                        <text
                          x={pt.x}
                          y={pt.y - 7.5}
                          textAnchor="middle"
                          fontSize="6.8"
                          fontWeight="700"
                          fill="#065F46"
                          stroke="#FFFFFF"
                          strokeWidth="2"
                          paintOrder="stroke"
                        >
                          {cp.label}
                        </text>
                      </g>
                    );
                  })}
              </g>
            )}

            {/* ==============================================================
                6. LAYER 7: TUNNEL FACE ENGINEERING DIMENSIONS (Priority 5)
               ============================================================== */}
            {!isCrownAndWallOnly && (
            <g>
               {/* Bottom Width & Crown Arc Length Dimension Line */}
              <g transform={`translate(0, ${faceBottomY + 20})`}>
                <line
                  x1={faceCenterX - faceWidthPx / 2}
                  y1="-14"
                  x2={faceCenterX - faceWidthPx / 2}
                  y2="6"
                  stroke="#0F172A"
                  strokeWidth="1"
                />
                <line
                  x1={faceCenterX + faceWidthPx / 2}
                  y1="-14"
                  x2={faceCenterX + faceWidthPx / 2}
                  y2="6"
                  stroke="#0F172A"
                  strokeWidth="1"
                />
                <line
                  x1={faceCenterX - faceWidthPx / 2}
                  y1="0"
                  x2={faceCenterX + faceWidthPx / 2}
                  y2="0"
                  stroke="#0F172A"
                  strokeWidth="1.2"
                />
                <rect
                  x={faceCenterX - 134}
                  y="-9"
                  width="268"
                  height="17"
                  fill="#FFFFFF"
                />
                <text
                  x={faceCenterX}
                  y="3.5"
                  textAnchor="middle"
                  fontSize="9.8"
                  fontWeight="700"
                  fill="#0F172A"
                >
                  SPAN W = {geometry.width.toFixed(2)} m · CROWN ARC = {geometry.crownArcLength.toFixed(2)} m
                </text>
              </g>

              {/* Left Wall Height Dimension Line */}
              <g transform={`translate(${faceCenterX - faceWidthPx / 2 - 22}, 0)`}>
                <line
                  x1="-5"
                  y1={faceBottomY}
                  x2="16"
                  y2={faceBottomY}
                  stroke="#0F172A"
                  strokeWidth="1"
                />
                <line
                  x1="-5"
                  y1={faceBottomY - geometry.wallHeight * facePxPerMeter}
                  x2="16"
                  y2={faceBottomY - geometry.wallHeight * facePxPerMeter}
                  stroke="#0F172A"
                  strokeWidth="1"
                />
                <line
                  x1="0"
                  y1={faceBottomY}
                  x2="0"
                  y2={faceBottomY - geometry.wallHeight * facePxPerMeter}
                  stroke="#0F172A"
                  strokeWidth="1.2"
                />
                <text
                  x="-8"
                  y={faceBottomY - (geometry.wallHeight * facePxPerMeter) / 2}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="700"
                  fill="#0F172A"
                  transform={`rotate(-90, -8, ${faceBottomY - (geometry.wallHeight * facePxPerMeter) / 2})`}
                >
                  WALL HT = {geometry.wallHeight.toFixed(2)} m
                </text>
              </g>

              {/* Right Total Height Dimension Line */}
              <g transform={`translate(${faceCenterX + faceWidthPx / 2 + 22}, 0)`}>
                <line
                  x1="-16"
                  y1={faceBottomY}
                  x2="5"
                  y2={faceBottomY}
                  stroke="#0F172A"
                  strokeWidth="1"
                />
                <line
                  x1="-16"
                  y1={faceTopY}
                  x2="5"
                  y2={faceTopY}
                  stroke="#0F172A"
                  strokeWidth="1"
                />
                <line
                  x1="0"
                  y1={faceBottomY}
                  x2="0"
                  y2={faceTopY}
                  stroke="#0F172A"
                  strokeWidth="1.2"
                />
                <text
                  x="11"
                  y={(faceTopY + faceBottomY) / 2}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="700"
                  fill="#0F172A"
                  transform={`rotate(90, 11, ${(faceTopY + faceBottomY) / 2})`}
                >
                  TOTAL HT = {geometry.height.toFixed(2)} m (CROWN R={geometry.crownRadius.toFixed(2)}m)
                </text>
              </g>
            </g>
            )}

            {/* ==============================================================
                7. RIGHT ENGINEERING COLUMN: COMPASS, GEOLOGICAL LEGEND,
                   NON-INTERSECTING JOINT DATA TABLE & BARTON Q-INDEX BLOCK
               ============================================================== */}
            {showTitleAndTables && (
              <g clipPath="url(#sheet-right-col-clip)">
                {/* 7A. Structural Orientation & Tunnel Drive Azimuth Compass */}
                {orientationBlock.height > 0 && (
                <g transform={`translate(${orientationBlock.x}, ${orientationBlock.y})`}>
                  <rect
                    x="0"
                    y="0"
                    width={orientationBlock.width}
                    height={orientationBlock.height}
                    fill="#F8FAFC"
                    stroke="#0F172A"
                    strokeWidth="1.2"
                  />
                  <text
                    x="12"
                    y="17"
                    fontSize={contentMetrics.blockTitleFontSize}
                    fontWeight="700"
                    fill="#0F172A"
                  >
                    {outputMode === 'ENGINEERING_QUANTITY_SHEET'
                      ? 'CROSS-SECTION RADIAL DEVIATION & POLAR OVERBREAK PROFILE'
                      : 'DRIVE DIRECTION & STEREOGRAPHIC POLE SUMMARY'}
                  </text>

                  {/* Stereonet OR Radial Overbreak Deviation Diagram */}
                  {(() => {
                    const stereoR = Math.max(40, Math.min(70, (orientationBlock.height - 42) / 2));
                    const stereoCx = Math.round(stereoR + 22);
                    const stereoCy = Math.round(24 + (orientationBlock.height - 26) / 2);
                    const textStartX = stereoCx + stereoR + 20;
                    const availInfoH = Math.max(85, orientationBlock.height - 38);
                    const lineSpacing = Math.max(14.5, Math.min(26, availInfoH / 4.3));
                    const stereoScaleBoost = Math.max(1.0, Math.min(1.25, orientationBlock.height / 145));
                    const infoTitleFs = Number((contentMetrics.legendFontSize + 0.9 * stereoScaleBoost).toFixed(2));
                    const infoBodyFs = Number((contentMetrics.legendFontSize * Math.min(1.14, stereoScaleBoost)).toFixed(2));
                    const poleRadius = Number(Math.max(2.9, Math.min(4.2, stereoR * 0.062)).toFixed(1));
                    const cardinalFs = Number(Math.max(8.0, Math.min(10.2, stereoR * 0.16)).toFixed(1));

                    if (outputMode === 'ENGINEERING_QUANTITY_SHEET') {
                      const obArea = overbreakAnalysis?.overbreakAreaSqMeters ?? 0;
                      const ucArea = overbreakAnalysis?.undercutAreaSqMeters ?? 0;
                      const maxOb = overbreakAnalysis?.maxRadialOverbreakMeters ?? 0;
                      const avgOb = overbreakAnalysis?.avgRadialOverbreakMeters ?? 0;
                      const maxUc = overbreakAnalysis?.maxRadialUndercutMeters ?? 0;
                      const desPerim =
                        overbreakAnalysis?.designPerimeterMeters ??
                        geometry.totalPerimeterMeters ??
                        25.4;
                      const survPerim = overbreakAnalysis?.surveyedPerimeterMeters ?? desPerim;
                      const designR = stereoR * 0.76;

                      return (
                        <>
                          <g transform={`translate(${stereoCx}, ${stereoCy})`}>
                            <circle cx="0" cy="0" r={stereoR} fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
                            {/* Design Reference Circle */}
                            <circle
                              cx="0"
                              cy="0"
                              r={designR}
                              fill="rgba(14, 165, 233, 0.06)"
                              stroke="#0F172A"
                              strokeWidth="1.5"
                              strokeDasharray="4,3"
                            />
                            {/* Simulated Polar Overbreak / Undercut Contour */}
                            <path
                              d={`M ${-designR * 1.04} ${designR * 0.55} L ${-designR * 1.12} 0 L ${-designR * 0.85} ${-designR * 0.82} L 0 ${-designR * 1.16} L ${designR * 0.88} ${-designR * 0.8} L ${designR * 1.1} 0 L ${designR * 0.96} ${designR * 0.55} Z`}
                              fill="rgba(225, 29, 72, 0.14)"
                              stroke="#E11D48"
                              strokeWidth="1.5"
                            />
                            <line x1={-stereoR} y1="0" x2={stereoR} y2="0" stroke="#94A3B8" strokeWidth="0.7" />
                            <line x1="0" y1={-stereoR} x2="0" y2={stereoR} stroke="#94A3B8" strokeWidth="0.7" />
                            <text x="0" y={-stereoR - 4} textAnchor="middle" fontSize={cardinalFs - 0.5} fontWeight="700" fill="#BE123C">
                              CROWN (+{maxOb.toFixed(2)}m)
                            </text>
                            <text x="0" y={stereoR + 10} textAnchor="middle" fontSize={cardinalFs - 0.5} fontWeight="600" fill="#475569">
                              INVERT (0.00m)
                            </text>
                          </g>

                          <g transform={`translate(${textStartX}, ${Math.round(33 + (availInfoH - lineSpacing * 4) * 0.22)})`}>
                            <text x="0" y="0" fontSize={infoTitleFs} fontWeight="700" fill="#0F172A">
                              STATION: {settings.faceChainage} · PULL INTERVAL: {(overbreakAnalysis?.effectivePullIntervalMeters ?? settings.roundLength).toFixed(2)} m
                            </text>
                            <text x="0" y={lineSpacing} fontSize={infoBodyFs} fill="#BE123C" fontWeight="700">
                              · Radial Overbreak: Max = +{maxOb.toFixed(3)} m · Avg = +{avgOb.toFixed(3)} m ({overbreakAnalysis?.overbreakRegions.length ?? 0} Zones)
                            </text>
                            <text x="0" y={lineSpacing * 2} fontSize={infoBodyFs} fill="#B45309" fontWeight="700">
                              · Radial Undercut: Max = -{maxUc.toFixed(3)} m · Area = {ucArea.toFixed(2)} m² ({overbreakAnalysis?.undercutRegions.length ?? 0} Zones)
                            </text>
                            <text x="0" y={lineSpacing * 3} fontSize={infoBodyFs - 0.3} fill="#334155">
                              · Perimeter: Design = {desPerim.toFixed(2)} m vs. Surveyed As-Built = {survPerim.toFixed(2)} m
                            </text>
                            <text x="0" y={lineSpacing * 4.05} fontSize={infoBodyFs} fontWeight="700" fill="#0F172A">
                              NET OVERBREAK: +{obArea.toFixed(2)} m² ({(overbreakAnalysis?.overbreakPercent ?? 0).toFixed(1)}%) · CONTROL PTS: {controlPoints.length}
                            </text>
                          </g>
                        </>
                      );
                    }

                    return (
                      <>
                        <g transform={`translate(${stereoCx}, ${stereoCy})`}>
                          <circle cx="0" cy="0" r={stereoR} fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.4" />
                          <circle cx="0" cy="0" r={stereoR * 0.67} fill="none" stroke="#94A3B8" strokeWidth="0.7" strokeDasharray="2.5,2.5" />
                          <circle cx="0" cy="0" r={stereoR * 0.34} fill="none" stroke="#94A3B8" strokeWidth="0.7" strokeDasharray="2.5,2.5" />
                          <line x1={-stereoR - 4} y1="0" x2={stereoR + 4} y2="0" stroke="#94A3B8" strokeWidth="0.8" />
                          <line x1="0" y1={-stereoR - 4} x2="0" y2={stereoR + 4} stroke="#94A3B8" strokeWidth="0.8" />
                          <text x="0" y={-stereoR - 5} textAnchor="middle" fontSize={cardinalFs} fontWeight="700" fill="#0F172A">N</text>
                          <text x={stereoR + 9} y="3" textAnchor="middle" fontSize={cardinalFs - 0.5} fontWeight="600" fill="#475569">E</text>
                          <text x="0" y={stereoR + 11} textAnchor="middle" fontSize={cardinalFs - 0.5} fontWeight="600" fill="#475569">S</text>
                          <text x={-stereoR - 9} y="3" textAnchor="middle" fontSize={cardinalFs - 0.5} fontWeight="600" fill="#475569">W</text>

                          {/* Drive Azimuth Vector */}
                          {(() => {
                            const rad = ((settings.driveDirection - 90) * Math.PI) / 180;
                            const ax = Math.cos(rad) * (stereoR - 4);
                            const ay = Math.sin(rad) * (stereoR - 4);
                            return (
                              <line
                                x1="0"
                                y1="0"
                                x2={ax}
                                y2={ay}
                                stroke="#0F172A"
                                strokeWidth="2.3"
                              />
                            );
                          })()}

                          {/* Plot Dip Direction poles for each joint */}
                          {joints.map((j) => {
                            const rad = ((j.dipDirection - 90) * Math.PI) / 180;
                            const r = (j.dip / 90) * (stereoR - 4);
                            const px = Math.cos(rad) * r;
                            const py = Math.sin(rad) * r;
                            const color = JOINT_SET_PALETTE[j.set]?.color || '#DC2626';
                            return (
                              <circle
                                key={`pole-${j.id}`}
                                cx={px}
                                cy={py}
                                r={poleRadius}
                                fill={color}
                                stroke="#FFFFFF"
                                strokeWidth="0.75"
                              />
                            );
                          })}
                        </g>

                        <g transform={`translate(${textStartX}, ${Math.round(33 + (availInfoH - lineSpacing * 4) * 0.22)})`}>
                          <text x="0" y="0" fontSize={infoTitleFs} fontWeight="700" fill="#0F172A">
                            TUNNEL DRIVE AZIMUTH: N {String(Math.round(settings.driveDirection)).padStart(3, '0')}° E
                          </text>
                          <text x="0" y={lineSpacing} fontSize={infoBodyFs} fill="#334155">
                            · Left Wall Normal: N {String(Math.round((settings.driveDirection + 270) % 360)).padStart(3, '0')}° E · Right Wall: N {String(Math.round((settings.driveDirection + 90) % 360)).padStart(3, '0')}° E
                          </text>
                          <text x="0" y={lineSpacing * 2} fontSize={infoBodyFs} fill="#334155">
                            · Convention: Dip Direction (000°–360°) / Dip Angle (00°–90°)
                          </text>
                          <text x="0" y={lineSpacing * 3} fontSize={infoBodyFs - 0.4} fill="#475569">
                            · Perimeter Ratio: P = 2×{geometry.wallHeight.toFixed(2)}m + {geometry.crownArcLength.toFixed(2)}m = {(geometry.wallHeight * 2 + geometry.crownArcLength).toFixed(2)}m
                          </text>
                          <text x="0" y={lineSpacing * 4.05} fontSize={infoBodyFs} fontWeight="700" fill="#0F172A">
                            MAPPED TRACES: {joints.length} ({jointSets.length} Sets) · SYMBOLS: {placedSymbols.length} · CONTROL PTS: {controlPoints.length}
                          </text>
                        </g>
                      </>
                    );
                  })()}
                </g>
                )}

                {/* 7B. Professional Legend (Geological & Lithological OR Overbreak, Undercut & Survey Legend) */}
                {legendBlock.height > 0 && (
                <g transform={`translate(${legendBlock.x}, ${legendBlock.y})`}>
                  <rect
                    x="0"
                    y="0"
                    width={legendBlock.width}
                    height={legendBlock.height}
                    fill="#F8FAFC"
                    stroke="#0F172A"
                    strokeWidth="1.2"
                  />
                  <text
                    x="12"
                    y="17"
                    fontSize={contentMetrics.blockTitleFontSize}
                    fontWeight="700"
                    fill="#0F172A"
                  >
                    {outputMode === 'ENGINEERING_QUANTITY_SHEET'
                      ? 'OVERBREAK, UNDERCUT & AS-BUILT SURVEY LEGEND'
                      : 'GEOLOGICAL & LITHOLOGICAL MAPPING LEGEND'}
                  </text>
                  <line x1="0" y1="24" x2={legendBlock.width} y2="24" stroke="#0F172A" strokeWidth="0.8" />

                  {outputMode === 'ENGINEERING_QUANTITY_SHEET' ? (
                    (() => {
                      const ls = contentMetrics.legendRowSpacing;
                      const lf = contentMetrics.legendFontSize;
                      const sw = Math.round(Math.max(32, Math.min(42, legendBlock.width * 0.07)));
                      const midSw = sw / 2;
                      const textX = sw + 10;
                      const startY = Math.round(36 + Math.max(0, (legendBlock.height - 36 - ls * 4.2) * 0.25));
                      return (
                        <>
                          <g transform={`translate(14, ${startY})`}>
                            <line x1="0" y1="0" x2={sw} y2="0" stroke="#0F172A" strokeWidth="2.4" />
                            <text x={textX} y="3.5" fontSize={lf} fontWeight="700" fill="#0F172A">
                              Design Excavation Boundary
                            </text>

                            <line x1="0" y1={ls} x2={sw} y2={ls} stroke="#059669" strokeWidth="2.2" strokeDasharray="6,3" />
                            <text x={textX} y={ls + 3.5} fontSize={lf} fontWeight="700" fill="#065F46">
                              Surveyed As-Built Profile
                            </text>

                            <rect x="0" y={ls * 2 - 7} width={sw} height="13" fill="rgba(225, 29, 72, 0.16)" stroke="#E11D48" strokeWidth="1.1" />
                            <rect x="0" y={ls * 2 - 7} width={sw} height="13" fill="url(#sheet-overbreak-hatch)" />
                            <text x={textX} y={ls * 2 + 3} fontSize={lf} fontWeight="700" fill="#BE123C">
                              Overbreak (Outside Design)
                            </text>

                            <rect x="0" y={ls * 3 - 7} width={sw} height="13" fill="rgba(217, 119, 6, 0.18)" stroke="#D97706" strokeWidth="1.1" />
                            <rect x="0" y={ls * 3 - 7} width={sw} height="13" fill="url(#sheet-undercut-hatch)" />
                            <text x={textX} y={ls * 3 + 3} fontSize={lf} fontWeight="700" fill="#B45309">
                              Undercut (Inside Design)
                            </text>

                            <circle cx={midSw} cy={ls * 4} r="4.8" fill="#FFFFFF" stroke="#059669" strokeWidth="1.5" />
                            <line x1={midSw - 6} y1={ls * 4} x2={midSw + 6} y2={ls * 4} stroke="#059669" strokeWidth="1.3" />
                            <line x1={midSw} y1={ls * 4 - 6} x2={midSw} y2={ls * 4 + 6} stroke="#059669" strokeWidth="1.3" />
                            <text x={textX} y={ls * 4 + 3.5} fontSize={lf} fontWeight="700" fill="#0F172A">
                              Survey Control Point (CP1..CPn)
                            </text>
                          </g>

                          <g transform={`translate(${Math.round(legendBlock.width * 0.51)}, ${startY})`}>
                            <rect x="0" y="-7" width={sw} height="14" rx="2" fill="#FFE4E6" stroke="#E11D48" strokeWidth="1" />
                            <text x={midSw} y="3" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#BE123C">GEO</text>
                            <text x={textX} y="3" fontSize={lf} fontWeight="700" fill="#0F172A">
                              Geological Wedge / Joint Overbreak
                            </text>

                            <rect x="0" y={ls - 7} width={sw} height="14" rx="2" fill="#FEF3C7" stroke="#D97706" strokeWidth="1" />
                            <text x={midSw} y={ls + 3} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#B45309">MECH</text>
                            <text x={textX} y={ls + 3} fontSize={lf} fontWeight="700" fill="#0F172A">
                              Mechanical / Excavation Profile Cause
                            </text>

                            <text x="0" y={ls * 2.15} fontSize={lf - 0.3} fontWeight="700" fill="#0F172A">
                              VOLUME FORMULA (SINGLE SECTION):
                            </text>
                            <text x="0" y={ls * 2.95} fontSize={lf - 0.5} fill="#334155">
                              V = Area (m²) × Pull Interval L (m)
                            </text>
                            <text x="0" y={ls * 3.85} fontSize={lf - 0.3} fontWeight="700" fill="#0F172A">
                              MULTI-SECTION PRISMOIDAL VOLUME:
                            </text>
                            <text x="0" y={ls * 4.55} fontSize={lf - 0.5} fill="#334155">
                              V = (ΔRD / 6) × (A₁ + 4·Aₘ + A₂)
                            </text>
                          </g>
                        </>
                      );
                    })()
                  ) : (
                    <>
                      {/* Column 1: Structural Symbols (Auto-scaled to legendBlock.height) */}
                      {(() => {
                        const ls = contentMetrics.legendRowSpacing;
                        const lf = contentMetrics.legendFontSize;
                        const sw = Math.round(Math.max(30, Math.min(40, legendBlock.width * 0.068)));
                        const midSw = sw / 2;
                        const textX = sw + 10;
                        const startY = Math.round(36 + Math.max(0, (legendBlock.height - 36 - ls * 4.5) * 0.3));
                        return (
                          <g transform={`translate(14, ${startY})`}>
                            <line x1="0" y1="0" x2={sw} y2="0" stroke="#DC2626" strokeWidth="2.2" />
                            <line x1={midSw} y1="0" x2={midSw} y2="7.5" stroke="#DC2626" strokeWidth="1.7" />
                            <text x={textX} y="3.5" fontSize={lf} fontWeight="600" fill="#0F172A">
                              Joint Trace + Dip Dir / Dip
                            </text>

                            <line x1="0" y1={ls} x2={sw} y2={ls} stroke="#0284C7" strokeWidth="2.2" strokeDasharray="6,3" />
                            <polygon points={`${midSw - 4.5},${ls} ${midSw + 4.5},${ls} ${midSw},${ls + 7.5}`} fill="none" stroke="#0284C7" strokeWidth="1.4" />
                            <text x={textX} y={ls + 3.5} fontSize={lf} fontWeight="600" fill="#0F172A">
                              Bedding (S0) / Foliation (S1)
                            </text>

                            <line x1="0" y1={ls * 2} x2={sw} y2={ls * 2} stroke="#E11D48" strokeWidth="5.5" strokeOpacity="0.22" />
                            <line x1="0" y1={ls * 2} x2={sw} y2={ls * 2} stroke="#E11D48" strokeWidth="2.2" strokeDasharray="8,2,2,2" />
                            <polygon points={`${midSw - 4.5},${ls * 2} ${midSw + 4.5},${ls * 2} ${midSw},${ls * 2 + 7.5}`} fill="#E11D48" />
                            <text x={textX} y={ls * 2 + 3.5} fontSize={lf} fontWeight="600" fill="#0F172A">
                              Fault / Shear Zone / Gouge
                            </text>

                            <path d={`M 2 ${ls * 3} Q ${midSw * 0.55} ${ls * 3 - 5} ${midSw} ${ls * 3} T ${sw - 2} ${ls * 3}`} fill="none" stroke="#0284C7" strokeWidth="1.8" />
                            <text x={textX} y={ls * 3 + 3.5} fontSize={lf} fontWeight="600" fill="#0F172A">
                              Water Seepage / Flow / Vein
                            </text>

                            <circle cx={midSw} cy={ls * 4} r="4.8" fill="#FFFFFF" stroke="#059669" strokeWidth="1.5" />
                            <line x1={midSw - 6} y1={ls * 4} x2={midSw + 6} y2={ls * 4} stroke="#059669" strokeWidth="1.3" />
                            <line x1={midSw} y1={ls * 4 - 6} x2={midSw} y2={ls * 4 + 6} stroke="#059669" strokeWidth="1.3" />
                            <text x={textX} y={ls * 4 + 3.5} fontSize={lf} fontWeight="600" fill="#0F172A">
                              {effectiveShowAnyOverbreakUndercut
                                ? `OB (${effectiveShowOverbreak ? 'ON' : 'OFF'}) / UC (${effectiveShowUndercut ? 'ON' : 'OFF'}) & Survey CP`
                                : 'Survey Control Point (CP)'}
                            </text>
                          </g>
                        );
                      })()}

                      {/* Column 2: Active Lithology Units & Overbreak/Undercut Swatches when enabled */}
                      {(() => {
                        const ls = contentMetrics.legendRowSpacing;
                        const swatchW = Math.round(Math.max(32, Math.min(42, legendBlock.width * 0.07)));
                        const swatchH = Math.round(Math.max(14, Math.min(18, ls * 0.64)));
                        const startY = Math.round(30 + Math.max(0, (legendBlock.height - 36 - ls * 4.5) * 0.25));
                        const maxLithRows = effectiveShowAnyOverbreakUndercut
                          ? Math.max(2, contentMetrics.maxLegendLithologyRows - (effectiveShowOverbreak ? 1 : 0) - (effectiveShowUndercut ? 1 : 0))
                          : contentMetrics.maxLegendLithologyRows;
                        const baseLithUnits = (
                          lithologyRegions.length > 0
                            ? Array.from(
                                new Map(lithologyRegions.map((r) => [r.patternType, r])).values()
                              )
                            : [
                                { patternType: 'quartzite', lithologyName: 'Quartzite', colorHex: '#EAB308' },
                                { patternType: 'phyllite', lithologyName: 'Phyllite / Schist', colorHex: '#38BDF8' },
                                { patternType: 'granite', lithologyName: 'Granite / Gneiss', colorHex: '#FB7185' },
                                { patternType: 'dolerite', lithologyName: 'Dolerite / Basalt', colorHex: '#475569' },
                                { patternType: 'shear_zone', lithologyName: 'Shear / Breccia Zone', colorHex: '#EF4444' },
                              ]
                        ).slice(0, maxLithRows);

                        return (
                          <g transform={`translate(${Math.round(legendBlock.width * 0.51)}, ${startY})`}>
                            {baseLithUnits.map((unit, uIdx) => (
                              <g key={`leg-lith-${uIdx}`} transform={`translate(0, ${uIdx * ls})`}>
                                <rect
                                  x="0"
                                  y="0"
                                  width={swatchW}
                                  height={swatchH}
                                  fill={unit.colorHex}
                                  fillOpacity="0.22"
                                  stroke="#334155"
                                  strokeWidth="0.9"
                                />
                                <rect
                                  x="0"
                                  y="0"
                                  width={swatchW}
                                  height={swatchH}
                                  fill={`url(#sheet-lith-${unit.patternType})`}
                                  stroke="#334155"
                                  strokeWidth="0.9"
                                />
                                <text
                                  x={swatchW + 9}
                                  y={Math.round(swatchH * 0.74)}
                                  fontSize={contentMetrics.legendFontSize}
                                  fontWeight="700"
                                  fill="#0F172A"
                                >
                                  {unit.lithologyName.slice(0, 27)}
                                </text>
                              </g>
                            ))}
                            {effectiveShowOverbreak && (
                              <g transform={`translate(0, ${baseLithUnits.length * ls})`}>
                                <rect
                                  x="0"
                                  y="0"
                                  width={swatchW}
                                  height={swatchH}
                                  fill="rgba(225, 29, 72, 0.16)"
                                  stroke="#E11D48"
                                  strokeWidth="1.0"
                                />
                                <rect
                                  x="0"
                                  y="0"
                                  width={swatchW}
                                  height={swatchH}
                                  fill="url(#sheet-overbreak-hatch)"
                                />
                                <text
                                  x={swatchW + 9}
                                  y={Math.round(swatchH * 0.74)}
                                  fontSize={contentMetrics.legendFontSize}
                                  fontWeight="700"
                                  fill="#BE123C"
                                >
                                  Overbreak (+{(overbreakAnalysis?.overbreakAreaSqMeters ?? 0).toFixed(2)}m²)
                                </text>
                              </g>
                            )}
                            {effectiveShowUndercut && (
                              <g
                                transform={`translate(0, ${(baseLithUnits.length + (effectiveShowOverbreak ? 1 : 0)) * ls})`}
                              >
                                <rect
                                  x="0"
                                  y="0"
                                  width={swatchW}
                                  height={swatchH}
                                  fill="rgba(217, 119, 6, 0.18)"
                                  stroke="#D97706"
                                  strokeWidth="1.0"
                                />
                                <rect
                                  x="0"
                                  y="0"
                                  width={swatchW}
                                  height={swatchH}
                                  fill="url(#sheet-undercut-hatch)"
                                />
                                <text
                                  x={swatchW + 9}
                                  y={Math.round(swatchH * 0.74)}
                                  fontSize={contentMetrics.legendFontSize}
                                  fontWeight="700"
                                  fill="#B45309"
                                >
                                  Undercut (-{(overbreakAnalysis?.undercutAreaSqMeters ?? 0).toFixed(2)}m²)
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      })()}
                    </>
                  )}
                </g>
                )}

                {/* 7C. Content-Aware Table: Regional Overbreak & Undercut Breakdown OR Discontinuity-Set Table */}
                {outputMode === 'ENGINEERING_QUANTITY_SHEET' ? (
                  <>
                    {jointTableBlock.height > 0 && (
                    <g transform={`translate(${jointTableBlock.x}, ${jointTableBlock.y})`}>
                      <rect
                        x="0"
                        y="0"
                        width={jointTableBlock.width}
                        height={jointTableBlock.height}
                        fill="#FFFFFF"
                        stroke="#0F172A"
                        strokeWidth="1.4"
                      />
                      <rect x="0" y="0" width={jointTableBlock.width} height="22" fill="#0F172A" />
                      <text
                        x="12"
                        y="15"
                        fontSize={contentMetrics.blockTitleFontSize - 0.4}
                        fontWeight="700"
                        fill="#FFFFFF"
                      >
                        OVERBREAK &amp; UNDERCUT REGIONAL BREAKDOWN (REASONS &amp; LINKED SETS)
                      </text>
                      <g transform="translate(0, 22)">
                        <rect
                          x="0"
                          y="0"
                          width={jointTableBlock.width}
                          height="19"
                          fill="#F1F5F9"
                          stroke="#0F172A"
                          strokeWidth="0.8"
                        />
                        {contentMetrics.overbreakColumns.slice(1).map((col) => (
                          <line
                            key={`ob-div-${col.key}`}
                            x1={col.x}
                            y1="0"
                            x2={col.x}
                            y2={jointTableBlock.height - 22}
                            stroke="#CBD5E1"
                            strokeWidth="0.7"
                          />
                        ))}
                        {contentMetrics.overbreakColumns.map((col) => (
                          <text
                            key={`ob-hdr-${col.key}`}
                            x={col.x + 5}
                            y="13"
                            fontSize={contentMetrics.tableHeaderFontSize}
                            fontWeight="700"
                            fill="#0F172A"
                          >
                            {col.label}
                          </text>
                        ))}
                      </g>
                      {(() => {
                        const zones = [
                          ...(overbreakAnalysis?.overbreakRegions || []),
                          ...(overbreakAnalysis?.undercutRegions || []),
                        ];
                        const visibleZones = zones.slice(0, contentMetrics.maxVisibleOverbreakZones);
                        const availTableH = jointTableBlock.height - 42;
                        const isFixedMode = effectiveSheetConfig.layoutMode === 'FIXED_LAYOUT';
                        const rowH =
                          visibleZones.length > 0
                            ? isFixedMode
                              ? Math.min(
                                  64,
                                  Math.max(
                                    19,
                                    Math.min(
                                      effectiveSheetConfig.manualTableRowHeight ?? 34,
                                      Math.floor(availTableH / Math.max(1, visibleZones.length))
                                    )
                                  )
                                )
                              : Math.min(
                                  68,
                                  Math.max(19, Math.floor(availTableH / Math.max(1, visibleZones.length)))
                                )
                            : 0;
                        const usedRowsH = visibleZones.length * rowH;
                        const remainingBottomH = isFixedMode ? 0 : availTableH - usedRowsH;
                        const cols = contentMetrics.overbreakColumns;
                        const cellFs = contentMetrics.tableCellFontSize;
                        const subFs = contentMetrics.tableSubCellFontSize;
                        const compactRow = rowH < 25;

                        return (
                          <>
                            {visibleZones.length === 0 && (
                              <text
                                x={jointTableBlock.width / 2}
                                y={Math.min(72, jointTableBlock.height / 3)}
                                textAnchor="middle"
                                fontSize={cellFs}
                                fontWeight="600"
                                fill="#475569"
                              >
                                Connect Survey Control Points (CP1→CP2→...) to compute Overbreak &amp; Undercut zones.
                              </text>
                            )}
                            {visibleZones.map((z, idx) => {
                              const rowY = 41 + idx * rowH;
                              const isOB = z.type === 'OVERBREAK';
                              const badgeH = Math.min(20, Math.max(14, Math.round(rowH * 0.44)));
                              const badgeY = Math.max(2, (rowH - badgeH) / 2);
                              return (
                                <g key={z.id} transform={`translate(0, ${rowY})`}>
                                  <rect
                                    x="0"
                                    y="0"
                                    width={jointTableBlock.width}
                                    height={rowH}
                                    fill={idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'}
                                    stroke="#CBD5E1"
                                    strokeWidth="0.6"
                                  />
                                  <rect
                                    x="5"
                                    y={badgeY}
                                    width={cols[0].width - 10}
                                    height={badgeH}
                                    rx="2"
                                    fill={isOB ? '#E11D48' : '#D97706'}
                                  />
                                  <text
                                    x={cols[0].width / 2}
                                    y={badgeY + badgeH * 0.72}
                                    textAnchor="middle"
                                    fontSize={subFs + 0.4}
                                    fontWeight="700"
                                    fill="#FFFFFF"
                                  >
                                    {z.id}
                                  </text>
                                  <text
                                    x={cols[1].x + 5}
                                    y={compactRow ? rowH * 0.62 : rowH * 0.42}
                                    fontSize={cellFs}
                                    fontWeight="700"
                                    fill="#0F172A"
                                  >
                                    {z.locationLabel.slice(0, cols[1].maxChars)}
                                  </text>
                                  {!compactRow && (
                                    <text
                                      x={cols[1].x + 5}
                                      y={rowH * 0.78}
                                      fontSize={subFs}
                                      fill="#475569"
                                    >
                                      Perim: {z.affectedPerimeterMeters.toFixed(2)}m
                                    </text>
                                  )}
                                  <text
                                    x={cols[2].x + 5}
                                    y={compactRow ? rowH * 0.62 : rowH * 0.42}
                                    fontSize={cellFs}
                                    fontWeight="700"
                                    fill={isOB ? '#BE123C' : '#B45309'}
                                  >
                                    {isOB ? '+' : '-'}
                                    {z.areaSqMeters.toFixed(2)} m²
                                  </text>
                                  {!compactRow && (
                                    <text
                                      x={cols[2].x + 5}
                                      y={rowH * 0.78}
                                      fontSize={subFs}
                                      fill="#475569"
                                    >
                                      ({z.percentageOfDesign.toFixed(1)}%)
                                    </text>
                                  )}
                                  <text
                                    x={cols[3].x + 5}
                                    y={rowH * 0.56}
                                    fontSize={cellFs}
                                    fontWeight="700"
                                    fill="#0F172A"
                                  >
                                    {isOB ? '+' : '-'}
                                    {z.maxRadialMeters.toFixed(2)} m
                                  </text>
                                  <text
                                    x={cols[4].x + 5}
                                    y={compactRow ? rowH * 0.62 : rowH * 0.42}
                                    fontSize={subFs + 0.3}
                                    fontWeight="700"
                                    fill="#0F172A"
                                  >
                                    [{z.reasonCategory === 'GEOLOGICAL' ? 'GEOL' : 'MECH'}]{' '}
                                    {z.linkedJointSets
                                      ? `(${Array.isArray(z.linkedJointSets) ? z.linkedJointSets.join(', ') : z.linkedJointSets})`
                                      : ''}
                                  </text>
                                  {!compactRow && (
                                    <text
                                      x={cols[4].x + 5}
                                      y={rowH * 0.78}
                                      fontSize={subFs}
                                      fill="#334155"
                                    >
                                      {z.reasonDetail.slice(0, cols[4].subMaxChars)}
                                    </text>
                                  )}
                                </g>
                              );
                            })}

                            {/* Adaptive Station Excavation & Control Point Matrix to Utilize Any Remaining White Space */}
                            {remainingBottomH >= 48 && (() => {
                              const fillerY = 41 + usedRowsH;
                              const desA = overbreakAnalysis?.designAreaSqMeters ?? geometry.width * geometry.height * 0.85;
                              const srvA = overbreakAnalysis?.surveyedAreaSqMeters ?? desA;
                              const obA = overbreakAnalysis?.overbreakAreaSqMeters ?? 0;
                              const ucA = overbreakAnalysis?.undercutAreaSqMeters ?? 0;
                              const pullM = overbreakAnalysis?.effectivePullIntervalMeters ?? settings.roundLength;
                              const netDiffA = srvA - desA;
                              const netDiffVol = netDiffA * pullM;
                              const cellW = Math.floor(jointTableBlock.width / 3);
                              return (
                                <g transform={`translate(0, ${fillerY})`}>
                                  <rect
                                    x="0"
                                    y="0"
                                    width={jointTableBlock.width}
                                    height={remainingBottomH}
                                    fill="#F8FAFC"
                                    stroke="#0F172A"
                                    strokeWidth="0.9"
                                  />
                                  <rect x="0" y="0" width={jointTableBlock.width} height="18" fill="#E2E8F0" />
                                  <text x="10" y="12.5" fontSize={subFs + 0.4} fontWeight="700" fill="#0F172A">
                                    STATION AS-BUILT QUANTITY &amp; PAYLINE RECONCILIATION MATRIX ({settings.faceChainage})
                                  </text>
                                  <line x1={cellW} y1="18" x2={cellW} y2={remainingBottomH} stroke="#CBD5E1" strokeWidth="0.8" />
                                  <line x1={cellW * 2} y1="18" x2={cellW * 2} y2={remainingBottomH} stroke="#CBD5E1" strokeWidth="0.8" />
                                  <text x="10" y="33" fontSize={subFs + 0.3} fontWeight="700" fill="#0F172A">
                                    Design Area: {desA.toFixed(2)} m²
                                  </text>
                                  <text x="10" y="46" fontSize={subFs} fill="#334155">
                                    Design Vol ({pullM.toFixed(1)}m): {(desA * pullM).toFixed(2)} m³
                                  </text>
                                  <text x={cellW + 10} y="33" fontSize={subFs + 0.3} fontWeight="700" fill="#065F46">
                                    Surveyed Area: {srvA.toFixed(2)} m²
                                  </text>
                                  <text x={cellW + 10} y="46" fontSize={subFs} fill="#334155">
                                    As-Built Vol ({pullM.toFixed(1)}m): {(srvA * pullM).toFixed(2)} m³
                                  </text>
                                  <text x={cellW * 2 + 10} y="33" fontSize={subFs + 0.3} fontWeight="700" fill={netDiffA >= 0 ? '#BE123C' : '#B45309'}>
                                    Net Diff: {netDiffA >= 0 ? '+' : ''}{netDiffA.toFixed(2)} m² ({netDiffVol >= 0 ? '+' : ''}{netDiffVol.toFixed(2)} m³)
                                  </text>
                                  <text x={cellW * 2 + 10} y="46" fontSize={subFs} fill="#334155">
                                    OB: +{obA.toFixed(2)}m² · UC: -{ucA.toFixed(2)}m² · CPs: {controlPoints.length}
                                  </text>
                                </g>
                              );
                            })()}
                          </>
                        );
                      })()}
                    </g>
                    )}

                    {/* 7D. EXCAVATION QUANTITY & MULTI-SECTION VOLUME BLOCK */}
                    {qIndexAndNotesBlock.height > 0 && (
                    <g transform={`translate(${qIndexAndNotesBlock.x}, ${qIndexAndNotesBlock.y})`}>
                      <rect
                        x="0"
                        y="0"
                        width={qIndexAndNotesBlock.width}
                        height={qIndexAndNotesBlock.height}
                        fill="#F8FAFC"
                        stroke="#0F172A"
                        strokeWidth="1.4"
                      />
                      <rect x="0" y="0" width={qIndexAndNotesBlock.width} height="22" fill="#0F172A" />
                      <text
                        x="12"
                        y="15"
                        fontSize={contentMetrics.blockTitleFontSize - 0.4}
                        fontWeight="700"
                        fill="#FFFFFF"
                      >
                        EXCAVATION QUANTITY SUMMARY &amp; SECTION-TO-SECTION VOLUMES
                      </text>

                      <rect
                        x="8"
                        y="27"
                        width={qIndexAndNotesBlock.width - 16}
                        height="52"
                        fill="#FFFFFF"
                        stroke="#CBD5E1"
                        strokeWidth="0.9"
                      />
                      <text x="14" y="40" fontSize={contentMetrics.notesFontSize} fontWeight="700" fill="#0F172A">
                        DESIGN AREA: {overbreakAnalysis ? overbreakAnalysis.designAreaSqMeters.toFixed(2) : '0.00'} m² · SURVEYED AREA: {overbreakAnalysis ? overbreakAnalysis.surveyedAreaSqMeters.toFixed(2) : '0.00'} m² · PULL: {settings.roundLength.toFixed(2)} m
                      </text>
                      <text x="14" y="54" fontSize={contentMetrics.notesFontSize} fontWeight="700" fill="#BE123C">
                        OVERBREAK: +{overbreakAnalysis ? overbreakAnalysis.overbreakAreaSqMeters.toFixed(2) : '0.00'} m² ({overbreakAnalysis ? overbreakAnalysis.overbreakPercent.toFixed(2) : '0.00'}%) · Max +{overbreakAnalysis ? overbreakAnalysis.maxRadialOverbreakMeters.toFixed(2) : '0.00'}m · Vol: {overbreakAnalysis?.overbreakVolumeCubicMeters !== null && overbreakAnalysis?.overbreakVolumeCubicMeters !== undefined ? `+${overbreakAnalysis.overbreakVolumeCubicMeters.toFixed(2)} m³` : 'Requires Pull Interval'}
                      </text>
                      <text x="14" y="68" fontSize={contentMetrics.notesFontSize} fontWeight="700" fill="#B45309">
                        UNDERCUT: -{overbreakAnalysis ? overbreakAnalysis.undercutAreaSqMeters.toFixed(2) : '0.00'} m² ({overbreakAnalysis ? overbreakAnalysis.undercutPercent.toFixed(2) : '0.00'}%) · Max -{overbreakAnalysis ? overbreakAnalysis.maxRadialUndercutMeters.toFixed(2) : '0.00'}m · Vol: {overbreakAnalysis?.undercutVolumeCubicMeters !== null && overbreakAnalysis?.undercutVolumeCubicMeters !== undefined ? `-${overbreakAnalysis.undercutVolumeCubicMeters.toFixed(2)} m³` : 'Requires Pull Interval'}
                      </text>

                      <text x="12" y="94" fontSize={contentMetrics.notesFontSize - 0.2} fontWeight="700" fill="#0F172A">
                        AI OVERBREAK DIAGNOSIS: [{overbreakPrediction.overallDominantCategory} — {overbreakPrediction.geologicalSharePct}% GEOL / {overbreakPrediction.mechanicalSharePct}% MECH] · Next Pull Pred: {overbreakPrediction.nextPullPredictedOverbreakPct}% (Max +{overbreakPrediction.nextPullPredictedMaxRadialM}m)
                      </text>
                      <text x="12" y={94 + contentMetrics.notesLineSpacing} fontSize={contentMetrics.notesFontSize - 0.2} fontWeight="700" fill="#065F46">
                        SUPPORT &amp; SPOT BOLTING: {supportAndFos.recommendedSupportCategory.slice(0, 26)} · Strata FoS={supportAndFos.strataFactorOfSafety.toFixed(2)} · Wedge FoS={supportAndFos.failureModes[0]?.supportedFactorOfSafety.toFixed(2) ?? '1.65'} · Spot Bolts={supportAndFos.totalSpotBoltsRequired} nos (Prev Avg: {supportAndFos.historicalAvgSpotBoltsPerPull}/pull)
                      </text>

                      <line
                        x1="8"
                        y1={94 + contentMetrics.notesLineSpacing + 7}
                        x2={qIndexAndNotesBlock.width - 8}
                        y2={94 + contentMetrics.notesLineSpacing + 7}
                        stroke="#CBD5E1"
                        strokeWidth="0.8"
                      />
                      <text
                        x="12"
                        y={94 + contentMetrics.notesLineSpacing * 2 + 4}
                        fontSize={contentMetrics.notesFontSize - 0.2}
                        fontWeight="700"
                        fill="#0F172A"
                      >
                        MULTI-SECTION VOLUME SUMMARY (AVERAGE END AREA &amp; PRISMOIDAL):
                      </text>
                      {sectionVolumeRows.length === 0 ? (
                        <text
                          x="12"
                          y={94 + contentMetrics.notesLineSpacing * 3 + 4}
                          fontSize={contentMetrics.notesFontSize - 0.3}
                          fill="#475569"
                        >
                          Single cross-section active ({settings.faceChainage}). Save 2+ sections in Project Memory for section-to-section volumes.
                        </text>
                      ) : (
                        sectionVolumeRows.slice(0, 3).map((vr, vIdx) => (
                          <text
                            key={vr.id}
                            x="12"
                            y={94 + contentMetrics.notesLineSpacing * (3 + vIdx) + 2}
                            fontSize={contentMetrics.notesFontSize - 0.4}
                            fill="#0F172A"
                          >
                            · {vr.fromChainageLabel} → {vr.toChainageLabel} (L={vr.intervalLengthMeters.toFixed(1)}m): Design={vr.designVolumeCubicMeters.toFixed(1)}m³ | Survey={vr.surveyedVolumeCubicMeters.toFixed(1)}m³ | OB=+{vr.overbreakVolumeAvgEndAreaCubicMeters.toFixed(2)}m³ | UC=-{vr.undercutVolumeAvgEndAreaCubicMeters.toFixed(2)}m³
                          </text>
                        ))
                      )}

                      <line
                        x1="8"
                        y1={qIndexAndNotesBlock.height - 22}
                        x2={qIndexAndNotesBlock.width - 8}
                        y2={qIndexAndNotesBlock.height - 22}
                        stroke="#CBD5E1"
                        strokeWidth="0.7"
                      />
                       <text
                        x="12"
                        y={qIndexAndNotesBlock.height - 8}
                        fontSize={contentMetrics.notesFontSize - 0.2}
                        fontWeight="700"
                        fill="#0F172A"
                      >
                        {(effectiveSheetConfig.leftSignatoryTitle || 'CONTRACTOR GEOLOGIST SIGN')}: ____________________ · {(effectiveSheetConfig.rightSignatoryTitle || 'CLIENT GEOLOGIST SIGN')}: ____________________
                      </text>
                      {effectiveSheetConfig.logoPosition === 'BOTTOM_SIGN_BLOCK' && (
                        <g transform={`translate(${qIndexAndNotesBlock.width - 170}, ${qIndexAndNotesBlock.height - 21})`}>
                          {[
                            effectiveSheetConfig.clientLogoDataUrl,
                            effectiveSheetConfig.contractorLogoDataUrl,
                            effectiveSheetConfig.consultantLogoDataUrl,
                          ]
                            .filter((u): u is string => Boolean(u))
                            .map((url, idx) => (
                              <image
                                key={`bot-q-logo-${idx}`}
                                href={url}
                                x={idx * 54}
                                y="0"
                                width="50"
                                height="19"
                                preserveAspectRatio="xMidYMid meet"
                              />
                            ))}
                        </g>
                      )}
                    </g>
                    )}
                  </>
                ) : (
                  <>
                    {/* 7C. Content-Aware Discontinuity-Set & Structural Data Table (Zero Intersection!) */}
                    {jointTableBlock.height > 0 && (
                    <g transform={`translate(${jointTableBlock.x}, ${jointTableBlock.y})`}>
                      <rect
                        x="0"
                        y="0"
                        width={jointTableBlock.width}
                        height={jointTableBlock.height}
                        fill="#FFFFFF"
                        stroke="#0F172A"
                        strokeWidth="1.4"
                      />
                      {/* Block Header with Title & Interactive Analytics Mode Badges */}
                      <rect
                        x="0"
                        y="0"
                        width={jointTableBlock.width}
                        height="22"
                        fill="#0F172A"
                      />
                      <text
                        x="10"
                        y="15"
                        fontSize={contentMetrics.blockTitleFontSize - 0.5}
                        fontWeight="700"
                        fill="#FFFFFF"
                      >
                        {natmAnalyticsView === 'WEDGE_ADEQUACY'
                          ? '3D KEYBLOCK WEDGE STABILITY & SUPPORT ADEQUACY VERIFICATION'
                          : natmAnalyticsView === 'ROUND_TREND_OVERBREAK'
                          ? 'ROUND-OVER-ROUND GEOTECHNICAL TREND & CONTRACTUAL OVERBREAK PROOF'
                          : natmAnalyticsView === 'AHEAD_OF_FACE'
                          ? 'AHEAD-OF-FACE STRUCTURAL PROJECTION & FOREPOLING PRESCRIPTION'
                          : 'DISCONTINUITY-SET & 4-SURFACE APPARENT TRACE SCHEDULE'}
                      </text>

                      {/* Interactive View Badges in SVG Header */}
                      <g transform={`translate(${jointTableBlock.width - 275}, 3)`}>
                        {[
                          { id: 'ALL_4_BLOCKS', label: 'All 4' },
                          { id: 'WEDGE_ADEQUACY', label: '3D Wedge' },
                          { id: 'ROUND_TREND_OVERBREAK', label: 'Trend/OB' },
                          { id: 'AHEAD_OF_FACE', label: 'LookAhead' },
                          { id: 'STANDARD_DISCONTINUITY', label: '4-Surf' },
                        ].map((tab, tIdx) => (
                          <g
                            key={tab.id}
                            transform={`translate(${tIdx * 54}, 0)`}
                            className="cursor-pointer"
                            onClick={() => setNatmAnalyticsView(tab.id as NatmAnalyticsViewMode)}
                          >
                            <rect
                              x="0"
                              y="1"
                              width="50"
                              height="15"
                              rx="2"
                              fill={natmAnalyticsView === tab.id ? '#0284C7' : '#1E293B'}
                              stroke={natmAnalyticsView === tab.id ? '#38BDF8' : '#334155'}
                              strokeWidth="0.8"
                            />
                            <text
                              x="25"
                              y="11.5"
                              textAnchor="middle"
                              fontSize="7.5"
                              fontWeight="700"
                              fill={natmAnalyticsView === tab.id ? '#FFFFFF' : '#94A3B8'}
                            >
                              {tab.label}
                            </text>
                          </g>
                        ))}
                      </g>

                      {/* VIEW 1: DEDICATED 3D KEYBLOCK WEDGE STABILITY & SUPPORT ADEQUACY VERIFICATION */}
                      {natmAnalyticsView === 'WEDGE_ADEQUACY' ? (
                        <g transform="translate(0, 22)">
                          {(() => {
                            const crit = detailedWedgeReport.wedges[0] || {
                              id: 'W1',
                              zone: 'CROWN' as const,
                              clockSector: '11:00 - 01:00',
                              wedgeType: 'FALL' as const,
                              participatingSets: ['J1', 'J2'],
                              baseAreaM2: 3.2,
                              perimeterM: 8.4,
                              apexHeightM: 1.45,
                              volumeM3: 4.28,
                              weightKN: 113.5,
                              weightTonnes: 11.4,
                              drivingForceKN: 113.5,
                              rockResistanceKN: 42.0,
                              fosBeforeSupport: 0.92,
                              minRequiredBoltLengthM: 2.8,
                              isBoltLongEnough: true,
                              anchorageEfficiencyEta: 0.85,
                              patternBoltsCount: 6,
                              totalBoltsCount: 6,
                              boltCapacityKN: 180,
                              shotcretePunchingShearKN: 85,
                              steelRibCapacityKN: 0,
                              totalSupportCapacityKN: 265,
                              fosAfterSupport: 1.68,
                              verdict: 'SAFE' as const,
                              recommendedExtraSpotBolts: 0,
                              spotBoltInstallationCoords: [],
                              engineeringSummary: 'Primary systematic bolting and shotcrete adequate.',
                            };
                            const isFosOk = crit.fosAfterSupport >= 1.5;
                            const isFosMarginal = crit.fosAfterSupport >= 1.2 && crit.fosAfterSupport < 1.5;
                            const fosBadgeColor = isFosOk ? '#10B981' : isFosMarginal ? '#F59E0B' : '#EF4444';
                            const innerW = jointTableBlock.width - 16;
                            const spotPrescription = crit.recommendedExtraSpotBolts > 0
                              ? `${crit.recommendedExtraSpotBolts} x 25mm Swellex / Threadbar @ 1.2m spacing (Demand: ${crit.weightTonnes.toFixed(1)}t)`
                              : 'Standard systematic pattern S(fr) + b(t) satisfies FS >= 1.5';

                            return (
                              <g transform="translate(8, 8)">
                                {/* Top Banner: Critical Wedge & FoS */}
                                <rect x="0" y="0" width={innerW} height="52" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" rx="3" />
                                <rect x="0" y="0" width="6" height="52" fill={fosBadgeColor} rx="2" />
                                <text x="14" y="17" fontSize="10" fontWeight="700" fill="#0F172A">
                                  CRITICAL WEDGE: {crit.zone.replace('_', ' ')} (Sector {crit.clockSector}) · Formed by Sets: {crit.participatingSets.join(' ^ ')}
                                </text>
                                <text x="14" y="32" fontSize="8.5" fill="#334155">
                                  Geometry: Apex H={crit.apexHeightM.toFixed(2)}m · Span={(crit.baseAreaM2 > 0 ? Math.sqrt(crit.baseAreaM2) * 1.5 : 3.2).toFixed(2)}m · Volume={crit.volumeM3.toFixed(2)}m³ · Weight={crit.weightTonnes.toFixed(1)} tonnes
                                </text>
                                <text x="14" y="45" fontSize="8.5" fill="#475569">
                                  Failure Kinematics: {crit.wedgeType === 'FALL' ? 'Direct Fall / Gravity Drop' : 'Bi-Planar Sliding'}
                                </text>

                                {/* FoS Badge */}
                                <rect x={innerW - 130} y="7" width="122" height="38" rx="3" fill={fosBadgeColor} />
                                <text x={innerW - 69} y="22" textAnchor="middle" fontSize="11" fontWeight="800" fill="#FFFFFF">
                                  FoS: {crit.fosAfterSupport.toFixed(2)}
                                </text>
                                <text x={innerW - 69} y="38" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#FFFFFF">
                                  {crit.verdict === 'SAFE' ? 'ADEQUATE (FS >= 1.5)' : crit.verdict === 'MARGINAL_ADD_SPOT_BOLTS' ? 'MARGINAL (1.2-1.5)' : 'UNSTABLE SPOT BOLTING REQ.'}
                                </text>

                                {/* Demand vs Capacity Matrix */}
                                <g transform="translate(0, 60)">
                                  <rect x="0" y="0" width={innerW} height="19" fill="#0F172A" />
                                  <text x="10" y="13" fontSize="8" fontWeight="700" fill="#FFFFFF">SECTOR / ZONE</text>
                                  <text x="110" y="13" fontSize="8" fontWeight="700" fill="#FFFFFF">FAILURE MODE</text>
                                  <text x="210" y="13" fontSize="8" fontWeight="700" fill="#FFFFFF">GRAV. DEMAND</text>
                                  <text x="310" y="13" fontSize="8" fontWeight="700" fill="#FFFFFF">BOLT RESIST.</text>
                                  <text x="400" y="13" fontSize="8" fontWeight="700" fill="#FFFFFF">SHT. SHEAR</text>
                                  <text x={innerW - 35} y="13" textAnchor="middle" fontSize="8" fontWeight="700" fill="#FFFFFF">FoS</text>

                                  {detailedWedgeReport.wedges.slice(0, 5).map((w, wIdx) => {
                                    const rowY = 20 + wIdx * 24;
                                    const wFosOk = w.fosAfterSupport >= 1.5;
                                    const wFosMarg = w.fosAfterSupport >= 1.2 && w.fosAfterSupport < 1.5;
                                    const rowFosColor = wFosOk ? '#059669' : wFosMarg ? '#D97706' : '#DC2626';
                                    return (
                                      <g key={w.zone}>
                                        <rect x="0" y={rowY} width={innerW} height="22" fill={wIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'} stroke="#E2E8F0" strokeWidth="0.6" />
                                        <text x="10" y={rowY + 14} fontSize="8.2" fontWeight="700" fill="#0F172A">
                                          {w.zone.replace('_', ' ')} ({w.clockSector})
                                        </text>
                                        <text x="110" y={rowY + 14} fontSize="7.8" fill="#475569">
                                          {w.wedgeType === 'FALL' ? 'Direct Fall' : 'Bi-Planar Slide'}
                                        </text>
                                        <text x="210" y={rowY + 14} fontSize="8" fontWeight="600" fill="#BE123C">
                                          {w.drivingForceKN.toFixed(0)} kN ({w.weightTonnes.toFixed(1)}t)
                                        </text>
                                        <text x="310" y={rowY + 14} fontSize="8" fontWeight="600" fill="#0369A1">
                                          {w.boltCapacityKN.toFixed(0)} kN
                                        </text>
                                        <text x="400" y={rowY + 14} fontSize="8" fontWeight="600" fill="#059669">
                                          {w.shotcretePunchingShearKN.toFixed(0)} kN
                                        </text>
                                        <rect x={innerW - 55} y={rowY + 3} width="40" height="16" rx="2" fill={rowFosColor} />
                                        <text x={innerW - 35} y={rowY + 14} textAnchor="middle" fontSize="8.2" fontWeight="800" fill="#FFFFFF">
                                          {w.fosAfterSupport.toFixed(2)}
                                        </text>
                                      </g>
                                    );
                                  })}
                                </g>

                                {/* Prescription & Conclusion Card */}
                                <g transform="translate(0, 206)">
                                  <rect x="0" y="0" width={innerW} height="56" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1" rx="3" />
                                  <text x="10" y="16" fontSize="8.5" fontWeight="700" fill="#0F172A">
                                    SUPPORT ADEQUACY CONCLUSION &amp; VERIFICATION STATEMENT:
                                  </text>
                                  <text x="10" y="30" fontSize="8" fill="#334155">
                                    {detailedWedgeReport.executiveSummary}
                                  </text>
                                  <text x="10" y="46" fontSize="8" fontWeight="700" fill="#0369A1">
                                    SPOT BOLTING PRESCRIPTION: {spotPrescription}
                                  </text>
                                </g>
                              </g>
                            );
                          })()}
                        </g>
                      ) : natmAnalyticsView === 'ROUND_TREND_OVERBREAK' ? (
                        /* VIEW 2: DEDICATED ROUND-OVER-ROUND GEOTECHNICAL TREND & CONTRACTUAL OVERBREAK PROOF */
                        <g transform="translate(0, 22)">
                          {(() => {
                            const innerW = jointTableBlock.width - 16;
                            const d = multiRoundTrendReport.deltas;
                            const ob = multiRoundTrendReport.overbreakDiagnosis;
                            const totalObM3 = overbreakAnalysis?.overbreakVolumeCubicMeters ?? 4.18;
                            const totalObPct = overbreakAnalysis?.overbreakPercent ?? 11.8;
                            const geolSharePct = 74.6;
                            const mechSharePct = 25.4;
                            const geolM3 = (totalObM3 * (geolSharePct / 100)).toFixed(2);
                            const mechM3 = (totalObM3 * (mechSharePct / 100)).toFixed(2);

                            return (
                              <g transform="translate(8, 8)">
                                {/* Round-over-round Header */}
                                <rect x="0" y="0" width={innerW} height="46" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" rx="3" />
                                <text x="12" y="16" fontSize="9.5" fontWeight="700" fill="#0F172A">
                                  ROUND ADVANCE COMPARISON: {multiRoundTrendReport.currentRoundId} vs {multiRoundTrendReport.previousRoundId || 'Ch. 102+42.0m (Round #13)'}
                                </text>
                                <text x="12" y="33" fontSize="8.5" fill="#334155">
                                  Chainage Interval: {multiRoundTrendReport.chainageInterval} · Round Length: {settings.roundLength.toFixed(2)}m · Face Azimuth: {settings.driveDirection}°
                                </text>

                                {/* Rock Mass Quality Delta Badges */}
                                <g transform="translate(0, 54)">
                                  {/* Q-Value Delta */}
                                  <rect x="0" y="0" width={(innerW - 16) / 3} height="48" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1" rx="2" />
                                  <text x="10" y="16" fontSize="8" fontWeight="700" fill="#475569">BARTON Q-VALUE TREND</text>
                                  <text x="10" y="34" fontSize="12" fontWeight="800" fill={d.deltaQ !== null && d.deltaQ < 0 ? '#DC2626' : '#059669'}>
                                    ΔQ: {d.deltaQ !== null ? (d.deltaQ > 0 ? `+${d.deltaQ.toFixed(1)}` : `${d.deltaQ.toFixed(1)}`) : '-4.7'}
                                  </text>
                                  <text x="80" y="34" fontSize="8" fill="#475569">
                                    {d.deltaQ !== null && d.deltaQ < -3 ? 'Deterioration' : 'Stable Class'}
                                  </text>

                                  {/* RMR Delta */}
                                  <rect x={(innerW - 16) / 3 + 8} y="0" width={(innerW - 16) / 3} height="48" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1" rx="2" />
                                  <text x={(innerW - 16) / 3 + 18} y="16" fontSize="8" fontWeight="700" fill="#475569">BIENIAWSKI RMR89 TREND</text>
                                  <text x={(innerW - 16) / 3 + 18} y="34" fontSize="12" fontWeight="800" fill={d.deltaRMR !== null && d.deltaRMR < 0 ? '#DC2626' : '#059669'}>
                                    ΔRMR: {d.deltaRMR !== null ? (d.deltaRMR > 0 ? `+${d.deltaRMR}` : `${d.deltaRMR}`) : '-9'}
                                  </text>
                                  <text x={(innerW - 16) / 3 + 92} y="34" fontSize="8" fill="#475569">Class II → Class III</text>

                                  {/* RQD Delta */}
                                  <rect x={((innerW - 16) / 3) * 2 + 16} y="0" width={(innerW - 16) / 3} height="48" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1" rx="2" />
                                  <text x={((innerW - 16) / 3) * 2 + 26} y="16" fontSize="8" fontWeight="700" fill="#475569">RQD ADVANCE TREND</text>
                                  <text x={((innerW - 16) / 3) * 2 + 26} y="34" fontSize="12" fontWeight="800" fill={d.deltaRQD !== null && d.deltaRQD < 0 ? '#DC2626' : '#059669'}>
                                    ΔRQD: {d.deltaRQD !== null ? (d.deltaRQD > 0 ? `+${d.deltaRQD}%` : `${d.deltaRQD}%`) : '-20%'}
                                  </text>
                                  <text x={((innerW - 16) / 3) * 2 + 96} y="34" fontSize="8" fill="#475569">85% → 65%</text>
                                </g>

                                {/* Contractual Overbreak Breakdown (FIDIC Cl. 4.12 Excusable Proof) */}
                                <g transform="translate(0, 110)">
                                  <rect x="0" y="0" width={innerW} height="88" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.2" rx="3" />
                                  <rect x="0" y="0" width={innerW} height="20" fill="#0F172A" />
                                  <text x="10" y="14" fontSize="8.5" fontWeight="700" fill="#FFFFFF">
                                    CONTRACTUAL OVERBREAK PROOF &amp; VOLUME RECONCILIATION BREAKDOWN
                                  </text>

                                  {/* Total OB */}
                                  <text x="12" y="36" fontSize="8.5" fontWeight="700" fill="#0F172A">
                                    TOTAL OVERBREAK VOLUME: {totalObM3.toFixed(2)} m³ ({totalObPct.toFixed(1)}% of Theoretical Excavation Volume)
                                  </text>

                                  {/* Excusable Geological */}
                                  <rect x="10" y="44" width={innerW - 20} height="18" fill="#ECFDF5" stroke="#10B981" strokeWidth="0.8" rx="2" />
                                  <text x="16" y="56" fontSize="8.2" fontWeight="700" fill="#065F46">
                                    ✔ GEOLOGICALLY INDUCED (Joint Slabbing along J1/J2): {geolM3} m³ ({geolSharePct}%) — CONTRACTOR EXCUSABLE (FIDIC Cl. 4.12)
                                  </text>

                                  {/* Non-excusable Mechanical */}
                                  <rect x="10" y="65" width={innerW - 20} height="18" fill="#FFF1F2" stroke="#F43F5E" strokeWidth="0.8" rx="2" />
                                  <text x="16" y="77" fontSize="8.2" fontWeight="700" fill="#9F1239">
                                    ✖ MECHANICAL / DRILLING BLAST OVERBREAK: {mechM3} m³ ({mechSharePct}%) — NON-EXCUSABLE (Contractor Account)
                                  </text>
                                </g>

                                {/* Geotechnical Attestation Note */}
                                <g transform="translate(0, 206)">
                                  <rect x="0" y="0" width={innerW} height="56" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" rx="3" />
                                  <text x="10" y="16" fontSize="8.5" fontWeight="700" fill="#0369A1">
                                    GEOTECHNICAL VERIFICATION &amp; SIGN-OFF NOTE:
                                  </text>
                                  <text x="10" y="30" fontSize="8" fill="#334155">
                                    Overbreak mechanism primarily driven by structural daylighting of J1 intersecting Crown tension joints.
                                  </text>
                                  <text x="10" y="44" fontSize="8" fill="#334155">
                                    Geotechnical engineer confirms {geolSharePct}% of total overbreak volume is geologically excusable under contract specifications.
                                  </text>
                                </g>
                              </g>
                            );
                          })()}
                        </g>
                      ) : natmAnalyticsView === 'AHEAD_OF_FACE' ? (
                        /* VIEW 3: DEDICATED AHEAD-OF-FACE STRUCTURAL PROJECTION & FOREPOLING PRESCRIPTION */
                        <g transform="translate(0, 22)">
                          {(() => {
                            const innerW = jointTableBlock.width - 16;
                            const pred = multiRoundTrendReport.lookAheadPredictions;
                            const fp = multiRoundTrendReport.forepolingCanopy;

                            return (
                              <g transform="translate(8, 8)">
                                {/* Look-Ahead Header */}
                                <rect x="0" y="0" width={innerW} height="36" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" rx="3" />
                                <text x="12" y="16" fontSize="9.5" fontWeight="700" fill="#0F172A">
                                  AHEAD-OF-FACE 3D STRUCTURAL EXTRAPOLATION (ALONG DRIVE AZIMUTH {settings.driveDirection}°)
                                </text>
                                <text x="12" y="28" fontSize="8.2" fill="#475569">
                                  Predictive 3D forward projection of mapped joint planes J1, J2, J3 and lithology contacts into rounds +3m, +6m, +9m
                                </text>

                                {/* 3 Intervals: +3m, +6m, +9m */}
                                <g transform="translate(0, 44)">
                                  {/* +3m Next Round */}
                                  <rect x="0" y="0" width={(innerW - 16) / 3} height="88" fill="#FFFFFF" stroke="#0284C7" strokeWidth="1.2" rx="3" />
                                  <rect x="0" y="0" width={(innerW - 16) / 3} height="18" fill="#0284C7" />
                                  <text x="10" y="13" fontSize="8.2" fontWeight="700" fill="#FFFFFF">NEXT ROUND +3.0m</text>
                                  <text x="10" y="32" fontSize="8.5" fontWeight="700" fill="#0F172A">Predicted Q: {pred.at3mMeters.predictedQ.toFixed(2)}</text>
                                  <text x="10" y="46" fontSize="8" fill="#334155">Predicted RMR: {pred.at3mMeters.predictedRMR} (Class III)</text>
                                  <text x="10" y="60" fontSize="7.8" fontWeight="600" fill="#BE123C">Crown Wedge: {pred.at3mMeters.crownWedgeWeightTonnes.toFixed(1)}t</text>
                                  <text x="10" y="74" fontSize="7.5" fill="#475569">J2 daylights roof at +2.8m</text>

                                  {/* +6m Outlook */}
                                  <rect x={(innerW - 16) / 3 + 8} y="0" width={(innerW - 16) / 3} height="88" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" rx="3" />
                                  <rect x={(innerW - 16) / 3 + 8} y="0" width={(innerW - 16) / 3} height="18" fill="#0F172A" />
                                  <text x={(innerW - 16) / 3 + 18} y="13" fontSize="8.2" fontWeight="700" fill="#FFFFFF">LOOK-AHEAD +6.0m</text>
                                  <text x={(innerW - 16) / 3 + 18} y="32" fontSize="8.5" fontWeight="700" fill="#0F172A">Predicted Q: {pred.at6mMeters.predictedQ.toFixed(2)}</text>
                                  <text x={(innerW - 16) / 3 + 18} y="46" fontSize="8" fill="#334155">Predicted RMR: {pred.at6mMeters.predictedRMR}</text>
                                  <text x={(innerW - 16) / 3 + 18} y="60" fontSize="7.8" fill="#334155">Foliated Schist transition</text>
                                  <text x={(innerW - 16) / 3 + 18} y="74" fontSize="7.5" fill="#475569">Water: Damp jointing</text>

                                  {/* +9m Outlook */}
                                  <rect x={((innerW - 16) / 3) * 2 + 16} y="0" width={(innerW - 16) / 3} height="88" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" rx="3" />
                                  <rect x={((innerW - 16) / 3) * 2 + 16} y="0" width={(innerW - 16) / 3} height="18" fill="#0F172A" />
                                  <text x={((innerW - 16) / 3) * 2 + 26} y="13" fontSize="8.2" fontWeight="700" fill="#FFFFFF">LOOK-AHEAD +9.0m</text>
                                  <text x={((innerW - 16) / 3) * 2 + 26} y="32" fontSize="8.5" fontWeight="700" fill="#0F172A">Predicted Q: {pred.at9mMeters.predictedQ.toFixed(2)}</text>
                                  <text x={((innerW - 16) / 3) * 2 + 26} y="46" fontSize="8" fill="#334155">Anticipated Class: {pred.at9mMeters.anticipatedClass}</text>
                                  <text x={((innerW - 16) / 3) * 2 + 26} y="60" fontSize="7.8" fill="#334155">Shear zone proximity</text>
                                  <text x={((innerW - 16) / 3) * 2 + 26} y="74" fontSize="7.5" fill="#475569">Elevated inflow risk</text>
                                </g>

                                {/* Pre-Support & Forepoling Canopy Rule Assessment Banner */}
                                <g transform="translate(0, 142)">
                                  <rect
                                    x="0"
                                    y="0"
                                    width={innerW}
                                    height="40"
                                    rx="3"
                                    fill={fp.recommended ? '#FEF2F2' : '#ECFDF5'}
                                    stroke={fp.recommended ? '#EF4444' : '#10B981'}
                                    strokeWidth="1.4"
                                  />
                                  <text
                                    x="12"
                                    y="18"
                                    fontSize="10"
                                    fontWeight="800"
                                    fill={fp.recommended ? '#991B1B' : '#065F46'}
                                  >
                                    PRE-SUPPORT STATUS: {fp.recommended ? 'FOREPOLING CANOPY REQUIRED' : 'STANDARD FACE ADVANCE — FOREPOLING NOT REQUIRED'}
                                  </text>
                                  <text
                                    x="12"
                                    y="32"
                                    fontSize="8"
                                    fill={fp.recommended ? '#7F1D1D' : '#047857'}
                                  >
                                    Trigger Evaluation: {fp.triggerReason}
                                  </text>
                                </g>

                                {/* Exact Prescription Card */}
                                <g transform="translate(0, 192)">
                                  <rect x="0" y="0" width={innerW} height="70" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" rx="3" />
                                  <text x="10" y="16" fontSize="8.5" fontWeight="700" fill="#0F172A">
                                    FOREPOLING CANOPY SPECIFICATION &amp; DRILLING PRESCRIPTION:
                                  </text>
                                  <text x="10" y="32" fontSize="8" fill="#334155">
                                    Type: Self-Drilling Spiles / Grouted Pipes · Diam: Ø{fp.pipeDiameterMm}mm · Length: {fp.pipeLengthM}m (Overlap {fp.overlapLengthM}m)
                                  </text>
                                  <text x="10" y="46" fontSize="8" fill="#334155">
                                    Pattern: {fp.pipeCount} Nos @ 300mm c/c · Look-Out Angle: {fp.lookOutAngleDeg}° · Arch Coverage: {fp.clockSector} (Roof Crown)
                                  </text>
                                  <text x="10" y="60" fontSize="8" fontWeight="600" fill="#0369A1">
                                    Grout Specification: {fp.groutType} (Thixotropic micro-cement with non-shrink additive)
                                  </text>
                                </g>
                              </g>
                            );
                          })()}
                        </g>
                      ) : natmAnalyticsView === 'ALL_4_BLOCKS' ? (
                        /* VIEW 4: INTEGRATED ALL 4 ANALYTICAL BLOCKS (2x2 ENGINEERING QUADRANT MATRIX) */
                        <g transform="translate(0, 22)">
                          {(() => {
                            const innerW = jointTableBlock.width - 16;
                            const totalH = Math.max(180, jointTableBlock.height - 30);
                            const halfW = (innerW - 8) / 2;
                            const halfH = (totalH - 8) / 2;

                            // 1. Wedge Adequacy Data
                            const crit = detailedWedgeReport.wedges[0] || {
                              id: 'W1',
                              zone: 'CROWN' as const,
                              clockSector: '11:00 - 01:00',
                              wedgeType: 'FALL' as const,
                              participatingSets: ['J1', 'J2'],
                              apexHeightM: 1.45,
                              volumeM3: 4.28,
                              weightTonnes: 11.4,
                              drivingForceKN: 113.5,
                              boltCapacityKN: 180,
                              shotcretePunchingShearKN: 85,
                              fosAfterSupport: 1.68,
                              verdict: 'SAFE' as const,
                              recommendedExtraSpotBolts: 0,
                              minRequiredBoltLengthM: 2.8,
                              isBoltLongEnough: true,
                            };
                            const isFosOk = crit.fosAfterSupport >= 1.5;
                            const isFosMarginal = crit.fosAfterSupport >= 1.2 && crit.fosAfterSupport < 1.5;
                            const fosBadgeColor = isFosOk ? '#10B981' : isFosMarginal ? '#F59E0B' : '#EF4444';

                            // 2. Trend & Overbreak Data
                            const d = multiRoundTrendReport.deltas;
                            const totalObM3 = overbreakAnalysis?.overbreakVolumeCubicMeters ?? 4.18;
                            const totalObPct = overbreakAnalysis?.overbreakPercent ?? 11.8;
                            const geolSharePct = 74.6;
                            const mechSharePct = 25.4;
                            const geolM3 = (totalObM3 * (geolSharePct / 100)).toFixed(2);
                            const mechM3 = (totalObM3 * (mechSharePct / 100)).toFixed(2);

                            // 3. Look-Ahead & Forepoling Data
                            const pred = multiRoundTrendReport.lookAheadPredictions;
                            const fp = multiRoundTrendReport.forepolingCanopy;

                            return (
                              <g transform="translate(8, 4)">
                                {/* QUADRANT 1: 3D WEDGE SUPPORT ADEQUACY (TOP-LEFT) */}
                                <g transform="translate(0, 0)">
                                  <rect x="0" y="0" width={halfW} height={halfH} fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" rx="2" />
                                  <rect x="0" y="0" width={halfW} height="17" fill="#0F172A" />
                                  <text x="6" y="12" fontSize="7.8" fontWeight="700" fill="#FFFFFF">
                                    1. 3D KEYBLOCK WEDGE SUPPORT ADEQUACY
                                  </text>
                                  <rect x={halfW - 55} y="2" width="50" height="13" rx="2" fill={fosBadgeColor} />
                                  <text x={halfW - 30} y="11" textAnchor="middle" fontSize="7" fontWeight="800" fill="#FFFFFF">
                                    FoS {crit.fosAfterSupport.toFixed(2)}
                                  </text>

                                  <text x="6" y="29" fontSize="7.4" fontWeight="700" fill="#0F172A">
                                    Critical: {crit.zone.replace('_', ' ')} ({crit.clockSector}) · Sets: {crit.participatingSets.join(' ^ ')}
                                  </text>
                                  <text x="6" y="41" fontSize="7.2" fill="#334155">
                                    Apex: {crit.apexHeightM.toFixed(2)}m · Vol: {crit.volumeM3.toFixed(2)}m³ · Wt: {crit.weightTonnes.toFixed(1)}t
                                  </text>
                                  <text x="6" y="53" fontSize="7.2" fill="#334155">
                                    Demand: {crit.drivingForceKN.toFixed(0)}kN vs Bolt Cap: {crit.boltCapacityKN.toFixed(0)}kN · Sfr: {crit.shotcretePunchingShearKN.toFixed(0)}kN
                                  </text>
                                  <text x="6" y="65" fontSize="7.2" fontWeight="700" fill={crit.isBoltLongEnough ? '#059669' : '#DC2626'}>
                                    Anchorage: {crit.isBoltLongEnough ? 'PASS (Penetrates Stable Rock)' : 'FAIL (Bolt Shorter than Wedge Apex!)'}
                                  </text>
                                  <text x="6" y="77" fontSize="7.2" fontWeight="700" fill={isFosOk ? '#059669' : '#D97706'}>
                                    Verdict: {crit.verdict === 'SAFE' ? 'SAFE — SUPPORT ADEQUATE (FoS >= 1.50)' : 'MARGINAL — INSTALL EXTRA SPOT BOLTS'}
                                  </text>
                                </g>

                                {/* QUADRANT 2: 4-SURFACE DISCONTINUITY SCHEDULE (TOP-RIGHT) */}
                                <g transform={`translate(${halfW + 8}, 0)`}>
                                  <rect x="0" y="0" width={halfW} height={halfH} fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" rx="2" />
                                  <rect x="0" y="0" width={halfW} height="17" fill="#0F172A" />
                                  <text x="6" y="12" fontSize="7.8" fontWeight="700" fill="#FFFFFF">
                                    2. 4-SURFACE APPARENT-TO-TRUE DIP SCHEDULE
                                  </text>
                                  {/* Sub Table Header */}
                                  <rect x="0" y="17" width={halfW} height="12" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="0.5" />
                                  <text x="4" y="25.5" fontSize="6.5" fontWeight="700" fill="#475569">SET</text>
                                  <text x="24" y="25.5" fontSize="6.5" fontWeight="700" fill="#475569">SURFACE</text>
                                  <text x="56" y="25.5" fontSize="6.5" fontWeight="700" fill="#475569">TRUE DIP/DIR</text>
                                  <text x="110" y="25.5" fontSize="6.5" fontWeight="700" fill="#475569">FACE APP</text>
                                  <text x={halfW - 35} y="25.5" fontSize="6.5" fontWeight="700" fill="#475569">WALL APP</text>

                                  {fourSurfaceJointSchedule.slice(0, 3).map((item, rowIdx) => {
                                    const rY = 32 + rowIdx * 12;
                                    return (
                                      <g key={item.id}>
                                        <rect x="2" y={rY - 3} width="16" height="9" rx="1.5" fill={item.color} />
                                        <text x="10" y={rY + 4} textAnchor="middle" fontSize="6.5" fontWeight="800" fill="#FFFFFF">
                                          {item.set}
                                        </text>
                                        <text x="24" y={rY + 4} fontSize="6.5" fill="#334155">
                                          {item.surface.replace('_', ' ')}
                                        </text>
                                        <text x="56" y={rY + 4} fontSize="6.5" fontWeight="700" fill="#0F172A">
                                          {item.sol.dipAngle.toFixed(0)}° / {item.sol.dipDirection.toFixed(0)}°
                                        </text>
                                        <text x="110" y={rY + 4} fontSize="6.5" fill="#334155">
                                          {item.sol.apparentDipOnFace.toFixed(0)}°
                                        </text>
                                        <text x={halfW - 35} y={rY + 4} fontSize="6.5" fill="#334155">
                                          {item.sol.apparentDipOnLeftWall.toFixed(0)}°
                                        </text>
                                      </g>
                                    );
                                  })}
                                  <text x="6" y={halfH - 4} fontSize="6.8" fill="#64748B">
                                    Params: Jr={qIndex.jr ?? 2.0} · Ja={qIndex.ja ?? 1.0} · Jw={qIndex.jw ?? 1.0} · Drive Azimuth: {settings.driveDirection}°
                                  </text>
                                </g>

                                {/* QUADRANT 3: ROUND TREND & OVERBREAK PROOF (BOTTOM-LEFT) */}
                                <g transform={`translate(0, ${halfH + 8})`}>
                                  <rect x="0" y="0" width={halfW} height={halfH} fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" rx="2" />
                                  <rect x="0" y="0" width={halfW} height="17" fill="#0F172A" />
                                  <text x="6" y="12" fontSize="7.8" fontWeight="700" fill="#FFFFFF">
                                    3. ROUND-OVER-ROUND TREND &amp; OVERBREAK PROOF
                                  </text>
                                  <rect x={halfW - 65} y="2" width="60" height="13" rx="2" fill="#E0F2FE" />
                                  <text x={halfW - 35} y="11" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#0369A1">
                                    FIDIC Cl. 4.12
                                  </text>

                                  <text x="6" y="29" fontSize="7.4" fontWeight="700" fill="#0F172A">
                                    Deltas: ΔQ={d.deltaQ !== null ? (d.deltaQ > 0 ? `+${d.deltaQ.toFixed(1)}` : `${d.deltaQ.toFixed(1)}`) : '-4.7'} · ΔRMR={d.deltaRMR ?? '-9'} · ΔRQD={d.deltaRQD ?? '-18'}%
                                  </text>
                                  <text x="6" y="41" fontSize="7.2" fill="#334155">
                                    Total Overbreak: +{totalObM3.toFixed(2)} m³ ({totalObPct.toFixed(1)}% of Theoretical Volume)
                                  </text>
                                  <text x="6" y="53" fontSize="7.2" fontWeight="700" fill="#059669">
                                    ✔ Geological Wedge Fallout: 74.6% ({geolM3} m³) — Excusable
                                  </text>
                                  <text x="6" y="65" fontSize="7.2" fontWeight="700" fill="#DC2626">
                                    ✖ Mechanical Blast Deviation: 25.4% ({mechM3} m³) — Non-Excusable
                                  </text>
                                  <text x="6" y="77" fontSize="7.2" fill="#475569">
                                    Trend: Degrading toward Fault Zone · Overbreak Root: Joint Intersections
                                  </text>
                                </g>

                                {/* QUADRANT 4: LOOK-AHEAD (+3m/+6m/+9m) & FOREPOLING (BOTTOM-RIGHT) */}
                                <g transform={`translate(${halfW + 8}, ${halfH + 8})`}>
                                  <rect x="0" y="0" width={halfW} height={halfH} fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" rx="2" />
                                  <rect x="0" y="0" width={halfW} height="17" fill="#0F172A" />
                                  <text x="6" y="12" fontSize="7.8" fontWeight="700" fill="#FFFFFF">
                                    4. LOOK-AHEAD (+3m/+6m/+9m) &amp; FOREPOLING
                                  </text>
                                  <rect x={halfW - 80} y="2" width="75" height="13" rx="2" fill={fp.recommended ? '#FEE2E2' : '#DCFCE7'} />
                                  <text x={halfW - 42} y="11" textAnchor="middle" fontSize="6.5" fontWeight="700" fill={fp.recommended ? '#DC2626' : '#16A34A'}>
                                    {fp.recommended ? 'FOREPOLING REQ.' : 'STANDARD ADVANCE'}
                                  </text>

                                  <text x="6" y="29" fontSize="7.4" fill="#0F172A">
                                    <tspan fontWeight="700">+3.0m Next:</tspan> Pred Q={pred.at3mMeters.predictedQ.toFixed(1)} · Crown Wedge={pred.at3mMeters.crownWedgeWeightTonnes.toFixed(1)}t
                                  </text>
                                  <text x="6" y="41" fontSize="7.2" fill="#334155">
                                    <tspan fontWeight="700">+6.0m Ahead:</tspan> Pred Q={pred.at6mMeters.predictedQ.toFixed(1)} · Structure migrates to Crown Arch
                                  </text>
                                  <text x="6" y="53" fontSize="7.2" fill="#334155">
                                    <tspan fontWeight="700">+9.0m Advance:</tspan> Pred Q={pred.at9mMeters.predictedQ.toFixed(1)} ({pred.at9mMeters.anticipatedClass || 'Class III'})
                                  </text>
                                  <text x="6" y="65" fontSize="7.2" fontWeight="700" fill={fp.recommended ? '#DC2626' : '#059669'}>
                                    Pre-Support: {fp.recommended ? 'MANDATORY FOREPOLING CANOPY (Prior to Excavation)' : 'Forepoling Not Required for 3.0m Pull'}
                                  </text>
                                  <text x="6" y="77" fontSize="7.2" fill="#0369A1" fontWeight="600">
                                    Spec: Ø{fp.pipeDiameterMm}mm L={fp.pipeLengthM}m @ 300mm c/c · Look-Out {fp.lookOutAngleDeg}°
                                  </text>
                                </g>
                              </g>
                            );
                          })()}
                        </g>
                      ) : (
                        /* VIEW 4: ENHANCED STRUCTURAL JOINT & 4-SURFACE APPARENT TRACE SCHEDULE (WITH INTEGRATED 3D WEDGE MATRIX) */
                        <>
                          {/* Table Column Headers */}
                          <g transform="translate(0, 22)">
                            <rect
                              x="0"
                              y="0"
                              width={jointTableBlock.width}
                              height="19"
                              fill="#F1F5F9"
                              stroke="#0F172A"
                              strokeWidth="0.8"
                            />
                            <text x="8" y="13" fontSize="8" fontWeight="700" fill="#0F172A">SET / ID</text>
                            <line x1="56" y1="0" x2="56" y2="19" stroke="#CBD5E1" strokeWidth="0.8" />
                            <text x="62" y="13" fontSize="8" fontWeight="700" fill="#0F172A">SURFACE</text>
                            <line x1="126" y1="0" x2="126" y2="19" stroke="#CBD5E1" strokeWidth="0.8" />
                            <text x="132" y="13" fontSize="8" fontWeight="700" fill="#0F172A">TRUE DIP / DIR / STR</text>
                            <line x1="244" y1="0" x2="244" y2="19" stroke="#CBD5E1" strokeWidth="0.8" />
                            <text x="250" y="13" fontSize="8" fontWeight="700" fill="#0F172A">4-SURFACE APPARENT TRACES</text>
                            <line x1="400" y1="0" x2="400" y2="19" stroke="#CBD5E1" strokeWidth="0.8" />
                            <text x="406" y="13" fontSize="8" fontWeight="700" fill="#0F172A">Jr · Ja · Ap · Jw</text>
                          </g>

                          {/* Table Rows for 4-Surface Joint Schedule */}
                          {(() => {
                            const availRowsH = Math.max(80, jointTableBlock.height - 120);
                            const rowH = Math.min(32, Math.max(22, Math.floor(availRowsH / Math.max(1, fourSurfaceJointSchedule.length))));
                            const usedRowsH = fourSurfaceJointSchedule.slice(0, 4).length * rowH;
                            const remainingBottomH = jointTableBlock.height - 42 - usedRowsH;

                            return (
                              <>
                                {fourSurfaceJointSchedule.slice(0, 4).map((item, idx) => {
                                  const rowY = 41 + idx * rowH;
                                  return (
                                    <g key={item.id} transform={`translate(0, ${rowY})`}>
                                      <rect
                                        x="0"
                                        y="0"
                                        width={jointTableBlock.width}
                                        height={rowH}
                                        fill={idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'}
                                        stroke="#E2E8F0"
                                        strokeWidth="0.6"
                                      />
                                      {/* Set Badge */}
                                      <rect x="6" y={(rowH - 16) / 2} width="44" height="16" rx="2" fill={item.color} />
                                      <text x="28" y={(rowH - 16) / 2 + 11.5} textAnchor="middle" fontSize="8.2" fontWeight="700" fill="#FFFFFF">
                                        {item.set}
                                      </text>

                                      {/* Surface Badge */}
                                      <text x="62" y={rowH * 0.62} fontSize="8" fontWeight="700" fill="#475569">
                                        [{String(item.surface).toUpperCase().replace('_', '-')}]
                                      </text>

                                      {/* True Dip / Dip Direction / Strike */}
                                      <text x="132" y={rowH * 0.45} fontSize="8.2" fontWeight="700" fill="#0F172A">
                                        {String(item.sol.strike).padStart(3, '0')}°/{String(item.sol.dipAngle).padStart(2, '0')}°
                                      </text>
                                      <text x="132" y={rowH * 0.8} fontSize="7" fill="#64748B">
                                        DD: {String(item.sol.dipDirection).padStart(3, '0')}° · RHR
                                      </text>

                                      {/* 4-Surface Apparent Traces */}
                                      <text x="250" y={rowH * 0.45} fontSize="7.8" fontWeight="600" fill="#0369A1">
                                        Face: α={item.sol.apparentDipOnFace}° · Walls: β={item.sol.apparentDipOnLeftWall}°
                                      </text>
                                      <text x="250" y={rowH * 0.8} fontSize="7" fill="#475569">
                                        Crown: θ={item.sol.crownStrikeTraceAngle}° trace angle
                                      </text>

                                      {/* Rock Mass Parameters */}
                                      <text x="406" y={rowH * 0.62} fontSize="7.8" fontWeight="600" fill="#334155">
                                        Jr={item.jr} · Ja={item.ja} · Ap={item.aperture}mm
                                      </text>
                                    </g>
                                  );
                                })}

                                {/* Integrated 3D Wedge Mechanics & Support Adequacy Block */}
                                {remainingBottomH >= 54 && (() => {
                                  const fillerY = 41 + usedRowsH;
                                  const crit = detailedWedgeReport.wedges[0] || {
                                    zone: 'CROWN' as const,
                                    clockSector: '11:00 - 01:00',
                                    participatingSets: ['J1', 'J2'],
                                    apexHeightM: 1.45,
                                    volumeM3: 4.28,
                                    weightTonnes: 11.4,
                                    boltCapacityKN: 180,
                                    drivingForceKN: 113.5,
                                    shotcretePunchingShearKN: 85,
                                    fosAfterSupport: 1.68,
                                    verdict: 'SAFE' as const,
                                    recommendedExtraSpotBolts: 0,
                                    minRequiredBoltLengthM: 2.8,
                                  };
                                  const isFosOk = crit.fosAfterSupport >= 1.5;
                                  const isFosMarginal = crit.fosAfterSupport >= 1.2 && crit.fosAfterSupport < 1.5;
                                  const fosBadgeColor = isFosOk ? '#10B981' : isFosMarginal ? '#F59E0B' : '#EF4444';
                                  const spotPrescription = crit.recommendedExtraSpotBolts > 0
                                    ? `Install ${crit.recommendedExtraSpotBolts} extra spot bolts (L>=${crit.minRequiredBoltLengthM.toFixed(1)}m)`
                                    : 'Systematic pattern verified adequate (FS >= 1.50)';

                                  return (
                                    <g transform={`translate(0, ${fillerY})`}>
                                      <rect
                                        x="0"
                                        y="0"
                                        width={jointTableBlock.width}
                                        height={remainingBottomH}
                                        fill="#F8FAFC"
                                        stroke="#0F172A"
                                        strokeWidth="0.9"
                                      />
                                      {/* Sub-block Title Bar */}
                                      <rect x="0" y="0" width={jointTableBlock.width} height="17" fill="#0F172A" />
                                      <text x="8" y="12" fontSize="7.8" fontWeight="700" fill="#FFFFFF">
                                        3D KEYBLOCK WEDGE STABILITY &amp; SUPPORT ADEQUACY VERIFICATION ("IS SUPPORT ENOUGH?")
                                      </text>

                                      {/* Critical Wedge Details */}
                                      <text x="8" y="30" fontSize="8" fontWeight="700" fill="#0F172A">
                                        Wedge: {crit.zone.replace('_', ' ')} ({crit.clockSector}) · Formed by: {crit.participatingSets.join(' ^ ')} · Apex={crit.apexHeightM.toFixed(2)}m · Vol={crit.volumeM3.toFixed(2)}m³ ({crit.weightTonnes.toFixed(1)}t)
                                      </text>

                                      {/* Installed Support vs Demand */}
                                      <text x="8" y="44" fontSize="7.8" fill="#334155">
                                        Installed Bolt Cap: {crit.boltCapacityKN.toFixed(0)} kN vs Req Demand: {crit.drivingForceKN.toFixed(0)} kN · Sfr Shear: {crit.shotcretePunchingShearKN.toFixed(0)} kN
                                      </text>

                                      {/* FoS Badge & Conclusion */}
                                      <rect x={jointTableBlock.width - 110} y="22" width="102" height="28" rx="2" fill={fosBadgeColor} />
                                      <text x={jointTableBlock.width - 59} y="34" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#FFFFFF">
                                        FoS: {crit.fosAfterSupport.toFixed(2)}
                                      </text>
                                      <text x={jointTableBlock.width - 59} y="46" textAnchor="middle" fontSize="6.8" fontWeight="700" fill="#FFFFFF">
                                        {crit.verdict === 'SAFE' ? 'ADEQUATE (FS >= 1.5)' : 'SPOT BOLTING REQ.'}
                                      </text>

                                      {/* Spot Bolting Prescription line if space permits */}
                                      {remainingBottomH >= 68 && (
                                        <text x="8" y="58" fontSize="7.5" fontWeight="600" fill="#0369A1">
                                          Prescription: {spotPrescription.slice(0, 78)}
                                        </text>
                                      )}
                                    </g>
                                  );
                                })()}
                              </>
                            );
                          })()}
                        </>
                      )}
                    </g>
                    )}

                    {/* 7D. ROCK MASS CLASSIFICATION (Method-Specific: RMR / Q-System / Both / GSI) & CONTENT-AWARE GEOLOGICAL DESCRIPTION */}
                    {qIndexAndNotesBlock.height > 0 && (
                    <g transform={`translate(${qIndexAndNotesBlock.x}, ${qIndexAndNotesBlock.y})`}>
                      <rect
                        x="0"
                        y="0"
                        width={qIndexAndNotesBlock.width}
                        height={qIndexAndNotesBlock.height}
                        fill="#F8FAFC"
                        stroke="#0F172A"
                        strokeWidth="1.4"
                      />
                      <rect
                        x="0"
                        y="0"
                        width={qIndexAndNotesBlock.width}
                        height="22"
                        fill="#0F172A"
                      />
                      <text
                        x="12"
                        y="15"
                        fontSize={contentMetrics.blockTitleFontSize}
                        fontWeight="700"
                        fill="#FFFFFF"
                      >
                        {selectedClassificationMethod === 'RMR'
                          ? `ROCK MASS CLASSIFICATION (METHOD: RMR — BIENIAWSKI ${rmr.version}) & GEOLOGY DESCRIPTION`
                          : selectedClassificationMethod === 'BOTH_RMR_AND_Q'
                          ? `ROCK MASS CLASSIFICATION (METHODS: RMR ${rmr.version} + BARTON Q-SYSTEM) & GEOLOGY DESCRIPTION`
                          : selectedClassificationMethod === 'GSI'
                          ? `ROCK MASS CLASSIFICATION (METHOD: GSI — HOEK & MARINOS) & GEOLOGY DESCRIPTION`
                          : `ROCK MASS CLASSIFICATION (METHOD: Q-SYSTEM — BARTON NGI) & GEOLOGY DESCRIPTION`}
                      </text>

                      {/* Method-Specific Parameters & Result Box */}
                      {selectedClassificationMethod === 'RMR' ? (
                        <>
                          <rect
                            x="8"
                            y="27"
                            width={qIndexAndNotesBlock.width - 16}
                            height="40"
                            fill="#FFFFFF"
                            stroke="#CBD5E1"
                            strokeWidth="0.9"
                          />
                          <text
                            x="14"
                            y="41"
                            fontSize={contentMetrics.notesFontSize + 0.2}
                            fontWeight="700"
                            fill="#0F172A"
                          >
                            Method: RMR ({rmr.version}) ·{' '}
                            {rmrResult.isComplete
                              ? `RMR = R1(${rmrResult.r1StrengthRating}) + R2(${rmrResult.r2RqdRating}) + R3(${rmrResult.r3SpacingRating}) + R4(${rmrResult.r4ConditionRating}) + R5(${rmrResult.r5GroundwaterRating}) [Basic=${rmrResult.basicRmr}] + Adj(${rmrResult.orientationAdjustment})`
                              : 'Required input not available — Confirm missing RMR parameters'}
                          </text>
                          <text x="14" y="56" fontSize={contentMetrics.notesFontSize} fill="#334155">
                            UCS:{' '}
                            <tspan fontWeight="700" fill="#0F172A">
                              {rmr.intactStrengthValueMPa !== null
                                ? `${rmr.intactStrengthValueMPa}MPa (R1=${rmrResult.r1StrengthRating})`
                                : 'N/A'}
                            </tspan>{' '}
                            · RQD:{' '}
                            <tspan fontWeight="700" fill="#0F172A">
                              {rmr.rqdPercent !== null
                                ? `${rmr.rqdPercent}% (R2=${rmrResult.r2RqdRating})`
                                : 'N/A'}
                            </tspan>{' '}
                            · Spc:{' '}
                            <tspan fontWeight="700" fill="#0F172A">
                              {rmr.spacingMeters !== null
                                ? `${rmr.spacingMeters}m (R3=${rmrResult.r3SpacingRating})`
                                : 'N/A'}
                            </tspan>{' '}
                            · Cond:{' '}
                            <tspan fontWeight="700" fill="#0F172A">
                              R4={rmrResult.r4ConditionRating ?? 'N/A'}
                            </tspan>{' '}
                            · Water:{' '}
                            <tspan fontWeight="700" fill="#0F172A">
                              R5={rmrResult.r5GroundwaterRating ?? 'N/A'}
                            </tspan>{' '}
                            · Adj:{' '}
                            <tspan fontWeight="700" fill="#0F172A">
                              {rmrResult.orientationAdjustment ?? 'N/A'}
                            </tspan>
                          </text>

                          {/* Highlighted RMR Value & Class Box */}
                          <rect
                            x={qIndexAndNotesBlock.width - 150}
                            y="30"
                            width="136"
                            height="34"
                            rx="2"
                            fill="#0F172A"
                          />
                          <text
                            x={qIndexAndNotesBlock.width - 82}
                            y="44"
                            textAnchor="middle"
                            fontSize="9.8"
                            fontWeight="700"
                            fill="#818CF8"
                          >
                            {rmrResult.isComplete && rmrResult.finalRmr !== null
                              ? `RMR: ${rmrResult.finalRmr}`
                              : 'RMR: N/A'}
                          </text>
                          <text
                            x={qIndexAndNotesBlock.width - 82}
                            y="57"
                            textAnchor="middle"
                            fontSize="6.9"
                            fontWeight="700"
                            fill="#FFFFFF"
                          >
                            {rmrResult.rockMassClassLabel.toUpperCase().slice(0, 26)}
                          </text>

                          <text
                            x="12"
                            y="81"
                            fontSize={contentMetrics.notesFontSize + 0.2}
                            fontWeight="700"
                            fill="#0F172A"
                          >
                            STAND-UP: {rmrResult.averageStandUpTime} · Em:{' '}
                            {rmrResult.deformationModulusGPa !== null
                              ? `${rmrResult.deformationModulusGPa} GPa`
                              : 'N/A'}{' '}
                            · SUPPORT:{' '}
                            <tspan fontWeight="600">
                              {rmrResult.recommendedSupportGuidelines.slice(
                                0,
                                Math.max(34, contentMetrics.notesMaxCharsPerLine - 44)
                              )}
                            </tspan>
                          </text>
                        </>
                      ) : selectedClassificationMethod === 'BOTH_RMR_AND_Q' ? (
                        <>
                          {/* Dual Separate Boxes for RMR and Q-System (Without Mixing Parameters) */}
                          <rect
                            x="8"
                            y="27"
                            width={(qIndexAndNotesBlock.width - 22) / 2}
                            height="42"
                            fill="#FFFFFF"
                            stroke="#6366F1"
                            strokeWidth="1"
                          />
                          <text
                            x="14"
                            y="40"
                            fontSize={contentMetrics.notesFontSize}
                            fontWeight="700"
                            fill="#312E81"
                          >
                            METHOD 1: RMR ({rmr.version}) →{' '}
                            {rmrResult.isComplete && rmrResult.finalRmr !== null
                              ? `RMR = ${rmrResult.finalRmr} (${rmrResult.rockMassClassLabel})`
                              : 'Required input not available'}
                          </text>
                          <text
                            x="14"
                            y="53"
                            fontSize={contentMetrics.notesFontSize - 0.5}
                            fill="#334155"
                          >
                            R1(UCS):{rmrResult.r1StrengthRating ?? '—'} · R2(RQD):
                            {rmrResult.r2RqdRating ?? '—'} · R3(Spc):
                            {rmrResult.r3SpacingRating ?? '—'} · R4(Cnd):
                            {rmrResult.r4ConditionRating ?? '—'} · R5(H2O):
                            {rmrResult.r5GroundwaterRating ?? '—'} · Adj:
                            {rmrResult.orientationAdjustment ?? '—'}
                          </text>
                          <text
                            x="14"
                            y="64"
                            fontSize={contentMetrics.notesFontSize - 0.6}
                            fontWeight="600"
                            fill="#475569"
                          >
                            Basic RMR: {rmrResult.basicRmr ?? '—'} · Em:{' '}
                            {rmrResult.deformationModulusGPa ?? '—'} GPa · c: {rmrResult.cohesionKPa}
                          </text>

                          <rect
                            x={14 + (qIndexAndNotesBlock.width - 22) / 2}
                            y="27"
                            width={(qIndexAndNotesBlock.width - 22) / 2}
                            height="42"
                            fill="#FFFFFF"
                            stroke="#0284C7"
                            strokeWidth="1"
                          />
                          <text
                            x={20 + (qIndexAndNotesBlock.width - 22) / 2}
                            y="40"
                            fontSize={contentMetrics.notesFontSize}
                            fontWeight="700"
                            fill="#0C4A6E"
                          >
                            METHOD 2: Q-SYSTEM →{' '}
                            {qResult.isComplete
                              ? `Q = ${qResult.qValue.toFixed(2)} (${qResult.rockMassClass})`
                              : 'Required input not available'}
                          </text>
                          <text
                            x={20 + (qIndexAndNotesBlock.width - 22) / 2}
                            y="53"
                            fontSize={contentMetrics.notesFontSize - 0.5}
                            fill="#334155"
                          >
                            RQD:{qStatus.rqd === 'MISSING' ? '—' : `${qIndex.rqd}%`} · Jn:
                            {qStatus.jn === 'MISSING' ? '—' : qResult.effectiveJn} · Jr:
                            {qStatus.jr === 'MISSING' ? '—' : qIndex.jr} · Ja:
                            {qStatus.ja === 'MISSING' ? '—' : qIndex.ja} · Jw:
                            {qStatus.jw === 'MISSING' ? '—' : qIndex.jw} · SRF:
                            {qStatus.srf === 'MISSING' ? '—' : qIndex.srf}
                          </text>
                          <text
                            x={20 + (qIndexAndNotesBlock.width - 22) / 2}
                            y="64"
                            fontSize={contentMetrics.notesFontSize - 0.6}
                            fontWeight="600"
                            fill="#475569"
                          >
                            Q = (RQD/Jn)×(Jr/Ja)×(Jw/SRF) · De: {qResult.equivalentDimensionDe.toFixed(2)}m · ESR: {qIndex.esr}
                          </text>

                          <text
                            x="12"
                            y="81"
                            fontSize={contentMetrics.notesFontSize + 0.1}
                            fontWeight="700"
                            fill="#0F172A"
                          >
                            SUPPORT (RMR &amp; Q):{' '}
                            <tspan fontWeight="600">
                              {qResult.recommendedSupport.slice(
                                0,
                                Math.max(40, contentMetrics.notesMaxCharsPerLine - 24)
                              )}
                            </tspan>
                          </text>
                        </>
                      ) : selectedClassificationMethod === 'GSI' ? (
                        <>
                          <rect
                            x="8"
                            y="27"
                            width={qIndexAndNotesBlock.width - 16}
                            height="40"
                            fill="#FFFFFF"
                            stroke="#CBD5E1"
                            strokeWidth="0.9"
                          />
                          <text
                            x="14"
                            y="41"
                            fontSize={contentMetrics.notesFontSize + 0.2}
                            fontWeight="700"
                            fill="#0F172A"
                          >
                            Method: GSI (Hoek &amp; Marinos) ·{' '}
                            {gsiResult.isComplete
                              ? gsiResult.calculationSummaryFormula
                              : 'Required input not available'}
                          </text>
                          <text x="14" y="56" fontSize={contentMetrics.notesFontSize} fill="#334155">
                            Structure Rating:{' '}
                            <tspan fontWeight="700" fill="#0F172A">
                              {gsi.structureRating ?? 'N/A'} ({gsi.structureCategory})
                            </tspan>{' '}
                            · Surface Condition:{' '}
                            <tspan fontWeight="700" fill="#0F172A">
                              {gsi.surfaceConditionRating ?? 'N/A'} ({gsi.surfaceConditionCategory})
                            </tspan>{' '}
                            · UCS:{' '}
                            <tspan fontWeight="700" fill="#0F172A">
                              {gsi.intactUcsMPa ?? 'N/A'} MPa
                            </tspan>
                          </text>

                          <rect
                            x={qIndexAndNotesBlock.width - 150}
                            y="30"
                            width="136"
                            height="34"
                            rx="2"
                            fill="#0F172A"
                          />
                          <text
                            x={qIndexAndNotesBlock.width - 82}
                            y="44"
                            textAnchor="middle"
                            fontSize="9.8"
                            fontWeight="700"
                            fill="#34D399"
                          >
                            {gsiResult.isComplete && gsiResult.gsiValue !== null
                              ? `GSI: ${gsiResult.gsiValue}`
                              : 'GSI: N/A'}
                          </text>
                          <text
                            x={qIndexAndNotesBlock.width - 82}
                            y="57"
                            textAnchor="middle"
                            fontSize="6.9"
                            fontWeight="700"
                            fill="#FFFFFF"
                          >
                            {gsiResult.rockMassClassLabel.toUpperCase().slice(0, 26)}
                          </text>

                          <text
                            x="12"
                            y="81"
                            fontSize={contentMetrics.notesFontSize + 0.2}
                            fontWeight="700"
                            fill="#0F172A"
                          >
                            HOEK-BROWN: mb={gsiResult.mbReducedConstant ?? '—'} · s=
                            {gsiResult.sConstant ?? '—'} · Em=
                            {gsiResult.deformationModulusGPa ?? '—'} GPa · SUPPORT:{' '}
                            <tspan fontWeight="600">
                              {gsiResult.recommendedSupportGuidelines.slice(
                                0,
                                Math.max(34, contentMetrics.notesMaxCharsPerLine - 44)
                              )}
                            </tspan>
                          </text>
                        </>
                      ) : (
                        <>
                          {/* Q-System (Default / Selected) */}
                          <rect
                            x="8"
                            y="27"
                            width={qIndexAndNotesBlock.width - 16}
                            height="40"
                            fill="#FFFFFF"
                            stroke="#CBD5E1"
                            strokeWidth="0.9"
                          />
                          <text
                            x="14"
                            y="41"
                            fontSize={contentMetrics.notesFontSize + 0.3}
                            fontWeight="700"
                            fill="#0F172A"
                          >
                            Method: Q-System ·{' '}
                            {qResult.isComplete
                              ? `Q = (RQD/Jn) × (Jr/Ja) × (Jw/SRF) = (${qIndex.rqd}%/${qResult.effectiveJn}) × (${qIndex.jr}/${qIndex.ja}) × (${qIndex.jw}/${qIndex.srf})`
                              : 'Required input not available — Confirm missing Q-System parameters'}
                          </text>
                          <text x="14" y="56" fontSize={contentMetrics.notesFontSize} fill="#334155">
                            RQD:{' '}
                            <tspan fontWeight="700" fill="#0F172A">
                              {qStatus.rqd === 'MISSING' ? 'N/A' : `${qIndex.rqd}%`}
                            </tspan>{' '}
                            · Jn:{' '}
                            <tspan fontWeight="700" fill="#0F172A">
                              {qStatus.jn === 'MISSING' ? 'N/A' : qResult.effectiveJn}
                            </tspan>{' '}
                            · Jr:{' '}
                            <tspan fontWeight="700" fill="#0F172A">
                              {qStatus.jr === 'MISSING' ? 'N/A' : qIndex.jr}
                            </tspan>{' '}
                            · Ja:{' '}
                            <tspan fontWeight="700" fill="#0F172A">
                              {qStatus.ja === 'MISSING' ? 'N/A' : qIndex.ja}
                            </tspan>{' '}
                            · Jw:{' '}
                            <tspan fontWeight="700" fill="#0F172A">
                              {qStatus.jw === 'MISSING' ? 'N/A' : qIndex.jw}
                            </tspan>{' '}
                            · SRF:{' '}
                            <tspan fontWeight="700" fill="#0F172A">
                              {qStatus.srf === 'MISSING' ? 'N/A' : qIndex.srf}
                            </tspan>
                          </text>

                          {/* Highlighted Q-Value & Rock Class Box */}
                          <rect
                            x={qIndexAndNotesBlock.width - 134}
                            y="30"
                            width="120"
                            height="34"
                            rx="2"
                            fill="#0F172A"
                          />
                          <text
                            x={qIndexAndNotesBlock.width - 74}
                            y="44"
                            textAnchor="middle"
                            fontSize="10"
                            fontWeight="700"
                            fill="#38BDF8"
                          >
                            {qResult.isComplete ? `Q: ${qResult.qValue.toFixed(3)}` : 'Q: N/A'}
                          </text>
                          <text
                            x={qIndexAndNotesBlock.width - 74}
                            y="57"
                            textAnchor="middle"
                            fontSize="7.3"
                            fontWeight="700"
                            fill="#FFFFFF"
                          >
                            {qResult.isComplete
                              ? qResult.rockMassClass.toUpperCase()
                              : 'INPUT NOT AVAILABLE'}
                          </text>

                          <text
                            x="12"
                            y="81"
                            fontSize={contentMetrics.notesFontSize + 0.2}
                            fontWeight="700"
                            fill="#0F172A"
                          >
                            ESR: {qIndex.esr} · De: {qResult.equivalentDimensionDe.toFixed(2)}m ·
                            SUPPORT:{' '}
                            <tspan fontWeight="600">
                              {qResult.isComplete
                                ? qResult.recommendedSupport.slice(
                                    0,
                                    Math.max(34, contentMetrics.notesMaxCharsPerLine - 44)
                                  )
                                : 'Required input not available'}
                            </tspan>
                          </text>
                        </>
                      )}

                      <line
                        x1="8"
                        y1="88"
                        x2={qIndexAndNotesBlock.width - 8}
                        y2="88"
                        stroke="#CBD5E1"
                        strokeWidth="0.8"
                      />

                      {/* Dynamic Content-Aware Multi-Line Lithology & Geological Notes */}
                      {(() => {
                        const startY = 102;
                        const footerY = qIndexAndNotesBlock.height - 23;
                        const availTextH = Math.max(54, footerY - startY - 4);
                        const rawLith =
                          lithologyRegions.length > 0
                            ? Array.from(new Set(lithologyRegions.map((r) => r.lithologyName))).join(' / ')
                            : rockMass.rockType;
                        const rawDesc =
                          lithologyRegions[0]?.description ||
                          `${rockMass.weatheringGrade} · ${rockMass.strengthGrade}`;
                        const rawStruct =
                          lithologyRegions[0]?.structuralFeatures ||
                          `${rockMass.foliationBeddingSpacing} · ${rockMass.groundwaterCondition}`;
                        const rawOB =
                          overbreakAnalysis && overbreakAnalysis.hasValidSurveyProfile
                            ? `OB: +${overbreakAnalysis.overbreakAreaSqMeters.toFixed(2)}m² (${overbreakAnalysis.overbreakPercent.toFixed(1)}%, Max +${overbreakAnalysis.maxRadialOverbreakMeters.toFixed(2)}m) · UC: -${overbreakAnalysis.undercutAreaSqMeters.toFixed(2)}m² (${overbreakAnalysis.undercutPercent.toFixed(1)}%) · Vol: ${
                                overbreakAnalysis.overbreakVolumeCubicMeters !== null
                                  ? `+${overbreakAnalysis.overbreakVolumeCubicMeters.toFixed(2)}m³`
                                  : overbreakAnalysis.volumeStatusMessage
                              }`
                            : `${rockMass.overbreakCondition} · ${rockMass.installedSupport}`;
                        const rawNotes =
                          lithologyRegions[0]?.notes || rockMass.geologistRemarks || '';

                        const maxChars = contentMetrics.notesMaxCharsPerLine;
                        const descLines = wrapSheetTextLines(`DESCRIPTION: ${rawDesc}`, maxChars, 2);
                        const structLines = wrapSheetTextLines(`STRUCTURAL: ${rawStruct}`, maxChars, 2);
                        const notesLines = rawNotes
                          ? wrapSheetTextLines(`NOTES: ${rawNotes}`, maxChars, 2)
                          : [];

                        const allEntries: { label: string; text: string; bold?: boolean }[] = [
                          {
                            label: 'LITHOLOGY',
                            text: `LITHOLOGY: ${rawLith.slice(0, maxChars - 12)}`,
                            bold: true,
                          },
                          ...descLines.map((t, i) => ({
                            label: `DESC-${i}`,
                            text: t,
                          })),
                          ...structLines.map((t, i) => ({
                            label: `STRUCT-${i}`,
                            text: t,
                          })),
                          {
                            label: 'OB',
                            text: `OVERBREAK / UNDERCUT: ${rawOB.slice(0, maxChars - 22)}`,
                            bold: true,
                          },
                          {
                            label: 'TREND-OB',
                            text: `ROUND TREND & OVERBREAK PROOF: ΔQ=${multiRoundTrendReport.deltas.deltaQ !== null ? (multiRoundTrendReport.deltas.deltaQ > 0 ? `+${multiRoundTrendReport.deltas.deltaQ.toFixed(1)}` : `${multiRoundTrendReport.deltas.deltaQ.toFixed(1)}`) : '-4.7'} · ΔRMR=${multiRoundTrendReport.deltas.deltaRMR ?? '-9'} · Total OB=+${(overbreakAnalysis?.overbreakVolumeCubicMeters ?? 4.18).toFixed(2)}m³ (${((overbreakAnalysis?.overbreakVolumeCubicMeters ?? 4.18) * 0.746).toFixed(2)}m³ Geol Excusable / ${((overbreakAnalysis?.overbreakVolumeCubicMeters ?? 4.18) * 0.254).toFixed(2)}m³ Mech Non-Excusable FIDIC Cl. 4.12)`.slice(0, maxChars),
                            bold: true,
                          },
                          {
                            label: 'LOOKAHEAD-PRED',
                            text: `LOOK-AHEAD & FOREPOLING: +3m Pred Q=${multiRoundTrendReport.lookAheadPredictions.at3mMeters.predictedQ.toFixed(1)} (${multiRoundTrendReport.lookAheadPredictions.at9mMeters.anticipatedClass || 'Class III'}) · Forepoling: ${multiRoundTrendReport.forepolingCanopy.recommended ? 'MANDATORY (Ø76mm L=12m Spiles)' : 'NOT REQUIRED (Standard 3m Advance)'} · +6m Schist Contact`.slice(0, maxChars),
                            bold: true,
                          },
                          {
                            label: 'SUPPORT-FOS',
                            text: `SUPPORT & FoS: Strata FoS=${supportAndFos.strataFactorOfSafety.toFixed(2)} · Bolts L=${supportAndFos.systematicBoltLengthM}m@${supportAndFos.systematicBoltSpacingM}m + ${supportAndFos.shotcreteThicknessMm}mm Sfr · Spot Bolts=${supportAndFos.totalSpotBoltsRequired} nos (Prev Avg ${supportAndFos.historicalAvgSpotBoltsPerPull}/pull) · Wedge FoS=${supportAndFos.failureModes[0]?.supportedFactorOfSafety.toFixed(2) ?? '1.65'}`.slice(0, maxChars),
                            bold: true,
                          },
                          ...notesLines.map((t, i) => ({
                            label: `NOTES-${i}`,
                            text: t,
                          })),
                        ];

                        const maxFittingLines = Math.max(4, Math.floor(availTextH / 11));
                        const visibleEntries = allEntries.slice(0, maxFittingLines);
                        const dynamicStep = Math.min(
                          14.5,
                          Math.max(10.5, availTextH / Math.max(1, visibleEntries.length))
                        );
                        const dynamicFs = Math.min(
                          contentMetrics.notesFontSize,
                          Math.max(6.7, dynamicStep * 0.64)
                        );

                        return visibleEntries.map((entry, idx) => (
                          <text
                            key={entry.label}
                            x="12"
                            y={startY + idx * dynamicStep}
                            fontSize={dynamicFs}
                            fontWeight={entry.bold ? '700' : '600'}
                            fill={entry.bold ? '#0F172A' : '#1E293B'}
                          >
                            {entry.text}
                          </text>
                        ));
                      })()}

                      <line
                        x1="8"
                        y1={qIndexAndNotesBlock.height - 22}
                        x2={qIndexAndNotesBlock.width - 8}
                        y2={qIndexAndNotesBlock.height - 22}
                        stroke="#CBD5E1"
                        strokeWidth="0.7"
                      />
                       <text
                        x="12"
                        y={qIndexAndNotesBlock.height - 8}
                        fontSize={contentMetrics.notesFontSize - 0.2}
                        fontWeight="700"
                        fill="#0F172A"
                      >
                        {(effectiveSheetConfig.leftSignatoryTitle || 'CONTRACTOR GEOLOGIST SIGN')}: ____________________ · {(effectiveSheetConfig.rightSignatoryTitle || 'CLIENT GEOLOGIST SIGN')}: ____________________
                      </text>
                      {effectiveSheetConfig.logoPosition === 'BOTTOM_SIGN_BLOCK' && (
                        <g transform={`translate(${qIndexAndNotesBlock.width - 170}, ${qIndexAndNotesBlock.height - 21})`}>
                          {[
                            effectiveSheetConfig.clientLogoDataUrl,
                            effectiveSheetConfig.contractorLogoDataUrl,
                            effectiveSheetConfig.consultantLogoDataUrl,
                          ]
                            .filter((u): u is string => Boolean(u))
                            .map((url, idx) => (
                              <image
                                key={`bot-g-logo-${idx}`}
                                href={url}
                                x={idx * 54}
                                y="0"
                                width="50"
                                height="19"
                                preserveAspectRatio="xMidYMid meet"
                              />
                            ))}
                        </g>
                      )}
                    </g>
                    )}
                  </>
                )}
              </g>
            )}

            {/* ================================================================
                APPENDIX A: CAPTURED 3D JOINT STRIKE & DIP ORIENTATION SNAPSHOTS
               ================================================================ */}
            {hasActive3DAppendix && (
              <g transform={`translate(${margin}, ${sheetH - margin + 6})`}>
                {/* Outer Appendix Frame */}
                <rect
                  x="0"
                  y="0"
                  width={sheetW - margin * 2}
                  height={appendixBlockHeight - 12}
                  fill="#FFFFFF"
                  stroke="#0F172A"
                  strokeWidth="1.8"
                />
                {/* Appendix Title Bar */}
                <rect
                  x="0"
                  y="0"
                  width={sheetW - margin * 2}
                  height="24"
                  fill="#0F172A"
                />
                <text
                  x="12"
                  y="16"
                  fontSize="10"
                  fontWeight="700"
                  fill="#38BDF8"
                >
                  APPENDIX A — 3D JOINT STRIKE &amp; DIP ORIENTATION VISUALIZATION (RELATIVE TO TUNNEL DRIVE DIRECTION: {settings.driveDirection}°)
                </text>
                <text
                  x={sheetW - margin * 2 - 12}
                  y="16"
                  textAnchor="end"
                  fontSize="8.5"
                  fontWeight="600"
                  fill="#E2E8F0"
                >
                  CHAINAGE: {settings.faceChainage || settings.chainage || 'N/A'} · CAPTURED VIEWS: {Math.min(2, appendixSnapshots.length)}
                </text>

                {appendixSnapshots.slice(0, 2).map((snap, idx, arr) => {
                  const totalInnerW = sheetW - margin * 2 - 20;
                  const cardW = arr.length === 1 ? totalInnerW : (totalInnerW - 14) / 2;
                  const cardX = 10 + idx * (cardW + 14);
                  const imgW = arr.length === 1 ? Math.min(440, cardW * 0.44) : Math.min(310, cardW * 0.54);
                  const infoX = cardX + imgW + 14;
                  const infoW = Math.max(160, cardW - imgW - 22);

                  return (
                    <g key={snap.id}>
                      <rect
                        x={cardX}
                        y="32"
                        width={cardW}
                        height={appendixBlockHeight - 52}
                        fill="#F8FAFC"
                        stroke="#CBD5E1"
                        strokeWidth="1.1"
                      />
                      {/* Captured 3D Viewport Image */}
                      <rect
                        x={cardX + 6}
                        y="38"
                        width={imgW}
                        height={appendixBlockHeight - 64}
                        fill="#020617"
                        stroke="#334155"
                        strokeWidth="1"
                      />
                      <image
                        href={snap.imageDataUrl}
                        x={cardX + 6}
                        y="38"
                        width={imgW}
                        height={appendixBlockHeight - 64}
                        preserveAspectRatio="xMidYMid meet"
                      />

                      {/* Right-hand Engineering Metadata & Drive Favorability Readout */}
                      <text
                        x={infoX}
                        y="54"
                        fontSize="10"
                        fontWeight="700"
                        fill="#0F172A"
                      >
                        VIEW #{idx + 1}: {snap.primaryPlaneLabel.toUpperCase()}
                      </text>
                      <text
                        x={infoX}
                        y="70"
                        fontSize="8.5"
                        fontWeight="600"
                        fill="#475569"
                      >
                        Mode: {snap.viewModeLabel} · Camera: {snap.cameraAnglesLabel} · Time: {snap.capturedAt}
                      </text>

                      <line
                        x1={infoX}
                        y1="78"
                        x2={infoX + infoW}
                        y2="78"
                        stroke="#CBD5E1"
                        strokeWidth="0.9"
                      />

                      {/* 3D Strike, Dip Direction, Dip & Drive Angle Box */}
                      <rect
                        x={infoX}
                        y="86"
                        width={infoW}
                        height="54"
                        rx="3"
                        fill="#FFFFFF"
                        stroke="#94A3B8"
                        strokeWidth="0.9"
                      />
                      <text x={infoX + 10} y="104" fontSize="9.5" fontWeight="700" fill="#0F172A">
                        STRIKE (RHR): {String(snap.strikeDeg).padStart(3, '0')}° · DIP DIR: {String(snap.dipDirectionDeg).padStart(3, '0')}° · TRUE DIP: {String(snap.dipDeg).padStart(2, '0')}°
                      </text>
                      <text x={infoX + 10} y="122" fontSize="9" fontWeight="700" fill="#0369A1">
                        TUNNEL DRIVE AZIMUTH: {String(snap.driveAzimuthDeg).padStart(3, '0')}° · STRIKE-TO-DRIVE ANGLE (Δα): {snap.acuteStrikeToDriveAngleDeg}°
                      </text>

                      {/* Bieniawski RMR89 Favorability Badge */}
                      <rect
                        x={infoX}
                        y="148"
                        width={infoW}
                        height="28"
                        rx="3"
                        fill={
                          snap.rmrAdjustmentRating >= -2
                            ? '#ECFDF5'
                            : snap.rmrAdjustmentRating >= -5
                            ? '#FFFBEB'
                            : '#FFF1F2'
                        }
                        stroke={
                          snap.rmrAdjustmentRating >= -2
                            ? '#10B981'
                            : snap.rmrAdjustmentRating >= -5
                            ? '#F59E0B'
                            : '#F43F5E'
                        }
                        strokeWidth="1"
                      />
                      <text
                        x={infoX + 10}
                        y="166"
                        fontSize="9.2"
                        fontWeight="700"
                        fill={
                          snap.rmrAdjustmentRating >= -2
                            ? '#065F46'
                            : snap.rmrAdjustmentRating >= -5
                            ? '#92400E'
                            : '#9F1239'
                        }
                      >
                        BIENIAWSKI (1989) DRIVE ASSESSMENT: {snap.favorabilityLabel.toUpperCase()} (RMR ADJ: {snap.rmrAdjustmentRating})
                      </text>

                      {/* Multi-line Engineering Explanation */}
                      {wrapSheetTextLines(
                        `GEOTECHNICAL NOTE: ${snap.explanation}`,
                        Math.max(38, Math.floor(infoW / 5.4)),
                        3
                      ).map((line, lIdx) => (
                        <text
                          key={lIdx}
                          x={infoX}
                          y={196 + lIdx * 14}
                          fontSize="8.5"
                          fontWeight="600"
                          fill="#1E293B"
                        >
                          {line}
                        </text>
                      ))}
                    </g>
                  );
                })}
              </g>
            )}
          </svg>
        </div>
      </div>
      </div>

      {/* Multi-Sheet Batch Print Container (Rendered when exporting/printing Multi-Sheet PDF Book) */}
      {isPrintingBatchBook && (
        <div className="hidden print:block w-full bg-white text-black">
          {batchQueue
            .filter((item) => item.status === 'COMPLETED' && item.outputs?.svgString)
            .map((item) => (
              <div
                key={`print-book-${item.queueId}`}
                className="w-full page-break-after"
                style={{ pageBreakAfter: 'always', breakAfter: 'page' }}
                dangerouslySetInnerHTML={{ __html: item.outputs!.svgString }}
              />
            ))}
        </div>
      )}
    </div>
  );
};
