// ============================================================================
// ESWA UNDERGROUND MINING & GRADE CONTROL — ADVANCED CAD FACE MAPPING WORKSPACE
// ============================================================================
// Full engineering face mapping workflow designed to match NATM CAD standard:
// - Precision CAD Viewport: Zoom, Pan, Metric Grid (0.5m/1.0m), Real Face Dimensions
// - Face Vector Drawing: Pencil (freehand), SPL (Catmull-Rom), Polyline, Closed Polygon
// - Ore Veins & Grades: High Grade, Medium Grade, Low Grade, Waste Dyke with true hatches
// - Discontinuities: Fault with slip sense, Shear zone, Structural joints with dip ticks
// - Geological Symbol Stamps: Direct click-to-stamp (Joint, Fault, Bedding, Foliation, Vein, Water)
// - Face Channel Sampling: True thickness, assay intervals, mass-weighted composites
// - Mining Geotech Inspector: Laubscher MRMR & Mathews Potvin Stability, Muck Haulage Verdict
// - Full CAD Tabs: Face Canvas, Grades & Dilution, Channels, Structural, Geotech, Exports
// ============================================================================

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  Minimize2,
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
  Pencil,
  Eraser,
  MousePointer,
  Hand,
  TrendingUp,
  BarChart3,
  ChevronRight,
  ArrowUpRight,
  FileText,
  Crosshair,
  Droplets,
  Hash,
  Tag,
  Sun,
  Moon,
  Box,
} from 'lucide-react';
import { EswaAppBackgroundWatermark, EswaTunnelLogo } from '../EswaBrandIdentity';
import { IndustryMode, FaceChannelSampleRecord, GeologicalSymbolType } from '../../types/tunnel';
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
import {
  StructuralGeologicalSymbolGlyph,
  LithologyPatternDefs,
  STRUCTURAL_GEOLOGICAL_SYMBOLS,
} from '../../engine/geologicalSymbolLibrary';
import { MiningFaceSetupWizard } from './MiningFaceSetupWizard';
import { MiningDataStorageModal } from './MiningDataStorageModal';
import { MiningGradesWindow } from './MiningGradesWindow';
import { MiningChannelsWindow } from './MiningChannelsWindow';
import { MiningStructureWindow } from './MiningStructureWindow';
import { MiningGeotechWindow } from './MiningGeotechWindow';
import { MiningExportsWindow } from './MiningExportsWindow';

export type MiningCanvasTool =
  | 'SELECT'
  | 'PENCIL'
  | 'SPL'
  | 'POLYLINE'
  | 'POLYGON'
  | 'SYMBOL'
  | 'CHANNEL_CUT'
  | 'ERASE'
  | 'PAN';

export type MiningWorkingWindow =
  | 'CANVAS'
  | 'GRADES'
  | 'CHANNELS'
  | 'STRUCTURE'
  | 'GEOTECH'
  | 'EXPORTS';

export type MiningCanvasTheme = 'light' | 'blueprint' | 'dark';

export const MINING_CANVAS_THEMES = {
  light: {
    name: 'Light CAD (White)',
    containerBg: 'bg-slate-200/80',
    svgBg: '#FFFFFF',
    border: 'border-slate-300',
    hostRockFill: '#F1F5F9',
    hostRockStroke: '#CBD5E1',
    hostRockLines: '#E2E8F0',
    faceGradStart: '#FFFFFF',
    faceGradMid: '#F8FAFC',
    faceGradEnd: '#F1F5F9',
    faceBorder: '#D97706',
    gridMajor: '#94A3B8',
    gridMinor: '#CBD5E1',
    gridOpacity: '0.75',
    centerline: '#0284C7',
    gradeLine: '#B45309',
    textMain: '#0F172A',
    textMuted: '#475569',
    textHalo: 'rgba(255, 255, 255, 0.96)',
    tickColor: '#0284C7',
    crosshair: '#0284C7',
  },
  blueprint: {
    name: 'Engineering Blueprint',
    containerBg: 'bg-slate-900',
    svgBg: '#1E3A8A',
    border: 'border-blue-600',
    hostRockFill: '#172554',
    hostRockStroke: '#1E40AF',
    hostRockLines: '#1D4ED8',
    faceGradStart: '#1E3A8A',
    faceGradMid: '#1E40AF',
    faceGradEnd: '#172554',
    faceBorder: '#FFFFFF',
    gridMajor: 'rgba(255, 255, 255, 0.45)',
    gridMinor: 'rgba(255, 255, 255, 0.22)',
    gridOpacity: '0.85',
    centerline: '#FDE047',
    gradeLine: '#F59E0B',
    textMain: '#FFFFFF',
    textMuted: '#93C5FD',
    textHalo: 'rgba(30, 58, 138, 0.96)',
    tickColor: '#60A5FA',
    crosshair: '#FDE047',
  },
  dark: {
    name: 'Underground Dark Mine',
    containerBg: 'bg-slate-950',
    svgBg: '#090E17',
    border: 'border-slate-800',
    hostRockFill: '#0D1524',
    hostRockStroke: '#1E293B',
    hostRockLines: '#1A253A',
    faceGradStart: '#253348',
    faceGradMid: '#1C273C',
    faceGradEnd: '#141E2F',
    faceBorder: '#F59E0B',
    gridMajor: '#475569',
    gridMinor: '#334155',
    gridOpacity: '0.65',
    centerline: '#06B6D4',
    gradeLine: '#EAB308',
    textMain: '#E2E8F0',
    textMuted: '#94A3B8',
    textHalo: 'rgba(15, 23, 42, 0.92)',
    tickColor: '#38BDF8',
    crosshair: '#38BDF8',
  },
};

// ----------------------------------------------------------------------------
// Catmull-Rom Spline Path Generator
// ----------------------------------------------------------------------------
export function pointsToSplinePath(
  pts: { px: number; py: number }[],
  isClosed = false
): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].px.toFixed(1)} ${pts[0].py.toFixed(1)}`;
  if (pts.length === 2) {
    return `M ${pts[0].px.toFixed(1)} ${pts[0].py.toFixed(1)} L ${pts[1].px.toFixed(1)} ${pts[1].py.toFixed(1)}${
      isClosed ? ' Z' : ''
    }`;
  }

  let d = `M ${pts[0].px.toFixed(1)} ${pts[0].py.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = i > 0 ? pts[i - 1] : pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

    const cp1x = p1.px + (p2.px - p0.px) / 6;
    const cp1y = p1.py + (p2.py - p0.py) / 6;
    const cp2x = p2.px - (p3.px - p1.px) / 6;
    const cp2y = p2.py - (p3.py - p1.py) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.px.toFixed(1)} ${p2.py.toFixed(1)}`;
  }

  if (isClosed) {
    const p0 = pts[pts.length - 2];
    const p1 = pts[pts.length - 1];
    const p2 = pts[0];
    const p3 = pts[1];
    const cp1x = p1.px + (p2.px - p0.px) / 6;
    const cp1y = p1.py + (p2.py - p0.py) / 6;
    const cp2x = p2.px - (p3.px - p1.px) / 6;
    const cp2y = p2.py - (p3.py - p1.py) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.px.toFixed(1)} ${p2.py.toFixed(1)} Z`;
  }
  return d;
}

// ----------------------------------------------------------------------------
// Initial Seed Sample Mining Face Dataset (Kolar Gold Reef Stope Model)
// Ensures the face canvas is never a blank/black void!
// ----------------------------------------------------------------------------
export function createSampleMiningFaceDataset(
  stopeWidth = 4.8,
  stopeHeight = 4.2
): {
  features: MiningGeologicalFeature[];
  channelSamples: FaceChannelSampleRecord[];
} {
  const w = Math.max(3.0, stopeWidth);
  const h = Math.max(2.5, stopeHeight);

  return {
    features: [
      // 1. High Grade Gold Quartz Reef Lode (Closed Polygon with rich mineralized core)
      {
        id: 'MIN-ORE-GOLD-01',
        surfaceType: 'DEVELOPMENT_FACE',
        featureType: 'ORE_BOUNDARY',
        geometryType: 'POLYGON',
        isSpline: true,
        drawTool: 'SPL',
        name: 'Champion High-Grade Quartz Lode (8.85 g/t Au)',
        colorHex: '#EF4444',
        strokeWidth: 3.5,
        fillOpacity: 0.55,
        visible: true,
        roughness: 'Rough Undulating',
        infill: 'Smoky Ribbon Quartz + Visible Gold + Arsenopyrite',
        waterInflow: 'DRY',
        author: 'Mine Geologist',
        createdAt: new Date().toISOString(),
        points: [
          { x: Number((w * 0.38).toFixed(2)), y: 0.0 },
          { x: Number((w * 0.42).toFixed(2)), y: Number((h * 0.35).toFixed(2)) },
          { x: Number((w * 0.48).toFixed(2)), y: Number((h * 0.65).toFixed(2)) },
          { x: Number((w * 0.54).toFixed(2)), y: Number((h * 0.95).toFixed(2)) },
          { x: Number((w * 0.64).toFixed(2)), y: Number((h * 0.92).toFixed(2)) },
          { x: Number((w * 0.58).toFixed(2)), y: Number((h * 0.60).toFixed(2)) },
          { x: Number((w * 0.52).toFixed(2)), y: Number((h * 0.30).toFixed(2)) },
          { x: Number((w * 0.46).toFixed(2)), y: 0.0 },
        ],
      },
      // 2. Hangingwall Shear / Fault Trace (Open Polyline Spline)
      {
        id: 'MIN-FAULT-HW-01',
        surfaceType: 'DEVELOPMENT_FACE',
        featureType: 'FAULT',
        geometryType: 'POLYLINE',
        isSpline: true,
        drawTool: 'SPL',
        name: 'Hangingwall Shear Zone (065°/75° SE)',
        colorHex: '#DC2626',
        strokeWidth: 3.0,
        visible: true,
        strikeDeg: 65,
        dipDeg: 75,
        dipDirectionDeg: 155,
        roughness: 'Slickensided Planar',
        infill: 'Graphitic Chlorite Gouge (15mm)',
        waterInflow: 'DRIPPING',
        author: 'Mine Geologist',
        createdAt: new Date().toISOString(),
        points: [
          { x: Number((w * 0.12).toFixed(2)), y: Number((h * 0.15).toFixed(2)) },
          { x: Number((w * 0.22).toFixed(2)), y: Number((h * 0.48).toFixed(2)) },
          { x: Number((w * 0.32).toFixed(2)), y: Number((h * 0.78).toFixed(2)) },
          { x: Number((w * 0.40).toFixed(2)), y: Number((h * 0.98).toFixed(2)) },
        ],
      },
      // 3. Footwall Structural Joint J1 (Open Polyline)
      {
        id: 'MIN-JOINT-FW-01',
        surfaceType: 'DEVELOPMENT_FACE',
        featureType: 'JOINT',
        geometryType: 'POLYLINE',
        isSpline: false,
        drawTool: 'POLYLINE',
        name: 'Conjugate Joint J1 (040°/62° NW)',
        colorHex: '#38BDF8',
        strokeWidth: 2.2,
        visible: true,
        strikeDeg: 40,
        dipDeg: 62,
        dipDirectionDeg: 310,
        roughness: 'Rough Stepped',
        infill: 'Calcite Healing',
        waterInflow: 'DRY',
        author: 'Mine Geologist',
        createdAt: new Date().toISOString(),
        points: [
          { x: Number((w * 0.70).toFixed(2)), y: Number((h * 0.10).toFixed(2)) },
          { x: Number((w * 0.78).toFixed(2)), y: Number((h * 0.45).toFixed(2)) },
          { x: Number((w * 0.88).toFixed(2)), y: Number((h * 0.80).toFixed(2)) },
        ],
      },
      // 4. Stratigraphic Litho Contact
      {
        id: 'MIN-LITH-01',
        surfaceType: 'DEVELOPMENT_FACE',
        featureType: 'LITH_CONTACT',
        geometryType: 'POLYLINE',
        isSpline: true,
        drawTool: 'SPL',
        name: 'Amphibolite / Metabasalt Contact',
        colorHex: '#34D399',
        strokeWidth: 2.2,
        visible: true,
        roughness: 'Undulating Tight',
        infill: 'None (Welded)',
        waterInflow: 'DRY',
        author: 'Mine Geologist',
        createdAt: new Date().toISOString(),
        points: [
          { x: Number((w * 0.25).toFixed(2)), y: 0.0 },
          { x: Number((w * 0.28).toFixed(2)), y: Number((h * 0.5).toFixed(2)) },
          { x: Number((w * 0.33).toFixed(2)), y: Number((h * 0.95).toFixed(2)) },
        ],
      },
      // 5. Fault Symbol Stamp Glyph
      {
        id: 'SYM-FAULT-01',
        surfaceType: 'DEVELOPMENT_FACE',
        featureType: 'FAULT',
        geometryType: 'POINT',
        name: 'Fault Glyph (065°/75°)',
        colorHex: '#DC2626',
        strikeDeg: 65,
        dipDeg: 75,
        dipDirectionDeg: 155,
        lithologyCode: 'fault',
        visible: true,
        author: 'Mine Geologist',
        createdAt: new Date().toISOString(),
        points: [{ x: Number((w * 0.22).toFixed(2)), y: Number((h * 0.48).toFixed(2)) }],
      },
      // 6. Joint Symbol Stamp Glyph
      {
        id: 'SYM-JOINT-01',
        surfaceType: 'DEVELOPMENT_FACE',
        featureType: 'JOINT',
        geometryType: 'POINT',
        name: 'Joint Glyph (040°/62°)',
        colorHex: '#38BDF8',
        strikeDeg: 40,
        dipDeg: 62,
        dipDirectionDeg: 310,
        lithologyCode: 'joint',
        visible: true,
        author: 'Mine Geologist',
        createdAt: new Date().toISOString(),
        points: [{ x: Number((w * 0.78).toFixed(2)), y: Number((h * 0.45).toFixed(2)) }],
      },
    ],
    channelSamples: [
      {
        id: 'CS-01',
        sampleNumber: 'CH-01 (HW Waste)',
        fromMeter: 0.3,
        toMeter: Number((w * 0.38).toFixed(2)),
        sampleLengthMeters: Number((w * 0.38 - 0.3).toFixed(2)),
        trueThicknessMeters: Number((w * 0.38 - 0.3).toFixed(2)),
        assayGrade: 0.65,
        gradeValue: '0.65',
        sampledBy: 'Dr. V. Raghavan',
        date: new Date().toISOString().split('T')[0],
        specificGravity: 2.72,
        zoneCategory: 'WASTE',
        lithologyOrVein: 'Amphibolite Wallrock',
        notes: 'Low-grade hangingwall selvage',
      },
      {
        id: 'CS-02',
        sampleNumber: 'CH-02 (High Grade Ore)',
        fromMeter: Number((w * 0.38).toFixed(2)),
        toMeter: Number((w * 0.64).toFixed(2)),
        sampleLengthMeters: Number((w * 0.64 - w * 0.38).toFixed(2)),
        trueThicknessMeters: Number((w * 0.64 - w * 0.38).toFixed(2)),
        assayGrade: 8.85,
        gradeValue: '8.85',
        sampledBy: 'Dr. V. Raghavan',
        date: new Date().toISOString().split('T')[0],
        specificGravity: 3.35,
        zoneCategory: 'ORE',
        lithologyOrVein: 'Champion Quartz Reef + Sulfides',
        notes: 'High-grade pay shoot with visible gold clusters',
      },
      {
        id: 'CS-03',
        sampleNumber: 'CH-03 (FW Mineralized)',
        fromMeter: Number((w * 0.64).toFixed(2)),
        toMeter: Number((w - 0.3).toFixed(2)),
        sampleLengthMeters: Number((w - 0.3 - w * 0.64).toFixed(2)),
        trueThicknessMeters: Number((w - 0.3 - w * 0.64).toFixed(2)),
        assayGrade: 2.45,
        gradeValue: '2.45',
        sampledBy: 'Dr. V. Raghavan',
        date: new Date().toISOString().split('T')[0],
        specificGravity: 2.85,
        zoneCategory: 'LOW_GRADE',
        lithologyOrVein: 'Silicified FW Metabasalt',
        notes: 'Marginal mineralized halo',
      },
    ],
  };
}

export interface MiningMappingWorkspaceProps {
  onBackToMainWindow: () => void;
  onChangeIndustryMode?: (mode: IndustryMode) => void;
}

export const MiningMappingWorkspace: React.FC<MiningMappingWorkspaceProps> = ({
  onBackToMainWindow,
  onChangeIndustryMode,
}) => {
  // Navigation Tabs
  const [activeWorkingWindow, setActiveWorkingWindow] = useState<MiningWorkingWindow>('CANVAS');
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState<boolean>(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Printable Face Sheet Left/Right Logos & PNG Signatures (persisted across sessions)
  const [sheetLogos, setSheetLogos] = useState<{ left?: string; right?: string }>(() => {
    try {
      const raw = localStorage.getItem('eswa_mining_face_sheet_logos_v1');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [sheetSigns, setSheetSigns] = useState<{ geologist?: string; chief?: string }>(() => {
    try {
      const raw = localStorage.getItem('eswa_mining_face_sheet_signs_v1');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const updateSheetLogo = (side: 'left' | 'right', dataUrl?: string) => {
    setSheetLogos((prev) => {
      const next = { ...prev, [side]: dataUrl };
      try {
        localStorage.setItem('eswa_mining_face_sheet_logos_v1', JSON.stringify(next));
      } catch {
        // ignore quota
      }
      return next;
    });
  };

  const updateSheetSign = (role: 'geologist' | 'chief', dataUrl?: string) => {
    setSheetSigns((prev) => {
      const next = { ...prev, [role]: dataUrl };
      try {
        localStorage.setItem('eswa_mining_face_sheet_signs_v1', JSON.stringify(next));
      } catch {
        // ignore quota
      }
      return next;
    });
  };

  // Editable Sign-Off Names for Mining Printable Face Sheet (blank by default)
  const [sheetNames, setSheetNames] = useState<{ geologistName: string; chiefName: string }>(() => {
    try {
      const raw = localStorage.getItem('eswa_mining_face_sheet_names_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          geologistName: parsed.geologistName || '',
          chiefName: parsed.chiefName || '',
        };
      }
    } catch {
      // ignore
    }
    return { geologistName: '', chiefName: '' };
  });

  const updateSheetName = (role: 'geologistName' | 'chiefName', value: string) => {
    setSheetNames((prev) => {
      const next = { ...prev, [role]: value };
      try {
        localStorage.setItem('eswa_mining_face_sheet_names_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Storage and Active Stope
  const projects = useMemo(() => loadMiningProjects(), [isSetupWizardOpen, isStorageModalOpen]);
  const stopes = useMemo(() => loadMiningStopes(), [isSetupWizardOpen, isStorageModalOpen]);

  const activeProjId = getActiveMiningProjectId() || projects[0]?.id;
  const activeStopeId = getActiveMiningStopeId() || stopes[0]?.id;

  const currentProject = projects.find((p) => p.id === activeProjId) || projects[0];
  const currentStope = stopes.find((s) => s.id === activeStopeId) || stopes[0];

  // Primary Face Geometrical Parameters
  const [driftId, setDriftId] = useState<string>(currentStope?.stopeOrDriftId || 'HW-DRV-04');
  const [mineLevel, setMineLevel] = useState<string>(currentStope?.mineLevel || 'Level 620 mRL');
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
  const [metalPriceAuOz, setMetalPriceAuOz] = useState<number>(2650);
  const [miningCostPerTonne, setMiningCostPerTonne] = useState<number>(68);
  const [millingCostPerTonne, setMillingCostPerTonne] = useState<number>(34);

  // Panels layout
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState<boolean>(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(true);

  // Active Tooling
  const [activeTool, setActiveTool] = useState<MiningCanvasTool>('SPL');
  const [featureClassification, setFeatureClassification] = useState<MiningGeologicalFeatureType>('ORE_BOUNDARY');
  const [selectedOreCategory, setSelectedOreCategory] = useState<
    'HIGH_GRADE' | 'MEDIUM_GRADE' | 'LOW_GRADE' | 'INTERNAL_WASTE'
  >('HIGH_GRADE');
  const [selectedSymbolType, setSelectedSymbolType] = useState<GeologicalSymbolType>('joint');
  const [symbolStrikeDeg, setSymbolStrikeDeg] = useState<number>(45);
  const [symbolDipDeg, setSymbolDipDeg] = useState<number>(65);

  const [strokeWidthSetting, setStrokeWidthSetting] = useState<number>(3.0);
  const [fillOpacitySetting, setFillOpacitySetting] = useState<number>(0.45);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showPhoto, setShowPhoto] = useState<boolean>(true);
  const [showAxes, setShowAxes] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVED'>('IDLE');

  // Vector Features & Channel Samples: Start clean with no pre-fed mock data. Only user inputs will appear.
  const [features, setFeatures] = useState<MiningGeologicalFeature[]>(() => {
    return currentStope?.features && currentStope.features.length > 0 ? currentStope.features : [];
  });
  const [channelSamples, setChannelSamples] = useState<FaceChannelSampleRecord[]>(() => {
    return currentStope?.channelSamples && currentStope.channelSamples.length > 0 ? currentStope.channelSamples : [];
  });
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);

  // Draft drawing state
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentDraftPoints, setCurrentDraftPoints] = useState<MiningGeologicalPoint[]>([]);
  const draftPointsRef = useRef<MiningGeologicalPoint[]>([]);
  const handleCommitFeatureRef = useRef<(pts?: MiningGeologicalPoint[]) => void>(() => {});

  // Keep draft ref updated
  useEffect(() => {
    draftPointsRef.current = currentDraftPoints;
  }, [currentDraftPoints]);

  // Canvas Viewport Pan & Zoom
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [cursorMeters, setCursorMeters] = useState<{ x: number; y: number }>({ x: 2.4, y: 2.1 });

  // Canvas Theme: 'light' (default High-Contrast White CAD), 'blueprint', 'dark'
  const [canvasTheme, setCanvasTheme] = useState<MiningCanvasTheme>('light');
  const activeTheme = MINING_CANVAS_THEMES[canvasTheme];

  // Pinch-to-zoom and multi-touch tracking refs
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(1.0);
  const touchStartPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchStartCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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

  // Undo / Redo Stacks
  const [undoStack, setUndoStack] = useState<
    { features: MiningGeologicalFeature[]; samples: FaceChannelSampleRecord[] }[]
  >([]);
  const [redoStack, setRedoStack] = useState<
    { features: MiningGeologicalFeature[]; samples: FaceChannelSampleRecord[] }[]
  >([]);

  const pushUndo = (nextFeatures = features, nextSamples = channelSamples) => {
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

  // Re-sync state when active stope changes
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
      setSelectedFeatureId(null);
      setSelectedSampleId(null);
    }
  }, [currentStope?.id]);

  // Global Keyboard listener: Enter to commit feature, Backspace to undo point, Escape to cancel, Space to pan
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isInput =
        (e.target as HTMLElement)?.tagName === 'INPUT' ||
        (e.target as HTMLElement)?.tagName === 'TEXTAREA';
      if (isInput) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(true);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (isDrawing && draftPointsRef.current.length >= 2) {
          handleCommitFeatureRef.current();
        }
      }
      if (e.key === 'Backspace') {
        if (isDrawing && draftPointsRef.current.length > 0) {
          e.preventDefault();
          setCurrentDraftPoints((prev) => {
            const next = prev.slice(0, -1);
            draftPointsRef.current = next;
            return next;
          });
        }
      }
      if (e.key === 'Escape') {
        setIsDrawing(false);
        setCurrentDraftPoints([]);
        draftPointsRef.current = [];
        setSelectedFeatureId(null);
        setSelectedSampleId(null);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isDrawing]);

  // Geotechnical & Stability metrics
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

  // ----------------------------------------------------------------------------
  // CAD COORDINATE ENGINE: 1:1 Aspect Ratio Metric Mapping
  // ----------------------------------------------------------------------------
  const canvasW = 1000;
  const canvasH = 700;
  const pad = 70;

  // Preserve true 1:1 metric aspect ratio so 1m in X equals 1m in Y exactly
  const scale = useMemo(() => {
    const sx = (canvasW - pad * 2) / Math.max(1, stopeWidth);
    const sy = (canvasH - pad * 2) / Math.max(1, stopeHeight);
    return Math.min(sx, sy);
  }, [stopeWidth, stopeHeight]);

  const originX = useMemo(() => (canvasW - stopeWidth * scale) / 2, [stopeWidth, scale]);
  const originY = useMemo(
    () => canvasH - (canvasH - stopeHeight * scale) / 2,
    [stopeHeight, scale]
  );

  const meterToCanvas = useCallback(
    (mx: number, my: number) => {
      const px = originX + mx * scale;
      const py = originY - my * scale;
      return { px, py };
    },
    [originX, originY, scale]
  );

  const canvasToMeter = useCallback(
    (px: number, py: number) => {
      const mx = (px - originX) / scale;
      const my = (originY - py) / scale;
      return {
        mx: Number(Math.max(-0.2, Math.min(stopeWidth + 0.2, mx)).toFixed(2)),
        my: Number(Math.max(-0.2, Math.min(stopeHeight + 0.2, my)).toFixed(2)),
      };
    },
    [originX, originY, scale, stopeWidth, stopeHeight]
  );

  // Exact inverse transform from screen mouse/touch/pointer event to canvas meters using SVG CTM inverse
  const getEventMeterPoint = useCallback(
    (
      e:
        | React.MouseEvent<SVGSVGElement>
        | React.TouchEvent<SVGSVGElement>
        | React.PointerEvent<SVGSVGElement>
        | MouseEvent
        | Touch
        | { clientX: number; clientY: number }
    ) => {
      const svg = svgRef.current;
      if (!svg) return { mx: 0, my: 0, px: 0, py: 0 };

      let clientX = 0;
      let clientY = 0;
      if ('clientX' in e && typeof e.clientX === 'number') {
        clientX = e.clientX;
        clientY = e.clientY;
      } else if ('touches' in e && (e as React.TouchEvent).touches[0]) {
        clientX = (e as React.TouchEvent).touches[0].clientX;
        clientY = (e as React.TouchEvent).touches[0].clientY;
      }

      let svgX = 0;
      let svgY = 0;
      try {
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const ctm = svg.getScreenCTM();
        if (ctm) {
          const transformed = pt.matrixTransform(ctm.inverse());
          svgX = transformed.x;
          svgY = transformed.y;
        } else {
          const rect = svg.getBoundingClientRect();
          svgX = ((clientX - rect.left) / (rect.width || 1)) * canvasW;
          svgY = ((clientY - rect.top) / (rect.height || 1)) * canvasH;
        }
      } catch {
        const rect = svg.getBoundingClientRect();
        svgX = ((clientX - rect.left) / (rect.width || 1)) * canvasW;
        svgY = ((clientY - rect.top) / (rect.height || 1)) * canvasH;
      }

      // Inverse pan & zoom transform
      const px = (svgX - pan.x) / zoom;
      const py = (svgY - pan.y) / zoom;
      const { mx, my } = canvasToMeter(px, py);
      return { mx, my, px, py };
    },
    [pan, zoom, canvasToMeter, canvasW, canvasH]
  );

  // Erase items near point
  const handleEraseAtPoint = useCallback(
    (mx: number, my: number) => {
      const threshold = 0.45; // 45 cm tolerance
      const remainingFeatures = features.filter((f) => {
        return !f.points.some((p) => Math.hypot(p.x - mx, p.y - my) <= threshold);
      });
      const remainingSamples = channelSamples.filter((s) => {
        const inX = mx >= s.fromMeter - 0.35 && mx <= s.toMeter + 0.35;
        const inY = Math.abs(my - 1.5) <= 0.55;
        return !(inX && inY);
      });

      if (
        remainingFeatures.length !== features.length ||
        remainingSamples.length !== channelSamples.length
      ) {
        pushUndo(remainingFeatures, remainingSamples);
        if (selectedFeatureId && !remainingFeatures.some((f) => f.id === selectedFeatureId)) {
          setSelectedFeatureId(null);
        }
        if (selectedSampleId && !remainingSamples.some((s) => s.id === selectedSampleId)) {
          setSelectedSampleId(null);
        }
      }
    },
    [features, channelSamples, selectedFeatureId, selectedSampleId]
  );

  // Complete Feature Action
  const handleCommitFeature = useCallback(
    (ptsToCommit?: MiningGeologicalPoint[]) => {
      const rawPts = ptsToCommit || draftPointsRef.current || currentDraftPoints;
      // Filter out duplicate identical points
      const cleanPts = rawPts.filter((p, idx) => {
        if (idx === 0) return true;
        const prev = rawPts[idx - 1];
        return Math.hypot(p.x - prev.x, p.y - prev.y) > 0.02;
      });

      if (activeTool === 'POLYGON' && cleanPts.length < 3) {
        setIsDrawing(false);
        setCurrentDraftPoints([]);
        draftPointsRef.current = [];
        return;
      }
      if ((activeTool === 'PENCIL' || activeTool === 'SPL' || activeTool === 'POLYLINE') && cleanPts.length < 2) {
        setIsDrawing(false);
        setCurrentDraftPoints([]);
        draftPointsRef.current = [];
        return;
      }

      const isSpl = activeTool === 'SPL';
      const isPolygon = activeTool === 'POLYGON';

      let targetType: MiningGeologicalFeatureType = featureClassification;
      let color = '#F59E0B';
      let name = 'Geological Feature';

      if (featureClassification === 'ORE_BOUNDARY') {
        name = `${selectedOreCategory.replace('_', ' ')} Ore Lode`;
        color =
          selectedOreCategory === 'HIGH_GRADE'
            ? '#EF4444'
            : selectedOreCategory === 'MEDIUM_GRADE'
            ? '#F59E0B'
            : selectedOreCategory === 'LOW_GRADE'
            ? '#EAB308'
            : '#64748B';
      } else if (featureClassification === 'FAULT') {
        name = `Fault Trace / Shear (${symbolStrikeDeg}°/${symbolDipDeg}°)`;
        color = '#DC2626';
      } else if (featureClassification === 'SHEAR') {
        name = `Ductile Shear Zone (${symbolStrikeDeg}°/${symbolDipDeg}°)`;
        color = '#FB7185';
      } else if (featureClassification === 'JOINT') {
        name = `Structural Joint (${symbolStrikeDeg}°/${symbolDipDeg}°)`;
        color = '#38BDF8';
      } else if (featureClassification === 'LITH_CONTACT') {
        name = 'Stratigraphic Litho Contact';
        color = '#34D399';
      } else if (featureClassification === 'ALTERATION_HALO') {
        name = 'Silicified Alteration Halo';
        color = '#A855F7';
      } else if (featureClassification === 'BRECCIA') {
        name = 'Hydrothermal Breccia';
        color = '#F97316';
      }

      const newFeat: MiningGeologicalFeature = {
        id: `MIN-${Date.now().toString(36).toUpperCase()}`,
        surfaceType: 'DEVELOPMENT_FACE',
        featureType: targetType,
        geometryType: isPolygon ? 'POLYGON' : 'POLYLINE',
        points: cleanPts,
        name,
        colorHex: color,
        strokeWidth: strokeWidthSetting,
        fillOpacity: fillOpacitySetting,
        isSpline: isSpl,
        drawTool: isSpl ? 'SPL' : isPolygon ? 'POLYLINE' : activeTool === 'PENCIL' ? 'PENCIL' : 'POLYLINE',
        visible: true,
        strikeDeg: symbolStrikeDeg,
        dipDeg: symbolDipDeg,
        dipDirectionDeg: (symbolStrikeDeg + 90) % 360,
        roughness: 'Rough Undulating',
        infill: 'Quartz / Pyrite',
        waterInflow: 'DRY',
        author: sheetNames.geologistName || '',
        createdAt: new Date().toISOString(),
      };

      pushUndo([...features, newFeat], channelSamples);
      setSelectedFeatureId(newFeat.id);
      setIsDrawing(false);
      setCurrentDraftPoints([]);
      draftPointsRef.current = [];
    },
    [
      currentDraftPoints,
      activeTool,
      featureClassification,
      selectedOreCategory,
      symbolStrikeDeg,
      symbolDipDeg,
      strokeWidthSetting,
      fillOpacitySetting,
      features,
      channelSamples,
    ]
  );
  handleCommitFeatureRef.current = handleCommitFeature;

  // Add Geological Symbol Stamp at point
  const handleStampGeologicalSymbol = useCallback(
    (mx: number, my: number) => {
      const symMeta = STRUCTURAL_GEOLOGICAL_SYMBOLS.find((s) => s.type === selectedSymbolType);
      const newFeat: MiningGeologicalFeature = {
        id: `SYM-${Date.now().toString(36).toUpperCase()}`,
        surfaceType: 'DEVELOPMENT_FACE',
        featureType:
          selectedSymbolType === 'fault'
            ? 'FAULT'
            : selectedSymbolType === 'shear_zone'
            ? 'SHEAR'
            : selectedSymbolType === 'vein'
            ? 'VEIN'
            : selectedSymbolType === 'foliation'
            ? 'FOLIATION'
            : 'JOINT',
        geometryType: 'POINT',
        points: [{ x: mx, y: my }],
        name: `${symMeta?.label || 'Symbol'} (${symbolStrikeDeg}°/${symbolDipDeg}°)`,
        colorHex: symMeta?.defaultColor || '#38BDF8',
        strikeDeg: symbolStrikeDeg,
        dipDeg: symbolDipDeg,
        dipDirectionDeg: (symbolStrikeDeg + 90) % 360,
        visible: true,
        lithologyCode: selectedSymbolType,
        waterInflow:
          selectedSymbolType === 'water_flow'
            ? 'FLOWING'
            : selectedSymbolType === 'water_seepage'
            ? 'DRIPPING'
            : 'DRY',
        author: 'Mine Geologist',
        createdAt: new Date().toISOString(),
      };

      pushUndo([...features, newFeat], channelSamples);
      setSelectedFeatureId(newFeat.id);
    },
    [selectedSymbolType, symbolStrikeDeg, symbolDipDeg, features, channelSamples]
  );

  // Add Channel Cut sample
  const handleAddChannelCut = useCallback(
    (mx: number) => {
      const fromM = Math.max(0, Number((mx - 0.5).toFixed(2)));
      const toM = Math.min(stopeWidth, Number((mx + 0.5).toFixed(2)));
      const sampleNum = `CH-${String(channelSamples.length + 1).padStart(2, '0')}`;
      const newSample: FaceChannelSampleRecord = {
        id: `CS-${Date.now().toString(36).toUpperCase()}`,
        sampleNumber: sampleNum,
        fromMeter: fromM,
        toMeter: toM,
        sampleLengthMeters: Number((toM - fromM).toFixed(2)),
        trueThicknessMeters: Number((toM - fromM).toFixed(2)),
        assayGrade: 5.25,
        gradeValue: '5.25',
        sampledBy: 'Mine Geologist',
        date: new Date().toISOString().split('T')[0],
        specificGravity: oreSg,
        zoneCategory: 'ORE',
        lithologyOrVein: 'Champion Quartz Reef + Sulfides',
        notes: 'Channel cut across face at 1.5m baseline',
      };
      pushUndo(features, [...channelSamples, newSample]);
      setSelectedSampleId(newSample.id);
      setSelectedFeatureId(null);
    },
    [stopeWidth, channelSamples, oreSg, features]
  );

  // Load Sample Mining Face Data (Kolar Gold Reef Stope Model)
  const handleLoadSampleFace = useCallback(() => {
    const sample = createSampleMiningFaceDataset(stopeWidth, stopeHeight);
    pushUndo(sample.features, sample.channelSamples);
    setSelectedFeatureId(null);
    setSelectedSampleId(null);
  }, [stopeWidth, stopeHeight]);

  // Canvas Pointer Down (Mouse, Touch, Stylus unified)
  const handleCanvasPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Middle mouse button or spacebar or PAN tool
    if (e.button === 1 || isSpacePressed || activeTool === 'PAN') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      try {
        (e.currentTarget as Element)?.setPointerCapture?.(e.pointerId);
      } catch {}
      return;
    }

    if (e.button === 2) return; // Right click ignore

    const { mx, my, px, py } = getEventMeterPoint(e);

    if (activeTool === 'SELECT') {
      setSelectedFeatureId(null);
      setSelectedSampleId(null);
      return;
    }

    if (activeTool === 'ERASE') {
      setIsDrawing(true);
      handleEraseAtPoint(mx, my);
      return;
    }

    if (activeTool === 'SYMBOL') {
      handleStampGeologicalSymbol(mx, my);
      return;
    }

    if (activeTool === 'CHANNEL_CUT') {
      handleAddChannelCut(mx);
      return;
    }

    if (activeTool === 'PENCIL') {
      setIsDrawing(true);
      try {
        (e.currentTarget as Element)?.setPointerCapture?.(e.pointerId);
      } catch {}
      const startPt: MiningGeologicalPoint = { x: mx, y: my };
      setCurrentDraftPoints([startPt]);
      draftPointsRef.current = [startPt];
      return;
    }

    if (activeTool === 'SPL' || activeTool === 'POLYLINE' || activeTool === 'POLYGON') {
      // Check if clicking close to the first point of a polygon to close it!
      if (activeTool === 'POLYGON' && currentDraftPoints.length >= 3) {
        const p0 = currentDraftPoints[0];
        const p0Canvas = meterToCanvas(p0.x, p0.y);
        const distPx = Math.hypot(px - p0Canvas.px, py - p0Canvas.py);
        if (distPx < 25) {
          handleCommitFeature();
          return;
        }
      }

      // Check if clicking close to the last point (ignore accidental rapid double-click in same spot)
      if (currentDraftPoints.length > 0) {
        const lastPt = currentDraftPoints[currentDraftPoints.length - 1];
        if (Math.hypot(mx - lastPt.x, my - lastPt.y) < 0.04) {
          return;
        }
      }

      setIsDrawing(true);
      setCurrentDraftPoints((prev) => {
        const next = [...prev, { x: mx, y: my }];
        draftPointsRef.current = next;
        return next;
      });
    }
  };

  // Canvas Pointer Move (Smooth freehand pencil and dynamic cursor update)
  const handleCanvasPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const { mx, my } = getEventMeterPoint(e);
    setCursorMeters({ x: mx, y: my });

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (activeTool === 'ERASE' && isDrawing) {
      handleEraseAtPoint(mx, my);
      return;
    }

    if (activeTool === 'PENCIL' && isDrawing) {
      setCurrentDraftPoints((prev) => {
        if (prev.length === 0) return [{ x: mx, y: my }];
        const last = prev[prev.length - 1];
        if (Math.hypot(mx - last.x, my - last.y) >= 0.03) {
          const next = [...prev, { x: mx, y: my }];
          draftPointsRef.current = next;
          return next;
        }
        return prev;
      });
    }
  };

  // Canvas Pointer Up
  const handleCanvasPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isPanning) {
      setIsPanning(false);
      try {
        (e.currentTarget as Element)?.releasePointerCapture?.(e.pointerId);
      } catch {}
    }
    if (activeTool === 'ERASE') {
      setIsDrawing(false);
    }
    if (activeTool === 'PENCIL' && isDrawing) {
      try {
        (e.currentTarget as Element)?.releasePointerCapture?.(e.pointerId);
      } catch {}
      const pts = draftPointsRef.current;
      if (pts.length >= 2) {
        handleCommitFeature(pts);
      } else {
        setIsDrawing(false);
        setCurrentDraftPoints([]);
        draftPointsRef.current = [];
      }
    }
  };

  // Touch Gesture Handlers (2-finger pinch-to-zoom & pan)
  const handleCanvasTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      touchStartDistRef.current = dist;
      touchStartZoomRef.current = zoom;
      touchStartPanRef.current = { ...pan };
      touchStartCenterRef.current = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      };
      if (activeTool === 'PENCIL') {
        setIsDrawing(false);
        setCurrentDraftPoints([]);
        draftPointsRef.current = [];
      }
      return;
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 2 && touchStartDistRef.current && touchStartDistRef.current > 0) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const curDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const ratio = curDist / touchStartDistRef.current;
      const nextZoom = Math.max(0.4, Math.min(4.0, Number((touchStartZoomRef.current * ratio).toFixed(2))));
      setZoom(nextZoom);

      const curCenter = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      };
      setPan({
        x: touchStartPanRef.current.x + (curCenter.x - touchStartCenterRef.current.x),
        y: touchStartPanRef.current.y + (curCenter.y - touchStartCenterRef.current.y),
      });
      return;
    }
  };

  const handleCanvasTouchEnd = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length < 2) {
      touchStartDistRef.current = null;
    }
  };

  // Mouse wheel and trackpad zoom with pinch support
  const handleCanvasWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const zoomFactor = e.ctrlKey ? (e.deltaY < 0 ? 1.05 : 0.95) : (e.deltaY < 0 ? 1.12 : 0.89);
    setZoom((z) => Math.max(0.4, Math.min(4.0, Number((z * zoomFactor).toFixed(2)))));
  };


  // Clear Canvas (fully undoable via undo stack)
  const handleClearFaceCanvas = () => {
    pushUndo([], []);
    setSelectedFeatureId(null);
    setSelectedSampleId(null);
  };

  // Exports
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

  const selectedFeature = useMemo(
    () => features.find((f) => f.id === selectedFeatureId) || null,
    [features, selectedFeatureId]
  );

  const selectedSample = useMemo(
    () => channelSamples.find((s) => s.id === selectedSampleId) || null,
    [channelSamples, selectedSampleId]
  );

  return (
    <div className="min-h-dvh h-dvh w-full flex flex-col bg-slate-950 text-slate-100 font-mono select-none overflow-hidden relative">
      <EswaAppBackgroundWatermark visible showLogoWatermark={false} />

      {/* ====================================================================== */}
      {/* 1. TOP CAD ENGINEERING RIBBON BAR                                      */}
      {/* ====================================================================== */}
      <header className="flex-none py-2 px-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 z-20 shadow-md">
        {/* Left: Heading Info & Return Button */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBackToMainWindow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-400 border border-slate-700 hover:border-amber-500/50 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Return to Mining Main Window"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Main Window</span>
          </button>

          <div className="h-5 w-px bg-slate-800 hidden sm:block" />

          {/* Heading Information Badge */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Pickaxe className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                <span>{driftId}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                  {chainage}
                </span>
                <span className="text-slate-400 font-normal hidden md:inline text-[11px]">
                  · {mineLevel} · Az {headingAzimuth}°
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-semibold truncate hidden lg:block">
                Lode: <span className="text-slate-200">{oreBodyName}</span> (Cutoff: {cutoffGrade.toFixed(2)} g/t)
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSetupWizardOpen(true)}
              className="ml-1 p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-300 text-[10px] font-bold border border-slate-700 transition-all"
              title="Change Drift / Face Geometry / Profile"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center: TOP WORKING TABS */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto max-w-full">
          {[
            { id: 'CANVAS' as const, label: 'Face Canvas', icon: PenTool, badge: null, color: 'text-amber-400' },
            { id: 'GRADES' as const, label: 'Grades & Dilution', icon: TrendingUp, badge: `${composites.weightedGrade}g/t`, color: 'text-emerald-400' },
            { id: 'CHANNELS' as const, label: 'Channel Assays', icon: Scissors, badge: `${channelSamples.length}`, color: 'text-cyan-400' },
            { id: 'STRUCTURE' as const, label: 'Structural Geology', icon: Compass, badge: `${features.filter((f) => f.featureType === 'FAULT' || f.featureType === 'JOINT').length}`, color: 'text-purple-400' },
            { id: 'GEOTECH' as const, label: 'Geotech Stability', icon: Shield, badge: `${mrmrResult.designMrmr} MRMR`, color: 'text-amber-300' },
            { id: 'EXPORTS' as const, label: 'Mine Exports', icon: FileDown, badge: 'DXF/CSV', color: 'text-rose-400' },
          ].map((win) => {
            const isAct = activeWorkingWindow === win.id;
            const Icon = win.icon;
            return (
              <button
                key={win.id}
                type="button"
                onClick={() => setActiveWorkingWindow(win.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  isAct
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isAct ? 'text-slate-950' : win.color}`} />
                <span>{win.label}</span>
                {win.badge && (
                  <span
                    className={`text-[9.5px] px-1 py-0.2 rounded font-black ${
                      isAct ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {win.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Actions & Save */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveStopeData}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-sm active:scale-95 ${
              saveStatus === 'SAVED'
                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black border-amber-400'
            }`}
            title="Save Face Vectors, Samples and Muck Verdict"
          >
            {saveStatus === 'SAVED' ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{saveStatus === 'SAVED' ? 'Face Saved!' : 'Save Face'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsStorageModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 transition-all cursor-pointer"
            title="Open Mining Storage Vault"
          >
            <Database className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xl:inline">Vault</span>
          </button>
        </div>
      </header>

      {/* ====================================================================== */}
      {/* 2. MAIN CAD BODY WORKSPACE                                             */}
      {/* ====================================================================== */}
      <div className="flex-1 flex overflow-hidden relative">
        {activeWorkingWindow === 'CANVAS' && (
          <>
            {/* ---------------------------------------------------------------- */}
            {/* LEFT DRAWING & MINING FEATURE TOOLBAR                            */}
            {/* ---------------------------------------------------------------- */}
            <aside
              className={`flex-none bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-200 z-10 ${
                isLeftPanelOpen ? 'w-64' : 'w-12'
              }`}
            >
              {/* Header Toggle */}
              <div className="p-2 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-amber-400">
                {isLeftPanelOpen ? (
                  <>
                    <span className="flex items-center gap-1.5">
                      <PenTool className="w-4 h-4" />
                      <span>Mining CAD Tools</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsLeftPanelOpen(false)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                      title="Collapse Panel"
                    >
                      <PanelLeftClose className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsLeftPanelOpen(true)}
                    className="w-full py-1 flex items-center justify-center hover:bg-slate-800 text-amber-400 cursor-pointer"
                    title="Expand Panel"
                  >
                    <PanelLeftOpen className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Panel Contents */}
              {isLeftPanelOpen ? (
                <div className="flex-1 overflow-y-auto p-3 space-y-4 font-mono text-xs">
                  {/* DRAWING MODE SELECTOR */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                      Drawing Tools
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'SELECT' as const, label: 'Select', sub: 'Inspect', icon: MousePointer, color: 'text-slate-300' },
                        { id: 'PENCIL' as const, label: 'Pencil', sub: 'Freehand', icon: Pencil, color: 'text-amber-400' },
                        { id: 'SPL' as const, label: 'Spline', sub: 'Smooth Curve', icon: PenTool, color: 'text-cyan-400' },
                        { id: 'POLYLINE' as const, label: 'Polyline', sub: 'Multi-Point', icon: Ruler, color: 'text-emerald-400' },
                        { id: 'POLYGON' as const, label: 'Polygon', sub: 'Ore / Litho', icon: Layers, color: 'text-purple-400' },
                        { id: 'SYMBOL' as const, label: 'Symbol', sub: 'Geol Stamp', icon: Compass, color: 'text-rose-400' },
                        { id: 'CHANNEL_CUT' as const, label: 'Channel', sub: 'Assay Cut', icon: Scissors, color: 'text-emerald-300' },
                        { id: 'ERASE' as const, label: 'Eraser', sub: 'Delete', icon: Eraser, color: 'text-red-400' },
                        { id: 'PAN' as const, label: 'Pan', sub: 'Drag View', icon: Move, color: 'text-blue-400' },
                      ].map((t) => {
                        const isAct = activeTool === t.id;
                        const Icon = t.icon;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setActiveTool(t.id)}
                            className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                              isAct
                                ? 'bg-amber-500 text-slate-950 font-black border-amber-400 shadow-md ring-1 ring-amber-400'
                                : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <Icon className={`w-3.5 h-3.5 shrink-0 ${isAct ? 'text-slate-950' : t.color}`} />
                              <span className="font-bold text-xs truncate">{t.label}</span>
                            </div>
                            <span
                              className={`text-[9.5px] block truncate mt-0.5 ${
                                isAct ? 'text-slate-900 font-semibold' : 'text-slate-400'
                              }`}
                            >
                              {t.sub}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* GEOLOGICAL FEATURE CLASS SELECTOR (Active when Pencil/SPL/Polyline/Polygon) */}
                  {(activeTool === 'PENCIL' ||
                    activeTool === 'SPL' ||
                    activeTool === 'POLYLINE' ||
                    activeTool === 'POLYGON') && (
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                        Feature Classification:
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'ORE_BOUNDARY' as const, label: 'Ore Vein / Lode', color: 'bg-amber-500' },
                          { id: 'FAULT' as const, label: 'Fault / Shear', color: 'bg-rose-500' },
                          { id: 'JOINT' as const, label: 'Structural Joint', color: 'bg-cyan-500' },
                          { id: 'LITH_CONTACT' as const, label: 'Litho Contact', color: 'bg-emerald-500' },
                          { id: 'ALTERATION_HALO' as const, label: 'Alteration Halo', color: 'bg-purple-500' },
                          { id: 'BRECCIA' as const, label: 'Breccia Zone', color: 'bg-orange-500' },
                        ].map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setFeatureClassification(g.id)}
                            className={`py-1 px-1.5 rounded text-[10.5px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                              featureClassification === g.id
                                ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${g.color}`} />
                            <span className="truncate">{g.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Ore Grade Category Options */}
                      {featureClassification === 'ORE_BOUNDARY' && (
                        <div className="pt-2 border-t border-slate-800 space-y-1.5">
                          <span className="text-[9.5px] font-bold text-amber-400 uppercase tracking-wider block">
                            Ore Grade Category:
                          </span>
                          <div className="grid grid-cols-2 gap-1">
                            {[
                              { id: 'HIGH_GRADE' as const, label: 'High Grade', color: 'bg-rose-500' },
                              { id: 'MEDIUM_GRADE' as const, label: 'Med Grade', color: 'bg-amber-500' },
                              { id: 'LOW_GRADE' as const, label: 'Low Grade', color: 'bg-yellow-500' },
                              { id: 'INTERNAL_WASTE' as const, label: 'Waste Dyke', color: 'bg-slate-500' },
                            ].map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setSelectedOreCategory(c.id)}
                                className={`py-1 px-1 rounded text-[9.5px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                                  selectedOreCategory === c.id
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                                    : 'bg-slate-900 text-slate-400 border-slate-800'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${c.color}`} />
                                <span className="truncate">{c.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* GEOLOGICAL SYMBOL STAMP DRAWER (Active when Tool is SYMBOL) */}
                  {activeTool === 'SYMBOL' && (
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/50 space-y-3">
                      <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                        <Compass className="w-3.5 h-3.5 text-amber-400" />
                        <span>Geological Symbol Stamp</span>
                      </span>

                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'joint' as const, label: 'Joint (J)', color: '#38BDF8' },
                          { id: 'fault' as const, label: 'Fault (FLT)', color: '#DC2626' },
                          { id: 'shear_zone' as const, label: 'Shear (SZ)', color: '#FB7185' },
                          { id: 'bedding' as const, label: 'Bedding (S0)', color: '#22D3EE' },
                          { id: 'foliation' as const, label: 'Foliation (S1)', color: '#A78BFA' },
                          { id: 'vein' as const, label: 'Vein (VN)', color: '#FDE047' },
                          { id: 'water_seepage' as const, label: 'Seepage', color: '#38BDF8' },
                          { id: 'water_flow' as const, label: 'Water Flow', color: '#0EA5E9' },
                        ].map((sym) => (
                          <button
                            key={sym.id}
                            type="button"
                            onClick={() => setSelectedSymbolType(sym.id)}
                            className={`py-1.5 px-2 rounded-lg text-[10.5px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                              selectedSymbolType === sym.id
                                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow font-black'
                                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: sym.color }}
                            />
                            <span className="truncate">{sym.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Strike & Dip Adjustment */}
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                            <span>Strike Azimuth:</span>
                            <span className="text-amber-400 font-bold">{symbolStrikeDeg}°</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            value={symbolStrikeDeg}
                            onChange={(e) => setSymbolStrikeDeg(Number(e.target.value))}
                            className="w-full accent-amber-400 h-1.5 cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[10px] text-slate-300 mb-0.5">
                            <span>Dip Angle:</span>
                            <span className="text-cyan-400 font-bold">{symbolDipDeg}°</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="90"
                            value={symbolDipDeg}
                            onChange={(e) => setSymbolDipDeg(Number(e.target.value))}
                            className="w-full accent-cyan-400 h-1.5 cursor-pointer"
                          />
                        </div>
                      </div>

                      <p className="text-[9.5px] text-slate-400 leading-tight">
                        Click anywhere on the face canvas to stamp symbol with selected orientation.
                      </p>
                    </div>
                  )}

                  {/* STROKE WIDTH & FILL OPACITY SLIDERS */}
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Stroke Width:</span>
                        <span className="text-slate-200 font-bold">{strokeWidthSetting.toFixed(1)}px</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="8"
                        step="0.5"
                        value={strokeWidthSetting}
                        onChange={(e) => setStrokeWidthSetting(Number(e.target.value))}
                        className="w-full accent-amber-400 h-1.5 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Fill Opacity:</span>
                        <span className="text-slate-200 font-bold">{Math.round(fillOpacitySetting * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="0.9"
                        step="0.05"
                        value={fillOpacitySetting}
                        onChange={(e) => setFillOpacitySetting(Number(e.target.value))}
                        className="w-full accent-purple-400 h-1.5 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* PHOTOGRAMMETRY UNDERLAY */}
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Face Photo</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPhoto(!showPhoto)}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          showPhoto ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {showPhoto ? 'Visible' : 'Hidden'}
                      </button>
                    </div>

                    {photoCalibration.imageUrl ? (
                      <div className="space-y-1.5">
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
                          className="w-full accent-cyan-400 h-1.5"
                        />
                      </div>
                    ) : (
                      <label className="block w-full text-center py-2 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-dashed border-slate-700 cursor-pointer text-[10px]">
                        <Upload className="w-3.5 h-3.5 mx-auto mb-1 text-slate-400" />
                        <span>Load Face Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                setPhotoCalibration((p) => ({
                                  ...p,
                                  imageUrl: evt.target?.result as string,
                                  isCalibrated: true,
                                }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              ) : (
                /* Collapsed Icon Bar */
                <div className="py-3 flex flex-col items-center gap-2">
                  {[
                    { id: 'SELECT' as const, icon: MousePointer, color: 'text-slate-400' },
                    { id: 'PENCIL' as const, icon: Pencil, color: 'text-amber-400' },
                    { id: 'SPL' as const, icon: PenTool, color: 'text-cyan-400' },
                    { id: 'POLYLINE' as const, icon: Ruler, color: 'text-emerald-400' },
                    { id: 'POLYGON' as const, icon: Layers, color: 'text-purple-400' },
                    { id: 'SYMBOL' as const, icon: Compass, color: 'text-rose-400' },
                    { id: 'CHANNEL_CUT' as const, icon: Scissors, color: 'text-emerald-300' },
                    { id: 'ERASE' as const, icon: Eraser, color: 'text-red-400' },
                    { id: 'PAN' as const, icon: Move, color: 'text-blue-400' },
                  ].map((t) => {
                    const isAct = activeTool === t.id;
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setIsLeftPanelOpen(true);
                          setActiveTool(t.id);
                        }}
                        className={`p-2 rounded-lg cursor-pointer ${
                          isAct ? 'bg-amber-500 text-slate-950' : `${t.color} hover:bg-slate-800`
                        }`}
                        title={t.id}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>

            {/* ---------------------------------------------------------------- */}
            {/* CENTER INTERACTIVE CAD CANVAS                                    */}
            {/* ---------------------------------------------------------------- */}
            <main className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
              {/* TOP CAD VIEWPORT TOOLBAR */}
              <div className="flex-none px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                {/* Metric Coordinates and Active Profile Status */}
                <div className="flex items-center gap-2.5 text-slate-300">
                  <span className="flex items-center gap-1.5 font-bold text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="truncate">
                      {stopeShape.replace('_', ' ').toUpperCase()} ({stopeWidth.toFixed(1)}m W × {stopeHeight.toFixed(1)}m H)
                    </span>
                  </span>
                  <span className="text-slate-700">|</span>
                  <span className="text-slate-400 hidden sm:inline">
                    Area: <strong className="text-slate-200">{profileMetrics.areaM2} m²</strong>
                  </span>
                  <span className="text-slate-700 hidden sm:inline">|</span>
                  <span className="text-cyan-400 flex items-center gap-1 font-bold">
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>
                      X {cursorMeters.x.toFixed(2)}m, Y {cursorMeters.y.toFixed(2)}m
                    </span>
                  </span>
                </div>

                {/* Viewport Actions: Sample Face, Clear, Undo, Redo, Zoom, Grid, Labels */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleLoadSampleFace}
                    className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40 flex items-center gap-1 cursor-pointer transition-colors"
                    title="Load Pre-mapped Exploration Stope Face Example"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Sample Face</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearFaceCanvas}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 border border-slate-700 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Clear All Canvas Traces & Features"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>

                  <div className="h-4 w-px bg-slate-800" />

                  {/* Undo / Redo */}
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 border border-slate-700 cursor-pointer"
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={redoStack.length === 0}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 border border-slate-700 cursor-pointer"
                    title="Redo (Ctrl+Y)"
                  >
                    <Redo className="w-3.5 h-3.5" />
                  </button>

                  <div className="h-4 w-px bg-slate-800" />

                  {/* Zoom Controls */}
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(4.0, Number((z + 0.15).toFixed(2))))}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] text-slate-400 font-bold w-9 text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1.0);
                      setPan({ x: 0, y: 0 });
                    }}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                    title="Reset Zoom & Pan"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <div className="h-4 w-px bg-slate-800" />

                  {/* Grid Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowGrid(!showGrid)}
                    className={`p-1 rounded border cursor-pointer ${
                      showGrid
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                    title="Toggle CAD Metric Grid"
                  >
                    <Grid className="w-3.5 h-3.5" />
                  </button>

                  {/* Geological Labels Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowLabels(!showLabels)}
                    className={`p-1 rounded border cursor-pointer ${
                      showLabels
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                    title="Toggle Geological Feature Labels"
                  >
                    <Tag className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>


              {/* INTERACTIVE SVG CAD CANVAS AREA */}
              <div className={`flex-1 relative overflow-hidden ${activeTheme.containerBg} flex items-center justify-center p-2 transition-colors duration-150`}>
                {/* Floating Action Banner When In Progress */}
                {isDrawing && currentDraftPoints.length > 0 && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-slate-900/95 border-2 border-amber-500 shadow-2xl flex items-center gap-3 backdrop-blur-md font-mono text-xs animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-slate-200 font-bold">
                        Drafting {activeTool}:
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-black border border-amber-500/40">
                        {currentDraftPoints.length}{' '}
                        {currentDraftPoints.length === 1 ? 'vertex' : 'vertices'}
                      </span>
                    </div>

                    <div className="h-4 w-px bg-slate-700" />

                    <button
                      type="button"
                      onClick={() => handleCommitFeature()}
                      disabled={
                        activeTool === 'POLYGON'
                          ? currentDraftPoints.length < 3
                          : currentDraftPoints.length < 2
                      }
                      className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black flex items-center gap-1 cursor-pointer transition-all shadow"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Finish Feature (Enter / DblClick)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCurrentDraftPoints((prev) => {
                          const next = prev.slice(0, -1);
                          draftPointsRef.current = next;
                          return next;
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center gap-1 cursor-pointer"
                      title="Undo last point (Backspace)"
                    >
                      <Undo className="w-3.5 h-3.5" />
                      <span>Undo Pt</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawing(false);
                        setCurrentDraftPoints([]);
                        draftPointsRef.current = [];
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 font-bold cursor-pointer"
                    >
                      Cancel (Esc)
                    </button>
                  </div>
                )}

                {/* THE SVG VIEWPORT */}
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${canvasW} ${canvasH}`}
                  style={{ backgroundColor: activeTheme.svgBg, touchAction: 'none' }}
                  className={`w-full h-full max-w-[1400px] max-h-[850px] rounded-2xl shadow-2xl border ${activeTheme.border} select-none ${
                    isPanning || isSpacePressed || activeTool === 'PAN'
                      ? 'cursor-grab active:cursor-grabbing'
                      : activeTool === 'ERASE'
                      ? 'cursor-pointer'
                      : activeTool === 'SYMBOL'
                      ? 'cursor-crosshair'
                      : 'cursor-crosshair'
                  }`}
                  onWheel={handleCanvasWheel}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onTouchStart={handleCanvasTouchStart}
                  onTouchMove={handleCanvasTouchMove}
                  onTouchEnd={handleCanvasTouchEnd}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (
                      activeTool === 'SPL' ||
                      activeTool === 'POLYLINE' ||
                      activeTool === 'POLYGON'
                    ) {
                      handleCommitFeature();
                    }
                  }}
                >
                  {/* DEFINITIONS FOR MINING PATTERNS, GRADIENTS & LITHOLOGY */}
                  <defs>
                    <LithologyPatternDefs prefix="min_" />

                    {/* Unexcavated Surrounding Host Rock Strata Pattern */}
                    <pattern id="hostRockPattern" width="28" height="28" patternUnits="userSpaceOnUse">
                      <rect width="28" height="28" fill={activeTheme.hostRockFill} />
                      <line x1="0" y1="14" x2="28" y2="14" stroke={activeTheme.hostRockLines} strokeWidth="1" strokeDasharray="6 8" />
                      <line x1="14" y1="0" x2="14" y2="28" stroke={activeTheme.hostRockLines} strokeWidth="0.8" strokeDasharray="3 9" />
                      <circle cx="8" cy="6" r="0.8" fill={activeTheme.textMuted} />
                      <circle cx="22" cy="20" r="0.8" fill={activeTheme.textMuted} />
                    </pattern>

                    {/* Realistic Excavated Face Rock Gradient */}
                    <linearGradient id="stopeFaceGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={activeTheme.faceGradStart} />
                      <stop offset="40%" stopColor={activeTheme.faceGradMid} />
                      <stop offset="100%" stopColor={activeTheme.faceGradEnd} />
                    </linearGradient>

                    {/* Underground Illumination Overlay */}
                    <radialGradient id="faceIllumination" cx="50%" cy="45%" r="55%">
                      <stop offset="0%" stopColor="#F59E0B" stopOpacity={canvasTheme === 'light' ? '0' : '0.10'} />
                      <stop offset="60%" stopColor="#38BDF8" stopOpacity={canvasTheme === 'light' ? '0' : '0.04'} />
                      <stop offset="100%" stopColor="#0F172A" stopOpacity="0.0" />
                    </radialGradient>

                    {/* Glow filter for boundary and spline */}
                    <filter id="stopeGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#F59E0B" floodOpacity="0.45" />
                    </filter>

                    {/* High Grade Ore: Sparkling Ruby Gold */}
                    <pattern id="oreHighGradePattern" width="16" height="16" patternUnits="userSpaceOnUse">
                      <rect width="16" height="16" fill="#DC2626" fillOpacity="0.55" />
                      <circle cx="4" cy="4" r="1.8" fill="#FCD34D" />
                      <circle cx="12" cy="12" r="1.5" fill="#FDE047" />
                      <circle cx="12" cy="4" r="1.2" fill="#FBBF24" />
                    </pattern>

                    {/* Medium Grade Ore: Amber crystals */}
                    <pattern id="oreMedGradePattern" width="14" height="14" patternUnits="userSpaceOnUse">
                      <rect width="14" height="14" fill="#D97706" fillOpacity="0.5" />
                      <polygon points="7,2 12,7 7,12 2,7" fill="#FDE047" fillOpacity="0.75" />
                    </pattern>

                    {/* Low Grade Mineralization: Pale Yellow */}
                    <pattern id="oreLowGradePattern" width="12" height="12" patternUnits="userSpaceOnUse">
                      <rect width="12" height="12" fill="#EAB308" fillOpacity="0.4" />
                      <circle cx="6" cy="6" r="1.2" fill="#FDE047" />
                    </pattern>

                    {/* Internal Waste Dyke: Diabase / Basaltic hatch */}
                    <pattern id="wasteDykePattern" width="12" height="12" patternUnits="userSpaceOnUse">
                      <rect width="12" height="12" fill="#64748B" fillOpacity="0.5" />
                      <line x1="0" y1="0" x2="12" y2="12" stroke="#334155" strokeWidth="1" />
                    </pattern>

                    {/* Quartz Vein: Crystalline matrix */}
                    <pattern id="quartzVeinPattern" width="14" height="14" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="7" x2="14" y2="7" stroke="#D97706" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1="7" y1="0" x2="7" y2="14" stroke="#D97706" strokeWidth="1" strokeDasharray="3 3" />
                    </pattern>

                    {/* Fault Breccia: Angular fragments */}
                    <pattern id="faultBrecciaPattern" width="16" height="16" patternUnits="userSpaceOnUse">
                      <polygon points="2,2 6,4 4,8" fill="#DC2626" fillOpacity="0.6" />
                      <polygon points="10,10 14,9 12,14" fill="#DC2626" fillOpacity="0.6" />
                    </pattern>
                  </defs>

                  {/* INNER CAD VIEWPORT TRANSFORM GROUP (ZOOM & PAN) */}
                  <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                    {/* 1. Surrounding Unexcavated Host Rock with Strata Hatch Pattern */}
                    <rect
                      x="-1000"
                      y="-1000"
                      width={canvasW + 2000}
                      height={canvasH + 2000}
                      fill={activeTheme.hostRockFill}
                    />
                    <rect
                      x="0"
                      y="0"
                      width={canvasW}
                      height={canvasH}
                      fill="url(#hostRockPattern)"
                      stroke={activeTheme.hostRockStroke}
                      strokeWidth="1"
                    />

                    {/* 2. Excavated Stope Face Rock Interior */}
                    <polygon
                      points={profileMetrics.points
                        .map((p) => {
                          const { px, py } = meterToCanvas(p.x, p.y);
                          return `${px},${py}`;
                        })
                        .join(' ')}
                      fill="url(#stopeFaceGrad)"
                      stroke={activeTheme.faceBorder}
                      strokeWidth="3.2"
                      strokeLinejoin="round"
                    />

                    {/* Underground Illumination Overlay */}
                    <polygon
                      points={profileMetrics.points
                        .map((p) => {
                          const { px, py } = meterToCanvas(p.x, p.y);
                          return `${px},${py}`;
                        })
                        .join(' ')}
                      fill="url(#faceIllumination)"
                      pointerEvents="none"
                    />

                    {/* 3. Metric CAD Grid with high contrast (0.5m minor, 1.0m major) */}
                    {showGrid && (
                      <g opacity={activeTheme.gridOpacity}>
                        {/* Minor 0.5m and Major 1.0m vertical grid lines */}
                        {Array.from({ length: Math.ceil(stopeWidth * 2) + 1 }).map((_, i) => {
                          const xm = i * 0.5;
                          if (xm > stopeWidth) return null;
                          const isMajor = i % 2 === 0;
                          const pB = meterToCanvas(xm, 0);
                          const pT = meterToCanvas(xm, stopeHeight);
                          return (
                            <line
                              key={`grid-x-${i}`}
                              x1={pB.px}
                              y1={pT.py}
                              x2={pB.px}
                              y2={pB.py}
                              stroke={isMajor ? activeTheme.gridMajor : activeTheme.gridMinor}
                              strokeWidth={isMajor ? '1.4' : '0.8'}
                              strokeDasharray={isMajor ? '4 4' : '2 3'}
                            />
                          );
                        })}
                        {/* Minor 0.5m and Major 1.0m horizontal grid lines */}
                        {Array.from({ length: Math.ceil(stopeHeight * 2) + 1 }).map((_, i) => {
                          const ym = i * 0.5;
                          if (ym > stopeHeight) return null;
                          const isMajor = i % 2 === 0;
                          const pL = meterToCanvas(0, ym);
                          const pR = meterToCanvas(stopeWidth, ym);
                          return (
                            <line
                              key={`grid-y-${i}`}
                              x1={pL.px}
                              y1={pL.py}
                              x2={pR.px}
                              y2={pR.py}
                              stroke={isMajor ? activeTheme.gridMajor : activeTheme.gridMinor}
                              strokeWidth={isMajor ? '1.4' : '0.8'}
                              strokeDasharray={isMajor ? '4 4' : '2 3'}
                            />
                          );
                        })}
                      </g>
                    )}

                    {/* 4. Centerline Laser Reference Line (Crown Apex to Floor) */}
                    {(() => {
                      const pTop = meterToCanvas(stopeWidth / 2, stopeHeight);
                      const pBot = meterToCanvas(stopeWidth / 2, 0);
                      return (
                        <g className="pointer-events-none">
                          <line
                            x1={pTop.px}
                            y1={pTop.py}
                            x2={pBot.px}
                            y2={pBot.py}
                            stroke={activeTheme.centerline}
                            strokeWidth="2"
                            strokeDasharray="6 4"
                          />
                          <circle cx={pTop.px} cy={pTop.py} r="4.5" fill={activeTheme.centerline} />
                          <circle cx={pBot.px} cy={pBot.py} r="4.5" fill={activeTheme.centerline} />
                          <text
                            x={pTop.px}
                            y={pTop.py - 14}
                            fill={activeTheme.centerline}
                            stroke={activeTheme.textHalo}
                            strokeWidth="2.5"
                            paintOrder="stroke"
                            fontSize="10"
                            fontWeight="bold"
                            fontFamily="monospace"
                            textAnchor="middle"
                          >
                            CL · CENTERLINE (Apex +{stopeHeight}m)
                          </text>
                        </g>
                      );
                    })()}

                    {/* 5. Grade Reference Line across waist height (1.50m) */}
                    {(() => {
                      const pLeft = meterToCanvas(0, 1.5);
                      const pRight = meterToCanvas(stopeWidth, 1.5);
                      return (
                        <g className="pointer-events-none">
                          <line
                            x1={pLeft.px}
                            y1={pLeft.py}
                            x2={pRight.px}
                            y2={pRight.py}
                            stroke="#EAB308"
                            strokeWidth="1.8"
                            strokeDasharray="6 3"
                            strokeOpacity="0.85"
                          />
                          <text
                            x={pLeft.px + 8}
                            y={pLeft.py - 6}
                            fill="#EAB308"
                            fontSize="9"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            1.50m GRADE LINE (CHANNELS)
                          </text>
                        </g>
                      );
                    })()}

                    {/* Calibrated Orthophoto Underlay (if available) */}
                    {photoCalibration.imageUrl && showPhoto && (
                      <image
                        href={photoCalibration.imageUrl}
                        x={originX}
                        y={originY - stopeHeight * scale}
                        width={stopeWidth * scale}
                        height={stopeHeight * scale}
                        preserveAspectRatio="none"
                        opacity={photoCalibration.opacity}
                      />
                    )}

                    {/* -------------------------------------------------------- */}
                    {/* DRAWN GEOLOGICAL FEATURES (POLYGONS, POLYLINES, SYMBOLS)  */}
                    {/* -------------------------------------------------------- */}
                    {features
                      .filter((f) => f.visible)
                      .map((f) => {
                        const isSelected = selectedFeatureId === f.id;
                        const canvasPts = f.points.map((pt) => meterToCanvas(pt.x, pt.y));

                        // 1. POINT GEOLOGICAL SYMBOL
                        if (f.geometryType === 'POINT' && f.points.length >= 1) {
                          const p0 = canvasPts[0];
                          const symType = (f.lithologyCode || 'joint') as GeologicalSymbolType;
                          const strike = f.strikeDeg ?? 45;
                          const dip = f.dipDeg ?? 65;

                          return (
                            <g
                              key={f.id}
                              transform={`translate(${p0.px}, ${p0.py})`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (activeTool === 'ERASE') {
                                  pushUndo(features.filter((item) => item.id !== f.id), channelSamples);
                                } else {
                                  setSelectedFeatureId(f.id);
                                  setSelectedSampleId(null);
                                }
                              }}
                              className={
                                activeTool === 'SELECT' || activeTool === 'ERASE'
                                  ? 'cursor-pointer group'
                                  : 'pointer-events-none group'
                              }
                            >
                              {/* Selection halo */}
                              {isSelected && (
                                <circle cx="0" cy="0" r="26" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeDasharray="4 2" />
                              )}

                              {/* Geological Symbol Glyph with Strike Rotation */}
                              <g transform={`rotate(${strike})`}>
                                <StructuralGeologicalSymbolGlyph
                                  symbolType={symType}
                                  color={isSelected ? '#FFFFFF' : f.colorHex}
                                  scale={1.3}
                                  dipDeg={dip}
                                />
                              </g>

                              {/* Strike/Dip Text Label */}
                              {showLabels && (
                                <text
                                  x="18"
                                  y="5"
                                  fill={isSelected ? '#FFFFFF' : f.colorHex}
                                  fontSize="10"
                                  fontWeight="bold"
                                  fontFamily="monospace"
                                  className="select-none drop-shadow"
                                >
                                  {dip}°
                                </text>
                              )}
                            </g>
                          );
                        }

                        // 2. CLOSED POLYGON (ORE BODY / ALTERATION / LITHO REGION)
                        if (f.geometryType === 'POLYGON' && f.points.length >= 3) {
                          const dPath = f.isSpline
                            ? pointsToSplinePath(canvasPts, true)
                            : canvasPts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.px},${p.py}`).join(' ') + ' Z';

                          let fillUrl = f.colorHex;
                          if (f.featureType === 'ORE_BOUNDARY') {
                            fillUrl = f.name.includes('High')
                              ? 'url(#oreHighGradePattern)'
                              : f.name.includes('Med')
                              ? 'url(#oreMedGradePattern)'
                              : f.name.includes('Low')
                              ? 'url(#oreLowGradePattern)'
                              : 'url(#wasteDykePattern)';
                          } else if (f.featureType === 'BRECCIA') {
                            fillUrl = 'url(#faultBrecciaPattern)';
                          }

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
                              className={
                                activeTool === 'SELECT' || activeTool === 'ERASE'
                                  ? 'cursor-pointer'
                                  : 'pointer-events-none'
                              }
                            >
                              <path
                                d={dPath}
                                fill={fillUrl}
                                fillOpacity={isSelected ? 0.75 : f.fillOpacity ?? 0.45}
                                stroke={isSelected ? '#FFFFFF' : f.colorHex}
                                strokeWidth={isSelected ? (f.strokeWidth || 3) + 2 : f.strokeWidth || 3}
                                strokeLinejoin="round"
                              />

                              {/* Label at centroid */}
                              {showLabels && (
                                <text
                                  x={canvasPts.reduce((acc, p) => acc + p.px, 0) / canvasPts.length}
                                  y={canvasPts.reduce((acc, p) => acc + p.py, 0) / canvasPts.length}
                                  fill={canvasTheme === 'light' ? '#0F172A' : '#FFFFFF'}
                                  stroke={activeTheme.textHalo}
                                  strokeWidth="3"
                                  paintOrder="stroke"
                                  fontSize="9.5"
                                  fontWeight="black"
                                  fontFamily="monospace"
                                  textAnchor="middle"
                                  className="pointer-events-none select-none"
                                >
                                  {f.name}
                                </text>
                              )}
                            </g>
                          );
                        }

                        // 3. POLYLINE (FAULT, SHEAR, JOINT, CONTACT TRACE)
                        if (f.points.length >= 2) {
                          const dPath = f.isSpline
                            ? pointsToSplinePath(canvasPts, false)
                            : canvasPts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.px},${p.py}`).join(' ');

                          const isFault = f.featureType === 'FAULT';
                          const isShear = f.featureType === 'SHEAR';

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
                              className={
                                activeTool === 'SELECT' || activeTool === 'ERASE'
                                  ? 'cursor-pointer'
                                  : 'pointer-events-none'
                              }
                            >
                              <path
                                d={dPath}
                                fill="none"
                                stroke={isSelected ? '#FFFFFF' : f.colorHex}
                                strokeWidth={isSelected ? (f.strokeWidth || 3) + 2 : f.strokeWidth || 3}
                                strokeDasharray={isFault ? '8 4' : isShear ? '5 2' : undefined}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />

                              {/* Vertex indicator points when selected */}
                              {isSelected &&
                                canvasPts.map((p, pIdx) => (
                                  <circle
                                    key={`v-${pIdx}`}
                                    cx={p.px}
                                    cy={p.py}
                                    r="4"
                                    fill="#FFFFFF"
                                    stroke={f.colorHex}
                                    strokeWidth="2"
                                  />
                                ))}

                              {/* Feature callout label */}
                              {showLabels && canvasPts.length >= 2 && (
                                <text
                                  x={canvasPts[Math.floor(canvasPts.length / 2)].px}
                                  y={canvasPts[Math.floor(canvasPts.length / 2)].py - 8}
                                  fill={isSelected ? '#0284C7' : f.colorHex}
                                  stroke={activeTheme.textHalo}
                                  strokeWidth="3"
                                  paintOrder="stroke"
                                  fontSize="9.5"
                                  fontWeight="bold"
                                  fontFamily="monospace"
                                  textAnchor="middle"
                                  className="pointer-events-none select-none"
                                >
                                  {f.name}
                                </text>
                              )}
                            </g>
                          );
                        }
                        return null;
                      })}

                    {/* -------------------------------------------------------- */}
                    {/* CHANNEL CUT SAMPLES AT WAIST HEIGHT (1.5M)               */}
                    {/* -------------------------------------------------------- */}
                    {channelSamples.length > 0 && (
                      <g>
                        {/* Continuous Reference Cut Line across face */}
                        <line
                          x1={originX}
                          y1={originY - 1.5 * scale}
                          x2={originX + stopeWidth * scale}
                          y2={originY - 1.5 * scale}
                          stroke="#64748B"
                          strokeWidth="1.5"
                          strokeDasharray="4 4"
                          opacity="0.6"
                        />

                        {channelSamples.map((s) => {
                          const p1 = meterToCanvas(s.fromMeter, 1.5);
                          const p2 = meterToCanvas(s.toMeter, 1.5);
                          const midX = (p1.px + p2.px) / 2;
                          const isSelected = selectedSampleId === s.id;
                          const gradeNum = typeof s.assayGrade === 'number' ? s.assayGrade : parseFloat(s.gradeValue) || 0;

                          const chipColor =
                            gradeNum >= cutoffGrade
                              ? '#EF4444'
                              : gradeNum >= cutoffGrade / 2
                              ? '#F59E0B'
                              : '#64748B';

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
                                }
                              }}
                              className={
                                activeTool === 'SELECT' || activeTool === 'ERASE'
                                  ? 'cursor-pointer group'
                                  : 'pointer-events-none group'
                              }
                            >
                              {/* Heavy Sample Line */}
                              <line
                                x1={p1.px}
                                y1={p1.py}
                                x2={p2.px}
                                y2={p2.py}
                                stroke={isSelected ? '#FFFFFF' : chipColor}
                                strokeWidth={isSelected ? 6 : 4}
                                strokeLinecap="round"
                              />

                              {/* Interval End Markers */}
                              <circle cx={p1.px} cy={p1.py} r="4" fill="#FFFFFF" stroke={chipColor} strokeWidth="1.5" />
                              <circle cx={p2.px} cy={p2.py} r="4" fill="#FFFFFF" stroke={chipColor} strokeWidth="1.5" />

                              {/* Sample Callout Tag */}
                              <g transform={`translate(${midX}, ${p1.py - 24})`}>
                                <rect
                                  x="-44"
                                  y="-12"
                                  width="88"
                                  height="22"
                                  rx="5"
                                  fill="#020617"
                                  stroke={isSelected ? '#FFFFFF' : chipColor}
                                  strokeWidth={isSelected ? 2 : 1.2}
                                />
                                <text
                                  x="0"
                                  y="2"
                                  fill="#FFFFFF"
                                  fontSize="9.5"
                                  fontWeight="black"
                                  textAnchor="middle"
                                  fontFamily="monospace"
                                >
                                  {s.sampleNumber}: {gradeNum.toFixed(2)}g/t
                                </text>
                              </g>
                            </g>
                          );
                        })}
                      </g>
                    )}

                    {/* -------------------------------------------------------- */}
                    {/* DRAFTING PREVIEW (WHILE USER IS DRAWING ON CANVAS)       */}
                    {/* -------------------------------------------------------- */}
                    {isDrawing && currentDraftPoints.length > 0 && (() => {
                      const draftCanvasPts = currentDraftPoints.map((p) => meterToCanvas(p.x, p.y));
                      const curCanvas = meterToCanvas(cursorMeters.x, cursorMeters.y);
                      const isSpl = activeTool === 'SPL';
                      const isPolygon = activeTool === 'POLYGON';
                      const previewPts = [...draftCanvasPts, curCanvas];

                      return (
                        <g className="pointer-events-none">
                          {isSpl && draftCanvasPts.length >= 1 ? (
                            <path
                              d={pointsToSplinePath(previewPts, isPolygon)}
                              fill={isPolygon ? 'rgba(239, 68, 68, 0.25)' : 'none'}
                              stroke="#38BDF8"
                              strokeWidth={Math.max(3, strokeWidthSetting)}
                              strokeDasharray="6 3"
                            />
                          ) : isPolygon ? (
                            <polygon
                              points={previewPts.map((p) => `${p.px},${p.py}`).join(' ')}
                              fill="rgba(245, 158, 11, 0.25)"
                              stroke="#F59E0B"
                              strokeWidth={Math.max(2.5, strokeWidthSetting)}
                              strokeDasharray="5 3"
                            />
                          ) : (
                            <>
                              <polyline
                                points={draftCanvasPts.map((p) => `${p.px},${p.py}`).join(' ')}
                                fill="none"
                                stroke="#F59E0B"
                                strokeWidth={Math.max(2.5, strokeWidthSetting)}
                                strokeDasharray={activeTool === 'PENCIL' ? undefined : '5 3'}
                              />
                              {activeTool !== 'PENCIL' && (
                                <line
                                  x1={draftCanvasPts[draftCanvasPts.length - 1].px}
                                  y1={draftCanvasPts[draftCanvasPts.length - 1].py}
                                  x2={curCanvas.px}
                                  y2={curCanvas.py}
                                  stroke="#38BDF8"
                                  strokeWidth="2.5"
                                  strokeDasharray="4 2"
                                />
                              )}
                            </>
                          )}

                          {/* Vertex points with numbers */}
                          {activeTool !== 'PENCIL' &&
                            draftCanvasPts.map((p, idx) => (
                              <g key={`draft-v-${idx}`}>
                                <circle
                                  cx={p.px}
                                  cy={p.py}
                                  r={idx === 0 ? 7 : 5}
                                  fill={idx === 0 ? '#10B981' : '#F59E0B'}
                                  stroke="#FFFFFF"
                                  strokeWidth="2"
                                />
                                <text
                                  x={p.px}
                                  y={p.py - 9}
                                  textAnchor="middle"
                                  fontSize="9"
                                  fontWeight="black"
                                  fill="#FFFFFF"
                                  stroke="rgba(0,0,0,0.8)"
                                  strokeWidth="2"
                                  paintOrder="stroke"
                                >
                                  {idx === 0 ? 'Start (1)' : `${idx + 1}`}
                                </text>
                              </g>
                            ))}

                          {/* Current cursor target dot */}
                          <circle
                            cx={curCanvas.px}
                            cy={curCanvas.py}
                            r="4.5"
                            fill="#38BDF8"
                            stroke="#FFFFFF"
                            strokeWidth="1.5"
                          />
                        </g>
                      );
                    })()}

                    {/* Dynamic Real-Time Crosshair Guides */}
                    {cursorMeters.x >= 0 && cursorMeters.x <= stopeWidth && cursorMeters.y >= 0 && cursorMeters.y <= stopeHeight && (
                      <g className="pointer-events-none" opacity="0.4">
                        {(() => {
                          const cur = meterToCanvas(cursorMeters.x, cursorMeters.y);
                          const bot = meterToCanvas(cursorMeters.x, 0);
                          const left = meterToCanvas(0, cursorMeters.y);
                          return (
                            <>
                              <line x1={cur.px} y1={cur.py} x2={cur.px} y2={bot.py} stroke="#38BDF8" strokeWidth="1" strokeDasharray="3 3" />
                              <line x1={cur.px} y1={cur.py} x2={left.px} y2={cur.py} stroke="#38BDF8" strokeWidth="1" strokeDasharray="3 3" />
                            </>
                          );
                        })()}
                      </g>
                    )}

                    {/* -------------------------------------------------------- */}
                    {/* PERIMETER OUTLINE OF STOPE FACE PROFILE                  */}
                    {/* -------------------------------------------------------- */}
                    <polygon
                      points={profileMetrics.points
                        .map((p) => {
                          const { px, py } = meterToCanvas(p.x, p.y);
                          return `${px},${py}`;
                        })
                        .join(' ')}
                      fill="none"
                      stroke={activeTheme.faceBorder}
                      strokeWidth="3.2"
                      className="pointer-events-none"
                    />

                    {/* Floor Station Line and Tick Marks */}
                    <line
                      x1={originX}
                      y1={originY}
                      x2={originX + stopeWidth * scale}
                      y2={originY}
                      stroke={activeTheme.faceBorder}
                      strokeWidth="3.5"
                    />

                    {/* -------------------------------------------------------- */}
                    {/* PERIMETER 1.00m STATION TICKS AND NUMERIC LABELS          */}
                    {/* -------------------------------------------------------- */}
                    {(() => {
                      const textColor = activeTheme.textMain;
                      const tickColor = activeTheme.tickColor;
                      const haloColor = activeTheme.textHalo;

                      return (
                        <g className="pointer-events-none" fontFamily="monospace">
                          {/* Floor Station Ticks (y = 0) */}
                          {Array.from({ length: Math.ceil(stopeWidth) + 1 }).map((_, i) => {
                            if (i > stopeWidth) return null;
                            const p = meterToCanvas(i, 0);
                            const isCenter = Math.abs(i - stopeWidth / 2) < 0.05;
                            return (
                              <g key={`floor-tick-${i}`}>
                                <line
                                  x1={p.px}
                                  y1={p.py}
                                  x2={p.px}
                                  y2={p.py + (isCenter ? 14 : 8)}
                                  stroke={isCenter ? activeTheme.centerline : tickColor}
                                  strokeWidth={isCenter ? '2.5' : '1.5'}
                                />
                                <text
                                  x={p.px}
                                  y={p.py + (isCenter ? 26 : 20)}
                                  textAnchor="middle"
                                  fontSize="9"
                                  fontWeight="bold"
                                  fill={isCenter ? activeTheme.centerline : textColor}
                                  stroke={haloColor}
                                  strokeWidth="2.5"
                                  paintOrder="stroke"
                                >
                                  {isCenter ? '0m (CL)' : `${i}m`}
                                </text>
                              </g>
                            );
                          })}

                          {/* Left Wall (HW) 1m Ticks (x = 0) */}
                          {Array.from({ length: Math.ceil(wallHeight) + 1 }).map((_, i) => {
                            if (i === 0 || i > wallHeight) return null;
                            const p = meterToCanvas(0, i);
                            return (
                              <g key={`lwall-tick-${i}`}>
                                <line
                                  x1={p.px}
                                  y1={p.py}
                                  x2={p.px - 8}
                                  y2={p.py}
                                  stroke={tickColor}
                                  strokeWidth="1.5"
                                />
                                <text
                                  x={p.px - 12}
                                  y={p.py + 3.5}
                                  textAnchor="end"
                                  fontSize="9"
                                  fontWeight="bold"
                                  fill={textColor}
                                  stroke={haloColor}
                                  strokeWidth="2.5"
                                  paintOrder="stroke"
                                >
                                  +{i}m
                                </text>
                              </g>
                            );
                          })}

                          {/* Right Wall (FW) 1m Ticks (x = stopeWidth) */}
                          {Array.from({ length: Math.ceil(wallHeight) + 1 }).map((_, i) => {
                            if (i === 0 || i > wallHeight) return null;
                            const p = meterToCanvas(stopeWidth, i);
                            return (
                              <g key={`rwall-tick-${i}`}>
                                <line
                                  x1={p.px}
                                  y1={p.py}
                                  x2={p.px + 8}
                                  y2={p.py}
                                  stroke={tickColor}
                                  strokeWidth="1.5"
                                />
                                <text
                                  x={p.px + 12}
                                  y={p.py + 3.5}
                                  textAnchor="start"
                                  fontSize="9"
                                  fontWeight="bold"
                                  fill={textColor}
                                  stroke={haloColor}
                                  strokeWidth="2.5"
                                  paintOrder="stroke"
                                >
                                  +{i}m
                                </text>
                              </g>
                            );
                          })}

                          {/* Wall Labels */}
                          {(() => {
                            const pLW = meterToCanvas(0, wallHeight / 2);
                            const pRW = meterToCanvas(stopeWidth, wallHeight / 2);
                            return (
                              <>
                                <text
                                  x={pLW.px - 28}
                                  y={pLW.py}
                                  textAnchor="middle"
                                  fontSize="8.5"
                                  fontWeight="bold"
                                  fill={activeTheme.faceBorder}
                                  stroke={haloColor}
                                  strokeWidth="2.5"
                                  paintOrder="stroke"
                                  transform={`rotate(-90, ${pLW.px - 28}, ${pLW.py})`}
                                >
                                  HANGINGWALL (HW) · H={wallHeight}m
                                </text>
                                <text
                                  x={pRW.px + 28}
                                  y={pRW.py}
                                  textAnchor="middle"
                                  fontSize="8.5"
                                  fontWeight="bold"
                                  fill={activeTheme.faceBorder}
                                  stroke={haloColor}
                                  strokeWidth="2.5"
                                  paintOrder="stroke"
                                  transform={`rotate(90, ${pRW.px + 28}, ${pRW.py})`}
                                >
                                  FOOTWALL (FW) · H={wallHeight}m
                                </text>
                              </>
                            );
                          })()}
                        </g>
                      );
                    })()}
                  </g>
                </svg>

                {/* Floating Tool Guidance Tooltip Pill at Bottom of Canvas */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-amber-500/40 text-slate-200 text-xs font-mono backdrop-blur-md shadow-xl flex items-center gap-2 pointer-events-none">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span>
                    {activeTool === 'SPL' &&
                      'Spline Mode: Click control points across face. Press Enter, Double-Click, or click "Finish" to complete.'}
                    {activeTool === 'POLYLINE' &&
                      'Polyline Mode: Click vertices along fault/contact. Double-Click or press Enter to finish.'}
                    {activeTool === 'PENCIL' &&
                      'Freehand Mode: Click and drag across the rock face to sketch geological trace. Release to commit.'}
                    {activeTool === 'POLYGON' &&
                      'Polygon Mode: Click points around ore vein/litho zone. Click near first point or press Enter to close.'}
                    {activeTool === 'SYMBOL' &&
                      'Symbol Stamp: Click anywhere on the face canvas to stamp structural strike/dip glyph.'}
                    {activeTool === 'CHANNEL_CUT' &&
                      'Channel Cut: Click at waist height (1.5m) to add an assay interval.'}
                    {activeTool === 'SELECT' &&
                      'Select Mode: Click any geological feature or channel cut to inspect properties on the right panel.'}
                    {activeTool === 'ERASE' &&
                      'Eraser Mode: Click or drag over any feature to remove.'}
                    {activeTool === 'PAN' &&
                      'Pan Mode: Click and drag to pan viewport. Scroll wheel or pinch to zoom.'}
                  </span>
                </div>
              </div>
            </main>

            {/* ---------------------------------------------------------------- */}
            {/* RIGHT GEOTECHNICAL & GRADE INSPECTOR PANEL                       */}
            {/* ---------------------------------------------------------------- */}
            <aside
              className={`flex-none bg-slate-900 border-l border-slate-800 flex flex-col transition-all duration-200 z-10 ${
                isRightPanelOpen ? 'w-80' : 'w-12'
              }`}
            >
              {/* Header Toggle */}
              <div className="p-2 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-amber-400">
                {isRightPanelOpen ? (
                  <>
                    <span className="flex items-center gap-1.5">
                      <Sliders className="w-4 h-4" />
                      <span>Mining Inspector</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsRightPanelOpen(false)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                      title="Collapse Inspector"
                    >
                      <PanelRightClose className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsRightPanelOpen(true)}
                    className="w-full py-1 flex items-center justify-center hover:bg-slate-800 text-amber-400 cursor-pointer"
                    title="Expand Inspector"
                  >
                    <PanelRightOpen className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Inspector Body */}
              {isRightPanelOpen ? (
                <div className="flex-1 overflow-y-auto p-3 space-y-4 font-mono text-xs">
                  {/* SELECTED ELEMENT INSPECTOR */}
                  {selectedFeature ? (
                    <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/50 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                          Feature Properties
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            pushUndo(
                              features.filter((f) => f.id !== selectedFeature.id),
                              channelSamples
                            );
                            setSelectedFeatureId(null);
                          }}
                          className="p-1 rounded hover:bg-rose-500/20 text-rose-400"
                          title="Delete Feature"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <div>
                          <label className="text-[10px] text-slate-400 block">Name:</label>
                          <input
                            type="text"
                            value={selectedFeature.name}
                            onChange={(e) => {
                              const updated = features.map((f) =>
                                f.id === selectedFeature.id ? { ...f, name: e.target.value } : f
                              );
                              setFeatures(updated);
                            }}
                            className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 text-xs"
                          />
                        </div>

                        {selectedFeature.geometryType === 'POINT' ? (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400 block">Strike (°):</label>
                              <input
                                type="number"
                                value={selectedFeature.strikeDeg ?? 45}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setFeatures(
                                    features.map((f) =>
                                      f.id === selectedFeature.id ? { ...f, strikeDeg: val } : f
                                    )
                                  );
                                }}
                                className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 text-xs font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 block">Dip (°):</label>
                              <input
                                type="number"
                                value={selectedFeature.dipDeg ?? 65}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setFeatures(
                                    features.map((f) =>
                                      f.id === selectedFeature.id ? { ...f, dipDeg: val } : f
                                    )
                                  );
                                }}
                                className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 text-xs font-bold"
                              />
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="text-[10px] text-slate-400 block">Classification:</label>
                            <span className="text-xs font-bold text-amber-300 block">
                              {selectedFeature.featureType.replace('_', ' ')} ({selectedFeature.geometryType})
                            </span>
                          </div>
                        )}

                        <div className="pt-1">
                          <label className="text-[10px] text-slate-400 block">Water Condition:</label>
                          <select
                            value={selectedFeature.waterInflow || 'DRY'}
                            onChange={(e) => {
                              const val = e.target.value as 'DRY' | 'DAMP' | 'DRIPPING' | 'FLOWING';
                              setFeatures(
                                features.map((f) =>
                                  f.id === selectedFeature.id ? { ...f, waterInflow: val } : f
                                )
                              );
                            }}
                            className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 text-xs"
                          >
                            <option value="DRY">Dry (0 L/min)</option>
                            <option value="DAMP">Damp</option>
                            <option value="DRIPPING">Dripping</option>
                            <option value="FLOWING">Flowing water</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : selectedSample ? (
                    <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/50 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                          Channel Cut Sample
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            pushUndo(
                              features,
                              channelSamples.filter((s) => s.id !== selectedSample.id)
                            );
                            setSelectedSampleId(null);
                          }}
                          className="p-1 rounded hover:bg-rose-500/20 text-rose-400"
                          title="Delete Sample"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Sample ID:</span>
                          <strong className="text-emerald-300">{selectedSample.sampleNumber}</strong>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Interval:</span>
                          <span className="text-slate-200">
                            {selectedSample.fromMeter}m - {selectedSample.toMeter}m ({selectedSample.sampleLengthMeters}m)
                          </span>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 block">Assay Grade (g/t):</label>
                          <input
                            type="number"
                            step="0.05"
                            value={selectedSample.assayGrade ?? 4.85}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setChannelSamples(
                                channelSamples.map((s) =>
                                  s.id === selectedSample.id
                                    ? { ...s, assayGrade: val, gradeValue: String(val) }
                                    : s
                                )
                              );
                            }}
                            className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-emerald-300 text-sm font-black"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 block">Specific Gravity (SG):</label>
                          <input
                            type="number"
                            step="0.05"
                            value={selectedSample.specificGravity ?? oreSg}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setChannelSamples(
                                channelSamples.map((s) =>
                                  s.id === selectedSample.id ? { ...s, specificGravity: val } : s
                                )
                              );
                            }}
                            className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center text-slate-500 py-4">
                      <MousePointer className="w-5 h-5 mx-auto mb-1 text-slate-600" />
                      <p className="text-[10.5px]">Click any feature or channel sample on the canvas to inspect.</p>
                    </div>
                  )}

                  {/* LIVE FACE GRADE & DILUTION SUMMARY */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Face Grade &amp; Dilution</span>
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    </span>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Face Metric Area:</span>
                        <strong className="text-slate-100">{profileMetrics.areaM2} m²</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Blast Round Volume:</span>
                        <strong className="text-slate-100">{(profileMetrics.areaM2 * blastPull).toFixed(1)} m³</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Total Broken Tonnes:</span>
                        <strong className="text-slate-100">{composites.estimatedTonnesPerRound} t</strong>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                        <span className="text-slate-300 font-bold">Composite Grade:</span>
                        <span className="text-base font-black text-amber-400">
                          {composites.weightedGrade.toFixed(2)} g/t
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Ore Dilution:</span>
                        <strong
                          className={
                            composites.dilutionPercentByMass > 25 ? 'text-rose-400' : 'text-emerald-400'
                          }
                        >
                          {composites.dilutionPercentByMass.toFixed(1)}%
                        </strong>
                      </div>
                    </div>

                    {/* Muck Destination Verdict Badge */}
                    <div className="pt-2 border-t border-slate-800">
                      <span className="text-[9.5px] text-slate-400 block mb-1">Muck Haulage Verdict:</span>
                      <div
                        className={`py-2 px-3 rounded-xl text-center font-black text-xs flex items-center justify-center gap-2 shadow ${
                          composites.verdict === 'MILL'
                            ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-400'
                            : composites.verdict === 'LOW_GRADE_STOCKPILE'
                            ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400'
                            : 'bg-rose-500 text-white ring-2 ring-rose-400'
                        }`}
                      >
                        <Truck className="w-4 h-4 shrink-0" />
                        <span>DESTINATION: {composites.verdict.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  </div>

                  {/* LAUBSCHER MRMR STABILITY QUICK SUMMARY */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center justify-between">
                      <span>Laubscher MRMR Stability</span>
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                    </span>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-400">Design MRMR:</span>
                      <span className="text-sm font-black text-amber-400">
                        {mrmrResult.designMrmr} ({mrmrResult.rockMassClass})
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">HR Limit:</span>
                      <strong className="text-slate-200">{mrmrResult.hydraulicRadiusLimitM}m</strong>
                    </div>
                    <div className="text-[10.5px] text-slate-300 line-clamp-2">
                      {mrmrResult.description}
                    </div>
                  </div>

                  {/* QUICK EXPORTS BUTTONS */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleExportDxf}
                      className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
                    >
                      <FileCode className="w-3.5 h-3.5 text-amber-400" />
                      <span>Export DXF</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Assay CSV</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Collapsed Icon Bar */
                <div className="py-3 flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRightPanelOpen(true)}
                    className="p-2 rounded-lg text-amber-400 hover:bg-slate-800"
                    title="Expand Inspector"
                  >
                    <Sliders className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRightPanelOpen(true)}
                    className="p-2 rounded-lg text-emerald-400 hover:bg-slate-800"
                    title="Grade Control"
                  >
                    <TrendingUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRightPanelOpen(true)}
                    className="p-2 rounded-lg text-amber-300 hover:bg-slate-800"
                    title="Laubscher MRMR"
                  >
                    <Shield className="w-4 h-4" />
                  </button>
                </div>
              )}
            </aside>
          </>
        )}

        {/* ==================================================================== */}
        {/* OTHER FULL DEDICATED WINDOW TABS                                    */}
        {/* ==================================================================== */}
        {activeWorkingWindow === 'GRADES' && (
          <MiningGradesWindow
            driftId={driftId}
            chainage={chainage}
            mineLevel={mineLevel}
            oreBodyName={oreBodyName}
            stopeWidth={stopeWidth}
            stopeHeight={stopeHeight}
            stopeShape={stopeShape}
            blastPull={blastPull}
            setBlastPull={setBlastPull}
            cutoffGrade={cutoffGrade}
            setCutoffGrade={setCutoffGrade}
            oreSg={oreSg}
            setOreSg={setOreSg}
            wasteSg={wasteSg}
            setWasteSg={setWasteSg}
            metalPriceAuOz={metalPriceAuOz}
            setMetalPriceAuOz={setMetalPriceAuOz}
            miningCostPerTonne={miningCostPerTonne}
            setMiningCostPerTonne={setMiningCostPerTonne}
            millingCostPerTonne={millingCostPerTonne}
            setMillingCostPerTonne={setMillingCostPerTonne}
            features={features}
            channelSamples={channelSamples}
            composites={composites}
            onReturnToCanvas={() => setActiveWorkingWindow('CANVAS')}
            onOpenChannels={() => setActiveWorkingWindow('CHANNELS')}
          />
        )}

        {activeWorkingWindow === 'CHANNELS' && (
          <MiningChannelsWindow
            driftId={driftId}
            chainage={chainage}
            mineLevel={mineLevel}
            stopeWidth={stopeWidth}
            stopeHeight={stopeHeight}
            oreSg={oreSg}
            channelSamples={channelSamples}
            setChannelSamples={setChannelSamples}
            pushUndo={pushUndo}
            composites={composites}
            onExportCsv={handleExportCsv}
            onReturnToCanvas={() => setActiveWorkingWindow('CANVAS')}
          />
        )}

        {activeWorkingWindow === 'STRUCTURE' && (
          <MiningStructureWindow
            driftId={driftId}
            chainage={chainage}
            mineLevel={mineLevel}
            headingAzimuth={headingAzimuth}
            setHeadingAzimuth={setHeadingAzimuth}
            features={features}
            setFeatures={setFeatures}
            pushUndo={pushUndo}
            selectedFeatureId={selectedFeatureId}
            setSelectedFeatureId={setSelectedFeatureId}
            onReturnToCanvas={() => setActiveWorkingWindow('CANVAS')}
          />
        )}

        {activeWorkingWindow === 'GEOTECH' && (
          <MiningGeotechWindow
            driftId={driftId}
            chainage={chainage}
            mineLevel={mineLevel}
            stopeWidth={stopeWidth}
            stopeHeight={stopeHeight}
            mrmrBaseRmr={mrmrBaseRmr}
            setMrmrBaseRmr={setMrmrBaseRmr}
            mrmrWeatheringPct={mrmrWeatheringPct}
            setMrmrWeatheringPct={setMrmrWeatheringPct}
            mrmrStressPct={mrmrStressPct}
            setMrmrStressPct={setMrmrStressPct}
            mrmrOrientationPct={mrmrOrientationPct}
            setMrmrOrientationPct={setMrmrOrientationPct}
            mrmrBlastingPct={mrmrBlastingPct}
            setMrmrBlastingPct={setMrmrBlastingPct}
            mrmrResult={mrmrResult}
            miningRqd={miningRqd}
            setMiningRqd={setMiningRqd}
            miningJn={miningJn}
            setMiningJn={setMiningJn}
            miningJr={miningJr}
            setMiningJr={setMiningJr}
            miningJa={miningJa}
            setMiningJa={setMiningJa}
            stressFactorA={stressFactorA}
            setStressFactorA={setStressFactorA}
            jointFactorB={jointFactorB}
            setJointFactorB={setJointFactorB}
            gravityFactorC={gravityFactorC}
            setGravityFactorC={setGravityFactorC}
            mathewsResult={mathewsResult}
            hydraulicRadiusM={profileMetrics.hydraulicRadiusM}
            onReturnToCanvas={() => setActiveWorkingWindow('CANVAS')}
          />
        )}

        {activeWorkingWindow === 'EXPORTS' && (
          <MiningExportsWindow
            driftId={driftId}
            chainage={chainage}
            mineLevel={mineLevel}
            currentStope={currentStope}
            currentProject={currentProject}
            features={features}
            channelSamples={channelSamples}
            composites={composites}
            mrmrResult={mrmrResult}
            mathewsResult={mathewsResult}
            onExportDxf={handleExportDxf}
            onExportCsv={handleExportCsv}
            onOpenPrintModal={() => setIsPrintModalOpen(true)}
            onReturnToCanvas={() => setActiveWorkingWindow('CANVAS')}
          />
        )}
      </div>

      {/* ====================================================================== */}
      {/* MODALS                                                                 */}
      {/* ====================================================================== */}
      {/* 1. Stope Setup Wizard Modal */}
      {isSetupWizardOpen && (
        <MiningFaceSetupWizard
          onCancel={() => setIsSetupWizardOpen(false)}
          onEnterFaceMapping={(newStope) => {
            setIsSetupWizardOpen(false);
            if (newStope) {
              setActiveMiningStopeId(newStope.id);
              setDriftId(newStope.stopeOrDriftId);
              setMineLevel(newStope.mineLevel);
              setOreBodyName(newStope.oreBodyName);
              setCutoffGrade(newStope.targetCutoffGrade ?? 2.50);
              setBlastPull(newStope.blastPullMeters ?? 3.2);
              setStopeWidth(newStope.stopeWidthM ?? 4.8);
              setStopeHeight(newStope.stopeHeightM ?? 4.2);
              setStopeShape(newStope.stopeShape || 'd_arch');
              setWallHeight(newStope.wallHeightM ?? 2.8);
              setHeadingAzimuth(newStope.headingDriveAzimuthDeg ?? 45);
              setChainage(newStope.currentHeadingRdChainage || 'Cut #1');
              setOreSg(newStope.oreSpecificGravity ?? 3.35);
              setWasteSg(newStope.wasteSpecificGravity ?? 2.72);
              setFeatures(newStope.features || []);
              setChannelSamples(newStope.channelSamples || []);
              setSelectedFeatureId(null);
              setSelectedSampleId(null);
              setUndoStack([]);
              setRedoStack([]);
            }
          }}
          initialStope={currentStope}
        />
      )}

      {/* 2. Mining Data Storage Vault Modal */}
      <MiningDataStorageModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
        onDataChanged={() => {
          const nextStopes = loadMiningStopes();
          const nextActiveId = getActiveMiningStopeId();
          const targetStope = nextStopes.find((s) => s.id === nextActiveId) || nextStopes[0];
          if (targetStope) {
            setDriftId(targetStope.stopeOrDriftId);
            setMineLevel(targetStope.mineLevel);
            setOreBodyName(targetStope.oreBodyName);
            setCutoffGrade(targetStope.targetCutoffGrade ?? 2.50);
            setBlastPull(targetStope.blastPullMeters ?? 3.2);
            setStopeWidth(targetStope.stopeWidthM ?? 4.8);
            setStopeHeight(targetStope.stopeHeightM ?? 4.2);
            setStopeShape(targetStope.stopeShape || 'd_arch');
            setWallHeight(targetStope.wallHeightM ?? 2.8);
            setHeadingAzimuth(targetStope.headingDriveAzimuthDeg ?? 45);
            setChainage(targetStope.currentHeadingRdChainage || 'Cut #1');
            setOreSg(targetStope.oreSpecificGravity ?? 3.35);
            setWasteSg(targetStope.wasteSpecificGravity ?? 2.72);
            setFeatures(targetStope.features || []);
            setChannelSamples(targetStope.channelSamples || []);
            setSelectedFeatureId(null);
            setSelectedSampleId(null);
            setUndoStack([]);
            setRedoStack([]);
          }
        }}
      />

      {/* 3. Printable PDF Face Sheet Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto font-mono print:bg-white print:p-0">
          <div className="a4-page w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-950 rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col justify-between gap-4 max-h-[92vh] overflow-y-auto print:max-h-none print:shadow-none print:rounded-none">
            <div className="space-y-4">
              {/* Title Block with Left & Right Logo Fit Boxes */}
              <div className="border-2 border-slate-950 p-3 flex items-center justify-between gap-3">
                {/* Left Logo Box */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className="eswa-logo-fit-box w-[110px] h-[46px] border border-slate-300 rounded bg-white p-1 flex items-center justify-center overflow-hidden">
                    {sheetLogos.left ? (
                      <img
                        src={sheetLogos.left}
                        alt="Left Company Logo"
                        className="max-h-full max-w-full w-auto h-auto object-contain block"
                      />
                    ) : (
                      <span className="text-[9px] font-black text-slate-500 uppercase text-center leading-tight">
                        {currentProject?.mineName || 'MINE LOGO'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 print:hidden">
                    <label className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[8px] font-bold text-slate-700 cursor-pointer">
                      Logo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') {
                              updateSheetLogo('left', reader.result);
                            }
                          };
                          reader.readAsDataURL(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {sheetLogos.left && (
                      <button
                        type="button"
                        onClick={() => updateSheetLogo('left', undefined)}
                        className="px-1 py-0.5 rounded bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[8px] font-bold text-rose-700 cursor-pointer"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Center Title */}
                <div className="text-center flex-1 min-w-0 px-2">
                  <h1 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-950">
                    UNDERGROUND MINING GEOLOGICAL FACE SHEET
                  </h1>
                  <p className="text-[11px] text-slate-700 font-bold mt-0.5 truncate">
                    {currentProject?.projectName || 'Underground Mining Project'} · {currentProject?.mineName || 'Mine Site'}
                  </p>
                  <div className="text-[10px] text-slate-600 font-bold mt-0.5 flex items-center justify-center gap-1.5">
                    <span>Date: {new Date().toLocaleDateString()} · Geologist:</span>
                    <input
                      type="text"
                      value={sheetNames.geologistName}
                      onChange={(e) => updateSheetName('geologistName', e.target.value)}
                      placeholder="Enter Geologist Name..."
                      className="w-36 px-1.5 py-0.2 border-b border-slate-400 bg-transparent text-slate-900 font-bold text-[10px] focus:border-slate-900 outline-none print:border-none print:placeholder-transparent"
                    />
                  </div>
                </div>

                {/* Right Logo Box */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className="eswa-logo-fit-box w-[110px] h-[46px] border border-slate-300 rounded bg-white p-1 flex items-center justify-center overflow-hidden">
                    {sheetLogos.right ? (
                      <img
                        src={sheetLogos.right}
                        alt="Right Company Logo"
                        className="max-h-full max-w-full w-auto h-auto object-contain block"
                      />
                    ) : (
                      <span className="text-[9px] font-black text-slate-500 uppercase text-center leading-tight">
                        GRADE CONTROL
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 print:hidden">
                    <label className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[8px] font-bold text-slate-700 cursor-pointer">
                      Logo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') {
                              updateSheetLogo('right', reader.result);
                            }
                          };
                          reader.readAsDataURL(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {sheetLogos.right && (
                      <button
                        type="button"
                        onClick={() => updateSheetLogo('right', undefined)}
                        className="px-1 py-0.5 rounded bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[8px] font-bold text-rose-700 cursor-pointer"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Stope Location & Metadata Table */}
              <div className="grid grid-cols-4 gap-3 text-xs border border-slate-400 p-3 rounded bg-slate-50">
                <div>
                  <span className="text-slate-500 font-bold block text-[10px] uppercase">Heading / Stope ID:</span>
                  <strong>{driftId}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block text-[10px] uppercase">Mine Level RL:</span>
                  <strong>{mineLevel}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block text-[10px] uppercase">Face Station / Chainage:</span>
                  <strong>{chainage}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block text-[10px] uppercase">Shape / Azimuth:</span>
                  <strong>{stopeShape.toUpperCase()} ({stopeWidth}m×{stopeHeight}m) · {headingAzimuth}°</strong>
                </div>
              </div>

              {/* Face Drawing Preview (Includes Stope Boundary, All Mapped Features, and Channel Samples) */}
              <div className="h-72 border-2 border-slate-900 rounded bg-white flex items-center justify-center p-2">
                <svg viewBox={`0 0 ${canvasW} ${canvasH}`} className="w-full h-full">
                  <LithologyPatternDefs prefix="mining-print" forPrintSheet={true} />
                  {/* Stope Closed Boundary */}
                  <polygon
                    points={profileMetrics.points
                      .map((p) => {
                        const { px, py } = meterToCanvas(p.x, p.y);
                        return `${px},${py}`;
                      })
                      .join(' ')}
                    fill="#F8FAFC"
                    stroke="#0F172A"
                    strokeWidth="3"
                  />

                  {/* Mapped Geological Features (Polygons, Splines, Polylines, Symbols) */}
                  {features
                    .filter((f) => f.visible !== false && f.points && f.points.length > 0)
                    .map((feat) => {
                      const canvasPts = feat.points.map((pt) => meterToCanvas(pt.x, pt.y));
                      if (feat.geometryType === 'POINT') {
                        const pt = canvasPts[0];
                        return (
                          <g key={feat.id} transform={`translate(${pt.px}, ${pt.py})`}>
                            <circle r="5" fill={feat.colorHex || '#DC2626'} stroke="#0F172A" strokeWidth="1.5" />
                            <text y="-8" fontSize="9" fontWeight="bold" textAnchor="middle" fill="#0F172A">
                              {feat.name}
                            </text>
                          </g>
                        );
                      }
                      const isClosed = feat.geometryType === 'POLYGON';
                      const pathData = feat.isSpline
                        ? pointsToSplinePath(canvasPts, isClosed)
                        : canvasPts
                            .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.px.toFixed(1)} ${p.py.toFixed(1)}`)
                            .join(' ') + (isClosed ? ' Z' : '');
                      return (
                        <g key={feat.id}>
                          <path
                            d={pathData}
                            fill={isClosed ? feat.colorHex || '#EF4444' : 'none'}
                            fillOpacity={isClosed ? feat.fillOpacity ?? 0.35 : 0}
                            stroke={feat.colorHex || '#0F172A'}
                            strokeWidth={feat.strokeWidth || 2.5}
                          />
                        </g>
                      );
                    })}

                  {/* Channel Samples Line */}
                  {channelSamples.map((s) => {
                    const p1 = meterToCanvas(s.fromMeter, stopeHeight * 0.45);
                    const p2 = meterToCanvas(s.toMeter, stopeHeight * 0.45);
                    return (
                      <g key={s.id}>
                        <line x1={p1.px} y1={p1.py} x2={p2.px} y2={p2.py} stroke="#DC2626" strokeWidth="4" />
                        <text
                          x={(p1.px + p2.px) / 2}
                          y={p1.py - 8}
                          fill="#000000"
                          fontSize="10"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {s.sampleNumber} ({typeof s.assayGrade === 'number' ? s.assayGrade.toFixed(2) : s.gradeValue}g/t)
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Assays Table */}
              <div className="space-y-1.5">
                <h3 className="font-black text-xs uppercase border-b-2 border-slate-900 pb-1">
                  Channel Sampling Assays &amp; Composite Summary ({features.length} Geological Features • {channelSamples.length} Channels)
                </h3>
                <table className="w-full text-left text-xs border-collapse border border-slate-400">
                  <thead className="bg-slate-200">
                    <tr>
                      <th className="p-1.5 border border-slate-400">Sample ID</th>
                      <th className="p-1.5 border border-slate-400">Interval (m)</th>
                      <th className="p-1.5 border border-slate-400">Assay Grade</th>
                      <th className="p-1.5 border border-slate-400">SG</th>
                      <th className="p-1.5 border border-slate-400">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channelSamples.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-3 text-center text-slate-500 italic">
                          No channel samples recorded on face yet.
                        </td>
                      </tr>
                    ) : (
                      channelSamples.map((s) => (
                        <tr key={s.id}>
                          <td className="p-1.5 border border-slate-400 font-bold">{s.sampleNumber}</td>
                          <td className="p-1.5 border border-slate-400">
                            {s.fromMeter} – {s.toMeter} m
                          </td>
                          <td className="p-1.5 border border-slate-400 font-bold">
                            {typeof s.assayGrade === 'number' ? s.assayGrade.toFixed(2) : s.gradeValue} g/t
                          </td>
                          <td className="p-1.5 border border-slate-400">{s.specificGravity || 3.35}</td>
                          <td className="p-1.5 border border-slate-400 font-bold">{s.zoneCategory || 'ORE'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sign-Off Block & Bottom Actions */}
            <div className="space-y-3 pt-3 border-t-2 border-slate-900">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="border border-slate-400 p-2.5 rounded bg-slate-50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-black uppercase text-slate-600">Mapped By (Mine Geologist)</div>
                    <div className="flex items-center gap-1 print:hidden">
                      <label className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-[9px] font-bold text-slate-700 cursor-pointer">
                        Upload PNG
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              if (typeof reader.result === 'string') {
                                updateSheetSign('geologist', reader.result);
                              }
                            };
                            reader.readAsDataURL(file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {sheetSigns.geologist && (
                        <button
                          type="button"
                          onClick={() => updateSheetSign('geologist', undefined)}
                          className="px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[9px] font-bold text-rose-700 cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={sheetNames.geologistName}
                    onChange={(e) => updateSheetName('geologistName', e.target.value)}
                    placeholder="Enter Mine Geologist Name..."
                    className="w-full mt-1 px-2 py-0.5 rounded bg-white border border-slate-300 font-bold text-slate-900 text-xs focus:border-slate-900 outline-none print:border-none print:bg-transparent print:p-0 print:placeholder-transparent"
                  />
                  <div className="eswa-signature-fit-box h-11 w-full bg-white border border-slate-300 rounded mt-1.5 p-1 flex items-center justify-center overflow-hidden">
                    {sheetSigns.geologist ? (
                      <img
                        src={sheetSigns.geologist}
                        alt="Mine Geologist Signature"
                        className="max-h-full max-w-full w-auto h-auto object-contain block"
                      />
                    ) : (
                      <span className="text-[9px] text-slate-400 italic">Signature / Stamp Area</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 pt-0.5 flex justify-between">
                    <span>Signature &amp; Date</span>
                    <span>{new Date().toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="border border-slate-400 p-2.5 rounded bg-slate-50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-black uppercase text-slate-600">Approved By (Chief Mine Geologist)</div>
                    <div className="flex items-center gap-1 print:hidden">
                      <label className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-[9px] font-bold text-slate-700 cursor-pointer">
                        Upload PNG
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              if (typeof reader.result === 'string') {
                                updateSheetSign('chief', reader.result);
                              }
                            };
                            reader.readAsDataURL(file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {sheetSigns.chief && (
                        <button
                          type="button"
                          onClick={() => updateSheetSign('chief', undefined)}
                          className="px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[9px] font-bold text-rose-700 cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={sheetNames.chiefName}
                    onChange={(e) => updateSheetName('chiefName', e.target.value)}
                    placeholder="Enter Chief Mine Geologist Name..."
                    className="w-full mt-1 px-2 py-0.5 rounded bg-white border border-slate-300 font-bold text-slate-900 text-xs focus:border-slate-900 outline-none print:border-none print:bg-transparent print:p-0 print:placeholder-transparent"
                  />
                  <div className="eswa-signature-fit-box h-11 w-full bg-white border border-slate-300 rounded mt-1.5 p-1 flex items-center justify-center overflow-hidden">
                    {sheetSigns.chief ? (
                      <img
                        src={sheetSigns.chief}
                        alt="Chief Mine Geologist Signature"
                        className="max-h-full max-w-full w-auto h-auto object-contain block"
                      />
                    ) : (
                      <span className="text-[9px] text-slate-400 italic">Signature / Stamp Area</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 pt-0.5 flex justify-between">
                    <span>Signature &amp; Date</span>
                    <span>{new Date().toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 print:hidden">
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
                  className="px-5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / Save A4 PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
