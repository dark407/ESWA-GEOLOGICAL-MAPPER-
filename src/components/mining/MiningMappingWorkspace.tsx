// ============================================================================
// ESWA UNDERGROUND MINING & GRADE CONTROL FACE MAPPING WORKSPACE
// ============================================================================
// Strictly Face ONLY (no crown, no sidewalls, no joint set grouping, no strip log).
// Complete workflow:
// - Custom stope profiles (D-arch, horseshoe, flat, shanty, gothic, DXF)
// - Vein contacts & grade categorization (High grade, Med grade, Low grade, Waste)
// - Interactive channel sampling with true thickness & mass-weighted composites
// - Structural discontinuities & lower-hemisphere Schmidt stereonet
// - Laubscher MRMR & Mathews-Potvin Stope Stability graph (N vs HR)
// - Surpac/Deswik 3D DXF, PDF Face Sheet & CSV channel assays export
// ============================================================================

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Pickaxe,
  ArrowLeft,
  Database,
  Layers,
  Shield,
  Activity,
  Download,
  Printer,
  FileSpreadsheet,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sliders,
  Sparkles,
  Compass,
  Maximize2,
  Eye,
  EyeOff,
  Edit3,
  DollarSign,
  Truck,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize,
  Move,
  Upload,
  Image as ImageIcon,
  Save,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Grid,
  Undo,
  Redo,
  FileCode,
  FileDown,
  Scissors,
  Ruler,
  PenTool,
  Settings,
  Scale,
} from 'lucide-react';
import { EswaAppBackgroundWatermark, EswaTunnelLogo } from '../EswaBrandIdentity';
import { IndustryMode, FaceChannelSampleRecord } from '../../types/tunnel';
import {
  MiningStopeItem,
  MiningProjectItem,
  MiningGeologicalFeature,
  MiningGeologicalFeatureType,
  MiningGeologicalPoint,
  MiningPhotoCalibration,
  MiningStopeShape,
} from '../../types/mining';
import {
  loadMiningStopes,
  saveMiningStopes,
  getActiveMiningStopeId,
  setActiveMiningStopeId,
  updateMiningStope,
  loadMiningProjects,
  getActiveMiningProjectId,
} from '../../engine/miningStorageEngine';
import {
  generateMiningStopePolygon,
  calculateCompositeFaceAssays,
  calculateLaubscherMrmr,
  evaluateMathewsStability,
  generateMineDesignDxf,
  generateChannelAssayCsv,
} from '../../engine/miningFaceEngine';
import { MiningFaceSetupWizard } from './MiningFaceSetupWizard';
import { MiningDataStorageModal } from './MiningDataStorageModal';

export interface MiningMappingWorkspaceProps {
  onBackToMainWindow: () => void;
  onChangeIndustryMode: (mode: IndustryMode) => void;
}

export type RightPanelTab = 'GRADES' | 'CHANNELS' | 'STRUCTURE' | 'GEOTECH' | 'EXPORTS';

export const MiningMappingWorkspace: React.FC<MiningMappingWorkspaceProps> = ({
  onBackToMainWindow,
  onChangeIndustryMode,
}) => {
  // Modal states
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Stopes & Projects from Storage
  const stopes = useMemo(() => loadMiningStopes(), [isStorageModalOpen, isSetupWizardOpen]);
  const activeStopeId = getActiveMiningStopeId() || stopes[0]?.id;
  const currentStope = useMemo(
    () => stopes.find((s) => s.id === activeStopeId) || stopes[0],
    [stopes, activeStopeId]
  );

  const projects = useMemo(() => loadMiningProjects(), [isStorageModalOpen, isSetupWizardOpen]);
  const activeProjectId = getActiveMiningProjectId() || projects[0]?.id;
  const currentProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || projects[0],
    [projects, activeProjectId]
  );

  // Stope Parameters
  const [mineLevel, setMineLevel] = useState<string>(currentStope?.mineLevel || 'Level 620 mRL');
  const [driftId, setDriftId] = useState<string>(currentStope?.stopeOrDriftId || 'HW-DRV-04');
  const [oreBodyName, setOreBodyName] = useState<string>(currentStope?.oreBodyName || 'Champion Lode');
  const [cutoffGrade, setCutoffGrade] = useState<number>(currentStope?.targetCutoffGrade ?? 2.50);
  const [blastPull, setBlastPull] = useState<number>(currentStope?.blastPullMeters ?? 3.2);
  const [stopeWidth, setStopeWidth] = useState<number>(currentStope?.stopeWidthM ?? 4.8);
  const [stopeHeight, setStopeHeight] = useState<number>(currentStope?.stopeHeightM ?? 4.2);
  const [stopeShape, setStopeShape] = useState<MiningStopeShape>(currentStope?.stopeShape || 'd_arch');
  const [wallHeight, setWallHeight] = useState<number>(currentStope?.wallHeightM ?? 2.8);
  const [headingAzimuth, setHeadingAzimuth] = useState<number>(currentStope?.headingDriveAzimuthDeg ?? 45);
  const [chainage, setChainage] = useState<string>(currentStope?.currentHeadingRdChainage || 'CH 125.4m');

  const [oreSg, setOreSg] = useState<number>(currentStope?.oreSpecificGravity ?? 3.35);
  const [wasteSg, setWasteSg] = useState<number>(currentStope?.wasteSpecificGravity ?? 2.72);

  // Economic Parameters
  const [metalPriceAuOz, setMetalPriceAuOz] = useState<number>(2650);
  const [miningCostPerTonne, setMiningCostPerTonne] = useState<number>(68);
  const [millingCostPerTonne, setMillingCostPerTonne] = useState<number>(34);

  // Panels
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState<boolean>(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(true);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('GRADES');

  // Tools: SELECT, PAN, ORE_BOUNDARY, FAULT, JOINT, CHANNEL_CUT, ERASE
  const [activeTool, setActiveTool] = useState<
    MiningGeologicalFeatureType | 'SELECT' | 'PAN' | 'CHANNEL_CUT' | 'ERASE'
  >('SELECT');
  const [activeGeometryMode, setActiveGeometryMode] = useState<'POLYLINE' | 'POLYGON'>('POLYGON');
  const [selectedOreCategory, setSelectedOreCategory] = useState<
    'HIGH_GRADE' | 'MEDIUM_GRADE' | 'LOW_GRADE' | 'INTERNAL_WASTE'
  >('HIGH_GRADE');

  // Vector Features & Channel Samples
  const [features, setFeatures] = useState<MiningGeologicalFeature[]>(currentStope?.features || []);
  const [channelSamples, setChannelSamples] = useState<FaceChannelSampleRecord[]>(
    currentStope?.channelSamples || []
  );
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);

  // Undo / Redo Stacks
  const [undoStack, setUndoStack] = useState<
    { features: MiningGeologicalFeature[]; samples: FaceChannelSampleRecord[] }[]
  >([]);
  const [redoStack, setRedoStack] = useState<
    { features: MiningGeologicalFeature[]; samples: FaceChannelSampleRecord[] }[]
  >([]);

  const pushUndo = (
    nextFeatures = features,
    nextSamples = channelSamples
  ) => {
    setUndoStack((prev) => [...prev.slice(-30), { features, samples: channelSamples }]);
    setRedoStack([]);
    setFeatures(nextFeatures);
    setChannelSamples(nextSamples);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, { features, samples: channelSamples }]);
    setUndoStack((u) => u.slice(0, -1));
    setFeatures(prev.features);
    setChannelSamples(prev.samples);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, { features, samples: channelSamples }]);
    setRedoStack((r) => r.slice(0, -1));
    setFeatures(next.features);
    setChannelSamples(next.samples);
  };

  // Re-sync all state when active stope changes
  useEffect(() => {
    if (currentStope) {
      setMineLevel(currentStope.mineLevel || 'Level 620 mRL');
      setDriftId(currentStope.stopeOrDriftId || 'HW-DRV-04');
      setOreBodyName(currentStope.oreBodyName || 'Champion Lode');
      setCutoffGrade(currentStope.targetCutoffGrade ?? 2.50);
      setBlastPull(currentStope.blastPullMeters ?? 3.2);
      setStopeWidth(currentStope.stopeWidthM ?? 4.8);
      setStopeHeight(currentStope.stopeHeightM ?? 4.2);
      setStopeShape(currentStope.stopeShape || 'd_arch');
      setWallHeight(currentStope.wallHeightM ?? 2.8);
      setHeadingAzimuth(currentStope.headingDriveAzimuthDeg ?? 45);
      setChainage(currentStope.currentHeadingRdChainage || 'CH 125.4m');
      setOreSg(currentStope.oreSpecificGravity ?? 3.35);
      setWasteSg(currentStope.wasteSpecificGravity ?? 2.72);
      setFeatures(currentStope.features || []);
      setChannelSamples(currentStope.channelSamples || []);
      setPhotoCalibration((prev) => ({
        ...prev,
        imageUrl: currentStope.facePhotoUrl || prev.imageUrl,
        isCalibrated: Boolean(currentStope.facePhotoUrl),
      }));
      setUndoStack([]);
      setRedoStack([]);
    }
  }, [currentStope?.id]);

  // Photo Calibration
  const [photoCalibration, setPhotoCalibration] = useState<MiningPhotoCalibration>({
    imageUrl: currentStope?.facePhotoUrl || '',
    scalePixelsPerMeter: 80,
    originX: 0,
    originY: 0,
    opacity: 0.7,
    rotationDeg: 0,
    widthM: 4.8,
    heightM: 4.2,
    isCalibrated: false,
  });

  // Canvas Viewport & Navigation
  const [zoom, setZoom] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentDraftPoints, setCurrentDraftPoints] = useState<MiningGeologicalPoint[]>([]);

  // Overlays
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showPhoto, setShowPhoto] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVED'>('IDLE');

  // Geotechnical Parameters (Laubscher MRMR & Mathews Potvin)
  const [mrmrBaseRmr, setMrmrBaseRmr] = useState<number>(68);
  const [mrmrWeatheringPct, setMrmrWeatheringPct] = useState<number>(95);
  const [mrmrStressPct, setMrmrStressPct] = useState<number>(85);
  const [mrmrOrientationPct, setMrmrOrientationPct] = useState<number>(80);
  const [mrmrBlastingPct, setMrmrBlastingPct] = useState<number>(90);

  const [miningRqd, setMiningRqd] = useState<number>(85);
  const [miningJn, setMiningJn] = useState<number>(6);
  const [miningJr, setMiningJr] = useState<number>(1.5);
  const [miningJa, setMiningJa] = useState<number>(1.0);
  const [stressFactorA, setStressFactorA] = useState<number>(0.85);
  const [jointFactorB, setJointFactorB] = useState<number>(0.50);
  const [gravityFactorC, setGravityFactorC] = useState<number>(4.0);

  // Stope Closed Face Polygon & Metrics
  const profileMetrics = useMemo(() => {
    return generateMiningStopePolygon(
      stopeShape,
      stopeWidth,
      stopeHeight,
      wallHeight,
      stopeWidth / 2,
      stopeShape === 'dxf_import' ? currentStope?.customProfilePoints : undefined
    );
  }, [stopeShape, stopeWidth, stopeHeight, wallHeight, currentStope?.customProfilePoints]);

  // Channel Sample Composites & Grade Dilution
  const composites = useMemo(() => {
    return calculateCompositeFaceAssays(
      channelSamples,
      profileMetrics.areaM2,
      blastPull,
      oreSg,
      wasteSg,
      cutoffGrade
    );
  }, [channelSamples, profileMetrics.areaM2, blastPull, oreSg, wasteSg, cutoffGrade]);

  // Laubscher MRMR Design Calculations
  const mrmrResult = useMemo(() => {
    return calculateLaubscherMrmr(
      mrmrBaseRmr,
      mrmrWeatheringPct,
      mrmrStressPct,
      mrmrOrientationPct,
      mrmrBlastingPct
    );
  }, [mrmrBaseRmr, mrmrWeatheringPct, mrmrStressPct, mrmrOrientationPct, mrmrBlastingPct]);

  // Mathews Potvin Stability Calculations
  const mathewsResult = useMemo(() => {
    return evaluateMathewsStability(
      miningRqd,
      miningJn,
      miningJr,
      miningJa,
      stressFactorA,
      jointFactorB,
      gravityFactorC,
      profileMetrics.hydraulicRadiusM
    );
  }, [
    miningRqd,
    miningJn,
    miningJr,
    miningJa,
    stressFactorA,
    jointFactorB,
    gravityFactorC,
    profileMetrics.hydraulicRadiusM,
  ]);

  // Save Stope Data
  const handleSaveStopeData = () => {
    if (!currentStope) return;
    updateMiningStope(currentStope.id, {
      mineLevel,
      stopeOrDriftId: driftId,
      oreBodyName,
      targetCutoffGrade: cutoffGrade,
      blastPullMeters: blastPull,
      stopeWidthM: stopeWidth,
      stopeHeightM: stopeHeight,
      stopeShape,
      wallHeightM: wallHeight,
      headingDriveAzimuthDeg: headingAzimuth,
      currentHeadingRdChainage: chainage,
      oreSpecificGravity: oreSg,
      wasteSpecificGravity: wasteSg,
      channelSamples,
      features,
      dilutedGradeCalculated: composites.weightedGrade,
      dilutionPercentCalculated: composites.dilutionPercentByMass,
      muckDestinationVerdict: composites.verdict,
      facePhotoUrl: photoCalibration.imageUrl || undefined,
      updatedAt: new Date().toISOString(),
    });
    setSaveStatus('SAVED');
    setTimeout(() => setSaveStatus('IDLE'), 2500);
  };

  // Canvas Coordinate Helpers: Face Only
  const canvasWidth = 720;
  const canvasHeight = 520;
  const pad = 60;
  const scaleX = (canvasWidth - pad * 2) / Math.max(1, stopeWidth);
  const scaleY = (canvasHeight - pad * 2) / Math.max(1, stopeHeight);

  const meterToCanvas = (mX: number, mY: number) => {
    const px = pad + mX * scaleX;
    const py = canvasHeight - pad - mY * scaleY;
    return { px, py };
  };

  const canvasToMeter = (px: number, py: number) => {
    const mx = Math.max(0, Math.min(stopeWidth, (px - pad) / scaleX));
    const my = Math.max(0, Math.min(stopeHeight, (canvasHeight - pad - py) / scaleY));
    return { mx: Number(mx.toFixed(2)), my: Number(my.toFixed(2)) };
  };

  // Accurate SVG Coordinate Transformation via Matrix Inversion
  const getSvgPoint = (e: React.MouseEvent<SVGSVGElement>): { mx: number; my: number; px: number; py: number } => {
    const svg = e.currentTarget;
    let px = 0;
    let py = 0;
    try {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const transformed = pt.matrixTransform(ctm.inverse());
        px = transformed.x;
        py = transformed.y;
      } else {
        const rect = svg.getBoundingClientRect();
        px = ((e.clientX - rect.left) / rect.width) * canvasWidth;
        py = ((e.clientY - rect.top) / rect.height) * canvasHeight;
      }
    } catch {
      const rect = svg.getBoundingClientRect();
      px = ((e.clientX - rect.left) / rect.width) * canvasWidth;
      py = ((e.clientY - rect.top) / rect.height) * canvasHeight;
    }
    const { mx, my } = canvasToMeter(px, py);
    return { mx, my, px, py };
  };

  // Complete Feature Action
  const handleCompleteCurrentFeature = (pointsToCommit?: MiningGeologicalPoint[]) => {
    const pts = pointsToCommit || currentDraftPoints;
    if (pts.length < 2) return;
    if (activeGeometryMode === 'POLYGON' && pts.length < 3) return;

    let color = '#38BDF8';
    if (activeTool === 'ORE_BOUNDARY') {
      color =
        selectedOreCategory === 'HIGH_GRADE'
          ? '#EF4444'
          : selectedOreCategory === 'MEDIUM_GRADE'
          ? '#F59E0B'
          : selectedOreCategory === 'LOW_GRADE'
          ? '#EAB308'
          : '#64748B';
    } else if (activeTool === 'FAULT') {
      color = '#DC2626';
    } else if (activeTool === 'JOINT') {
      color = '#A855F7';
    }

    const newFeat: MiningGeologicalFeature = {
      id: `FT-${Date.now().toString(36).toUpperCase()}`,
      surfaceType: 'DEVELOPMENT_FACE',
      featureType:
        activeTool === 'SELECT' || activeTool === 'PAN' || activeTool === 'ERASE' || activeTool === 'CHANNEL_CUT'
          ? 'ORE_BOUNDARY'
          : activeTool,
      geometryType: activeGeometryMode,
      points: pts,
      name:
        activeTool === 'ORE_BOUNDARY'
          ? `${selectedOreCategory.replace('_', ' ')} Lode`
          : `${activeTool} Structure`,
      colorHex: color,
      strokeWidth: 2.5,
      fillOpacity: 0.35,
      dipDeg: 75,
      dipDirectionDeg: (headingAzimuth + 90) % 360,
      visible: true,
    };
    pushUndo([...features, newFeat], channelSamples);
    setCurrentDraftPoints([]);
    setIsDrawing(false);
    setSelectedFeatureId(newFeat.id);
  };

  const handleCancelDrawing = () => {
    setCurrentDraftPoints([]);
    setIsDrawing(false);
  };

  // Global Keyboard Shortcuts for Drawing (Enter to Finish, Esc to Cancel, Backspace to Undo Point)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (isDrawing && currentDraftPoints.length >= (activeGeometryMode === 'POLYGON' ? 3 : 2)) {
          e.preventDefault();
          handleCompleteCurrentFeature();
        }
      } else if (e.key === 'Escape') {
        if (isDrawing) {
          e.preventDefault();
          handleCancelDrawing();
        }
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && isDrawing) {
        e.preventDefault();
        setCurrentDraftPoints((prev) => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing, currentDraftPoints, activeGeometryMode, activeTool, selectedOreCategory, headingAzimuth]);

  // Canvas Mouse Events
  const handleCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const { mx, my, px, py } = getSvgPoint(e);

    if (activeTool === 'PAN') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    if (activeTool === 'CHANNEL_CUT') {
      // Add a 1.0m channel cut centered at clicked X along the face
      const fromM = Math.max(0, Number((mx - 0.5).toFixed(2)));
      const toM = Math.min(stopeWidth, Number((mx + 0.5).toFixed(2)));
      const sampleNum = `CS-${String(channelSamples.length + 1).padStart(2, '0')}`;
      const newSample: FaceChannelSampleRecord = {
        id: `CS-${Date.now().toString(36).toUpperCase()}`,
        sampleNumber: sampleNum,
        fromMeter: fromM,
        toMeter: toM,
        sampleLengthMeters: Number((toM - fromM).toFixed(2)),
        trueThicknessMeters: Number((toM - fromM).toFixed(2)),
        assayGrade: 4.85,
        gradeValue: '4.85',
        sampledBy: 'Mine Geologist',
        date: new Date().toISOString().split('T')[0],
        specificGravity: oreSg,
        zoneCategory: 'ORE',
        lithologyOrVein: 'Quartz Vein + Sulfides',
        notes: 'Mapped channel cut across face',
      };
      pushUndo(features, [...channelSamples, newSample]);
      setSelectedSampleId(newSample.id);
      setRightPanelTab('CHANNELS');
      return;
    }

    if (activeTool === 'ERASE') {
      // Handled in individual element click
      return;
    }

    if (activeTool !== 'SELECT') {
      // If clicking near point 0 for polygon (within 18 canvas px), close and complete polygon!
      if (activeGeometryMode === 'POLYGON' && currentDraftPoints.length >= 3) {
        const p0 = currentDraftPoints[0];
        const p0Canvas = meterToCanvas(p0.x, p0.y);
        const distPx = Math.hypot(px - p0Canvas.px, py - p0Canvas.py);
        if (distPx < 20) {
          handleCompleteCurrentFeature();
          return;
        }
      }

      setIsDrawing(true);
      setCurrentDraftPoints((prev) => [...prev, { x: mx, y: my }]);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const { mx, my } = getSvgPoint(e);
    setCursorPos({ x: mx, y: my });

    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
  };

  // Clear Canvas to empty state
  const handleClearFaceCanvas = () => {
    pushUndo([], []);
    setFeatures([]);
    setChannelSamples([]);
    setSelectedFeatureId(null);
    setSelectedSampleId(null);
  };

  // Export actions
  const handleExportDxf = () => {
    const dxfString = generateMineDesignDxf(
      currentStope,
      profileMetrics.points,
      features,
      channelSamples
    );
    const blob = new Blob([dxfString], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${driftId}_Face_CH_${chainage.replace(/[^a-zA-Z0-9]/g, '_')}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const csvString = generateChannelAssayCsv(currentStope, channelSamples, composites);
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${driftId}_Channel_Assays_${chainage.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-dvh h-dvh w-full flex flex-col bg-slate-950 text-slate-100 font-mono select-none overflow-hidden relative">
      <EswaAppBackgroundWatermark visible showLogoWatermark={false} />

      {/* TOP HEADER BAR */}
      <header className="flex-none h-13 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToMainWindow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-400 border border-slate-700 transition-all cursor-pointer"
            title="Return to Mining Main Window"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Main Window</span>
          </button>

          <div className="h-4 w-px bg-slate-700 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <Pickaxe className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-amber-400 flex items-center gap-2">
                <span>{driftId}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                  {chainage}
                </span>
                <span className="text-slate-400 font-normal hidden md:inline">
                  · {mineLevel} · {oreBodyName}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-normal hidden sm:block">
                ESWA Underground Face Mapping (Face Only · Single-Panel Calibrated Workspace)
              </div>
            </div>
          </div>
        </div>

        {/* Center Muck Verdict Banner */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
          <Truck className="w-4 h-4 text-amber-400" />
          <span className="text-slate-400">Verdict:</span>
          <span
            className={`font-black px-2 py-0.5 rounded text-[11px] ${
              composites.verdict === 'MILL'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : composites.verdict === 'LOW_GRADE_STOCKPILE'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            }`}
          >
            {composites.verdict === 'MILL'
              ? 'ROUTE TO MILL'
              : composites.verdict === 'LOW_GRADE_STOCKPILE'
              ? 'LOW-GRADE STOCKPILE'
              : 'WASTE DUMP'}
          </span>
          <span className="text-slate-400 text-[10px]">
            ({composites.weightedGrade} g/t · {composites.dilutionPercentByMass}% Dil.)
          </span>
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center gap-2">
          {/* Stope Setup Wizard Button */}
          <button
            type="button"
            onClick={() => setIsSetupWizardOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 cursor-pointer"
            title="Edit Stope Geometry & Custom Face Profile"
          >
            <Settings className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Face Setup</span>
          </button>

          {/* Mining Vault Modal */}
          <button
            type="button"
            onClick={() => setIsStorageModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-cyan-300 border border-slate-700 cursor-pointer"
            title="Open Mining Data & Storage Vault"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vault</span>
          </button>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSaveStopeData}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              saveStatus === 'SAVED'
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md'
            }`}
          >
            {saveStatus === 'SAVED' ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saveStatus === 'SAVED' ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </header>

      {/* MAIN WORKSPACE BODY */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT TOOLBAR & DRAWING PENCILS */}
        <aside
          className={`flex-none bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-200 z-20 ${
            isLeftPanelOpen ? 'w-64' : 'w-12'
          }`}
        >
          {/* Panel Toggle Header */}
          <div className="p-2 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-amber-400">
            {isLeftPanelOpen ? (
              <>
                <span className="flex items-center gap-1.5">
                  <PenTool className="w-4 h-4" />
                  <span>Face Mapping Tools</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsLeftPanelOpen(false)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsLeftPanelOpen(true)}
                className="w-full py-1 flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <PanelLeftOpen className="w-4 h-4 text-amber-400" />
              </button>
            )}
          </div>

          {/* Left Panel Body */}
          {isLeftPanelOpen ? (
            <div className="flex-1 overflow-y-auto p-3 space-y-4 font-mono text-xs">
              {/* Primary Tools */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Interactive Tools
                </span>
                {[
                  { id: 'SELECT' as const, label: 'Select & Inspect', icon: Eye, color: 'text-slate-200' },
                  { id: 'PAN' as const, label: 'Pan Canvas', icon: Move, color: 'text-slate-200' },
                  { id: 'ORE_BOUNDARY' as const, label: 'Ore Vein / Lode', icon: Sparkles, color: 'text-amber-400' },
                  { id: 'CHANNEL_CUT' as const, label: 'Channel Sample Cut', icon: Scissors, color: 'text-emerald-400' },
                  { id: 'FAULT' as const, label: 'Fault / Shear Zone', icon: AlertTriangle, color: 'text-rose-400' },
                  { id: 'JOINT' as const, label: 'Structural Joint', icon: Compass, color: 'text-purple-400' },
                  { id: 'ERASE' as const, label: 'Eraser Tool', icon: Trash2, color: 'text-rose-400' },
                ].map((t) => {
                  const isAct = activeTool === t.id;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTool(t.id)}
                      className={`w-full py-2 px-2.5 rounded-xl flex items-center gap-2 text-left font-bold transition-all cursor-pointer ${
                        isAct
                          ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800/80'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isAct ? 'text-slate-950' : t.color}`} />
                      <span className="truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* If ORE_BOUNDARY tool is active: Grade Category Selection */}
              {activeTool === 'ORE_BOUNDARY' && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 space-y-2">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                    Mineralization Category:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'HIGH_GRADE' as const, label: 'High Grade', color: 'bg-rose-500' },
                      { id: 'MEDIUM_GRADE' as const, label: 'Med Grade', color: 'bg-amber-500' },
                      { id: 'LOW_GRADE' as const, label: 'Low Grade', color: 'bg-yellow-500' },
                      { id: 'INTERNAL_WASTE' as const, label: 'Waste Dyke', color: 'bg-slate-600' },
                    ].map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedOreCategory(c.id)}
                        className={`py-1 px-1.5 rounded text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          selectedOreCategory === c.id
                            ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${c.color}`} />
                        <span className="truncate">{c.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="pt-1.5 border-t border-slate-800 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveGeometryMode('POLYGON')}
                      className={`flex-1 py-1 rounded text-[10px] font-bold ${
                        activeGeometryMode === 'POLYGON'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      Polygon
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveGeometryMode('POLYLINE')}
                      className={`flex-1 py-1 rounded text-[10px] font-bold ${
                        activeGeometryMode === 'POLYLINE'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      Polyline
                    </button>
                  </div>
                </div>
              )}

              {/* Photo Calibrator Overlay Controls */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-between">
                  <span>Face Photograph</span>
                  <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                </span>

                <label className="w-full py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500 text-cyan-300 font-bold flex items-center justify-center gap-1.5 cursor-pointer text-[11px] transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import Ortho Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          if (event.target?.result) {
                            setPhotoCalibration((prev) => ({
                              ...prev,
                              imageUrl: String(event.target?.result),
                              isCalibrated: true,
                            }));
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>

                {photoCalibration.imageUrl && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Photo Opacity:</span>
                      <strong className="text-slate-200">
                        {Math.round(photoCalibration.opacity * 100)}%
                      </strong>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={photoCalibration.opacity * 100}
                      onChange={(e) =>
                        setPhotoCalibration((p) => ({
                          ...p,
                          opacity: Number(e.target.value) / 100,
                        }))
                      }
                      className="w-full accent-cyan-400"
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-3 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsLeftPanelOpen(true);
                  setActiveTool('SELECT');
                }}
                className={`p-2 rounded-lg cursor-pointer ${
                  activeTool === 'SELECT' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
                title="Select"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLeftPanelOpen(true);
                  setActiveTool('ORE_BOUNDARY');
                }}
                className={`p-2 rounded-lg cursor-pointer ${
                  activeTool === 'ORE_BOUNDARY' ? 'bg-amber-500 text-slate-950' : 'text-amber-400 hover:text-white'
                }`}
                title="Ore Vein"
              >
                <Sparkles className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLeftPanelOpen(true);
                  setActiveTool('CHANNEL_CUT');
                }}
                className={`p-2 rounded-lg cursor-pointer ${
                  activeTool === 'CHANNEL_CUT' ? 'bg-emerald-500 text-slate-950' : 'text-emerald-400 hover:text-white'
                }`}
                title="Channel Cut"
              >
                <Scissors className="w-4 h-4" />
              </button>
            </div>
          )}
        </aside>

        {/* CENTER PRIMARY FACE CANVAS */}
        <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
          {/* Top Control Bar for Viewport */}
          <div className="flex-none px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-3 text-slate-300">
              <span className="flex items-center gap-1.5 font-bold text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Single Face Only (Stope Profile: {stopeShape.replace('_', ' ').toUpperCase()})</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">
                Metric Span: <strong className="text-slate-200">{stopeWidth}m W × {stopeHeight}m H</strong> (Area: {profileMetrics.areaM2} m²)
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-cyan-400">
                Pointer: X {cursorPos.x.toFixed(2)}m, Y {cursorPos.y.toFixed(2)}m
              </span>
            </div>

            {/* Canvas Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearFaceCanvas}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 font-bold text-[11px] cursor-pointer transition-all"
                title="Wipe canvas clean (Start Empty)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Canvas</span>
              </button>
              <div className="h-4 w-px bg-slate-700" />
              <button
                type="button"
                disabled={undoStack.length === 0}
                onClick={handleUndo}
                className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Undo (Ctrl+Z)"
              >
                <Undo className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={redoStack.length === 0}
                onClick={handleRedo}
                className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Redo"
              >
                <Redo className="w-4 h-4" />
              </button>
              <div className="h-4 w-px bg-slate-700" />
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1.0);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                title="Reset View"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowGrid(!showGrid)}
                className={`p-1 rounded cursor-pointer ${showGrid ? 'text-amber-400 bg-slate-800' : 'text-slate-500'}`}
                title="Toggle Metric Grid"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive SVG Canvas */}
          <div className="flex-1 relative overflow-hidden bg-slate-950 flex items-center justify-center p-2">
            {/* Floating Drafting Banner when Drawing */}
            {isDrawing && currentDraftPoints.length > 0 && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-slate-900/95 border-2 border-amber-500 shadow-2xl flex items-center gap-3 backdrop-blur-md font-mono text-xs animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-slate-200 font-bold">
                    Drafting {activeTool.replace('_', ' ')}:
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-black border border-amber-500/40">
                    {currentDraftPoints.length} {currentDraftPoints.length === 1 ? 'vertex' : 'vertices'}
                  </span>
                </div>

                <div className="h-4 w-px bg-slate-700" />

                <button
                  type="button"
                  onClick={() => handleCompleteCurrentFeature()}
                  disabled={activeGeometryMode === 'POLYGON' ? currentDraftPoints.length < 3 : currentDraftPoints.length < 2}
                  className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black flex items-center gap-1 cursor-pointer transition-all shadow"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Finish Feature (Enter / Double-Click)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentDraftPoints((prev) => prev.slice(0, -1))}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center gap-1 cursor-pointer"
                  title="Undo last point (Backspace)"
                >
                  <Undo className="w-3.5 h-3.5" />
                  <span>Undo Pt</span>
                </button>

                <button
                  type="button"
                  onClick={handleCancelDrawing}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 font-bold cursor-pointer"
                >
                  Cancel (Esc)
                </button>
              </div>
            )}

            <svg
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              className="w-full h-full max-w-[1280px] max-h-[760px] rounded-xl bg-slate-900/90 shadow-2xl border border-slate-800 cursor-crosshair select-none"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleCompleteCurrentFeature();
              }}
              style={{
                transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                transformOrigin: 'center center',
              }}
            >
              <defs>
                <pattern id="wasteRockPattern" width="16" height="16" patternUnits="userSpaceOnUse">
                  <path d="M 0,16 l 16,-16 M 0,0 l 16,16" stroke="#1E293B" strokeWidth="0.8" />
                </pattern>
                <pattern id="oreVeinPattern" width="12" height="12" patternUnits="userSpaceOnUse">
                  <circle cx="6" cy="6" r="1.5" fill="#F59E0B" opacity="0.6" />
                </pattern>

                {/* Stope Face Custom Profile Clipping Path */}
                <clipPath id="stopeProfileClip">
                  <polygon
                    points={profileMetrics.points
                      .map((p) => {
                        const { px, py } = meterToCanvas(p.x, p.y);
                        return `${px},${py}`;
                      })
                      .join(' ')}
                  />
                </clipPath>
              </defs>

              {/* Outside Country Rock */}
              <rect x="0" y="0" width={canvasWidth} height={canvasHeight} fill="#050811" />

              {/* Metric Grid */}
              {showGrid && (
                <g opacity="0.15">
                  {Array.from({ length: Math.ceil(stopeWidth) + 1 }).map((_, i) => {
                    const pBottom = meterToCanvas(i, 0);
                    const pTop = meterToCanvas(i, stopeHeight);
                    return (
                      <line
                        key={`gx-${i}`}
                        x1={pBottom.px}
                        y1={pTop.py}
                        x2={pBottom.px}
                        y2={pBottom.py}
                        stroke="#94A3B8"
                        strokeDasharray="3 3"
                      />
                    );
                  })}
                  {Array.from({ length: Math.ceil(stopeHeight) + 1 }).map((_, i) => {
                    const pLeft = meterToCanvas(0, i);
                    const pRight = meterToCanvas(stopeWidth, i);
                    return (
                      <line
                        key={`gy-${i}`}
                        x1={pLeft.px}
                        y1={pLeft.py}
                        x2={pRight.px}
                        y2={pRight.py}
                        stroke="#94A3B8"
                        strokeDasharray="3 3"
                      />
                    );
                  })}
                </g>
              )}

              {/* Face Inside Mapped Boundary (Clipped to Stope Shape) */}
              <g clipPath="url(#stopeProfileClip)">
                {/* Background Waste Rock */}
                <rect x="0" y="0" width={canvasWidth} height={canvasHeight} fill="#0F172A" />
                <rect x="0" y="0" width={canvasWidth} height={canvasHeight} fill="url(#wasteRockPattern)" />

                {/* Calibrated Orthophoto (if loaded) */}
                {photoCalibration.imageUrl && showPhoto && (
                  <image
                    href={photoCalibration.imageUrl}
                    x={pad}
                    y={pad}
                    width={canvasWidth - pad * 2}
                    height={canvasHeight - pad * 2}
                    preserveAspectRatio="none"
                    opacity={photoCalibration.opacity}
                  />
                )}

                {/* Mapped Vector Features (Ore Veins, Faults, Contacts) */}
                {features
                  .filter((f) => f.visible)
                  .map((f) => {
                    const isSelected = selectedFeatureId === f.id;
                    if (f.geometryType === 'POLYGON' && f.points.length >= 3) {
                      const ptsString = f.points
                        .map((pt) => {
                          const { px, py } = meterToCanvas(pt.x, pt.y);
                          return `${px},${py}`;
                        })
                        .join(' ');

                      return (
                        <g
                          key={f.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeTool === 'ERASE') {
                              pushUndo(features.filter((item) => item.id !== f.id), channelSamples);
                            } else {
                              setSelectedFeatureId(f.id);
                              setSelectedSampleId(null);
                            }
                          }}
                        >
                          <polygon
                            points={ptsString}
                            fill={f.colorHex}
                            fillOpacity={f.fillOpacity || 0.4}
                            stroke={isSelected ? '#FFFFFF' : f.colorHex}
                            strokeWidth={isSelected ? 3.5 : f.strokeWidth || 2}
                            className="cursor-pointer transition-colors"
                          />
                          {f.featureType === 'ORE_BOUNDARY' && (
                            <polygon points={ptsString} fill="url(#oreVeinPattern)" />
                          )}
                        </g>
                      );
                    }

                    if (f.geometryType === 'POLYLINE' && f.points.length >= 2) {
                      const ptsString = f.points
                        .map((pt) => {
                          const { px, py } = meterToCanvas(pt.x, pt.y);
                          return `${px},${py}`;
                        })
                        .join(' ');

                      return (
                        <g
                          key={f.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeTool === 'ERASE') {
                              pushUndo(features.filter((item) => item.id !== f.id), channelSamples);
                            } else {
                              setSelectedFeatureId(f.id);
                              setSelectedSampleId(null);
                            }
                          }}
                        >
                          <polyline
                            points={ptsString}
                            fill="none"
                            stroke={isSelected ? '#FFFFFF' : f.colorHex}
                            strokeWidth={isSelected ? 4 : f.strokeWidth || 2.5}
                            strokeDasharray={f.featureType === 'FAULT' ? '6 3' : undefined}
                            className="cursor-pointer"
                          />
                        </g>
                      );
                    }
                    return null;
                  })}

                {/* Draft Line, Rubberband & Vertex Handles when Drawing */}
                {isDrawing && currentDraftPoints.length > 0 && (() => {
                  const lastPt = currentDraftPoints[currentDraftPoints.length - 1];
                  const lastCanvas = meterToCanvas(lastPt.x, lastPt.y);
                  const curCanvas = meterToCanvas(cursorPos.x, cursorPos.y);
                  const p0Canvas = meterToCanvas(currentDraftPoints[0].x, currentDraftPoints[0].y);

                  return (
                    <g className="pointer-events-none">
                      {/* Confirmed segments polyline */}
                      <polyline
                        points={currentDraftPoints
                          .map((p) => {
                            const { px, py } = meterToCanvas(p.x, p.y);
                            return `${px},${py}`;
                          })
                          .join(' ')}
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="3"
                        strokeDasharray="5 3"
                      />

                      {/* Live rubberband line from last vertex to pointer */}
                      <line
                        x1={lastCanvas.px}
                        y1={lastCanvas.py}
                        x2={curCanvas.px}
                        y2={curCanvas.py}
                        stroke="#38BDF8"
                        strokeWidth="2.5"
                        strokeDasharray="4 2"
                      />

                      {/* Dotted return preview line to first vertex (for closed polygon) */}
                      {activeGeometryMode === 'POLYGON' && currentDraftPoints.length >= 2 && (
                        <line
                          x1={curCanvas.px}
                          y1={curCanvas.py}
                          x2={p0Canvas.px}
                          y2={p0Canvas.py}
                          stroke="#94A3B8"
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                          opacity="0.6"
                        />
                      )}

                      {/* Numbered Vertex Handles */}
                      {currentDraftPoints.map((p, idx) => {
                        const { px, py } = meterToCanvas(p.x, p.y);
                        const isFirst = idx === 0;
                        return (
                          <g key={`draft-handle-${idx}`}>
                            <circle
                              cx={px}
                              cy={py}
                              r={isFirst ? 8 : 6}
                              fill={isFirst ? '#EF4444' : '#F59E0B'}
                              stroke="#FFFFFF"
                              strokeWidth="2"
                            />
                            {isFirst && activeGeometryMode === 'POLYGON' && currentDraftPoints.length >= 3 && (
                              <text
                                x={px}
                                y={py - 12}
                                fill="#FDE047"
                                fontSize="10"
                                fontWeight="bold"
                                textAnchor="middle"
                              >
                                Click here to Close
                              </text>
                            )}
                            <text
                              x={px}
                              y={py + 3.5}
                              fill="#020617"
                              fontSize="8"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              {idx + 1}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  );
                })()}

                {/* Empty Canvas Guidance Callout when nothing is mapped yet */}
                {features.length === 0 && channelSamples.length === 0 && !isDrawing && (
                  <g opacity="0.45" className="pointer-events-none select-none">
                    <text
                      x={canvasWidth / 2}
                      y={canvasHeight / 2 - 10}
                      fill="#94A3B8"
                      fontSize="12"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      Empty Face Canvas (Profile: {stopeShape.replace('_', ' ').toUpperCase()})
                    </text>
                    <text
                      x={canvasWidth / 2}
                      y={canvasHeight / 2 + 12}
                      fill="#64748B"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      Choose Ore Vein / Lode, Fault, Joint, or Channel Cut on the left to begin drafting
                    </text>
                  </g>
                )}

                {/* Channel Samples Baseline & Intervals */}
                <g>
                  {/* Baseline Cut across face at 1.5m height (only if active or samples exist) */}
                  {(channelSamples.length > 0 || activeTool === 'CHANNEL_CUT') && (() => {
                    const startP = meterToCanvas(0.2, 1.5);
                    const endP = meterToCanvas(stopeWidth - 0.2, 1.5);
                    return (
                      <line
                        x1={startP.px}
                        y1={startP.py}
                        x2={endP.px}
                        y2={endP.py}
                        stroke="#CBD5E1"
                        strokeWidth="2.5"
                        strokeDasharray="4 2"
                      />
                    );
                  })()}

                  {/* Channel Sample Segments */}
                  {channelSamples.map((s) => {
                    const p1 = meterToCanvas(s.fromMeter, 1.5);
                    const p2 = meterToCanvas(s.toMeter, 1.5);
                    const midX = (p1.px + p2.px) / 2;
                    const isOre = s.zoneCategory === 'ORE';
                    const isLow = s.zoneCategory === 'LOW_GRADE';
                    const isSelected = selectedSampleId === s.id;

                    return (
                      <g
                        key={s.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeTool === 'ERASE') {
                            pushUndo(
                              features,
                              channelSamples.filter((item) => item.id !== s.id)
                            );
                          } else {
                            setSelectedSampleId(s.id);
                            setSelectedFeatureId(null);
                            setRightPanelTab('CHANNELS');
                          }
                        }}
                        className="cursor-pointer"
                      >
                        {/* Sample Line */}
                        <line
                          x1={p1.px}
                          y1={p1.py}
                          x2={p2.px}
                          y2={p2.py}
                          stroke={isSelected ? '#FFFFFF' : isOre ? '#10B981' : isLow ? '#F59E0B' : '#F43F5E'}
                          strokeWidth={isSelected ? 6 : 4}
                        />
                        <circle cx={p1.px} cy={p1.py} r="4" fill="#FFFFFF" />
                        <circle cx={p2.px} cy={p2.py} r="4" fill="#FFFFFF" />

                        {/* Sample Callout Tag */}
                        <rect
                          x={midX - 35}
                          y={p1.py - 24}
                          width="70"
                          height="18"
                          rx="4"
                          fill="#020617"
                          stroke={isSelected ? '#FFFFFF' : isOre ? '#10B981' : isLow ? '#F59E0B' : '#F43F5E'}
                          strokeWidth="1.2"
                        />
                        <text
                          x={midX}
                          y={p1.py - 12}
                          fill="#FFFFFF"
                          fontSize="8.5"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {s.sampleNumber}: {typeof s.assayGrade === 'number' ? s.assayGrade.toFixed(2) : s.gradeValue}g/t
                        </text>
                      </g>
                    );
                  })}
                </g>
              </g>

              {/* Perimeter Outline of Stope Face Profile */}
              <polygon
                points={profileMetrics.points
                  .map((p) => {
                    const { px, py } = meterToCanvas(p.x, p.y);
                    return `${px},${py}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#F59E0B"
                strokeWidth="3.5"
              />

              {/* Rulers / Dimension Lines */}
              {(() => {
                const p0 = meterToCanvas(0, 0);
                const pW = meterToCanvas(stopeWidth, 0);
                const pH = meterToCanvas(0, stopeHeight);
                return (
                  <g>
                    {/* Bottom Width Ruler */}
                    <line x1={p0.px} y1={p0.py + 15} x2={pW.px} y2={pW.py + 15} stroke="#94A3B8" strokeWidth="1" />
                    <line x1={p0.px} y1={p0.py + 10} x2={p0.px} y2={p0.py + 20} stroke="#94A3B8" strokeWidth="1" />
                    <line x1={pW.px} y1={pW.py + 10} x2={pW.px} y2={pW.py + 20} stroke="#94A3B8" strokeWidth="1" />
                    <text
                      x={(p0.px + pW.px) / 2}
                      y={p0.py + 30}
                      fill="#E2E8F0"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      Span: {stopeWidth} m (Floor Width)
                    </text>

                    {/* Left Height Ruler */}
                    <line x1={p0.px - 15} y1={p0.py} x2={pH.px - 15} y2={pH.py} stroke="#94A3B8" strokeWidth="1" />
                    <line x1={p0.px - 20} y1={p0.py} x2={p0.px - 10} y2={p0.py} stroke="#94A3B8" strokeWidth="1" />
                    <line x1={pH.px - 20} y1={pH.py} x2={pH.px - 10} y2={pH.py} stroke="#94A3B8" strokeWidth="1" />
                    <text
                      x={p0.px - 25}
                      y={(p0.py + pH.py) / 2}
                      fill="#E2E8F0"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="end"
                    >
                      Height: {stopeHeight} m
                    </text>
                  </g>
                );
              })()}
            </svg>
          </div>
        </div>

        {/* RIGHT COLLAPSIBLE INSPECTOR & TABBED WORKBENCH */}
        <aside
          className={`flex-none bg-slate-900 border-l border-slate-800 flex flex-col transition-all duration-200 z-20 ${
            isRightPanelOpen ? 'w-84' : 'w-12'
          }`}
        >
          {/* Header Tabs */}
          <div className="p-2 border-b border-slate-800 flex items-center justify-between text-xs font-mono font-bold text-amber-400">
            {isRightPanelOpen ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsRightPanelOpen(false)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1 overflow-x-auto">
                  {[
                    { id: 'GRADES' as RightPanelTab, label: 'Grades' },
                    { id: 'CHANNELS' as RightPanelTab, label: 'Assays' },
                    { id: 'STRUCTURE' as RightPanelTab, label: 'Struct' },
                    { id: 'GEOTECH' as RightPanelTab, label: 'Geotech' },
                    { id: 'EXPORTS' as RightPanelTab, label: 'Export' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setRightPanelTab(t.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        rightPanelTab === t.id
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsRightPanelOpen(true)}
                className="w-full py-1 flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <PanelRightOpen className="w-4 h-4 text-amber-400" />
              </button>
            )}
          </div>

          {/* Right Panel Body */}
          {isRightPanelOpen && (
            <div className="flex-1 overflow-y-auto p-3.5 space-y-4 font-mono text-xs">
              {/* TAB 1: GRADES & DILUTION RECONCILIATION */}
              {rightPanelTab === 'GRADES' && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                    <span className="font-bold text-slate-200">Face Grade &amp; Dilution</span>
                    <span className="text-[10px] text-amber-400">{chainage}</span>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Weighted Grade</span>
                      <strong className="text-amber-400 text-sm font-bold">
                        {composites.weightedGrade} g/t
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Face Dilution</span>
                      <strong className="text-rose-400 text-sm font-bold">
                        {composites.dilutionPercentByMass}%
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Estimated Tonnage</span>
                      <strong className="text-cyan-400 text-sm font-bold">
                        {composites.estimatedTonnesPerRound} t
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">Contained Metal</span>
                      <strong className="text-emerald-400 text-sm font-bold">
                        {composites.containedMetalUnits} g
                      </strong>
                    </div>
                  </div>

                  {/* Muck Destination Verdict */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-300">Muck Verdict:</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          composites.verdict === 'MILL'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : composites.verdict === 'LOW_GRADE_STOCKPILE'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {composites.verdict}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{composites.verdictDescription}</p>
                  </div>

                  {/* Cutoff Grade & SG Controls */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Reconciliation Thresholds
                    </span>
                    <label className="flex items-center justify-between">
                      <span className="text-slate-400">Mill Cutoff (g/t):</span>
                      <input
                        type="number"
                        step="0.1"
                        value={cutoffGrade}
                        onChange={(e) => setCutoffGrade(parseFloat(e.target.value) || 2.5)}
                        className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-emerald-400 text-right font-bold"
                      />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-slate-400">Blast Pull (m):</span>
                      <input
                        type="number"
                        step="0.1"
                        value={blastPull}
                        onChange={(e) => setBlastPull(parseFloat(e.target.value) || 3.2)}
                        className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 text-right font-bold"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 2: CHANNEL SAMPLING ASSAYS */}
              {rightPanelTab === 'CHANNELS' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                    <span className="font-bold text-slate-200">
                      Channel Cuts ({channelSamples.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const sampleNum = `CS-${String(channelSamples.length + 1).padStart(2, '0')}`;
                        const fromM = channelSamples.length > 0 ? channelSamples[channelSamples.length - 1].toMeter : 0.5;
                        const toM = Math.min(stopeWidth, fromM + 1.0);
                        const newSample: FaceChannelSampleRecord = {
                          id: `CS-${Date.now().toString(36).toUpperCase()}`,
                          sampleNumber: sampleNum,
                          fromMeter: fromM,
                          toMeter: toM,
                          sampleLengthMeters: Number((toM - fromM).toFixed(2)),
                          trueThicknessMeters: Number((toM - fromM).toFixed(2)),
                          assayGrade: 5.2,
                          gradeValue: '5.20',
                          sampledBy: 'Mine Geologist',
                          date: new Date().toISOString().split('T')[0],
                          specificGravity: oreSg,
                          zoneCategory: 'ORE',
                          lithologyOrVein: 'Quartz Vein',
                          notes: 'Chip-channel continuous cut',
                        };
                        pushUndo(features, [...channelSamples, newSample]);
                        setSelectedSampleId(newSample.id);
                      }}
                      className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Cut</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {channelSamples.map((s) => {
                      const isSel = selectedSampleId === s.id;
                      return (
                        <div
                          key={s.id}
                          onClick={() => setSelectedSampleId(s.id)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                            isSel
                              ? 'bg-slate-950 border-emerald-400 shadow-md'
                              : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-100 flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  s.zoneCategory === 'ORE'
                                    ? 'bg-emerald-400'
                                    : s.zoneCategory === 'LOW_GRADE'
                                    ? 'bg-amber-400'
                                    : 'bg-rose-400'
                                }`}
                              />
                              <span>{s.sampleNumber}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-400 font-bold">
                                {typeof s.assayGrade === 'number' ? s.assayGrade.toFixed(2) : s.gradeValue} g/t
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  pushUndo(
                                    features,
                                    channelSamples.filter((x) => x.id !== s.id)
                                  );
                                }}
                                className="p-0.5 rounded text-slate-500 hover:text-rose-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-400">
                            <div>From: {s.fromMeter.toFixed(2)}m · To: {s.toMeter.toFixed(2)}m</div>
                            <div>Interval: {s.sampleLengthMeters}m</div>
                          </div>

                          {isSel && (
                            <div className="pt-2 border-t border-slate-800 space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <label className="space-y-0.5">
                                  <span className="text-[10px] text-slate-400">Assay Grade:</span>
                                  <input
                                    type="number"
                                    step="0.05"
                                    value={typeof s.assayGrade === 'number' ? s.assayGrade : parseFloat(s.gradeValue || '0')}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setChannelSamples((prev) =>
                                        prev.map((item) =>
                                          item.id === s.id
                                            ? { ...item, assayGrade: val, gradeValue: String(val) }
                                            : item
                                        )
                                      );
                                    }}
                                    className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 font-bold"
                                  />
                                </label>
                                <label className="space-y-0.5">
                                  <span className="text-[10px] text-slate-400">Category:</span>
                                  <select
                                    value={s.zoneCategory || 'ORE'}
                                    onChange={(e) => {
                                      const val = e.target.value as any;
                                      setChannelSamples((prev) =>
                                        prev.map((item) =>
                                          item.id === s.id ? { ...item, zoneCategory: val } : item
                                        )
                                      );
                                    }}
                                    className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 text-[10px]"
                                  >
                                    <option value="ORE">Ore</option>
                                    <option value="LOW_GRADE">Low Grade</option>
                                    <option value="WASTE">Waste</option>
                                  </select>
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: STRUCTURAL DISCONTINUITIES & STEREONET */}
              {rightPanelTab === 'STRUCTURE' && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                    <span className="font-bold text-slate-200">
                      Discontinuities ({features.filter((f) => f.featureType === 'FAULT' || f.featureType === 'JOINT').length})
                    </span>
                    <span className="text-[10px] text-amber-400">Azimuth: {headingAzimuth}°</span>
                  </div>

                  {/* Equal-Area (Schmidt) Stereonet Plot */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Schmidt Lower-Hemisphere Stereonet
                    </span>
                    <div className="w-40 h-40 relative flex items-center justify-center">
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        {/* Outer Circle */}
                        <circle cx="50" cy="50" r="44" fill="#020617" stroke="#475569" strokeWidth="1.5" />
                        <line x1="50" y1="6" x2="50" y2="94" stroke="#334155" strokeWidth="0.8" />
                        <line x1="6" y1="50" x2="94" y2="50" stroke="#334155" strokeWidth="0.8" />
                        <text x="50" y="5" fill="#94A3B8" fontSize="6" textAnchor="middle">N</text>
                        <text x="96" y="52" fill="#94A3B8" fontSize="6" textAnchor="middle">E</text>
                        <text x="50" y="99" fill="#94A3B8" fontSize="6" textAnchor="middle">S</text>
                        <text x="4" y="52" fill="#94A3B8" fontSize="6" textAnchor="middle">W</text>

                        {/* Plotted Poles */}
                        {features
                          .filter((f) => f.dipDeg && f.dipDirectionDeg)
                          .map((f, i) => {
                            const dip = f.dipDeg || 70;
                            const dipDir = f.dipDirectionDeg || 0;
                            const r = Math.SQRT2 * Math.sin(((90 - dip) * Math.PI) / 360) * 44;
                            const poleDirRad = (((dipDir + 180) % 360) * Math.PI) / 180;
                            const px = 50 + r * Math.sin(poleDirRad);
                            const py = 50 - r * Math.cos(poleDirRad);
                            return (
                              <circle
                                key={`pole-${i}`}
                                cx={px}
                                cy={py}
                                r="2.5"
                                fill={f.colorHex}
                                stroke="#FFFFFF"
                                strokeWidth="0.8"
                              />
                            );
                          })}
                      </svg>
                    </div>
                  </div>

                  {/* Discontinuities List */}
                  <div className="space-y-2">
                    {features
                      .filter((f) => f.featureType === 'FAULT' || f.featureType === 'JOINT')
                      .map((f) => (
                        <div
                          key={f.id}
                          onClick={() => setSelectedFeatureId(f.id)}
                          className={`p-2 rounded-xl border transition-all cursor-pointer ${
                            selectedFeatureId === f.id
                              ? 'bg-slate-950 border-amber-400'
                              : 'bg-slate-950/70 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-100 flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: f.colorHex }} />
                              <span>{f.name}</span>
                            </span>
                            <span className="text-amber-400 font-bold">
                              {f.dipDeg}° / {f.dipDirectionDeg}°
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* TAB 4: GEOTECH EVALUATION (LAUBSCHER MRMR & MATHEWS STABILITY) */}
              {rightPanelTab === 'GEOTECH' && (
                <div className="space-y-3.5">
                  {/* Laubscher MRMR */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-400 text-xs">Laubscher Design MRMR:</span>
                      <strong className="text-sm font-black text-slate-100">
                        {mrmrResult.designMrmr} / 100 ({mrmrResult.rockMassClass})
                      </strong>
                    </div>
                    <p className="text-[11px] text-slate-400">{mrmrResult.description}</p>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-emerald-400">
                      <strong>Support:</strong> {mrmrResult.recommendedSupport}
                    </div>
                  </div>

                  {/* Mathews / Potvin Stope Stability */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-400 text-xs">Mathews Stability Graph:</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          mathewsResult.zone === 'STABLE_UNSUPPORTED' || mathewsResult.zone === 'STABLE_SUPPORTED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : mathewsResult.zone === 'TRANSITION_SLOUGHING'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {mathewsResult.zoneLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="p-2 rounded bg-slate-900">
                        <span className="text-slate-500 text-[10px] block">Stability Number (N)</span>
                        <strong className="text-cyan-300">{mathewsResult.stabilityNumberN}</strong>
                      </div>
                      <div className="p-2 rounded bg-slate-900">
                        <span className="text-slate-500 text-[10px] block">Hydraulic Radius (HR)</span>
                        <strong className="text-amber-300">{mathewsResult.hydraulicRadiusM} m</strong>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400">{mathewsResult.supportRecommendation}</p>
                  </div>
                </div>
              )}

              {/* TAB 5: PROFESSIONAL EXPORTS (SURPAC/DESWIK DXF, PDF FACE SHEET, CSV ASSAYS) */}
              {rightPanelTab === 'EXPORTS' && (
                <div className="space-y-3.5">
                  <div className="pb-1.5 border-b border-slate-800">
                    <span className="font-bold text-slate-200">CAD &amp; Geological Exports</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Generate 3D Surpac/Deswik layers, printable face sheets &amp; CSV tables.
                    </p>
                  </div>

                  {/* 1. Surpac / Deswik DXF */}
                  <button
                    type="button"
                    onClick={handleExportDxf}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-850 border border-amber-500/40 hover:border-amber-400 text-amber-300 font-bold flex items-center justify-between gap-2 cursor-pointer transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-amber-400" />
                      <span>Export Surpac/Deswik 3D DXF</span>
                    </span>
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  {/* 2. CSV Channel Assay Table */}
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-850 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 font-bold flex items-center justify-between gap-2 cursor-pointer transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                      <span>Export Channel Assays CSV</span>
                    </span>
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  {/* 3. Printable PDF Face Sheet */}
                  <button
                    type="button"
                    onClick={() => setIsPrintModalOpen(true)}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-850 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 font-bold flex items-center justify-between gap-2 cursor-pointer transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <Printer className="w-4 h-4 text-emerald-400" />
                      <span>View &amp; Print PDF Face Sheet</span>
                    </span>
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* STOPE SETUP WIZARD MODAL */}
      {isSetupWizardOpen && (
        <MiningFaceSetupWizard
          onCancel={() => setIsSetupWizardOpen(false)}
          onEnterFaceMapping={(stope) => {
            setIsSetupWizardOpen(false);
          }}
          initialStope={currentStope}
        />
      )}

      {/* MINING STORAGE VAULT MODAL */}
      <MiningDataStorageModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
      />

      {/* PRINTABLE PDF FACE SHEET MODAL */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto font-mono">
          <div className="w-full max-w-4xl bg-white text-slate-950 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[92vh] overflow-y-auto">
            {/* Title Block */}
            <div className="border-b-2 border-slate-950 pb-4 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-black uppercase tracking-wider text-slate-950">
                  UNDERGROUND MINING GEOLOGICAL FACE SHEET
                </h1>
                <p className="text-xs text-slate-600 font-bold mt-0.5">
                  {currentProject?.projectName} · {currentProject?.mineName}
                </p>
              </div>
              <div className="text-right text-xs">
                <div>Date: {new Date().toLocaleDateString()}</div>
                <div>Geologist: {currentStope?.responsibleGeologist}</div>
              </div>
            </div>

            {/* Stope Location & Metadata Table */}
            <div className="grid grid-cols-4 gap-3 text-xs border border-slate-300 p-3 rounded-lg bg-slate-50">
              <div>
                <span className="text-slate-500 font-bold block">Heading / Stope ID:</span>
                <strong>{driftId}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-bold block">Mine Level RL:</span>
                <strong>{mineLevel}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-bold block">Face Station / Chainage:</span>
                <strong>{chainage}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-bold block">Heading Azimuth:</span>
                <strong>{headingAzimuth}°</strong>
              </div>
            </div>

            {/* Face Drawing Preview */}
            <div className="h-64 border border-slate-300 rounded-lg bg-slate-100 flex items-center justify-center p-2">
              <svg viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} className="w-full h-full">
                {/* Stope Closed Boundary */}
                <polygon
                  points={profileMetrics.points
                    .map((p) => {
                      const { px, py } = meterToCanvas(p.x, p.y);
                      return `${px},${py}`;
                    })
                    .join(' ')}
                  fill="#E2E8F0"
                  stroke="#0F172A"
                  strokeWidth="3"
                />
                {/* Channel Samples Line */}
                {channelSamples.map((s) => {
                  const p1 = meterToCanvas(s.fromMeter, 1.5);
                  const p2 = meterToCanvas(s.toMeter, 1.5);
                  return (
                    <g key={s.id}>
                      <line x1={p1.px} y1={p1.py} x2={p2.px} y2={p2.py} stroke="#DC2626" strokeWidth="4" />
                      <text x={(p1.px + p2.px) / 2} y={p1.py - 8} fill="#000000" fontSize="10" fontWeight="bold" textAnchor="middle">
                        {s.sampleNumber} ({typeof s.assayGrade === 'number' ? s.assayGrade.toFixed(2) : s.gradeValue}g/t)
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Reconciliation & Assays Table */}
            <div className="space-y-2">
              <h3 className="font-bold text-xs uppercase border-b border-slate-300 pb-1">
                Channel Sampling Assays &amp; Composite Summary
              </h3>
              <table className="w-full text-left text-xs border border-slate-300">
                <thead className="bg-slate-200">
                  <tr>
                    <th className="p-1.5 border-r border-slate-300">Sample ID</th>
                    <th className="p-1.5 border-r border-slate-300">Interval (m)</th>
                    <th className="p-1.5 border-r border-slate-300">Assay Grade</th>
                    <th className="p-1.5 border-r border-slate-300">SG</th>
                    <th className="p-1.5">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {channelSamples.map((s) => (
                    <tr key={s.id}>
                      <td className="p-1.5 border-r border-slate-300 font-bold">{s.sampleNumber}</td>
                      <td className="p-1.5 border-r border-slate-300">{s.fromMeter} - {s.toMeter} m</td>
                      <td className="p-1.5 border-r border-slate-300 font-bold">
                        {typeof s.assayGrade === 'number' ? s.assayGrade.toFixed(2) : s.gradeValue} g/t
                      </td>
                      <td className="p-1.5 border-r border-slate-300">{s.specificGravity || 3.35}</td>
                      <td className="p-1.5 font-bold">{s.zoneCategory || 'ORE'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-300">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-xs font-bold text-slate-800 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl bg-slate-950 hover:bg-slate-850 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>Print Face Sheet</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
