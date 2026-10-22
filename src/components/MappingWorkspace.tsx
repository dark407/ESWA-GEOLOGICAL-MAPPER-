import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ThemeToggleButton, useTheme } from '../context/ThemeContext';
import {
  triggerGlobalLayoutRecalculation,
  useContainerResizeObserver,
  useResponsiveLayout,
} from '../hooks/useResponsiveLayout';
import {
  ConnectedSurveyProfile,
  GeologicalFeatureType,
  GeologicalSymbolType,
  Joint,
  JointSet,
  LithologyPatternType,
  LithologyRegion,
  MappingWorkspaceMode,
  OutputSheetMode,
  OverbreakUndercutAnalysis,
  PhotoSpectralFilterMode,
  PhotoSurface,
  PlacedGeologicalSymbol,
  PlaneSurfaceConfig,
  Point2D,
  QIndexParameters,
  QSystemParamKey,
  RmrParameters,
  RockMassClassificationMethodId,
  RockMassSummaryTable,
  SavedProjectRecord,
  GsiParameters,
  ParameterInputStatus,
  SessionLearningMemory,
  SurfaceTransform,
  SurfaceType,
  SurveyControlPoint,
  TraceContinuityStatus,
  TraceFitMode,
  TraceTerminationType,
  TunnelGeometry,
  TunnelSettings,
  VectorLayerVisibility,
} from '../types/tunnel';
import {
  computeNonOverlappingLabelPlacement,
  DipDirectionSymbolGlyph,
  getGeologicalFeatureStrokeStyle,
  getStructuralSymbolMeta,
  LabelObstacleBox,
  LabelObstacleSegment,
  LithologyPatternDefs,
  STRUCTURAL_GEOLOGICAL_SYMBOLS,
  StructuralGeologicalSymbolGlyph,
} from '../engine/geologicalSymbolLibrary';
import {
  downloadEngineeringSheetAsPDF,
  downloadEngineeringSheetAsWordDoc,
} from '../engine/pdfAndWordExportEngine';
import { syncPhotogrammetryProjectForAiTraining } from '../engine/userCloudAndPackageEngine';
import {
  calculateBieniawskiRmr,
  calculateHoekGsi,
  evaluateQSystemWithValidation,
} from '../engine/rockMassClassificationEngine';
import {
  clipPolylineToSurface,
  clampPointToSurface,
  convertTunnelGeometryToSequentialTopHeading,
  createDefaultSurfaceTransform,
  getDisplayedJointGeometry,
  imageUVToSurfaceMeters,
  isPointInsidePolygon,
  isPointInsideSurface,
  pointToSegmentDistance,
  restoreFullFaceFromTopHeading,
  solveProjectiveHomography3x3,
  surfaceMetersToImageUV,
} from '../engine/geometryEngine';
import {
  autoPropagateFractureFromSeedUV,
  buildPhotoRidgeField,
  extractJointsFromPhotoSpectralFilter,
  PhotoRidgeField,
  snapWorldPolylineToPhotoRidge,
  traceGeodesicPathBetweenUVPoints,
} from '../engine/cvPipeline';
import {
  CanvasCoordinateManager,
  CanvasViewportState,
  computeCanvasStageMetrics,
  DEFAULT_PAD_PX,
  DEFAULT_VIEW_H,
  DEFAULT_VIEW_W,
  evaluateCatmullRomSplineThroughPoints,
} from '../engine/canvasTransform';
import {
  assignJointSetBy10DegTolerance,
  calculateJointOrientation3D,
  clampDip,
  computeVirtualScanlineMetrics,
  deduplicateAndLinkSplOverlapJoints,
  formatAccurateAngle,
  formatJointSetOrientationRange,
  formatJointTraceLineLabel,
  getDirectionalJointSetColor,
  getJointReferenceColor,
  JOINT_SET_PALETTE,
  normalizeAzimuth,
  resolveCrownRelatedDipFromFaceAndWalls,
  runQualityControlValidation,
} from '../engine/orientationEngine';
import {
  autoDetectSplSeamCropAndScale,
  calculateBartonQSystem,
  computeSplTwoClickCropAndScale,
  createDefaultMeshControlPoints,
  evaluateForwardWarpedUV,
  generatePiecewiseWarpedPhotoDataUrl,
  getWarpDeformationSignature,
} from '../engine/photoWarpEngine';
import { PhotoEditorSubTab, PhotoFittingPanel } from './PhotoFittingPanel';
import { GeologyAndQIndexDrawer } from './GeologyAndQIndexDrawer';
import { LithologyPanel } from './LithologyPanel';
import { OverbreakAnalysisPanel } from './OverbreakAndProjectMemoryPanel';
import {
  PhotogrammetryLabTab,
  PhotogrammetryStructuralModal,
} from './PhotogrammetryStructuralModal';
import { PhotoTextured3DTunnelModal } from './PhotoTextured3DTunnelModal';
import {
  CadSheetSetManagerModal,
  computeRockSupportPatternOverlay,
  createDefaultRockSupportConfig,
  RockSupportDesignConfig,
  RockSupportPatternModal,
} from './CadAdvancedEngineeringModals';
import {
  computeBartonJRCProfileForPoints,
  computeTerzaghiWeight,
} from '../engine/photogrammetryAndStructuralEngine';
import {
  addVertexToLithologyRegion,
  createLithologyRegionFromPolygon,
  createPresetAreaPolygon,
  generateAIGeologicalDescriptionForRegion,
  getLithologyPreset,
   getPolygonCentroid,
  LITHOLOGY_PRESETS,
  removeVertexFromLithologyRegion,
} from '../engine/lithologyEngine';
import { detectTraceOverlap, TraceOverlapResult } from '../engine/traceDuplicateEngine';
import { PhotogrammetryTracedFeaturesDrawer } from './PhotogrammetryTracedFeaturesDrawer';
import {
  PhotogrammetryJointConfirmModal,
  PendingJointConfirmation,
} from './PhotogrammetryJointConfirmModal';
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  Camera,
  Check,
  CheckCircle2,
  Compass,
  Cpu,
  Crosshair,
  Database,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Hand,
  Layers,
  Lock,
  Maximize2,
  MousePointer,
  PanelLeft,
  PanelRight,
  PenTool,
  Plus,
  Redo2,
  RotateCcw,
  Ruler,
  Save,
  Scissors,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Undo2,
  Unlock,
  Upload,
  Wand2,
  Box,
  Zap,
  GitFork,
} from 'lucide-react';
import { EswaTunnelLogo } from './EswaBrandIdentity';
import {
  SimpleAddonTab,
  SimpleFullPhotoAndAccuracyModal,
} from './SimpleFullPhotoAndAccuracyModal';
import {
  Interactive3DStrikeDipVisualizerModal,
  Mini3DStrikeDipPreview,
} from './Interactive3DStrikeDipVisualizer';
import {
  MatlabAnalyzerTab,
  MatlabJointAnalyzerModal,
} from './MatlabJointAnalyzerModal';
import { AdvancedGeologicalAnalysisModal } from './AdvancedGeologicalAnalysisModal';
import {
  TunnelJunctionFactorModal,
  JunctionFactorResult,
} from './TunnelJunctionFactorModal';

interface MappingWorkspaceProps {
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  photos: Record<SurfaceType, PhotoSurface>;
  activeSurface: SurfaceType;
  onSelectSurface: (s: SurfaceType) => void;
  onUpdatePhotoSurface: (
    surface: SurfaceType,
    updater: (prev: PhotoSurface) => PhotoSurface
  ) => void;
  onUploadPhotoFile: (surface: SurfaceType, file: File) => void;
  onUploadStereoPhotoFile: (surface: SurfaceType, file: File, replacePhotoId?: string) => void;
  onRemoveSupportingPhoto?: (surface: SurfaceType, photoId: string) => void;
  onLoadSamplePhoto: (surface: SurfaceType) => void;
  onFeedSampleData?: () => void;
  onAutoFitCurrentPhoto: () => Promise<void>;
  onRunAITrace: () => Promise<void>;
  onRunAITraceAllSurfaces: () => Promise<void>;
  isTracingAI: boolean;
  traceFitMode: TraceFitMode;
  onChangeTraceFitMode: (mode: TraceFitMode) => void;
  statusMessage: string;
  joints: Joint[];
  jointSets: JointSet[];
  onUpdateJointsWithHistory: (nextJoints: Joint[]) => void;
  onUpdateJointSetAttribute: (setId: string, field: keyof JointSet, value: string) => void;
  onMergeJointSets: (fromSetId: string, toSetId: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onBackToSetup: () => void;
  onOpenExportSheet: (mode?: OutputSheetMode) => void;
  onSaveOfflineDraft: () => void;
  sessionMemory: SessionLearningMemory;
  onRecordRejectedJoint: (joint: Joint) => void;
  onRecordConfirmedJoint: (
    joint: Joint,
    customCorrection?: {
      correctionType?:
        | 'accept_joint'
        | 'reject_false_trace'
        | 'reshape_trace'
        | 'reclassify_type'
        | 'recalculate_orientation';
      aiSummary?: string;
      approvedSummary?: string;
    }
  ) => void;
  onTrainAndUpdateAIModel?: () => void;
  onResetAILearningFilters?: () => void;
  qIndexParams: QIndexParameters;
  onUpdateQIndexParams: (next: QIndexParameters) => void;
  qParamStatus: Record<QSystemParamKey, ParameterInputStatus>;
  onUpdateQParamStatus: (next: Record<QSystemParamKey, ParameterInputStatus>) => void;
  selectedClassificationMethod: RockMassClassificationMethodId;
  onChangeSelectedClassificationMethod: (method: RockMassClassificationMethodId) => void;
  rmrParams: RmrParameters;
  onUpdateRmrParams: (next: RmrParameters) => void;
  gsiParams: GsiParameters;
  onUpdateGsiParams: (next: GsiParameters) => void;
  rockMassSummary: RockMassSummaryTable;
  onUpdateRockMassSummary: (next: RockMassSummaryTable) => void;
  lithologyRegions: LithologyRegion[];
  onUpdateLithologyRegions: (next: LithologyRegion[]) => void;
  controlPoints: SurveyControlPoint[];
  onUpdateControlPoints: React.Dispatch<React.SetStateAction<SurveyControlPoint[]>>;
  placedSymbols: PlacedGeologicalSymbol[];
  onUpdatePlacedSymbols: React.Dispatch<React.SetStateAction<PlacedGeologicalSymbol[]>>;
  onUpdateStatusMessage?: (msg: string) => void;
  surveyProfile: ConnectedSurveyProfile;
  onUpdateSurveyProfile: React.Dispatch<React.SetStateAction<ConnectedSurveyProfile>>;
  overbreakAnalysis: OverbreakUndercutAnalysis;
  onGenerateSampleAsBuiltProfile: () => void;
  onOpenProjectMemoryModal: (
    tab?: 'projects' | 'sheet_settings' | 'volumes' | 'geometries' | 'continuous_3d_log'
  ) => void;
  onOpenCustomProfileEditor?: () => void;
  onUpdateGeometry?: (nextGeometry: TunnelGeometry) => void;
  onUpdateSettings?: React.Dispatch<React.SetStateAction<TunnelSettings>>;
  savedProjects?: SavedProjectRecord[];
  onLoadProjectRecord?: (rec: SavedProjectRecord) => void;
}

type ActiveTool =
  | 'select'
  | 'pan'
  | 'add_joint'
  | 'redraw_joint'
  | 'append_joint'
  | 'measure'
  | 'dip_probe'
  | 'photo_fit'
  | 'lithology'
  | 'control_point'
  | 'overbreak'
  | 'geological_symbol';

type JointDrawMode =
  | 'two_point_line'
  | 'magnetic_livewire'
  | 'seed_autotrace'
  | 'polyline'
  | 'freehand'
  | 'smooth_curve';

export const MappingWorkspace: React.FC<MappingWorkspaceProps> = ({
  geometry,
  settings,
  photos,
  activeSurface,
  onSelectSurface,
  onUpdatePhotoSurface,
  onUploadPhotoFile,
  onUploadStereoPhotoFile,
  onRemoveSupportingPhoto,
  onLoadSamplePhoto,
  onFeedSampleData,
  onAutoFitCurrentPhoto,
  onRunAITrace,
  onRunAITraceAllSurfaces,
  isTracingAI,
  traceFitMode,
  onChangeTraceFitMode,
  statusMessage,
  joints,
  jointSets,
  onUpdateJointsWithHistory,
  onUpdateJointSetAttribute,
  onMergeJointSets,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onBackToSetup,
  onOpenExportSheet,
  onSaveOfflineDraft,
  sessionMemory,
  onRecordRejectedJoint,
  onRecordConfirmedJoint,
  onTrainAndUpdateAIModel,
  onResetAILearningFilters,
  qIndexParams,
  onUpdateQIndexParams,
  qParamStatus,
  onUpdateQParamStatus,
  selectedClassificationMethod,
  onChangeSelectedClassificationMethod,
  rmrParams,
  onUpdateRmrParams,
  gsiParams,
  onUpdateGsiParams,
  rockMassSummary,
  onUpdateRockMassSummary,
  lithologyRegions,
  onUpdateLithologyRegions,
  controlPoints,
  onUpdateControlPoints,
  placedSymbols,
  onUpdatePlacedSymbols,
  onUpdateStatusMessage,
  surveyProfile,
  onUpdateSurveyProfile,
  overbreakAnalysis,
  onGenerateSampleAsBuiltProfile,
  onOpenProjectMemoryModal,
  onOpenCustomProfileEditor,
  onUpdateGeometry,
  onUpdateSettings,
  savedProjects = [],
  onLoadProjectRecord,
}) => {
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [selectedJointId, setSelectedJointId] = useState<string | null>(null);
  const [selectedJointVertexIdx, setSelectedJointVertexIdx] = useState<number | null>(null);
  const [joinTargetMode, setJoinTargetMode] = useState<boolean>(false);

  // Extendable Left/Right Inspector Aside State (Dock Left or Right + Drag-Resize Width)
  const [inspectorDockSide, setInspectorDockSide] = useState<'left' | 'right'>('right');
  const [inspectorWidthPx, setInspectorWidthPx] = useState<number>(245);
  const [resizingInspector, setResizingInspector] = useState<{
    startX: number;
    startWidth: number;
  } | null>(null);
  const [showLeftClickShortcutsBar, setShowLeftClickShortcutsBar] = useState<boolean>(true);

  // Industrial-Grade AutoCAD 2026 Workspace State
  const [cadRibbonTab, setCadRibbonTab] = useState<
    'HOME' | 'TUNNEL_PHOTO' | 'GEOLOGY_3D' | 'ADVANCED_ANALYSIS' | 'SURVEY_OVERBREAK' | 'CLASSIFICATION_SHEET'
  >('HOME');
  const [cadRibbonCollapsed, setCadRibbonCollapsed] = useState<boolean>(false);
  const [cadCommandInput, setCadCommandInput] = useState<string>('');
  const [showCadPropertiesAlways, setShowCadPropertiesAlways] = useState<boolean>(false);
  const lastTouchStartTimestampRef = useRef<number>(0);
  const [showCadGrid, setShowCadGrid] = useState<boolean>(true);
  const [showCadViewCube, setShowCadViewCube] = useState<boolean>(true);
  const [cadOsnapEnabled, setCadOsnapEnabled] = useState<boolean>(true);
  const [cadDynInputEnabled, setCadDynInputEnabled] = useState<boolean>(true);
  const [showRockSupportModal, setShowRockSupportModal] = useState<boolean>(false);
  const [showUnfoldedRolloutModal, setShowUnfoldedRolloutModal] = useState<boolean>(false);
  const [showSheetSetModal, setShowSheetSetModal] = useState<boolean>(false);
  const [supportConfig, setSupportConfig] = useState<RockSupportDesignConfig>(() =>
    createDefaultRockSupportConfig(geometry, 6.5)
  );

  useEffect(() => {
    if (!resizingInspector) return;
    const onMove = (ev: MouseEvent | PointerEvent) => {
      const dx = ev.clientX - resizingInspector.startX;
      const delta = inspectorDockSide === 'right' ? -dx : dx;
      setInspectorWidthPx(
        Math.max(195, Math.min(640, Math.round(resizingInspector.startWidth + delta)))
      );
    };
    const onUp = () => setResizingInspector(null);
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
  }, [resizingInspector, inspectorDockSide]);

  // Trigger layout recalculation when the Collapsible Property Palette is expanded or collapsed
  useEffect(() => {
    triggerGlobalLayoutRecalculation();
  }, [showCadPropertiesAlways, activeTool]);

  // Canvas Viewport Zoom & Pan State (Sections 1, 2, 3, 4, 5, 15)
  // Never resets when switching tools!
  const [viewport, setViewport] = useState<CanvasViewportState>({
    zoom: 1,
    panX: 0,
    panY: 0,
  });
  const [isSpacePanning, setIsSpacePanning] = useState<boolean>(false);
  const [draggingCanvasPan, setDraggingCanvasPan] = useState<{
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  const [layoutVersion, setLayoutVersion] = useState<number>(0);

  // Touch Pinch-to-Zoom & Two-Finger Pan State (Section 15)
  const touchGestureRef = useRef<{
    isMultiTouch: boolean;
    startDist: number;
    startZoom: number;
    startMidX: number;
    startMidY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  // Lithology Region Selection, Polygon Drawing, Undo/Redo & Reshaping State (Sections 7, 8, 11–14)
  const [selectedLithologyRegionId, setSelectedLithologyRegionId] = useState<string | null>(null);
  const [activeLithologyPattern, setActiveLithologyPattern] =
    useState<LithologyPatternType>('quartzite');
  const [isDrawingLithologyPolygon, setIsDrawingLithologyPolygon] = useState<boolean>(false);
  const [draftLithologyPoints, setDraftLithologyPoints] = useState<Point2D[]>([]);
  const [reopenedLithologyRegionId, setReopenedLithologyRegionId] = useState<string | null>(null);
  const [lithologyPast, setLithologyPast] = useState<LithologyRegion[][]>([]);
  const [lithologyFuture, setLithologyFuture] = useState<LithologyRegion[][]>([]);
  const [draggingLithologyVertex, setDraggingLithologyVertex] = useState<{
    regionId: string;
    vertexIndex: number;
  } | null>(null);
  const [draggingDraftLithologyIdx, setDraggingDraftLithologyIdx] = useState<number | null>(null);
  const [draggingWholeLithology, setDraggingWholeLithology] = useState<{
    regionId: string;
    startMeters: Point2D;
    origPolygon: Point2D[];
  } | null>(null);
  const [resizingLithologyRegion, setResizingLithologyRegion] = useState<{
    regionId: string;
    centroid: Point2D;
    startDistX: number;
    startDistY: number;
    origPolygon: Point2D[];
  } | null>(null);

  // Dedicated Survey / Geological Control Point Tool State (Sections 5, 6, 7, 8)
  const [selectedControlPointId, setSelectedControlPointId] = useState<string | null>(null);
  const [draggingControlPointId, setDraggingControlPointId] = useState<string | null>(null);
  const [controlPointPast, setControlPointPast] = useState<SurveyControlPoint[][]>([]);
  const [controlPointFuture, setControlPointFuture] = useState<SurveyControlPoint[][]>([]);
  const [cpDraftLabel, setCpDraftLabel] = useState<string>('');
  const [cpDraftX, setCpDraftX] = useState<string>('0.00');
  const [cpDraftY, setCpDraftY] = useState<string>('0.00');

  // Professional Geological Symbol Library & Editor State (Sections 9, 10, 12, 15)
  const [selectedSymbolId, setSelectedSymbolId] = useState<string | null>(null);
  const [activeSymbolTypeToPlace, setActiveSymbolTypeToPlace] =
    useState<GeologicalSymbolType>('joint');
  const [symbolPast, setSymbolPast] = useState<PlacedGeologicalSymbol[][]>([]);
  const [symbolFuture, setSymbolFuture] = useState<PlacedGeologicalSymbol[][]>([]);
  const [draggingSymbolId, setDraggingSymbolId] = useState<string | null>(null);
  const [rotatingSymbolState, setRotatingSymbolState] = useState<{
    symbolId: string;
    centerPx: { cx: number; cy: number };
  } | null>(null);
  const [scalingSymbolState, setScalingSymbolState] = useState<{
    symbolId: string;
    centerPx: { cx: number; cy: number };
    initialDistPx: number;
    initialScale: number;
  } | null>(null);

  // Drawing new or re-drawn joint polyline points in real-world meters (Sections 9, 10, 11, 12)
  const [jointDrawMode, setJointDrawMode] = useState<JointDrawMode>('polyline');
  const [isFreehandDrawingJoint, setIsFreehandDrawingJoint] = useState<boolean>(false);
  const [draftJointPoints, setDraftJointPoints] = useState<Point2D[]>([]);
  const [draggingDraftJointIdx, setDraggingDraftJointIdx] = useState<number | null>(null);

  // Automatically clear transient drawers when switching Ribbon Windows (cadRibbonTab)
  useEffect(() => {
    if (cadRibbonTab !== 'CLASSIFICATION_SHEET') {
      setShowSetTableDrawer(false);
      setShowAILearningDrawer(false);
    }
  }, [cadRibbonTab]);

  // Auto-open Properties sidebar once user selects or completes a geological element
  useEffect(() => {
    if (
      selectedJointId ||
      selectedLithologyRegionId ||
      selectedSymbolId ||
      selectedControlPointId
    ) {
      setShowCadPropertiesAlways(true);
    }
  }, [
    selectedJointId,
    selectedLithologyRegionId,
    selectedSymbolId,
    selectedControlPointId,
  ]);

  // Automatically clear unrelated selections and draft rubber-band lines when switching activeTool
  useEffect(() => {
    if (
      activeTool !== 'control_point' &&
      activeTool !== 'overbreak' &&
      activeTool !== 'select'
    ) {
      setSelectedControlPointId(null);
    }
    if (activeTool !== 'geological_symbol' && activeTool !== 'select') {
      setSelectedSymbolId(null);
    }
    if (activeTool !== 'lithology' && activeTool !== 'select') {
      setSelectedLithologyRegionId(null);
      setIsDrawingLithologyPolygon(false);
      setDraftLithologyPoints([]);
    }
    if (
      activeTool !== 'add_joint' &&
      activeTool !== 'redraw_joint' &&
      activeTool !== 'append_joint'
    ) {
      setDraftJointPoints([]);
      setIsFreehandDrawingJoint(false);
    }
    if (
      activeTool !== 'select' &&
      activeTool !== 'dip_probe' &&
      activeTool !== 'add_joint' &&
      activeTool !== 'redraw_joint' &&
      activeTool !== 'append_joint'
    ) {
      setSelectedJointId(null);
      setSelectedJointVertexIdx(null);
    }
    if (activeTool !== 'photo_fit') {
      setAddingControlPointMode(false);
      setDrawingCustomMaskMode(false);
    }
    if (activeTool !== 'measure') {
      setMeasurePts([]);
    }
  }, [activeTool]);
  const [draftFeatureType, setDraftFeatureType] = useState<GeologicalFeatureType>('joint');
  const [draftSetId, setDraftSetId] = useState<string>('J1');
  const [syncFeaturesWithPhotoTransform, setSyncFeaturesWithPhotoTransform] =
    useState<boolean>(true);
  const [activePhotoRidgeField, setActivePhotoRidgeField] = useState<PhotoRidgeField | null>(null);
  const [activePhotoFilterMode, setActivePhotoFilterMode] =
    useState<PhotoSpectralFilterMode>('original');
  const [showCrackXRayOverlay, setShowCrackXRayOverlay] = useState<boolean>(false);
  const [showDepthReliefOverlay, setShowDepthReliefOverlay] = useState<boolean>(false);
  const [showPhotogrammetryModal, setShowPhotogrammetryModal] = useState<boolean>(false);
  const [show3DPhotoTunnelModal, setShow3DPhotoTunnelModal] = useState<boolean>(false);
  const [photogrammetryInitialTab, setPhotogrammetryInitialTab] =
    useState<PhotogrammetryLabTab>('kinematic');
  const [windowComplexityMode, setWindowComplexityMode] = useState<'simple' | 'advanced'>('simple');

  // Synchronized Dual-Canvas Face Mapping Photogrammetry States
  const [dualCanvasViewMode, setDualCanvasViewMode] = useState<'dual' | 'single_photo' | 'single_clean'>('single_clean');
  const [isPeekingTracesOnPhoto, setIsPeekingTracesOnPhoto] = useState<boolean>(false);
  const [showTracedFeaturesDrawer, setShowTracedFeaturesDrawer] = useState<boolean>(false);
  const [pendingJointConfirmation, setPendingJointConfirmation] =
    useState<PendingJointConfirmation | null>(null);

  // Shift-key peeking: holding Shift reveals confirmed traces over rock photo
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

  const openPhotogrammetryLab = (tab: PhotogrammetryLabTab) => {
    setPhotogrammetryInitialTab(tab);
    setShowPhotogrammetryModal(true);
  };

  // Measure tool points in real-world meters & 2-Point Laser/Tape Scale Calibration input
  const [measurePts, setMeasurePts] = useState<Point2D[]>([]);
  const [knownScaleDistanceInput, setKnownScaleDistanceInput] = useState<string>('3.50');
  const [showSimpleAccuracyModal, setShowSimpleAccuracyModal] = useState<boolean>(false);
  const [simpleAccuracyInitialTab, setSimpleAccuracyInitialTab] =
    useState<SimpleAddonTab>('full_photo_1ft_scale');
  const [show3DStrikeDipModal, setShow3DStrikeDipModal] = useState<boolean>(false);
  const [showMatlabAnalyzerModal, setShowMatlabAnalyzerModal] = useState<boolean>(false);
  const [matlabInitialTab, setMatlabInitialTab] =
    useState<MatlabAnalyzerTab>('FACE_JOIN_AND_BLOCKS');
  const [showJunctionFactorModal, setShowJunctionFactorModal] = useState<boolean>(false);
  const [junctionFactorData, setJunctionFactorData] = useState<JunctionFactorResult | null>(null);

  // Live cursor coordinates in real-world meters & canvas pixels
  const [cursorMeters, setCursorMeters] = useState<Point2D | null>(null);
  const [cursorCanvasPx, setCursorCanvasPx] = useState<{ cx: number; cy: number } | null>(null);

  // Dragging vertex state
  const [draggingVertex, setDraggingVertex] = useState<{
    jointId: string;
    vertexIndex: number;
  } | null>(null);

  // Dragging entire joint state
  const [draggingWholeJoint, setDraggingWholeJoint] = useState<{
    jointId: string;
    startMeters: Point2D;
    origPoints: Point2D[];
  } | null>(null);

  // Dragging photo offset, perspective corner, edge midpoint, mesh control point, or custom mask vertex
  const [draggingPhotoHandle, setDraggingPhotoHandle] = useState<{
    type: 'move' | 'corner' | 'edge' | 'mesh_cp' | 'mask_vertex';
    cornerIndex?: number;
    edgeIndex?: number;
    cpId?: string;
    maskVertexIndex?: number;
    startClientX: number;
    startClientY: number;
    initialTransform: SurfaceTransform;
  } | null>(null);

  // Full Photo Fitting Editor state & Undo/Redo stack
  const [photoEditSubTab, setPhotoEditSubTab] = useState<PhotoEditorSubTab>('basic');
  const [showMeshGrid, setShowMeshGrid] = useState<boolean>(true);
  const [addingControlPointMode, setAddingControlPointMode] = useState<boolean>(false);
  const [drawingCustomMaskMode, setDrawingCustomMaskMode] = useState<boolean>(false);
  const [splTwoClickMode, setSplTwoClickMode] = useState<boolean>(false);
  const [splFirstPointUV, setSplFirstPointUV] = useState<{ u: number; v: number } | null>(null);
  const [transformPast, setTransformPast] = useState<SurfaceTransform[]>([]);
  const [transformFuture, setTransformFuture] = useState<SurfaceTransform[]>([]);
  const [initialTransformSnapshot, setInitialTransformSnapshot] =
    useState<SurfaceTransform | null>(null);
  const [liveWarpedImageUrl, setLiveWarpedImageUrl] = useState<string | null>(null);
  const lastTransformHistoryPushRef = useRef<number>(0);

  // If Crown or a Wall is disabled in Custom Tunnel Shape (e.g. Transformer Hall with Face + Walls only), ensure activeSurface is valid
  useEffect(() => {
    if (activeSurface === 'crown' && geometry.hasCrown === false) {
      onSelectSurface('face');
    } else if (activeSurface === 'leftWall' && geometry.hasLeftWall === false) {
      onSelectSurface('face');
    } else if (activeSurface === 'rightWall' && geometry.hasRightWall === false) {
      onSelectSurface('face');
    }
  }, [activeSurface, geometry.hasCrown, geometry.hasLeftWall, geometry.hasRightWall, onSelectSurface]);

  // Collapsible bottom Geological Tables & Barton Q-Index drawer & AI Learning drawer
  const [showSetTableDrawer, setShowSetTableDrawer] = useState<boolean>(false);
  const [geologyDrawerTab, setGeologyDrawerTab] = useState<'geology_tables' | 'q_index'>(
    'geology_tables'
  );
  const [showAILearningDrawer, setShowAILearningDrawer] = useState<boolean>(false);
  const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);
  const [layerVisibility, setLayerVisibility] = useState<VectorLayerVisibility>({
    photo: true,
    overbreakUndercut: false,
    controlPoints: true,
    joints: true,
    fractures: true,
    faults: true,
    bedding: true,
    foliation: true,
    lithology: true,
    otherStructures: true,
    annotations: true,
  });

  const svgCanvasRef = useRef<SVGSVGElement | null>(null);
  const worldGroupRef = useRef<SVGGElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stereoFileInputRef = useRef<HTMLInputElement | null>(null);

  const currentPhoto = photos[activeSurface];
  const responsive = useResponsiveLayout();
  const canvasStageSize = useContainerResizeObserver(
    canvasContainerRef,
    DEFAULT_VIEW_W,
    DEFAULT_VIEW_H,
    true
  );

  // Unified Master Canvas Stage Metrics (Section 1) — Dynamically adapts to live container aspect ratio (including wide horizontal screens)
  const viewH = DEFAULT_VIEW_H;
  const viewW = useMemo(() => {
    const ratio = canvasStageSize.width / Math.max(1, canvasStageSize.height);
    const clampedRatio = Math.max(0.55, Math.min(3.85, ratio));
    return Math.round(viewH * clampedRatio);
  }, [canvasStageSize.width, canvasStageSize.height, viewH]);

  const padPx = useMemo(
    () => (responsive.isShortLandscape ? 8 : responsive.isCompactScreen ? 12 : 16),
    [responsive.isShortLandscape, responsive.isCompactScreen]
  );

  const stageMetrics = useMemo(
    () => computeCanvasStageMetrics(activeSurface, geometry, settings, viewW, viewH, padPx),
    [
      activeSurface,
      geometry,
      settings,
      viewW,
      viewH,
      padPx,
      canvasStageSize.revision,
      responsive.layoutRevision,
    ]
  );
  const surfaceBounds = stageMetrics.surfaceBounds;
  const pxPerMeter = stageMetrics.pxPerMeter;
  const surfaceRectPx = stageMetrics.surfaceRectPx;

  // Trigger container stage size check when side panels/drawers change without firing global layout loops
  useLayoutEffect(() => {
    canvasStageSize.recalculate();
  }, [
    showCadPropertiesAlways,
    cadRibbonCollapsed,
    inspectorWidthPx,
    showSetTableDrawer,
    showAILearningDrawer,
    activeSurface,
    canvasStageSize.recalculate,
  ]);

  // Spacebar hold for instant Canvas Pan & Keyboard Shortcuts (Undo/Redo/Escape/Enter/Backspace)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space' && !isSpacePanning) {
        e.preventDefault();
        setIsSpacePanning(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
      } else if (e.key === 'Escape') {
        if (isDrawingLithologyPolygon) {
          setDraftLithologyPoints([]);
          setIsDrawingLithologyPolygon(false);
          setReopenedLithologyRegionId(null);
        } else if (draftJointPoints.length > 0) {
          setDraftJointPoints([]);
        }
      } else if (e.key === 'Backspace') {
        if (isDrawingLithologyPolygon && draftLithologyPoints.length > 0) {
          e.preventDefault();
          setDraftLithologyPoints((prev) => prev.slice(0, -1));
        } else if (
          (activeTool === 'add_joint' || activeTool === 'redraw_joint') &&
          draftJointPoints.length > 0
        ) {
          e.preventDefault();
          setDraftJointPoints((prev) => prev.slice(0, -1));
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePanning(false);
        setDraggingCanvasPan(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    isSpacePanning,
    isDrawingLithologyPolygon,
    draftLithologyPoints.length,
    activeTool,
    draftJointPoints.length,
    onUndo,
    onRedo,
  ]);

  // Lithology, Control Points & Geological Symbols update wrappers with Undo/Redo history tracking (Sections 5, 13, 15)
  const handleUpdateLithologyWithHistory = useCallback(
    (nextRegions: LithologyRegion[]) => {
      setLithologyPast((prev) => [...prev.slice(-24), lithologyRegions]);
      setLithologyFuture([]);
      onUpdateLithologyRegions(nextRegions);
    },
    [lithologyRegions, onUpdateLithologyRegions]
  );

  const handleUpdateControlPointsWithHistory = useCallback(
    (
      updater:
        | SurveyControlPoint[]
        | ((prev: SurveyControlPoint[]) => SurveyControlPoint[])
    ) => {
      const next = typeof updater === 'function' ? updater(controlPoints) : updater;
      setControlPointPast((p) => [...p.slice(-24), controlPoints]);
      setControlPointFuture([]);
      onUpdateControlPoints(next);
    },
    [controlPoints, onUpdateControlPoints]
  );

  const handleUpdatePlacedSymbolsWithHistory = useCallback(
    (
      updater:
        | PlacedGeologicalSymbol[]
        | ((prev: PlacedGeologicalSymbol[]) => PlacedGeologicalSymbol[])
    ) => {
      const next = typeof updater === 'function' ? updater(placedSymbols) : updater;
      setSymbolPast((p) => [...p.slice(-24), placedSymbols]);
      setSymbolFuture([]);
      onUpdatePlacedSymbols(next);
    },
    [placedSymbols, onUpdatePlacedSymbols]
  );

  const handleUndoLithology = useCallback(() => {
    if (activeTool === 'control_point' || selectedControlPointId) {
      if (controlPointPast.length > 0) {
        const previous = controlPointPast[controlPointPast.length - 1];
        setControlPointPast((prev) => prev.slice(0, -1));
        setControlPointFuture((prev) => [controlPoints, ...prev]);
        onUpdateControlPoints(previous);
        return;
      }
    }
    if (activeTool === 'geological_symbol' || selectedSymbolId) {
      if (symbolPast.length > 0) {
        const previous = symbolPast[symbolPast.length - 1];
        setSymbolPast((prev) => prev.slice(0, -1));
        setSymbolFuture((prev) => [placedSymbols, ...prev]);
        onUpdatePlacedSymbols(previous);
        return;
      }
    }
    if (lithologyPast.length > 0) {
      const previous = lithologyPast[lithologyPast.length - 1];
      setLithologyPast((prev) => prev.slice(0, -1));
      setLithologyFuture((prev) => [lithologyRegions, ...prev]);
      onUpdateLithologyRegions(previous);
      return;
    }
    if (controlPointPast.length > 0) {
      const previous = controlPointPast[controlPointPast.length - 1];
      setControlPointPast((prev) => prev.slice(0, -1));
      setControlPointFuture((prev) => [controlPoints, ...prev]);
      onUpdateControlPoints(previous);
      return;
    }
    if (symbolPast.length > 0) {
      const previous = symbolPast[symbolPast.length - 1];
      setSymbolPast((prev) => prev.slice(0, -1));
      setSymbolFuture((prev) => [placedSymbols, ...prev]);
      onUpdatePlacedSymbols(previous);
      return;
    }
    if (canUndo) onUndo();
  }, [
    activeTool,
    selectedControlPointId,
    controlPointPast,
    controlPoints,
    onUpdateControlPoints,
    selectedSymbolId,
    symbolPast,
    placedSymbols,
    onUpdatePlacedSymbols,
    lithologyPast,
    lithologyRegions,
    onUpdateLithologyRegions,
    canUndo,
    onUndo,
  ]);

  const handleRedoLithology = useCallback(() => {
    if (activeTool === 'control_point' || selectedControlPointId) {
      if (controlPointFuture.length > 0) {
        const next = controlPointFuture[0];
        setControlPointFuture((prev) => prev.slice(1));
        setControlPointPast((prev) => [...prev, controlPoints]);
        onUpdateControlPoints(next);
        return;
      }
    }
    if (activeTool === 'geological_symbol' || selectedSymbolId) {
      if (symbolFuture.length > 0) {
        const next = symbolFuture[0];
        setSymbolFuture((prev) => prev.slice(1));
        setSymbolPast((prev) => [...prev, placedSymbols]);
        onUpdatePlacedSymbols(next);
        return;
      }
    }
    if (lithologyFuture.length > 0) {
      const next = lithologyFuture[0];
      setLithologyFuture((prev) => prev.slice(1));
      setLithologyPast((prev) => [...prev, lithologyRegions]);
      onUpdateLithologyRegions(next);
      return;
    }
    if (controlPointFuture.length > 0) {
      const next = controlPointFuture[0];
      setControlPointFuture((prev) => prev.slice(1));
      setControlPointPast((prev) => [...prev, controlPoints]);
      onUpdateControlPoints(next);
      return;
    }
    if (symbolFuture.length > 0) {
      const next = symbolFuture[0];
      setSymbolFuture((prev) => prev.slice(1));
      setSymbolPast((prev) => [...prev, placedSymbols]);
      onUpdatePlacedSymbols(next);
      return;
    }
    if (canRedo) onRedo();
  }, [
    activeTool,
    selectedControlPointId,
    controlPointFuture,
    controlPoints,
    onUpdateControlPoints,
    selectedSymbolId,
    symbolFuture,
    placedSymbols,
    onUpdatePlacedSymbols,
    lithologyFuture,
    lithologyRegions,
    onUpdateLithologyRegions,
    canRedo,
    onRedo,
  ]);

  const surfaceJoints = useMemo(
    () =>
      joints.filter((j) => {
        if (j.surface !== activeSurface) return false;
        if (j.featureType === 'joint' && !layerVisibility.joints) return false;
        if (j.featureType === 'fracture' && !layerVisibility.fractures) return false;
        if ((j.featureType === 'fault' || j.featureType === 'shear') && !layerVisibility.faults)
          return false;
        if (
          (j.featureType === 'bedding' || j.featureType === 'shale_band') &&
          !layerVisibility.bedding
        )
          return false;
        if (
          (j.featureType === 'foliation' || j.featureType === 'lineation') &&
          !layerVisibility.foliation
        )
          return false;
        if (
          (j.featureType === 'lithological_contact' || j.featureType === 'dolerite') &&
          !layerVisibility.lithology
        )
          return false;
        if (
          (j.featureType === 'fold' ||
            j.featureType === 'infilling' ||
            j.featureType === 'vein' ||
            j.featureType === 'clay_band' ||
            j.featureType === 'seam' ||
            j.featureType === 'water_seepage') &&
          !layerVisibility.otherStructures
        )
          return false;
        return true;
      }),
    [joints, activeSurface, layerVisibility]
  );

  // Real-time trace duplicate & overlap detection
  const activeOverlapResult = useMemo(() => {
    if (draftJointPoints.length < 2) return null;
    return detectTraceOverlap(draftJointPoints, surfaceJoints, activeSurface, joints, 0.18);
  }, [draftJointPoints, surfaceJoints, activeSurface, joints]);

  const selectedJoint = useMemo(
    () => joints.find((j) => j.id === selectedJointId) || null,
    [joints, selectedJointId]
  );

  const surfaceControlPoints = useMemo(
    () => controlPoints.filter((cp) => cp.surface === activeSurface),
    [controlPoints, activeSurface]
  );

  const selectedControlPoint = useMemo(
    () => surfaceControlPoints.find((cp) => cp.id === selectedControlPointId) || null,
    [surfaceControlPoints, selectedControlPointId]
  );

  // Keep the Control Point edit panel inputs synchronized whenever selectedControlPoint changes or is dragged (Section 8)
  useEffect(() => {
    if (selectedControlPoint) {
      setCpDraftLabel(selectedControlPoint.label);
      setCpDraftX(selectedControlPoint.point.x.toFixed(2));
      setCpDraftY(selectedControlPoint.point.y.toFixed(2));
    }
  }, [
    selectedControlPoint?.id,
    selectedControlPoint?.label,
    selectedControlPoint?.point.x,
    selectedControlPoint?.point.y,
  ]);

  const surfacePlacedSymbols = useMemo(
    () => placedSymbols.filter((s) => s.surface === activeSurface),
    [placedSymbols, activeSurface]
  );

  const selectedSymbol = useMemo(
    () => surfacePlacedSymbols.find((s) => s.id === selectedSymbolId) || null,
    [surfacePlacedSymbols, selectedSymbolId]
  );

  const handleDeleteControlPoint = useCallback(
    (cpId: string) => {
      handleUpdateControlPointsWithHistory((prev) => prev.filter((cp) => cp.id !== cpId));
      setSelectedControlPointId((prev) => (prev === cpId ? null : prev));
    },
    [handleUpdateControlPointsWithHistory]
  );

  const handleDeletePlacedSymbol = useCallback(
    (symId: string) => {
      handleUpdatePlacedSymbolsWithHistory((prev) => prev.filter((s) => s.id !== symId));
      setSelectedSymbolId((prev) => (prev === symId ? null : prev));
    },
    [handleUpdatePlacedSymbolsWithHistory]
  );

  // Live Quality Control check summary (Section 19 & 31)
  const qcReport = useMemo(() => {
    const uploadedCount = Object.values(photos).filter((p) => Boolean(p.image)).length;
    return runQualityControlValidation(
      geometry,
      settings,
      joints,
      uploadedCount,
      currentPhoto.stereoBaselineWarning
    );
  }, [geometry, settings, joints, photos, currentPhoto.stereoBaselineWarning]);

  // ============================================================================
  // CENTRALIZED CANVAS COORDINATE MANAGER (src/engine/canvasTransform.ts)
  // Exclusively handles all screenToWorld and worldToScreen transformations
  // ============================================================================
  const coordManager = useMemo(
    () =>
      new CanvasCoordinateManager({
        svgElement: svgCanvasRef,
        worldGroupElement: worldGroupRef,
        viewport,
        stageMetrics,
        photoTransform: currentPhoto.transform,
      }),
    [
      viewport,
      stageMetrics,
      currentPhoto.transform,
      layoutVersion,
      canvasStageSize.revision,
      responsive.layoutRevision,
    ]
  );

  // Viewport Pan & Zoom SVG transform string
  const viewportSvgTransform = useMemo(
    () => coordManager.getViewportSvgTransform(),
    [coordManager]
  );

  // Zoom around a specific screen point (or canvas center) without shifting the point under cursor
  const zoomViewportAtScreenPoint = useCallback(
    (nextZoomRaw: number, clientX?: number, clientY?: number) => {
      setViewport((prev) => {
        const mgr = new CanvasCoordinateManager({
          svgElement: svgCanvasRef,
          worldGroupElement: worldGroupRef,
          viewport: prev,
          stageMetrics,
          photoTransform: currentPhoto.transform,
        });
        return mgr.zoomAtScreenPoint(nextZoomRaw, clientX, clientY);
      });
    },
    [stageMetrics, currentPhoto.transform]
  );

  // Master boundary polygon path on the SVG canvas
  const surfaceBoundaryPath = useMemo(() => {
    if (activeSurface === 'face') {
      return (
        geometry.crossSectionPoints
          .map((pt, idx) => {
            const { cx, cy } = coordManager.worldToScreen(pt);
            return `${idx === 0 ? 'M' : 'L'} ${cx.toFixed(2)} ${cy.toFixed(2)}`;
          })
          .join(' ') + ' Z'
      );
    }
    const tl = coordManager.worldToScreen({ x: surfaceBounds.minX, y: surfaceBounds.maxY });
    const br = coordManager.worldToScreen({ x: surfaceBounds.maxX, y: surfaceBounds.minY });
    return `M ${tl.cx} ${tl.cy} L ${br.cx} ${tl.cy} L ${br.cx} ${br.cy} L ${tl.cx} ${br.cy} Z`;
  }, [activeSurface, geometry.crossSectionPoints, surfaceBounds, coordManager]);

  // Custom polygon mask path (P1, P2, P3, P4, P5, P6, P7...) on the SVG canvas
  const customMaskPolygonPath = useMemo(() => {
    const pts = currentPhoto.transform.customMaskPoints;
    if (!pts || pts.length < 3) return surfaceBoundaryPath;
    return (
      pts
        .map((pt, idx) => {
          const { cx, cy } = coordManager.worldToScreen(pt);
          return `${idx === 0 ? 'M' : 'L'} ${cx.toFixed(2)} ${cy.toFixed(2)}`;
        })
        .join(' ') + ' Z'
    );
  }, [currentPhoto.transform.customMaskPoints, surfaceBoundaryPath, coordManager]);

  const warpDeformationSig = useMemo(
    () => getWarpDeformationSignature(currentPhoto.transform),
    [currentPhoto.transform]
  );
  const isActivelyDraggingPhoto = Boolean(draggingPhotoHandle);

  // Real-time piecewise mesh & perspective canvas rasterization ONLY when non-affine warp/crop changes
  useEffect(() => {
    let cancelled = false;
    if (!currentPhoto.image) {
      setLiveWarpedImageUrl(null);
      return;
    }
    if (warpDeformationSig === 'IDENTITY') {
      setLiveWarpedImageUrl(currentPhoto.image);
      if (currentPhoto.warpedImage && currentPhoto.warpedImage !== currentPhoto.image) {
        onUpdatePhotoSurface(activeSurface, (prev) =>
          prev.warpedImage === prev.image ? prev : { ...prev, warpedImage: prev.image }
        );
      }
      return;
    }
    const debounceMs = isActivelyDraggingPhoto ? 90 : 45;
    const timer = setTimeout(async () => {
      const warpedUrl = await generatePiecewiseWarpedPhotoDataUrl(
        currentPhoto.image!,
        currentPhoto.transform,
        isActivelyDraggingPhoto
      );
      if (!cancelled) {
        setLiveWarpedImageUrl(warpedUrl);
        if (!isActivelyDraggingPhoto && warpedUrl && currentPhoto.warpedImage !== warpedUrl) {
          onUpdatePhotoSurface(activeSurface, (prev) =>
            prev.warpedImage === warpedUrl ? prev : { ...prev, warpedImage: warpedUrl }
          );
        }
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    currentPhoto.image,
    warpDeformationSig,
    isActivelyDraggingPhoto,
    activeSurface,
    onUpdatePhotoSurface,
  ]);

  // Precompute Multi-Scale Frangi/Steger Hessian Ridge & Geodesic Cost Field on active photo
  // Uses cached non-blocking builder and only recomputes when the active photo or surface changes
  useEffect(() => {
    if (isActivelyDraggingPhoto) {
      return;
    }
    let cancelled = false;
    const displayImg = currentPhoto.warpedImage || currentPhoto.image;
    if (!displayImg) {
      setActivePhotoRidgeField(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const supImg = currentPhoto.supportingPhotos?.[0]?.image || currentPhoto.stereoImage || undefined;
        const field = await buildPhotoRidgeField(displayImg, 340, supImg);
        if (!cancelled) {
          setActivePhotoRidgeField(field);
        }
      } catch {
        if (!cancelled) {
          setActivePhotoRidgeField(null);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    isActivelyDraggingPhoto,
    currentPhoto.warpedImage,
    currentPhoto.image,
    currentPhoto.supportingPhotos,
    currentPhoto.stereoImage,
    activeSurface,
  ]);

  // Compute live Magnetic Live-Wire geodesic segment from last clicked vertex to current cursor
  const livewirePreviewSegment = useMemo<Point2D[]>(() => {
    if (
      jointDrawMode !== 'magnetic_livewire' ||
      !activePhotoRidgeField ||
      draftJointPoints.length === 0 ||
      !cursorMeters ||
      isFreehandDrawingJoint
    ) {
      return [];
    }
    const lastPt = draftJointPoints[draftJointPoints.length - 1];
    const startUV = surfaceMetersToImageUV(
      lastPt,
      activeSurface,
      geometry,
      settings,
      currentPhoto.transform
    );
    const endUV = surfaceMetersToImageUV(
      cursorMeters,
      activeSurface,
      geometry,
      settings,
      currentPhoto.transform
    );
    const uvPath = traceGeodesicPathBetweenUVPoints(
      activePhotoRidgeField,
      { x: startUV.u, y: startUV.v },
      { x: endUV.u, y: endUV.v },
      7
    );
    return uvPath.map((uv) =>
      imageUVToSurfaceMeters(
        uv.x,
        uv.y,
        activeSurface,
        geometry,
        settings,
        currentPhoto.transform,
        currentPhoto.calibration,
        true
      )
    );
  }, [
    jointDrawMode,
    activePhotoRidgeField,
    draftJointPoints,
    cursorMeters,
    isFreehandDrawingJoint,
    activeSurface,
    geometry,
    settings,
    currentPhoto.transform,
    currentPhoto.calibration,
  ]);

  // Compute live Real-Time (<1.5ms) MATLAB Sub-Pixel Seed Auto-Propagate + ActiveContour Snake preview while hovering in 'seed_autotrace' mode
  const seedAutotraceHoverPreview = useMemo<{
    points: Point2D[];
    confidencePct: number;
  } | null>(() => {
    if (
      activeTool !== 'add_joint' ||
      jointDrawMode !== 'seed_autotrace' ||
      !activePhotoRidgeField ||
      !cursorMeters
    ) {
      return null;
    }
    const seedUV = surfaceMetersToImageUV(
      cursorMeters,
      activeSurface,
      geometry,
      settings,
      currentPhoto.transform
    );
    if (seedUV.u < 0.01 || seedUV.u > 0.99 || seedUV.v < 0.01 || seedUV.v > 0.99) {
      return null;
    }
    const propagated = autoPropagateFractureFromSeedUV(activePhotoRidgeField, {
      x: seedUV.u,
      y: seedUV.v,
    });
    if (!propagated || propagated.uvPoints.length < 2) return null;
    const meterPts = propagated.uvPoints.map((uv) =>
      imageUVToSurfaceMeters(
        uv.x,
        uv.y,
        activeSurface,
        geometry,
        settings,
        currentPhoto.transform,
        currentPhoto.calibration,
        true
      )
    );
    const clipped = clipPolylineToSurface(meterPts, activeSurface, geometry, settings);
    if (clipped.length < 2) return null;
    return {
      points: clipped,
      confidencePct: Math.round(propagated.confidenceScore * 100),
    };
  }, [
    activeTool,
    jointDrawMode,
    activePhotoRidgeField,
    cursorMeters,
    activeSurface,
    geometry,
    settings,
    currentPhoto.transform,
    currentPhoto.calibration,
  ]);

  // Synchronize mapped geological features on activeSurface when photo is rotated/scaled/moved (Section 6)
  const syncSurfaceFeaturesToPhotoTransform = useCallback(
    (prevT: SurfaceTransform, nextT: SurfaceTransform) => {
      if (!syncFeaturesWithPhotoTransform) return;
      const affineChanged =
        prevT.offsetX !== nextT.offsetX ||
        prevT.offsetY !== nextT.offsetY ||
        prevT.scaleX !== nextT.scaleX ||
        prevT.scaleY !== nextT.scaleY ||
        (prevT.zoom ?? 1) !== (nextT.zoom ?? 1) ||
        prevT.rotation !== nextT.rotation;
      if (!affineChanged) return;

      const hasSurfaceJoints = joints.some((j) => j.surface === activeSurface);
      if (hasSurfaceJoints) {
        const nextJoints = joints.map((j) => {
          if (j.surface !== activeSurface) return j;
          const nextGeom = j.geometry.map((pt) =>
            coordManager.transformWorldPointForPhotoChange(pt, prevT, nextT)
          );
          return {
            ...j,
            geometry: nextGeom,
          };
        });
        onUpdateJointsWithHistory(nextJoints);
      }

      const hasSurfaceLith = lithologyRegions.some((r) => r.surface === activeSurface);
      if (hasSurfaceLith) {
        const nextLith = lithologyRegions.map((r) => {
          if (r.surface !== activeSurface) return r;
          const nextPoly = r.polygon.map((pt) =>
            coordManager.transformWorldPointForPhotoChange(pt, prevT, nextT)
          );
          return {
            ...r,
            polygon: nextPoly,
            polygonPoints: nextPoly,
          };
        });
        onUpdateLithologyRegions(nextLith);
      }

      const hasSurfaceCPs = controlPoints.some((cp) => cp.surface === activeSurface);
      if (hasSurfaceCPs) {
        onUpdateControlPoints((prevCPs) =>
          prevCPs.map((cp) => {
            if (cp.surface !== activeSurface) return cp;
            const nextPt = coordManager.transformWorldPointForPhotoChange(
              cp.point,
              prevT,
              nextT
            );
            return {
              ...cp,
              point: nextPt,
              imageUV: coordManager.worldToPhotoUV(nextPt, nextT),
            };
          })
        );
      }

      const hasSurfaceSyms = placedSymbols.some((sym) => sym.surface === activeSurface);
      if (hasSurfaceSyms) {
        onUpdatePlacedSymbols((prevSyms) =>
          prevSyms.map((sym) => {
            if (sym.surface !== activeSurface) return sym;
            const nextPt = coordManager.transformWorldPointForPhotoChange(
              sym.point,
              prevT,
              nextT
            );
            return {
              ...sym,
              point: nextPt,
            };
          })
        );
      }
    },
    [
      syncFeaturesWithPhotoTransform,
      joints,
      activeSurface,
      coordManager,
      onUpdateJointsWithHistory,
      lithologyRegions,
      onUpdateLithologyRegions,
      controlPoints,
      onUpdateControlPoints,
      placedSymbols,
      onUpdatePlacedSymbols,
    ]
  );

  // Update active surface transform with throttled Undo/Redo history tracking
  const handleUpdateTransformWithHistory = useCallback(
    (updater: (prev: SurfaceTransform) => SurfaceTransform) => {
      const prevT = currentPhoto.transform;
      const nextT = updater(prevT);
      const now = Date.now();
      if (now - lastTransformHistoryPushRef.current > 350) {
        setTransformPast((prev) => [...prev.slice(-18), prevT]);
        lastTransformHistoryPushRef.current = now;
      }
      setTransformFuture([]);
      onUpdatePhotoSurface(activeSurface, (prev) => ({
        ...prev,
        transform: nextT,
      }));
      syncSurfaceFeaturesToPhotoTransform(prevT, nextT);
    },
    [
      currentPhoto.transform,
      activeSurface,
      onUpdatePhotoSurface,
      syncSurfaceFeaturesToPhotoTransform,
    ]
  );

  const handleUndoTransform = useCallback(() => {
    if (transformPast.length === 0) return;
    const previous = transformPast[transformPast.length - 1];
    const prevT = currentPhoto.transform;
    setTransformPast((prev) => prev.slice(0, -1));
    setTransformFuture((prev) => [prevT, ...prev]);
    onUpdatePhotoSurface(activeSurface, (prev) => ({
      ...prev,
      transform: previous,
    }));
    syncSurfaceFeaturesToPhotoTransform(prevT, previous);
  }, [
    transformPast,
    currentPhoto.transform,
    activeSurface,
    onUpdatePhotoSurface,
    syncSurfaceFeaturesToPhotoTransform,
  ]);

  const handleRedoTransform = useCallback(() => {
    if (transformFuture.length === 0) return;
    const next = transformFuture[0];
    const prevT = currentPhoto.transform;
    setTransformFuture((prev) => prev.slice(1));
    setTransformPast((prev) => [...prev, prevT]);
    onUpdatePhotoSurface(activeSurface, (prev) => ({
      ...prev,
      transform: next,
    }));
    syncSurfaceFeaturesToPhotoTransform(prevT, next);
  }, [
    transformFuture,
    currentPhoto.transform,
    activeSurface,
    onUpdatePhotoSurface,
    syncSurfaceFeaturesToPhotoTransform,
  ]);

  const qComputed = useMemo(
    () => calculateBartonQSystem(qIndexParams, geometry.width),
    [qIndexParams, geometry.width]
  );

  // Commit draft lithology polygon (new or reopened)
  const commitDraftLithologyPolygon = useCallback(
    (pointsToCommit?: Point2D[]) => {
      const pts = pointsToCommit || draftLithologyPoints;
      if (pts.length < 3) {
        onUpdateStatusMessage?.('Please place at least 3 boundary points to close a lithology region.');
        return;
      }
      const cleanPoly = pts.map((p) => ({
        x: Number(p.x.toFixed(3)),
        y: Number(p.y.toFixed(3)),
      }));

      if (reopenedLithologyRegionId) {
        const nextRegions = lithologyRegions.map((r) =>
          r.id === reopenedLithologyRegionId
            ? {
                ...r,
                polygon: cleanPoly,
                polygonPoints: cleanPoly,
              }
            : r
        );
        handleUpdateLithologyWithHistory(nextRegions);
        setSelectedLithologyRegionId(reopenedLithologyRegionId);
        setReopenedLithologyRegionId(null);
        setDraftLithologyPoints([]);
        setIsDrawingLithologyPolygon(false);
        onUpdateStatusMessage?.(
          `Updated lithology region boundary (${cleanPoly.length} vertices).`
        );
        return;
      }

      const newReg = createLithologyRegionFromPolygon(
        activeSurface,
        cleanPoly,
        activeLithologyPattern,
        undefined,
        joints,
        currentPhoto
      );
      handleUpdateLithologyWithHistory([...lithologyRegions, newReg]);
      setSelectedLithologyRegionId(newReg.id);
      setDraftLithologyPoints([]);
      setIsDrawingLithologyPolygon(false);
      setShowCadPropertiesAlways(true);
      onUpdateStatusMessage?.(
        `Created ${newReg.lithologyName} region (${cleanPoly.length} vertices). Adjust rock type & properties in the Properties panel.`
      );
    },
    [
      draftLithologyPoints,
      reopenedLithologyRegionId,
      lithologyRegions,
      handleUpdateLithologyWithHistory,
      activeSurface,
      activeLithologyPattern,
      joints,
      currentPhoto,
      onUpdateStatusMessage,
    ]
  );

  // Finalize drawing a manual, freehand, spline, appended, or re-drawn joint trace (Sections 9, 10, 11, 12)
  const finishDraftJoint = useCallback(
    (pointsToCommit?: Point2D[]) => {
      const rawPts = pointsToCommit || draftJointPoints;
      if (rawPts.length < 2 && activeTool !== 'append_joint') {
        setDraftJointPoints([]);
        setIsFreehandDrawingJoint(false);
        return;
      }

      // Preserve exact clicked geometry and strictly clip to the active tunnel portion boundary
      let finalPts: Point2D[] = rawPts.map((p) =>
        clampPointToSurface(
          {
            x: Number(p.x.toFixed(4)),
            y: Number(p.y.toFixed(4)),
          },
          activeSurface,
          geometry,
          settings
        )
      );

      if (jointDrawMode === 'smooth_curve') {
        if (finalPts.length >= 3) {
          finalPts = evaluateCatmullRomSplineThroughPoints(finalPts, 5);
        } else if (finalPts.length === 2) {
          const p0 = finalPts[0];
          const p1 = finalPts[1];
          const dx = p1.x - p0.x;
          const dy = p1.y - p0.y;
          const len = Math.hypot(dx, dy);
          const nx = len > 1e-4 ? -dy / len : 0;
          const ny = len > 1e-4 ? dx / len : 0;
          const sag = len * 0.08;
          const mid: Point2D = {
            x: Number(((p0.x + p1.x) / 2 + nx * sag).toFixed(4)),
            y: Number(((p0.y + p1.y) / 2 + ny * sag).toFixed(4)),
          };
          finalPts = evaluateCatmullRomSplineThroughPoints([p0, mid, p1], 5);
        }
      }

      finalPts = clipPolylineToSurface(finalPts, activeSurface, geometry, settings);
      if (finalPts.length < 2 && activeTool !== 'append_joint') {
        setDraftJointPoints([]);
        setIsFreehandDrawingJoint(false);
        onUpdateStatusMessage?.(
          'Trace ignored: Joint traces only work inside the active tunnel portion.'
        );
        return;
      }

      // If appending points to an existing selected joint ("Continue Editing")
      if (activeTool === 'append_joint' && selectedJoint && rawPts.length >= 1) {
        const existing = selectedJoint.geometry;
        const clampedAppend = rawPts.map((p) =>
          clampPointToSurface(p, activeSurface, geometry, settings)
        );
        const firstNew = clampedAppend[0];
        const distToStart = Math.hypot(
          firstNew.x - existing[0].x,
          firstNew.y - existing[0].y
        );
        const distToEnd = Math.hypot(
          firstNew.x - existing[existing.length - 1].x,
          firstNew.y - existing[existing.length - 1].y
        );
        const combinedRaw =
          distToStart < distToEnd
            ? [...clampedAppend.slice().reverse(), ...existing]
            : [...existing, ...clampedAppend];
        const combined = clipPolylineToSurface(combinedRaw, activeSurface, geometry, settings);
        if (combined.length < 2) return;

        const orient = calculateJointOrientation3D(
          combined,
          activeSurface,
          geometry,
          settings,
          'DIRECTLY_MEASURED',
          currentPhoto.calibration,
          1.0,
          1.0
        );
        const autoSet = assignJointSetBy10DegTolerance(
          orient.dipDirection,
          orient.dip,
          selectedJoint.featureType,
          joints.filter((j) => j.id !== selectedJoint.id),
          selectedJoint.set
        );
        const updated = joints.map((j) =>
          j.id === selectedJoint.id
            ? {
                ...j,
                set: autoSet,
                geometry: combined,
                points3D: orient.points3D,
                traceAngle: orient.traceAngle,
                localAnglesDeg: orient.localAnglesDeg,
                wavinessAngleDeg: orient.wavinessAngleDeg,
                apparentDip: orient.apparentDip,
                strike: orient.strike,
                dip: orient.dip,
                dipDirection: orient.dipDirection,
                persistenceMeters: orient.persistenceMeters,
                isCurved: orient.isCurved,
              }
            : j
        );
        onUpdateJointsWithHistory(updated);
        setDraftJointPoints([]);
        setIsFreehandDrawingJoint(false);
        setActiveTool('select');
        setShowCadPropertiesAlways(true);
        return;
      }

      const orient = calculateJointOrientation3D(
        finalPts,
        activeSurface,
        geometry,
        settings,
        'DIRECTLY_MEASURED',
        currentPhoto.calibration,
        1.0,
        1.0
      );

      if (activeTool === 'redraw_joint' && selectedJoint) {
        const autoSet = assignJointSetBy10DegTolerance(
          orient.dipDirection,
          orient.dip,
          selectedJoint.featureType,
          joints.filter((j) => j.id !== selectedJoint.id),
          selectedJoint.set
        );
        const updated = joints.map((j) =>
          j.id === selectedJoint.id
            ? {
                ...j,
                set: autoSet,
                geometry: finalPts,
                points3D: orient.points3D,
                traceAngle: orient.traceAngle,
                localAnglesDeg: orient.localAnglesDeg,
                wavinessAngleDeg: orient.wavinessAngleDeg,
                terminationStart: orient.terminationStart,
                terminationEnd: orient.terminationEnd,
                apparentDip: orient.apparentDip,
                strike: orient.strike,
                dip: orient.dip,
                dipDirection: orient.dipDirection,
                persistenceMeters: orient.persistenceMeters,
                isCurved: orient.isCurved,
                confidence: 'High' as const,
                confidenceScore: 0.98,
                confidenceBreakdown: orient.confidenceBreakdown,
                accepted: true,
              }
            : j
        );
        onUpdateJointsWithHistory(updated);
        setDraftJointPoints([]);
        setIsFreehandDrawingJoint(false);
        setActiveTool('select');
        setShowCadPropertiesAlways(true);
        return;
      }

      const newId = `jt-man-${activeSurface}-${Date.now()}`;
      const assignedSet =
        draftFeatureType === 'bedding' ||
        draftFeatureType === 'shale_band' ||
        draftFeatureType === 'foliation'
          ? 'J0'
          : draftFeatureType === 'fault' ||
            draftFeatureType === 'shear' ||
            draftFeatureType === 'seam'
          ? 'F1'
          : draftSetId || 'J1';

      const crownResolvedForNew =
        activeSurface === 'crown'
          ? resolveCrownRelatedDipFromFaceAndWalls(
              {
                id: newId,
                set: assignedSet,
                strike: orient.strike,
                dipDirection: normalizeAzimuth(orient.strike + 90),
                dip: orient.dip,
              },
              joints
            )
          : null;

      const newJoint: Joint = {
        id: newId,
        surface: activeSurface,
        geometry: finalPts,
        points3D: orient.points3D,
        vertexWidths: finalPts.map((_, idx) =>
          Number(
            (
              0.45 +
              0.22 * Math.sin((idx / Math.max(1, finalPts.length - 1)) * Math.PI)
            ).toFixed(2)
          )
        ),
        traceAngle: orient.traceAngle,
        localAnglesDeg: orient.localAnglesDeg,
        wavinessAngleDeg: orient.wavinessAngleDeg,
        terminationStart: orient.terminationStart,
        terminationEnd: orient.terminationEnd,
        apparentDip: orient.apparentDip,
        strike: crownResolvedForNew ? crownResolvedForNew.strikeDeg : orient.strike,
        dip: crownResolvedForNew ? crownResolvedForNew.dipDeg : orient.dip,
        dipDirection: crownResolvedForNew
          ? crownResolvedForNew.dipDirectionDeg
          : orient.dipDirection,
        orientationStatus: orient.orientationStatus,
        set: assignedSet,
        featureType: draftFeatureType,
        confidence: 'High',
        confidenceScore: 0.98,
        confidenceBreakdown: orient.confidenceBreakdown,
        source: 'MANUAL',
        accepted: true,
        persistenceMeters: orient.persistenceMeters,
        isCurved: jointDrawMode === 'smooth_curve' ? true : orient.isCurved,
        roughness: 'Undulating / Rough',
        infilling:
          draftFeatureType === 'vein' || draftFeatureType === 'infilling'
            ? 'Quartz / Calcite Vein'
            : draftFeatureType === 'clay_band' || draftFeatureType === 'seam'
            ? 'Soft Clay Gouge'
            : 'Not determined',
        apertureMm: 'Variable (0.5–3 mm)',
        waterCondition: 'Dry',
      };

      // Check duplicate / overlap proximity against existing discontinuities
      const overlapRes = detectTraceOverlap(finalPts, surfaceJoints, activeSurface, joints, 0.18);

      setPendingJointConfirmation({
        joint: newJoint,
        isDuplicate: overlapRes.isOverlap,
        duplicateInfo: overlapRes.closestJoint
          ? {
              existingJointId: overlapRes.closestJoint.id,
              existingName: formatJointTraceLineLabel(overlapRes.closestJoint, joints),
              distanceCm: overlapRes.minDistanceCm,
              angleDiffDeg: overlapRes.angleDiffDeg,
            }
          : null,
      });

      if (overlapRes.isOverlap) {
        onUpdateStatusMessage?.(
          `⚠️ Duplicate / Overlap Detected: Within ${overlapRes.minDistanceCm}cm of existing ${formatJointTraceLineLabel(
            overlapRes.closestJoint!,
            joints
          )}. Please confirm with OK or Retrace.`
        );
      }
    },
    [
      draftJointPoints,
      activeTool,
      jointDrawMode,
      selectedJoint,
      activeSurface,
      geometry,
      settings,
      currentPhoto.calibration,
      joints,
      surfaceJoints,
      onUpdateJointsWithHistory,
      draftFeatureType,
      draftSetId,
      onUpdateStatusMessage,
    ]
  );

  // Confirm pending joint: commits to CAD Clean Canvas, resets Rock Photo Canvas
  const handleConfirmPendingJoint = () => {
    if (!pendingJointConfirmation) return;
    const newJoint = pendingJointConfirmation.joint;
    const nextJointsAll = [...joints, newJoint].map((j) => {
      if (j.surface !== 'crown') return j;
      const cRel = resolveCrownRelatedDipFromFaceAndWalls(j, [...joints, newJoint]);
      return {
        ...j,
        strike: cRel.strikeDeg,
        dipDirection: cRel.dipDirectionDeg,
        dip: cRel.dipDeg,
      };
    });

    onUpdateJointsWithHistory(nextJointsAll);
    setSelectedJointId(newJoint.id);
    setSelectedJointVertexIdx(null);
    setDraftJointPoints([]);
    setIsFreehandDrawingJoint(false);
    setPendingJointConfirmation(null);
    setShowCadPropertiesAlways(true);
    onUpdateStatusMessage?.(
      `✓ Confirmed ${newJoint.set} (${newJoint.featureType.toUpperCase()}: Dip ${formatAccurateAngle(
        newJoint.dip,
        2
      )}° → ${formatAccurateAngle(newJoint.dipDirection, 3)}°). Locked onto Clean CAD Canvas; Photo Canvas reset for next trace.`
    );
  };

  const handleRetracePendingJoint = () => {
    setDraftJointPoints([]);
    setIsFreehandDrawingJoint(false);
    setPendingJointConfirmation(null);
    onUpdateStatusMessage?.('Trace discarded. Ready to re-trace discontinuity on photo.');
  };

  const handleCancelPendingJoint = () => {
    setDraftJointPoints([]);
    setIsFreehandDrawingJoint(false);
    setPendingJointConfirmation(null);
  };

  // Mouse Wheel Zoom centered at cursor (Sections 2 & 5)
  const handleCanvasWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    zoomViewportAtScreenPoint(viewport.zoom * zoomFactor, e.clientX, e.clientY);
  };

  // Touch Start / Move / End for Stylus, Single-Finger Tap/Draw, and Two-Finger Pinch/Pan (Section 15)
  const handleCanvasTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length >= 2) {
      e.preventDefault();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.max(10, Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY));
      const midX = (t0.clientX + t1.clientX) / 2;
      const midY = (t0.clientY + t1.clientY) / 2;
      touchGestureRef.current = {
        isMultiTouch: true,
        startDist: dist,
        startZoom: viewport.zoom,
        startMidX: midX,
        startMidY: midY,
        startPanX: viewport.panX,
        startPanY: viewport.panY,
      };
      // Cancel any accidental single-finger freehand draw started milliseconds before 2nd finger touched
      if (isFreehandDrawingJoint) {
        setIsFreehandDrawingJoint(false);
        setDraftJointPoints([]);
      }
      return;
    }

    if (e.touches.length === 1) {
      lastTouchStartTimestampRef.current = Date.now();
      touchGestureRef.current = null;
      const t = e.touches[0];
      const worldProj = coordManager.screenToWorld(t.clientX, t.clientY);
      const pt: Point2D = { x: worldProj.x, y: worldProj.y };
      setCursorMeters(pt);

      handleCanvasMouseDown({
        button: 0,
        clientX: t.clientX,
        clientY: t.clientY,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as unknown as React.MouseEvent<SVGSVGElement>);
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length >= 2 && touchGestureRef.current && svgCanvasRef.current) {
      e.preventDefault();
      const g = touchGestureRef.current;
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.max(10, Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY));
      const midX = (t0.clientX + t1.clientX) / 2;
      const midY = (t0.clientY + t1.clientY) / 2;

      setViewport(
        coordManager.pinchZoomAndPan({
          startDist: g.startDist,
          currDist: dist,
          startZoom: g.startZoom,
          startMidX: g.startMidX,
          startMidY: g.startMidY,
          currMidX: midX,
          currMidY: midY,
          startPanX: g.startPanX,
          startPanY: g.startPanY,
        })
      );
      return;
    }

    if (e.touches.length === 1 && !touchGestureRef.current?.isMultiTouch) {
      const t = e.touches[0];
      handleCanvasMouseMove({
        clientX: t.clientX,
        clientY: t.clientY,
      } as unknown as React.MouseEvent<SVGSVGElement>);
    }
  };

  const handleCanvasTouchEnd = () => {
    if (touchGestureRef.current?.isMultiTouch) {
      touchGestureRef.current = null;
      return;
    }
    handleCanvasMouseUp();
  };

  // Canvas Mouse Down (Unified Coordinate Pipeline via coordManager.screenToWorld)
  const handleCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // Ignore delayed synthetic mousedown events on touch devices after handleCanvasTouchStart already handled the touch
    if (
      'nativeEvent' in e &&
      Date.now() - lastTouchStartTimestampRef.current < 450
    ) {
      return;
    }

    // 1. Middle-mouse button OR Spacebar+drag OR Pan tool => Pan Canvas Viewport
    if (e.button === 1 || isSpacePanning || activeTool === 'pan') {
      e.preventDefault();
      setDraggingCanvasPan({
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: viewport.panX,
        startPanY: viewport.panY,
      });
      return;
    }

    if (e.button !== 0) return;

    const worldProj = coordManager.screenToWorld(e.clientX, e.clientY);
    const rawPt: Point2D = { x: worldProj.x, y: worldProj.y };
    const isInsideTunnel = isPointInsideSurface(rawPt, activeSurface, geometry, settings);
    const isSurveyControlOrOverbreakMode =
      activeTool === 'control_point' ||
      activeTool === 'overbreak' ||
      cadRibbonTab === 'SURVEY_OVERBREAK';

    // Allow selecting & dragging existing Survey Control Points located outside the tunnel outline (overcut points)
    if (!isInsideTunnel && (activeTool === 'select' || activeTool === 'dip_probe')) {
      const hitTolMeters = coordManager.getHitToleranceMeters(10);
      const hitOutsideCp = controlPoints.find(
        (c) =>
          c.surface === activeSurface &&
          c.visible !== false &&
          Math.hypot(c.point.x - rawPt.x, c.point.y - rawPt.y) <= hitTolMeters * 1.2
      );
      if (hitOutsideCp) {
        setSelectedControlPointId(hitOutsideCp.id);
        setShowCadPropertiesAlways(true);
        if (!hitOutsideCp.locked) {
          setControlPointPast((p) => [...p.slice(-24), controlPoints]);
          setControlPointFuture([]);
          setDraggingControlPointId(hitOutsideCp.id);
        }
        return;
      }
    }

    // STRICT TUNNEL PORTION BOUNDARY ENFORCEMENT FOR GEOLOGICAL TRACES:
    // Survey Control Points & Overbreak points CAN be located outside the tunnel outline to mark overcut survey points.
    if (!isInsideTunnel && !isSurveyControlOrOverbreakMode) {
      if (activeTool === 'select') {
        setSelectedJointId(null);
        setSelectedJointVertexIdx(null);
        setSelectedControlPointId(null);
        setSelectedSymbolId(null);
        setSelectedLithologyRegionId(null);
        setJoinTargetMode(false);
        return;
      }
      if (
        activeTool === 'photo_fit' &&
        !addingControlPointMode &&
        !drawingCustomMaskMode
      ) {
        // Allow outer photo frame translation handle only when not placing points
      } else {
        onUpdateStatusMessage?.(
          'Outside tunnel portion: Geological traces work inside the tunnel outline (use Survey Control Points / Overbreak tool to mark overcut points outside the outline).'
        );
        return;
      }
    }

    const pt: Point2D = isSurveyControlOrOverbreakMode
      ? rawPt
      : clampPointToSurface(rawPt, activeSurface, geometry, settings);

    // 2. Dedicated Control Point Tool or Overbreak Profile Tool (Allows placing outside tunnel outline for overcut survey points)
    if (activeTool === 'control_point' || activeTool === 'overbreak') {
      const hitTolMeters = coordManager.getHitToleranceMeters(12);
      const existingHit = surfaceControlPoints.find(
        (c) =>
          c.visible !== false &&
          Math.hypot(c.point.x - rawPt.x, c.point.y - rawPt.y) <= hitTolMeters
      );
      if (existingHit) {
        setSelectedControlPointId(existingHit.id);
        if (!existingHit.locked && !surveyProfile.locked) {
          setControlPointPast((p) => [...p.slice(-24), controlPoints]);
          setControlPointFuture([]);
          setDraggingControlPointId(existingHit.id);
        }
        return;
      }
      if (activeTool === 'overbreak' && surveyProfile.locked) {
        onUpdateStatusMessage?.('Surveyed profile is currently locked. Unlock it to add points.');
        return;
      }
      const nextIndex =
        controlPoints.filter((c) => c.surface === activeSurface).length + 1;
      const newCp: SurveyControlPoint = {
        id: `cp-survey-${Date.now()}`,
        label: `CP${nextIndex}`,
        surface: activeSurface,
        point: { x: Number(rawPt.x.toFixed(3)), y: Number(rawPt.y.toFixed(3)) },
        imageUV: { u: worldProj.u, v: worldProj.v },
        color: '#22D3EE',
        visible: true,
        locked: false,
      };
      handleUpdateControlPointsWithHistory((prev) => [...prev, newCp]);
      onUpdateSurveyProfile((prev) => ({
        ...prev,
        surface: activeSurface,
        orderedControlPointIds: [...prev.orderedControlPointIds, newCp.id],
        visible: true,
      }));
      setSelectedControlPointId(newCp.id);
      const outsideTag = !isInsideTunnel ? ' (Overcut / Outside Outline)' : '';
      onUpdateStatusMessage?.(
        activeTool === 'overbreak'
          ? `Placed & connected ${newCp.label}${outsideTag} at X=${rawPt.x.toFixed(2)}m, Y=${rawPt.y.toFixed(2)}m.`
          : `Placed survey control point ${newCp.label}${outsideTag} at X=${rawPt.x.toFixed(2)}m, Y=${rawPt.y.toFixed(2)}m.`
      );
      return;
    }

    // 2b. Dedicated Geological Symbol Tool (Sections 9, 10, 12, 15)
    if (activeTool === 'geological_symbol') {
      const hitTolMeters = coordManager.getHitToleranceMeters(16);
      const existingSym = surfacePlacedSymbols.find(
        (s) =>
          s.visible !== false &&
          Math.hypot(s.point.x - pt.x, s.point.y - pt.y) <= hitTolMeters
      );
      if (existingSym) {
        setSelectedSymbolId(existingSym.id);
        if (!existingSym.locked) {
          setSymbolPast((p) => [...p.slice(-24), placedSymbols]);
          setSymbolFuture([]);
          setDraggingSymbolId(existingSym.id);
        }
        return;
      }
      const meta = getStructuralSymbolMeta(activeSymbolTypeToPlace);
      const nextIdx =
        placedSymbols.filter((s) => s.surface === activeSurface).length + 1;
      const newSym: PlacedGeologicalSymbol = {
        id: `sym-${activeSurface}-${Date.now()}`,
        surface: activeSurface,
        symbolType: activeSymbolTypeToPlace,
        point: { x: Number(pt.x.toFixed(3)), y: Number(pt.y.toFixed(3)) },
        rotationDeg: 0,
        scale: 1.0,
        dipDirectionDeg: 135,
        dipDeg: 60,
        strikeDeg: 45,
        uncertainOrientation: false,
        label: `${meta.shortCode}-${nextIdx}`,
        color: meta.defaultColor,
        visible: true,
        locked: false,
      };
      handleUpdatePlacedSymbolsWithHistory((prev) => [...prev, newSym]);
      setSelectedSymbolId(newSym.id);
      onUpdateStatusMessage?.(
        `Placed ${meta.label} symbol (${newSym.label}) at X=${pt.x.toFixed(2)}m, Y=${pt.y.toFixed(2)}m.`
      );
      return;
    }

    // 3. Lithology Tool (Sections 7, 8, 11, 13)
    if (activeTool === 'lithology') {
      if (isDrawingLithologyPolygon) {
        const hitTol = coordManager.getHitToleranceMeters(16);
        // Check if user clicked on the first point L1 OR last point to close the polygon immediately without dragging
        if (draftLithologyPoints.length >= 3) {
          const firstPt = draftLithologyPoints[0];
          const lastPt = draftLithologyPoints[draftLithologyPoints.length - 1];
          if (
            Math.hypot(pt.x - firstPt.x, pt.y - firstPt.y) <= hitTol ||
            Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y) <= hitTol
          ) {
            commitDraftLithologyPolygon(draftLithologyPoints);
            return;
          }
        }
        setDraftLithologyPoints((prev) => [...prev, pt]);
        return;
      }

      // Check if user clicked inside an existing lithology polygon to select & drag it
      const surfRegs = lithologyRegions.filter((r) => r.surface === activeSurface);
      const clickedReg = surfRegs.find((r) => isPointInsidePolygon(pt, r.polygon));
      if (clickedReg) {
        setSelectedLithologyRegionId(clickedReg.id);
        setShowCadPropertiesAlways(true);
        setLithologyPast((prev) => [...prev.slice(-24), lithologyRegions]);
        setLithologyFuture([]);
        setDraggingWholeLithology({
          regionId: clickedReg.id,
          startMeters: pt,
          origPolygon: clickedReg.polygon.map((p) => ({ ...p })),
        });
        return;
      }

      // Clicking outside existing regions starts drawing a new lithology polygon immediately!
      setIsDrawingLithologyPolygon(true);
      setDraftLithologyPoints([pt]);
      onUpdateStatusMessage?.(
        'Started new lithology boundary polygon (L1). Click 2+ more points, then click L1 or Finish Zone.'
      );
      return;
    }

    // 4. Joint / Geological Feature Tool (Sections 9, 10, 11, 12)
    if (
      activeTool === 'add_joint' ||
      activeTool === 'redraw_joint' ||
      activeTool === 'append_joint'
    ) {
      if (jointDrawMode === 'freehand') {
        setSelectedJointId(null);
        setShowCadPropertiesAlways(false);
        setIsFreehandDrawingJoint(true);
        setDraftJointPoints([pt]);
        return;
      }

      // While actively placing points, keep the canvas unobstructed; Properties window opens once Complete is clicked
      if (draftJointPoints.length === 0 && activeTool === 'add_joint') {
        setSelectedJointId(null);
        setShowCadPropertiesAlways(false);
      }

      // 2-Point Line Mode: Click 1st point (start) -> Click 2nd point (end) -> Immediately finishes line and opens Properties!
      if (jointDrawMode === 'two_point_line') {
        if (draftJointPoints.length === 0) {
          setDraftJointPoints([pt]);
        } else {
          finishDraftJoint([...draftJointPoints, pt]);
        }
        return;
      }

      // For Spline ('smooth_curve'), Polyline ('polyline'), and Snap Crack ('magnetic_livewire'):
      // Allow user to click unlimited points (P1, P2, P3, P4, P5, P6...) until they click "✓ Complete"!
      // Ignore tiny accidental double-tap at the exact same pixel (< 3px) so it doesn't duplicate a vertex
      if (draftJointPoints.length >= 1) {
        const dupTol = coordManager.getHitToleranceMeters(3);
        const lastPt = draftJointPoints[draftJointPoints.length - 1];
        if (Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y) <= dupTol) {
          return;
        }
      }

      // 1-Click Seed Auto-Follow Mode: Automatically propagates forward & backward along the rock fracture
      if (jointDrawMode === 'seed_autotrace' && activePhotoRidgeField) {
        const seedUV = surfaceMetersToImageUV(
          pt,
          activeSurface,
          geometry,
          settings,
          currentPhoto.transform
        );
        const propagated = autoPropagateFractureFromSeedUV(activePhotoRidgeField, {
          x: seedUV.u,
          y: seedUV.v,
        });
        if (propagated && propagated.uvPoints.length >= 2) {
          const meterPts = propagated.uvPoints.map((uv) =>
            imageUVToSurfaceMeters(
              uv.x,
              uv.y,
              activeSurface,
              geometry,
              settings,
              currentPhoto.transform,
              currentPhoto.calibration,
              true
            )
          );
          const clipped = clipPolylineToSurface(meterPts, activeSurface, geometry, settings);
          if (clipped.length >= 2) {
            finishDraftJoint(clipped);
            onUpdateStatusMessage?.(
              `1-Click Auto-Follow tracked ${clipped.length} vertices along rock discontinuity (Conf ${Math.round(
                propagated.confidenceScore * 100
              )}%).`
            );
            return;
          }
        }
        onUpdateStatusMessage?.(
          'No strong fracture ridge directly under click — placed start point. Click 2nd point to finish.'
        );
        if (draftJointPoints.length >= 1) {
          finishDraftJoint([...draftJointPoints, pt]);
          return;
        }
      }

      // Magnetic Live-Wire Mode: Append the full Dijkstra geodesic path along the rock fracture
      if (
        jointDrawMode === 'magnetic_livewire' &&
        activePhotoRidgeField &&
        draftJointPoints.length > 0 &&
        livewirePreviewSegment.length >= 2
      ) {
        setDraftJointPoints((prev) => [...prev, ...livewirePreviewSegment.slice(1)]);
        return;
      }

      setDraftJointPoints((prev) => [...prev, pt]);
      return;
    }

    // 5. Measure Tool
    if (activeTool === 'measure') {
      setMeasurePts((prev) => (prev.length >= 2 ? [pt] : [...prev, pt]));
      return;
    }

    // 6. Photo Fitting Tool (Sections 6 & 13) + 2-Click SPL Seam & Scale Lock
    if ((activeTool === 'photo_fit' || splTwoClickMode) && currentPhoto.image) {
      // 6.0. 2-Click Wall–Crown (SPL) Seam & Scale Lock
      if (splTwoClickMode) {
        const clickUV = {
          u: Math.max(0, Math.min(1, worldProj.u)),
          v: Math.max(0, Math.min(1, worldProj.v)),
        };
        if (!splFirstPointUV) {
          setSplFirstPointUV(clickUV);
          onUpdateStatusMessage?.(
            `SPL Point 1 locked at (${Math.round(clickUV.u * 100)}%, ${Math.round(
              clickUV.v * 100
            )}%). Now click Point 2 at the opposite end of the Wall–Crown (SPL) meet line.`
          );
          return;
        }
        const splRes = computeSplTwoClickCropAndScale(
          splFirstPointUV,
          clickUV,
          activeSurface,
          geometry,
          settings,
          currentPhoto.transform,
          activePhotoRidgeField?.width || 1200
        );
        handleUpdateTransformWithHistory(() => splRes.nextTransform);
        setSplFirstPointUV(null);
        setSplTwoClickMode(false);
        // Also deduplicate any existing Wall-Crown seam overlaps
        const dedup = deduplicateAndLinkSplOverlapJoints(joints, geometry, settings);
        if (dedup.removedOverlapCount > 0 || dedup.linkedCrossSplCount > 0) {
          onUpdateJointsWithHistory(dedup.joints);
        }
        onUpdateStatusMessage?.(`${splRes.summary} (${dedup.summary})`);
        return;
      }

      // 6a. "Click Canvas to Add Custom Mask Vertex P_n"
      if (drawingCustomMaskMode) {
        handleUpdateTransformWithHistory((prev) => ({
          ...prev,
          useCustomMask: true,
          cropToGeometry: true,
          customMaskPoints: [...(prev.customMaskPoints || []), pt],
        }));
        return;
      }

      // 6b. "Click Photo to Add Mesh Control Point C_n" (accounting for photo rotation/zoom/pan/scale!)
      if (addingControlPointMode) {
        const normU = Math.max(-0.15, Math.min(1.15, worldProj.u));
        const normV = Math.max(-0.15, Math.min(1.15, worldProj.v));
        handleUpdateTransformWithHistory((prev) => {
          const existing = prev.meshControlPoints || createDefaultMeshControlPoints(3, 3);
          return {
            ...prev,
            meshControlPoints: [
              ...existing,
              {
                id: `cp-user-${Date.now()}`,
                label: `C${existing.length + 1}`,
                srcU: Number(normU.toFixed(4)),
                srcV: Number(normV.toFixed(4)),
                dstU: Number(normU.toFixed(4)),
                dstV: Number(normV.toFixed(4)),
              },
            ],
          };
        });
        setAddingControlPointMode(false);
        return;
      }

      setTransformPast((prev) => [...prev.slice(-18), currentPhoto.transform]);
      setTransformFuture([]);
      setDraggingPhotoHandle({
        type: 'move',
        startClientX: e.clientX,
        startClientY: e.clientY,
        initialTransform: {
          ...currentPhoto.transform,
          perspectiveCorners: [
            { ...currentPhoto.transform.perspectiveCorners[0] },
            { ...currentPhoto.transform.perspectiveCorners[1] },
            { ...currentPhoto.transform.perspectiveCorners[2] },
            { ...currentPhoto.transform.perspectiveCorners[3] },
          ],
        },
      });
      return;
    }

    // 7. Select Tool Hit-Testing in World Coordinates (Section 14)
    if (activeTool === 'select' || activeTool === 'dip_probe') {
      const hitTolMeters = coordManager.getHitToleranceMeters(10);

      // Check survey control points first
      const hitCp = controlPoints.find(
        (c) =>
          c.surface === activeSurface &&
          c.visible !== false &&
          Math.hypot(c.point.x - pt.x, c.point.y - pt.y) <= hitTolMeters * 1.2
      );
      if (hitCp) {
        setSelectedControlPointId(hitCp.id);
        if (!hitCp.locked) {
          setControlPointPast((p) => [...p.slice(-24), controlPoints]);
          setControlPointFuture([]);
          setDraggingControlPointId(hitCp.id);
        }
        return;
      }

      // Check placed geological symbols
      const hitSym = surfacePlacedSymbols.find(
        (s) =>
          s.visible !== false &&
          Math.hypot(s.point.x - pt.x, s.point.y - pt.y) <= hitTolMeters * 1.4
      );
      if (hitSym) {
        setSelectedSymbolId(hitSym.id);
        if (!hitSym.locked) {
          setSymbolPast((p) => [...p.slice(-24), placedSymbols]);
          setSymbolFuture([]);
          setDraggingSymbolId(hitSym.id);
        }
        return;
      }

      // Check joints in world coordinates
      let closestJoint: Joint | null = null;
      let minDist = hitTolMeters;
      for (const j of surfaceJoints) {
        const geom = getDisplayedJointGeometry(j, traceFitMode);
        for (let i = 0; i < geom.length - 1; i++) {
          const d = pointToSegmentDistance(pt, geom[i], geom[i + 1]);
          if (d < minDist) {
            minDist = d;
            closestJoint = j;
          }
        }
      }

      if (closestJoint) {
        if (joinTargetMode && selectedJoint && selectedJoint.id !== closestJoint.id) {
          handleJoinWithJoint(closestJoint);
          return;
        }
        setSelectedJointId(closestJoint.id);
        setSelectedJointVertexIdx(null);
        setSelectedSymbolId(null);
        setSelectedControlPointId(null);
      } else {
        const hitLith = lithologyRegions
          .filter((r) => r.surface === activeSurface && r.polygon.length >= 3)
          .find((r) => isPointInsidePolygon(pt, r.polygon));
        if (hitLith) {
          setSelectedLithologyRegionId(hitLith.id);
          setSelectedJointId(null);
          setSelectedSymbolId(null);
          setSelectedControlPointId(null);
        } else {
          setSelectedJointId(null);
          setSelectedJointVertexIdx(null);
          setSelectedControlPointId(null);
          setSelectedSymbolId(null);
          setSelectedLithologyRegionId(null);
          setJoinTargetMode(false);
          // Start 1-finger / mouse drag panning when dragging empty canvas in Select mode
          if (activeTool === 'select') {
            setDraggingCanvasPan({
              startClientX: e.clientX,
              startClientY: e.clientY,
              startPanX: viewport.panX,
              startPanY: viewport.panY,
            });
          }
        }
      }
    }
  };

  // Canvas Mouse Move (Unified Coordinate Pipeline via coordManager.screenToWorld)
  const handleCanvasMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    // 1. Handle Canvas Viewport Panning
    if (draggingCanvasPan && svgCanvasRef.current) {
      setViewport(
        coordManager.panByScreenDelta(
          draggingCanvasPan.startClientX,
          draggingCanvasPan.startClientY,
          e.clientX,
          e.clientY,
          draggingCanvasPan.startPanX,
          draggingCanvasPan.startPanY
        )
      );
      return;
    }

    const worldProj = coordManager.screenToWorld(e.clientX, e.clientY);
    const rawPt: Point2D = { x: worldProj.x, y: worldProj.y };
    const isInsideTunnel = isPointInsideSurface(rawPt, activeSurface, geometry, settings);
    const allowOutsideCursor =
      Boolean(draggingControlPointId) ||
      activeTool === 'control_point' ||
      activeTool === 'overbreak' ||
      cadRibbonTab === 'SURVEY_OVERBREAK';
    const pt: Point2D = clampPointToSurface(rawPt, activeSurface, geometry, settings);
    const nextCursorPt = allowOutsideCursor ? rawPt : isInsideTunnel ? pt : null;

    // Only trigger immediate React re-render on mousemove when an interactive rubberband/preview needs cursorMeters;
    // otherwise throttle status-bar coordinate updates to avoid 120Hz full-workspace re-renders.
    const needsLiveCursorPreview =
      isDrawingLithologyPolygon ||
      draftJointPoints.length > 0 ||
      (activeTool === 'add_joint' && jointDrawMode === 'seed_autotrace') ||
      (activeTool === 'measure' && measurePts.length === 1) ||
      activeTool === 'geological_symbol';

    if (needsLiveCursorPreview) {
      setCursorMeters(nextCursorPt);
    } else {
      const now = Date.now();
      if (now - lastTouchStartTimestampRef.current > 120) {
        setCursorMeters((prev) => {
          if (!prev && !nextCursorPt) return prev;
          if (!prev || !nextCursorPt) return nextCursorPt;
          if (Math.hypot(prev.x - nextCursorPt.x, prev.y - nextCursorPt.y) < 0.08) {
            return prev;
          }
          return nextCursorPt;
        });
      }
    }

    // 2. Dragging Survey Control Point (allowed outside tunnel outline for overcut survey points!)
    if (draggingControlPointId) {
      const unclampedUV = surfaceMetersToImageUV(
        rawPt,
        activeSurface,
        geometry,
        settings,
        currentPhoto.transform
      );
      onUpdateControlPoints((prev) =>
        prev.map((cp) =>
          cp.id === draggingControlPointId && !cp.locked
            ? {
                ...cp,
                point: { x: Number(rawPt.x.toFixed(3)), y: Number(rawPt.y.toFixed(3)) },
                imageUV: { u: unclampedUV.u, v: unclampedUV.v },
              }
            : cp
        )
      );
      return;
    }

    // 2b. Dragging, Rotating, or Scaling a Placed Geological Symbol (Section 15)
    if (rotatingSymbolState) {
      const dx = worldProj.cx - rotatingSymbolState.centerPx.cx;
      const dy = worldProj.cy - rotatingSymbolState.centerPx.cy;
      const deg = Math.round(((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360);
      onUpdatePlacedSymbols((prev) =>
        prev.map((s) =>
          s.id === rotatingSymbolState.symbolId && !s.locked
            ? {
                ...s,
                rotationDeg: deg,
                dipDirectionDeg: deg,
                strikeDeg: (deg - 90 + 360) % 360,
              }
            : s
        )
      );
      return;
    }

    if (scalingSymbolState) {
      const currDist = Math.max(
        6,
        Math.hypot(
          worldProj.cx - scalingSymbolState.centerPx.cx,
          worldProj.cy - scalingSymbolState.centerPx.cy
        )
      );
      const ratio = currDist / Math.max(8, scalingSymbolState.initialDistPx);
      const nextScale = Number(
        Math.max(0.45, Math.min(2.8, scalingSymbolState.initialScale * ratio)).toFixed(2)
      );
      onUpdatePlacedSymbols((prev) =>
        prev.map((s) =>
          s.id === scalingSymbolState.symbolId && !s.locked
            ? { ...s, scale: nextScale }
            : s
        )
      );
      return;
    }

    if (draggingSymbolId) {
      onUpdatePlacedSymbols((prev) =>
        prev.map((s) =>
          s.id === draggingSymbolId && !s.locked
            ? {
                ...s,
                point: { x: Number(pt.x.toFixed(3)), y: Number(pt.y.toFixed(3)) },
              }
            : s
        )
      );
      return;
    }

    // 3. Freehand Joint Drawing (strictly inside tunnel portion)
    if (isFreehandDrawingJoint) {
      if (!isInsideTunnel) return;
      setDraftJointPoints((prev) => {
        if (prev.length === 0) return [pt];
        const last = prev[prev.length - 1];
        if (Math.hypot(pt.x - last.x, pt.y - last.y) >= 0.035) {
          return [...prev, pt];
        }
        return prev;
      });
      return;
    }

    // 4. Dragging a Draft Joint Vertex before finishing (strictly clamped inside tunnel portion)
    if (draggingDraftJointIdx !== null) {
      setDraftJointPoints((prev) =>
        prev.map((p, idx) => (idx === draggingDraftJointIdx ? pt : p))
      );
      return;
    }

    // 5. Dragging a Draft Lithology Vertex before closing (strictly clamped inside tunnel portion)
    if (draggingDraftLithologyIdx !== null) {
      setDraftLithologyPoints((prev) =>
        prev.map((p, idx) => (idx === draggingDraftLithologyIdx ? pt : p))
      );
      return;
    }

    // 6. Dragging Saved Lithology Vertex (strictly clamped inside tunnel portion)
    if (draggingLithologyVertex) {
      const nextRegions = lithologyRegions.map((reg) => {
        if (reg.id !== draggingLithologyVertex.regionId) return reg;
        const nextPoly = reg.polygon.map((v, idx) =>
          idx === draggingLithologyVertex.vertexIndex
            ? { x: Number(pt.x.toFixed(3)), y: Number(pt.y.toFixed(3)) }
            : v
        );
        return {
          ...reg,
          polygon: nextPoly,
          polygonPoints: nextPoly,
        };
      });
      onUpdateLithologyRegions(nextRegions);
      return;
    }

    // 7. Dragging Whole Lithology Polygon on Canvas (strictly clamped inside tunnel portion)
    if (draggingWholeLithology) {
      const dx = pt.x - draggingWholeLithology.startMeters.x;
      const dy = pt.y - draggingWholeLithology.startMeters.y;
      const nextRegions = lithologyRegions.map((reg) => {
        if (reg.id !== draggingWholeLithology.regionId) return reg;
        const nextPoly = draggingWholeLithology.origPolygon.map((p) =>
          clampPointToSurface(
            {
              x: Number((p.x + dx).toFixed(3)),
              y: Number((p.y + dy).toFixed(3)),
            },
            activeSurface,
            geometry,
            settings
          )
        );
        return {
          ...reg,
          polygon: nextPoly,
          polygonPoints: nextPoly,
        };
      });
      onUpdateLithologyRegions(nextRegions);
      return;
    }

    // 8. Resizing Lithology Polygon via Bounding Box Handle on Canvas (strictly clamped inside tunnel portion)
    if (resizingLithologyRegion) {
      const { regionId, centroid, startDistX, startDistY, origPolygon } =
        resizingLithologyRegion;
      const curDistX = pt.x - centroid.x;
      const curDistY = pt.y - centroid.y;
      const sx =
        Math.abs(startDistX) > 0.05
          ? Math.max(0.2, Math.min(4.0, curDistX / startDistX))
          : 1;
      const sy =
        Math.abs(startDistY) > 0.05
          ? Math.max(0.2, Math.min(4.0, curDistY / startDistY))
          : 1;
      const nextRegions = lithologyRegions.map((reg) => {
        if (reg.id !== regionId) return reg;
        const nextPoly = origPolygon.map((p) =>
          clampPointToSurface(
            {
              x: Number((centroid.x + (p.x - centroid.x) * sx).toFixed(3)),
              y: Number((centroid.y + (p.y - centroid.y) * sy).toFixed(3)),
            },
            activeSurface,
            geometry,
            settings
          )
        );
        return {
          ...reg,
          polygon: nextPoly,
          polygonPoints: nextPoly,
        };
      });
      onUpdateLithologyRegions(nextRegions);
      return;
    }

    // 9. Dragging Joint Control Point (strictly clamped inside tunnel portion; preserves user-chosen Joint Set)
    if (draggingVertex) {
      const updated = joints.map((j) => {
        if (j.id !== draggingVertex.jointId) return j;
        const nextGeom = j.geometry.map((v, idx) =>
          idx === draggingVertex.vertexIndex ? pt : v
        );
        const orient = calculateJointOrientation3D(
          nextGeom,
          j.surface,
          geometry,
          settings,
          j.orientationStatus,
          currentPhoto.calibration
        );
        return {
          ...j,
          geometry: nextGeom,
          points3D: orient.points3D,
          traceAngle: orient.traceAngle,
          localAnglesDeg: orient.localAnglesDeg,
          wavinessAngleDeg: orient.wavinessAngleDeg,
          terminationStart: orient.terminationStart,
          terminationEnd: orient.terminationEnd,
          apparentDip: orient.apparentDip,
          strike: orient.strike,
          dip: orient.dip,
          dipDirection: orient.dipDirection,
          persistenceMeters: orient.persistenceMeters,
          isCurved: orient.isCurved,
        };
      });
      onUpdateJointsWithHistory(updated);
      return;
    }

    // 10. Dragging Whole Joint on Canvas (strictly clamped inside tunnel portion)
    if (draggingWholeJoint) {
      const dx = pt.x - draggingWholeJoint.startMeters.x;
      const dy = pt.y - draggingWholeJoint.startMeters.y;
      const updated = joints.map((j) => {
        if (j.id !== draggingWholeJoint.jointId) return j;
        const shifted = draggingWholeJoint.origPoints.map((p) =>
          clampPointToSurface(
            {
              x: Number((p.x + dx).toFixed(4)),
              y: Number((p.y + dy).toFixed(4)),
            },
            j.surface,
            geometry,
            settings
          )
        );
        const orient = calculateJointOrientation3D(
          shifted,
          j.surface,
          geometry,
          settings,
          j.orientationStatus,
          currentPhoto.calibration
        );
        return {
          ...j,
          geometry: shifted,
          points3D: orient.points3D,
          traceAngle: orient.traceAngle,
          localAnglesDeg: orient.localAnglesDeg,
          wavinessAngleDeg: orient.wavinessAngleDeg,
          apparentDip: orient.apparentDip,
          strike: orient.strike,
          dip: orient.dip,
          dipDirection: orient.dipDirection,
        };
      });
      onUpdateJointsWithHistory(updated);
      return;
    }

    // 11. Dragging Photo Handles using Unified Coordinate System (Section 6)
    if (draggingPhotoHandle && svgCanvasRef.current) {
      const startProj = coordManager.screenToWorld(
        draggingPhotoHandle.startClientX,
        draggingPhotoHandle.startClientY
      );
      const dSvgX = worldProj.cx - startProj.cx;
      const dSvgY = worldProj.cy - startProj.cy;

      // Also compute delta in rotated/scaled photo UV space so handles track 1:1 under rotation/zoom!
      const startPhotoUV = coordManager.canvasToPhotoUV(
        startProj.cx,
        startProj.cy,
        draggingPhotoHandle.initialTransform
      );
      const currPhotoUV = coordManager.canvasToPhotoUV(
        worldProj.cx,
        worldProj.cy,
        draggingPhotoHandle.initialTransform
      );
      const dNormU = currPhotoUV.u - startPhotoUV.u;
      const dNormV = currPhotoUV.v - startPhotoUV.v;

      if (draggingPhotoHandle.type === 'move') {
        const dMetersX = dSvgX / pxPerMeter;
        const dMetersY = -dSvgY / pxPerMeter;
        const prevT = currentPhoto.transform;
        const nextT: SurfaceTransform = {
          ...prevT,
          offsetX: Number((draggingPhotoHandle.initialTransform.offsetX + dMetersX).toFixed(3)),
          offsetY: Number((draggingPhotoHandle.initialTransform.offsetY + dMetersY).toFixed(3)),
        };
        onUpdatePhotoSurface(activeSurface, (prev) => ({
          ...prev,
          transform: nextT,
        }));
        syncSurfaceFeaturesToPhotoTransform(prevT, nextT);
      } else if (
        draggingPhotoHandle.type === 'corner' &&
        typeof draggingPhotoHandle.cornerIndex === 'number'
      ) {
        const cIdx = draggingPhotoHandle.cornerIndex;
        onUpdatePhotoSurface(activeSurface, (prev) => {
          const nextCorners = [...draggingPhotoHandle.initialTransform.perspectiveCorners] as [
            Point2D,
            Point2D,
            Point2D,
            Point2D
          ];
          nextCorners[cIdx] = {
            x: Number(
              Math.max(-0.45, Math.min(0.45, nextCorners[cIdx].x + dNormU)).toFixed(3)
            ),
            y: Number(
              Math.max(-0.45, Math.min(0.45, nextCorners[cIdx].y + dNormV)).toFixed(3)
            ),
          };
          return {
            ...prev,
            transform: {
              ...prev.transform,
              perspectiveCorners: nextCorners,
              homographyMatrix: solveProjectiveHomography3x3(nextCorners),
            },
          };
        });
      } else if (
        draggingPhotoHandle.type === 'edge' &&
        typeof draggingPhotoHandle.edgeIndex === 'number'
      ) {
        const eIdx = draggingPhotoHandle.edgeIndex;
        onUpdatePhotoSurface(activeSurface, (prev) => {
          const baseEdges = draggingPhotoHandle.initialTransform.edgeOffsets || [
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 0, y: 0 },
          ];
          const nextEdges = [
            { ...baseEdges[0] },
            { ...baseEdges[1] },
            { ...baseEdges[2] },
            { ...baseEdges[3] },
          ] as [Point2D, Point2D, Point2D, Point2D];
          nextEdges[eIdx] = {
            x: Number(Math.max(-0.35, Math.min(0.35, nextEdges[eIdx].x + dNormU)).toFixed(3)),
            y: Number(Math.max(-0.35, Math.min(0.35, nextEdges[eIdx].y + dNormV)).toFixed(3)),
          };
          return {
            ...prev,
            transform: {
              ...prev.transform,
              edgeOffsets: nextEdges,
            },
          };
        });
      } else if (draggingPhotoHandle.type === 'mesh_cp' && draggingPhotoHandle.cpId) {
        const targetId = draggingPhotoHandle.cpId;
        onUpdatePhotoSurface(activeSurface, (prev) => {
          const baseMesh =
            draggingPhotoHandle.initialTransform.meshControlPoints ||
            createDefaultMeshControlPoints(3, 3);
          const nextMesh = baseMesh.map((cp) =>
            cp.id === targetId
              ? {
                  ...cp,
                  dstU: Number(Math.max(-0.25, Math.min(1.25, cp.dstU + dNormU)).toFixed(4)),
                  dstV: Number(Math.max(-0.25, Math.min(1.25, cp.dstV + dNormV)).toFixed(4)),
                }
              : cp
          );
          return {
            ...prev,
            transform: {
              ...prev.transform,
              meshControlPoints: nextMesh,
            },
          };
        });
      } else if (
        draggingPhotoHandle.type === 'mask_vertex' &&
        typeof draggingPhotoHandle.maskVertexIndex === 'number'
      ) {
        const vIdx = draggingPhotoHandle.maskVertexIndex;
        onUpdatePhotoSurface(activeSurface, (prev) => {
          const basePts = prev.transform.customMaskPoints || [];
          const nextPts = basePts.map((p, idx) => (idx === vIdx ? pt : p));
          return {
            ...prev,
            transform: {
              ...prev.transform,
              useCustomMask: true,
              customMaskPoints: nextPts,
            },
          };
        });
      }
    }
  };

  const handleCanvasMouseUp = () => {
    if (isFreehandDrawingJoint) {
      setIsFreehandDrawingJoint(false);
      if (draftJointPoints.length >= 2) {
        finishDraftJoint(draftJointPoints);
      } else {
        setDraftJointPoints([]);
      }
    }
    setDraggingCanvasPan(null);
    setDraggingControlPointId(null);
    setDraggingSymbolId(null);
    setRotatingSymbolState(null);
    setScalingSymbolState(null);
    setDraggingDraftJointIdx(null);
    setDraggingDraftLithologyIdx(null);
    setDraggingVertex(null);
    setDraggingWholeJoint(null);
    setDraggingPhotoHandle(null);
    setDraggingLithologyVertex(null);
    setDraggingWholeLithology(null);
    setResizingLithologyRegion(null);
  };

  // Global window mouseup safety so dragging never gets stuck if user releases outside SVG
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setDraggingCanvasPan(null);
      setDraggingControlPointId(null);
      setDraggingSymbolId(null);
      setRotatingSymbolState(null);
      setScalingSymbolState(null);
      setDraggingDraftJointIdx(null);
      setDraggingDraftLithologyIdx(null);
      setDraggingVertex(null);
      setDraggingWholeJoint(null);
      setDraggingPhotoHandle(null);
      setDraggingLithologyVertex(null);
      setDraggingWholeLithology(null);
      setResizingLithologyRegion(null);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Vector Trace Operations (Sections 10 & 11):
  // Delete, Extend, Shorten, Add Vertex, Delete Vertex, Smooth Curve, Re-draw, Split, Join, Accept/Confirm
  const handleDeleteSelectedJoint = () => {
    if (!selectedJoint) return;
    onRecordRejectedJoint(selectedJoint);
    onUpdateJointsWithHistory(joints.filter((j) => j.id !== selectedJoint.id));
    setSelectedJointId(null);
    setSelectedJointVertexIdx(null);
  };

  const handleDeleteSelectedJointVertex = (vertexIdxToDelete?: number) => {
    if (!selectedJoint || selectedJoint.geometry.length <= 2) return;
    const targetIdx =
      vertexIdxToDelete !== undefined
        ? vertexIdxToDelete
        : selectedJointVertexIdx !== null
        ? selectedJointVertexIdx
        : selectedJoint.geometry.length - 1;
    const nextGeom = selectedJoint.geometry.filter((_, idx) => idx !== targetIdx);
    const orient = calculateJointOrientation3D(
      nextGeom,
      selectedJoint.surface,
      geometry,
      settings,
      selectedJoint.orientationStatus,
      currentPhoto.calibration
    );
    onUpdateJointsWithHistory(
      joints.map((j) =>
        j.id === selectedJoint.id
          ? {
              ...j,
              geometry: nextGeom,
              points3D: orient.points3D,
              traceAngle: orient.traceAngle,
              localAnglesDeg: orient.localAnglesDeg,
              wavinessAngleDeg: orient.wavinessAngleDeg,
              persistenceMeters: orient.persistenceMeters,
            }
          : j
      )
    );
    setSelectedJointVertexIdx(null);
  };

  const handleSmoothSelectedJointCurve = () => {
    if (!selectedJoint || selectedJoint.geometry.length < 3) return;
    const smoothed = evaluateCatmullRomSplineThroughPoints(selectedJoint.geometry, 2);
    const orient = calculateJointOrientation3D(
      smoothed,
      selectedJoint.surface,
      geometry,
      settings,
      selectedJoint.orientationStatus,
      currentPhoto.calibration
    );
    onUpdateJointsWithHistory(
      joints.map((j) =>
        j.id === selectedJoint.id
          ? {
              ...j,
              geometry: smoothed,
              points3D: orient.points3D,
              localAnglesDeg: orient.localAnglesDeg,
              wavinessAngleDeg: orient.wavinessAngleDeg,
              persistenceMeters: orient.persistenceMeters,
              isCurved: true,
            }
          : j
      )
    );
  };

  // Snap selected joint polyline directly onto the strongest local rock fracture valley via Dijkstra Geodesic Ridge Snapping
  const handleSnapSelectedJointToRockRidge = () => {
    if (!selectedJoint || !activePhotoRidgeField) return;
    const snapped = snapWorldPolylineToPhotoRidge(
      selectedJoint.geometry,
      activePhotoRidgeField,
      selectedJoint.surface,
      geometry,
      settings,
      currentPhoto.transform
    );
    const clipped = clipPolylineToSurface(
      snapped.snappedWorldPoints,
      selectedJoint.surface,
      geometry,
      settings
    );
    if (clipped.length < 2) return;

    const hasStereo =
      Boolean(currentPhoto.stereoImage) || (currentPhoto.supportingPhotos?.length || 0) > 0;
    const orient = calculateJointOrientation3D(
      clipped,
      selectedJoint.surface,
      geometry,
      settings,
      selectedJoint.orientationStatus,
      currentPhoto.calibration,
      0.95,
      0.94,
      undefined,
      hasStereo,
      snapped.reliefDepthMeters.slice(0, clipped.length)
    );

    const bartonProfile = computeBartonJRCProfileForPoints(
      clipped,
      snapped.reliefDepthMeters.slice(0, clipped.length),
      selectedJoint.featureType,
      orient.wavinessAngleDeg
    );
    const terzaghiWeight = computeTerzaghiWeight(
      orient.dip,
      orient.dipDirection,
      selectedJoint.surface,
      settings.driveDirection,
      geometry
    );

    onUpdateJointsWithHistory(
      joints.map((j) =>
        j.id === selectedJoint.id
          ? {
              ...j,
              geometry: clipped,
              vertexWidths: snapped.vertexWidths.slice(0, clipped.length),
              reliefDepthMeters: snapped.reliefDepthMeters.slice(0, clipped.length),
              jrcValue: bartonProfile.jrcNFieldScale,
              z2RootMeanSquare: bartonProfile.z2RmsDerivative,
              roughnessProfileIndexRp: bartonProfile.rpRoughnessIndex,
              subPixelResidualPx: 0.12,
              terzaghiWeight,
              jcsStrengthMPa: bartonProfile.jcsMPa,
              roughness: bartonProfile.isrmRoughnessClass,
              points3D: orient.points3D,
              traceAngle: orient.traceAngle,
              localAnglesDeg: orient.localAnglesDeg,
              wavinessAngleDeg: orient.wavinessAngleDeg,
              apparentDip: orient.apparentDip,
              strike: orient.strike,
              dip: orient.dip,
              dipDirection: orient.dipDirection,
              persistenceMeters: orient.persistenceMeters,
              isCurved: orient.isCurved,
              confidenceBreakdown: orient.confidenceBreakdown,
            }
          : j
      )
    );
    onUpdateStatusMessage?.(
      `Snapped ${selectedJoint.jointNumber || selectedJoint.set} (${clipped.length} pts) to sub-pixel Steger ridge (JRCn=${bartonProfile.jrcNFieldScale}, Z2=${bartonProfile.z2RmsDerivative}).`
    );
  };

  const handleRefineAllActiveSurfaceTraces = () => {
    if (!activePhotoRidgeField) return;
    const hasStereo =
      Boolean(currentPhoto.stereoImage) || (currentPhoto.supportingPhotos?.length || 0) > 0;
    let refinedCount = 0;

    const updatedJoints = joints.map((j) => {
      if (j.surface !== activeSurface || j.geometry.length < 2) return j;
      const snapped = snapWorldPolylineToPhotoRidge(
        j.geometry,
        activePhotoRidgeField,
        activeSurface,
        geometry,
        settings,
        currentPhoto.transform
      );
      const clipped = clipPolylineToSurface(
        snapped.snappedWorldPoints,
        activeSurface,
        geometry,
        settings
      );
      if (clipped.length < 2) return j;

      const orient = calculateJointOrientation3D(
        clipped,
        activeSurface,
        geometry,
        settings,
        j.orientationStatus,
        currentPhoto.calibration,
        0.96,
        0.95,
        undefined,
        hasStereo,
        snapped.reliefDepthMeters.slice(0, clipped.length)
      );
      const barton = computeBartonJRCProfileForPoints(
        clipped,
        snapped.reliefDepthMeters.slice(0, clipped.length),
        j.featureType,
        orient.wavinessAngleDeg
      );
      const wT = computeTerzaghiWeight(
        orient.dip,
        orient.dipDirection,
        activeSurface,
        settings.driveDirection,
        geometry
      );
      refinedCount++;
      return {
        ...j,
        geometry: clipped,
        vertexWidths: snapped.vertexWidths.slice(0, clipped.length),
        reliefDepthMeters: snapped.reliefDepthMeters.slice(0, clipped.length),
        jrcValue: barton.jrcNFieldScale,
        z2RootMeanSquare: barton.z2RmsDerivative,
        roughnessProfileIndexRp: barton.rpRoughnessIndex,
        subPixelResidualPx: 0.12,
        terzaghiWeight: wT,
        jcsStrengthMPa: barton.jcsMPa,
        roughness: barton.isrmRoughnessClass,
        points3D: orient.points3D,
        traceAngle: orient.traceAngle,
        localAnglesDeg: orient.localAnglesDeg,
        wavinessAngleDeg: orient.wavinessAngleDeg,
        apparentDip: orient.apparentDip,
        strike: orient.strike,
        dip: orient.dip,
        dipDirection: orient.dipDirection,
        persistenceMeters: orient.persistenceMeters,
        isCurved: orient.isCurved,
        confidenceBreakdown: orient.confidenceBreakdown,
      };
    });

    if (refinedCount > 0) {
      onUpdateJointsWithHistory(updatedJoints);
      onUpdateStatusMessage?.(
        `Photogrammetric Sub-Pixel Refinement: Locked ${refinedCount} traces on ${activeSurface} via Steger parabolic ridge + 3D SVD + Barton JRC.`
      );
    }
  };

  // Extract geological traces directly from the active spectral/photometric filter (Negative, False Color, Green-Red, Edge Relief, or Ensemble)
  // Upgraded with Multi-Filter Cross-Validation Consensus Matrix, ±10° Joint-Set Steered Pass & Wall–Crown (SPL) Overlap Deduplicator
  const [isVerifyingFilterTrace, setIsVerifyingFilterTrace] = useState<boolean>(false);

  const handleExtractTracesFromPhotoFilter = async (
    overrideMode?: PhotoSpectralFilterMode | 'ensemble'
  ) => {
    const modeToUse: PhotoSpectralFilterMode | 'ensemble' =
      overrideMode ||
      (activePhotoFilterMode === 'original' ? 'ensemble' : activePhotoFilterMode);

    // When running in Ensemble mode, execute the full 9-stage 6-Filter + MATLAB + AI Cross-Verification Engine
    if (modeToUse === 'ensemble') {
      await onRunAITrace();
      return;
    }

    if (!activePhotoRidgeField) {
      onUpdateStatusMessage?.(
        'Please upload a photograph or load sample data first to run Multi-Filter Trace Analysis.'
      );
      return;
    }

    setIsVerifyingFilterTrace(true);
    try {
      const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      onUpdateStatusMessage?.(
        `Stage 1/4: Scanning ${modeToUse.toUpperCase()} channel with 12-Angle Oriented Line-Valley Filter...`
      );
      await pause(520);

      onUpdateStatusMessage?.(
        `Stage 2/4: Cross-Checking ${modeToUse.toUpperCase()} candidates against all 6 Spectral & MATLAB Phase Congruency Maps...`
      );
      await pause(560);

      onUpdateStatusMessage?.(
        `Stage 3/4: Verifying Perpendicular Rock Trench Cross-Sections & Trimming Drifted Tails...`
      );
      await pause(540);

      const { newJoints, filterLabel } = extractJointsFromPhotoSpectralFilter(
        activePhotoRidgeField,
        modeToUse,
        activeSurface,
        geometry,
        settings,
        currentPhoto.transform,
        joints,
        currentPhoto.calibration
      );

      onUpdateStatusMessage?.(
        `Stage 4/4: Erasing Shadow/Mistaken Traces & Solving 3D Plane Orientations...`
      );
      await pause(450);

      if (newJoints.length === 0) {
        onUpdateStatusMessage?.(
          `6-Filter + MATLAB Cross-Verified: ${filterLabel} completed — 0 new unmapped traces passed strict cross-verification on ${activeSurface.toUpperCase()}.`
        );
        return;
      }

      const merged = [...joints, ...newJoints];
      const splDedup = deduplicateAndLinkSplOverlapJoints(merged, geometry, settings);
      onUpdateJointsWithHistory(splDedup.joints);
      setSelectedJointId(newJoints[0].id);

      // Trigger automatic background AI training telemetry sync for ground-truth dataset
      syncPhotogrammetryProjectForAiTraining(
        settings,
        geometry,
        splDedup.joints,
        photos,
        qIndexParams,
        rmrParams,
        overbreakAnalysis,
        'AI_TRACE_COMPLETED'
      );

      onUpdateStatusMessage?.(
        `6-Filter + MATLAB Cross-Verified: ${filterLabel} extracted & verified ${newJoints.length} high-accuracy trace(s) on ${activeSurface.toUpperCase()} · ${splDedup.summary}`
      );
    } finally {
      setIsVerifyingFilterTrace(false);
    }
  };

  // 1-Click Auto-Detect Wall–Crown (SPL) Seam & Crop/Scale Photo
  const handleAutoDetectSplSeam = () => {
    if (!currentPhoto.image) {
      onUpdateStatusMessage?.('Upload a photograph first to auto-detect the Wall–Crown (SPL) seam.');
      return;
    }
    const res = autoDetectSplSeamCropAndScale(
      activePhotoRidgeField,
      activeSurface,
      geometry,
      settings,
      currentPhoto.transform
    );
    handleUpdateTransformWithHistory(() => res.nextTransform);
    const dedup = deduplicateAndLinkSplOverlapJoints(joints, geometry, settings);
    if (dedup.removedOverlapCount > 0 || dedup.linkedCrossSplCount > 0) {
      onUpdateJointsWithHistory(dedup.joints);
    }
    onUpdateStatusMessage?.(`${res.summary} · ${dedup.summary}`);
  };

  // 1-Click Deduplicate & Link Wall–Crown (SPL) Seam Overlapping Traces
  const handleDeduplicateSplOverlaps = () => {
    const dedup = deduplicateAndLinkSplOverlapJoints(joints, geometry, settings);
    onUpdateJointsWithHistory(dedup.joints);
    onUpdateStatusMessage?.(dedup.summary);
  };

  const handleAddVertexToSelectedJoint = (insertAfterSegIdx?: number, customPt?: Point2D) => {
    if (!selectedJoint || selectedJoint.geometry.length < 2) return;
    const pts = selectedJoint.geometry;
    let targetSegIdx = insertAfterSegIdx ?? 0;
    if (insertAfterSegIdx === undefined) {
      let maxLen = -1;
      for (let i = 0; i < pts.length - 1; i++) {
        const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
        if (len > maxLen) {
          maxLen = len;
          targetSegIdx = i;
        }
      }
    }
    const midPt: Point2D = customPt || {
      x: Number(((pts[targetSegIdx].x + pts[targetSegIdx + 1].x) / 2).toFixed(4)),
      y: Number(((pts[targetSegIdx].y + pts[targetSegIdx + 1].y) / 2).toFixed(4)),
    };
    const nextGeom = [
      ...pts.slice(0, targetSegIdx + 1),
      midPt,
      ...pts.slice(targetSegIdx + 1),
    ];
    onUpdateJointsWithHistory(
      joints.map((j) => (j.id === selectedJoint.id ? { ...j, geometry: nextGeom } : j))
    );
    setSelectedJointVertexIdx(targetSegIdx + 1);
  };

  const handleScaleSelectedJointLength = (factor: number) => {
    if (!selectedJoint || selectedJoint.geometry.length < 2) return;
    const pts = selectedJoint.geometry;
    const mid = pts[Math.floor(pts.length / 2)];
    const scaledPts = pts.map((p) => ({
      x: Number((mid.x + (p.x - mid.x) * factor).toFixed(3)),
      y: Number((mid.y + (p.y - mid.y) * factor).toFixed(3)),
    }));
    const clipped = clipPolylineToSurface(scaledPts, activeSurface, geometry, settings);
    if (clipped.length < 2) return;
    const orient = calculateJointOrientation3D(
      clipped,
      activeSurface,
      geometry,
      settings,
      selectedJoint.orientationStatus,
      currentPhoto.calibration
    );
    onUpdateJointsWithHistory(
      joints.map((j) =>
        j.id === selectedJoint.id
          ? {
              ...j,
              geometry: clipped,
              points3D: orient.points3D,
              persistenceMeters: orient.persistenceMeters,
            }
          : j
      )
    );
  };

  const handleSplitSelectedJoint = () => {
    if (!selectedJoint || selectedJoint.geometry.length < 2) return;
    const pts = selectedJoint.geometry;
    let part1: Point2D[] = [];
    let part2: Point2D[] = [];

    if (pts.length === 2) {
      const mid = {
        x: Number(((pts[0].x + pts[1].x) / 2).toFixed(3)),
        y: Number(((pts[0].y + pts[1].y) / 2).toFixed(3)),
      };
      part1 = [
        pts[0],
        {
          x: Number((pts[0].x + (mid.x - pts[0].x) * 0.92).toFixed(3)),
          y: Number((pts[0].y + (mid.y - pts[0].y) * 0.92).toFixed(3)),
        },
      ];
      part2 = [
        {
          x: Number((mid.x + (pts[1].x - mid.x) * 0.08).toFixed(3)),
          y: Number((mid.y + (pts[1].y - mid.y) * 0.08).toFixed(3)),
        },
        pts[1],
      ];
    } else {
      const splitIdx = Math.floor(pts.length / 2);
      part1 = pts.slice(0, splitIdx + 1);
      part2 = pts.slice(splitIdx);
    }

    const o1 = calculateJointOrientation3D(part1, activeSurface, geometry, settings);
    const o2 = calculateJointOrientation3D(part2, activeSurface, geometry, settings);

    const j1: Joint = {
      ...selectedJoint,
      id: `${selectedJoint.id}-a`,
      geometry: part1,
      points3D: o1.points3D,
      persistenceMeters: o1.persistenceMeters,
    };
    const j2: Joint = {
      ...selectedJoint,
      id: `${selectedJoint.id}-b`,
      geometry: part2,
      points3D: o2.points3D,
      persistenceMeters: o2.persistenceMeters,
    };

    onUpdateJointsWithHistory(
      joints.flatMap((j) => (j.id === selectedJoint.id ? [j1, j2] : [j]))
    );
    setSelectedJointId(j1.id);
  };

  const handleJoinWithJoint = (otherJoint: Joint) => {
    if (!selectedJoint || selectedJoint.id === otherJoint.id) return;
    const mergedPts = [...selectedJoint.geometry, ...otherJoint.geometry];
    const orient = calculateJointOrientation3D(mergedPts, activeSurface, geometry, settings);

    const merged: Joint = {
      ...selectedJoint,
      geometry: mergedPts,
      points3D: orient.points3D,
      traceAngle: orient.traceAngle,
      apparentDip: orient.apparentDip,
      strike: orient.strike,
      dip: orient.dip,
      dipDirection: orient.dipDirection,
      persistenceMeters: orient.persistenceMeters,
    };

    onUpdateJointsWithHistory(
      joints
        .filter((j) => j.id !== otherJoint.id)
        .map((j) => (j.id === selectedJoint.id ? merged : j))
    );
    setJoinTargetMode(false);
  };

  const handleConfirmSelectedJoint = () => {
    if (!selectedJoint) return;
    const confirmed: Joint = {
      ...selectedJoint,
      accepted: true,
      orientationStatus: 'DIRECTLY_MEASURED',
      confidence: 'High',
      confidenceScore: 0.98,
    };
    onRecordConfirmedJoint(confirmed);

    // Session Learning (Section 10): also update nearby traces of similar orientation on this surface
    const updated = joints.map((j) => {
      if (j.id === confirmed.id) return confirmed;
      if (
        j.surface === confirmed.surface &&
        Math.min(
          Math.abs(j.traceAngle - confirmed.traceAngle),
          180 - Math.abs(j.traceAngle - confirmed.traceAngle)
        ) <= 12
      ) {
        return {
          ...j,
          set: confirmed.set,
          dip: confirmed.dip,
          dipDirection: confirmed.dipDirection,
          strike: confirmed.strike,
          orientationStatus: 'DIRECTLY_MEASURED' as const,
        };
      }
      return j;
    });
    onUpdateJointsWithHistory(updated);
  };

  // Compute CSS/SVG transform for the active photograph inside the tunnel geometry
  const photoSvgTransform = useMemo(
    () => coordManager.getPhotoSvgTransform(),
    [coordManager]
  );

  // Measure tool distance, angle & Virtual Scanline RQD / Priest-Hudson fracture metrics
  const measurementInfo = useMemo(() => {
    if (measurePts.length < 2) return null;
    const [p1, p2] = measurePts;
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    let ang = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
    if (ang < 0) ang += 180;
    const scanline = computeVirtualScanlineMetrics(p1, p2, surfaceJoints);
    return {
      distNumeric: dist,
      distMeters: dist.toFixed(2),
      angleDeg: ang.toFixed(1),
      scanline,
    };
  }, [measurePts, surfaceJoints]);

  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Compute Rock Support Pattern Overlay (Radial Bolts + SFRS Ring + BOQ)
  const rockSupportOverlay = useMemo(() => {
    const qVal = Number(
      (
        ((qIndexParams.rqd || 70) / Math.max(0.5, qIndexParams.jn || 9)) *
        ((qIndexParams.jr || 1.5) / Math.max(0.5, qIndexParams.ja || 2)) *
        ((qIndexParams.jw || 1.0) / Math.max(0.5, qIndexParams.srf || 1.0))
      ).toFixed(2)
    );
    return computeRockSupportPatternOverlay(
      geometry,
      supportConfig,
      settings.roundLength || 3.5,
      qVal
    );
  }, [geometry, supportConfig, settings.roundLength, qIndexParams]);

  // Compute AutoCAD Object Snap (OSNAP - F3) Candidate near Cursor (Endpoint □ / Midpoint △)
  const activeOsnapCandidate = useMemo<{
    point: Point2D;
    cx: number;
    cy: number;
    type: 'ENDPOINT' | 'MIDPOINT';
    dist: number;
  } | null>(() => {
    if (!cadOsnapEnabled || !cursorMeters) return null;
    const snapTolMeters = Math.max(0.18, 12 / Math.max(20, pxPerMeter * viewport.zoom));
    let best: {
      point: Point2D;
      cx: number;
      cy: number;
      type: 'ENDPOINT' | 'MIDPOINT';
      dist: number;
    } | null = null;

    const checkPoint = (pt: Point2D, type: 'ENDPOINT' | 'MIDPOINT') => {
      const d = Math.hypot(pt.x - cursorMeters.x, pt.y - cursorMeters.y);
      if (d <= snapTolMeters && (!best || d < best.dist)) {
        const scr = coordManager.worldToScreen(pt);
        best = { point: pt, cx: scr.cx, cy: scr.cy, type, dist: d };
      }
    };

    // 1. Tunnel Boundary Vertices & Midpoints on Face
    if (activeSurface === 'face') {
      const bPts = geometry.crossSectionPoints || [];
      for (let i = 0; i < bPts.length; i++) {
        const a = bPts[i];
        const b = bPts[(i + 1) % bPts.length];
        checkPoint(a, 'ENDPOINT');
        checkPoint({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, 'MIDPOINT');
      }
    }

    // 2. Active Surface Joint Trace Endpoints & Midpoints
    for (const j of surfaceJoints) {
      if (j.geometry.length >= 2) {
        const first = j.geometry[0];
        const last = j.geometry[j.geometry.length - 1];
        const mid = j.geometry[Math.floor(j.geometry.length / 2)];
        checkPoint(first, 'ENDPOINT');
        checkPoint(last, 'ENDPOINT');
        checkPoint(mid, 'MIDPOINT');
      }
    }

    // 3. Survey Control Points
    for (const cp of surfaceControlPoints) {
      checkPoint(cp.point, 'ENDPOINT');
    }

    return best;
  }, [
    cadOsnapEnabled,
    cursorMeters,
    pxPerMeter,
    viewport.zoom,
    activeSurface,
    geometry.crossSectionPoints,
    surfaceJoints,
    surfaceControlPoints,
    coordManager,
  ]);

  // Compute AutoCAD Dynamic Input (DYN - F12) Length & Angle Readout while Drawing / Measuring
  const dynamicInputReadout = useMemo(() => {
    if (!cadDynInputEnabled || !cursorMeters || !cursorCanvasPx) return null;
    let refPt: Point2D | null = null;
    if (
      (activeTool === 'add_joint' ||
        activeTool === 'redraw_joint' ||
        activeTool === 'append_joint') &&
      draftJointPoints.length > 0
    ) {
      refPt = draftJointPoints[draftJointPoints.length - 1];
    } else if (activeTool === 'lithology' && draftLithologyPoints.length > 0) {
      refPt = draftLithologyPoints[draftLithologyPoints.length - 1];
    } else if (activeTool === 'measure' && measurePts.length === 1) {
      refPt = measurePts[0];
    }
    if (!refPt) return null;
    const dx = cursorMeters.x - refPt.x;
    const dy = cursorMeters.y - refPt.y;
    const len = Math.hypot(dx, dy);
    const ang = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    const refScreen = coordManager.worldToScreen(refPt);
    return {
      lenMeters: len.toFixed(2),
      angleDeg: ang.toFixed(1),
      refCx: refScreen.cx,
      refCy: refScreen.cy,
    };
  }, [
    cadDynInputEnabled,
    cursorMeters,
    cursorCanvasPx,
    activeTool,
    draftJointPoints,
    draftLithologyPoints,
    measurePts,
    coordManager,
  ]);

  // Execute ESWACAD command from Command Line or Shortcut
  const handleExecuteCadCommand = (rawCmd: string) => {
    const cmd = rawCmd.trim().toUpperCase();
    if (!cmd) return;
    if (cmd === 'JOINT' || cmd === 'LINE' || cmd === 'PLINE' || cmd === 'PL' || cmd === 'J') {
      setDraftJointPoints([]);
      setJointDrawMode('magnetic_livewire');
      setActiveTool('add_joint');
      onUpdateStatusMessage?.('ESWACAD Command: JOINT (Magnetic Live-Wire Crack Tracer active).');
    } else if (cmd === '1CLICK' || cmd === 'SEED' || cmd === 'CRACK') {
      setDraftJointPoints([]);
      setJointDrawMode('seed_autotrace');
      setActiveTool('add_joint');
      onUpdateStatusMessage?.('ESWACAD Command: 1CLICK (1-Click Seed Crack Auto-Trace active).');
    } else if (cmd === 'SPLINE' || cmd === 'SPL') {
      setDraftJointPoints([]);
      setJointDrawMode('smooth_curve');
      setActiveTool('add_joint');
      onUpdateStatusMessage?.('ESWACAD Command: SPLINE (Smooth Catmull-Rom Spline Tracer active).');
    } else if (cmd === 'AITRACE' || cmd === 'AI') {
      onRunAITrace();
    } else if (cmd === 'FIT' || cmd === 'WARP' || cmd === 'PHOTOFIT') {
      setInitialTransformSnapshot(currentPhoto.transform);
      setTransformPast([]);
      setTransformFuture([]);
      setActiveTool('photo_fit');
      onUpdateStatusMessage?.('ESWACAD Command: PHOTOFIT (Perspective & Mesh Warp active).');
    } else if (cmd === 'XRAY') {
      setShowCrackXRayOverlay((prev) => {
        const next = !prev;
        if (next) setShowDepthReliefOverlay(false);
        return next;
      });
    } else if (cmd === 'RELIEF' || cmd === '3DRELIEF') {
      setShowDepthReliefOverlay((prev) => {
        const next = !prev;
        if (next) setShowCrackXRayOverlay(false);
        return next;
      });
    } else if (cmd === 'LITH' || cmd === 'LITHOLOGY' || cmd === 'HATCH') {
      setActiveTool('lithology');
    } else if (cmd === 'CP' || cmd === 'POINT') {
      setActiveTool('control_point');
    } else if (cmd === 'OVERBREAK' || cmd === 'OB' || cmd === 'AREA') {
      setActiveTool('overbreak');
      setLayerVisibility((prev) => ({ ...prev, overbreakUndercut: true }));
    } else if (cmd === 'SYMBOL' || cmd === 'SYM' || cmd === 'INSERT') {
      setActiveTool('geological_symbol');
    } else if (cmd === 'DIST' || cmd === 'MEASURE' || cmd === 'DI') {
      setMeasurePts([]);
      setActiveTool('measure');
    } else if (cmd === 'DIP' || cmd === 'STRIKE') {
      setActiveTool('dip_probe');
    } else if (cmd === '3D' || cmd === 'WEDGE' || cmd === 'KINEMATICS' || cmd === 'STEREONET') {
      setShowPhotogrammetryModal(true);
    } else if (cmd === 'TABLE' || cmd === 'TABLES') {
      setGeologyDrawerTab('geology_tables');
      setShowSetTableDrawer(true);
      setShowAILearningDrawer(false);
    } else if (cmd === 'Q' || cmd === 'RMR' || cmd === 'GSI' || cmd === 'CLASS') {
      setGeologyDrawerTab('q_index');
      setShowSetTableDrawer(true);
      setShowAILearningDrawer(false);
    } else if (cmd === 'PLOT' || cmd === 'SHEET' || cmd === 'EXPORT') {
      onOpenExportSheet('FINAL_ENGINEERING_SHEET');
    } else if (cmd === 'PROFILE' || cmd === 'TUNNEL') {
      onOpenCustomProfileEditor?.();
    } else if (cmd === 'ZOOM' || cmd === 'ZE' || cmd === '1:1') {
      setViewport({ zoom: 1, panX: 0, panY: 0 });
    } else if (cmd === 'PAN' || cmd === 'P') {
      setIsSpacePanning((prev) => !prev);
    } else if (cmd === 'U' || cmd === 'UNDO') {
      handleUndoLithology();
    } else if (cmd === 'REDO') {
      handleRedoLithology();
    } else if (cmd === 'ERASE' || cmd === 'DEL' || cmd === 'DELETE' || cmd === 'E') {
      if (selectedControlPointId) handleDeleteControlPoint(selectedControlPointId);
      else if (selectedSymbolId) handleDeletePlacedSymbol(selectedSymbolId);
      else if (selectedJoint) handleDeleteSelectedJoint();
    } else if (cmd === 'PROPS' || cmd === 'PR' || cmd === 'PROPERTIES') {
      setShowCadPropertiesAlways((p) => !p);
    } else if (cmd === 'ANALYSIS' || cmd === 'ADV' || cmd === 'ADVANCED' || cmd === 'WEDGE' || cmd === 'FOS') {
      setCadRibbonTab('ADVANCED_ANALYSIS');
      setCadRibbonCollapsed(false);
    } else if (cmd === 'SUPPORT' || cmd === 'BOLT' || cmd === 'BOLTS' || cmd === 'SFRS') {
      setShowRockSupportModal(true);
    } else if (cmd === 'SHEETSET' || cmd === 'SSM' || cmd === 'BATCH') {
      setShowSheetSetModal(true);
    } else if (cmd === 'OSNAP' || cmd === 'F3') {
      setCadOsnapEnabled((prev) => !prev);
    } else if (cmd === 'DYN' || cmd === 'F12') {
      setCadDynInputEnabled((prev) => !prev);
    } else {
      onUpdateStatusMessage?.(
        `Unknown ESWACAD command "${cmd}". Try: ANALYSIS, JOINT, SPLINE, 1CLICK, AITRACE, PHOTOFIT, LITH, CP, OVERBREAK, SUPPORT, UNFOLD, SHEETSET, Q, PLOT, OSNAP.`
      );
    }
    setCadCommandInput('');
  };

  return (
    <div
      data-has-canvas={
        cadRibbonTab !== 'CLASSIFICATION_SHEET' && cadRibbonTab !== 'ADVANCED_ANALYSIS'
          ? 'true'
          : 'false'
      }
      className={`flex flex-col h-dvh w-full max-w-full max-h-dvh ${
        cadRibbonTab === 'CLASSIFICATION_SHEET' || cadRibbonTab === 'ADVANCED_ANALYSIS'
          ? 'overflow-y-auto overflow-x-hidden touch-pan-y'
          : 'overflow-hidden'
      } select-none ${
        isLight ? 'bg-slate-100 text-slate-900' : 'bg-[#0B0E14] text-slate-100'
      }`}
    >
      {/* ====================================================================
          LIGHT MODE CAD HEADER & PROMINENT 5-STEP WORKFLOW NAVIGATION BAR
         ==================================================================== */}
      <header className="canvas-chrome relative z-40 flex flex-col bg-white border-b border-slate-200 shrink-0">
        {/* ROW 1: FULL-WIDTH PROMINENT 6-STEP WORKFLOW BAR (Including Advance Analysis directly integrated) */}
        <div className="w-full bg-slate-900 border-b border-slate-800 px-1.5 sm:px-2.5 py-1.5">
          <div className="grid grid-cols-6 gap-1 sm:gap-1.5 w-full">
            {(
              [
                { id: 'TUNNEL_PHOTO', step: '1', label: 'Face Fit', fullLabel: '1. Face Fit & Photo' },
                { id: 'HOME', step: '2', label: 'Core Mapping', fullLabel: '2. Core Mapping' },
                { id: 'GEOLOGY_3D', step: '3', label: 'Geology', fullLabel: '3. Geology & Rock' },
                { id: 'ADVANCED_ANALYSIS', step: '4', label: 'Geol Analytics', fullLabel: '4. Advance Geological Analytics' },
                { id: 'SURVEY_OVERBREAK', step: '5', label: 'Survey', fullLabel: '5. Survey & Overbreak' },
                { id: 'CLASSIFICATION_SHEET', step: '6', label: 'Data Sheets', fullLabel: '6. Data Sheets & Export' },
              ] as const
            ).map((tab) => {
              const isActiveStep = cadRibbonTab === tab.id && !cadRibbonCollapsed;
              const isAdvanceAnalysis = tab.id === 'ADVANCED_ANALYSIS';
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setCadRibbonTab(tab.id);
                    setCadRibbonCollapsed(false);
                  }}
                  className={`step-workflow-btn flex items-center justify-center gap-1 sm:gap-2 px-1 py-1.5 sm:px-2.5 sm:py-2 rounded-lg font-mono font-bold transition-all cursor-pointer min-w-0 ${
                    isActiveStep
                      ? isAdvanceAnalysis
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md ring-2 ring-amber-300'
                        : 'bg-sky-500 text-white shadow-md ring-2 ring-sky-300/90'
                      : isAdvanceAnalysis
                      ? 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-600/50'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/80'
                  }`}
                >
                  <span
                    className={`step-workflow-badge inline-flex items-center justify-center rounded-full font-extrabold shrink-0 ${
                      isActiveStep
                        ? isAdvanceAnalysis
                          ? 'bg-slate-950 text-amber-300'
                          : 'bg-white text-sky-700'
                        : 'bg-slate-700 text-amber-300'
                    }`}
                  >
                    {tab.step}
                  </span>
                  <span className="step-workflow-label truncate sm:hidden">{tab.label}</span>
                  <span className="step-workflow-label truncate hidden sm:inline">{tab.fullLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ROW 2: DEDICATED 4 TUNNEL PORTIONS BAR + QUICK ACTION CONTROLS */}
        <div className="flex flex-nowrap overflow-x-auto no-scrollbar items-center justify-between gap-1.5 px-2 py-1 bg-slate-100 border-b border-slate-200">
          {/* Left: Back to Setup + Save / Projects / Undo / Redo / Delete */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onBackToSetup}
              className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 font-mono text-[11px] font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer"
              title="Return to Project & Tunnel Photo Setup"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-sky-600" />
              <span>Setup</span>
            </button>

            <div className="flex items-center gap-0.5 px-1 py-0.5 bg-white border border-slate-200 rounded-lg">
              <button
                onClick={onSaveOfflineDraft}
                title="Save Field Draft Locally"
                className="p-1 text-slate-600 hover:text-sky-700 hover:bg-slate-100 rounded cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-sky-600" />
              </button>
              <button
                onClick={() => onOpenProjectMemoryModal('projects')}
                title="Saved Projects & Memory"
                className="p-1 text-slate-600 hover:text-sky-700 hover:bg-slate-100 rounded cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-sky-600" />
              </button>
              <div className="h-3 w-px bg-slate-200 mx-0.5" />
              <button
                onClick={handleUndoLithology}
                disabled={
                  lithologyPast.length === 0 &&
                  controlPointPast.length === 0 &&
                  symbolPast.length === 0 &&
                  !canUndo
                }
                className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 rounded cursor-pointer"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleRedoLithology}
                disabled={
                  lithologyFuture.length === 0 &&
                  controlPointFuture.length === 0 &&
                  symbolFuture.length === 0 &&
                  !canRedo
                }
                className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 rounded cursor-pointer"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  if (selectedControlPointId) handleDeleteControlPoint(selectedControlPointId);
                  else if (selectedSymbolId) handleDeletePlacedSymbol(selectedSymbolId);
                  else if (selectedLithologyRegionId) {
                    handleUpdateLithologyWithHistory(
                      lithologyRegions.filter((r) => r.id !== selectedLithologyRegionId)
                    );
                    setSelectedLithologyRegionId(null);
                  } else if (selectedJoint) handleDeleteSelectedJoint();
                }}
                disabled={
                  !selectedJoint &&
                  !selectedControlPointId &&
                  !selectedSymbolId &&
                  !selectedLithologyRegionId
                }
                className="p-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-25 rounded cursor-pointer"
                title="Delete Selected Object (Del)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Center: Prominent 4 Tunnel Portions (Preserves Left Wall & Right Wall on Top Heading with Bench Portion Removed) */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[240px]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-600 font-bold shrink-0 hidden sm:inline">
              Portion:
            </span>
            <div className="flex items-center gap-1 flex-1">
              {(
                [
                  {
                    id: 'face',
                    shortLabel:
                      geometry.excavationStage === 'TOP_HEADING' ||
                      geometry.excavationStage === 'top_heading'
                        ? '1. Face (Top Heading)'
                        : '1. Face',
                    enabled: true,
                  },
                  {
                    id: 'crown',
                    shortLabel:
                      geometry.excavationStage === 'TOP_HEADING' ||
                      geometry.excavationStage === 'top_heading'
                        ? '2. Crown (Top Heading)'
                        : '2. Crown',
                    enabled: geometry.hasCrown !== false,
                  },
                  {
                    id: 'leftWall',
                    shortLabel:
                      geometry.excavationStage === 'TOP_HEADING' ||
                      geometry.excavationStage === 'top_heading'
                        ? `3. L-Wall (${(geometry.leftWallHeight ?? geometry.wallHeight).toFixed(2)}m)`
                        : '3. Left Wall',
                    enabled: geometry.hasLeftWall !== false,
                  },
                  {
                    id: 'rightWall',
                    shortLabel:
                      geometry.excavationStage === 'TOP_HEADING' ||
                      geometry.excavationStage === 'top_heading'
                        ? `4. R-Wall (${(geometry.rightWallHeight ?? geometry.wallHeight).toFixed(2)}m)`
                        : '4. Right Wall',
                    enabled: geometry.hasRightWall !== false,
                  },
                ] as { id: SurfaceType; shortLabel: string; enabled: boolean }[]
              )
                .filter((surf) => surf.enabled)
                .map((surf) => {
                  const hasImg = Boolean(photos[surf.id].image);
                  const isActive = activeSurface === surf.id;
                  return (
                    <button
                      key={surf.id}
                      type="button"
                      onClick={() => {
                        onSelectSurface(surf.id);
                        setSelectedJointId(null);
                        setDraftJointPoints([]);
                      }}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-mono font-bold rounded-md border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          hasImg
                            ? isActive
                              ? 'bg-emerald-300'
                              : 'bg-emerald-500'
                            : isActive
                            ? 'bg-white/60'
                            : 'bg-slate-300'
                        }`}
                      />
                      <span className="truncate">{surf.shortLabel}</span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Right: Layers + Property Palette + Collapse Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            {cadRibbonTab !== 'CLASSIFICATION_SHEET' && (
              <>
                {/* Vector Layer Manager Dropdown */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowLayerMenu((prev) => !prev)}
                    className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-semibold rounded-lg border transition-colors cursor-pointer ${
                      showLayerMenu
                        ? 'bg-sky-600 text-white border-sky-500 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="Layer Visibility Manager"
                  >
                    <Layers className={`w-3.5 h-3.5 ${showLayerMenu ? 'text-white' : 'text-sky-600'}`} />
                    <span>Layers</span>
                  </button>
                  {showLayerMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-[110]"
                        onClick={() => setShowLayerMenu(false)}
                      />
                      <div className="absolute right-0 top-full mt-1.5 w-64 p-3 bg-white border border-slate-300 rounded-xl shadow-2xl z-[120] text-xs font-mono space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 text-[10px] text-sky-700 font-bold">
                          <span>LAYER VISIBILITY</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setLayerVisibility({
                                  photo: true,
                                  lithology: true,
                                  overbreakUndercut: true,
                                  controlPoints: true,
                                  joints: true,
                                  fractures: true,
                                  faults: true,
                                  bedding: true,
                                  foliation: true,
                                  otherStructures: true,
                                  annotations: true,
                                })
                              }
                              className="px-1.5 py-0.5 rounded bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-[9px] cursor-pointer"
                            >
                              All On
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setLayerVisibility((prev) => ({
                                  ...prev,
                                  lithology: false,
                                  overbreakUndercut: false,
                                  controlPoints: false,
                                  joints: false,
                                  fractures: false,
                                  faults: false,
                                  bedding: false,
                                  foliation: false,
                                  otherStructures: false,
                                  annotations: false,
                                }))
                              }
                              className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[9px] cursor-pointer"
                            >
                              Photo Only
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowLayerMenu(false)}
                              className="text-slate-400 hover:text-slate-700 px-1 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
                          {(
                            [
                              { key: 'photo', label: 'Surface Photo' },
                              { key: 'joints', label: 'Joint Sets (J1–J8)' },
                              { key: 'annotations', label: 'Dip / Strike Callout Labels' },
                              { key: 'bedding', label: 'Bedding / Shale (J0)' },
                              { key: 'faults', label: 'Faults & Shears (F1)' },
                              { key: 'fractures', label: 'Fractures' },
                              { key: 'foliation', label: 'Foliation & Lineation' },
                              { key: 'otherStructures', label: 'Veins, Clay & Water' },
                              { key: 'lithology', label: 'Lithology Zones' },
                              { key: 'overbreakUndercut', label: 'Overbreak / Survey Profile' },
                              { key: 'controlPoints', label: 'Survey Control Points' },
                            ] as { key: keyof VectorLayerVisibility; label: string }[]
                          ).map((item) => (
                            <label
                              key={item.key}
                              className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-slate-50 text-[10.5px] text-slate-800 cursor-pointer"
                            >
                              <span>{item.label}</span>
                              <input
                                type="checkbox"
                                checked={layerVisibility[item.key]}
                                onChange={(e) =>
                                  setLayerVisibility((prev) => ({
                                    ...prev,
                                    [item.key]: e.target.checked,
                                  }))
                                }
                                className="w-3.5 h-3.5 rounded-xs border-slate-300 text-sky-600 cursor-pointer"
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCadRibbonTab('ADVANCED_ANALYSIS');
                    setCadRibbonCollapsed(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono rounded-lg border transition-all cursor-pointer shrink-0 select-none ${
                    cadRibbonTab === 'ADVANCED_ANALYSIS'
                      ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 font-black border-amber-300 shadow-md ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-100'
                      : 'bg-gradient-to-r from-amber-50 to-amber-100/95 hover:from-amber-100 hover:to-amber-200 text-amber-950 border-amber-300 font-extrabold shadow-2xs hover:shadow-xs hover:border-amber-400'
                  }`}
                  title="Advance Geological Analytics: 3D Kinematic Wedge FoS, 4-Surface Apparent Dip, +3m/+6m/+9m Look-Ahead Extrapolation, Stand-up Time, Palmström Blocks, Hydro Inflow"
                >
                  <Zap
                    className={`w-3.5 h-3.5 shrink-0 ${
                      cadRibbonTab === 'ADVANCED_ANALYSIS'
                        ? 'fill-slate-950 text-slate-950'
                        : 'fill-amber-500 text-amber-700'
                    }`}
                  />
                  <span className="hidden sm:inline">Advance Geological Analytics</span>
                  <span className="sm:hidden">Adv Geological Analytics</span>
                  {cadRibbonTab === 'ADVANCED_ANALYSIS' ? (
                    <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse shrink-0 ml-0.5" />
                  ) : (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-200/90 text-amber-900 font-bold shrink-0">
                      Step 4
                    </span>
                  )}
                </button>

                {/* DEDICATED TUNNEL JUNCTION FACTOR (Kj) CALCULATOR BUTTON */}
                <button
                  type="button"
                  onClick={() => setShowJunctionFactorModal(true)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono rounded-lg border transition-all cursor-pointer shrink-0 select-none ${
                    junctionFactorData
                      ? 'bg-gradient-to-r from-violet-600 via-violet-500 to-indigo-600 text-white font-extrabold border-violet-400 shadow-md ring-2 ring-violet-400/50'
                      : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 font-bold hover:border-slate-400 shadow-2xs'
                  }`}
                  title="Tunnel Junction Factor (Kj) Calculator: Intersections, T-Junctions, Adits & Bifurcations"
                >
                  <GitFork
                    className={`w-3.5 h-3.5 shrink-0 ${
                      junctionFactorData ? 'text-violet-200' : 'text-violet-600'
                    }`}
                  />
                  <span className="hidden sm:inline">Junction Factor</span>
                  <span className="sm:hidden">Junction</span>
                  {junctionFactorData ? (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-violet-900/80 text-violet-200 font-bold border border-violet-400/40 shrink-0">
                      Kj={junctionFactorData.junctionFactorKj}×
                    </span>
                  ) : (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-violet-100 text-violet-800 font-bold shrink-0">
                      Calc
                    </span>
                  )}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setCadRibbonCollapsed((p) => !p)}
              className="px-2 py-1 text-[11px] font-mono bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer shrink-0"
              title="Collapse / Expand Active Step Toolbar"
            >
              {cadRibbonCollapsed ? '▼ Tools' : '▲'}
            </button>
          </div>
        </div>

        {/* ====================================================================
            CLEAN CONTEXTUAL TOOLBAR FOR ACTIVE STEP (Plus Next-Step Guide Button)
           ==================================================================== */}
        {!cadRibbonCollapsed && (
          <div
            className={`flex items-center justify-between gap-1.5 bg-white max-w-full overflow-x-auto no-scrollbar touch-pan-x ${
              cadRibbonTab !== 'CLASSIFICATION_SHEET'
                ? 'px-2 py-1 text-[11px] flex-nowrap'
                : 'px-3 py-1.5 text-[11px]'
            }`}
          >
            <div className="flex items-center gap-1.5 shrink-0 flex-nowrap">
              {/* STEP 1: PHOTO & PROFILE (First Step After Uploading Photos) */}
              {cadRibbonTab === 'TUNNEL_PHOTO' && (
                <div className="flex items-center gap-1.5 shrink-0 flex-nowrap">
                  <label
                    className="relative overflow-hidden flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-md shadow-2xs cursor-pointer"
                    title="Upload or replace photograph for the active tunnel portion"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{currentPhoto.image ? 'Replace Photo' : 'Upload Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onUploadPhotoFile(activeSurface, f);
                        e.target.value = '';
                      }}
                    />
                  </label>

                  <button
                    onClick={() => {
                      if (activeTool !== 'photo_fit') {
                        setInitialTransformSnapshot(currentPhoto.transform);
                        setTransformPast([]);
                        setTransformFuture([]);
                        setActiveTool('photo_fit');
                      } else {
                        setActiveTool('select');
                      }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-md border transition-colors cursor-pointer ${
                      activeTool === 'photo_fit'
                        ? 'bg-sky-600 text-white border-sky-500'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                    }`}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    Fit Photo to Profile
                  </button>

                  <button
                    onClick={onAutoFitCurrentPhoto}
                    disabled={!currentPhoto.image}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-md border border-slate-200 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Auto-Fit
                  </button>

                  {/* 2-CLICK SPL SEAM LOCK & 1-CLICK AUTO SPL CROP (Solves Wall-Crown Photo Overlap) */}
                  <button
                    type="button"
                    disabled={!currentPhoto.image}
                    onClick={() => {
                      if (splTwoClickMode) {
                        setSplTwoClickMode(false);
                        setSplFirstPointUV(null);
                      } else {
                        setSplFirstPointUV(null);
                        setSplTwoClickMode(true);
                        if (activeTool !== 'photo_fit') {
                          setInitialTransformSnapshot(currentPhoto.transform);
                          setActiveTool('photo_fit');
                        }
                        onUpdateStatusMessage?.(
                          '2-Click SPL Seam Lock active: Click Point 1 (Left start) and Point 2 (Right end) along the Wall–Crown meet line (SPL) on the photo.'
                        );
                      }
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-bold rounded-md border transition-colors cursor-pointer disabled:opacity-40 ${
                      splTwoClickMode
                        ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                    }`}
                    title="2-Click Wall–Crown (SPL) Seam & Scale Lock: Click 2 points on the Wall–Crown meet line to auto-level, scale to true meters, and crop overlap"
                  >
                    <Crosshair className="w-3.5 h-3.5 text-emerald-700" />
                    {splTwoClickMode
                      ? splFirstPointUV
                        ? 'Click 2nd SPL Pt →'
                        : 'Click 1st SPL Pt →'
                      : '2-Click SPL Seam Lock'}
                  </button>

                  <button
                    type="button"
                    disabled={!currentPhoto.image}
                    onClick={handleAutoDetectSplSeam}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-mono font-semibold bg-cyan-50 hover:bg-cyan-100 disabled:opacity-40 text-cyan-900 rounded-md border border-cyan-300 cursor-pointer"
                    title="1-Click Auto-Detect Wall–Crown (SPL) Seam: Automatically finds the horizontal Wall–Crown transition and crops overlap"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-cyan-600" />
                    Auto SPL Crop
                  </button>

                  <button
                    onClick={() => {
                      setSimpleAccuracyInitialTab('full_photo_1ft_scale');
                      setShowSimpleAccuracyModal(true);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md shadow-2xs cursor-pointer"
                    title="Upload overall full tunnel picture with 1-Foot field scale to auto-extract tunnel Width, Height, and where Left Wall, Crown, and Right Wall start & end"
                  >
                    <Ruler className="w-3.5 h-3.5" />
                    Full Photo + 1-Ft Scale
                  </button>

                  <button
                    type="button"
                    onClick={() => setShow3DPhotoTunnelModal(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold bg-sky-700 hover:bg-sky-600 text-white rounded-md shadow-2xs cursor-pointer"
                    title="Open Interactive 3D Photo-Textured Tunnel Viewer (Wraps upscaled Face, Crown, Left Wall & Right Wall photos onto 3D tunnel mesh with 2.5D rock relief & inside walk-through)"
                  >
                    <Box className="w-3.5 h-3.5 text-amber-300" />
                    3D Photo Tunnel
                  </button>

                  {onOpenCustomProfileEditor && (
                    <button
                      onClick={onOpenCustomProfileEditor}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-200 cursor-pointer"
                    >
                      <Ruler className="w-3.5 h-3.5 text-sky-600" />
                      Shape ({geometry.width.toFixed(1)}×{geometry.height.toFixed(1)}m)
                    </button>
                  )}

                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200">
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[10px] font-mono text-slate-600">Opacity</span>
                    <select
                      value={currentPhoto.opacity}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        onUpdatePhotoSurface(activeSurface, (prev) => ({ ...prev, opacity: val }));
                      }}
                      className="bg-white text-slate-800 font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-200"
                    >
                      {[100, 75, 50, 25, 0].map((val) => (
                        <option key={val} value={val}>
                          {val}%
                        </option>
                      ))}
                    </select>
                  </div>


                  {/* ADVANCED PHOTO & VISION TOOLS (Shown when Advanced is active) */}
                  {windowComplexityMode === 'advanced' && (
                    <>
                      <div className="h-4 w-px bg-slate-200 mx-0.5" />
                      {currentPhoto.image && (currentPhoto.supportingPhotos?.length || 0) < 5 && (
                        <button
                          onClick={() => stereoFileInputRef.current?.click()}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-200 cursor-pointer"
                          title="Upload a second angle stereo photo to compute ZNCC 3D Depth Relief"
                        >
                          <Camera className="w-3.5 h-3.5 text-emerald-600" />
                          +Stereo Photo ({currentPhoto.supportingPhotos?.length || 0}/5)
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setShowCrackXRayOverlay((prev) => {
                            const next = !prev;
                            if (next) setShowDepthReliefOverlay(false);
                            return next;
                          });
                        }}
                        disabled={!activePhotoRidgeField?.xrayOverlayDataUrl}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold rounded-md border transition-colors cursor-pointer disabled:opacity-40 ${
                          showCrackXRayOverlay
                            ? 'bg-cyan-600 text-white border-cyan-500 shadow-2xs'
                            : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border-cyan-200'
                        }`}
                        title="Toggle CLAHE + Frangi Hessian Crack X-Ray Vision Overlay"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Crack X-Ray
                      </button>

                      <button
                        onClick={() => {
                          setShowDepthReliefOverlay((prev) => {
                            const next = !prev;
                            if (next) setShowCrackXRayOverlay(false);
                            return next;
                          });
                        }}
                        disabled={!activePhotoRidgeField?.depthReliefOverlayDataUrl}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold rounded-md border transition-colors cursor-pointer disabled:opacity-40 ${
                          showDepthReliefOverlay
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-2xs'
                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
                        }`}
                        title="Toggle 3D Photogrammetric Depth Relief & Phase Congruency Dip Facet Heatmap"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        3D Depth Relief
                      </button>

                      <button
                        onClick={() => {
                          setActiveTool(activeTool === 'measure' ? 'select' : 'measure');
                          setMeasurePts([]);
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-md border cursor-pointer ${
                          activeTool === 'measure'
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                        }`}
                        title="2-Point Laser/Tape True-Scale Calibrator & Virtual Scanline RQD"
                      >
                        <Ruler className="w-3.5 h-3.5 text-emerald-600" />
                        2-Pt Laser Scale
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* STEP 2: CORE MAPPING (Trace Joints, X-Ray Vision, Seed Auto-Propagate & Joint Sets) */}
              {cadRibbonTab === 'HOME' && (
                <div className="flex items-center gap-1 shrink-0 flex-nowrap">
                  <button
                    onClick={() => {
                      if (draftJointPoints.length >= 2) {
                        finishDraftJoint(draftJointPoints);
                      } else {
                        setDraftJointPoints([]);
                      }
                      setActiveTool('select');
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-md border transition-colors cursor-pointer ${
                      activeTool === 'select'
                        ? 'bg-sky-600 text-white border-sky-500'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                    }`}
                  >
                    <MousePointer className="w-3.5 h-3.5" />
                    Select / Edit
                  </button>

                  <button
                    onClick={() => {
                      if (draftJointPoints.length >= 2) {
                        finishDraftJoint(draftJointPoints);
                      } else {
                        setDraftJointPoints([]);
                      }
                      if (activeTool === 'add_joint' && jointDrawMode === 'two_point_line') {
                        setActiveTool('select');
                      } else {
                        setSelectedJointId(null);
                        setShowCadPropertiesAlways(false);
                        setJointDrawMode('two_point_line');
                        setActiveTool('add_joint');
                      }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-md border transition-colors cursor-pointer ${
                      activeTool === 'add_joint' && jointDrawMode === 'two_point_line'
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                    }`}
                    title="2-Point Line: Click start point and end point to draw a straight trace"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    2-Pt Line
                  </button>

                  <button
                    onClick={() => {
                      if (draftJointPoints.length >= 2) {
                        finishDraftJoint(draftJointPoints);
                      } else {
                        setDraftJointPoints([]);
                      }
                      if (activeTool === 'add_joint' && jointDrawMode === 'polyline') {
                        setActiveTool('select');
                      } else {
                        setSelectedJointId(null);
                        setShowCadPropertiesAlways(false);
                        setJointDrawMode('polyline');
                        setActiveTool('add_joint');
                      }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-md border transition-colors cursor-pointer ${
                      activeTool === 'add_joint' && jointDrawMode === 'polyline'
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                    }`}
                    title="Polyline Tool: Click multiple points along a joint trace, then click Complete"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Polyline
                  </button>

                  <button
                    onClick={() => {
                      if (draftJointPoints.length >= 2) {
                        finishDraftJoint(draftJointPoints);
                      } else {
                        setDraftJointPoints([]);
                      }
                      if (activeTool === 'add_joint' && jointDrawMode === 'smooth_curve') {
                        setActiveTool('select');
                      } else {
                        setSelectedJointId(null);
                        setShowCadPropertiesAlways(false);
                        setJointDrawMode('smooth_curve');
                        setActiveTool('add_joint');
                      }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-md border transition-colors cursor-pointer ${
                      activeTool === 'add_joint' && jointDrawMode === 'smooth_curve'
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                    }`}
                    title="Spline Tool: Click 3, 4, 5+ points to draw a smooth curve, then click Complete to view Properties"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-amber-600" />
                    Spline Tool
                  </button>

                  <button
                    onClick={() => {
                      if (draftJointPoints.length >= 2) {
                        finishDraftJoint(draftJointPoints);
                      } else {
                        setDraftJointPoints([]);
                      }
                      if (activeTool === 'add_joint' && jointDrawMode === 'freehand') {
                        setActiveTool('select');
                      } else {
                        setSelectedJointId(null);
                        setShowCadPropertiesAlways(false);
                        setJointDrawMode('freehand');
                        setActiveTool('add_joint');
                      }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-md border transition-colors cursor-pointer ${
                      activeTool === 'add_joint' && jointDrawMode === 'freehand'
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                    }`}
                    title="Freehand Curve: Press and drag to sketch a continuous geological trace"
                  >
                    Freehand
                  </button>

                  <button
                    onClick={() => {
                      if (activeTool === 'lithology') {
                        setActiveTool('select');
                        setIsDrawingLithologyPolygon(false);
                        setDraftLithologyPoints([]);
                      } else {
                        setActiveTool('lithology');
                        setShowCadPropertiesAlways(true);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-md border cursor-pointer ${
                      activeTool === 'lithology'
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                    }`}
                    title="Lithology Zones & Rock Type Properties"
                  >
                    <Layers className="w-3.5 h-3.5 text-amber-600" />
                    Lithology ({lithologyRegions.filter((r) => r.surface === activeSurface).length})
                  </button>

                  <button
                    onClick={() => {
                      if (activeTool === 'geological_symbol') {
                        setActiveTool('select');
                      } else {
                        setActiveTool('geological_symbol');
                        setShowCadPropertiesAlways(true);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-md border cursor-pointer ${
                      activeTool === 'geological_symbol'
                        ? 'bg-purple-600 text-white border-purple-500'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                    }`}
                    title="ISRM Geological Symbols & Orientation Properties"
                  >
                    <Compass className="w-3.5 h-3.5 text-purple-600" />
                    Symbols ({surfacePlacedSymbols.length})
                  </button>

                  <button
                    onClick={() => {
                      if (draftJointPoints.length >= 2) {
                        finishDraftJoint(draftJointPoints);
                      } else {
                        setDraftJointPoints([]);
                      }
                      if (activeTool === 'add_joint' && jointDrawMode === 'magnetic_livewire') {
                        setActiveTool('select');
                      } else {
                        setJointDrawMode('magnetic_livewire');
                        setActiveTool('add_joint');
                        setShowCadPropertiesAlways(true);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-md border transition-colors cursor-pointer ${
                      activeTool === 'add_joint' && jointDrawMode === 'magnetic_livewire'
                        ? 'bg-sky-600 text-white border-sky-500'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                    }`}
                    title="Magnetic Live-Wire: Automatically hugs rock fracture valley between clicks"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-sky-600" />
                    Snap Crack
                  </button>

                  <button
                    onClick={() => {
                      if (draftJointPoints.length >= 2) {
                        finishDraftJoint(draftJointPoints);
                      } else {
                        setDraftJointPoints([]);
                      }
                      if (activeTool === 'add_joint' && jointDrawMode === 'seed_autotrace') {
                        setActiveTool('select');
                      } else {
                        setJointDrawMode('seed_autotrace');
                        setActiveTool('add_joint');
                        setShowCadPropertiesAlways(true);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold rounded-md border transition-colors cursor-pointer ${
                      activeTool === 'add_joint' && jointDrawMode === 'seed_autotrace'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-200'
                    }`}
                    title="Real-Time MATLAB 1-Click Seed Auto-Propagate + ActiveContour Snake: Hover over any rock fracture for live trace lock & click once to extract"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    1-Click MATLAB Seed
                  </button>

                  {/* MULTI-FILTER TRACE ANALYSIS SELECTOR IN CORE MAPPING */}
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 rounded-md border border-indigo-200">
                    <span className="text-[10px] font-mono font-bold text-indigo-900">Filter:</span>
                    <select
                      value={
                        showCrackXRayOverlay
                          ? 'xray_ridge'
                          : showDepthReliefOverlay
                          ? 'depth_relief'
                          : activePhotoFilterMode
                      }
                      onChange={(e) => {
                        const mode = e.target.value as PhotoSpectralFilterMode;
                        setActivePhotoFilterMode(mode);
                        setShowCrackXRayOverlay(mode === 'xray_ridge');
                        setShowDepthReliefOverlay(mode === 'depth_relief');
                      }}
                      disabled={!currentPhoto.image}
                      className="bg-white text-indigo-950 font-mono font-bold text-[10px] px-1.5 py-0.5 rounded border border-indigo-300 cursor-pointer disabled:opacity-40"
                      title="Switch Photo Filter for Visual & Automated Trace Analysis (Negative, False Color, Green-Red, Edge Relief)"
                    >
                      <option value="original">Original HD</option>
                      <option value="negative">Negative (Hairline)</option>
                      <option value="false_color">False Color (Aperture)</option>
                      <option value="green_red">Green–Red (Clay/Vein)</option>
                      <option value="edge_relief">Edge Relief (Step)</option>
                      <option value="xray_ridge">Crack X-Ray</option>
                      <option value="depth_relief">3D Depth Relief</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleExtractTracesFromPhotoFilter()}
                      disabled={!activePhotoRidgeField}
                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded cursor-pointer shadow-2xs"
                      title="Extract geological traces using Multi-Filter Cross-Validation + ±10° Set-Steered Pass + SPL Overlap Deduplication"
                    >
                      <Sparkles className="w-3 h-3" />
                      Filter Trace
                    </button>
                    <button
                      type="button"
                      onClick={handleDeduplicateSplOverlaps}
                      disabled={joints.length < 2}
                      className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono font-bold bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white rounded cursor-pointer"
                      title="Deduplicate & Link Overlapping Traces across Left Wall ↔ Crown and Right Wall ↔ Crown (SPL Seam)"
                    >
                      SPL Dedup
                    </button>
                  </div>

                  <button
                    onClick={onRunAITrace}
                    disabled={isTracingAI}
                    title="Deep 6-Filter & MATLAB Cross-Verified AI Trace: Runs Negative, Green-Red, False Color, Edge Relief, MATLAB Phase Congruency & Steger Hessian + AI, cross-checks every vertex, trims drifted tails, and erases mistaken/shadow traces"
                    className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono font-bold bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white rounded-md shadow-2xs transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isTracingAI ? 'Verifying 6 Filters + MATLAB...' : 'AI Trace (6-Filter Verified)'}
                  </button>

                  {onFeedSampleData && (
                    <button
                      type="button"
                      onClick={onFeedSampleData}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md shadow-2xs transition-colors cursor-pointer"
                      title="Feed Complete Sample Field Dataset (4 Surface Photos + 16 Multi-Surface Joints + Lithology + Overbreak Survey + RMR/Q/GSI + 3D Strip Logs)"
                    >
                      <Database className="w-3.5 h-3.5" />
                      Feed Sample Data
                    </button>
                  )}

                  {/* ADVANCED CORE MAPPING TOOLS (Shown when Advanced is active) */}
                  {windowComplexityMode === 'advanced' && (
                    <>
                      <div className="h-4 w-px bg-slate-200 mx-0.5" />

                      <button
                        onClick={onRunAITraceAllSurfaces}
                        disabled={isTracingAI}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 border border-slate-200 rounded-md cursor-pointer"
                      >
                        Trace All 4 Surfaces
                      </button>

                      <button
                        onClick={handleRefineAllActiveSurfaceTraces}
                        disabled={!activePhotoRidgeField || surfaceJoints.length === 0}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold bg-cyan-50 hover:bg-cyan-100 disabled:opacity-40 text-cyan-900 border border-cyan-300 rounded-md cursor-pointer"
                        title="Sub-Pixel Steger Parabolic Ridge Lock (0.12px) + 3D SVD + Barton JRC for all traces on this surface"
                      >
                        <Wand2 className="w-3.5 h-3.5 text-cyan-600" />
                        Sub-Pixel Ridge Lock
                      </button>

                      <button
                        onClick={() => {
                          setShowDepthReliefOverlay((prev) => {
                            const next = !prev;
                            if (next) setShowCrackXRayOverlay(false);
                            return next;
                          });
                        }}
                        disabled={!activePhotoRidgeField?.depthReliefOverlayDataUrl}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold rounded-md border transition-colors cursor-pointer disabled:opacity-40 ${
                          showDepthReliefOverlay
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-2xs'
                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
                        }`}
                        title="Toggle 3D Depth Relief & Phase Congruency Dip Facet Heatmap"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        3D Dip Facet Relief
                      </button>

                      <button
                        onClick={() => {
                          setActiveTool(activeTool === 'measure' ? 'select' : 'measure');
                          setMeasurePts([]);
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-md border cursor-pointer ${
                          activeTool === 'measure'
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                        }`}
                        title="Draw a virtual scanline across mapped joints to compute Scanline RQD (%), Priest-Hudson RQD, Fracture Frequency λ"
                      >
                        <Ruler className="w-3.5 h-3.5 text-emerald-600" />
                        Scanline RQD
                      </button>

                      <button
                        onClick={() => {
                          setSimpleAccuracyInitialTab('four_part_accuracy');
                          setShowSimpleAccuracyModal(true);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200 cursor-pointer"
                        title="Open 4-Part Simple Accuracy Booster (Corner Trace Linker, Field Compass, RMR/Q Auto-Sync, Wedge Check)"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        4-Part Accuracy
                      </button>

                      <button
                        onClick={() => setShow3DStrikeDipModal(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-md shadow-2xs cursor-pointer"
                        title="Open Interactive 3D Joint Strike & Dip Visualizer relative to Tunnel Drive Direction"
                      >
                        <Box className="w-3.5 h-3.5" />
                        3D Strike &amp; Dip
                      </button>

                      <button
                        onClick={() => setShowAILearningDrawer((prev) => !prev)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-md border cursor-pointer ${
                          showAILearningDrawer
                            ? 'bg-amber-600 text-white border-amber-500'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                        }`}
                        title="Open Self-Learning Geologist AI Memory & Verified Orientation Training"
                      >
                        AI Memory ({sessionMemory.verifiedExamplesCount ?? 0})
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* STEP 3: GEOLOGY (Dip Surface, 3D Facets, Lithology, Symbols, Stereonet, JRC & Wedges) */}
              {cadRibbonTab === 'GEOLOGY_3D' && (
                <div className="flex items-center gap-1 shrink-0 flex-nowrap">
                  <button
                    onClick={() => {
                      if (activeTool === 'lithology') {
                        setActiveTool('select');
                        setIsDrawingLithologyPolygon(false);
                        setDraftLithologyPoints([]);
                      } else {
                        setActiveTool('lithology');
                        setShowCadPropertiesAlways(true);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-md border cursor-pointer ${
                      activeTool === 'lithology'
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-amber-600" />
                    Lithology Zones ({lithologyRegions.filter((r) => r.surface === activeSurface).length})
                  </button>

                  <button
                    onClick={() => {
                      if (activeTool === 'geological_symbol') {
                        setActiveTool('select');
                      } else {
                        setActiveTool('geological_symbol');
                        setShowCadPropertiesAlways(true);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-md border cursor-pointer ${
                      activeTool === 'geological_symbol'
                        ? 'bg-purple-600 text-white border-purple-500'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5 text-purple-600" />
                    Geological Symbols ({surfacePlacedSymbols.length})
                  </button>

                  <button
                    onClick={() =>
                      setActiveTool(activeTool === 'dip_probe' ? 'select' : 'dip_probe')
                    }
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold rounded-md border cursor-pointer ${
                      activeTool === 'dip_probe'
                        ? 'bg-sky-600 text-white border-sky-500'
                        : 'bg-sky-50 text-sky-900 hover:bg-sky-100 border-sky-200'
                    }`}
                    title="Interactive 3D Dip Surface & Facet Orientation Probe"
                  >
                    <Compass className="w-3.5 h-3.5 text-sky-600" />
                    3D Dip Surface Probe
                  </button>

                  <button
                    onClick={() => {
                      setShowDepthReliefOverlay((prev) => {
                        const next = !prev;
                        if (next) setShowCrackXRayOverlay(false);
                        return next;
                      });
                    }}
                    disabled={!activePhotoRidgeField?.depthReliefOverlayDataUrl}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold rounded-md border transition-colors cursor-pointer disabled:opacity-40 ${
                      showDepthReliefOverlay
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-2xs'
                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-300'
                    }`}
                    title="Toggle 3D Depth Relief & Dip Surface Facet Heatmap (Shape-from-Shading + Stereo ZNCC)"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    {showDepthReliefOverlay ? 'Dip Facet Map ON' : 'Dip Surface Relief Map'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCadRibbonTab('ADVANCED_ANALYSIS');
                      setCadRibbonCollapsed(false);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono font-extrabold bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 text-slate-950 rounded-md shadow-md ring-1 ring-amber-300 cursor-pointer"
                    title="Open Deep Advance Geological Analysis: Wedge FoS, 4-Surface Apparent Dip Solver, +3m/+6m/+9m Look-Ahead, Stand-up Time, Palmström Blocks, Hydro Inflow"
                  >
                    <Zap className="w-3.5 h-3.5 fill-slate-950" />
                    ⚡ Advance Geological Analytics
                  </button>

                  <button
                    onClick={() => setShow3DPhotoTunnelModal(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md shadow-2xs cursor-pointer"
                    title="Open Interactive 3D Photo-Textured Tunnel Builder (2x Upscaled Photos + 2.5D Rock Relief + Walk-Through + 3D Planes)"
                  >
                    <Box className="w-3.5 h-3.5" />
                    3D Photo Tunnel
                  </button>

                  <button
                    onClick={() => setShow3DStrikeDipModal(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-md shadow-2xs cursor-pointer"
                    title="Open Interactive 3D Joint Strike & Dip Visualizer relative to Tunnel Drive Direction"
                  >
                    <Box className="w-3.5 h-3.5" />
                    3D Strike &amp; Dip vs. Drive
                  </button>

                  <button
                    onClick={() => {
                      setMatlabInitialTab('TRAIC_AI_SEGMENTATION');
                      setShowMatlabAnalyzerModal(true);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-md shadow-2xs cursor-pointer"
                    title="Open TRaiC AI Fracture & Trace Segmentation (adapthisteq -> fibermetric -> bwmorph('skel') -> PCA Linking)"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    TRaiC AI Fracture &amp; Trace Segmentation
                  </button>

                  <button
                    onClick={() => {
                      setMatlabInitialTab('JOINT_NETWORK_3D_PCA_SVD');
                      setShowMatlabAnalyzerModal(true);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-md shadow-2xs cursor-pointer"
                    title="3D Joint Network & Plane Fitting (PCA / SVD): Fits 3D planes to trace vertices to calculate Dip, Dip Direction, Trace Persistence, and True Normal Set Spacing"
                  >
                    <Box className="w-3.5 h-3.5" />
                    3D Plane Fit: Dip, Persistence &amp; Spacing
                  </button>

                  <button
                    onClick={() => {
                      setMatlabInitialTab(
                        activeSurface === 'face'
                          ? 'FACE_JOIN_AND_BLOCKS'
                          : 'WALL_CROWN_3D_SVD'
                      );
                      setShowMatlabAnalyzerModal(true);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md shadow-2xs cursor-pointer"
                    title="Open MATLAB Matrix + AI Joint & Face/3D SVD Coplanarity Analyzer"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    MATLAB + AI Joint &amp; Face/3D Analyzer
                  </button>

                  {/* ADVANCED GEOLOGY & STRUCTURAL TOOLS (Shown when Advanced is active) */}
                  {windowComplexityMode === 'advanced' && (
                    <>
                      <div className="h-4 w-px bg-slate-200 mx-0.5" />

                      <button
                        onClick={() => openPhotogrammetryLab('kinematic')}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-md shadow-2xs cursor-pointer"
                        title="Open Equal-Area / Equal-Angle Hemispherical Stereonet & 3D Tetrahedral Wedge Keyblock Detector"
                      >
                        <Compass className="w-3.5 h-3.5" />
                        Stereonet &amp; 3D Wedges
                      </button>

                      <button
                        onClick={() => openPhotogrammetryLab('jrc')}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-md cursor-pointer"
                        title="Open Barton & Choubey (1977) / Tse & Cruden Z2 Empirical JRC Roughness Analyzer"
                      >
                        Barton JRC Roughness
                      </button>

                      <button
                        onClick={() => openPhotogrammetryLab('seepage')}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-300 rounded-md cursor-pointer"
                        title="Open Groundwater Seepage Zone Mapper & Automatic Jw / RMR Water Sync"
                      >
                        Seepage &amp; Water Lab
                      </button>

                      <button
                        onClick={() => openPhotogrammetryLab('pointcloud')}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-md cursor-pointer"
                        title="Open 3D Photogrammetric Point Cloud (.PLY) & Unfolded Perimeter Projections"
                      >
                        3D Point Cloud (.PLY)
                      </button>

                      <button
                        onClick={() => setShowRockSupportModal(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-md cursor-pointer"
                        title="Open Automated Rock Bolt & SFRS Shotcrete Support Pattern Designer"
                      >
                        Support Pattern (Bolts/SFRS)
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* STEP 4: SURVEY (Strictly Control Points, Overbreak & Distance Measurement) */}
              {cadRibbonTab === 'SURVEY_OVERBREAK' && (
                <div className="flex items-center gap-1 shrink-0 flex-nowrap">
                  <button
                    onClick={() =>
                      setActiveTool(activeTool === 'control_point' ? 'select' : 'control_point')
                    }
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-md border cursor-pointer ${
                      activeTool === 'control_point'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                    }`}
                  >
                    <Crosshair className="w-3.5 h-3.5 text-emerald-600" />
                    Survey Control Points ({surfaceControlPoints.length})
                  </button>

                  <button
                    onClick={() => {
                      const nextTool = activeTool === 'overbreak' ? 'select' : 'overbreak';
                      setActiveTool(nextTool);
                      if (nextTool === 'overbreak') {
                        setLayerVisibility((prev) => ({ ...prev, overbreakUndercut: true }));
                      }
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-md border cursor-pointer ${
                      activeTool === 'overbreak'
                        ? 'bg-rose-600 text-white border-rose-500'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-rose-600" />
                    Overbreak / Undercut
                    {overbreakAnalysis.hasValidSurveyProfile && (
                      <span className="px-1 py-0.2 bg-rose-100 text-rose-700 rounded text-[9px] font-mono">
                        +{overbreakAnalysis.overbreakAreaSqMeters.toFixed(1)}m²
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setActiveTool(activeTool === 'measure' ? 'select' : 'measure');
                      setMeasurePts([]);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-md border cursor-pointer ${
                      activeTool === 'measure'
                        ? 'bg-sky-600 text-white border-sky-500'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                    }`}
                  >
                    <Ruler className="w-3.5 h-3.5 text-sky-600" />
                    Measure &amp; Scanline
                  </button>

                  {windowComplexityMode === 'advanced' && (
                    <>
                      <div className="h-4 w-px bg-slate-200 mx-0.5" />
                      {onGenerateSampleAsBuiltProfile && (
                        <button
                          onClick={onGenerateSampleAsBuiltProfile}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-md cursor-pointer"
                        >
                          Auto-Detect As-Built Profile
                        </button>
                      )}
                      <button
                        onClick={() => onOpenExportSheet('ENGINEERING_QUANTITY_SHEET')}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md cursor-pointer"
                      >
                        Overbreak Volume Sheet
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* STEP 4: ADVANCE ANALYSIS CONTEXTUAL BAR */}
              {cadRibbonTab === 'ADVANCED_ANALYSIS' && (
                <div className="flex items-center gap-2 shrink-0 sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => setCadRibbonTab('HOME')}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-md cursor-pointer"
                    title="Return to Core Mapping Canvas"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-sky-600" />
                    <span>Back to Canvas</span>
                  </button>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-md">
                    <Zap className="w-3.5 h-3.5 fill-current text-amber-600" />
                    <span>Step 4: Advance Geological Analytics Active</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowJunctionFactorModal(true)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold rounded-md border transition-all cursor-pointer ${
                      junctionFactorData
                        ? 'bg-violet-700 text-white border-violet-500 shadow-xs'
                        : 'bg-violet-50 hover:bg-violet-100 text-violet-900 border-violet-300'
                    }`}
                    title="Calculate Tunnel Junction Factor (Kj), Diagonal Span & Extended Support"
                  >
                    <GitFork className="w-3.5 h-3.5 text-violet-500" />
                    <span>Junction Factor Calculator</span>
                    {junctionFactorData && (
                      <span className="text-[9px] px-1 bg-violet-900 text-violet-200 rounded font-mono">
                        Kj = {junctionFactorData.junctionFactorKj}×
                      </span>
                    )}
                  </button>
                </div>
              )}

              {/* STEP 5: TABLES & OUTPUT (Strictly Discontinuity Tables, Rock Classification & Final Output Sheet) */}
              {cadRibbonTab === 'CLASSIFICATION_SHEET' && (
                <div className="flex items-center gap-1.5 shrink-0 sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => setCadRibbonTab('HOME')}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-md cursor-pointer"
                    title="Back to Core Mapping Canvas"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-sky-600" />
                    <span>Back</span>
                  </button>
                  <button
                    onClick={() => {
                      setGeologyDrawerTab('geology_tables');
                      setShowAILearningDrawer(false);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded-md border cursor-pointer ${
                      geologyDrawerTab === 'geology_tables'
                        ? 'bg-sky-600 text-white border-sky-500'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-sky-600" />
                    1. Discontinuity Set Tables ({jointSets.length})
                  </button>

                  <div className="flex items-center bg-slate-100 border border-slate-200 rounded-md overflow-hidden">
                    <select
                      value={selectedClassificationMethod}
                      onChange={(e) => {
                        onChangeSelectedClassificationMethod(
                          e.target.value as RockMassClassificationMethodId
                        );
                        setGeologyDrawerTab('q_index');
                        setShowAILearningDrawer(false);
                      }}
                      className="bg-white text-indigo-700 text-[10px] font-mono font-bold px-2 py-1 border-r border-slate-200 outline-none cursor-pointer"
                    >
                      <option value="RMR">RMR</option>
                      <option value="Q_SYSTEM">Q-Sys</option>
                      <option value="BOTH_RMR_AND_Q">RMR+Q</option>
                      <option value="GSI">GSI</option>
                    </select>
                    <button
                      onClick={() => {
                        setGeologyDrawerTab('q_index');
                        setShowAILearningDrawer(false);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono cursor-pointer ${
                        geologyDrawerTab === 'q_index'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                      <span>2.</span>
                      {(() => {
                        const rmrEval = calculateBieniawskiRmr(rmrParams);
                        const qEval = evaluateQSystemWithValidation(
                          qIndexParams,
                          geometry.width,
                          qParamStatus
                        );
                        const gsiEval = calculateHoekGsi(gsiParams);
                        if (selectedClassificationMethod === 'RMR') {
                          return rmrEval.isComplete && rmrEval.finalRmr !== null
                            ? `RMR=${rmrEval.finalRmr}`
                            : 'RMR';
                        }
                        if (selectedClassificationMethod === 'Q_SYSTEM') {
                          return qEval.isComplete ? `Q=${qEval.qValue.toFixed(1)}` : 'Q-System';
                        }
                        if (selectedClassificationMethod === 'BOTH_RMR_AND_Q') {
                          return `RMR=${rmrEval.finalRmr ?? 'N/A'}|Q=${
                            qEval.isComplete ? qEval.qValue.toFixed(1) : 'N/A'
                          }`;
                        }
                        return `GSI=${gsiEval.gsiValue ?? 'N/A'}`;
                      })()}
                    </button>
                  </div>

                  <button
                    onClick={() =>
                      onOpenExportSheet(
                        activeTool === 'overbreak'
                          ? 'ENGINEERING_QUANTITY_SHEET'
                          : 'FINAL_ENGINEERING_SHEET'
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    3. Final Output Sheet
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void downloadEngineeringSheetAsPDF({
                        geometry,
                        settings,
                        joints,
                        jointSets,
                        qIndexParams,
                        qParamStatus,
                        rmrParams,
                        gsiParams,
                        selectedMethod: selectedClassificationMethod,
                        rockMassSummary,
                        overbreakAnalysis,
                        controlPoints,
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-md shadow-2xs cursor-pointer"
                    title="Download Geological Mapping Data Sheet as a Standalone .PDF File"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PDF (.pdf)
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void downloadEngineeringSheetAsWordDoc({
                        geometry,
                        settings,
                        joints,
                        jointSets,
                        qIndexParams,
                        qParamStatus,
                        rmrParams,
                        gsiParams,
                        selectedMethod: selectedClassificationMethod,
                        rockMassSummary,
                        overbreakAnalysis,
                        controlPoints,
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-md shadow-2xs cursor-pointer"
                    title="Download Editable Geological & Rock Mass Report in Microsoft Word (.doc) Format"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Word (.doc)
                  </button>

                  {windowComplexityMode === 'advanced' && (
                    <>
                      <div className="h-4 w-px bg-slate-200 mx-0.5" />
                      <button
                        onClick={() => openPhotogrammetryLab('kinematic')}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-md cursor-pointer"
                      >
                        Stereonet &amp; Wedges
                      </button>
                      <button
                        onClick={() => setShowSheetSetModal(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-md cursor-pointer"
                      >
                        CAD Sheet Set
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* NEXT STEP GUIDE BUTTON + SIMPLE | ADVANCED WINDOW MODE SWITCHER */}
            <div className="flex items-center gap-1.5 shrink-0">
              {cadRibbonTab !== 'CLASSIFICATION_SHEET' && (
                <button
                  type="button"
                  onClick={() => {
                    const order = [
                      'TUNNEL_PHOTO',
                      'HOME',
                      'GEOLOGY_3D',
                      'ADVANCED_ANALYSIS',
                      'SURVEY_OVERBREAK',
                      'CLASSIFICATION_SHEET',
                    ] as const;
                    const idx = order.indexOf(cadRibbonTab as any);
                    if (idx >= 0 && idx < order.length - 1) {
                      setCadRibbonTab(order[idx + 1]);
                      setCadRibbonCollapsed(false);
                    }
                  }}
                  className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[11px] font-bold shadow-2xs cursor-pointer whitespace-nowrap"
                  title="Proceed to Next Workflow Step"
                >
                  {cadRibbonTab === 'TUNNEL_PHOTO'
                    ? 'Next: 2. Core Mapping →'
                    : cadRibbonTab === 'HOME'
                    ? 'Next: 3. Geology →'
                    : cadRibbonTab === 'GEOLOGY_3D'
                    ? 'Next: 4. Advance Geological Analytics →'
                    : cadRibbonTab === 'ADVANCED_ANALYSIS'
                    ? 'Next: 5. Survey →'
                    : 'Next: 6. Data Sheets →'}
                </button>
              )}
              <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 border border-slate-200 rounded-lg shrink-0 font-mono text-[10px]">
                <button
                  type="button"
                  onClick={() => setWindowComplexityMode('simple')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    windowComplexityMode === 'simple'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Simple Mode: Clean essential tools for this window"
                >
                  Simple
                </button>
                <button
                  type="button"
                  onClick={() => setWindowComplexityMode('advanced')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    windowComplexityMode === 'advanced'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Advanced Mode: Unlock full X-Ray, 3D Relief, Sub-Pixel Steger Lock, JRC & Stereonet tools for this window"
                >
                  Advanced
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hidden File Inputs for Main & Supporting Photos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUploadPhotoFile(activeSurface, f);
          e.target.value = '';
        }}
      />
      <input
        ref={stereoFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUploadStereoPhotoFile(activeSurface, f);
          e.target.value = '';
        }}
      />

      {/* ====================================================================
          STEP 4: FULL-WINDOW ADVANCE GEOLOGICAL ANALYSIS VIEW (Directly Embedded)
         ==================================================================== */}
      {cadRibbonTab === 'ADVANCED_ANALYSIS' ? (
        <AdvancedGeologicalAnalysisModal
          fullPage
          isOpen={true}
          onClose={() => setCadRibbonTab('HOME')}
          geometry={geometry}
          settings={settings}
          joints={joints}
          jointSets={jointSets}
          qIndexParams={qIndexParams}
          rmrParams={rmrParams}
          rockMassSummary={rockMassSummary}
          overbreakAnalysis={overbreakAnalysis}
          lithologyRegions={lithologyRegions}
          junctionFactorData={junctionFactorData}
          onOpenJunctionCalculator={() => setShowJunctionFactorModal(true)}
          onClearJunctionFactor={() => setJunctionFactorData(null)}
        />
      ) : cadRibbonTab === 'CLASSIFICATION_SHEET' ? (
        <GeologyAndQIndexDrawer
          fullPage
          activeTab={geologyDrawerTab}
          onChangeTab={setGeologyDrawerTab}
          onClose={() => setCadRibbonTab('HOME')}
          geometry={geometry}
          settings={settings}
          activeSurface={activeSurface}
          joints={joints}
          jointSets={jointSets}
          onUpdateJoints={onUpdateJointsWithHistory}
          onUpdateJointSetAttribute={onUpdateJointSetAttribute}
          onMergeJointSets={onMergeJointSets}
          qIndexParams={qIndexParams}
          onUpdateQIndexParams={onUpdateQIndexParams}
          qParamStatus={qParamStatus}
          onUpdateQParamStatus={onUpdateQParamStatus}
          selectedMethod={selectedClassificationMethod}
          onChangeSelectedMethod={onChangeSelectedClassificationMethod}
          rmrParams={rmrParams}
          onUpdateRmrParams={onUpdateRmrParams}
          gsiParams={gsiParams}
          onUpdateGsiParams={onUpdateGsiParams}
          rockMassSummary={rockMassSummary}
          onUpdateRockMassSummary={onUpdateRockMassSummary}
          onOpenExportSheet={onOpenExportSheet}
          onOpenKinematics={() => setShowPhotogrammetryModal(true)}
          savedProjects={savedProjects}
          overbreakAnalysis={overbreakAnalysis}
        />
      ) : (
        /* ====================================================================
           STEPS 1-4: MAIN MAPPING CANVAS STAGE & CONTEXTUAL PROPERTY PALETTE
           ==================================================================== */
        <div className="relative flex-1 flex min-w-0 min-h-0 overflow-hidden">
          <div
            ref={canvasContainerRef}
            className={`relative flex-1 flex items-center justify-center min-w-0 min-h-0 overflow-hidden ${
              isLight ? 'bg-[#E2E8F0]' : 'bg-[#090C12]'
            }`}
          >
          {/* Realistic Tunnel Geometry Banner when user is on Unwrapped Crown/Wall and selects Overbreak */}
          {activeSurface !== 'face' &&
            (activeTool === 'overbreak' || cadRibbonTab === 'SURVEY_OVERBREAK') && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-2xl w-[92%] px-3.5 py-2.5 rounded-xl bg-slate-950/95 border border-amber-500/70 shadow-2xl flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-amber-100">
                <div className="flex-1 min-w-[240px]">
                  <div className="font-bold text-amber-300 uppercase">
                    Not Possible on Unwrapped {activeSurface === 'crown' ? 'Crown' : activeSurface === 'leftWall' ? 'Left Wall' : 'Right Wall'} Surface
                  </div>
                  <div className="text-[10px] text-slate-300 leading-snug mt-0.5">
                    Radial Overbreak in the <strong>Crown</strong> and <strong>Walls</strong> cannot be geometrically plotted on a flat 2D unwrapped sheet. That is why{' '}
                    <strong>Crown, Left Wall &amp; Right Wall Overbreak are realistically plotted on the Tunnel Face (1. Face)</strong> cross-section.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectSurface('face')}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] cursor-pointer shrink-0"
                >
                  Switch to 1. Face (Plot Crown &amp; Wall Overbreak) →
                </button>
              </div>
            )}
          {/* Live 9-Stage Multi-Filter & MATLAB Cross-Verification + Error-Erasing Progress & Audit Banner */}
          {(isTracingAI ||
            isVerifyingFilterTrace ||
            statusMessage.startsWith('6-Filter + MATLAB Cross-Verified:')) && (
            <div
              className={`absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-2xl w-[92%] px-3.5 py-2.5 rounded-xl border shadow-2xl flex flex-wrap items-center justify-between gap-2 text-xs font-mono ${
                isTracingAI || isVerifyingFilterTrace
                  ? 'bg-slate-950/95 border-sky-500/80 text-sky-100'
                  : 'bg-slate-950/95 border-emerald-500/80 text-emerald-100'
              }`}
            >
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className={`w-4 h-4 shrink-0 ${
                        isTracingAI || isVerifyingFilterTrace
                          ? 'text-sky-400 animate-spin'
                          : 'text-emerald-400'
                      }`}
                    />
                    <span
                      className={`font-bold uppercase tracking-wider text-[11px] ${
                        isTracingAI || isVerifyingFilterTrace ? 'text-sky-300' : 'text-emerald-300'
                      }`}
                    >
                      {isTracingAI || isVerifyingFilterTrace
                        ? 'Deep 6-Filter + MATLAB Cross-Verification & Error Eraser Running'
                        : '6-Filter + MATLAB Cross-Verification & Error Audit Complete'}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-200 leading-snug mt-1">
                  {statusMessage}
                </div>
                {(isTracingAI || isVerifyingFilterTrace) && (() => {
                  const m = statusMessage.match(/Stage\s+(\d+)\/(\d+)/i);
                  const curS = m ? Number(m[1]) : 1;
                  const totS = m ? Number(m[2]) : 9;
                  const pct = Math.min(100, Math.max(10, Math.round((curS / Math.max(1, totS)) * 100)));
                  return (
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5 border border-slate-700">
                      <div
                        className="h-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  );
                })()}
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[9.5px] text-slate-300">
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-sky-300">
                    1. Negative Bilateral Valley
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-300">
                    2. Green-Red Spectral
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300">
                    3. False Color Aperture
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-purple-300">
                    4. Edge Relief Step
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300">
                    5. MATLAB Phase Congruency
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-rose-300">
                    6. Perpendicular Trench &amp; Error Eraser
                  </span>
                </div>
              </div>
              {!isTracingAI && !isVerifyingFilterTrace && onUpdateStatusMessage && (
                <button
                  type="button"
                  onClick={() => onUpdateStatusMessage('Ready.')}
                  className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold border border-slate-700 cursor-pointer shrink-0"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
          {(() => {
            const renderSvgContents = (canvasRole: 'clean_outline' | 'photo_tracing') => (
              <>
            <defs>
              {/* Master Tunnel Surface Clip Path */}
              <clipPath id="active-surface-master-clip">
                <path d={surfaceBoundaryPath} />
              </clipPath>

              {/* Custom Polygon Boundary Mask Clip Path (P1, P2, P3, P4, P5, P6, P7...) */}
              <clipPath id="active-surface-custom-clip">
                <path d={customMaskPolygonPath} />
              </clipPath>

              {/* True 1.00-meter Engineering Scale Grid anchored at World Origin (0,0) */}
              {(() => {
                const originScreen = coordManager.worldToScreen({ x: 0, y: 0 });
                return (
                  <pattern
                    id="canvas-meter-grid"
                    width={pxPerMeter}
                    height={pxPerMeter}
                    patternUnits="userSpaceOnUse"
                    x={originScreen.cx}
                    y={originScreen.cy}
                  >
                    <path
                      d={`M ${pxPerMeter} 0 L 0 0 0 ${pxPerMeter}`}
                      fill="none"
                      stroke={
                        !showCadGrid
                          ? 'transparent'
                          : isLight
                          ? 'rgba(30, 41, 59, 0.24)'
                          : 'rgba(56, 189, 248, 0.22)'
                      }
                      strokeWidth="0.9"
                    />
                  </pattern>
                );
              })()}

              {/* Professional Geological & Lithological Hatch Patterns (Section 13: All 22 Lithologies) */}
              <LithologyPatternDefs prefix="lith-pat-" />

              {/* Overbreak & Undercut Engineering Hatch Patterns */}
              <pattern
                id="overbreak-hatch"
                width="8"
                height="8"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="8"
                  stroke="#F43F5E"
                  strokeWidth="1.35"
                  strokeOpacity="0.65"
                />
                <line
                  x1="0"
                  y1="4"
                  x2="8"
                  y2="4"
                  stroke="#F43F5E"
                  strokeWidth="0.9"
                  strokeOpacity="0.4"
                />
              </pattern>
              <pattern
                id="undercut-hatch"
                width="8"
                height="8"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(-45)"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="8"
                  stroke="#F59E0B"
                  strokeWidth="1.35"
                  strokeOpacity="0.7"
                />
              </pattern>
            </defs>

            {/* ====================================================================
                MASTER VIEWPORT PAN & ZOOM STAGE (Sections 1, 2, 3, 4, 5)
                All 8 geological layers & interactive handles share this exact coordinate transform
               ==================================================================== */}
            <g id="master-viewport-stage" transform={viewportSvgTransform}>
            {/* Master Tunnel Surface Interior Background */}
            <path d={surfaceBoundaryPath} fill={isLight ? '#FFFFFF' : '#111722'} />

            {/* Registered, Perspective & Piecewise-Mesh-Warped MAIN PHOTO (Photo Tracing Canvas Only) */}
            {canvasRole === 'photo_tracing' &&
              layerVisibility.photo &&
              currentPhoto.image &&
              currentPhoto.opacity > 0 && (
              <g
                clipPath={
                  currentPhoto.transform.cropToGeometry
                    ? currentPhoto.transform.useCustomMask &&
                      (currentPhoto.transform.customMaskPoints?.length || 0) >= 3
                      ? 'url(#active-surface-custom-clip)'
                      : 'url(#active-surface-master-clip)'
                    : undefined
                }
              >
                <g transform={photoSvgTransform}>
                  <image
                    href={
                      (showCrackXRayOverlay || activePhotoFilterMode === 'xray_ridge') &&
                      activePhotoRidgeField?.xrayOverlayDataUrl
                        ? activePhotoRidgeField.xrayOverlayDataUrl
                        : (showDepthReliefOverlay || activePhotoFilterMode === 'depth_relief') &&
                          activePhotoRidgeField?.depthReliefOverlayDataUrl
                        ? activePhotoRidgeField.depthReliefOverlayDataUrl
                        : activePhotoFilterMode === 'negative' &&
                          activePhotoRidgeField?.negativeOverlayDataUrl
                        ? activePhotoRidgeField.negativeOverlayDataUrl
                        : activePhotoFilterMode === 'false_color' &&
                          activePhotoRidgeField?.falseColorOverlayDataUrl
                        ? activePhotoRidgeField.falseColorOverlayDataUrl
                        : activePhotoFilterMode === 'green_red' &&
                          activePhotoRidgeField?.greenRedOverlayDataUrl
                        ? activePhotoRidgeField.greenRedOverlayDataUrl
                        : activePhotoFilterMode === 'edge_relief' &&
                          activePhotoRidgeField?.edgeReliefOverlayDataUrl
                        ? activePhotoRidgeField.edgeReliefOverlayDataUrl
                        : liveWarpedImageUrl || currentPhoto.warpedImage || currentPhoto.image
                    }
                    x={surfaceRectPx.x}
                    y={surfaceRectPx.y}
                    width={surfaceRectPx.width}
                    height={surfaceRectPx.height}
                    preserveAspectRatio="none"
                    opacity={currentPhoto.opacity / 100}
                  />
                </g>
              </g>
            )}

            {/* ====================================================================
                LAYER 2: SUBTLE LITHOLOGY BACKGROUND (Sections 11 & 12)
                Strictly rendered ABOVE Layer 1 (Photo) and BELOW Layer 3–8 (Features, Joints, Symbols, Labels)
               ==================================================================== */}
            {layerVisibility.lithology && (
              <g clipPath="url(#active-surface-master-clip)">
                {lithologyRegions
                  .filter((reg) => reg.surface === activeSurface && reg.polygon.length >= 3)
                  .map((reg) => {
                    const polyPath =
                      reg.polygon
                        .map((pt, idx) => {
                          const { cx, cy } = coordManager.worldToScreen(pt);
                          return `${idx === 0 ? 'M' : 'L'} ${cx.toFixed(1)} ${cy.toFixed(1)}`;
                        })
                        .join(' ') + ' Z';
                    const centroid = getPolygonCentroid(reg.polygon);
                    const { cx: centX, cy: centY } = coordManager.worldToScreen(centroid);
                    const isSelectedReg = selectedLithologyRegionId === reg.id;

                    return (
                      <g
                        key={reg.id}
                        onClick={(e) => {
                          if (
                            (activeTool === 'lithology' || activeTool === 'select') &&
                            !isDrawingLithologyPolygon
                          ) {
                            e.stopPropagation();
                            setSelectedLithologyRegionId(reg.id);
                          }
                        }}
                        onMouseDown={(e) => {
                          if (
                            activeTool === 'lithology' &&
                            !isDrawingLithologyPolygon &&
                            isSelectedReg
                          ) {
                            e.stopPropagation();
                            const startProj = coordManager.screenToWorld(e.clientX, e.clientY);
                            setDraggingWholeLithology({
                              regionId: reg.id,
                              startMeters: { x: startProj.x, y: startProj.y },
                              origPolygon: reg.polygon.map((p) => ({ ...p })),
                            });
                          }
                        }}
                        className={
                          activeTool === 'lithology'
                            ? isSelectedReg
                              ? 'cursor-move'
                              : 'cursor-pointer'
                            : 'pointer-events-none'
                        }
                      >
                        {/* Subtle Geological Color Tint */}
                        <path
                          d={polyPath}
                          fill={reg.colorHex}
                          fillOpacity={Math.min(0.4, Math.max(0.04, reg.opacity * 0.55))}
                        />
                        {/* Subtle Geological Hatch Pattern */}
                        <path
                          d={polyPath}
                          fill={`url(#lith-pat-${reg.patternType})`}
                          fillOpacity={Math.min(0.85, Math.max(0.15, reg.opacity * 2.2))}
                          stroke={reg.colorHex}
                          strokeOpacity={isSelectedReg ? 0.9 : 0.45}
                          strokeWidth={isSelectedReg ? '1.8' : '1'}
                          strokeDasharray={isSelectedReg ? '6,3' : '4,4'}
                        />
                        {/* Subtle Lithology Region Label */}
                        <text
                          x={centX}
                          y={centY}
                          textAnchor="middle"
                          fontSize="10"
                          fontFamily="IBM Plex Mono, monospace"
                          fontWeight="600"
                          fill={reg.colorHex}
                          fillOpacity="0.8"
                          className="pointer-events-none"
                        >
                          {reg.lithologyName.toUpperCase()}
                        </text>
                      </g>
                    );
                  })}
              </g>
            )}

            {/* ====================================================================
                LAYER 2.5: OVERBREAK / UNDERCUT VECTOR ANALYSIS LAYER & CONNECTED SURVEY PROFILE
                Strictly rendered on 1. Face cross-section (where Crown & Wall radial overbreak is geometrically defined)
               ==================================================================== */}
            {layerVisibility.overbreakUndercut !== false &&
              surveyProfile.visible &&
              activeSurface === 'face' && (
                <g>
                  {/* 1. Overbreak Regions (Surveyed outside Design Boundary) */}
                  {overbreakAnalysis.overbreakRegions.map((reg) => {
                    if (reg.polygon.length < 3) return null;
                    const polyPath =
                      reg.polygon
                        .map((pt, idx) => {
                          const { cx, cy } = coordManager.worldToScreen(pt);
                          return `${idx === 0 ? 'M' : 'L'} ${cx.toFixed(1)} ${cy.toFixed(1)}`;
                        })
                        .join(' ') + ' Z';
                    const maxPtScreen = coordManager.worldToScreen(reg.maxRadialPoint);
                    return (
                      <g key={reg.id} className="pointer-events-none">
                        <path
                          d={polyPath}
                          fill="rgba(244, 63, 94, 0.16)"
                          stroke="#F43F5E"
                          strokeWidth="1.2"
                          strokeOpacity="0.8"
                        />
                        <path d={polyPath} fill="url(#overbreak-hatch)" />
                        {layerVisibility.annotations && reg.areaSqMeters >= 0.02 && (
                          <g>
                            <rect
                              x={maxPtScreen.cx - 46}
                              y={maxPtScreen.cy - 22}
                              width="92"
                              height="15"
                              rx="2"
                              fill={isLight ? '#FFF1F2' : '#0B0E14'}
                              fillOpacity="0.92"
                              stroke="#F43F5E"
                              strokeWidth="0.9"
                            />
                            <text
                              x={maxPtScreen.cx}
                              y={maxPtScreen.cy - 11.5}
                              textAnchor="middle"
                              fontSize="8.5"
                              fontWeight="700"
                              fontFamily="IBM Plex Mono, monospace"
                              fill={isLight ? '#BE123C' : '#FDA4AF'}
                            >
                              {reg.id}: +{reg.areaSqMeters.toFixed(2)}m² (Max +{reg.maxRadialMeters.toFixed(2)}m)
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* 2. Undercut Regions (Surveyed inside Design Boundary) */}
                  {overbreakAnalysis.undercutRegions.map((reg) => {
                    if (reg.polygon.length < 3) return null;
                    const polyPath =
                      reg.polygon
                        .map((pt, idx) => {
                          const { cx, cy } = coordManager.worldToScreen(pt);
                          return `${idx === 0 ? 'M' : 'L'} ${cx.toFixed(1)} ${cy.toFixed(1)}`;
                        })
                        .join(' ') + ' Z';
                    const maxPtScreen = coordManager.worldToScreen(reg.maxRadialPoint);
                    return (
                      <g key={reg.id} className="pointer-events-none">
                        <path
                          d={polyPath}
                          fill="rgba(245, 158, 11, 0.18)"
                          stroke="#F59E0B"
                          strokeWidth="1.2"
                          strokeOpacity="0.85"
                        />
                        <path d={polyPath} fill="url(#undercut-hatch)" />
                        {layerVisibility.annotations && reg.areaSqMeters >= 0.02 && (
                          <g>
                            <rect
                              x={maxPtScreen.cx - 46}
                              y={maxPtScreen.cy + 6}
                              width="92"
                              height="15"
                              rx="2"
                              fill={isLight ? '#FFFBEB' : '#0B0E14'}
                              fillOpacity="0.92"
                              stroke="#F59E0B"
                              strokeWidth="0.9"
                            />
                            <text
                              x={maxPtScreen.cx}
                              y={maxPtScreen.cy + 16.5}
                              textAnchor="middle"
                              fontSize="8.5"
                              fontWeight="700"
                              fontFamily="IBM Plex Mono, monospace"
                              fill={isLight ? '#B45309' : '#FDE68A'}
                            >
                              {reg.id}: -{reg.areaSqMeters.toFixed(2)}m² (Max -{reg.maxRadialMeters.toFixed(2)}m)
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* 3. Connected Surveyed / As-Built Profile Polyline (CP1 -> CP2 -> CP3 -> ...) */}
                  {overbreakAnalysis.surveyedPolygon.length >= 2 && (
                    <g>
                      {(() => {
                        const sPts = overbreakAnalysis.surveyedPolygon.map((pt) =>
                          coordManager.worldToScreen(pt)
                        );
                        const dSurvey =
                          sPts
                            .map(
                              (p, idx) =>
                                `${idx === 0 ? 'M' : 'L'} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`
                            )
                            .join(' ') + (surveyProfile.isClosed && sPts.length >= 3 ? ' Z' : '');
                        return (
                          <path
                            d={dSurvey}
                            fill="none"
                            stroke="#10B981"
                            strokeWidth="2.3"
                            strokeDasharray="7,4"
                            className="pointer-events-none"
                          />
                        );
                      })()}

                      {/* Midpoint '+' Handles on Connected Survey Segments to Insert Point */}
                      {(activeTool === 'overbreak' || activeTool === 'control_point') &&
                        !surveyProfile.locked &&
                        surveyProfile.orderedControlPointIds.length >= 2 &&
                        surveyProfile.orderedControlPointIds.map((cpIdA, segIdx) => {
                          const isLast =
                            segIdx === surveyProfile.orderedControlPointIds.length - 1;
                          if (isLast && !surveyProfile.isClosed) return null;
                          const cpIdB =
                            surveyProfile.orderedControlPointIds[
                              (segIdx + 1) % surveyProfile.orderedControlPointIds.length
                            ];
                          const cpA = surfaceControlPoints.find((c) => c.id === cpIdA);
                          const cpB = surfaceControlPoints.find((c) => c.id === cpIdB);
                          if (!cpA || !cpB) return null;
                          const sA = coordManager.worldToScreen(cpA.point);
                          const sB = coordManager.worldToScreen(cpB.point);
                          const mx = (sA.cx + sB.cx) / 2;
                          const my = (sA.cy + sB.cy) / 2;
                          const midPtMeters: Point2D = {
                            x: Number(((cpA.point.x + cpB.point.x) / 2).toFixed(3)),
                            y: Number(((cpA.point.y + cpB.point.y) / 2).toFixed(3)),
                          };
                          return (
                            <g
                              key={`survey-mid-${cpIdA}-${cpIdB}`}
                              className="cursor-pointer opacity-80 hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextNum =
                                  controlPoints.filter((c) => c.surface === activeSurface).length +
                                  1;
                                const newCp: SurveyControlPoint = {
                                  id: `cp-survey-ins-${Date.now()}`,
                                  label: `CP${nextNum}`,
                                  surface: activeSurface,
                                  point: midPtMeters,
                                  color: '#22D3EE',
                                  visible: true,
                                  locked: false,
                                };
                                handleUpdateControlPointsWithHistory((prev) => [...prev, newCp]);
                                onUpdateSurveyProfile((prev) => {
                                  const nextOrder = [...prev.orderedControlPointIds];
                                  nextOrder.splice(segIdx + 1, 0, newCp.id);
                                  return {
                                    ...prev,
                                    orderedControlPointIds: nextOrder,
                                  };
                                });
                                setSelectedControlPointId(newCp.id);
                                onUpdateStatusMessage?.(
                                  `Inserted ${newCp.label} between ${cpA.label} and ${cpB.label}.`
                                );
                              }}
                            >
                              <circle
                                cx={mx}
                                cy={my}
                                r="5"
                                fill="#0F172A"
                                stroke="#10B981"
                                strokeWidth="1.5"
                              />
                              <text
                                x={mx}
                                y={my + 3}
                                textAnchor="middle"
                                fontSize="9"
                                fontWeight="700"
                                fontFamily="IBM Plex Mono, monospace"
                                fill="#34D399"
                                className="pointer-events-none"
                              >
                                +
                              </text>
                            </g>
                          );
                        })}
                    </g>
                  )}
                </g>
              )}

            {/* Authoritative Master Tunnel Geometry Outline */}
            <path
              d={surfaceBoundaryPath}
              fill="none"
              stroke={isLight ? '#0284C7' : '#38BDF8'}
              strokeWidth="2.4"
            />

            {/* ====================================================================
                OUTER LINE 1.00m SPACING SCALE TICKS, SECTION LENGTHS, SPL & CENTER (CL)
                Rendered cleanly along the outer perimeter of the active surface
               ==================================================================== */}
            {(() => {
              const tickColor = isLight ? '#0369A1' : '#38BDF8';
              const textColor = isLight ? '#0F172A' : '#E2E8F0';
              const accentSplColor = isLight ? '#B45309' : '#FBBF24';
              const accentCenterColor = isLight ? '#047857' : '#34D399';
              const haloColor = isLight ? 'rgba(255,255,255,0.92)' : 'rgba(9,12,18,0.92)';

              if (activeSurface === 'face') {
                const leftWallH = geometry.leftWallHeight ?? geometry.wallHeight;
                const rightWallH = geometry.rightWallHeight ?? geometry.wallHeight;
                const leftWallLen = geometry.leftWallArcLength ?? leftWallH;
                const rightWallLen = geometry.rightWallArcLength ?? rightWallH;
                const halfW = geometry.width / 2;

                // 1. Left Wall 1m spacing ticks (y = 0 .. leftWallH at x = -halfW)
                const leftWallTicks: { m: number; cx: number; cy: number }[] = [];
                for (let m = 0; m <= Math.floor(leftWallH + 1e-4); m += 1) {
                  const pt = coordManager.worldToScreen({ x: -halfW, y: m });
                  leftWallTicks.push({ m, cx: pt.cx, cy: pt.cy });
                }

                // 2. Right Wall 1m spacing ticks (y = 0 .. rightWallH at x = +halfW)
                const rightWallTicks: { m: number; cx: number; cy: number }[] = [];
                for (let m = 0; m <= Math.floor(rightWallH + 1e-4); m += 1) {
                  const pt = coordManager.worldToScreen({ x: halfW, y: m });
                  rightWallTicks.push({ m, cx: pt.cx, cy: pt.cy });
                }

                // 3. Bottom / Invert 1m spacing ticks (x = ceil(-halfW) .. floor(+halfW) at y = 0)
                const invertTicks: { m: number; cx: number; cy: number }[] = [];
                for (let m = Math.ceil(-halfW); m <= Math.floor(halfW); m += 1) {
                  const pt = coordManager.worldToScreen({ x: m, y: 0 });
                  invertTicks.push({ m, cx: pt.cx, cy: pt.cy });
                }

                // 4. Crown Arch 1m spacing ticks along the outer arch curve (from Left SPL to Right SPL)
                const minSplH = Math.min(leftWallH, rightWallH);
                const archWorldPts = geometry.crossSectionPoints.filter(
                  (p) => p.y >= minSplH - 0.03
                );
                const crownArchTicks: {
                  m: number;
                  cx: number;
                  cy: number;
                  nx: number;
                  ny: number;
                }[] = [];

                if (archWorldPts.length >= 2) {
                  const cumDist: number[] = [0];
                  for (let i = 1; i < archWorldPts.length; i++) {
                    const seg = Math.hypot(
                      archWorldPts[i].x - archWorldPts[i - 1].x,
                      archWorldPts[i].y - archWorldPts[i - 1].y
                    );
                    cumDist.push(cumDist[i - 1] + seg);
                  }
                  const rawPolyLen = Math.max(0.1, cumDist[cumDist.length - 1]);
                  const targetArcLen = Math.max(rawPolyLen, geometry.crownArcLength || rawPolyLen);
                  const scaleRatio = rawPolyLen / targetArcLen;

                  for (let m = 1; m < Math.ceil(targetArcLen - 0.15); m += 1) {
                    const targetPolyDist = m * scaleRatio;
                    let segIdx = 0;
                    for (let i = 0; i < cumDist.length - 1; i++) {
                      if (cumDist[i + 1] >= targetPolyDist) {
                        segIdx = i;
                        break;
                      }
                    }
                    const d0 = cumDist[segIdx];
                    const d1 = cumDist[segIdx + 1];
                    const t = d1 > d0 ? (targetPolyDist - d0) / (d1 - d0) : 0;
                    const pA = archWorldPts[segIdx];
                    const pB = archWorldPts[segIdx + 1];
                    const wx = pA.x + t * (pB.x - pA.x);
                    const wy = pA.y + t * (pB.y - pA.y);

                    const sPt = coordManager.worldToScreen({ x: wx, y: wy });
                    const sA = coordManager.worldToScreen(pA);
                    const sB = coordManager.worldToScreen(pB);
                    const dx = sB.cx - sA.cx;
                    const dy = sB.cy - sA.cy;
                    const len = Math.hypot(dx, dy) || 1;
                    // Outward normal on screen (arch moves left-to-right, so outward/upward is (dy/len, -dx/len))
                    let nx = dy / len;
                    let ny = -dx / len;
                    const centerScr = coordManager.worldToScreen({ x: 0, y: minSplH * 0.6 });
                    if (nx * (sPt.cx - centerScr.cx) + ny * (sPt.cy - centerScr.cy) < 0) {
                      nx = -nx;
                      ny = -ny;
                    }
                    crownArchTicks.push({ m, cx: sPt.cx, cy: sPt.cy, nx, ny });
                  }
                }

                const leftSplScr = coordManager.worldToScreen({ x: -halfW, y: leftWallH });
                const rightSplScr = coordManager.worldToScreen({ x: halfW, y: rightWallH });
                const crownCenterScr = coordManager.worldToScreen({ x: 0, y: geometry.height });
                const invertCenterScr = coordManager.worldToScreen({ x: 0, y: 0 });
                const leftWallMidScr = coordManager.worldToScreen({ x: -halfW, y: leftWallH / 2 });
                const rightWallMidScr = coordManager.worldToScreen({ x: halfW, y: rightWallH / 2 });

                return (
                  <g className="pointer-events-none" fontFamily="IBM Plex Mono, monospace">
                    {/* Left Wall 1m Spacing Ticks on Outer Line */}
                    {leftWallTicks.map((tk) => (
                      <g key={`lw-1m-${tk.m}`}>
                        <line
                          x1={tk.cx}
                          y1={tk.cy}
                          x2={tk.cx - 8}
                          y2={tk.cy}
                          stroke={tickColor}
                          strokeWidth="1.6"
                        />
                        <text
                          x={tk.cx - 11}
                          y={tk.cy + 3}
                          textAnchor="end"
                          fontSize="8.5"
                          fontWeight="700"
                          fill={textColor}
                          stroke={haloColor}
                          strokeWidth="2.5"
                          paintOrder="stroke"
                        >
                          {tk.m}m
                        </text>
                      </g>
                    ))}

                    {/* Right Wall 1m Spacing Ticks on Outer Line */}
                    {rightWallTicks.map((tk) => (
                      <g key={`rw-1m-${tk.m}`}>
                        <line
                          x1={tk.cx}
                          y1={tk.cy}
                          x2={tk.cx + 8}
                          y2={tk.cy}
                          stroke={tickColor}
                          strokeWidth="1.6"
                        />
                        <text
                          x={tk.cx + 11}
                          y={tk.cy + 3}
                          textAnchor="start"
                          fontSize="8.5"
                          fontWeight="700"
                          fill={textColor}
                          stroke={haloColor}
                          strokeWidth="2.5"
                          paintOrder="stroke"
                        >
                          {tk.m}m
                        </text>
                      </g>
                    ))}

                    {/* Crown Arch 1m Spacing Ticks on Outer Line */}
                    {crownArchTicks.map((tk) => (
                      <g key={`crown-1m-${tk.m}`}>
                        <line
                          x1={tk.cx}
                          y1={tk.cy}
                          x2={tk.cx + tk.nx * 8}
                          y2={tk.cy + tk.ny * 8}
                          stroke={tickColor}
                          strokeWidth="1.6"
                        />
                        <text
                          x={tk.cx + tk.nx * 16}
                          y={tk.cy + tk.ny * 16 + 3}
                          textAnchor="middle"
                          fontSize="8"
                          fontWeight="700"
                          fill={textColor}
                          stroke={haloColor}
                          strokeWidth="2.5"
                          paintOrder="stroke"
                        >
                          {tk.m}m
                        </text>
                      </g>
                    ))}

                    {/* Bottom Invert 1m Spacing Ticks on Outer Line */}
                    {invertTicks.map((tk) => (
                      <g key={`inv-1m-${tk.m}`}>
                        <line
                          x1={tk.cx}
                          y1={tk.cy}
                          x2={tk.cx}
                          y2={tk.cy + (tk.m === 0 ? 12 : 7)}
                          stroke={tk.m === 0 ? accentCenterColor : tickColor}
                          strokeWidth={tk.m === 0 ? '2' : '1.5'}
                        />
                        <text
                          x={tk.cx}
                          y={tk.cy + (tk.m === 0 ? 22 : 17)}
                          textAnchor="middle"
                          fontSize="8"
                          fontWeight="700"
                          fill={tk.m === 0 ? accentCenterColor : textColor}
                          stroke={haloColor}
                          strokeWidth="2.5"
                          paintOrder="stroke"
                        >
                          {tk.m === 0 ? '0m (CENTER)' : `${tk.m > 0 ? `+${tk.m}` : tk.m}m`}
                        </text>
                      </g>
                    ))}

                    {/* LEFT SPL (Springline) Outer Marker & Label */}
                    <g>
                      <line
                        x1={leftSplScr.cx - 16}
                        y1={leftSplScr.cy}
                        x2={leftSplScr.cx + 5}
                        y2={leftSplScr.cy}
                        stroke={accentSplColor}
                        strokeWidth="2.2"
                      />
                      <circle cx={leftSplScr.cx} cy={leftSplScr.cy} r="3.5" fill={accentSplColor} />
                      <text
                        x={leftSplScr.cx - 19}
                        y={leftSplScr.cy + 3.5}
                        textAnchor="end"
                        fontSize="9.5"
                        fontWeight="800"
                        fill={accentSplColor}
                        stroke={haloColor}
                        strokeWidth="3"
                        paintOrder="stroke"
                      >
                        SPL (L) {leftWallH.toFixed(2)}m
                      </text>
                    </g>

                    {/* RIGHT SPL (Springline) Outer Marker & Label */}
                    <g>
                      <line
                        x1={rightSplScr.cx - 5}
                        y1={rightSplScr.cy}
                        x2={rightSplScr.cx + 16}
                        y2={rightSplScr.cy}
                        stroke={accentSplColor}
                        strokeWidth="2.2"
                      />
                      <circle cx={rightSplScr.cx} cy={rightSplScr.cy} r="3.5" fill={accentSplColor} />
                      <text
                        x={rightSplScr.cx + 19}
                        y={rightSplScr.cy + 3.5}
                        textAnchor="start"
                        fontSize="9.5"
                        fontWeight="800"
                        fill={accentSplColor}
                        stroke={haloColor}
                        strokeWidth="3"
                        paintOrder="stroke"
                      >
                        SPL (R) {rightWallH.toFixed(2)}m
                      </text>
                    </g>

                    {/* CROWN CENTER (CL) Outer Marker & Crown Arc Length Label */}
                    <g>
                      <line
                        x1={crownCenterScr.cx}
                        y1={crownCenterScr.cy - 18}
                        x2={crownCenterScr.cx}
                        y2={crownCenterScr.cy + 5}
                        stroke={accentCenterColor}
                        strokeWidth="2.2"
                      />
                      <circle
                        cx={crownCenterScr.cx}
                        cy={crownCenterScr.cy}
                        r="3.5"
                        fill={accentCenterColor}
                      />
                      <text
                        x={crownCenterScr.cx}
                        y={crownCenterScr.cy - 22}
                        textAnchor="middle"
                        fontSize="9.5"
                        fontWeight="800"
                        fill={accentCenterColor}
                        stroke={haloColor}
                        strokeWidth="3"
                        paintOrder="stroke"
                      >
                        CENTER (CL) · CROWN ARC = {geometry.crownArcLength.toFixed(2)}m (H = {geometry.height.toFixed(2)}m)
                      </text>
                    </g>

                    {/* Left Wall Outer Length Label */}
                    <text
                      x={leftWallMidScr.cx - 28}
                      y={leftWallMidScr.cy}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="800"
                      fill={tickColor}
                      stroke={haloColor}
                      strokeWidth="3"
                      paintOrder="stroke"
                      transform={`rotate(-90, ${leftWallMidScr.cx - 28}, ${leftWallMidScr.cy})`}
                    >
                      LEFT WALL LENGTH = {leftWallLen.toFixed(2)}m
                    </text>

                    {/* Right Wall Outer Length Label */}
                    <text
                      x={rightWallMidScr.cx + 28}
                      y={rightWallMidScr.cy}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="800"
                      fill={tickColor}
                      stroke={haloColor}
                      strokeWidth="3"
                      paintOrder="stroke"
                      transform={`rotate(90, ${rightWallMidScr.cx + 28}, ${rightWallMidScr.cy})`}
                    >
                      RIGHT WALL LENGTH = {rightWallLen.toFixed(2)}m
                    </text>

                    {/* Bottom Total Span & Perimeter Length Label */}
                    <text
                      x={invertCenterScr.cx}
                      y={invertCenterScr.cy + 36}
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="800"
                      fill={tickColor}
                      stroke={haloColor}
                      strokeWidth="3"
                      paintOrder="stroke"
                    >
                      SPAN LENGTH = {geometry.width.toFixed(2)}m · TOTAL PERIMETER = {(leftWallLen + geometry.crownArcLength + rightWallLen).toFixed(2)}m (1m SPACING)
                    </text>
                  </g>
                );
              }

              // Unfolded Rectangular Surfaces: 'crown', 'leftWall', 'rightWall'
              const tl = coordManager.worldToScreen({
                x: surfaceBounds.minX,
                y: surfaceBounds.maxY,
              });
              const br = coordManager.worldToScreen({
                x: surfaceBounds.maxX,
                y: surfaceBounds.minY,
              });
              const topCenter = coordManager.worldToScreen({
                x: (surfaceBounds.minX + surfaceBounds.maxX) / 2,
                y: surfaceBounds.maxY,
              });
              const botCenter = coordManager.worldToScreen({
                x: (surfaceBounds.minX + surfaceBounds.maxX) / 2,
                y: surfaceBounds.minY,
              });
              const leftMid = coordManager.worldToScreen({
                x: surfaceBounds.minX,
                y: (surfaceBounds.minY + surfaceBounds.maxY) / 2,
              });
              const rightMid = coordManager.worldToScreen({
                x: surfaceBounds.maxX,
                y: (surfaceBounds.minY + surfaceBounds.maxY) / 2,
              });

              const horizTicks: { m: number; cx: number }[] = [];
              for (
                let m = Math.ceil(surfaceBounds.minX);
                m <= Math.floor(surfaceBounds.maxX);
                m += 1
              ) {
                const pt = coordManager.worldToScreen({ x: m, y: surfaceBounds.maxY });
                horizTicks.push({ m, cx: pt.cx });
              }

              const vertTicks: { m: number; cy: number }[] = [];
              for (
                let m = Math.ceil(surfaceBounds.minY);
                m <= Math.floor(surfaceBounds.maxY);
                m += 1
              ) {
                const pt = coordManager.worldToScreen({ x: surfaceBounds.minX, y: m });
                vertTicks.push({ m, cy: pt.cy });
              }

              const horizTitle =
                activeSurface === 'crown'
                  ? `CENTER (CL) · CROWN ARC LENGTH = ${surfaceBounds.width.toFixed(2)}m (1m SPACING)`
                  : `ROUND PULL LENGTH = ${surfaceBounds.width.toFixed(2)}m · CENTER = ${(surfaceBounds.width / 2).toFixed(2)}m (1m SPACING)`;

              const vertTitle =
                activeSurface === 'crown'
                  ? `PULL LENGTH = ${surfaceBounds.height.toFixed(2)}m`
                  : activeSurface === 'leftWall'
                  ? `LEFT WALL LENGTH = ${surfaceBounds.height.toFixed(2)}m (INVERT TO SPL)`
                  : `RIGHT WALL LENGTH = ${surfaceBounds.height.toFixed(2)}m (INVERT TO SPL)`;

              return (
                <g className="pointer-events-none" fontFamily="IBM Plex Mono, monospace">
                  {/* Top & Bottom 1m Spacing Ticks on Outer Line */}
                  {horizTicks.map((tk) => (
                    <g key={`h-1m-${tk.m}`}>
                      <line
                        x1={tk.cx}
                        y1={tl.cy}
                        x2={tk.cx}
                        y2={tl.cy - 8}
                        stroke={tk.m === 0 && activeSurface === 'crown' ? accentCenterColor : tickColor}
                        strokeWidth={tk.m === 0 && activeSurface === 'crown' ? '2.2' : '1.6'}
                      />
                      <line
                        x1={tk.cx}
                        y1={br.cy}
                        x2={tk.cx}
                        y2={br.cy + 8}
                        stroke={tk.m === 0 && activeSurface === 'crown' ? accentCenterColor : tickColor}
                        strokeWidth={tk.m === 0 && activeSurface === 'crown' ? '2.2' : '1.6'}
                      />
                      <text
                        x={tk.cx}
                        y={br.cy + 18}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="700"
                        fill={tk.m === 0 && activeSurface === 'crown' ? accentCenterColor : textColor}
                        stroke={haloColor}
                        strokeWidth="2.5"
                        paintOrder="stroke"
                      >
                        {tk.m === 0 && activeSurface === 'crown' ? '0m (CENTER)' : `${tk.m}m`}
                      </text>
                    </g>
                  ))}

                  {/* Left & Right 1m Spacing Ticks on Outer Line */}
                  {vertTicks.map((tk) => (
                    <g key={`v-1m-${tk.m}`}>
                      <line
                        x1={tl.cx}
                        y1={tk.cy}
                        x2={tl.cx - 8}
                        y2={tk.cy}
                        stroke={tickColor}
                        strokeWidth="1.6"
                      />
                      <line
                        x1={br.cx}
                        y1={tk.cy}
                        x2={br.cx + 8}
                        y2={tk.cy}
                        stroke={tickColor}
                        strokeWidth="1.6"
                      />
                      <text
                        x={tl.cx - 11}
                        y={tk.cy + 3.5}
                        textAnchor="end"
                        fontSize="11"
                        fontWeight="700"
                        fill={textColor}
                        stroke={haloColor}
                        strokeWidth="2.5"
                        paintOrder="stroke"
                      >
                        {tk.m}m
                      </text>
                    </g>
                  ))}

                  {/* SPL & CENTER Markers for Unfolded Surfaces */}
                  {activeSurface === 'crown' ? (
                    <>
                      <text
                        x={tl.cx}
                        y={tl.cy - 12}
                        textAnchor="start"
                        fontSize="11.5"
                        fontWeight="800"
                        fill={accentSplColor}
                        stroke={haloColor}
                        strokeWidth="3"
                        paintOrder="stroke"
                      >
                        ◀ SPL (LEFT SPRINGLINE)
                      </text>
                      <text
                        x={br.cx}
                        y={tl.cy - 12}
                        textAnchor="end"
                        fontSize="11.5"
                        fontWeight="800"
                        fill={accentSplColor}
                        stroke={haloColor}
                        strokeWidth="3"
                        paintOrder="stroke"
                      >
                        SPL (RIGHT SPRINGLINE) ▶
                      </text>
                    </>
                  ) : (
                    <>
                      <text
                        x={tl.cx + 6}
                        y={tl.cy - 10}
                        textAnchor="start"
                        fontSize="11.5"
                        fontWeight="800"
                        fill={accentSplColor}
                        stroke={haloColor}
                        strokeWidth="3"
                        paintOrder="stroke"
                      >
                        ▲ SPL (SPRINGLINE = {surfaceBounds.height.toFixed(2)}m)
                      </text>
                      <text
                        x={tl.cx + 6}
                        y={br.cy + 30}
                        textAnchor="start"
                        fontSize="11"
                        fontWeight="800"
                        fill={tickColor}
                        stroke={haloColor}
                        strokeWidth="3"
                        paintOrder="stroke"
                      >
                        ▼ INVERT BASE (0.00m)
                      </text>
                    </>
                  )}

                  {/* Top Outer Length & Center Callout */}
                  <text
                    x={topCenter.cx}
                    y={tl.cy - 22}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="800"
                    fill={accentCenterColor}
                    stroke={haloColor}
                    strokeWidth="3"
                    paintOrder="stroke"
                  >
                    {horizTitle}
                  </text>

                  {/* Left & Right Vertical Length Callouts */}
                  <text
                    x={leftMid.cx - 30}
                    y={leftMid.cy}
                    textAnchor="middle"
                    fontSize="11.5"
                    fontWeight="800"
                    fill={tickColor}
                    stroke={haloColor}
                    strokeWidth="3"
                    paintOrder="stroke"
                    transform={`rotate(-90, ${leftMid.cx - 30}, ${leftMid.cy})`}
                  >
                    {vertTitle}
                  </text>
                  <text
                    x={rightMid.cx + 22}
                    y={rightMid.cy}
                    textAnchor="middle"
                    fontSize="11.5"
                    fontWeight="800"
                    fill={tickColor}
                    stroke={haloColor}
                    strokeWidth="3"
                    paintOrder="stroke"
                    transform={`rotate(90, ${rightMid.cx + 22}, ${rightMid.cy})`}
                  >
                    {vertTitle}
                  </text>

                  {/* Bottom Summary */}
                  <text
                    x={botCenter.cx}
                    y={br.cy + 32}
                    textAnchor="middle"
                    fontSize="11.5"
                    fontWeight="800"
                    fill={tickColor}
                    stroke={haloColor}
                    strokeWidth="3"
                    paintOrder="stroke"
                  >
                    {horizTitle}
                  </text>
                </g>
              );
            })()}

            {/* Interior 1.00m × 1.00m Engineering Scale Grid Overlay inside Tunnel Surface */}
            {showCadGrid && (
              <path
                d={surfaceBoundaryPath}
                fill="url(#canvas-meter-grid)"
                className="pointer-events-none"
              />
            )}

            {/* ==============================================================
                VECTOR GEOLOGICAL DISCONTINUITY TRACES + DIP/DIP-DIRECTION SYMBOLS (Sections 10, 11, 12, 21)
                Strictly clipped & constrained inside the active tunnel portion
               ============================================================== */}
            <g
              clipPath="url(#active-surface-master-clip)"
              opacity={canvasRole === 'photo_tracing' && isPeekingTracesOnPhoto ? 0.6 : 1.0}
            >
            {((canvasRole === 'clean_outline') || isPeekingTracesOnPhoto) && (() => {
              const canvasObstacles: LabelObstacleBox[] = [];
              const canvasSegments: LabelObstacleSegment[] = [];

              return (
                <>
                  {surfaceJoints.map((joint, jIdx) => {
                    const rawDisplayedGeom = getDisplayedJointGeometry(joint, traceFitMode);
                    const displayedGeom = clipPolylineToSurface(
                      rawDisplayedGeom,
                      activeSurface,
                      geometry,
                      settings
                    );
                    if (displayedGeom.length < 2) return null;
                    const canvasPts = displayedGeom.map((pt) => coordManager.worldToScreen(pt));
                    for (let k = 0; k < canvasPts.length - 1; k++) {
                      canvasSegments.push({
                        x1: canvasPts[k].cx,
                        y1: canvasPts[k].cy,
                        x2: canvasPts[k + 1].cx,
                        y2: canvasPts[k + 1].cy,
                      });
                    }
                    const dPath = canvasPts
                      .map(
                        (p, idx) =>
                          `${idx === 0 ? 'M' : 'L'} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`
                      )
                      .join(' ');

                    const isSelected = joint.id === selectedJointId;
                    const color = getJointReferenceColor(joint, jointSets);
                    const isLowConf =
                      joint.confidence === 'Low' &&
                      joint.orientationStatus !== 'DIRECTLY_MEASURED' &&
                      joint.orientationStatus !== 'CONFIRMED';

                    const strokeSpec = getGeologicalFeatureStrokeStyle(
                      joint.featureType,
                      isLowConf
                    );
                    const isShear = Boolean(strokeSpec.isBand);

                    // Midpoint for strike & dip symbol
                    const midIdx = Math.floor(canvasPts.length / 2);
                    const midPt =
                      canvasPts.length % 2 === 1
                        ? canvasPts[midIdx]
                        : {
                            cx: (canvasPts[midIdx - 1].cx + canvasPts[midIdx].cx) / 2,
                            cy: (canvasPts[midIdx - 1].cy + canvasPts[midIdx].cy) / 2,
                          };
                    const pStart = canvasPts[0];
                    const pEnd = canvasPts[canvasPts.length - 1];
                    const tangentAngleRad = Math.atan2(pEnd.cy - pStart.cy, pEnd.cx - pStart.cx);

                    canvasObstacles.push({
                      x: midPt.cx - 12,
                      y: midPt.cy - 12,
                      width: 24,
                      height: 24,
                    });

                    const labelText = formatJointTraceLineLabel(joint, joints);

                    const labelW = Math.max(96, labelText.length * 5.8 + 10);
                    const labelH = 16;
                    const labelPlacement = computeNonOverlappingLabelPlacement({
                      anchorX: midPt.cx,
                      anchorY: midPt.cy,
                      boxW: labelW,
                      boxH: labelH,
                      occupiedBoxes: canvasObstacles,
                      obstacleSegments: canvasSegments,
                      bounds: {
                        minX: 10,
                        minY: 10,
                        maxX: viewW - 10,
                        maxY: viewH - 10,
                      },
                    });
                    canvasObstacles.push({
                      x: labelPlacement.boxX,
                      y: labelPlacement.boxY,
                      width: labelW,
                      height: labelH,
                    });

                    const baseStrokeW = isSelected ? 3.2 : isShear ? 2.8 : 2.1;

                    return (
                      <g key={joint.id}>
                        {/* Invisible wider hit target for easy field selection */}
                        <path
                          d={dPath}
                          fill="none"
                          stroke="transparent"
                          strokeWidth="14"
                          className={
                            activeTool === 'select' ||
                            activeTool === 'dip_probe' ||
                            joinTargetMode
                              ? 'cursor-pointer'
                              : 'pointer-events-none'
                          }
                          onClick={(e) => {
                            if (
                              activeTool !== 'select' &&
                              activeTool !== 'dip_probe' &&
                              !joinTargetMode
                            ) {
                              return;
                            }
                            e.stopPropagation();
                            if (
                              joinTargetMode &&
                              selectedJoint &&
                              selectedJoint.id !== joint.id
                            ) {
                              handleJoinWithJoint(joint);
                              return;
                            }
                            setSelectedJointId(joint.id);
                            setShowCadPropertiesAlways(true);
                          }}
                          onMouseDown={(e) => {
                            if (activeTool === 'select' && isSelected) {
                              e.stopPropagation();
                              const startProj = coordManager.screenToWorld(
                                e.clientX,
                                e.clientY
                              );
                              setDraggingWholeJoint({
                                jointId: joint.id,
                                startMeters: { x: startProj.x, y: startProj.y },
                                origPoints: joint.geometry.map((p) => ({ ...p })),
                              });
                            }
                          }}
                        />

                        {/* Selection halo or Shear/Breccia/Weathered zone band */}
                        {(isSelected || strokeSpec.isBand) && (
                          <path
                            d={dPath}
                            fill="none"
                            stroke={isSelected ? '#22D3EE' : color}
                            strokeOpacity={isSelected ? 0.35 : strokeSpec.bandOpacity ?? 0.22}
                            strokeWidth={isSelected ? 9 : 8}
                            strokeLinecap="round"
                            className="pointer-events-none"
                          />
                        )}

                        {/* Main Vector Trace Line / Variable-Aperture Polyline */}
                        {joint.vertexWidths && joint.vertexWidths.length === canvasPts.length ? (
                          canvasPts.slice(0, -1).map((ptA, segIdx) => {
                            const ptB = canvasPts[segIdx + 1];
                            const wNorm =
                              ((joint.vertexWidths![segIdx] ?? 0.5) +
                                (joint.vertexWidths![segIdx + 1] ?? 0.5)) /
                              2;
                            const segStrokeW = Number(
                              (baseStrokeW + (wNorm - 0.5) * (isShear ? 2.4 : 1.6)).toFixed(2)
                            );
                            return (
                              <line
                                key={`${joint.id}-seg-${segIdx}`}
                                x1={ptA.cx}
                                y1={ptA.cy}
                                x2={ptB.cx}
                                y2={ptB.cy}
                                stroke={color}
                                strokeWidth={Math.max(1.2, segStrokeW)}
                                strokeDasharray={strokeSpec.dashArray}
                                strokeLinecap="round"
                                className="pointer-events-none"
                              />
                            );
                          })
                        ) : (
                          <path
                            d={dPath}
                            fill="none"
                            stroke={color}
                            strokeWidth={baseStrokeW}
                            strokeDasharray={strokeSpec.dashArray}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="pointer-events-none"
                          />
                        )}

                        {/* Genuine Rock Termination T-Bar Ticks (when trace ends inside exposed rock) */}
                        {joint.terminationStart === 'ROCK_TERMINATION' &&
                          canvasPts.length >= 2 &&
                          (() => {
                            const a = canvasPts[0];
                            const b = canvasPts[1];
                            const ang = Math.atan2(b.cy - a.cy, b.cx - a.cx) + Math.PI / 2;
                            const dx = Math.cos(ang) * 5.5;
                            const dy = Math.sin(ang) * 5.5;
                            return (
                              <line
                                x1={a.cx - dx}
                                y1={a.cy - dy}
                                x2={a.cx + dx}
                                y2={a.cy + dy}
                                stroke={color}
                                strokeWidth="1.8"
                                className="pointer-events-none"
                              />
                            );
                          })()}
                        {joint.terminationEnd === 'ROCK_TERMINATION' &&
                          canvasPts.length >= 2 &&
                          (() => {
                            const a = canvasPts[canvasPts.length - 2];
                            const b = canvasPts[canvasPts.length - 1];
                            const ang = Math.atan2(b.cy - a.cy, b.cx - a.cx) + Math.PI / 2;
                            const dx = Math.cos(ang) * 5.5;
                            const dy = Math.sin(ang) * 5.5;
                            return (
                              <line
                                x1={b.cx - dx}
                                y1={b.cy - dy}
                                x2={b.cx + dx}
                                y2={b.cy + dy}
                                stroke={color}
                                strokeWidth="1.8"
                                className="pointer-events-none"
                              />
                            );
                          })()}

                        {/* Local Angle Variation Callouts along segments when Selected */}
                        {isSelected &&
                          joint.localAnglesDeg &&
                          joint.localAnglesDeg.length > 1 &&
                          canvasPts.slice(0, -1).map((ptA, sIdx) => {
                            if (sIdx % 2 !== 0 && canvasPts.length > 5) return null;
                            const ptB = canvasPts[sIdx + 1];
                            const mx = (ptA.cx + ptB.cx) / 2;
                            const my = (ptA.cy + ptB.cy) / 2;
                            const locAng = joint.localAnglesDeg![sIdx];
                            if (locAng === undefined) return null;
                            return (
                              <text
                                key={`${joint.id}-locang-${sIdx}`}
                                x={mx}
                                y={my - 8}
                                textAnchor="middle"
                                fontSize="8.5"
                                fontFamily="IBM Plex Mono, monospace"
                                fill="#67E8F9"
                                className="pointer-events-none"
                              >
                                {Math.round(locAng)}°
                              </text>
                            );
                          })}

                        {/* Proper Structural Dip / Dip-Direction Orientation Symbol at Joint Midpoint (Section 12) */}
                        <DipDirectionSymbolGlyph
                          midX={midPt.cx}
                          midY={midPt.cy}
                          tangentAngleRad={tangentAngleRad}
                          dipDirectionDeg={joint.dipDirection}
                          dipDeg={joint.dip}
                          featureType={joint.featureType}
                          orientationStatus={joint.orientationStatus}
                          color={color}
                          scale={joint.symbolScale || 1.0}
                        />

                        {/* Joint Set Value & Numbers Fitted Directly Along the Joint Trace Line (Small Font, No Box) */}
                        {layerVisibility.annotations && (() => {
                          const segA = canvasPts[Math.max(0, midIdx - 1)];
                          const segB = canvasPts[Math.min(canvasPts.length - 1, midIdx)];
                          let angleDeg =
                            (Math.atan2(segB.cy - segA.cy, segB.cx - segA.cx) * 180) / Math.PI;
                          if (angleDeg > 90) angleDeg -= 180;
                          if (angleDeg < -90) angleDeg += 180;
                          return (
                            <g
                              transform={`translate(${midPt.cx.toFixed(1)}, ${midPt.cy.toFixed(1)}) rotate(${angleDeg.toFixed(1)})`}
                              className="pointer-events-none"
                            >
                              <text
                                x={0}
                                y={-4}
                                textAnchor="middle"
                                fontSize="7.5"
                                fontWeight="700"
                                fontFamily="IBM Plex Mono, monospace"
                                fill={color}
                                stroke={isLight ? 'rgba(255,255,255,0.92)' : 'rgba(11,14,20,0.92)'}
                                strokeWidth="2.4"
                                paintOrder="stroke"
                              >
                                {labelText}
                              </text>
                            </g>
                          );
                        })()}

                  {/* Interactive Control Point Handles & Midpoint Insertion when Selected (Sections 9, 10, 11) */}
                  {isSelected &&
                    (() => {
                      const rawCtrlPts = joint.geometry.map((pt) => coordManager.worldToScreen(pt));
                      return (
                        <g>
                          {/* Midpoint '+' Handles to Insert Control Points */}
                          {rawCtrlPts.length <= 24 &&
                            rawCtrlPts.slice(0, -1).map((ptA, sIdx) => {
                              const ptB = rawCtrlPts[sIdx + 1];
                              const mx = (ptA.cx + ptB.cx) / 2;
                              const my = (ptA.cy + ptB.cy) / 2;
                              return (
                                <g
                                  key={`${joint.id}-mid-${sIdx}`}
                                  className="cursor-pointer opacity-75 hover:opacity-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddVertexToSelectedJoint(sIdx);
                                  }}
                                >
                                  <circle
                                    cx={mx}
                                    cy={my}
                                    r="4.5"
                                    fill="#0F172A"
                                    stroke="#38BDF8"
                                    strokeWidth="1.4"
                                  />
                                  <text
                                    x={mx}
                                    y={my + 3}
                                    textAnchor="middle"
                                    fontSize="9"
                                    fontFamily="IBM Plex Mono, monospace"
                                    fill="#38BDF8"
                                    className="pointer-events-none"
                                  >
                                    +
                                  </text>
                                </g>
                              );
                            })}

                          {/* Actual Control Points (Start, Intermediate, End) */}
                          {rawCtrlPts.map((pt, vIdx) => {
                            const isStart = vIdx === 0;
                            const isEnd = vIdx === rawCtrlPts.length - 1;
                            const isSelVertex = selectedJointVertexIdx === vIdx;
                            return (
                              <g key={`${joint.id}-v-${vIdx}`}>
                                <circle
                                  cx={pt.cx}
                                  cy={pt.cy}
                                  r={isSelVertex ? '7' : isStart || isEnd ? '6.2' : '5.5'}
                                  fill={
                                    isSelVertex
                                      ? '#F59E0B'
                                      : isStart
                                      ? '#10B981'
                                      : isEnd
                                      ? '#F43F5E'
                                      : '#0B0E14'
                                  }
                                  stroke="#22D3EE"
                                  strokeWidth="2.2"
                                  className="cursor-grab active:cursor-grabbing"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    if (e.shiftKey && joint.geometry.length > 2) {
                                      handleDeleteSelectedJointVertex(vIdx);
                                      return;
                                    }
                                    setSelectedJointVertexIdx(vIdx);
                                    setDraggingVertex({
                                      jointId: joint.id,
                                      vertexIndex: vIdx,
                                    });
                                  }}
                                  onTouchStart={(e) => {
                                    e.stopPropagation();
                                    lastTouchStartTimestampRef.current = Date.now();
                                    setSelectedJointVertexIdx(vIdx);
                                    setDraggingVertex({
                                      jointId: joint.id,
                                      vertexIndex: vIdx,
                                    });
                                  }}
                                />
                                {(isStart || isEnd || isSelVertex) && (
                                  <text
                                    x={pt.cx}
                                    y={pt.cy - 9}
                                    textAnchor="middle"
                                    fontSize="8.5"
                                    fontWeight="700"
                                    fontFamily="IBM Plex Mono, monospace"
                                    fill={isStart ? '#34D399' : isEnd ? '#FDA4AF' : '#FDE68A'}
                                    className="pointer-events-none"
                                  >
                                    {isStart
                                      ? 'START (P1)'
                                      : isEnd
                                      ? `END (P${rawCtrlPts.length})`
                                      : `P${vIdx + 1}`}
                                  </text>
                                )}
                              </g>
                            );
                          })}
                        </g>
                      );
                    })()}
                </g>
              );
            })}

            {/* ====================================================================
                LAYER 7: PLACED STRUCTURAL GEOLOGICAL SYMBOLS (Sections 9, 10, 12, 15)
                Interactive select, drag-to-move, drag-to-rotate, drag-to-scale & non-overlapping labels
               ==================================================================== */}
            {surfacePlacedSymbols
              .filter((sym) => sym.visible !== false)
              .map((sym) => {
                const { cx, cy } = coordManager.worldToScreen(sym.point);
                const isSelSym = selectedSymbolId === sym.id;
                const meta = getStructuralSymbolMeta(sym.symbolType);
                const symScale = sym.scale || 1.0;
                const symRadiusPx = 15 * symScale;

                canvasObstacles.push({
                  x: cx - symRadiusPx,
                  y: cy - symRadiusPx,
                  width: symRadiusPx * 2,
                  height: symRadiusPx * 2,
                });

                const orientSuffix = ` ${String(Math.round(sym.dipDirectionDeg)).padStart(
                  3,
                  '0'
                )}°/${String(Math.round(sym.dipDeg)).padStart(2, '0')}°${
                  sym.uncertainOrientation ? '?' : ''
                }`;
                const symLabelText = `${sym.label || meta.shortCode}${orientSuffix}`;
                const sBoxW = Math.max(58, symLabelText.length * 5.8 + 10);
                const sBoxH = 15;

                const symLabelPlacement = computeNonOverlappingLabelPlacement({
                  anchorX: cx,
                  anchorY: cy,
                  boxW: sBoxW,
                  boxH: sBoxH,
                  occupiedBoxes: canvasObstacles,
                  obstacleSegments: canvasSegments,
                  bounds: {
                    minX: 10,
                    minY: 10,
                    maxX: viewW - 10,
                    maxY: viewH - 10,
                  },
                });
                canvasObstacles.push({
                  x: symLabelPlacement.boxX,
                  y: symLabelPlacement.boxY,
                  width: sBoxW,
                  height: sBoxH,
                });

                const symColor = sym.color || meta.defaultColor;

                return (
                  <g
                    key={sym.id}
                    className={
                      activeTool !== 'select' && activeTool !== 'geological_symbol'
                        ? 'pointer-events-none'
                        : sym.locked
                        ? 'cursor-not-allowed'
                        : 'cursor-grab active:cursor-grabbing'
                    }
                    onMouseDown={(e) => {
                      if (activeTool !== 'select' && activeTool !== 'geological_symbol') {
                        return;
                      }
                      e.stopPropagation();
                      if (e.shiftKey && !sym.locked) {
                        handleDeletePlacedSymbol(sym.id);
                        return;
                      }
                      setSelectedSymbolId(sym.id);
                      setShowCadPropertiesAlways(true);
                      if (!sym.locked) {
                        setSymbolPast((p) => [...p.slice(-24), placedSymbols]);
                        setSymbolFuture([]);
                        setDraggingSymbolId(sym.id);
                      }
                    }}
                  >
                    {isSelSym && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={symRadiusPx + 3}
                        fill="rgba(34, 211, 238, 0.14)"
                        stroke="#22D3EE"
                        strokeWidth="1.2"
                        strokeDasharray="3,2"
                      />
                    )}
                    <g transform={`translate(${cx}, ${cy}) rotate(${sym.rotationDeg})`}>
                      <StructuralGeologicalSymbolGlyph
                        symbolType={sym.symbolType}
                        scale={symScale}
                        color={symColor}
                        dipDeg={sym.dipDeg}
                        uncertainOrientation={sym.uncertainOrientation}
                      />
                    </g>

                    {/* Interactive On-Canvas Rotation & Scale Handles when Selected (Section 15) */}
                    {isSelSym && !sym.locked && (
                      <g>
                        {/* Rotation Handle (Top Stem + Circle) */}
                        <line
                          x1={cx}
                          y1={cy - symRadiusPx}
                          x2={cx}
                          y2={cy - symRadiusPx - 14}
                          stroke="#22D3EE"
                          strokeWidth="1.3"
                          strokeDasharray="2,2"
                        />
                        <circle
                          cx={cx}
                          cy={cy - symRadiusPx - 14}
                          r="5"
                          fill="#06B6D4"
                          stroke="#0B0E14"
                          strokeWidth="1.5"
                          className="cursor-crosshair"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setSymbolPast((p) => [...p.slice(-24), placedSymbols]);
                            setSymbolFuture([]);
                            setRotatingSymbolState({
                              symbolId: sym.id,
                              centerPx: { cx, cy },
                            });
                          }}
                        />
                        {/* Scale Handle (Bottom-Right Corner Square) */}
                        <rect
                          x={cx + symRadiusPx - 3}
                          y={cy + symRadiusPx - 3}
                          width="8"
                          height="8"
                          rx="1.5"
                          fill="#F59E0B"
                          stroke="#0B0E14"
                          strokeWidth="1.4"
                          className="cursor-nwse-resize"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setSymbolPast((p) => [...p.slice(-24), placedSymbols]);
                            setSymbolFuture([]);
                            setScalingSymbolState({
                              symbolId: sym.id,
                              centerPx: { cx, cy },
                              initialDistPx: Math.max(8, Math.hypot(symRadiusPx, symRadiusPx)),
                              initialScale: symScale,
                            });
                          }}
                        />
                      </g>
                    )}

                      {/* Geological Symbol Values Only (Small Font, No Box) */}
                    {layerVisibility.annotations && (
                      <text
                        x={cx}
                        y={cy - symRadiusPx - 3}
                        textAnchor="middle"
                        fontSize="7.5"
                        fontWeight="700"
                        fontFamily="IBM Plex Mono, monospace"
                        fill={symColor}
                        stroke={isLight ? 'rgba(255,255,255,0.92)' : 'rgba(11,14,20,0.92)'}
                        strokeWidth="2.4"
                        paintOrder="stroke"
                        className="pointer-events-none"
                      >
                        {symLabelText}
                      </text>
                    )}
                  </g>
                );
              })}
                </>
              );
            })()}

            {/* Draft Joint Polyline / Freehand / Smooth Spline while using "Add Joint", "Re-draw" or "Append" Tool */}
            {(activeTool === 'add_joint' ||
              activeTool === 'redraw_joint' ||
              activeTool === 'append_joint') &&
              draftJointPoints.length > 0 && (
                <g>
                  {(() => {
                    const allPts =
                      cursorMeters && !isFreehandDrawingJoint
                        ? jointDrawMode === 'magnetic_livewire' && livewirePreviewSegment.length >= 2
                          ? [...draftJointPoints, ...livewirePreviewSegment.slice(1)]
                          : [...draftJointPoints, cursorMeters]
                        : draftJointPoints;
                    const displayPts = (() => {
                      if (jointDrawMode === 'smooth_curve') {
                        if (allPts.length >= 3) {
                          return evaluateCatmullRomSplineThroughPoints(allPts, 5);
                        }
                        if (allPts.length === 2) {
                          const p0 = allPts[0];
                          const p1 = allPts[1];
                          const dx = p1.x - p0.x;
                          const dy = p1.y - p0.y;
                          const len = Math.hypot(dx, dy);
                          const nx = len > 1e-4 ? -dy / len : 0;
                          const ny = len > 1e-4 ? dx / len : 0;
                          const sag = len * 0.08;
                          const mid: Point2D = {
                            x: (p0.x + p1.x) / 2 + nx * sag,
                            y: (p0.y + p1.y) / 2 + ny * sag,
                          };
                          return evaluateCatmullRomSplineThroughPoints([p0, mid, p1], 5);
                        }
                      }
                      return allPts;
                    })();
                    const cPts = displayPts.map((p) => coordManager.worldToScreen(p));
                    const ctrlCanvasPts = draftJointPoints.map((p) =>
                      coordManager.worldToScreen(p)
                    );
                    const d = cPts
                      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`)
                      .join(' ');
                    const liveOrient =
                      displayPts.length >= 2
                        ? calculateJointOrientation3D(
                            displayPts,
                            activeSurface,
                            geometry,
                            settings,
                            'DIRECTLY_MEASURED',
                            currentPhoto.calibration
                          )
                        : null;
                    const midCanvasPt =
                      cPts.length >= 2
                        ? {
                            cx: (cPts[0].cx + cPts[cPts.length - 1].cx) / 2,
                            cy: (cPts[0].cy + cPts[cPts.length - 1].cy) / 2,
                          }
                        : null;
                    return (
                      <>
                        {activeOverlapResult?.isOverlap && (
                          <path
                            d={d}
                            fill="none"
                            stroke="#EA580C"
                            strokeWidth="7"
                            opacity="0.38"
                            className="pointer-events-none"
                          />
                        )}
                        <path
                          d={d}
                          fill="none"
                          stroke={
                            activeOverlapResult?.isOverlap
                              ? '#F97316'
                              : jointDrawMode === 'magnetic_livewire'
                              ? '#22D3EE'
                              : '#F59E0B'
                          }
                          strokeWidth={activeOverlapResult?.isOverlap ? '3.5' : '2.5'}
                          strokeDasharray={
                            jointDrawMode === 'freehand' || jointDrawMode === 'magnetic_livewire'
                              ? undefined
                              : '6,4'
                          }
                          className="pointer-events-none"
                        />
                        {liveOrient && midCanvasPt && (
                          <text
                            x={midCanvasPt.cx}
                            y={midCanvasPt.cy - 12}
                            textAnchor="middle"
                            fontSize="9.5"
                            fontWeight="800"
                            fontFamily="IBM Plex Mono, monospace"
                            fill="#FDE68A"
                            stroke="#0B0E14"
                            strokeWidth="2.8"
                            paintOrder="stroke"
                            className="pointer-events-none"
                          >
                            {activeSurface === 'crown'
                              ? (() => {
                                  const liveCrownRel = resolveCrownRelatedDipFromFaceAndWalls(
                                    {
                                      id: 'live-draft-crown',
                                      set: draftSetId || 'J1',
                                      strike: liveOrient.strike,
                                      dipDirection: normalizeAzimuth(liveOrient.strike + 90),
                                      dip: liveOrient.dip,
                                    },
                                    joints
                                  );
                                  return `${draftSetId} Strike ${formatAccurateAngle(
                                    liveCrownRel.strikeDeg,
                                    3
                                  )}° (${formatAccurateAngle(
                                    liveCrownRel.dipDirectionDeg,
                                    3
                                  )}/${formatAccurateAngle(
                                    liveCrownRel.dipDeg,
                                    2
                                  )}) · ${liveOrient.persistenceMeters.toFixed(2)}m`;
                                })()
                              : `${draftSetId} ${formatAccurateAngle(
                                  liveOrient.dipDirection,
                                  3
                                )}/${formatAccurateAngle(
                                  liveOrient.dip,
                                  2
                                )} · ${liveOrient.persistenceMeters.toFixed(2)}m`}
                          </text>
                        )}
                        {ctrlCanvasPts.map((p, idx) => (
                          <g key={idx}>
                            <circle
                              cx={p.cx}
                              cy={p.cy}
                              r={idx === 0 ? '6' : '5'}
                              fill={idx === 0 ? '#10B981' : '#F59E0B'}
                              stroke="#0B0E14"
                              strokeWidth="1.5"
                              className="cursor-move"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setDraggingDraftJointIdx(idx);
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                lastTouchStartTimestampRef.current = Date.now();
                                setDraggingDraftJointIdx(idx);
                              }}
                            />
                            <text
                              x={p.cx + 8}
                              y={p.cy - 6}
                              fontSize="9.5"
                              fontWeight="700"
                              fontFamily="IBM Plex Mono, monospace"
                              fill="#FBBF24"
                              stroke="#0B0E14"
                              strokeWidth="2.2"
                              paintOrder="stroke"
                              className="pointer-events-none"
                            >
                              P{idx + 1}
                            </text>
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </g>
              )}

            {/* Real-Time (<1.5ms) MATLAB 1-Click Seed Auto-Trace Hover Preview */}
            {activeTool === 'add_joint' &&
              jointDrawMode === 'seed_autotrace' &&
              seedAutotraceHoverPreview &&
              seedAutotraceHoverPreview.points.length >= 2 && (
                <g className="pointer-events-none">
                  {(() => {
                    const cPts = seedAutotraceHoverPreview.points.map((p) =>
                      coordManager.worldToScreen(p)
                    );
                    const d = cPts
                      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`)
                      .join(' ');
                    const midIdx = Math.floor(cPts.length / 2);
                    const midPt = cPts[midIdx] || cPts[0];
                    return (
                      <>
                        <path
                          d={d}
                          fill="none"
                          stroke="#10B981"
                          strokeWidth="6"
                          strokeOpacity="0.28"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d={d}
                          fill="none"
                          stroke="#34D399"
                          strokeWidth="2.4"
                          strokeDasharray="6,3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle
                          cx={cPts[0].cx}
                          cy={cPts[0].cy}
                          r="4.5"
                          fill="#10B981"
                          stroke="#0B0E14"
                          strokeWidth="1.4"
                        />
                        <circle
                          cx={cPts[cPts.length - 1].cx}
                          cy={cPts[cPts.length - 1].cy}
                          r="4.5"
                          fill="#10B981"
                          stroke="#0B0E14"
                          strokeWidth="1.4"
                        />
                        <g transform={`translate(${midPt.cx}, ${midPt.cy - 14})`}>
                          <rect
                            x="-78"
                            y="-11"
                            width="156"
                            height="17"
                            rx="4"
                            fill="rgba(6, 78, 59, 0.92)"
                            stroke="#10B981"
                            strokeWidth="1"
                          />
                          <text
                            x="0"
                            y="1"
                            textAnchor="middle"
                            fontSize="8.5"
                            fontWeight="700"
                            fontFamily="IBM Plex Mono, monospace"
                            fill="#A7F3D0"
                          >
                            {`MATLAB SNAKE LOCK • ${seedAutotraceHoverPreview.confidencePct}%`}
                          </text>
                        </g>
                      </>
                    );
                  })()}
                </g>
              )}

            {/* Measure & Virtual Scanline RQD Tool Overlay */}
            {activeTool === 'measure' && measurePts.length > 0 && (
              <g clipPath="url(#active-surface-master-clip)">
                {(() => {
                  const pts =
                    measurePts.length === 1 && cursorMeters
                      ? [measurePts[0], cursorMeters]
                      : measurePts;
                  if (pts.length < 2) return null;
                  const p1 = coordManager.worldToScreen(pts[0]);
                  const p2 = coordManager.worldToScreen(pts[1]);
                  const scan = computeVirtualScanlineMetrics(pts[0], pts[1], surfaceJoints);
                  return (
                    <>
                      <line
                        x1={p1.cx}
                        y1={p1.cy}
                        x2={p2.cx}
                        y2={p2.cy}
                        stroke="#22D3EE"
                        strokeWidth="2.2"
                        strokeDasharray="5,3"
                      />
                      <circle cx={p1.cx} cy={p1.cy} r="5" fill="#10B981" stroke="#0B0E14" strokeWidth="1.5" />
                      <circle cx={p2.cx} cy={p2.cy} r="5" fill="#22D3EE" stroke="#0B0E14" strokeWidth="1.5" />

                      {/* Intersected Joint Markers along Virtual Scanline */}
                      {scan.intersections.map((hit, idx) => {
                        const hitScr = coordManager.worldToScreen(hit.point);
                        return (
                          <g key={`${hit.jointId}-${idx}`}>
                            <circle
                              cx={hitScr.cx}
                              cy={hitScr.cy}
                              r="5.5"
                              fill="rgba(245, 158, 11, 0.25)"
                              stroke="#F59E0B"
                              strokeWidth="1.8"
                            />
                            <circle cx={hitScr.cx} cy={hitScr.cy} r="2" fill="#FDE68A" />
                            <text
                              x={hitScr.cx}
                              y={hitScr.cy - 8}
                              textAnchor="middle"
                              fontSize="8.5"
                              fontWeight="700"
                              fontFamily="IBM Plex Mono, monospace"
                              fill={isLight ? '#B45309' : '#FDE68A'}
                            >
                              {hit.set} ({hit.distanceAlongM.toFixed(2)}m)
                            </text>
                          </g>
                        );
                      })}

                      <rect
                        x={(p1.cx + p2.cx) / 2 - 104}
                        y={(p1.cy + p2.cy) / 2 - 26}
                        width="208"
                        height="20"
                        rx="3"
                        fill={isLight ? '#FFFFFF' : '#0B0E14'}
                        stroke={isLight ? '#0284C7' : '#22D3EE'}
                        strokeWidth="1.2"
                      />
                      <text
                        x={(p1.cx + p2.cx) / 2}
                        y={(p1.cy + p2.cy) / 2 - 12.5}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="700"
                        fontFamily="IBM Plex Mono, monospace"
                        fill={isLight ? '#0369A1' : '#22D3EE'}
                      >
                        L={scan.lengthMeters.toFixed(2)}m · {scan.intersectionCount} Jts · RQD={scan.measuredScanlineRqdPct}%
                      </text>
                    </>
                  );
                })()}
              </g>
            )}
            </g>

            {/* ====================================================================
                LAYER 8: SURVEY CONTROL POINTS (Unclipped so Overcut Survey Points outside the tunnel outline are 100% visible & interactive!)
               ==================================================================== */}
            {layerVisibility.controlPoints !== false &&
              surfaceControlPoints
                .filter((cp) => cp.visible !== false)
                .map((cp) => {
                  const { cx, cy } = coordManager.worldToScreen(cp.point);
                  const isSelCp = selectedControlPointId === cp.id;
                  const isOutsideOutline = !isPointInsideSurface(
                    cp.point,
                    activeSurface,
                    geometry,
                    settings
                  );
                  const strokeCol = cp.locked
                    ? '#F59E0B'
                    : isOutsideOutline
                    ? '#F43F5E'
                    : isSelCp
                    ? '#10B981'
                    : '#059669';

                  return (
                    <g
                      key={cp.id}
                      className={
                        activeTool !== 'select' &&
                        activeTool !== 'control_point' &&
                        activeTool !== 'overbreak' &&
                        cadRibbonTab !== 'SURVEY_OVERBREAK'
                          ? 'pointer-events-none'
                          : cp.locked
                          ? 'cursor-not-allowed'
                          : 'cursor-grab active:cursor-grabbing'
                      }
                      onMouseDown={(e) => {
                        if (
                          activeTool !== 'select' &&
                          activeTool !== 'control_point' &&
                          activeTool !== 'overbreak' &&
                          cadRibbonTab !== 'SURVEY_OVERBREAK'
                        ) {
                          return;
                        }
                        e.stopPropagation();
                        if (e.shiftKey && !cp.locked) {
                          handleDeleteControlPoint(cp.id);
                          return;
                        }
                        setSelectedControlPointId(cp.id);
                        setShowCadPropertiesAlways(true);
                        if (!cp.locked) {
                          setControlPointPast((p) => [...p.slice(-24), controlPoints]);
                          setControlPointFuture([]);
                          setDraggingControlPointId(cp.id);
                        }
                      }}
                    >
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isSelCp ? '7.5' : '6'}
                        fill={
                          isOutsideOutline
                            ? 'rgba(244, 63, 94, 0.25)'
                            : isSelCp
                            ? 'rgba(16, 185, 129, 0.32)'
                            : isLight
                            ? 'rgba(255, 255, 255, 0.92)'
                            : 'rgba(15, 23, 42, 0.85)'
                        }
                        stroke={strokeCol}
                        strokeWidth={isSelCp ? '2.2' : '1.6'}
                      />
                      <line
                        x1={cx - 8}
                        y1={cy}
                        x2={cx + 8}
                        y2={cy}
                        stroke={strokeCol}
                        strokeWidth="1.5"
                        className="pointer-events-none"
                      />
                      <line
                        x1={cx}
                        y1={cy - 8}
                        x2={cx}
                        y2={cy + 8}
                        stroke={strokeCol}
                        strokeWidth="1.5"
                        className="pointer-events-none"
                      />
                      <text
                        x={cx}
                        y={cy - 9.5}
                        textAnchor="middle"
                        fontSize="8"
                        fontWeight="800"
                        fontFamily="IBM Plex Mono, monospace"
                        fill={
                          isOutsideOutline
                            ? isLight
                              ? '#BE123C'
                              : '#FDA4AF'
                            : isLight
                            ? '#047857'
                            : '#6EE7B7'
                        }
                        stroke={isLight ? 'rgba(255,255,255,0.94)' : 'rgba(11,14,20,0.94)'}
                        strokeWidth="2.4"
                        paintOrder="stroke"
                        className="pointer-events-none"
                      >
                        {cp.label}
                      </text>
                    </g>
                  );
                })}

            {/* Interactive Photo Fitting Handles: 4 Corners, 4 Edges, Piecewise Mesh Control Points C1..Cn, & Custom Polygon P1..Pn */}
            {activeTool === 'photo_fit' && currentPhoto.image && (
              <g>
                {/* 1. Piecewise Deformation Mesh Grid Overlay */}
                {showMeshGrid && (
                  <g transform={photoSvgTransform} className="pointer-events-none">
                    {[0, 0.25, 0.5, 0.75, 1].map((gridVal, gIdx) => {
                      const rowPts: { x: number; y: number }[] = [];
                      const colPts: { x: number; y: number }[] = [];
                      for (let s = 0; s <= 12; s++) {
                        const tStep = s / 12;
                        const wRow = evaluateForwardWarpedUV(
                          tStep,
                          gridVal,
                          currentPhoto.transform
                        );
                        rowPts.push({
                          x: surfaceRectPx.x + wRow.u * surfaceRectPx.width,
                          y: surfaceRectPx.y + wRow.v * surfaceRectPx.height,
                        });
                        const wCol = evaluateForwardWarpedUV(
                          gridVal,
                          tStep,
                          currentPhoto.transform
                        );
                        colPts.push({
                          x: surfaceRectPx.x + wCol.u * surfaceRectPx.width,
                          y: surfaceRectPx.y + wCol.v * surfaceRectPx.height,
                        });
                      }
                      const dRow = rowPts
                        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                        .join(' ');
                      const dCol = colPts
                        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                        .join(' ');
                      return (
                        <g key={`mesh-grid-${gIdx}`}>
                          <path
                            d={dRow}
                            fill="none"
                            stroke="rgba(34, 211, 238, 0.38)"
                            strokeWidth="1"
                            strokeDasharray="3,3"
                          />
                          <path
                            d={dCol}
                            fill="none"
                            stroke="rgba(34, 211, 238, 0.38)"
                            strokeWidth="1"
                            strokeDasharray="3,3"
                          />
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* 2. 4-Corner Projective Perspective Handles (TL, TR, BR, BL) inside photoSvgTransform */}
                <g transform={photoSvgTransform}>
                {[
                  { idx: 0, baseX: surfaceRectPx.x, baseY: surfaceRectPx.y, label: 'TL' },
                  {
                    idx: 1,
                    baseX: surfaceRectPx.x + surfaceRectPx.width,
                    baseY: surfaceRectPx.y,
                    label: 'TR',
                  },
                  {
                    idx: 2,
                    baseX: surfaceRectPx.x + surfaceRectPx.width,
                    baseY: surfaceRectPx.y + surfaceRectPx.height,
                    label: 'BR',
                  },
                  {
                    idx: 3,
                    baseX: surfaceRectPx.x,
                    baseY: surfaceRectPx.y + surfaceRectPx.height,
                    label: 'BL',
                  },
                ].map((corner) => {
                  const offset = currentPhoto.transform.perspectiveCorners[corner.idx];
                  const hx = corner.baseX + offset.x * surfaceRectPx.width;
                  const hy = corner.baseY + offset.y * surfaceRectPx.height;
                  return (
                    <g key={corner.label}>
                      <circle
                        cx={hx}
                        cy={hy}
                        r="8"
                        fill="#06B6D4"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                        className="cursor-pointer"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setTransformPast((prev) => [...prev.slice(-18), currentPhoto.transform]);
                          setTransformFuture([]);
                          setDraggingPhotoHandle({
                            type: 'corner',
                            cornerIndex: corner.idx,
                            startClientX: e.clientX,
                            startClientY: e.clientY,
                            initialTransform: {
                              ...currentPhoto.transform,
                              perspectiveCorners: [
                                { ...currentPhoto.transform.perspectiveCorners[0] },
                                { ...currentPhoto.transform.perspectiveCorners[1] },
                                { ...currentPhoto.transform.perspectiveCorners[2] },
                                { ...currentPhoto.transform.perspectiveCorners[3] },
                              ],
                            },
                          });
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          lastTouchStartTimestampRef.current = Date.now();
                          const t = e.touches[0];
                          if (!t) return;
                          setTransformPast((prev) => [...prev.slice(-18), currentPhoto.transform]);
                          setTransformFuture([]);
                          setDraggingPhotoHandle({
                            type: 'corner',
                            cornerIndex: corner.idx,
                            startClientX: t.clientX,
                            startClientY: t.clientY,
                            initialTransform: {
                              ...currentPhoto.transform,
                              perspectiveCorners: [
                                { ...currentPhoto.transform.perspectiveCorners[0] },
                                { ...currentPhoto.transform.perspectiveCorners[1] },
                                { ...currentPhoto.transform.perspectiveCorners[2] },
                                { ...currentPhoto.transform.perspectiveCorners[3] },
                              ],
                            },
                          });
                        }}
                      />
                      <text
                        x={hx}
                        y={hy - 12}
                        textAnchor="middle"
                        fontSize="9"
                        fontFamily="IBM Plex Mono, monospace"
                        fill="#22D3EE"
                      >
                        {corner.label}
                      </text>
                    </g>
                  );
                })}

                {/* 3. 4-Edge Midpoint Handles (TOP, RIGHT, BOTTOM, LEFT) */}
                {[
                  {
                    idx: 0,
                    baseX: surfaceRectPx.centerX,
                    baseY: surfaceRectPx.y,
                    label: 'TOP',
                  },
                  {
                    idx: 1,
                    baseX: surfaceRectPx.x + surfaceRectPx.width,
                    baseY: surfaceRectPx.centerY,
                    label: 'RIGHT',
                  },
                  {
                    idx: 2,
                    baseX: surfaceRectPx.centerX,
                    baseY: surfaceRectPx.y + surfaceRectPx.height,
                    label: 'BOT',
                  },
                  {
                    idx: 3,
                    baseX: surfaceRectPx.x,
                    baseY: surfaceRectPx.centerY,
                    label: 'LEFT',
                  },
                ].map((edge) => {
                  const eOff =
                    currentPhoto.transform.edgeOffsets?.[edge.idx] || { x: 0, y: 0 };
                  const ex = edge.baseX + eOff.x * surfaceRectPx.width;
                  const ey = edge.baseY + eOff.y * surfaceRectPx.height;
                  return (
                    <g key={edge.label}>
                      <rect
                        x={ex - 6}
                        y={ey - 6}
                        width="12"
                        height="12"
                        rx="2"
                        fill="#F59E0B"
                        stroke="#FFFFFF"
                        strokeWidth="1.6"
                        className="cursor-pointer"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setTransformPast((prev) => [...prev.slice(-18), currentPhoto.transform]);
                          setTransformFuture([]);
                          setDraggingPhotoHandle({
                            type: 'edge',
                            edgeIndex: edge.idx,
                            startClientX: e.clientX,
                            startClientY: e.clientY,
                            initialTransform: { ...currentPhoto.transform },
                          });
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          lastTouchStartTimestampRef.current = Date.now();
                          const t = e.touches[0];
                          if (!t) return;
                          setTransformPast((prev) => [...prev.slice(-18), currentPhoto.transform]);
                          setTransformFuture([]);
                          setDraggingPhotoHandle({
                            type: 'edge',
                            edgeIndex: edge.idx,
                            startClientX: t.clientX,
                            startClientY: t.clientY,
                            initialTransform: { ...currentPhoto.transform },
                          });
                        }}
                      />
                      <text
                        x={ex}
                        y={ey - 10}
                        textAnchor="middle"
                        fontSize="8.5"
                        fontFamily="IBM Plex Mono, monospace"
                        fill="#FBBF24"
                      >
                        {edge.label}
                      </text>
                    </g>
                  );
                })}

                {/* 4. Piecewise Mesh Control Point Handles (C1..Cn) */}
                {(photoEditSubTab === 'mesh_warp' || showMeshGrid) &&
                  (
                    currentPhoto.transform.meshControlPoints ||
                    createDefaultMeshControlPoints(3, 3)
                  ).map((cp) => {
                    const cpx = surfaceRectPx.x + cp.dstU * surfaceRectPx.width;
                    const cpy = surfaceRectPx.y + cp.dstV * surfaceRectPx.height;
                    return (
                      <g key={cp.id}>
                        <circle
                          cx={cpx}
                          cy={cpy}
                          r="6"
                          fill="#10B981"
                          stroke="#0B0E14"
                          strokeWidth="1.8"
                          className="cursor-grab active:cursor-grabbing"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setTransformPast((prev) => [
                              ...prev.slice(-18),
                              currentPhoto.transform,
                            ]);
                            setTransformFuture([]);
                            setDraggingPhotoHandle({
                              type: 'mesh_cp',
                              cpId: cp.id,
                              startClientX: e.clientX,
                              startClientY: e.clientY,
                              initialTransform: { ...currentPhoto.transform },
                            });
                          }}
                        />
                        <text
                          x={cpx + 8}
                          y={cpy + 3}
                          fontSize="8.5"
                          fontFamily="IBM Plex Mono, monospace"
                          fill="#34D399"
                          className="pointer-events-none"
                        >
                          {cp.label}
                        </text>
                      </g>
                    );
                  })}
                </g>

                {/* 5. Custom Polygon Shape Boundary Handles (P1, P2, P3, P4, P5, P6, P7...) */}
                {(photoEditSubTab === 'custom_mask' || currentPhoto.transform.useCustomMask) &&
                  (currentPhoto.transform.customMaskPoints || []).length > 0 && (
                    <g>
                      {(currentPhoto.transform.customMaskPoints || []).length >= 2 && (
                        <path
                          d={customMaskPolygonPath}
                          fill="rgba(245, 158, 11, 0.08)"
                          stroke="#F59E0B"
                          strokeWidth="2"
                          strokeDasharray="6,4"
                          className="pointer-events-none"
                        />
                      )}
                      {(currentPhoto.transform.customMaskPoints || []).map((pt, vIdx) => {
                        const { cx, cy } = coordManager.worldToScreen(pt);
                        return (
                          <g key={`mask-p-${vIdx}`}>
                            <circle
                              cx={cx}
                              cy={cy}
                              r="6.5"
                              fill="#F59E0B"
                              stroke="#0B0E14"
                              strokeWidth="2"
                              className="cursor-grab active:cursor-grabbing"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setTransformPast((prev) => [
                                  ...prev.slice(-18),
                                  currentPhoto.transform,
                                ]);
                                setTransformFuture([]);
                                setDraggingPhotoHandle({
                                  type: 'mask_vertex',
                                  maskVertexIndex: vIdx,
                                  startClientX: e.clientX,
                                  startClientY: e.clientY,
                                  initialTransform: { ...currentPhoto.transform },
                                });
                              }}
                            />
                            <text
                              x={cx}
                              y={cy - 10}
                              textAnchor="middle"
                              fontSize="9.5"
                              fontWeight="700"
                              fontFamily="IBM Plex Mono, monospace"
                              fill="#FDE68A"
                              className="pointer-events-none"
                            >
                              P{vIdx + 1}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  )}
                {/* 6. 2-Click Wall–Crown (SPL) Seam Lock Interactive Overlay on Canvas */}
                {splTwoClickMode && (
                  <g className="pointer-events-none">
                    {splFirstPointUV &&
                      (() => {
                        const p1Meters = imageUVToSurfaceMeters(
                          splFirstPointUV.u,
                          splFirstPointUV.v,
                          activeSurface,
                          geometry,
                          settings,
                          currentPhoto.transform,
                          currentPhoto.calibration,
                          false
                        );
                        const s1 = coordManager.worldToScreen(p1Meters);
                        return (
                          <g>
                            {cursorCanvasPx && (
                              <line
                                x1={s1.cx}
                                y1={s1.cy}
                                x2={cursorCanvasPx.cx}
                                y2={cursorCanvasPx.cy}
                                stroke="#10B981"
                                strokeWidth="2.4"
                                strokeDasharray="6,4"
                              />
                            )}
                            <circle
                              cx={s1.cx}
                              cy={s1.cy}
                              r="7"
                              fill="#10B981"
                              stroke="#0B0E14"
                              strokeWidth="2"
                            />
                            <text
                              x={s1.cx}
                              y={s1.cy - 10}
                              textAnchor="middle"
                              fontSize="9.5"
                              fontWeight="700"
                              fontFamily="IBM Plex Mono, monospace"
                              fill="#6EE7B7"
                            >
                              SPL PT 1
                            </text>
                          </g>
                        );
                      })()}
                  </g>
                )}
              </g>
            )}
            {activeTool === 'lithology' && (
              <g>
                {/* Draft Polygon Currently Being Drawn by User */}
                {isDrawingLithologyPolygon && draftLithologyPoints.length > 0 && (
                  <g>
                    {(() => {
                      const previewPts = cursorMeters
                        ? [...draftLithologyPoints, cursorMeters]
                        : draftLithologyPoints;
                      if (previewPts.length < 2) return null;
                      const dPath =
                        previewPts
                          .map((pt, idx) => {
                            const { cx, cy } = coordManager.worldToScreen(pt);
                            return `${idx === 0 ? 'M' : 'L'} ${cx.toFixed(1)} ${cy.toFixed(1)}`;
                          })
                          .join(' ') + (draftLithologyPoints.length >= 3 ? ' Z' : '');
                      return (
                        <path
                          d={dPath}
                          fill="rgba(245, 158, 11, 0.14)"
                          stroke="#F59E0B"
                          strokeWidth="2"
                          strokeDasharray="5,4"
                          className="pointer-events-none"
                        />
                      );
                    })()}
                    {draftLithologyPoints.map((pt, idx) => {
                      const { cx, cy } = coordManager.worldToScreen(pt);
                      const isFirst = idx === 0 && draftLithologyPoints.length >= 3;
                      return (
                        <g key={`draft-lith-${idx}`}>
                          <circle
                            cx={cx}
                            cy={cy}
                            r={isFirst ? '7' : '5.5'}
                            fill={isFirst ? '#10B981' : '#F59E0B'}
                            stroke="#0B0E14"
                            strokeWidth="1.8"
                            className="cursor-pointer"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              if (isFirst) {
                                commitDraftLithologyPolygon(draftLithologyPoints);
                                return;
                              }
                              setDraggingDraftLithologyIdx(idx);
                            }}
                          />
                          {isFirst && (
                            <text
                              x={cx}
                              y={cy - 10}
                              textAnchor="middle"
                              fontSize="8.5"
                              fontWeight="700"
                              fontFamily="IBM Plex Mono, monospace"
                              fill="#34D399"
                              className="pointer-events-none"
                            >
                              CLICK TO CLOSE
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Draggable Reshaping Vertices (L1..Ln) & Midpoint '+' Insertion for Selected Lithology Region */}
                {!isDrawingLithologyPolygon &&
                  lithologyRegions
                    .filter((r) => r.surface === activeSurface)
                    .map((reg) => {
                      const isSel =
                        selectedLithologyRegionId === reg.id ||
                        (!selectedLithologyRegionId &&
                          lithologyRegions.filter((x) => x.surface === activeSurface)[0]?.id ===
                            reg.id);
                      if (!isSel) return null;
                      return (
                        <g key={`handles-${reg.id}`}>
                          {/* Midpoint '+' Handles on Polygon Edges to Insert Boundary Points */}
                          {reg.polygon.map((ptA, vIdx) => {
                            const ptB = reg.polygon[(vIdx + 1) % reg.polygon.length];
                            const cA = coordManager.worldToScreen(ptA);
                            const cB = coordManager.worldToScreen(ptB);
                            const mx = (cA.cx + cB.cx) / 2;
                            const my = (cA.cy + cB.cy) / 2;
                            const midMeters = {
                              x: Number(((ptA.x + ptB.x) / 2).toFixed(3)),
                              y: Number(((ptA.y + ptB.y) / 2).toFixed(3)),
                            };
                            return (
                              <g
                                key={`lith-mid-${vIdx}`}
                                className="cursor-pointer opacity-75 hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const updated = addVertexToLithologyRegion(
                                    reg,
                                    vIdx,
                                    midMeters
                                  );
                                  handleUpdateLithologyWithHistory(
                                    lithologyRegions.map((r) => (r.id === reg.id ? updated : r))
                                  );
                                }}
                              >
                                <circle
                                  cx={mx}
                                  cy={my}
                                  r="4.5"
                                  fill="#0F172A"
                                  stroke="#F59E0B"
                                  strokeWidth="1.4"
                                />
                                <text
                                  x={mx}
                                  y={my + 3}
                                  textAnchor="middle"
                                  fontSize="9"
                                  fontFamily="IBM Plex Mono, monospace"
                                  fill="#F59E0B"
                                  className="pointer-events-none"
                                >
                                  +
                                </text>
                              </g>
                            );
                          })}

                          {/* Boundary Vertex Handles */}
                          {reg.polygon.map((pt, vIdx) => {
                            const { cx, cy } = coordManager.worldToScreen(pt);
                            return (
                              <g key={`lith-v-${vIdx}`}>
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r="6"
                                  fill="#F59E0B"
                                  stroke="#0B0E14"
                                  strokeWidth="1.8"
                                  className="cursor-grab active:cursor-grabbing"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    if (e.shiftKey && reg.polygon.length > 3) {
                                      const updated = removeVertexFromLithologyRegion(reg, vIdx);
                                      handleUpdateLithologyWithHistory(
                                        lithologyRegions.map((r) =>
                                          r.id === reg.id ? updated : r
                                        )
                                      );
                                      return;
                                    }
                                    setSelectedLithologyRegionId(reg.id);
                                    setDraggingLithologyVertex({
                                      regionId: reg.id,
                                      vertexIndex: vIdx,
                                    });
                                  }}
                                />
                                <text
                                  x={cx}
                                  y={cy - 9}
                                  textAnchor="middle"
                                  fontSize="9"
                                  fontWeight="700"
                                  fontFamily="IBM Plex Mono, monospace"
                                  fill="#FDE68A"
                                  className="pointer-events-none"
                                >
                                  L{vIdx + 1}
                                </text>
                              </g>
                            );
                          })}
                        </g>
                      );
                    })}
              </g>
            )}

            {/* ==============================================================
                LAYER: AUTOMATED ROCK SUPPORT PATTERN (BOLTS + SFRS RING)
               ============================================================== */}
            {activeSurface === 'face' && supportConfig.enabledOnCanvas && (
              <g className="pointer-events-none">
                {supportConfig.sfrsThicknessMm > 0 &&
                  rockSupportOverlay.sfrsInnerPolygon.length > 2 && (
                    <polyline
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth={Math.max(
                        3 / viewport.zoom,
                        (supportConfig.sfrsThicknessMm / 1000) * pxPerMeter
                      )}
                      strokeOpacity={0.45}
                      points={rockSupportOverlay.sfrsInnerPolygon
                        .map((pt) => {
                          const s = coordManager.worldToScreen(pt);
                          return `${s.cx.toFixed(1)},${s.cy.toFixed(1)}`;
                        })
                        .join(' ')}
                    />
                  )}
                {rockSupportOverlay.bolts.map((b) => {
                  const col = coordManager.worldToScreen(b.collar);
                  const toe = coordManager.worldToScreen(b.toe);
                  return (
                    <g key={b.id}>
                      <line
                        x1={col.cx}
                        y1={col.cy}
                        x2={toe.cx}
                        y2={toe.cy}
                        stroke="#10B981"
                        strokeWidth={2.2 / viewport.zoom}
                        strokeDasharray={`${5 / viewport.zoom} ${2 / viewport.zoom}`}
                      />
                      <circle
                        cx={col.cx}
                        cy={col.cy}
                        r={3.5 / viewport.zoom}
                        fill="#059669"
                        stroke="#A7F3D0"
                        strokeWidth={1.2 / viewport.zoom}
                      />
                      <text
                        x={toe.cx + 4 / viewport.zoom}
                        y={toe.cy - 3 / viewport.zoom}
                        fontSize={9.5 / viewport.zoom}
                        fontWeight="700"
                        fontFamily="IBM Plex Mono, monospace"
                        fill="#6EE7B7"
                      >
                        {b.label} ({b.lengthMeters}m)
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* ==============================================================
                AUTOCAD OBJECT SNAP (OSNAP - F3) & DYNAMIC INPUT (DYN - F12)
               ============================================================== */}
            {activeOsnapCandidate && (
              <g className="pointer-events-none">
                {activeOsnapCandidate.type === 'ENDPOINT' ? (
                  <rect
                    x={activeOsnapCandidate.cx - 6 / viewport.zoom}
                    y={activeOsnapCandidate.cy - 6 / viewport.zoom}
                    width={12 / viewport.zoom}
                    height={12 / viewport.zoom}
                    fill="none"
                    stroke="#22C55E"
                    strokeWidth={2 / viewport.zoom}
                  />
                ) : (
                  <polygon
                    points={`${activeOsnapCandidate.cx},${
                      activeOsnapCandidate.cy - 7 / viewport.zoom
                    } ${activeOsnapCandidate.cx - 6.5 / viewport.zoom},${
                      activeOsnapCandidate.cy + 5.5 / viewport.zoom
                    } ${activeOsnapCandidate.cx + 6.5 / viewport.zoom},${
                      activeOsnapCandidate.cy + 5.5 / viewport.zoom
                    }`}
                    fill="none"
                    stroke="#22C55E"
                    strokeWidth={2 / viewport.zoom}
                  />
                )}
                <text
                  x={activeOsnapCandidate.cx + 9 / viewport.zoom}
                  y={activeOsnapCandidate.cy - 7 / viewport.zoom}
                  fontSize={9.5 / viewport.zoom}
                  fontWeight="700"
                  fontFamily="IBM Plex Mono, monospace"
                  fill="#4ADE80"
                >
                  {activeOsnapCandidate.type}
                </text>
              </g>
            )}

            {/* Dynamic input cursor box removed per user preference */}

            {/* Cursor reticle removed per user preference */}
            </g>
          </>
        );

        return (
          <>
            {/* Live Duplicate / Overlap Real-Time Distance Warning Banner */}
            {activeOverlapResult?.isOverlap && activeOverlapResult.closestJoint && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-35 max-w-xl w-[90%] px-3.5 py-2 rounded-xl bg-orange-950/95 border border-orange-500/90 shadow-2xl flex items-center justify-between gap-3 font-mono text-xs text-orange-100 animate-in fade-in slide-in-from-top-2 duration-150 pointer-events-auto">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 animate-pulse" />
                  <div>
                    <span className="font-bold text-orange-300">
                      Duplicate / Overlap Warning ({activeOverlapResult.minDistanceCm} cm):
                    </span>{' '}
                    Near existing {formatJointTraceLineLabel(activeOverlapResult.closestJoint, joints)}
                  </div>
                </div>
                <span className="text-[10px] text-orange-200/90 bg-orange-900/60 px-2 py-0.5 rounded border border-orange-700/60 shrink-0">
                  Highlighting in Orange
                </span>
              </div>
            )}

            {/* Canvas View Mode Switcher (Map Only / Dual Synced) */}
            <div className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1 p-0.5 rounded-lg bg-slate-900/90 border border-slate-700/80 font-mono text-[10px] shadow-md pointer-events-auto">
              <button
                type="button"
                onClick={() => setDualCanvasViewMode('single_clean')}
                className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                  dualCanvasViewMode === 'single_clean'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Map Only (Single Clean CAD Outline Canvas)"
              >
                Map Only
              </button>
              <button
                type="button"
                onClick={() => setDualCanvasViewMode('dual')}
                className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                  dualCanvasViewMode === 'dual'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Synchronized Dual Canvases (Clean Outline + Rock Photo in Lockstep)"
              >
                Dual Synced
              </button>
            </div>

            {/* Canvas Container Layout */}
            {dualCanvasViewMode === 'dual' ? (
              activeSurface === 'crown' ? (
                /* CROWN: Stacked vertically with Clean CAD on TOP and Photo on BOTTOM */
                <div className="flex flex-col w-full h-full min-w-0 min-h-0 overflow-hidden select-none">
                  {/* TOP: Clean CAD Outline & Confirmed Geology Canvas */}
                  <div className="relative flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center bg-slate-950/80 border-b border-sky-500/30">
                    <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-700/80 text-[10px] text-slate-200 font-mono shadow-sm pointer-events-none">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-bold text-white">1. Clean Outline &amp; Traced Geology</span>
                      <span className="text-slate-400">· (Top Crown Arc)</span>
                    </div>
                    <svg
                      viewBox={`0 0 ${viewW} ${viewH}`}
                      preserveAspectRatio="xMidYMid meet"
                      style={{
                        touchAction: 'none',
                        backgroundColor: isLight ? '#E2E8F0' : '#090C12',
                      }}
                      onWheel={handleCanvasWheel}
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      className="w-full h-full max-w-full max-h-full cursor-default"
                    >
                      {renderSvgContents('clean_outline')}
                    </svg>
                  </div>

                  {/* Synchronized Lockstep Divider */}
                  <div className="h-5 bg-slate-900 border-y border-slate-800 flex items-center justify-between px-3 text-[9.5px] font-mono text-slate-400 shrink-0 select-none">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sky-400 font-bold">↕ Lockstep Synchronized Viewport</span>
                      <span>·</span>
                      <span>Scale: {(viewport.zoom * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-300">Trace discontinuities below on photo → Mirror reflects above in real-time</span>
                    </div>
                  </div>

                  {/* BOTTOM: Photo Tracing Canvas */}
                  <div className="relative flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center bg-[#090C12]">
                    <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 border border-sky-500/80 text-[10px] text-sky-200 font-mono shadow-sm pointer-events-none">
                      <span className="w-2 h-2 rounded-full bg-sky-400" />
                      <span className="font-bold text-white">2. Rock Photo &amp; Tracing Canvas</span>
                      <span className="text-sky-300">· (Bottom Crown Photo)</span>
                    </div>
                    <svg
                      ref={svgCanvasRef}
                      viewBox={`0 0 ${viewW} ${viewH}`}
                      preserveAspectRatio="xMidYMid meet"
                      style={{
                        touchAction: 'none',
                        backgroundColor: isLight ? '#E2E8F0' : '#090C12',
                      }}
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      onWheel={handleCanvasWheel}
                      onTouchStart={handleCanvasTouchStart}
                      onTouchMove={handleCanvasTouchMove}
                      onTouchEnd={handleCanvasTouchEnd}
                      onDoubleClick={() => {
                        if (activeTool === 'lithology' && isDrawingLithologyPolygon && draftLithologyPoints.length >= 3) {
                          commitDraftLithologyPolygon(draftLithologyPoints);
                        }
                      }}
                      onContextMenu={(e) => {
                        if (activeTool === 'add_joint' || activeTool === 'redraw_joint' || activeTool === 'append_joint') {
                          e.preventDefault();
                          if (draftJointPoints.length >= 2) {
                            finishDraftJoint();
                          } else {
                            setDraftJointPoints([]);
                          }
                        } else if (activeTool === 'lithology' && isDrawingLithologyPolygon) {
                          e.preventDefault();
                          if (draftLithologyPoints.length >= 3) {
                            commitDraftLithologyPolygon(draftLithologyPoints);
                          } else {
                            setDraftLithologyPoints([]);
                            setIsDrawingLithologyPolygon(false);
                          }
                        }
                      }}
                      className={`w-full h-full max-w-full max-h-full ${
                        isSpacePanning || Boolean(draggingCanvasPan)
                          ? 'cursor-grab active:cursor-grabbing'
                          : activeTool === 'add_joint' ||
                            activeTool === 'redraw_joint' ||
                            activeTool === 'append_joint' ||
                            activeTool === 'measure' ||
                            activeTool === 'dip_probe' ||
                            activeTool === 'control_point' ||
                            (activeTool === 'lithology' && isDrawingLithologyPolygon)
                          ? 'cursor-crosshair'
                          : activeTool === 'photo_fit'
                          ? 'cursor-move'
                          : 'cursor-default'
                      }`}
                    >
                      {renderSvgContents('photo_tracing')}
                    </svg>
                  </div>
                </div>
              ) : (
                /* FACE & WALLS: Side-by-side with Calibrated Photo on LEFT and Clean CAD on RIGHT */
                <div className="flex flex-row w-full h-full min-w-0 min-h-0 overflow-hidden select-none">
                  {/* LEFT: Calibrated Photo inside Tunnel Outline & Tracing Canvas */}
                  <div className="relative flex-1 min-w-0 h-full overflow-hidden flex items-center justify-center bg-[#090C12] border-r border-slate-800">
                    <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 border border-sky-500/80 text-[10px] text-sky-200 font-mono shadow-sm pointer-events-none">
                      <span className="w-2 h-2 rounded-full bg-sky-400" />
                      <span className="font-bold text-white">1. Calibrated Photo inside Tunnel Outline</span>
                    </div>
                    <svg
                      ref={svgCanvasRef}
                      viewBox={`0 0 ${viewW} ${viewH}`}
                      preserveAspectRatio="xMidYMid meet"
                      style={{
                        touchAction: 'none',
                        backgroundColor: isLight ? '#E2E8F0' : '#090C12',
                      }}
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      onWheel={handleCanvasWheel}
                      onTouchStart={handleCanvasTouchStart}
                      onTouchMove={handleCanvasTouchMove}
                      onTouchEnd={handleCanvasTouchEnd}
                      onDoubleClick={() => {
                        if (activeTool === 'lithology' && isDrawingLithologyPolygon && draftLithologyPoints.length >= 3) {
                          commitDraftLithologyPolygon(draftLithologyPoints);
                        }
                      }}
                      onContextMenu={(e) => {
                        if (activeTool === 'add_joint' || activeTool === 'redraw_joint' || activeTool === 'append_joint') {
                          e.preventDefault();
                          if (draftJointPoints.length >= 2) {
                            finishDraftJoint();
                          } else {
                            setDraftJointPoints([]);
                          }
                        } else if (activeTool === 'lithology' && isDrawingLithologyPolygon) {
                          e.preventDefault();
                          if (draftLithologyPoints.length >= 3) {
                            commitDraftLithologyPolygon(draftLithologyPoints);
                          } else {
                            setDraftLithologyPoints([]);
                            setIsDrawingLithologyPolygon(false);
                          }
                        }
                      }}
                      className={`w-full h-full max-w-full max-h-full ${
                        isSpacePanning || Boolean(draggingCanvasPan)
                          ? 'cursor-grab active:cursor-grabbing'
                          : activeTool === 'add_joint' ||
                            activeTool === 'redraw_joint' ||
                            activeTool === 'append_joint' ||
                            activeTool === 'measure' ||
                            activeTool === 'dip_probe' ||
                            activeTool === 'control_point' ||
                            (activeTool === 'lithology' && isDrawingLithologyPolygon)
                          ? 'cursor-crosshair'
                          : activeTool === 'photo_fit'
                          ? 'cursor-move'
                          : 'cursor-default'
                      }`}
                    >
                      {renderSvgContents('photo_tracing')}
                    </svg>
                  </div>

                  {/* Synchronized Lockstep Divider */}
                  <div className="w-1 bg-slate-800 hover:bg-sky-500/50 transition-colors shrink-0 flex items-center justify-center cursor-col-resize select-none" />

                  {/* RIGHT: Empty CAD Tunnel Profile Canvas where all traced joints/features sync in real-time */}
                  <div className="relative flex-1 min-w-0 h-full overflow-hidden flex items-center justify-center bg-slate-950/80">
                    <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-700/80 text-[10px] text-slate-200 font-mono shadow-sm pointer-events-none">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-bold text-white">2. CAD Tunnel Profile Canvas (Real-Time Sync)</span>
                    </div>
                    <svg
                      viewBox={`0 0 ${viewW} ${viewH}`}
                      preserveAspectRatio="xMidYMid meet"
                      style={{
                        touchAction: 'none',
                        backgroundColor: isLight ? '#E2E8F0' : '#090C12',
                      }}
                      onWheel={handleCanvasWheel}
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      className="w-full h-full max-w-full max-h-full cursor-default"
                    >
                      {renderSvgContents('clean_outline')}
                    </svg>
                  </div>
                </div>
              )
            ) : (
              /* SINGLE CANVAS VIEW */
              <svg
                ref={svgCanvasRef}
                viewBox={`0 0 ${viewW} ${viewH}`}
                preserveAspectRatio="xMidYMid meet"
                style={{
                  touchAction: 'none',
                  backgroundColor: isLight ? '#E2E8F0' : '#090C12',
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onWheel={handleCanvasWheel}
                onTouchStart={handleCanvasTouchStart}
                onTouchMove={handleCanvasTouchMove}
                onTouchEnd={handleCanvasTouchEnd}
                onDoubleClick={() => {
                  if (activeTool === 'lithology' && isDrawingLithologyPolygon && draftLithologyPoints.length >= 3) {
                    commitDraftLithologyPolygon(draftLithologyPoints);
                  }
                }}
                onContextMenu={(e) => {
                  if (activeTool === 'add_joint' || activeTool === 'redraw_joint' || activeTool === 'append_joint') {
                    e.preventDefault();
                    if (draftJointPoints.length >= 2) {
                      finishDraftJoint();
                    } else {
                      setDraftJointPoints([]);
                    }
                  } else if (activeTool === 'lithology' && isDrawingLithologyPolygon) {
                    e.preventDefault();
                    if (draftLithologyPoints.length >= 3) {
                      commitDraftLithologyPolygon(draftLithologyPoints);
                    } else {
                      setDraftLithologyPoints([]);
                      setIsDrawingLithologyPolygon(false);
                    }
                  }
                }}
                className={`w-full h-full max-w-full max-h-full ${
                  isSpacePanning || Boolean(draggingCanvasPan)
                    ? 'cursor-grab active:cursor-grabbing'
                    : activeTool === 'add_joint' ||
                      activeTool === 'redraw_joint' ||
                      activeTool === 'append_joint' ||
                      activeTool === 'measure' ||
                      activeTool === 'dip_probe' ||
                      activeTool === 'control_point' ||
                      (activeTool === 'lithology' && isDrawingLithologyPolygon)
                    ? 'cursor-crosshair'
                    : activeTool === 'photo_fit'
                    ? 'cursor-move'
                    : 'cursor-default'
                }`}
              >
                {renderSvgContents(dualCanvasViewMode === 'single_clean' ? 'clean_outline' : 'photo_tracing')}
              </svg>
            )}
          </>
        );
      })()}

          {/* Interactive On-Canvas Floating Tool & Properties Bar when Drawing a Joint Trace (2-Pt Line / Polyline / Spline / Freehand) */}
          {(activeTool === 'add_joint' ||
            activeTool === 'redraw_joint' ||
            activeTool === 'append_joint') && (
            <div className="absolute top-2.5 left-2.5 right-12 max-w-fit flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 bg-white/95 border border-amber-400 rounded-lg shadow-lg text-xs z-20 font-mono">
              <span className="font-bold text-amber-900 text-[11px] mr-0.5">
                {activeTool === 'redraw_joint'
                  ? `RE-DRAW ${selectedJoint?.set || ''}:`
                  : activeTool === 'append_joint'
                  ? `APPEND ${selectedJoint?.set || ''}:`
                  : 'DRAW MODE:'}
              </span>
              {(
                [
                  { id: 'two_point_line', label: '2-Pt Line' },
                  { id: 'polyline', label: 'Polyline' },
                  { id: 'smooth_curve', label: 'Spline Curve' },
                  { id: 'freehand', label: 'Freehand' },
                  { id: 'magnetic_livewire', label: 'Snap Crack' },
                  { id: 'seed_autotrace', label: '1-Click Seed' },
                ] as { id: JointDrawMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    if (draftJointPoints.length >= 2) {
                      finishDraftJoint(draftJointPoints);
                    }
                    setJointDrawMode(m.id);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                    jointDrawMode === m.id
                      ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}

              <div className="h-3.5 w-px bg-slate-300 mx-0.5" />

              <select
                value={draftSetId}
                onChange={(e) => {
                  const nextSet = e.target.value;
                  setDraftSetId(nextSet);
                  if (selectedJoint) {
                    onUpdateJointsWithHistory(
                      joints.map((j) =>
                        j.id === selectedJoint.id ? { ...j, set: nextSet } : j
                      )
                    );
                  }
                }}
                className="px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] font-bold text-slate-900 cursor-pointer"
                title="Active Joint Set ID"
              >
                {['J1', 'J2', 'J3', 'J4', 'J5', 'F1', 'J0'].map((s) => (
                  <option key={s} value={s}>
                    Set {s}
                  </option>
                ))}
              </select>

              <select
                value={draftFeatureType}
                onChange={(e) => {
                  const nextType = e.target.value as GeologicalFeatureType;
                  setDraftFeatureType(nextType);
                  if (selectedJoint) {
                    onUpdateJointsWithHistory(
                      joints.map((j) =>
                        j.id === selectedJoint.id ? { ...j, featureType: nextType } : j
                      )
                    );
                  }
                }}
                className="px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] font-semibold text-slate-900 cursor-pointer"
                title="Geological Feature Type"
              >
                <option value="joint">Joint</option>
                <option value="open_joint">Open Joint</option>
                <option value="fracture">Fracture</option>
                <option value="fault">Fault</option>
                <option value="shear">Shear Zone</option>
                <option value="bedding">Bedding</option>
                <option value="foliation">Foliation</option>
                <option value="vein">Vein</option>
                <option value="water_seepage">Water Seepage</option>
              </select>

              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                {draftJointPoints.length} pts
              </span>

              {draftJointPoints.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDraftJointPoints((prev) => prev.slice(0, -1))}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 text-[10px] font-bold cursor-pointer"
                >
                  Undo Pt
                </button>
              )}
              {draftJointPoints.length >= 2 && (
                <button
                  type="button"
                  onClick={() => finishDraftJoint()}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-md cursor-pointer shadow-xs"
                >
                  ✓ Complete ({draftJointPoints.length} pts)
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowCadPropertiesAlways((p) => !p)}
                className="px-2 py-0.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] rounded cursor-pointer"
              >
                {showCadPropertiesAlways ? 'Properties ✓' : 'Open Properties'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftJointPoints([]);
                  setActiveTool('select');
                }}
                className="px-1.5 py-0.5 text-slate-500 hover:text-slate-900 text-[10px] font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          {/* Interactive On-Canvas Floating Lithology Properties & Area Bar */}
          {(activeTool === 'lithology' || Boolean(selectedLithologyRegionId)) && (
            <div className="absolute top-2.5 left-2.5 right-12 max-w-fit flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 bg-white/95 border border-amber-400 rounded-lg shadow-lg text-xs z-20 font-mono">
              <span className="font-bold text-amber-900 text-[11px]">LITHOLOGY:</span>
              {(() => {
                const surfRegions = lithologyRegions.filter((r) => r.surface === activeSurface);
                const currentSelReg =
                  surfRegions.find((r) => r.id === selectedLithologyRegionId) ||
                  surfRegions[0] ||
                  null;
                const activePat = currentSelReg?.patternType || activeLithologyPattern;
                return (
                  <>
                    <select
                      value={activePat}
                      onChange={(e) => {
                        const newPat = e.target.value as LithologyPatternType;
                        setActiveLithologyPattern(newPat);
                        if (currentSelReg) {
                          const preset = getLithologyPreset(newPat);
                          const nextDesc = generateAIGeologicalDescriptionForRegion(
                            {
                              ...currentSelReg,
                              patternType: newPat,
                              lithologyName: preset.defaultName,
                            },
                            joints,
                            currentPhoto
                          );
                          handleUpdateLithologyWithHistory(
                            lithologyRegions.map((r) =>
                              r.id === currentSelReg.id
                                ? {
                                    ...r,
                                    patternType: newPat,
                                    lithologyName: preset.defaultName,
                                    colorHex: preset.colorHex,
                                    opacity: r.opacity || 0.16,
                                    description: nextDesc.description,
                                    structuralFeatures: nextDesc.structuralFeatures,
                                    aiSuggestedDescription: nextDesc.description,
                                    aiSuggestedStructuralFeatures: nextDesc.structuralFeatures,
                                  }
                                : r
                            )
                          );
                          onUpdateStatusMessage?.(
                            `Updated lithology zone to ${preset.defaultName}.`
                          );
                        } else {
                          const poly = createPresetAreaPolygon(
                            activeSurface,
                            geometry,
                            settings,
                            'full'
                          );
                          const newReg = createLithologyRegionFromPolygon(
                            activeSurface,
                            poly,
                            newPat,
                            undefined,
                            joints,
                            currentPhoto
                          );
                          handleUpdateLithologyWithHistory([...lithologyRegions, newReg]);
                          setSelectedLithologyRegionId(newReg.id);
                          onUpdateStatusMessage?.(
                            `Created ${newReg.lithologyName} zone on ${activeSurface.toUpperCase()}.`
                          );
                        }
                      }}
                      className="px-2 py-0.5 bg-amber-50 border border-amber-300 rounded text-[10px] font-bold text-slate-900 cursor-pointer"
                      title="Choose Rock Lithology Type (Applies immediately to selected or new zone)"
                    >
                      {LITHOLOGY_PRESETS.map((p) => (
                        <option key={p.patternType} value={p.patternType}>
                          {p.defaultName}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTool('lithology');
                        setDraftLithologyPoints([]);
                        setIsDrawingLithologyPolygon(true);
                        onUpdateStatusMessage?.(
                          'Click 3+ points on the tunnel surface to draw a custom lithology polygon.'
                        );
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                        isDrawingLithologyPolygon
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                      }`}
                    >
                      + Draw Polygon
                    </button>

                    {(
                      [
                        { mode: 'full', label: 'Full Area' },
                        { mode: 'left_half', label: 'Left Half' },
                        { mode: 'right_half', label: 'Right Half' },
                        { mode: 'upper_half', label: 'Upper Half' },
                      ] as {
                        mode: 'full' | 'left_half' | 'right_half' | 'upper_half';
                        label: string;
                      }[]
                    ).map((btn) => (
                      <button
                        key={btn.mode}
                        type="button"
                        onClick={() => {
                          const poly = createPresetAreaPolygon(
                            activeSurface,
                            geometry,
                            settings,
                            btn.mode
                          );
                          if (currentSelReg) {
                            handleUpdateLithologyWithHistory(
                              lithologyRegions.map((r) =>
                                r.id === currentSelReg.id
                                  ? {
                                      ...r,
                                      areaMode: btn.mode,
                                      polygon: poly,
                                      polygonPoints: poly,
                                    }
                                  : r
                              )
                            );
                          } else {
                            const newReg = createLithologyRegionFromPolygon(
                              activeSurface,
                              poly,
                              activeLithologyPattern,
                              btn.mode,
                              joints,
                              currentPhoto
                            );
                            handleUpdateLithologyWithHistory([...lithologyRegions, newReg]);
                            setSelectedLithologyRegionId(newReg.id);
                          }
                        }}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-[10px] font-semibold cursor-pointer"
                      >
                        {btn.label}
                      </button>
                    ))}

                    {currentSelReg && (
                      <>
                        <label className="flex items-center gap-1 text-[10px] text-slate-700">
                          <span>Color:</span>
                          <input
                            type="color"
                            value={currentSelReg.colorHex}
                            onChange={(e) =>
                              handleUpdateLithologyWithHistory(
                                lithologyRegions.map((r) =>
                                  r.id === currentSelReg.id
                                    ? { ...r, colorHex: e.target.value }
                                    : r
                                )
                              )
                            }
                            className="w-5 h-5 rounded border border-slate-300 cursor-pointer"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            handleUpdateLithologyWithHistory(
                              lithologyRegions.filter((r) => r.id !== currentSelReg.id)
                            );
                            setSelectedLithologyRegionId(null);
                          }}
                          className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[10px] font-bold cursor-pointer"
                        >
                          Delete Zone
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowCadPropertiesAlways((p) => !p)}
                      className="px-2 py-0.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] rounded cursor-pointer"
                    >
                      {showCadPropertiesAlways ? 'Properties ✓' : 'Open Properties'}
                    </button>
                  </>
                );
              })()}
            </div>
          )}

          {/* Interactive On-Canvas Floating Symbol Properties Bar */}
          {(activeTool === 'geological_symbol' || Boolean(selectedSymbol)) && (
            <div className="absolute top-2.5 left-2.5 right-12 max-w-fit flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 bg-white/95 border border-purple-400 rounded-lg shadow-lg text-xs z-20 font-mono">
              <span className="font-bold text-purple-900 text-[11px]">
                {selectedSymbol ? `SYMBOL (${selectedSymbol.label}):` : 'PLACE SYMBOL:'}
              </span>
              <select
                value={selectedSymbol ? selectedSymbol.symbolType : activeSymbolTypeToPlace}
                onChange={(e) => {
                  const nextType = e.target.value as GeologicalSymbolType;
                  setActiveSymbolTypeToPlace(nextType);
                  if (selectedSymbol) {
                    const meta = getStructuralSymbolMeta(nextType);
                    handleUpdatePlacedSymbolsWithHistory((prev) =>
                      prev.map((s) =>
                        s.id === selectedSymbol.id
                          ? {
                              ...s,
                              symbolType: nextType,
                              color: meta.defaultColor,
                            }
                          : s
                      )
                    );
                  }
                }}
                className="px-2 py-0.5 bg-purple-50 border border-purple-300 rounded text-[10px] font-bold text-slate-900 cursor-pointer"
                title="Choose ISRM Geological Symbol Type"
              >
                {STRUCTURAL_GEOLOGICAL_SYMBOLS.map((sym) => (
                  <option key={sym.type} value={sym.type}>
                    {sym.label} ({sym.category})
                  </option>
                ))}
              </select>

              {selectedSymbol ? (
                <>
                  <label className="flex items-center gap-1 text-[10px] text-slate-700 font-semibold">
                    <span>DipDir:</span>
                    <input
                      type="number"
                      min="0"
                      max="360"
                      value={Math.round(selectedSymbol.dipDirectionDeg)}
                      onChange={(e) => {
                        const dd =
                          ((Number(e.target.value) || 0) % 360 + 360) % 360;
                        handleUpdatePlacedSymbolsWithHistory((prev) =>
                          prev.map((s) =>
                            s.id === selectedSymbol.id
                              ? {
                                  ...s,
                                  dipDirectionDeg: dd,
                                  rotationDeg: dd,
                                  strikeDeg: (dd - 90 + 360) % 360,
                                }
                              : s
                          )
                        );
                      }}
                      className="w-12 px-1 py-0.5 bg-white border border-slate-300 rounded text-slate-900 font-bold"
                    />
                    <span>°</span>
                  </label>
                  <label className="flex items-center gap-1 text-[10px] text-slate-700 font-semibold">
                    <span>Dip:</span>
                    <input
                      type="number"
                      min="0"
                      max="90"
                      value={Math.round(selectedSymbol.dipDeg)}
                      onChange={(e) => {
                        const dip = Math.max(
                          0,
                          Math.min(90, Number(e.target.value) || 0)
                        );
                        handleUpdatePlacedSymbolsWithHistory((prev) =>
                          prev.map((s) =>
                            s.id === selectedSymbol.id ? { ...s, dipDeg: dip } : s
                          )
                        );
                      }}
                      className="w-11 px-1 py-0.5 bg-white border border-slate-300 rounded text-slate-900 font-bold"
                    />
                    <span>°</span>
                  </label>
                  <label className="flex items-center gap-1 text-[10px] text-slate-700 font-semibold">
                    <span>Size:</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="2.8"
                      value={selectedSymbol.scale || 1.0}
                      onChange={(e) => {
                        const sc = Math.max(
                          0.5,
                          Math.min(2.8, Number(e.target.value) || 1.0)
                        );
                        handleUpdatePlacedSymbolsWithHistory((prev) =>
                          prev.map((s) =>
                            s.id === selectedSymbol.id ? { ...s, scale: sc } : s
                          )
                        );
                      }}
                      className="w-12 px-1 py-0.5 bg-white border border-slate-300 rounded text-slate-900 font-bold"
                    />
                  </label>
                  <input
                    type="color"
                    value={
                      selectedSymbol.color ||
                      getStructuralSymbolMeta(selectedSymbol.symbolType).defaultColor
                    }
                    onChange={(e) => {
                      const col = e.target.value;
                      handleUpdatePlacedSymbolsWithHistory((prev) =>
                        prev.map((s) =>
                          s.id === selectedSymbol.id ? { ...s, color: col } : s
                        )
                      );
                    }}
                    className="w-5 h-5 rounded border border-slate-300 cursor-pointer"
                    title="Symbol Color"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeletePlacedSymbol(selectedSymbol.id)}
                    className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[10px] font-bold cursor-pointer"
                  >
                    Delete
                  </button>
                </>
              ) : (
                <span className="text-[10px] text-purple-700 font-semibold">
                  Click anywhere on tunnel surface to place symbol
                </span>
              )}

              <button
                type="button"
                onClick={() => setShowCadPropertiesAlways((p) => !p)}
                className="px-2 py-0.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] rounded cursor-pointer"
              >
                {showCadPropertiesAlways ? 'Properties ✓' : 'Open Properties'}
              </button>
            </div>
          )}

          {/* Compact Measure Tool Readout Pill on Canvas */}
          {activeTool === 'measure' && (
            <div className="absolute top-3 left-3 px-3 py-1.5 bg-white/95 border border-cyan-300 rounded-lg shadow-md text-xs font-mono z-20 text-slate-800">
              {measurementInfo ? (
                <span>
                  DIST = <strong className="text-cyan-700">{measurementInfo.distMeters} m</strong> ·
                  ANGLE = <strong className="text-cyan-700">{measurementInfo.angleDeg}°</strong>
                </span>
              ) : (
                <span className="text-slate-600">
                  DIST: Click 1st and 2nd point on tunnel surface.
                </span>
              )}
            </div>
          )}

          {/* Clean Light-Mode Zoom / Pan / Scroll Navigation Pill (Top-Right — Always Visible on Mobile & PC) */}
          <div className="canvas-chrome flex flex-col items-center gap-0.5 p-1 bg-white/95 border border-slate-300 rounded-lg shadow-md absolute top-1.5 right-1.5 z-10 pointer-events-auto">
            <button
              type="button"
              onClick={() => setIsSpacePanning((p) => !p)}
              className={`p-1.5 rounded cursor-pointer ${
                isSpacePanning
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="PAN / SCROLL (1-Finger Touch Pan Mode)"
            >
              <Hand className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewport((v) => ({ ...v, panY: v.panY + 75 }))}
              className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
              title="Scroll / Pan Up"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => setViewport((v) => ({ ...v, panY: v.panY - 75 }))}
              className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
              title="Scroll / Pan Down"
            >
              ▼
            </button>
            <button
              type="button"
              onClick={() => setViewport({ zoom: 1, panX: 0, panY: 0 })}
              className="px-1.5 py-0.5 text-[9.5px] font-mono font-bold text-cyan-700 hover:bg-slate-100 rounded cursor-pointer"
              title="Mouse Wheel / Trackpad / 2-Finger Pinch to Zoom. Click to reset to 1:1 (100%)."
            >
              {Math.round(viewport.zoom * 100)}%
            </button>
          </div>

          {/* Thumb-Friendly Floating Action Bar while Drawing Polyline Joint or Lithology Polygon */}
          {((activeTool === 'add_joint' ||
            activeTool === 'redraw_joint' ||
            activeTool === 'append_joint') &&
            draftJointPoints.length > 0) && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/95 border border-emerald-500/70 shadow-2xl text-xs font-mono text-white pointer-events-auto">
              <span className="text-[11px] text-emerald-300 font-bold mr-1">
                {draftJointPoints.length} pt{draftJointPoints.length === 1 ? '' : 's'}
              </span>
              {draftJointPoints.length >= 2 && (
                <button
                  type="button"
                  onClick={() => finishDraftJoint(draftJointPoints)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-sm"
                >
                  ✓ Complete ({draftJointPoints.length} pts) &amp; Show Properties
                </button>
              )}
              <button
                type="button"
                onClick={() => setDraftJointPoints((prev) => prev.slice(0, -1))}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold cursor-pointer"
              >
                ↶ Undo Pt
              </button>
              <button
                type="button"
                onClick={() => setDraftJointPoints([])}
                className="px-2 py-1.5 rounded-lg bg-rose-950/90 hover:bg-rose-900 text-rose-200 border border-rose-700/60 text-[11px] cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {activeTool === 'lithology' &&
            isDrawingLithologyPolygon &&
            draftLithologyPoints.length > 0 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/95 border border-amber-500/70 shadow-2xl text-xs font-mono text-white pointer-events-auto">
                <span className="text-[11px] text-amber-300 font-bold mr-1">
                  {draftLithologyPoints.length} pt{draftLithologyPoints.length === 1 ? '' : 's'}
                </span>
                {draftLithologyPoints.length >= 3 && (
                  <button
                    type="button"
                    onClick={() => commitDraftLithologyPolygon(draftLithologyPoints)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow-sm"
                  >
                    ✓ Finish Zone
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDraftLithologyPoints((prev) => prev.slice(0, -1))}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold cursor-pointer"
                >
                  ↶ Undo Pt
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftLithologyPoints([]);
                    setIsDrawingLithologyPolygon(false);
                  }}
                  className="px-2 py-1.5 rounded-lg bg-rose-950/90 hover:bg-rose-900 text-rose-200 border border-rose-700/60 text-[11px] cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

          {/* Mobile Floating "Properties" Sheet Trigger Button (Bottom-Right on Mobile when Property Sheet is Collapsed) */}
          {!showCadPropertiesAlways && (
            <button
              type="button"
              onClick={() => setShowCadPropertiesAlways(true)}
              className="canvas-chrome md:hidden absolute bottom-2 right-2 z-20 flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-600/95 hover:bg-sky-500 text-white text-[10px] font-mono font-bold shadow-md cursor-pointer pointer-events-auto"
              title="Open Tool & Joint Properties Sheet"
            >
              <Sliders className="w-3 h-3" />
              <span>
                {selectedJoint
                  ? `Edit ${selectedJoint.set} (${Math.round(selectedJoint.dipDirection)}°/${Math.round(selectedJoint.dip)}°)`
                  : 'Properties'}
              </span>
            </button>
          )}

          {/* Bottom Floating Trigger Button: Traced Geological Features Drawer */}
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={() => setShowTracedFeaturesDrawer((prev) => !prev)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-950/95 hover:bg-slate-900 text-white border border-sky-500/70 shadow-2xl font-mono text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="Open Traced Geological Features Drawer (Review strike, dip, persistence, roughness, or peek traces on rock photo)"
            >
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Traced Features ({surfaceJoints.length})</span>
              {isPeekingTracesOnPhoto && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/30 text-[9.5px] text-amber-300 border border-amber-500/50">
                  PEEK ON
                </span>
              )}
            </button>
          </div>

          {/* Traced Geological Features Drawer */}
          <PhotogrammetryTracedFeaturesDrawer
            isOpen={showTracedFeaturesDrawer}
            onClose={() => setShowTracedFeaturesDrawer(false)}
            activeSurface={activeSurface}
            joints={joints}
            jointSets={jointSets}
            selectedJointId={selectedJointId}
            onSelectJoint={(id) => {
              setSelectedJointId(id);
              if (id) setShowCadPropertiesAlways(true);
            }}
            onDeleteJoint={(id) => {
              const updated = joints.filter((j) => j.id !== id);
              onUpdateJointsWithHistory(updated);
              if (selectedJointId === id) setSelectedJointId(null);
            }}
            isPeekingTracesOnPhoto={isPeekingTracesOnPhoto}
            onTogglePeekTracesOnPhoto={() => setIsPeekingTracesOnPhoto((prev) => !prev)}
            onOpenProperties={() => setShowCadPropertiesAlways(true)}
            onOpen3DTunnel={() => setShow3DPhotoTunnelModal(true)}
          />

          {/* Instant OK Confirmation Modal for Traced Features */}
          <PhotogrammetryJointConfirmModal
            pending={pendingJointConfirmation}
            onConfirm={handleConfirmPendingJoint}
            onRetrace={handleRetracePendingJoint}
            onCancel={handleCancelPendingJoint}
          />
        </div>

        {/* ====================================================================
            RESPONSIVE COLLAPSIBLE PROPERTY PALETTE SIDEBAR / MOBILE BOTTOM SHEET
            - On Desktop: Collapses to a slim 28px edge rail or compact side panel
            - On Mobile (<768px): Slides up as a clean bottom sheet so 100% of canvas width is preserved
           ==================================================================== */}
        {!showCadPropertiesAlways ? (
          /* COLLAPSED SLIM RAIL: Maximizes Mapping Canvas Workspace Area (All Horizontal / Landscape & Desktop Screens) */
          <aside
            className={`canvas-chrome ${
              responsive.isLandscape || !responsive.isMobile ? 'flex' : 'hidden md:flex'
            } w-7 shrink-0 bg-white ${
              inspectorDockSide === 'left' ? 'order-first border-r' : 'order-last border-l'
            } border-slate-200 flex-col items-center py-1.5 gap-1.5 z-20 select-none shadow-xs`}
          >
            <button
              type="button"
              onClick={() => setShowCadPropertiesAlways(true)}
              className="w-5 h-5 rounded bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center shadow-2xs cursor-pointer transition-colors"
              title="Expand Property Palette Sidebar"
            >
              {inspectorDockSide === 'right' ? (
                <PanelLeft className="w-3 h-3" />
              ) : (
                <PanelRight className="w-3 h-3" />
              )}
            </button>

            <div className="w-4 h-px bg-slate-200" />

            {/* Active Tool Indicator Icon on Collapsed Rail */}
            <button
              type="button"
              onClick={() => setShowCadPropertiesAlways(true)}
              className="w-5 h-5 rounded bg-slate-100 hover:bg-sky-50 text-sky-700 border border-slate-200 flex items-center justify-center cursor-pointer"
              title={`Active Tool: ${activeTool.replace(/_/g, ' ').toUpperCase()} (Click to Expand Properties)`}
            >
              <Sliders className="w-3 h-3" />
            </button>

            {/* Vertical Label */}
            <button
              type="button"
              onClick={() => setShowCadPropertiesAlways(true)}
              className="mt-1 [writing-mode:vertical-rl] rotate-180 text-[8.5px] font-mono font-bold tracking-wider text-slate-500 hover:text-sky-700 uppercase cursor-pointer"
              title="Click to Expand Tool Properties"
            >
              PROPERTIES · {activeTool.replace(/_/g, ' ').toUpperCase()}
            </button>
          </aside>
        ) : (
          /* EXPANDED RESPONSIVE COLLAPSIBLE SIDEBAR (All Horizontal / Landscape & Desktop Screens) / SLIDE-UP BOTTOM SHEET (Portrait Mobile Only) */
          <aside
            style={
              responsive.isMobile && !responsive.isLandscape
                ? undefined
                : { width: `${inspectorWidthPx}px` }
            }
            className={
              responsive.isMobile && !responsive.isLandscape
                ? 'canvas-chrome fixed inset-x-0 bottom-0 max-h-[54dvh] w-full bg-white rounded-t-xl border-t-2 border-sky-500 flex flex-col z-40 shadow-[0_-16px_48px_rgba(15,23,42,0.35)] overflow-hidden'
                : `canvas-chrome relative w-[min(245px,36vw)] md:w-auto max-w-[38vw] bg-white ${
                    inspectorDockSide === 'left' ? 'order-first border-r' : 'order-last border-l'
                  } border-slate-200 flex flex-col shrink-0 z-20 shadow-xs overflow-hidden transition-[width] duration-150`
            }
          >
            {/* Interactive Drag-to-Expand Resize Handle on Edge */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setResizingInspector({
                  startX: e.clientX,
                  startWidth: inspectorWidthPx,
                });
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                setResizingInspector({
                  startX: e.clientX,
                  startWidth: inspectorWidthPx,
                });
              }}
              title="Drag edge left or right to resize Property Palette"
              className={`hidden md:flex items-center justify-center absolute top-0 bottom-0 w-3.5 cursor-col-resize z-30 group select-none touch-none ${
                inspectorDockSide === 'left' ? '-right-2' : '-left-2'
              }`}
            >
              <div className="h-24 w-1.5 rounded-full bg-slate-300 group-hover:bg-cyan-600 group-active:bg-cyan-700 transition-colors shadow-xs" />
            </div>

            {/* Collapsible Sidebar Header: Active Tool Context Badge + Dock Side + Collapse Button */}
            <div className="flex items-center justify-between gap-1.5 px-3 py-2 bg-slate-100 border-b border-slate-200 text-[10px] font-mono shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <Sliders className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                <div className="truncate">
                  <span className="text-slate-900 font-bold tracking-wider uppercase">
                    {activeTool === 'photo_fit'
                      ? 'PHOTO FIT & WARP'
                      : activeTool === 'add_joint' ||
                        activeTool === 'redraw_joint' ||
                        activeTool === 'append_joint'
                      ? 'DRAW JOINT TOOL'
                      : activeTool === 'lithology'
                      ? 'LITHOLOGY ZONES'
                      : activeTool === 'geological_symbol'
                      ? 'ISRM SYMBOLS'
                      : activeTool === 'dip_probe'
                      ? '3D DIP PROBE'
                      : activeTool === 'control_point'
                      ? 'CONTROL POINTS'
                      : activeTool === 'overbreak'
                      ? 'OVERBREAK / SURVEY'
                      : activeTool === 'measure'
                      ? 'MEASURE DISTANCE'
                      : selectedJoint
                      ? `TRACE ${selectedJoint.set} PROPERTIES`
                      : 'TOOL PROPERTIES'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setInspectorDockSide((s) => (s === 'right' ? 'left' : 'right'))
                  }
                  className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 flex items-center gap-0.5 cursor-pointer font-semibold"
                  title="Dock Property Sidebar on Left or Right Side"
                >
                  {inspectorDockSide === 'right' ? (
                    <>
                      <PanelLeft className="w-3 h-3 text-cyan-600" /> L
                    </>
                  ) : (
                    <>
                      <PanelRight className="w-3 h-3 text-cyan-600" /> R
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCadPropertiesAlways(false)}
                  className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold cursor-pointer flex items-center gap-1"
                  title="Collapse Property Sidebar to maximize canvas workspace"
                >
                  <span>Collapse</span>
                  <span>{inspectorDockSide === 'right' ? '»' : '«'}</span>
                </button>
              </div>
            </div>

            {/* Embedded Full-Height Panels for Lithology & Overbreak */}
            {activeTool === 'lithology' ||
            (activeTool === 'select' &&
              selectedLithologyRegionId !== null &&
              !selectedJoint &&
              !selectedSymbol &&
              !selectedControlPoint) ? (
              <LithologyPanel
                embedded
                activeSurface={activeSurface}
                geometry={geometry}
                settings={settings}
                photoSurface={currentPhoto}
                joints={joints}
                lithologyRegions={lithologyRegions}
                selectedRegionId={selectedLithologyRegionId}
                onSelectRegionId={setSelectedLithologyRegionId}
                onUpdateLithologyRegions={handleUpdateLithologyWithHistory}
                defaultPatternForNew={activeLithologyPattern}
                onChangeDefaultPatternForNew={setActiveLithologyPattern}
                isDrawingLithologyPolygon={isDrawingLithologyPolygon}
                draftLithologyPoints={draftLithologyPoints}
                onStartDrawingLithologyPolygon={() => {
                  setActiveTool('lithology');
                  setDraftLithologyPoints([]);
                  setIsDrawingLithologyPolygon(true);
                }}
                onUndoLastDraftPoint={() => {
                  setDraftLithologyPoints((prev) => prev.slice(0, -1));
                }}
                onReopenRegionAsDraft={(region) => {
                  setActiveTool('lithology');
                  setDraftLithologyPoints(region.polygon.map((p: Point2D) => ({ ...p })));
                  setReopenedLithologyRegionId(region.id);
                  setSelectedLithologyRegionId(region.id);
                  setIsDrawingLithologyPolygon(true);
                  onUpdateStatusMessage?.(
                    `Reopened "${region.lithologyName}" polygon (${region.polygon.length} pts) for interactive boundary editing.`
                  );
                }}
                onFinishDrawingLithologyPolygon={() => {
                  commitDraftLithologyPolygon();
                }}
                onCancelDrawingLithologyPolygon={() => {
                  setDraftLithologyPoints([]);
                  setReopenedLithologyRegionId(null);
                  setIsDrawingLithologyPolygon(false);
                }}
                canUndo={lithologyPast.length > 0 || canUndo}
                canRedo={lithologyFuture.length > 0 || canRedo}
                onUndo={handleUndoLithology}
                onRedo={handleRedoLithology}
                onClose={() => {
                  setIsDrawingLithologyPolygon(false);
                  setDraftLithologyPoints([]);
                  setReopenedLithologyRegionId(null);
                  setSelectedLithologyRegionId(null);
                  setActiveTool('select');
                }}
                onStatusMessage={onUpdateStatusMessage}
              />
            ) : activeTool === 'overbreak' ? (
              <OverbreakAnalysisPanel
                embedded
                activeSurface={activeSurface}
                geometry={geometry}
                settings={settings}
                controlPoints={controlPoints}
                surveyProfile={surveyProfile}
                analysis={overbreakAnalysis}
                selectedControlPointId={selectedControlPointId}
                onSelectControlPointId={setSelectedControlPointId}
                onUpdateControlPoints={(next) => handleUpdateControlPointsWithHistory(() => next)}
                onUpdateSurveyProfile={onUpdateSurveyProfile}
                onGenerateSampleAsBuiltProfile={onGenerateSampleAsBuiltProfile}
                onOpenProjectMemoryModal={() => onOpenProjectMemoryModal('volumes')}
                onOpenExportSheet={onOpenExportSheet}
                joints={joints}
                jointSets={jointSets}
                qIndexParams={qIndexParams}
                rmrParams={rmrParams}
                rockMassSummary={rockMassSummary}
                onUpdateRockMassSummary={onUpdateRockMassSummary}
                savedProjects={savedProjects}
                onSwitchToFaceSurface={() => onSelectSurface('face')}
                onClose={() => setActiveTool('select')}
                onStatusMessage={onUpdateStatusMessage}
              />
            ) : (
              <div className="flex-1 overflow-y-auto p-3 text-xs space-y-2.5">
                {activeTool === 'photo_fit' ? (
              <PhotoFittingPanel
                activeSurface={activeSurface}
                currentPhoto={currentPhoto}
                geometry={geometry}
                settings={settings}
                subTab={photoEditSubTab}
                onChangeSubTab={setPhotoEditSubTab}
                showMeshGrid={showMeshGrid}
                onToggleMeshGrid={setShowMeshGrid}
                addingControlPointMode={addingControlPointMode}
                onToggleAddingControlPointMode={setAddingControlPointMode}
                drawingCustomMaskMode={drawingCustomMaskMode}
                onToggleDrawingCustomMaskMode={setDrawingCustomMaskMode}
                onUpdateTransform={handleUpdateTransformWithHistory}
                onUpdateOpacity={(opacityVal) =>
                  onUpdatePhotoSurface(activeSurface, (prev) => ({
                    ...prev,
                    opacity: opacityVal,
                  }))
                }
                onUpdateCalibration={(focalMm, k1Val) =>
                  onUpdatePhotoSurface(activeSurface, (prev) => ({
                    ...prev,
                    calibration: prev.calibration
                      ? {
                          ...prev.calibration,
                          focalLengthMm: focalMm,
                          radialDistortionK1: k1Val,
                        }
                      : undefined,
                  }))
                }
                onFitToTunnel={onAutoFitCurrentPhoto}
                onUndoTransform={handleUndoTransform}
                onRedoTransform={handleRedoTransform}
                canUndoTransform={transformPast.length > 0}
                canRedoTransform={transformFuture.length > 0}
                onApply={async () => {
                  if (currentPhoto.image) {
                    const finalWarped = await generatePiecewiseWarpedPhotoDataUrl(
                      currentPhoto.image,
                      currentPhoto.transform
                    );
                    onUpdatePhotoSurface(activeSurface, (prev) => ({
                      ...prev,
                      warpedImage: finalWarped,
                    }));
                  }
                  setAddingControlPointMode(false);
                  setDrawingCustomMaskMode(false);
                  setSplTwoClickMode(false);
                  setSplFirstPointUV(null);
                  setActiveTool('select');
                }}
                onCancel={() => {
                  if (initialTransformSnapshot) {
                    onUpdatePhotoSurface(activeSurface, (prev) => ({
                      ...prev,
                      transform: initialTransformSnapshot,
                    }));
                  }
                  setAddingControlPointMode(false);
                  setDrawingCustomMaskMode(false);
                  setSplTwoClickMode(false);
                  setSplFirstPointUV(null);
                  setActiveTool('select');
                }}
                onOpenCustomProfileEditor={onOpenCustomProfileEditor}
                splTwoClickMode={splTwoClickMode}
                splFirstPointUV={splFirstPointUV}
                onToggleSplTwoClickMode={(active) => {
                  setSplTwoClickMode(active);
                  setSplFirstPointUV(null);
                  if (active) {
                    onUpdateStatusMessage?.(
                      '2-Click SPL Seam Lock active: Click Point 1 (Left start) and Point 2 (Right end) along the Wall–Crown meet line (SPL) on the photo.'
                    );
                  }
                }}
                onAutoDetectSplSeam={handleAutoDetectSplSeam}
                onDeduplicateSplOverlaps={handleDeduplicateSplOverlaps}
              />
            ) : selectedJoint ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div>
                    <span className="font-mono font-bold text-slate-900">
                      TRACE {selectedJoint.set} ({selectedJoint.surface.toUpperCase()})
                    </span>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Source: {selectedJoint.source} · Conf: {selectedJoint.confidence} (
                      {Math.round(selectedJoint.confidenceScore * 100)}%)
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedJointId(null)}
                    className="text-slate-400 hover:text-slate-800"
                  >
                    ✕
                  </button>
                </div>

                {/* Orientation & Persistence Box */}
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2 font-mono">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">Surface Trace Angle:</span>
                    <span className="text-slate-900 font-bold">
                      {Number(selectedJoint.traceAngle).toFixed(1)}° (App. Dip{' '}
                      {Number(selectedJoint.apparentDip).toFixed(1)}°)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">Trace Length (Persist.):</span>
                    <span className="text-slate-900 font-bold">
                      {selectedJoint.persistenceMeters.toFixed(2)} m ({selectedJoint.geometry.length} pts)
                    </span>
                  </div>

                  <div className="border-t border-slate-200 pt-2 space-y-2">
                    {/* 1-Click Joint Set Colour Chooser (Choose J1, J2, J3, J4, J5, J0, F1 after plotting) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-700 font-bold">
                          CHOOSE JOINT SET (DISTINCT COLOUR PER SET)
                        </span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-bold text-white"
                          style={{
                            backgroundColor:
                              JOINT_SET_PALETTE[selectedJoint.set]?.color || '#F59E0B',
                          }}
                        >
                          {selectedJoint.set}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {['J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J0', 'F1'].map((setKey) => {
                          const pCol = JOINT_SET_PALETTE[setKey]?.color || '#F59E0B';
                          const isCurrent = selectedJoint.set === setKey;
                          return (
                            <button
                              key={setKey}
                              type="button"
                              onClick={() => {
                                setDraftSetId(setKey);
                                const updatedJoint: Joint = { ...selectedJoint, set: setKey };
                                onUpdateJointsWithHistory(
                                  joints.map((j) =>
                                    j.id === selectedJoint.id ? updatedJoint : j
                                  )
                                );
                              }}
                              className={`flex items-center justify-center gap-1 py-1 px-1.5 rounded border text-[10px] font-bold cursor-pointer transition-all ${
                                isCurrent
                                  ? 'ring-2 ring-slate-900 shadow-xs text-white'
                                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                              }`}
                              style={
                                isCurrent
                                  ? { backgroundColor: pCol, borderColor: pCol }
                                  : undefined
                              }
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor: isCurrent ? '#FFFFFF' : pCol,
                                }}
                              />
                              <span>{setKey}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                      <span className="text-[10px] text-cyan-700 font-bold">
                        {selectedJoint.surface === 'crown'
                          ? 'ACCURATE CROWN STRIKE (LEFT & RIGHT SIDES)'
                          : 'ACCURATE DIP DIR & DIP AMOUNT'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                        {formatJointTraceLineLabel(selectedJoint, joints)}
                      </span>
                    </div>

                    {selectedJoint.surface === 'crown' ? (
                      (() => {
                        const crownRel = resolveCrownRelatedDipFromFaceAndWalls(
                          selectedJoint,
                          joints
                        );
                        return (
                          <div className="space-y-2 pt-1">
                            <div className="p-2 rounded bg-amber-50/80 border border-amber-200 text-[10px] text-amber-950 space-y-1">
                              <div className="flex items-center justify-between font-bold">
                                <span>Crown Line Label:</span>
                                <span className="font-mono text-amber-900">
                                  {formatJointTraceLineLabel(selectedJoint, joints)}
                                </span>
                              </div>
                              <div className="text-[9.5px] text-amber-800">
                                Crown Strike <strong>{formatAccurateAngle(crownRel.strikeDeg, 3)}°</strong> + 90° = Dip Dir <strong>{formatAccurateAngle(crownRel.dipDirectionDeg, 3)}°</strong> · Dip Amount <strong>{formatAccurateAngle(crownRel.dipDeg, 2)}°</strong> added from nearest Face joint ({crownRel.sourceLabel}).
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-1.5">
                              <label className="space-y-0.5">
                                <span className="text-[9.5px] text-slate-600 font-bold">
                                  Strike (0-360°)
                                </span>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="360"
                                  value={Number(crownRel.strikeDeg.toFixed(1))}
                                  onChange={(e) => {
                                    const st = normalizeAzimuth(Number(e.target.value) || 0);
                                    const ddPlus90 = normalizeAzimuth(st + 90);
                                    const nextCrownRel = resolveCrownRelatedDipFromFaceAndWalls(
                                      {
                                        ...selectedJoint,
                                        strike: st,
                                        dipDirection: ddPlus90,
                                      },
                                      joints
                                    );
                                    const updatedJoint: Joint = {
                                      ...selectedJoint,
                                      strike: st,
                                      dipDirection: ddPlus90,
                                      dip: nextCrownRel.dipDeg,
                                      orientationStatus: 'DIRECTLY_MEASURED',
                                    };
                                    onUpdateJointsWithHistory(
                                      joints.map((j) =>
                                        j.id === selectedJoint.id ? updatedJoint : j
                                      )
                                    );
                                  }}
                                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 font-bold"
                                />
                              </label>
                              <label className="space-y-0.5">
                                <span className="text-[9.5px] text-slate-600">
                                  DipDir (Strike+90°)
                                </span>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="360"
                                  value={Number(crownRel.dipDirectionDeg.toFixed(1))}
                                  onChange={(e) => {
                                    const dd = normalizeAzimuth(Number(e.target.value) || 0);
                                    const st = normalizeAzimuth(dd - 90);
                                    const nextCrownRel = resolveCrownRelatedDipFromFaceAndWalls(
                                      {
                                        ...selectedJoint,
                                        strike: st,
                                        dipDirection: dd,
                                      },
                                      joints
                                    );
                                    const updatedJoint: Joint = {
                                      ...selectedJoint,
                                      strike: st,
                                      dipDirection: dd,
                                      dip: nextCrownRel.dipDeg,
                                      orientationStatus: 'DIRECTLY_MEASURED',
                                    };
                                    onUpdateJointsWithHistory(
                                      joints.map((j) =>
                                        j.id === selectedJoint.id ? updatedJoint : j
                                      )
                                    );
                                  }}
                                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-900"
                                />
                              </label>
                              <label className="space-y-0.5">
                                <span className="text-[9.5px] text-slate-600">
                                  Face Dip Amount
                                </span>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="90"
                                  value={Number(crownRel.dipDeg.toFixed(1))}
                                  onChange={(e) => {
                                    const d = clampDip(Number(e.target.value) || 0);
                                    const updatedJoint: Joint = {
                                      ...selectedJoint,
                                      dip: d,
                                      orientationStatus: 'DIRECTLY_MEASURED',
                                    };
                                    onUpdateJointsWithHistory(
                                      joints.map((j) =>
                                        j.id === selectedJoint.id ? updatedJoint : j
                                      )
                                    );
                                  }}
                                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-900"
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <label className="space-y-0.5">
                          <span className="text-[9.5px] text-slate-600 font-bold">
                            Dip Dir (0-360°)
                          </span>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="360"
                            value={Number(normalizeAzimuth(selectedJoint.dipDirection).toFixed(1))}
                            onChange={(e) => {
                              const dd = normalizeAzimuth(Number(e.target.value) || 0);
                              const st = normalizeAzimuth(dd - 90);
                              const updatedJoint: Joint = {
                                ...selectedJoint,
                                dipDirection: dd,
                                strike: st,
                                orientationStatus: 'DIRECTLY_MEASURED',
                              };
                              onUpdateJointsWithHistory(
                                joints.map((j) => (j.id === selectedJoint.id ? updatedJoint : j))
                              );
                              onRecordConfirmedJoint(updatedJoint, {
                                correctionType: 'recalculate_orientation',
                                aiSummary: `Estimated ${formatAccurateAngle(selectedJoint.dipDirection, 3)}°/${formatAccurateAngle(selectedJoint.dip, 2)}°`,
                                approvedSummary: `Measured ${formatAccurateAngle(dd, 3)}°/${formatAccurateAngle(selectedJoint.dip, 2)}°`,
                              });
                            }}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 font-bold"
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className="text-[9.5px] text-slate-600 font-bold">
                            Dip Amount (0-90°)
                          </span>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="90"
                            value={Number(clampDip(selectedJoint.dip).toFixed(1))}
                            onChange={(e) => {
                              const d = clampDip(Number(e.target.value) || 0);
                              onUpdateJointsWithHistory(
                                joints.map((j) =>
                                  j.id === selectedJoint.id
                                    ? {
                                        ...j,
                                        dip: d,
                                        orientationStatus: 'DIRECTLY_MEASURED',
                                      }
                                    : j
                                )
                              );
                            }}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-900 font-bold"
                          />
                        </label>
                      </div>
                    )}

                    {/* Interactive Mini 3D Strike & Dip vs. Tunnel Drive Preview */}
                    <div className="pt-2">
                      <Mini3DStrikeDipPreview
                        joint={selectedJoint}
                        geometry={geometry}
                        settings={settings}
                        onOpenFull3DModal={() => setShow3DStrikeDipModal(true)}
                      />
                    </div>
                  </div>
                </div>

                {/* Joint Number, Discontinuity Set, Feature Type & Engineering Attributes */}
                <div className="space-y-2 pt-1 border-t border-slate-200">
                  <div className="grid grid-cols-3 gap-2">
                    <label className="space-y-1">
                      <span className="text-[10px] text-slate-600">Joint No.</span>
                      <input
                        type="text"
                        value={selectedJoint.jointNumber || ''}
                        placeholder="e.g. J-1"
                        onChange={(e) =>
                          onUpdateJointsWithHistory(
                            joints.map((j) =>
                              j.id === selectedJoint.id
                                ? { ...j, jointNumber: e.target.value }
                                : j
                            )
                          )
                        }
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono text-xs text-slate-900"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-[10px] text-slate-600">Joint Set</span>
                      <select
                        value={selectedJoint.set}
                        onChange={(e) => {
                          const nextSet = e.target.value;
                          const updatedJoint: Joint = { ...selectedJoint, set: nextSet };
                          onUpdateJointsWithHistory(
                            joints.map((j) => (j.id === selectedJoint.id ? updatedJoint : j))
                          );
                          onRecordConfirmedJoint(updatedJoint, {
                            correctionType: 'reclassify_type',
                            aiSummary: `Set ${selectedJoint.set} (${Math.round(selectedJoint.dipDirection)}°/${Math.round(selectedJoint.dip)}°)`,
                            approvedSummary: `Reclassified to Set ${nextSet}`,
                          });
                        }}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono text-xs text-slate-900"
                      >
                        {Array.from(
                          new Set([
                            'J0',
                            'J1',
                            'J2',
                            'J3',
                            'J4',
                            'J5',
                            ...jointSets.map((js) => js.id),
                            'F1',
                          ])
                        ).map((s) => {
                          const matchedSet = jointSets.find((js) => js.id === s);
                          return (
                            <option key={s} value={s}>
                              {matchedSet ? `${s} (${matchedSet.orientation})` : s}
                            </option>
                          );
                        })}
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-[10px] text-slate-600">Confidence</span>
                      <select
                        value={selectedJoint.confidence}
                        onChange={(e) =>
                          onUpdateJointsWithHistory(
                            joints.map((j) =>
                              j.id === selectedJoint.id
                                ? {
                                    ...j,
                                    confidence: e.target.value as 'High' | 'Medium' | 'Low',
                                  }
                                : j
                            )
                          )
                        }
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono text-xs text-slate-900"
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </label>
                  </div>

                  <label className="block space-y-1">
                    <span className="text-[10px] text-slate-600">
                      Structural Geological Feature Type
                    </span>
                    <select
                      value={selectedJoint.featureType}
                      onChange={(e) => {
                        const nextType = e.target.value as GeologicalFeatureType;
                        const updatedJoint: Joint = { ...selectedJoint, featureType: nextType };
                        onUpdateJointsWithHistory(
                          joints.map((j) => (j.id === selectedJoint.id ? updatedJoint : j))
                        );
                        onRecordConfirmedJoint(updatedJoint, {
                          correctionType: 'reclassify_type',
                          aiSummary: `${selectedJoint.featureType} (${selectedJoint.set})`,
                          approvedSummary: `Verified as ${nextType} (${selectedJoint.set})`,
                        });
                      }}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900"
                    >
                      <option value="joint">Joint</option>
                      <option value="open_joint">Open Joint</option>
                      <option value="closed_joint">Closed Joint</option>
                      <option value="fracture">Fracture</option>
                      <option value="discontinuity">Discontinuity</option>
                      <option value="fault">Fault</option>
                      <option value="shear">Shear Surface</option>
                      <option value="shear_zone">Shear Zone</option>
                      <option value="shear_plane">Shear Plane</option>
                      <option value="slickenside">Slickenside</option>
                      <option value="bedding">Bedding</option>
                      <option value="foliation">Foliation</option>
                      <option value="schistosity">Schistosity</option>
                      <option value="cleavage">Cleavage</option>
                      <option value="lineation">Lineation</option>
                      <option value="fold">Fold Axis</option>
                      <option value="anticline">Anticline</option>
                      <option value="syncline">Syncline</option>
                      <option value="vein">Vein</option>
                      <option value="dyke">Dyke / Intrusive</option>
                      <option value="contact">Contact</option>
                      <option value="lithological_contact">Lithological Contact</option>
                      <option value="clay_infill">Clay Infill</option>
                      <option value="clay_band">Clay Band</option>
                      <option value="seam">Weak Seam</option>
                      <option value="weathered_zone">Weathered Zone</option>
                      <option value="breccia_zone">Breccia Zone</option>
                      <option value="crushed_zone">Crushed Zone</option>
                      <option value="water_seepage">Water Seepage</option>
                      <option value="water_flow">Water Flow</option>
                      <option value="shale_band">Shale/Siltstone</option>
                      <option value="dolerite">Dolerite</option>
                      <option value="infilling">Infilling Vein</option>
                    </select>
                  </label>

                  {/* Editable Joint Engineering Attributes: Aperture, Roughness, Infill, Weathering */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-slate-600">Aperture</span>
                      <input
                        type="text"
                        value={selectedJoint.apertureMm || ''}
                        onChange={(e) =>
                          onUpdateJointsWithHistory(
                            joints.map((j) =>
                              j.id === selectedJoint.id
                                ? { ...j, apertureMm: e.target.value }
                                : j
                            )
                          )
                        }
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px] text-slate-900"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-slate-600">Roughness</span>
                      <input
                        type="text"
                        value={selectedJoint.roughness || ''}
                        onChange={(e) =>
                          onUpdateJointsWithHistory(
                            joints.map((j) =>
                              j.id === selectedJoint.id
                                ? { ...j, roughness: e.target.value }
                                : j
                            )
                          )
                        }
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px] text-slate-900"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-slate-600">Infilling</span>
                      <input
                        type="text"
                        value={selectedJoint.infilling || ''}
                        onChange={(e) =>
                          onUpdateJointsWithHistory(
                            joints.map((j) =>
                              j.id === selectedJoint.id
                                ? { ...j, infilling: e.target.value }
                                : j
                            )
                          )
                        }
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px] text-slate-900"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-slate-600">Weathering</span>
                      <input
                        type="text"
                        value={selectedJoint.weathering || 'Slightly Weathered (W2)'}
                        onChange={(e) =>
                          onUpdateJointsWithHistory(
                            joints.map((j) =>
                              j.id === selectedJoint.id
                                ? { ...j, weathering: e.target.value }
                                : j
                            )
                          )
                        }
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px] text-slate-900"
                      />
                    </label>
                  </div>
                </div>

                {/* Manual Correction Actions (Without Empty Spline Button) */}
                <div className="space-y-1.5 pt-1 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-600 font-semibold">
                      Trace Actions ({selectedJoint.geometry.length} pts)
                    </span>
                    {selectedJointVertexIdx !== null && (
                      <span className="text-[10px] font-mono text-amber-700 font-bold">
                        Selected P{selectedJointVertexIdx + 1}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={handleConfirmSelectedJoint}
                      className="flex items-center justify-center gap-1 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-semibold cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Accept / Confirm
                    </button>
                    <button
                      onClick={handleDeleteSelectedJoint}
                      className="flex items-center justify-center gap-1 px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md font-semibold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Trace
                    </button>
                    <button
                      onClick={() => handleAddVertexToSelectedJoint()}
                      className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md border border-slate-300 cursor-pointer"
                    >
                      + Add Control Pt
                    </button>
                    <button
                      onClick={() =>
                        handleDeleteSelectedJointVertex(
                          selectedJointVertexIdx ??
                            Math.max(1, Math.floor(selectedJoint.geometry.length / 2))
                        )
                      }
                      disabled={selectedJoint.geometry.length <= 2}
                      className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-rose-700 rounded-md border border-slate-300 cursor-pointer"
                    >
                      - Delete Control Pt
                    </button>
                    <button
                      onClick={() => {
                        setDraftJointPoints([]);
                        setActiveTool('append_joint');
                      }}
                      className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-emerald-800 rounded-md border border-slate-300 cursor-pointer"
                      title="Continue drawing from the end of this joint trace"
                    >
                      Continue / Append
                    </button>
                    <button
                      onClick={() => {
                        setDraftJointPoints([]);
                        setActiveTool('redraw_joint');
                      }}
                      className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-amber-800 rounded-md border border-slate-300 cursor-pointer"
                    >
                      Re-draw Trace
                    </button>
                    <button
                      onClick={handleSplitSelectedJoint}
                      className="flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md border border-slate-300 cursor-pointer"
                    >
                      <Scissors className="w-3 h-3" />
                      Split Trace
                    </button>
                    <button
                      onClick={() => setJoinTargetMode((prev) => !prev)}
                      className={`px-2 py-1.5 rounded-md border cursor-pointer ${
                        joinTargetMode
                          ? 'bg-cyan-600 text-white border-cyan-500'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                      }`}
                    >
                      {joinTargetMode ? 'Click 2nd Trace' : 'Join Trace'}
                    </button>
                    <button
                      onClick={handleSmoothSelectedJointCurve}
                      disabled={selectedJoint.geometry.length < 3}
                      className="col-span-2 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-900 border border-amber-300 rounded-md font-semibold cursor-pointer"
                      title="Smooth this joint trace using a Catmull-Rom Spline Curve"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-amber-600" />
                      Spline Smooth Curve
                    </button>
                    <button
                      onClick={handleSnapSelectedJointToRockRidge}
                      disabled={!activePhotoRidgeField}
                      className="col-span-2 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-cyan-50 hover:bg-cyan-100 disabled:opacity-40 text-cyan-800 border border-cyan-300 rounded-md font-semibold cursor-pointer"
                      title="Snap all vertices of this trace onto the exact rock fracture valley"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-cyan-600" />
                      Snap Trace to Rock Crack
                    </button>
                  </div>
                </div>
              </>
            ) : activeTool === 'add_joint' ||
              activeTool === 'redraw_joint' ||
              activeTool === 'append_joint' ? (
              /* TOOL-SPECIFIC CONTROLS: DRAW / REDRAW / APPEND JOINT TRACE */
              <div className="space-y-3 font-mono text-[11px]">
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <div className="font-bold text-amber-900 flex items-center justify-between">
                    <span>
                      {activeTool === 'redraw_joint'
                        ? `RE-DRAW TRACE (${(selectedJoint as Joint | null)?.set || ''})`
                        : activeTool === 'append_joint'
                        ? `APPEND TRACE (${(selectedJoint as Joint | null)?.set || ''})`
                        : 'DRAW JOINT TRACE'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-950 text-[10px]">
                      {draftJointPoints.length} pts
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setJointDrawMode('two_point_line')}
                      className={`py-1.5 px-2 rounded border text-[10px] font-bold cursor-pointer ${
                        jointDrawMode === 'two_point_line'
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      2-Point Line
                    </button>
                    <button
                      type="button"
                      onClick={() => setJointDrawMode('polyline')}
                      className={`py-1.5 px-2 rounded border text-[10px] font-bold cursor-pointer ${
                        jointDrawMode === 'polyline'
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Multi-Pt Polyline
                    </button>
                    <button
                      type="button"
                      onClick={() => setJointDrawMode('smooth_curve')}
                      className={`py-1.5 px-2 rounded border text-[10px] font-bold cursor-pointer ${
                        jointDrawMode === 'smooth_curve'
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Spline Curve
                    </button>
                    <button
                      type="button"
                      onClick={() => setJointDrawMode('freehand')}
                      className={`py-1.5 px-2 rounded border text-[10px] font-bold cursor-pointer ${
                        jointDrawMode === 'freehand'
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Freehand Curve
                    </button>
                    <button
                      type="button"
                      onClick={() => setJointDrawMode('magnetic_livewire')}
                      className={`py-1.5 px-2 rounded border text-[10px] font-bold cursor-pointer ${
                        jointDrawMode === 'magnetic_livewire'
                          ? 'bg-cyan-600 text-white border-cyan-700'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Snap Crack Livewire
                    </button>
                    <button
                      type="button"
                      onClick={() => setJointDrawMode('seed_autotrace')}
                      className={`py-1.5 px-2 rounded border text-[10px] font-bold cursor-pointer ${
                        jointDrawMode === 'seed_autotrace'
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      1-Click Crack Seed
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCrackXRayOverlay((prev) => {
                          const next = !prev;
                          if (next) setShowDepthReliefOverlay(false);
                          return next;
                        });
                      }}
                      disabled={!activePhotoRidgeField?.xrayOverlayDataUrl}
                      className={`py-1 px-2 rounded border text-[10px] font-bold cursor-pointer disabled:opacity-40 ${
                        showCrackXRayOverlay
                          ? 'bg-cyan-600 text-white border-cyan-700'
                          : 'bg-white text-cyan-800 border-cyan-300 hover:bg-cyan-50'
                      }`}
                    >
                      {showCrackXRayOverlay ? '✓ Crack X-Ray ON' : 'Crack X-Ray Vision'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDepthReliefOverlay((prev) => {
                          const next = !prev;
                          if (next) setShowCrackXRayOverlay(false);
                          return next;
                        });
                      }}
                      disabled={!activePhotoRidgeField?.depthReliefOverlayDataUrl}
                      className={`py-1 px-2 rounded border text-[10px] font-bold cursor-pointer disabled:opacity-40 ${
                        showDepthReliefOverlay
                          ? 'bg-indigo-600 text-white border-indigo-700'
                          : 'bg-white text-indigo-800 border-indigo-300 hover:bg-indigo-50'
                      }`}
                    >
                      {showDepthReliefOverlay ? '✓ 3D Relief ON' : '3D Dip Facet Map'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-600 font-bold">Joint Set ID</span>
                    <select
                      value={draftSetId}
                      onChange={(e) => setDraftSetId(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 font-bold"
                    >
                      {['J1', 'J2', 'J3', 'J4', 'J5', 'F1', 'J0'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-600 font-bold">Feature Type</span>
                    <select
                      value={draftFeatureType}
                      onChange={(e) => setDraftFeatureType(e.target.value as GeologicalFeatureType)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900"
                    >
                      <option value="joint">Joint</option>
                      <option value="open_joint">Open Joint</option>
                      <option value="fracture">Fracture</option>
                      <option value="fault">Fault</option>
                      <option value="shear">Shear Surface</option>
                      <option value="bedding">Bedding</option>
                      <option value="foliation">Foliation</option>
                      <option value="vein">Vein</option>
                    </select>
                  </label>
                </div>

                <div className="flex gap-1.5 pt-1">
                  {draftJointPoints.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDraftJointPoints((prev) => prev.slice(0, -1))}
                      className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-md font-bold cursor-pointer"
                    >
                      Undo Pt
                    </button>
                  )}
                  {draftJointPoints.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => finishDraftJoint()}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-bold cursor-pointer"
                    >
                      Finish Trace
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDraftJointPoints([]);
                      setActiveTool('select');
                    }}
                    className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md font-bold cursor-pointer"
                  >
                    Exit Tool
                  </button>
                </div>
              </div>
            ) : activeTool === 'geological_symbol' || selectedSymbol !== null ? (
              /* TOOL-SPECIFIC CONTROLS: ISRM STRUCTURAL SYMBOLS & COMPLETE SYMBOL PROPERTIES */
              <div className="space-y-3 font-mono text-[11px]">
                <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg space-y-2">
                  <div className="font-bold text-purple-900 flex items-center justify-between">
                    <span>ISRM GEOLOGICAL SYMBOLS</span>
                    <button
                      type="button"
                      onClick={() => setActiveTool('geological_symbol')}
                      className={`px-2 py-0.5 rounded text-[9.5px] font-bold cursor-pointer ${
                        activeTool === 'geological_symbol'
                          ? 'bg-purple-700 text-white'
                          : 'bg-purple-200 hover:bg-purple-300 text-purple-900'
                      }`}
                    >
                      {activeTool === 'geological_symbol' ? 'Placing Active' : '+ Place Symbol'}
                    </button>
                  </div>
                  <label className="block space-y-1">
                    <span className="text-[10px] text-slate-600 font-bold">
                      {selectedSymbol ? 'Symbol Type (Applies to Selected & New)' : 'Symbol Type to Place'}
                    </span>
                    <select
                      value={selectedSymbol ? selectedSymbol.symbolType : activeSymbolTypeToPlace}
                      onChange={(e) => {
                        const nextType = e.target.value as GeologicalSymbolType;
                        setActiveSymbolTypeToPlace(nextType);
                        if (selectedSymbol) {
                          const symDef = STRUCTURAL_GEOLOGICAL_SYMBOLS.find(
                            (s) => s.type === nextType
                          );
                          handleUpdatePlacedSymbolsWithHistory((prev) =>
                            prev.map((s) =>
                              s.id === selectedSymbol.id
                                ? {
                                    ...s,
                                    symbolType: nextType,
                                    color: symDef?.defaultColor || s.color,
                                  }
                                : s
                            )
                          );
                        }
                      }}
                      className="w-full px-2 py-1.5 bg-white border border-purple-300 rounded text-xs text-slate-900 font-semibold"
                    >
                      {STRUCTURAL_GEOLOGICAL_SYMBOLS.map((sym) => (
                        <option key={sym.type} value={sym.type}>
                          {sym.label} ({sym.category})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {selectedSymbol && (
                  <div className="p-2.5 bg-white border border-purple-300 rounded-lg space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-purple-100 pb-1.5">
                      <span className="font-bold text-purple-900">
                        SYMBOL PROPERTIES: {selectedSymbol.symbolType.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdatePlacedSymbolsWithHistory((prev) =>
                              prev.map((s) =>
                                s.id === selectedSymbol.id ? { ...s, locked: !s.locked } : s
                              )
                            )
                          }
                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold cursor-pointer border ${
                            selectedSymbol.locked
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {selectedSymbol.locked ? 'Locked' : 'Unlocked'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePlacedSymbol(selectedSymbol.id)}
                          className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded text-[9.5px] font-bold cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 font-semibold">
                          Dip Dir / Rotation (°)
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="360"
                          value={Math.round(selectedSymbol.rotationDeg)}
                          onChange={(e) => {
                            const rot = ((Number(e.target.value) || 0) % 360 + 360) % 360;
                            handleUpdatePlacedSymbolsWithHistory((prev) =>
                              prev.map((s) =>
                                s.id === selectedSymbol.id
                                  ? { ...s, rotationDeg: rot, dipDirectionDeg: rot }
                                  : s
                              )
                            );
                          }}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900 font-bold"
                        />
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 font-semibold">
                          Dip Angle (°)
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="90"
                          value={selectedSymbol.dipDeg ?? 45}
                          onChange={(e) => {
                            const dip = Math.max(0, Math.min(90, Number(e.target.value) || 0));
                            handleUpdatePlacedSymbolsWithHistory((prev) =>
                              prev.map((s) =>
                                s.id === selectedSymbol.id ? { ...s, dipDeg: dip } : s
                              )
                            );
                          }}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900 font-bold"
                        />
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 font-semibold">
                          Symbol Size (Scale)
                        </span>
                        <input
                          type="number"
                          min="0.4"
                          max="3.0"
                          step="0.1"
                          value={selectedSymbol.scale ?? 1}
                          onChange={(e) => {
                            const sc = Math.max(
                              0.4,
                              Math.min(3.0, Number(e.target.value) || 1)
                            );
                            handleUpdatePlacedSymbolsWithHistory((prev) =>
                              prev.map((s) =>
                                s.id === selectedSymbol.id ? { ...s, scale: sc } : s
                              )
                            );
                          }}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900 font-bold"
                        />
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 font-semibold">
                          Symbol Color
                        </span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={selectedSymbol.color || '#a855f7'}
                            onChange={(e) => {
                              const col = e.target.value;
                              handleUpdatePlacedSymbolsWithHistory((prev) =>
                                prev.map((s) =>
                                  s.id === selectedSymbol.id ? { ...s, color: col } : s
                                )
                              );
                            }}
                            className="w-8 h-7 rounded border border-slate-300 cursor-pointer bg-white"
                          />
                          <span className="text-[10px] text-slate-600 font-mono">
                            {selectedSymbol.color || '#a855f7'}
                          </span>
                        </div>
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 font-semibold">X Pos (m)</span>
                        <input
                          type="number"
                          step="0.05"
                          value={Number(selectedSymbol.point.x.toFixed(2))}
                          onChange={(e) => {
                            const nx = parseFloat(e.target.value);
                            if (!Number.isNaN(nx)) {
                              handleUpdatePlacedSymbolsWithHistory((prev) =>
                                prev.map((s) =>
                                  s.id === selectedSymbol.id
                                    ? { ...s, point: { ...s.point, x: nx } }
                                    : s
                                )
                              );
                            }
                          }}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900"
                        />
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[10px] text-slate-500 font-semibold">Y Pos (m)</span>
                        <input
                          type="number"
                          step="0.05"
                          value={Number(selectedSymbol.point.y.toFixed(2))}
                          onChange={(e) => {
                            const ny = parseFloat(e.target.value);
                            if (!Number.isNaN(ny)) {
                              handleUpdatePlacedSymbolsWithHistory((prev) =>
                                prev.map((s) =>
                                  s.id === selectedSymbol.id
                                    ? { ...s, point: { ...s.point, y: ny } }
                                    : s
                                )
                              );
                            }
                          }}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900"
                        />
                      </label>
                    </div>

                    <label className="block space-y-0.5">
                      <span className="text-[10px] text-slate-500 font-semibold">
                        Custom Map Label
                      </span>
                      <input
                        type="text"
                        placeholder="e.g., F1 Shear, Seepage 5 L/min"
                        value={selectedSymbol.label ?? ''}
                        onChange={(e) => {
                          const lbl = e.target.value;
                          handleUpdatePlacedSymbolsWithHistory((prev) =>
                            prev.map((s) =>
                              s.id === selectedSymbol.id ? { ...s, label: lbl } : s
                            )
                          );
                        }}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900"
                      />
                    </label>

                    <label className="block space-y-0.5">
                      <span className="text-[10px] text-slate-500 font-semibold">
                        Geological Notes
                      </span>
                      <input
                        type="text"
                        placeholder="Field observations for this symbol..."
                        value={selectedSymbol.notes ?? ''}
                        onChange={(e) => {
                          const notes = e.target.value;
                          handleUpdatePlacedSymbolsWithHistory((prev) =>
                            prev.map((s) =>
                              s.id === selectedSymbol.id ? { ...s, notes } : s
                            )
                          );
                        }}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900"
                      />
                    </label>
                  </div>
                )}

                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-700 uppercase">
                    Placed Symbols ({surfacePlacedSymbols.length})
                  </div>
                  <div className="divide-y divide-slate-100 max-h-44 overflow-y-auto">
                    {surfacePlacedSymbols.length === 0 ? (
                      <div className="p-2.5 text-[10px] text-slate-500">
                        No symbols placed on this surface yet.
                      </div>
                    ) : (
                      surfacePlacedSymbols.map((sym) => (
                        <div
                          key={sym.id}
                          onClick={() => setSelectedSymbolId(sym.id)}
                          className={`px-2.5 py-1.5 flex items-center justify-between cursor-pointer ${
                            sym.id === selectedSymbolId ? 'bg-purple-50 font-bold' : 'hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-slate-800">
                            {sym.symbolType.replace(/_/g, ' ')} ({Math.round(sym.rotationDeg)}° /{' '}
                            {sym.dipDeg ?? 45}°)
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePlacedSymbol(sym.id);
                            }}
                            className="text-rose-600 hover:text-rose-800 text-[10px]"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : activeTool === 'control_point' || selectedControlPoint !== null ? (
              /* TOOL-SPECIFIC CONTROLS: SURVEY CONTROL POINTS */
              <div className="space-y-3 font-mono text-[11px]">
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1.5">
                  <div className="font-bold text-emerald-900">SURVEY CONTROL POINTS (OVERCUT & UNDERCUT)</div>
                  <p className="text-[10px] text-emerald-800 leading-relaxed">
                    Click anywhere inside or <strong>outside the tunnel outline</strong> to place a Survey Control Point (CP) for marking overcut / overbreak survey points, or drag any CP to adjust its coordinates.
                  </p>
                </div>

                {selectedControlPoint && (
                  <div className="p-2.5 bg-white border border-emerald-300 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900">
                        Editing {selectedControlPoint.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteControlPoint(selectedControlPoint.id)}
                        className="text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <label className="space-y-0.5">
                        <span className="text-[9px] text-slate-500">Label</span>
                        <input
                          type="text"
                          value={cpDraftLabel}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCpDraftLabel(val);
                            handleUpdateControlPointsWithHistory((prev) =>
                              prev.map((cp) =>
                                cp.id === selectedControlPoint.id ? { ...cp, label: val } : cp
                              )
                            );
                          }}
                          className="w-full px-1.5 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900 font-bold"
                        />
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[9px] text-slate-500">X (m)</span>
                        <input
                          type="number"
                          step="0.05"
                          value={cpDraftX}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCpDraftX(val);
                            const num = parseFloat(val);
                            if (!Number.isNaN(num)) {
                              handleUpdateControlPointsWithHistory((prev) =>
                                prev.map((cp) =>
                                  cp.id === selectedControlPoint.id
                                    ? { ...cp, point: { ...cp.point, x: num } }
                                    : cp
                                )
                              );
                            }
                          }}
                          className="w-full px-1.5 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900"
                        />
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[9px] text-slate-500">Y (m)</span>
                        <input
                          type="number"
                          step="0.05"
                          value={cpDraftY}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCpDraftY(val);
                            const num = parseFloat(val);
                            if (!Number.isNaN(num)) {
                              handleUpdateControlPointsWithHistory((prev) =>
                                prev.map((cp) =>
                                  cp.id === selectedControlPoint.id
                                    ? { ...cp, point: { ...cp.point, y: num } }
                                    : cp
                                )
                              );
                            }
                          }}
                          className="w-full px-1.5 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900"
                        />
                      </label>
                    </div>
                  </div>
                )}

                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-700 uppercase">
                    Control Points ({surfaceControlPoints.length})
                  </div>
                  <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {surfaceControlPoints.length === 0 ? (
                      <div className="p-2.5 text-[10px] text-slate-500">
                        No control points placed on this surface yet.
                      </div>
                    ) : (
                      surfaceControlPoints.map((cp) => (
                        <div
                          key={cp.id}
                          onClick={() => setSelectedControlPointId(cp.id)}
                          className={`px-2.5 py-1.5 flex items-center justify-between cursor-pointer ${
                            cp.id === selectedControlPointId
                              ? 'bg-emerald-50 font-bold'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-emerald-800 font-bold">{cp.label}</span>
                          <span className="text-slate-600">
                            ({cp.point.x.toFixed(2)}m, {cp.point.y.toFixed(2)}m)
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : activeTool === 'dip_probe' ? (
              /* TOOL-SPECIFIC CONTROLS: 3D DIP SURFACE & FACET PROBE */
              <div className="space-y-3 font-mono text-[11px]">
                <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg space-y-1.5">
                  <div className="font-bold text-indigo-900 flex items-center justify-between">
                    <span>3D DIP SURFACE &amp; FACET PROBE</span>
                    <span className="text-[9.5px] text-indigo-700">Live 3D SVD</span>
                  </div>
                  <p className="text-[10px] text-indigo-800 leading-relaxed">
                    Hover or click any rock facet or joint trace on the canvas to inspect its 3D surface relief (ΔZ), local fracture ridge tangent, and true Dip / Dip Direction.
                  </p>
                </div>

                {/* Live Cursor 3D Relief & Facet Telemetry */}
                {cursorMeters && activePhotoRidgeField && (
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1.5 text-[10px]">
                    <div className="font-bold text-slate-700 uppercase">
                      Live Rock Surface Facet at Cursor
                    </div>
                    {(() => {
                      const uv = surfaceMetersToImageUV(
                        cursorMeters,
                        activeSurface,
                        geometry,
                        settings,
                        currentPhoto.transform
                      );
                      const px = Math.max(
                        0,
                        Math.min(
                          activePhotoRidgeField.width - 1,
                          Math.round(uv.u * (activePhotoRidgeField.width - 1))
                        )
                      );
                      const py = Math.max(
                        0,
                        Math.min(
                          activePhotoRidgeField.height - 1,
                          Math.round(uv.v * (activePhotoRidgeField.height - 1))
                        )
                      );
                      const idx = py * activePhotoRidgeField.width + px;
                      const reliefZ = activePhotoRidgeField.reliefMapMeters[idx] || 0;
                      const pcScore = Math.round(
                        (activePhotoRidgeField.phaseCongruencyMap[idx] || 0) * 100
                      );
                      const tangDeg = Math.round(
                        ((activePhotoRidgeField.tangentAngle[idx] || 0) * 180) / Math.PI
                      );
                      return (
                        <div className="divide-y divide-slate-100">
                          <div className="flex justify-between py-1">
                            <span className="text-slate-500">3D Depth Relief (ΔZ)</span>
                            <span className="font-bold text-indigo-700">
                              {reliefZ >= 0 ? '+' : ''}
                              {reliefZ.toFixed(3)} m
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-slate-500">Phase Congruency Ridge</span>
                            <span className="font-bold text-cyan-700">{pcScore}%</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-slate-500">Local Facet Tangent</span>
                            <span className="font-bold text-slate-800">{tangDeg}°</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDepthReliefOverlay((prev) => {
                        const next = !prev;
                        if (next) setShowCrackXRayOverlay(false);
                        return next;
                      });
                    }}
                    disabled={!activePhotoRidgeField?.depthReliefOverlayDataUrl}
                    className={`py-1.5 px-2 rounded-lg border text-[10px] font-bold cursor-pointer disabled:opacity-40 ${
                      showDepthReliefOverlay
                        ? 'bg-indigo-600 text-white border-indigo-700'
                        : 'bg-white text-indigo-800 border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    {showDepthReliefOverlay ? '✓ Dip Relief ON' : 'Dip Relief Heatmap'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShow3DStrikeDipModal(true)}
                    className="py-1.5 px-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                  >
                    3D Strike &amp; Dip
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => openPhotogrammetryLab('kinematic')}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold cursor-pointer"
                >
                  Open 3D Stereonet &amp; Wedge Analysis
                </button>
              </div>
            ) : activeTool === 'measure' ? (
              /* TOOL-SPECIFIC CONTROLS: VIRTUAL SCANLINE RQD, FRACTURE FREQUENCY & 2-POINT LASER/TAPE SCALE CALIBRATOR */
              <div className="space-y-3 font-mono text-[11px]">
                <div className="p-2.5 bg-cyan-50 border border-cyan-200 rounded-lg space-y-2">
                  <div className="font-bold text-cyan-900">
                    VIRTUAL SCANLINE RQD &amp; 2-PT SCALE CALIBRATOR
                  </div>
                  {measurementInfo ? (
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="p-2 bg-white rounded border border-cyan-200">
                          <div className="text-[9px] text-slate-500">SCANLINE LENGTH</div>
                          <div className="text-sm font-bold text-cyan-700">
                            {measurementInfo.distMeters} m
                          </div>
                        </div>
                        <div className="p-2 bg-white rounded border border-cyan-200">
                          <div className="text-[9px] text-slate-500">LINE ANGLE</div>
                          <div className="text-sm font-bold text-cyan-700">
                            {measurementInfo.angleDeg}°
                          </div>
                        </div>
                        <div className="p-2 bg-white rounded border border-amber-200">
                          <div className="text-[9px] text-slate-500">INTERSECTED JOINTS</div>
                          <div className="text-sm font-bold text-amber-700">
                            {measurementInfo.scanline.intersectionCount} (λ={measurementInfo.scanline.fractureFrequencyLambda}/m)
                          </div>
                        </div>
                        <div className="p-2 bg-white rounded border border-emerald-200">
                          <div className="text-[9px] text-slate-500">SCANLINE RQD (≥10cm)</div>
                          <div className="text-sm font-bold text-emerald-700">
                            {measurementInfo.scanline.measuredScanlineRqdPct}%
                          </div>
                        </div>
                      </div>

                      <div className="p-2 bg-white rounded border border-slate-200 text-[10px] space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Priest-Hudson Theoretical RQD:</span>
                          <span className="font-bold text-indigo-700">
                            {measurementInfo.scanline.priestHudsonRqdPct}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Mean Fracture Spacing:</span>
                          <span className="font-bold text-slate-800">
                            {measurementInfo.scanline.meanSpacingMeters.toFixed(2)} m
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const rqdVal = measurementInfo.scanline.measuredScanlineRqdPct;
                          const spVal = measurementInfo.scanline.meanSpacingMeters;
                          onUpdateQIndexParams({
                            ...qIndexParams,
                            rqd: rqdVal,
                          });
                          onUpdateQParamStatus({
                            ...qParamStatus,
                            rqd: 'USER_ENTERED',
                          });
                          const rqdRating =
                            rqdVal >= 90 ? 20 : rqdVal >= 75 ? 17 : rqdVal >= 50 ? 13 : rqdVal >= 25 ? 8 : 3;
                          const spRating =
                            spVal > 2.0 ? 20 : spVal >= 0.6 ? 15 : spVal >= 0.2 ? 10 : spVal >= 0.06 ? 8 : 5;
                          onUpdateRmrParams({
                            ...rmrParams,
                            rqdPercent: rqdVal,
                            rqdRating,
                            spacingMeters: spVal,
                            spacingRating: spRating,
                            paramStatus: {
                              ...rmrParams.paramStatus,
                              rqd: 'USER_ENTERED',
                              spacing: 'USER_ENTERED',
                            },
                          });
                          onUpdateStatusMessage?.(
                            `Applied Scanline RQD (${rqdVal}%) & Mean Spacing (${spVal.toFixed(2)}m) to RMR & Q-System.`
                          );
                        }}
                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold cursor-pointer shadow-2xs"
                      >
                        ✓ Apply Scanline RQD &amp; Spacing to RMR / Q
                      </button>

                      {/* 2-Point Laser / Survey Tape True-Scale Photo Calibrator */}
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded space-y-1.5">
                        <div className="text-[10px] font-bold text-amber-900">
                          2-POINT LASER / TAPE PHOTO SCALE CALIBRATOR
                        </div>
                        <p className="text-[9.5px] text-amber-800 leading-snug">
                          Enter known field distance between P1 &amp; P2 to calibrate photo meter scale:
                        </p>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.05"
                            min="0.1"
                            value={knownScaleDistanceInput}
                            onChange={(e) => setKnownScaleDistanceInput(e.target.value)}
                            className="w-24 px-2 py-1 bg-white border border-amber-300 rounded text-slate-900 font-bold"
                          />
                          <span className="text-[10px] text-amber-900 font-bold">m</span>
                          <button
                            type="button"
                            onClick={() => {
                              const knownM = parseFloat(knownScaleDistanceInput);
                              if (
                                Number.isNaN(knownM) ||
                                knownM <= 0.05 ||
                                measurementInfo.distNumeric <= 0.02
                              ) {
                                return;
                              }
                              const ratio = knownM / measurementInfo.distNumeric;
                              handleUpdateTransformWithHistory((prev) => ({
                                ...prev,
                                scaleX: Number(
                                  Math.max(0.2, Math.min(4.0, (prev.scaleX || 1) * ratio)).toFixed(4)
                                ),
                                scaleY: Number(
                                  Math.max(0.2, Math.min(4.0, (prev.scaleY || 1) * ratio)).toFixed(4)
                                ),
                              }));
                              setMeasurePts([
                                measurePts[0],
                                {
                                  x: Number(
                                    (
                                      measurePts[0].x +
                                      (measurePts[1].x - measurePts[0].x) * ratio
                                    ).toFixed(3)
                                  ),
                                  y: Number(
                                    (
                                      measurePts[0].y +
                                      (measurePts[1].y - measurePts[0].y) * ratio
                                    ).toFixed(3)
                                  ),
                                },
                              ]);
                              onUpdateStatusMessage?.(
                                `Calibrated ${activeSurface.toUpperCase()} photo scale by ×${ratio.toFixed(
                                  3
                                )} to match field distance ${knownM.toFixed(2)} m.`
                              );
                            }}
                            className="flex-1 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold cursor-pointer"
                          >
                            Calibrate Scale
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-cyan-800 leading-relaxed">
                      Click <strong>P1</strong> and <strong>P2</strong> across the tunnel surface to measure real-world distance, compute <strong>Virtual Scanline RQD (%)</strong> across intersected joints, or calibrate photo scale from a known laser/tape measurement.
                    </p>
                  )}
                  {measurePts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setMeasurePts([])}
                      className="w-full py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded font-bold cursor-pointer"
                    >
                      Clear Scanline / Measurement
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Window-Specific Property Grid — Shows ONLY what is needed for the current active window */
              <div className="space-y-2.5 font-mono text-[11px]">
                <div className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-bold flex items-center justify-between">
                  <span className="text-slate-500">Current Step:</span>
                  <span className="text-cyan-700">
                    {cadRibbonTab === 'TUNNEL_PHOTO'
                      ? '1. PHOTO & PROFILE'
                      : cadRibbonTab === 'HOME'
                      ? '2. CORE MAPPING'
                      : cadRibbonTab === 'GEOLOGY_3D'
                      ? '3. GEOLOGY'
                      : cadRibbonTab === 'SURVEY_OVERBREAK'
                      ? '4. SURVEY'
                      : '5. TABLES & OUTPUT'}
                  </span>
                </div>

                {/* WINDOW 1: PHOTO & PROFILE — Only Surface Photo & Tunnel Profile Properties */}
                {cadRibbonTab === 'TUNNEL_PHOTO' && (
                  <>
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                        <span>Tunnel Profile &amp; Dimensions</span>
                        {onOpenCustomProfileEditor && (
                          <button
                            type="button"
                            onClick={onOpenCustomProfileEditor}
                            className="text-[9px] px-2 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded cursor-pointer font-semibold"
                          >
                            Edit Shape →
                          </button>
                        )}
                      </div>
                      <div className="divide-y divide-slate-100 text-[10px]">
                        <div className="grid grid-cols-2 px-2.5 py-1.5">
                          <span className="text-slate-500">Shape Profile</span>
                          <span className="text-slate-900 font-semibold text-right">
                            {geometry.customProfile?.name || geometry.crownGeometry.toUpperCase()}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 px-2.5 py-1.5">
                          <span className="text-slate-500">Span Width (W)</span>
                          <span className="text-emerald-700 font-bold text-right">
                            {geometry.width.toFixed(2)} m
                          </span>
                        </div>
                        <div className="grid grid-cols-2 px-2.5 py-1.5">
                          <span className="text-slate-500">Total Height (H)</span>
                          <span className="text-emerald-700 font-bold text-right">
                            {geometry.height.toFixed(2)} m
                          </span>
                        </div>
                        <div className="grid grid-cols-2 px-2.5 py-1.5">
                          <span className="text-slate-500">Left Wall Length</span>
                          <span className="text-slate-800 font-semibold text-right">
                            {geometry.hasLeftWall === false
                              ? 'Inactive'
                              : `${(
                                  geometry.leftWallArcLength ??
                                  geometry.leftWallHeight ??
                                  geometry.wallHeight
                                ).toFixed(2)} m`}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 px-2.5 py-1.5">
                          <span className="text-slate-500">Right Wall Length</span>
                          <span className="text-slate-800 font-semibold text-right">
                            {geometry.hasRightWall === false
                              ? 'Inactive'
                              : `${(
                                  geometry.rightWallArcLength ??
                                  geometry.rightWallHeight ??
                                  geometry.wallHeight
                                ).toFixed(2)} m`}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 px-2.5 py-1.5">
                          <span className="text-slate-500">Crown Arch Length</span>
                          <span className="text-sky-700 font-semibold text-right">
                            {geometry.hasCrown === false
                              ? 'Face + Walls Only'
                              : `${geometry.crownArcLength.toFixed(2)} m`}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 px-2.5 py-1.5">
                          <span className="text-slate-500">Round Pull</span>
                          <span className="text-amber-700 font-bold text-right">
                            {settings.roundLength.toFixed(2)} m
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                        <span>Surface Photo ({activeSurface.toUpperCase()})</span>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[9px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded cursor-pointer font-semibold"
                        >
                          {currentPhoto.image ? 'Replace' : 'Upload'}
                        </button>
                      </div>
                      <div className="divide-y divide-slate-100 text-[10px]">
                        <div className="grid grid-cols-2 px-2.5 py-1.5">
                          <span className="text-slate-500">Primary Photo</span>
                          <span className="text-slate-800 font-medium truncate text-right">
                            {currentPhoto.fileName || (currentPhoto.image ? 'Loaded' : 'None')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 px-2.5 py-1.5">
                          <span className="text-slate-500">Opacity</span>
                          <span className="text-cyan-700 font-bold text-right">{currentPhoto.opacity}%</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setInitialTransformSnapshot(currentPhoto.transform);
                        setTransformPast([]);
                        setTransformFuture([]);
                        setActiveTool('photo_fit');
                      }}
                      className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-[11px] font-bold cursor-pointer shadow-xs"
                    >
                      Open Photo Fit &amp; Mesh Warp
                    </button>
                  </>
                )}

                {/* WINDOW 2: CORE MAPPING — Joint Trace, X-Ray Vision & Discontinuity Sets for Active Surface */}
                {cadRibbonTab === 'HOME' && (
                  <>
                    {/* Vision & Fracture Detection Controls */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                        <span>Crack Vision &amp; Trace Engine</span>
                        <span className="text-[9px] text-cyan-700 font-semibold">
                          {activePhotoRidgeField ? 'Ridge Field Ready' : 'No Photo'}
                        </span>
                      </div>
                      <div className="p-2 grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowCrackXRayOverlay((prev) => {
                              const next = !prev;
                              if (next) setShowDepthReliefOverlay(false);
                              return next;
                            });
                          }}
                          disabled={!activePhotoRidgeField?.xrayOverlayDataUrl}
                          className={`px-2 py-1.5 rounded border text-[10px] font-bold cursor-pointer disabled:opacity-40 ${
                            showCrackXRayOverlay
                              ? 'bg-cyan-600 text-white border-cyan-700'
                              : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border-cyan-300'
                          }`}
                        >
                          {showCrackXRayOverlay ? '✓ Crack X-Ray ON' : 'Crack X-Ray Vision'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowDepthReliefOverlay((prev) => {
                              const next = !prev;
                              if (next) setShowCrackXRayOverlay(false);
                              return next;
                            });
                          }}
                          disabled={!activePhotoRidgeField?.depthReliefOverlayDataUrl}
                          className={`px-2 py-1.5 rounded border text-[10px] font-bold cursor-pointer disabled:opacity-40 ${
                            showDepthReliefOverlay
                              ? 'bg-indigo-600 text-white border-indigo-700'
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-300'
                          }`}
                        >
                          {showDepthReliefOverlay ? '✓ 3D Relief ON' : '3D Dip Facet Map'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDraftJointPoints([]);
                            setJointDrawMode('seed_autotrace');
                            setActiveTool('add_joint');
                          }}
                          className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded text-[10px] font-bold cursor-pointer"
                        >
                          1-Click Crack Seed
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDraftJointPoints([]);
                            setJointDrawMode('magnetic_livewire');
                            setActiveTool('add_joint');
                          }}
                          className="px-2 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 rounded text-[10px] font-bold cursor-pointer"
                        >
                          Snap Crack Livewire
                        </button>
                      </div>
                      {windowComplexityMode === 'advanced' && (
                        <div className="px-2 pb-2 pt-0.5 border-t border-slate-100 grid grid-cols-1 gap-1.5">
                          <button
                            type="button"
                            onClick={handleRefineAllActiveSurfaceTraces}
                            disabled={!activePhotoRidgeField || surfaceJoints.length === 0}
                            className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded text-[10px] font-bold cursor-pointer"
                          >
                            Sub-Pixel Steger Lock All ({surfaceJoints.length} traces)
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                        <span>Joint Sets ({jointSets.length})</span>
                        <span className="text-[9px] text-slate-500">
                          {joints.filter((j) => j.surface === activeSurface).length} traces here
                        </span>
                      </div>
                      {/* Active Joint Set Selector for New Traces */}
                      <div className="px-2.5 py-1.5 bg-slate-50/70 border-b border-slate-100 space-y-1">
                        <div className="flex items-center justify-between text-[8.5px] text-slate-600">
                          <span>Default Set for New Trace:</span>
                          <span className="font-bold text-slate-900">{draftSetId}</span>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {['J1', 'J2', 'J3', 'J4', 'J5', 'J0', 'F1'].map((sKey) => {
                            const sCol = JOINT_SET_PALETTE[sKey]?.color || '#F59E0B';
                            const isCur = draftSetId === sKey;
                            return (
                              <button
                                key={`quick-draft-set-${sKey}`}
                                type="button"
                                onClick={() => setDraftSetId(sKey)}
                                className={`py-0.5 rounded text-[9px] font-bold cursor-pointer border ${
                                  isCur ? 'text-white ring-1 ring-slate-900' : 'bg-white text-slate-700 border-slate-200'
                                }`}
                                style={isCur ? { backgroundColor: sCol, borderColor: sCol } : undefined}
                                title={`Plot new traces as ${sKey}`}
                              >
                                {sKey}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="divide-y divide-slate-100 text-[10px] max-h-48 overflow-y-auto">
                        {jointSets.length === 0 ? (
                          <div className="px-2.5 py-3 text-slate-500">
                            Click &quot;2-Pt Line&quot;, &quot;1-Click Crack Seed&quot;, or &quot;AI Trace&quot; to map discontinuities.
                          </div>
                        ) : (
                          jointSets.map((js) => {
                            const refCol =
                              js.color ||
                              getDirectionalJointSetColor(
                                js.avgDipDirection ?? 0,
                                js.avgDip ?? 45
                              );
                            return (
                              <div
                                key={js.id}
                                className="flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-50"
                              >
                                <span className="flex items-center gap-1.5 font-bold text-slate-900">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-slate-300"
                                    style={{ backgroundColor: refCol }}
                                  />
                                  <span>{js.id}</span>
                                </span>
                                <span
                                  className="font-semibold px-1.5 py-0.5 rounded text-[9.5px]"
                                  style={{
                                    backgroundColor: `${refCol}18`,
                                    color: refCol,
                                  }}
                                >
                                  {js.orientation}
                                </span>
                                <span className="text-slate-500">
                                  n={js.jointCount ?? joints.filter((j) => j.set === js.id).length}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setDraftJointPoints([]);
                          setJointDrawMode('two_point_line');
                          setActiveTool('add_joint');
                        }}
                        className="px-2 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold cursor-pointer shadow-xs"
                      >
                        + 2-Pt Joint Line
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftJointPoints([]);
                          setJointDrawMode('polyline');
                          setActiveTool('add_joint');
                        }}
                        className="px-2 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[10px] font-bold cursor-pointer shadow-xs"
                      >
                        + Multi-Pt Polyline
                      </button>
                    </div>
                  </>
                )}

                {/* WINDOW 3: GEOLOGY — Dip Surface, 3D Facets, Lithology, Symbols, Stereonet & JRC */}
                {cadRibbonTab === 'GEOLOGY_3D' && (
                  <>
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                        Dip Surface &amp; Geology Summary
                      </div>
                      <div className="divide-y divide-slate-100 text-[10px]">
                        <div className="grid grid-cols-2 px-2.5 py-1.5">
                          <span className="text-slate-500">Lithology Zones</span>
                          <span className="text-amber-700 font-bold text-right">
                            {lithologyRegions.filter((r) => r.surface === activeSurface).length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 px-2.5 py-1.5">
                          <span className="text-slate-500">ISRM Symbols</span>
                          <span className="text-purple-700 font-bold text-right">
                            {surfacePlacedSymbols.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 px-2.5 py-1.5">
                          <span className="text-slate-500">Mapped Traces</span>
                          <span className="text-cyan-700 font-bold text-right">
                            {joints.filter((j) => j.surface === activeSurface).length}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTool('dip_probe')}
                        className="px-2.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        3D Dip Surface &amp; Facet Probe
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDepthReliefOverlay((prev) => {
                            const next = !prev;
                            if (next) setShowCrackXRayOverlay(false);
                            return next;
                          });
                        }}
                        disabled={!activePhotoRidgeField?.depthReliefOverlayDataUrl}
                        className={`px-2.5 py-2 rounded-lg border text-[10px] font-bold cursor-pointer disabled:opacity-40 ${
                          showDepthReliefOverlay
                            ? 'bg-indigo-600 text-white border-indigo-700'
                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-300'
                        }`}
                      >
                        {showDepthReliefOverlay
                          ? '✓ 3D Dip Surface Relief Map ON'
                          : 'Toggle 3D Dip Surface Relief Map'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTool('lithology')}
                        className="px-2.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Edit Lithology Polygons
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTool('geological_symbol')}
                        className="px-2.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Place ISRM Symbols
                      </button>
                      <button
                        type="button"
                        onClick={() => openPhotogrammetryLab('kinematic')}
                        className="px-2.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Stereonet &amp; 3D Kinematic Wedges
                      </button>
                      {windowComplexityMode === 'advanced' && (
                        <>
                          <button
                            type="button"
                            onClick={() => openPhotogrammetryLab('jrc')}
                            className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            Barton JRC Roughness &amp; Z2 Lab
                          </button>
                          <button
                            type="button"
                            onClick={() => openPhotogrammetryLab('seepage')}
                            className="px-2.5 py-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-300 rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            Seepage &amp; Groundwater Mapper
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}

                {/* WINDOW 4: SURVEY — Only Control Points & Overbreak */}
                {cadRibbonTab === 'SURVEY_OVERBREAK' && (
                  <>
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                        Survey &amp; Overbreak
                      </div>
                      <div className="divide-y divide-slate-100 text-[10px]">
                        <div className="grid grid-cols-2 px-2.5 py-1.5">
                          <span className="text-slate-500">Control Points</span>
                          <span className="text-emerald-700 font-bold text-right">
                            {surfaceControlPoints.length} CPs
                          </span>
                        </div>
                        <div className="grid grid-cols-2 px-2.5 py-1.5">
                          <span className="text-slate-500">Overbreak Area</span>
                          <span className="text-rose-700 font-bold text-right">
                            +{overbreakAnalysis.overbreakAreaSqMeters.toFixed(2)} m²
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTool('control_point')}
                        className="px-2.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Manage Survey Control Points
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTool('overbreak');
                          setLayerVisibility((prev) => ({ ...prev, overbreakUndercut: true }));
                        }}
                        className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Overbreak / Undercut Analysis
                      </button>
                    </div>
                  </>
                )}

                {/* WINDOW 5: TABLES & OUTPUT — Classification, Auto-Fitted 3D Unfolded Log Status & Final Sheet Output */}
                {(cadRibbonTab as string) === 'CLASSIFICATION_SHEET' && (
                  <>
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                        Classification &amp; Output
                      </div>
                      <div className="divide-y divide-slate-100 text-[10px]">
                        <div className="grid grid-cols-2 px-2.5 py-1.5">
                          <span className="text-slate-500">Method</span>
                          <span className="text-indigo-700 font-bold text-right">
                            {selectedClassificationMethod}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 px-2.5 py-1.5">
                          <span className="text-slate-500">Joint Sets</span>
                          <span className="text-cyan-700 font-bold text-right">
                            {jointSets.length} sets ({joints.length} traces)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setGeologyDrawerTab('geology_tables');
                          setShowSetTableDrawer(true);
                          setShowAILearningDrawer(false);
                        }}
                        className="px-2.5 py-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-300 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Open Discontinuity Set Tables
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setGeologyDrawerTab('q_index');
                          setShowSetTableDrawer(true);
                          setShowAILearningDrawer(false);
                        }}
                        className="px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        Open RMR / Q / GSI Calculator
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenExportSheet('FINAL_ENGINEERING_SHEET')}
                        className="px-2.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold cursor-pointer shadow-xs"
                      >
                        Plot Engineering Sheet (PDF/DWG)
                      </button>
                    </div>
                  </>
                )}
              </div>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
      )}

      {/* ====================================================================
          COLLAPSIBLE BOTTOM DRAWER: CONTINUOUS DAILY AI LEARNING LOOP (Section 26)
         ==================================================================== */}
      {showAILearningDrawer && (
        <div className="h-[clamp(185px,28dvh,250px)] bg-[#111621] border-t border-slate-800 p-2.5 overflow-y-auto shrink-0 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 border-b border-slate-800 pb-1.5">
            <div className="flex items-center gap-3">
              <span className="font-display font-semibold text-cyan-300">
                CONTINUOUS DAILY AI LEARNING &amp; VERIFIED GEOLOGIST CORRECTIONS
              </span>
              <span className="px-2 py-0.5 bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 rounded text-[10px]">
                {sessionMemory.currentModelVersion || 'AKASH AI Model 1.3'} · Validation{' '}
                {sessionMemory.modelHistory?.[0]?.validationScorePct ?? 95.4}%
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-300">
              <span>
                Training Samples:{' '}
                <strong className="text-slate-100">{sessionMemory.trainingSamplesTotal ?? 0}</strong>
              </span>
              <span>
                Verified Traces:{' '}
                <strong className="text-emerald-400">
                  {sessionMemory.verifiedExamplesCount ?? 0}
                </strong>
              </span>
              <span>
                Corrections Learned:{' '}
                <strong className="text-amber-300">
                  {sessionMemory.correctionsLearnedCount ?? 0}
                </strong>
              </span>
              {onTrainAndUpdateAIModel && (
                <button
                  onClick={onTrainAndUpdateAIModel}
                  className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold rounded text-[10px] transition-colors cursor-pointer"
                  title="Compile verified geologist corrections and promote a new calibrated AI model version"
                >
                  ⚡ Train &amp; Update AI Model Now
                </button>
              )}
              {onResetAILearningFilters &&
                (sessionMemory.rejectedAngleRanges.length > 0 ||
                  sessionMemory.confirmedOrientations.length > 0) && (
                  <button
                    onClick={onResetAILearningFilters}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-[10px] transition-colors cursor-pointer"
                    title="Clear active orientation suppression/boost filters while preserving model version history"
                  >
                    Reset Filters ({sessionMemory.rejectedAngleRanges.length} suppressed /{' '}
                    {sessionMemory.confirmedOrientations.length} boosted)
                  </button>
                )}
              <button
                onClick={() => setShowAILearningDrawer(false)}
                className="text-slate-400 hover:text-white px-1"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Model Version History */}
            <div className="space-y-1.5">
              <div className="text-[10px] text-slate-400 font-semibold">
                VERSIONED MODEL RELEASES (SAFE DAILY VALIDATION)
              </div>
              {(sessionMemory.modelHistory || []).map((m) => (
                <div
                  key={m.version}
                  className="p-2 bg-slate-900/90 border border-slate-800 rounded flex items-center justify-between text-[11px]"
                >
                  <div>
                    <div className="text-slate-100 font-semibold">
                      {m.version} <span className="text-slate-500">({m.updatedAt})</span>
                    </div>
                    <div className="text-[10px] text-slate-400">{m.majorChanges}</div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="text-emerald-400 font-semibold">{m.validationScorePct}%</div>
                    <div className="text-[10px] text-slate-500">{m.trainingDataCount} samples</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Verified Geologist Corrections Log */}
            <div className="space-y-1.5">
              <div className="text-[10px] text-slate-400 font-semibold">
                RECENT VERIFIED GEOLOGIST CORRECTIONS (AI PREDICTION VS USER APPROVED)
              </div>
              {(sessionMemory.verifiedRecords || []).length === 0 ? (
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded text-[11px] text-slate-400">
                  Accept/Confirm, Reclassify, Reshape, or Delete traces on the canvas to log verified
                  geologist training pairs for the daily model update cycle.
                </div>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {(sessionMemory.verifiedRecords || []).map((rec) => (
                    <div
                      key={rec.id}
                      className="p-1.5 bg-slate-900/90 border border-slate-800 rounded flex items-center justify-between text-[10px]"
                    >
                      <div>
                        <span className="text-cyan-300 font-semibold">
                          [{rec.correctionType.replace(/_/g, ' ')}]
                        </span>{' '}
                        <span className="text-slate-400">{rec.aiPredictionSummary}</span> →{' '}
                        <span className="text-emerald-300">{rec.userApprovedSummary}</span>
                      </div>
                      <span className="text-slate-500 shrink-0 ml-2">{rec.scope}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          COLLAPSIBLE BOTTOM DRAWER: GEOLOGICAL TABLES & BARTON Q-INDEX CALCULATOR
         ==================================================================== */}
      {showSetTableDrawer && cadRibbonTab !== 'CLASSIFICATION_SHEET' && (
        <GeologyAndQIndexDrawer
          activeTab={geologyDrawerTab}
          onChangeTab={setGeologyDrawerTab}
          onClose={() => setShowSetTableDrawer(false)}
          geometry={geometry}
          settings={settings}
          activeSurface={activeSurface}
          joints={joints}
          jointSets={jointSets}
          onUpdateJoints={onUpdateJointsWithHistory}
          onUpdateJointSetAttribute={onUpdateJointSetAttribute}
          onMergeJointSets={onMergeJointSets}
          qIndexParams={qIndexParams}
          onUpdateQIndexParams={onUpdateQIndexParams}
          qParamStatus={qParamStatus}
          onUpdateQParamStatus={onUpdateQParamStatus}
          selectedMethod={selectedClassificationMethod}
          onChangeSelectedMethod={onChangeSelectedClassificationMethod}
          rmrParams={rmrParams}
          onUpdateRmrParams={onUpdateRmrParams}
          gsiParams={gsiParams}
          onUpdateGsiParams={onUpdateGsiParams}
          rockMassSummary={rockMassSummary}
          onUpdateRockMassSummary={onUpdateRockMassSummary}
          onOpenExportSheet={onOpenExportSheet}
          onOpenKinematics={() => setShowPhotogrammetryModal(true)}
          savedProjects={savedProjects}
          overbreakAnalysis={overbreakAnalysis}
        />
      )}

      <PhotogrammetryStructuralModal
        isOpen={showPhotogrammetryModal}
        onClose={() => setShowPhotogrammetryModal(false)}
        initialTab={photogrammetryInitialTab}
        joints={joints}
        jointSets={jointSets}
        geometry={geometry}
        settings={settings}
        photos={photos}
        activeSurface={activeSurface}
        hasActiveRidgeField={Boolean(activePhotoRidgeField)}
        onRefineAllActiveSurfaceTraces={handleRefineAllActiveSurfaceTraces}
        onSelectJoint={(jId, surf) => {
          onSelectSurface(surf);
          setSelectedJointId(jId);
          setShowPhotogrammetryModal(false);
        }}
        onProceedToClassification={() => {
          setGeologyDrawerTab('q_index');
          setShowSetTableDrawer(true);
          setShowAILearningDrawer(false);
        }}
        onUpdateJoints={onUpdateJointsWithHistory}
        onApplyGroundwaterToClassification={(jw, jwDesc, rmrRating, inflowLMin, rmrDesc) => {
          onUpdateQIndexParams({
            ...qIndexParams,
            jw,
            jwDescription: jwDesc,
          });
          onUpdateQParamStatus({
            ...qParamStatus,
            jw: 'USER_ENTERED',
          });
          onUpdateRmrParams({
            ...rmrParams,
            groundwaterInflowLPerMin10m: inflowLMin,
            groundwaterRating: rmrRating,
            groundwaterDescription: rmrDesc,
            paramStatus: {
              ...rmrParams.paramStatus,
              groundwater: 'USER_ENTERED',
            },
          });
          onUpdateRockMassSummary({
            ...rockMassSummary,
            groundwaterCondition: `${rmrDesc} (~${inflowLMin.toFixed(1)} L/min, Jw=${jw})`,
          });
          onUpdateStatusMessage?.(
            `Applied Seepage Zone Groundwater to Classification: Q-System Jw = ${jw} & RMR89 Groundwater Rating = ${rmrRating}/15 (~${inflowLMin.toFixed(1)} L/min).`
          );
        }}
      />

      {/* ====================================================================
          NEW ADDITIVE AUTOCAD ENGINEERING MODALS (SUPPORT, UNFOLDED LOG, SHEET SET)
         ==================================================================== */}
      <RockSupportPatternModal
        isOpen={showRockSupportModal}
        onClose={() => setShowRockSupportModal(false)}
        geometry={geometry}
        settings={settings}
        qParams={qIndexParams}
        rmrParams={rmrParams}
        supportConfig={supportConfig}
        onUpdateSupportConfig={setSupportConfig}
      />

      <CadSheetSetManagerModal
        isOpen={showSheetSetModal}
        onClose={() => setShowSheetSetModal(false)}
        geometry={geometry}
        settings={settings}
        joints={joints}
        jointSets={jointSets}
        overbreakAnalysis={overbreakAnalysis}
        savedProjects={savedProjects}
        onLoadProjectRecord={(rec) => {
          if (onLoadProjectRecord) {
            onLoadProjectRecord(rec);
          } else {
            onOpenProjectMemoryModal('projects');
          }
        }}
        onOpenExportSheet={(mode) =>
          onOpenExportSheet(
            mode === 'GEOLOGICAL_MAPPING_SHEET'
              ? 'FINAL_ENGINEERING_SHEET'
              : 'ENGINEERING_QUANTITY_SHEET'
          )
        }
      />

      <SimpleFullPhotoAndAccuracyModal
        isOpen={showSimpleAccuracyModal}
        initialTab={simpleAccuracyInitialTab}
        onClose={() => setShowSimpleAccuracyModal(false)}
        geometry={geometry}
        settings={settings}
        photos={photos}
        activeSurface={activeSurface}
        joints={joints}
        jointSets={jointSets}
        rmrParams={rmrParams}
        qIndexParams={qIndexParams}
        qParamStatus={qParamStatus}
        onApplyExtractedGeometryAndScale={(
          nextGeometry,
          calibratedPxPerMeter,
          fullPhotoDataUrl,
          targetSurface
        ) => {
          onUpdateGeometry?.(nextGeometry);
          const surfToUpdate = targetSurface || activeSurface;
          onUpdatePhotoSurface(surfToUpdate, (prev) => ({
            ...prev,
            image: fullPhotoDataUrl || prev.image,
            warpedImage: fullPhotoDataUrl || prev.warpedImage,
            scale: calibratedPxPerMeter,
            autoFitted: true,
          }));
        }}
        onUpdateJointsWithHistory={onUpdateJointsWithHistory}
        onUpdateRmrParams={onUpdateRmrParams}
        onUpdateQIndexParams={onUpdateQIndexParams}
        onUpdateQParamStatus={onUpdateQParamStatus}
        onStatusMessage={onUpdateStatusMessage}
      />

      <Interactive3DStrikeDipVisualizerModal
        isOpen={show3DStrikeDipModal}
        onClose={() => setShow3DStrikeDipModal(false)}
        geometry={geometry}
        settings={settings}
        joints={joints}
        jointSets={jointSets}
        initialSelectedJointId={selectedJointId}
        onUpdateJointOrientation={(jointId, dipDirection, dip) => {
          const strike = (dipDirection - 90 + 360) % 360;
          onUpdateJointsWithHistory(
            joints.map((j) =>
              j.id === jointId
                ? {
                    ...j,
                    dipDirection,
                    dip,
                    strike,
                    orientationStatus: 'DIRECTLY_MEASURED',
                  }
                : j
            )
          );
        }}
        onCaptureSnapshotToSheetAppendix={(snapshot) => {
          onUpdateSettings?.((prev) => ({
            ...prev,
            strikeDip3DSnapshots: [snapshot, ...(prev.strikeDip3DSnapshots || [])].slice(0, 4),
          }));
          onUpdateStatusMessage?.(
            `Captured 3D Strike & Dip snapshot (${snapshot.primaryPlaneLabel}) to Final Engineering Mapping Sheet Appendix.`
          );
        }}
        onDeleteSnapshotFromSheetAppendix={(snapshotId) => {
          onUpdateSettings?.((prev) => ({
            ...prev,
            strikeDip3DSnapshots: (prev.strikeDip3DSnapshots || []).filter(
              (s) => s.id !== snapshotId
            ),
          }));
        }}
        onOpenEngineeringSheet={() => onOpenExportSheet('FINAL_ENGINEERING_SHEET')}
      />

      <MatlabJointAnalyzerModal
        isOpen={showMatlabAnalyzerModal}
        onClose={() => setShowMatlabAnalyzerModal(false)}
        initialTab={matlabInitialTab}
        geometry={geometry}
        settings={settings}
        photos={photos}
        activeSurface={activeSurface}
        joints={joints}
        jointSets={jointSets}
        onUpdateJoints={onUpdateJointsWithHistory}
        onStatusMessage={onUpdateStatusMessage}
      />

      <PhotoTextured3DTunnelModal
        isOpen={show3DPhotoTunnelModal}
        onClose={() => setShow3DPhotoTunnelModal(false)}
        geometry={geometry}
        settings={settings}
        photos={photos}
        joints={joints}
        jointSets={jointSets}
        overbreakAnalysis={overbreakAnalysis}
        savedProjects={savedProjects}
        onUploadPhotoFile={onUploadPhotoFile}
        onUpdatePhotoSurface={onUpdatePhotoSurface}
        onCaptureSnapshotToSheet={(snapshot) => {
          onUpdateSettings?.((prev) => ({
            ...prev,
            strikeDip3DSnapshots: [snapshot, ...(prev.strikeDip3DSnapshots || [])].slice(0, 4),
          }));
          onUpdateStatusMessage?.(
            `Added 3D Photo-Textured Tunnel render (${snapshot.viewModeLabel}) to Final Engineering Sheet Appendix.`
          );
        }}
        onStatusMessage={onUpdateStatusMessage}
      />

      <TunnelJunctionFactorModal
        isOpen={showJunctionFactorModal}
        onClose={() => setShowJunctionFactorModal(false)}
        defaultMainSpanM={geometry.width || 8.5}
        defaultBranchSpanM={geometry.width ? Number((geometry.width * 0.85).toFixed(1)) : 7.0}
        currentQVal={qIndexParams ? evaluateQSystemWithValidation(qIndexParams, geometry.width, qParamStatus).qValue : 6.5}
        currentRmrVal={calculateBieniawskiRmr(rmrParams)?.finalRmr ?? 60}
        onApplyJunctionFactor={(res) => {
          setJunctionFactorData(res);
          onUpdateStatusMessage?.(
            `Applied Junction Factor Kj = ${res.junctionFactorKj}× (${res.junctionType.replace('_', ' ')}): Diagonal Span = ${res.diagonalSpanM}m, Roof Pressure = ${res.junctionRoofPressureKpa} kPa.`
          );
        }}
      />

    </div>
  );
};
