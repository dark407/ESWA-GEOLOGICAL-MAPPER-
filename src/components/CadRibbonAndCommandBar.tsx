import React, { memo } from 'react';
import {
  ArrowLeft,
  Box,
  Camera,
  Compass,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  GitFork,
  Layers,
  MousePointer,
  PenTool,
  Plus,
  Redo2,
  RotateCcw,
  Ruler,
  Save,
  Sliders,
  Sparkles,
  Trash2,
  Undo2,
  Wand2,
  Zap,
} from 'lucide-react';
import {
  ActiveTool,
  Joint,
  JointDrawMode,
  JointSet,
  LithologyRegion,
  PlacedGeologicalSymbol,
  PhotoSpectralFilterMode,
  PhotoSurface,
  QIndexParameters,
  QSystemParamKey,
  RmrParameters,
  GsiParameters,
  RockMassClassificationMethodId,
  RockMassSummaryTable,
  SurfaceType,
  SurveyControlPoint,
  TunnelGeometry,
  TunnelSettings,
  VectorLayerVisibility,
} from '../types/tunnel';
import {
  downloadEngineeringSheetAsPDF,
  downloadEngineeringSheetAsWordDoc,
} from '../engine/pdfAndWordExportEngine';

export type CadRibbonTab =
  | 'HOME'
  | 'TUNNEL_PHOTO'
  | 'GEOLOGY_3D'
  | 'ADVANCED_ANALYSIS'
  | 'SURVEY_OVERBREAK'
  | 'CLASSIFICATION_SHEET';

export interface CadRibbonAndCommandBarProps {
  cadRibbonTab: CadRibbonTab;
  setCadRibbonTab: (tab: CadRibbonTab) => void;
  cadRibbonCollapsed: boolean;
  setCadRibbonCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  cadCommandInput: string;
  setCadCommandInput: (val: string) => void;
  onExecuteCadCommand: (cmd: string) => void;

  activeSurface: SurfaceType;
  onChangeActiveSurface: (surface: SurfaceType) => void;
  geometry: TunnelGeometry;
  settings: TunnelSettings;
  currentPhoto: PhotoSurface;

  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  jointDrawMode: JointDrawMode;
  setJointDrawMode: (mode: JointDrawMode) => void;
  windowComplexityMode: 'simple' | 'advanced';
  setWindowComplexityMode: (mode: 'simple' | 'advanced') => void;

  onBackToSetup: () => void;
  onSaveOfflineDraft: () => void;
  onOpenProjectMemoryModal: (tab?: any) => void;
  onOpenCustomProfileEditor?: () => void;
  onOpenContinuousTunnelLog?: () => void;
  onOpenExportSheet: (mode?: any) => void;

  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canDelete: boolean;
  onDeleteSelected: () => void;

  joints: Joint[];
  jointSets: JointSet[];
  lithologyRegions: LithologyRegion[];
  placedSymbols: PlacedGeologicalSymbol[];
  controlPoints: SurveyControlPoint[];
  qIndexParams: QIndexParameters;
  qParamStatus: Record<QSystemParamKey, any>;
  rmrParams: RmrParameters;
  gsiParams: GsiParameters;
  selectedClassificationMethod: RockMassClassificationMethodId;
  rockMassSummary: RockMassSummaryTable;
  overbreakAnalysis: any;
  junctionFactorData: any;
  surfaceJointsCount: number;

  layerVisibility: VectorLayerVisibility;
  setLayerVisibility: React.Dispatch<React.SetStateAction<VectorLayerVisibility>>;
  layerOrder: string[];
  setLayerOrder: (order: string[]) => void;
  onMoveLayerUp: (idx: number) => void;
  onMoveLayerDown: (idx: number) => void;

  showCrackXRayOverlay: boolean;
  setShowCrackXRayOverlay: React.Dispatch<React.SetStateAction<boolean>>;
  showDepthReliefOverlay: boolean;
  setShowDepthReliefOverlay: React.Dispatch<React.SetStateAction<boolean>>;
  activePhotoFilterMode: PhotoSpectralFilterMode;
  setActivePhotoFilterMode: (mode: PhotoSpectralFilterMode) => void;
  activePhotoRidgeField: any;
  onExtractTracesFromPhotoFilter: () => void;
  onUpdatePhotoSurface: (surface: SurfaceType, updater: (prev: PhotoSurface) => PhotoSurface) => void;

  onTriggerFileInput: () => void;
  onTriggerStereoFileInput: () => void;
  onFinishDraftJoint: () => void;
  draftJointPointsLength: number;

  setShowPhotogrammetryModal: (show: boolean) => void;
  setShowSetTableDrawer: (show: boolean) => void;
  setShowAILearningDrawer: (show: boolean) => void;
  setGeologyDrawerTab: (tab: any) => void;
  setShow3DPhotoTunnelModal: (show: boolean) => void;
  setShow3DStrikeDipModal: (show: boolean) => void;
  setShowMatlabAnalyzerModal: (show: boolean) => void;
  setMatlabInitialTab: (tab: any) => void;
  setShowSheetSetModal: (show: boolean) => void;
  setShowRockSupportModal: (show: boolean) => void;
  setShowJunctionFactorModal: (show: boolean) => void;
  setShowCadPropertiesAlways: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenPhotogrammetryLab: (tab: any) => void;
  onResetCalibrationToOutline: () => void;
}

export const CadRibbonAndCommandBar: React.FC<CadRibbonAndCommandBarProps> = memo((props) => {
  const {
    cadRibbonTab,
    setCadRibbonTab,
    cadRibbonCollapsed,
    setCadRibbonCollapsed,
    cadCommandInput,
    setCadCommandInput,
    onExecuteCadCommand,
    activeSurface,
    onChangeActiveSurface,
    geometry,
    settings,
    currentPhoto,
    activeTool,
    setActiveTool,
    jointDrawMode,
    setJointDrawMode,
    windowComplexityMode,
    setWindowComplexityMode,
    onBackToSetup,
    onSaveOfflineDraft,
    onOpenProjectMemoryModal,
    onOpenContinuousTunnelLog,
    onOpenExportSheet,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    canDelete,
    onDeleteSelected,
    joints,
    jointSets,
    lithologyRegions,
    placedSymbols,
    controlPoints,
    qIndexParams,
    qParamStatus,
    rmrParams,
    gsiParams,
    selectedClassificationMethod,
    rockMassSummary,
    overbreakAnalysis,
    junctionFactorData,
    layerVisibility,
    setLayerVisibility,
    layerOrder,
    setLayerOrder,
    onMoveLayerUp,
    onMoveLayerDown,
    showCrackXRayOverlay,
    setShowCrackXRayOverlay,
    showDepthReliefOverlay,
    setShowDepthReliefOverlay,
    activePhotoFilterMode,
    setActivePhotoFilterMode,
    activePhotoRidgeField,
    onExtractTracesFromPhotoFilter,
    onUpdatePhotoSurface,
    onTriggerFileInput,
    onTriggerStereoFileInput,
    onFinishDraftJoint,
    draftJointPointsLength,
    setShowPhotogrammetryModal,
    setShowSetTableDrawer,
    setShowAILearningDrawer,
    setGeologyDrawerTab,
    setShow3DPhotoTunnelModal,
    setShow3DStrikeDipModal,
    setShowMatlabAnalyzerModal,
    setMatlabInitialTab,
    setShowSheetSetModal,
    setShowJunctionFactorModal,
    setShowCadPropertiesAlways,
    onOpenPhotogrammetryLab,
    onResetCalibrationToOutline,
  } = props;

  const handleFinishOrResetDraft = () => {
    if (draftJointPointsLength >= 2) {
      onFinishDraftJoint();
    }
  };

  return (
    <header className="canvas-chrome relative z-40 flex flex-col bg-white border-b border-slate-200 shrink-0">
      {/* ROW 1: FULL-WIDTH PROMINENT 6-STEP WORKFLOW BAR */}
      <div className="w-full bg-slate-900 border-b border-slate-800 px-1.5 sm:px-2.5 py-1.5">
        <div className="grid grid-cols-6 gap-1 sm:gap-1.5 w-full">
          {(
            [
              { id: 'TUNNEL_PHOTO', step: '1', label: 'Face Fit', fullLabel: '1. Face Fit & Photo' },
              { id: 'HOME', step: '2', label: 'Core Mapping', fullLabel: '2. Core Mapping' },
              { id: 'GEOLOGY_3D', step: '3', label: 'Geology', fullLabel: '3. Geology & Rock' },
              { id: 'ADVANCED_ANALYSIS', step: '4', label: 'Advance Modeling', fullLabel: '4. Advance Analysis & Modeling' },
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
              onClick={onUndo}
              disabled={!canUndo}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 rounded cursor-pointer"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 rounded cursor-pointer"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onDeleteSelected}
              disabled={!canDelete}
              className="p-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-25 rounded cursor-pointer"
              title="Delete Selected Object (Del)"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center: Prominent 4 Tunnel Portions */}
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
                const isActive = activeSurface === surf.id;
                return (
                  <button
                    key={surf.id}
                    onClick={() => onChangeActiveSurface(surf.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer truncate ${
                      isActive
                        ? 'bg-sky-600 text-white shadow-sm ring-1 ring-sky-400'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <span>{surf.shortLabel}</span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Right: ESWACAD Command Line Prompt */}
        <div className="flex items-center gap-1 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onExecuteCadCommand(cadCommandInput);
            }}
            className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-0.5 shadow-inner"
          >
            <span className="text-[10px] font-mono font-bold text-slate-500 select-none">COMMAND:</span>
            <input
              type="text"
              value={cadCommandInput}
              onChange={(e) => setCadCommandInput(e.target.value)}
              placeholder="e.g. JOINT, LITH, Q, RMR..."
              className="bg-transparent text-slate-900 font-mono text-[11px] font-bold outline-none w-28 sm:w-36 uppercase placeholder:text-slate-400"
            />
          </form>
        </div>
      </div>

      {/* ROW 3: CONTEXTUAL WORKFLOW STEP TOOLBAR */}
      {!cadRibbonCollapsed && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 px-2 py-1.5 bg-white border-b border-slate-200">
          {/* STEP-SPECIFIC ACTION BUTTONS */}
          <div className="flex items-center gap-1 flex-wrap min-w-0">
            {/* STEP 1: PHOTO & PROFILE FIT */}
            {cadRibbonTab === 'TUNNEL_PHOTO' && (
              <div className="flex items-center gap-1 shrink-0 flex-nowrap">
                <button
                  onClick={onTriggerFileInput}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-md shadow-2xs cursor-pointer"
                  title="Upload rock face / wall photogrammetry image"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {currentPhoto.image ? 'Change Photo' : 'Upload Photo'}
                </button>

                <button
                  onClick={() => setActiveTool(activeTool === 'photo_fit' ? 'select' : 'photo_fit')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold rounded-md border transition-colors cursor-pointer ${
                    activeTool === 'photo_fit'
                      ? 'bg-amber-600 text-white border-amber-500'
                      : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-300'
                  }`}
                  title="Photo Fit & Scale Tool"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Scale / Fit
                </button>

                <button
                  onClick={onResetCalibrationToOutline}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-200 cursor-pointer"
                  title="Reset calibration to ideal profile outline"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Fit
                </button>
              </div>
            )}

            {/* STEP 2: CORE MAPPING */}
            {cadRibbonTab === 'HOME' && (
              <div className="flex items-center gap-1 shrink-0 flex-nowrap">
                <button
                  onClick={() => {
                    handleFinishOrResetDraft();
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
                    handleFinishOrResetDraft();
                    if (activeTool === 'add_joint' && jointDrawMode === 'two_point_line') {
                      setActiveTool('select');
                    } else {
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
                  title="2-Point Line"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  2-Pt Line
                </button>

                <button
                  onClick={() => {
                    handleFinishOrResetDraft();
                    if (activeTool === 'add_joint' && jointDrawMode === 'polyline') {
                      setActiveTool('select');
                    } else {
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
                  title="Polyline Tool"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Polyline
                </button>

                <button
                  onClick={() => {
                    handleFinishOrResetDraft();
                    if (activeTool === 'add_joint' && jointDrawMode === 'smooth_curve') {
                      setActiveTool('select');
                    } else {
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
                  title="Spline Tool"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Spline Curve
                </button>

                <button
                  onClick={() => {
                    handleFinishOrResetDraft();
                    if (activeTool === 'add_joint' && jointDrawMode === 'freehand') {
                      setActiveTool('select');
                    } else {
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
                  title="Freehand Stylus Pencil"
                >
                  <PenTool className="w-3.5 h-3.5 text-sky-500" />
                  Freehand
                </button>

                <button
                  onClick={() => {
                    setShowSetTableDrawer(true);
                    setGeologyDrawerTab('joint_sets');
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-md shadow-2xs cursor-pointer"
                  title="Discontinuity Sets Manager"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Joint Sets ({jointSets.length})
                </button>
              </div>
            )}

            {/* STEP 3: GEOLOGY & ROCK */}
            {cadRibbonTab === 'GEOLOGY_3D' && (
              <div className="flex items-center gap-1 shrink-0 flex-nowrap">
                <button
                  onClick={() => {
                    setActiveTool(activeTool === 'lithology' ? 'select' : 'lithology');
                    setShowCadPropertiesAlways(true);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-md border cursor-pointer ${
                    activeTool === 'lithology'
                      ? 'bg-amber-600 text-white border-amber-500'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-amber-600" />
                  Lithology Zones ({lithologyRegions.length})
                </button>

                <button
                  onClick={() => {
                    setActiveTool(activeTool === 'geological_symbol' ? 'select' : 'geological_symbol');
                    setShowCadPropertiesAlways(true);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-md border cursor-pointer ${
                    activeTool === 'geological_symbol'
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-purple-600" />
                  Symbols ({placedSymbols.length})
                </button>

                <button
                  onClick={() => setShow3DPhotoTunnelModal(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md shadow-2xs cursor-pointer"
                >
                  <Box className="w-3.5 h-3.5" />
                  3D Tunnel View
                </button>
              </div>
            )}

            {/* STEP 5: SURVEY & OVERBREAK */}
            {cadRibbonTab === 'SURVEY_OVERBREAK' && (
              <div className="flex items-center gap-1 shrink-0 flex-nowrap">
                <button
                  onClick={() => setActiveTool(activeTool === 'control_point' ? 'select' : 'control_point')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold rounded-md border cursor-pointer ${
                    activeTool === 'control_point'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                  }`}
                >
                  <Ruler className="w-3.5 h-3.5 text-emerald-600" />
                  Control Points ({controlPoints.length})
                </button>

                <button
                  onClick={() => setActiveTool(activeTool === 'overbreak' ? 'select' : 'overbreak')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold rounded-md border cursor-pointer ${
                    activeTool === 'overbreak'
                      ? 'bg-amber-600 text-white border-amber-500'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-600" />
                  Overbreak Profile
                </button>
              </div>
            )}

            {/* STEP 6: DATA SHEETS & EXPORT */}
            {cadRibbonTab === 'CLASSIFICATION_SHEET' && (
              <div className="flex items-center gap-1 shrink-0 flex-nowrap">
                <button
                  type="button"
                  onClick={() => onOpenExportSheet('FINAL_ENGINEERING_SHEET')}
                  className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-md shadow-2xs cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Engineering Report Sheet
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
                >
                  <Download className="w-3.5 h-3.5" />
                  Export PDF
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
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Word (.doc)
                </button>
              </div>
            )}
          </div>

          {/* NEXT STEP BUTTON & COMPLEXITY MODE */}
          <div className="flex items-center gap-1.5 shrink-0">
            {cadRibbonTab !== 'CLASSIFICATION_SHEET' && (
              <button
                type="button"
                onClick={() => {
                  const order: CadRibbonTab[] = [
                    'TUNNEL_PHOTO',
                    'HOME',
                    'GEOLOGY_3D',
                    'ADVANCED_ANALYSIS',
                    'SURVEY_OVERBREAK',
                    'CLASSIFICATION_SHEET',
                  ];
                  const idx = order.indexOf(cadRibbonTab);
                  if (idx >= 0 && idx < order.length - 1) {
                    setCadRibbonTab(order[idx + 1]);
                    setCadRibbonCollapsed(false);
                  }
                }}
                className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[11px] font-bold shadow-2xs cursor-pointer whitespace-nowrap"
              >
                {cadRibbonTab === 'TUNNEL_PHOTO'
                  ? 'Next: 2. Core Mapping →'
                  : cadRibbonTab === 'HOME'
                  ? 'Next: 3. Geology →'
                  : cadRibbonTab === 'GEOLOGY_3D'
                  ? 'Next: 4. Advance Modeling →'
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
              >
                Advanced
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
});

CadRibbonAndCommandBar.displayName = 'CadRibbonAndCommandBar';
