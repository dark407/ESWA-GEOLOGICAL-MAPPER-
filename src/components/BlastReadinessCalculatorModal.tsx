import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BookmarkCheck,
  Calculator,
  CheckCircle2,
  Clock,
  Compass,
  Download,
  FileText,
  FolderOpen,
  History,
  Layers,
  PencilRuler,
  Printer,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  BlastCalcArchFootSupport,
  BlastCalcArchFrameType,
  BlastCalcArchSectionProfile,
  BlastCalcBoltType,
  BlastCalcFaceSupportType,
  BlastCalcForepolingType,
  BlastCalcHistoryRecord,
  BlastCalcInput,
  BlastCalcInvertSupportType,
  BlastCalcMeshSpec,
  BlastCalcResult,
  BlastCalcSavedShape,
  BlastCalcShotcreteMix,
  BlastCalcSupportTier,
  clearBlastCalcHistory,
  computeEarlyAgeShotcreteMpa,
  createDefaultBlastCalcInput,
  createInitialBlastCalcInputWithLastShape,
  deleteBlastCalcShapePreset,
  deleteBlastCalcSnapshot,
  estimateBartonSrfFromStress,
  exportBlastReadinessPdfCertificate,
  exportBlastReadinessWordDoc,
  loadBlastCalcHistory,
  loadBlastCalcSavedShapes,
  runBlastReadinessAnalysis,
  saveBlastCalcShapePreset,
  saveBlastCalcSnapshot,
  saveLastUsedShape,
} from '../engine/blastReadinessCalculatorEngine';
import { createTunnelGeometry } from '../engine/geometryEngine';
import { loadSavedDesignGeometries } from '../engine/projectMemoryEngine';
import {
  ProfileType,
  SavedDesignGeometryRecord,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import { FreeformCustomProfileEditor } from './FreeformCustomProfileEditor';

interface BlastReadinessCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CalcTab = 'shape' | 'rock' | 'support' | 'result';

interface RockQuickPreset {
  id: string;
  label: string;
  rockTypeName: string;
  rqdPct: number;
  ucsMpa: number;
  mi: number;
  qDirect: number;
  jn: number;
  jr: number;
  ja: number;
  jw: number;
  srf: number;
  rmrDirect: number;
  rmrSpacingRating: number;
  rmrCondRating: number;
  rmrWaterRating: number;
  rmrOrientAdj: number;
  wedgeHeightM: number;
}

const ROCK_QUICK_PRESETS: RockQuickPreset[] = [
  {
    id: 'good_granite',
    label: 'Class II · Massive Granite',
    rockTypeName: 'Massive Biotite Granite',
    rqdPct: 84,
    ucsMpa: 135,
    mi: 32,
    qDirect: 18.7,
    jn: 6,
    jr: 2.0,
    ja: 1.0,
    jw: 1.0,
    srf: 1.5,
    rmrDirect: 70,
    rmrSpacingRating: 12,
    rmrCondRating: 22,
    rmrWaterRating: 12,
    rmrOrientAdj: -5,
    wedgeHeightM: 0.9,
  },
  {
    id: 'fair_quartzite',
    label: 'Class III · Jointed Quartzite',
    rockTypeName: 'Quartzite / Schistose Gneiss',
    rqdPct: 58,
    ucsMpa: 65,
    mi: 17,
    qDirect: 2.2,
    jn: 9,
    jr: 2.0,
    ja: 2.0,
    jw: 0.85,
    srf: 2.5,
    rmrDirect: 51,
    rmrSpacingRating: 10,
    rmrCondRating: 18,
    rmrWaterRating: 10,
    rmrOrientAdj: -5,
    wedgeHeightM: 1.6,
  },
  {
    id: 'poor_phyllite',
    label: 'Class IV · Sheared Phyllite',
    rockTypeName: 'Carbonaceous Sheared Phyllite',
    rqdPct: 32,
    ucsMpa: 28,
    mi: 8,
    qDirect: 0.13,
    jn: 12,
    jr: 1.5,
    ja: 4.0,
    jw: 0.66,
    srf: 5.0,
    rmrDirect: 26,
    rmrSpacingRating: 8,
    rmrCondRating: 10,
    rmrWaterRating: 7,
    rmrOrientAdj: -10,
    wedgeHeightM: 2.3,
  },
  {
    id: 'fault_zone',
    label: 'Class V · Fault Gouge / Squeeze',
    rockTypeName: 'Crushed Fault Zone / Gouge',
    rqdPct: 15,
    ucsMpa: 12,
    mi: 6,
    qDirect: 0.025,
    jn: 15,
    jr: 1.0,
    ja: 4.0,
    jw: 0.5,
    srf: 5.0,
    rmrDirect: 12,
    rmrSpacingRating: 5,
    rmrCondRating: 6,
    rmrWaterRating: 4,
    rmrOrientAdj: -10,
    wedgeHeightM: 3.1,
  },
];

const SUPPORT_TIERS: {
  id: BlastCalcSupportTier;
  title: string;
  subtitle: string;
}[] = [
  {
    id: 'none',
    title: 'Unsupported (Bare Rock)',
    subtitle: 'No shotcrete, mesh, bolts, or LG/rib installed behind face',
  },
  {
    id: 'shotcrete_only',
    title: 'Shotcrete Only (Sealing)',
    subtitle: 'Flash/sealing shotcrete applied; no wiremesh, LG/rib, or bolts',
  },
  {
    id: 'mesh_shotcrete_no_bolts',
    title: 'Wiremesh + Shotcrete',
    subtitle: 'Welded/chainlink mesh embedded in shotcrete; bolts deferred',
  },
  {
    id: 'lg_or_rib_shotcrete',
    title: 'LG / Steel Rib + Shotcrete',
    subtitle: 'Lattice Girder or Steel Rib erected & shotcreted; radial bolts pending',
  },
  {
    id: 'partial_bolts_shotcrete',
    title: 'Partial Bolts + Shotcrete',
    subtitle: 'Crown spot/partial bolting + shotcrete (± Mesh/LG/Rib)',
  },
  {
    id: 'full_natm_support',
    title: 'Full NATM Primary Support',
    subtitle: 'Full radial bolt ring + reinforced shotcrete + LG/Rib arch',
  },
];

const ARCH_PROFILE_OPTIONS: {
  frame: BlastCalcArchFrameType;
  profiles: { id: BlastCalcArchSectionProfile; label: string }[];
}[] = [
  {
    frame: 'lattice_girder',
    profiles: [
      { id: 'LG_70_22_32', label: 'LG 70/22/32 (3-Bar Pantex)' },
      { id: 'LG_95_25_32', label: 'LG 95/25/32 (3-Bar Heavy)' },
      { id: 'LG_115_26_36', label: 'LG 115/26/36 (Extra Heavy)' },
    ],
  },
  {
    frame: 'steel_rib_ismb',
    profiles: [
      { id: 'ISMB_150', label: 'ISMB 150 I-Beam Rib' },
      { id: 'HB_160', label: 'HEB 160 H-Beam Rib' },
      { id: 'ISMB_200', label: 'ISMB 200 Heavy I-Beam' },
      { id: 'HEB_200', label: 'HEB 200 Heavy H-Beam' },
    ],
  },
  {
    frame: 'th_yielding_rib',
    profiles: [
      { id: 'TH_21', label: 'TH-21 Yielding Sliding Rib' },
      { id: 'TH_29', label: 'TH-29 Yielding Sliding Rib' },
      { id: 'TH_36', label: 'TH-36 Heavy Yielding Rib' },
    ],
  },
];

const PROFILE_PRESETS: {
  id: ProfileType;
  label: string;
  w: number;
  h: number;
  wallH: number;
  crownR: number;
}[] = [
  { id: 'd_shaped', label: 'D-Shaped', w: 8.4, h: 7.2, wallH: 4.2, crownR: 4.35 },
  { id: 'horseshoe', label: 'Horseshoe', w: 8.6, h: 7.6, wallH: 3.9, crownR: 4.3 },
  { id: 'circular', label: 'Circular', w: 7.5, h: 7.5, wallH: 3.75, crownR: 3.75 },
  { id: 'rectangular', label: 'Box / Flat Roof', w: 7.0, h: 5.5, wallH: 5.5, crownR: 0 },
  { id: 'top_heading', label: 'Top Heading', w: 9.2, h: 5.2, wallH: 1.2, crownR: 4.6 },
];

function formatStandUpTime(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0 min';
  if (hours >= 24 * 365) return '1+ year (Stable)';
  if (hours >= 48) return `${(hours / 24).toFixed(1)} days (${hours.toFixed(0)} hrs)`;
  if (hours >= 1) return `${hours.toFixed(1)} hrs`;
  return `${Math.max(1, Math.round(hours * 60))} min`;
}

function getVerdictTheme(verdict: BlastCalcResult['verdict']) {
  switch (verdict) {
    case 'ALLOWED':
      return {
        border: 'border-emerald-500/60',
        bg: 'bg-emerald-950/50',
        badge: 'bg-emerald-500 text-slate-950',
        text: 'text-emerald-300',
        tag: 'CLEARED FOR BLAST',
        Icon: ShieldCheck,
      };
    case 'ALLOWED_WITH_MIN_SUPPORT':
      return {
        border: 'border-amber-500/60',
        bg: 'bg-amber-950/45',
        badge: 'bg-amber-500 text-slate-950',
        text: 'text-amber-300',
        tag: 'HOLD · UPGRADE SUPPORT FIRST',
        Icon: Wrench,
      };
    case 'ALLOWED_REDUCED_PULL':
      return {
        border: 'border-amber-500/60',
        bg: 'bg-amber-950/45',
        badge: 'bg-amber-400 text-slate-950',
        text: 'text-amber-300',
        tag: 'REDUCE PULL OR ADD SUPPORT',
        Icon: AlertTriangle,
      };
    case 'STRICTLY_NOT_ALLOWED':
    default:
      return {
        border: 'border-rose-500/70',
        bg: 'bg-rose-950/55',
        badge: 'bg-rose-500 text-white',
        text: 'text-rose-300',
        tag: 'NO BLAST · STRICT HOLD',
        Icon: AlertOctagon,
      };
  }
}

export const BlastReadinessCalculatorModal: React.FC<BlastReadinessCalculatorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const initialBoot = useMemo(() => createInitialBlastCalcInputWithLastShape(), []);
  const [input, setInput] = useState<BlastCalcInput>(() => initialBoot.input);
  const [restoredLastShapeAt, setRestoredLastShapeAt] = useState<string | null>(
    initialBoot.restoredLastShapeAt
  );
  const [activeTab, setActiveTab] = useState<CalcTab>('shape');
  const [isCustomDesignerOpen, setIsCustomDesignerOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<BlastCalcHistoryRecord[]>(() =>
    loadBlastCalcHistory()
  );
  const [savedShapes, setSavedShapes] = useState<BlastCalcSavedShape[]>(() =>
    loadBlastCalcSavedShapes()
  );
  const [projectLibraryShapes, setProjectLibraryShapes] = useState<SavedDesignGeometryRecord[]>([]);
  const [newShapeName, setNewShapeName] = useState<string>('');
  const [shapeNotice, setShapeNotice] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Load read-only Project Geometry Library options whenever modal opens
  useEffect(() => {
    if (isOpen) {
      try {
        setProjectLibraryShapes(loadSavedDesignGeometries());
      } catch {
        setProjectLibraryShapes([]);
      }
    }
  }, [isOpen]);

  // Automatically remember the previous tunnel shape & cover stress whenever geometry/stress changes
  useEffect(() => {
    saveLastUsedShape(input.geometry, {
      overburdenM: input.overburdenM,
      unitWeightKnM3: input.unitWeightKnM3,
      k0Ratio: input.k0Ratio,
      esr: input.esr,
    });
  }, [input.geometry, input.overburdenM, input.unitWeightKnM3, input.k0Ratio, input.esr]);

  const result = useMemo(() => runBlastReadinessAnalysis(input), [input]);
  const srfStressEstimate = useMemo(
    () =>
      estimateBartonSrfFromStress(
        input.ucsMpa,
        result.inSituVerticalStressMpa,
        input.k0Ratio,
        result.sigmaCmMpa
      ),
    [input.ucsMpa, result.inSituVerticalStressMpa, input.k0Ratio, result.sigmaCmMpa]
  );

  const isolatedDesignerSettings = useMemo<TunnelSettings>(
    () => ({
      projectName: 'Standalone Blast Readiness Calculator',
      tunnelName: input.scenarioLabel || 'Tunnel Heading',
      location: input.chainageLabel || 'CH 0+000',
      driveDirectionInput: 'N 045°',
      driveDirection: 45,
      chainage: input.chainageLabel || 'CH 0+000',
      faceChainage: input.chainageLabel || 'CH 0+000',
      roundLength: input.requiredNextPullM || 2.5,
      date: new Date().toISOString().slice(0, 10),
      mappedBy: input.geologistName || 'Shift Geologist',
      lithology: input.rockTypeName || 'Rock Mass',
    }),
    [input.scenarioLabel, input.chainageLabel, input.requiredNextPullM, input.geologistName, input.rockTypeName]
  );

  if (!isOpen) return null;

  const verdictTheme = getVerdictTheme(result.verdict);
  const VerdictIcon = verdictTheme.Icon;

  const updateField = <K extends keyof BlastCalcInput>(key: K, value: BlastCalcInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
  };

  const handleSelectSupportTier = (tier: BlastCalcSupportTier) => {
    setInput((prev) => {
      let nextArchType = prev.archFrameType ?? 'none';
      let nextArchProfile = prev.archSectionProfile ?? 'LG_95_25_32';
      let nextScMm = prev.shotcreteThicknessMm;
      let nextMesh = prev.wiremeshSpec;
      if (tier === 'lg_or_rib_shotcrete') {
        if (nextArchType === 'none') {
          nextArchType = 'lattice_girder';
          nextArchProfile = 'LG_95_25_32';
        }
        nextScMm = Math.max(100, prev.shotcreteThicknessMm);
        if (nextMesh === 'none') nextMesh = 'welded_6mm_150';
      } else if (tier === 'mesh_shotcrete_no_bolts' && nextMesh === 'none') {
        nextMesh = 'welded_6mm_150';
        nextScMm = Math.max(75, prev.shotcreteThicknessMm);
      } else if (tier === 'full_natm_support') {
        nextScMm = Math.max(150, prev.shotcreteThicknessMm);
        if (nextMesh === 'none') nextMesh = 'welded_8mm_150';
      }
      return {
        ...prev,
        supportTier: tier,
        archFrameType: nextArchType,
        archSectionProfile: nextArchProfile,
        hasLatticeGirder: nextArchType !== 'none',
        shotcreteThicknessMm: nextScMm,
        wiremeshSpec: nextMesh,
      };
    });
  };

  const handleSelectArchFrameType = (frame: BlastCalcArchFrameType) => {
    const group = ARCH_PROFILE_OPTIONS.find((g) => g.frame === frame);
    const defaultProfile: BlastCalcArchSectionProfile = group
      ? group.profiles[0].id
      : 'LG_95_25_32';
    setInput((prev) => ({
      ...prev,
      archFrameType: frame,
      archSectionProfile: defaultProfile,
      hasLatticeGirder: frame !== 'none',
      supportTier:
        frame !== 'none' &&
        (prev.supportTier === 'none' ||
          prev.supportTier === 'shotcrete_only' ||
          prev.supportTier === 'mesh_shotcrete_no_bolts')
          ? 'lg_or_rib_shotcrete'
          : prev.supportTier,
    }));
  };

  const handleSelectProfilePreset = (preset: (typeof PROFILE_PRESETS)[number]) => {
    const geom = createTunnelGeometry(
      preset.w,
      preset.h,
      preset.wallH,
      preset.id,
      preset.crownR,
      'manual'
    );
    setInput((prev) => ({ ...prev, geometry: geom }));
  };

  const handleUpdateDimension = (
    dim: 'width' | 'height' | 'wallHeight' | 'crownRadius',
    val: number
  ) => {
    if (!Number.isFinite(val)) return;
    const g = input.geometry;
    const nextW = dim === 'width' ? Math.max(1.5, val) : g.width;
    const nextH = dim === 'height' ? Math.max(1.5, val) : g.height;
    const nextWallH =
      dim === 'wallHeight' ? Math.max(0, Math.min(nextH - 0.3, val)) : g.wallHeight;
    const nextCrownR = dim === 'crownRadius' ? Math.max(0, val) : g.crownRadius;
    const updatedGeom = createTunnelGeometry(
      nextW,
      nextH,
      nextWallH,
      g.crownGeometry,
      nextCrownR,
      'manual'
    );
    setInput((prev) => ({ ...prev, geometry: updatedGeom }));
  };

  const handleSaveCurrentShapePreset = () => {
    const fallbackName =
      newShapeName.trim() ||
      input.geometry.profileName ||
      `${input.scenarioLabel} (${input.geometry.width.toFixed(1)}×${input.geometry.height.toFixed(1)}m)`;
    const next = saveBlastCalcShapePreset(fallbackName, input.geometry, {
      overburdenM: input.overburdenM,
      unitWeightKnM3: input.unitWeightKnM3,
      k0Ratio: input.k0Ratio,
      esr: input.esr,
    });
    setSavedShapes(next);
    setNewShapeName('');
    setShapeNotice(`Saved shape "${fallbackName}" for 1-click recall.`);
    setTimeout(() => setShapeNotice(null), 2800);
  };

  const handleApplySavedShape = (rec: BlastCalcSavedShape) => {
    setInput((prev) => ({
      ...prev,
      geometry: JSON.parse(JSON.stringify(rec.geometry)),
      overburdenM: rec.overburdenM ?? prev.overburdenM,
      unitWeightKnM3: rec.unitWeightKnM3 ?? prev.unitWeightKnM3,
      k0Ratio: rec.k0Ratio ?? prev.k0Ratio,
      esr: rec.esr ?? prev.esr,
    }));
    setShapeNotice(`Loaded saved tunnel shape "${rec.name}".`);
    setTimeout(() => setShapeNotice(null), 2600);
  };

  const handleApplyRockPreset = (preset: RockQuickPreset) => {
    setInput((prev) => ({
      ...prev,
      rockTypeName: preset.rockTypeName,
      rqdPct: preset.rqdPct,
      ucsMpa: preset.ucsMpa,
      mi: preset.mi,
      qDirect: preset.qDirect,
      jn: preset.jn,
      jr: preset.jr,
      ja: preset.ja,
      jw: preset.jw,
      srf: preset.srf,
      rmrDirect: preset.rmrDirect,
      rmrSpacingRating: preset.rmrSpacingRating,
      rmrCondRating: preset.rmrCondRating,
      rmrWaterRating: preset.rmrWaterRating,
      rmrOrientAdj: preset.rmrOrientAdj,
      wedgeHeightM: preset.wedgeHeightM,
      gsiOverride: null,
    }));
  };

  const handleSyncRmrFromQ = () => {
    const estimatedRmr = Math.max(
      5,
      Math.min(95, Math.round(9 * Math.log(Math.max(0.001, result.qIndex)) + 44))
    );
    setInput((prev) => ({
      ...prev,
      rmrInputMode: 'direct',
      rmrDirect: estimatedRmr,
    }));
  };

  const handleSaveSnapshot = () => {
    const next = saveBlastCalcSnapshot(input, result);
    setHistoryRecords(next);
    setSaveToast('Scenario & calculation report saved to local history log.');
    setTimeout(() => setSaveToast(null), 3200);
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportBlastReadinessPdfCertificate(input, result);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Compute SVG path for Tunnel Cross-Section preview
  const crossSectionSvg = (() => {
    const pts = input.geometry.crossSectionPoints || [];
    const fallbackW = Math.max(2, input.geometry.width || 8.4);
    const fallbackH = Math.max(2, input.geometry.height || 7.2);
    const xs = pts.length >= 3 ? pts.map((p) => p.x) : [-fallbackW / 2, fallbackW / 2];
    const ys = pts.length >= 3 ? pts.map((p) => p.y) : [0, fallbackH];
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const vbW = 320;
    const vbH = 210;
    const pad = 26;
    const scale = Math.min((vbW - pad * 2) / spanX, (vbH - pad * 2) / spanY);
    const offsetX = (vbW - spanX * scale) / 2;
    const offsetY = (vbH - spanY * scale) / 2;
    const mapX = (x: number) => offsetX + (x - minX) * scale;
    const mapY = (y: number) => vbH - (offsetY + (y - minY) * scale);

    let d = '';
    if (pts.length >= 3) {
      d =
        pts
          .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${mapX(p.x).toFixed(1)} ${mapY(p.y).toFixed(1)}`)
          .join(' ') + ' Z';
    } else {
      d = `M ${mapX(-fallbackW / 2)} ${mapY(0)} L ${mapX(-fallbackW / 2)} ${mapY(
        fallbackH * 0.6
      )} Q ${mapX(0)} ${mapY(fallbackH * 1.15)} ${mapX(fallbackW / 2)} ${mapY(
        fallbackH * 0.6
      )} L ${mapX(fallbackW / 2)} ${mapY(0)} Z`;
    }
    return {
      d,
      vbW,
      vbH,
      leftX: mapX(minX),
      rightX: mapX(maxX),
      topY: mapY(maxY),
      botY: mapY(minY),
      midX: (mapX(minX) + mapX(maxX)) / 2,
    };
  })();

  // Compute SVG Log-Log Stand-Up Time Chart coordinates
  const standUpChart = (() => {
    const W = 540;
    const H = 215;
    const padL = 56;
    const padR = 20;
    const padT = 18;
    const padB = 34;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const pts = result.standUpCurvePoints;
    const minSpan = 1.0;
    const maxSpan = Math.max(12, result.postBlastActiveSpanM + 2);
    const minLogH = -1;
    const maxLogH = 4;

    const xForSpan = (s: number) =>
      padL + Math.max(0, Math.min(1, (s - minSpan) / (maxSpan - minSpan))) * plotW;
    const yForHrs = (h: number) => {
      const lh = Math.max(minLogH, Math.min(maxLogH, Math.log10(Math.max(0.05, h))));
      const frac = (lh - minLogH) / (maxLogH - minLogH);
      return padT + (1 - frac) * plotH;
    };

    const unsupPath = pts
      .map(
        (p, idx) =>
          `${idx === 0 ? 'M' : 'L'} ${xForSpan(p.spanM).toFixed(1)} ${yForHrs(
            p.unsupportedHours
          ).toFixed(1)}`
      )
      .join(' ');
    const supPath = pts
      .map(
        (p, idx) =>
          `${idx === 0 ? 'M' : 'L'} ${xForSpan(p.spanM).toFixed(1)} ${yForHrs(
            p.supportedHours
          ).toFixed(1)}`
      )
      .join(' ');

    return {
      W,
      H,
      padL,
      padR,
      padT,
      padB,
      plotW,
      plotH,
      xForSpan,
      yForHrs,
      unsupPath,
      supPath,
      maxSpan,
    };
  })();

  const earlyAgeMpa = computeEarlyAgeShotcreteMpa(
    input.shotcreteAgeHours,
    input.shotcreteMix
  );

  const tabs: {
    id: CalcTab;
    num: string;
    label: string;
    Icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'shape', num: '01', label: 'Shape & Stress', Icon: PencilRuler },
    { id: 'rock', num: '02', label: 'Pull & Rock Mass', Icon: Compass },
    { id: 'support', num: '03', label: 'LG, Rib & Support', Icon: Layers },
    { id: 'result', num: '04', label: 'Analysis & Report', Icon: Activity },
  ];

  // If Custom Tunnel Designer overlay is open inside the calculator
  if (isCustomDesignerOpen) {
    return (
      <div className="fixed inset-0 z-[95] bg-[#090D16] flex flex-col overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <Calculator className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold text-slate-100 uppercase tracking-wider">
              Standalone Blast Calculator · Custom Tunnel Shape Designer
            </span>
          </div>
          <span className="text-[11px] font-mono text-cyan-400">
            Isolated from NATM Project Geometry (Auto-Remembered in Calculator)
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <FreeformCustomProfileEditor
            geometry={input.geometry}
            settings={isolatedDesignerSettings}
            savedGeometries={[]}
            chainageSchedule={[]}
            initialTab="common_variants"
            onApplyGeometry={(nextGeometry: TunnelGeometry) => {
              setInput((prev) => ({ ...prev, geometry: nextGeometry }));
              setIsCustomDesignerOpen(false);
            }}
            onSaveToGeometryLibrary={() => {}}
            onDeleteSavedGeometry={() => {}}
            onUpdateChainageSchedule={() => {}}
            onBack={() => setIsCustomDesignerOpen(false)}
          />
        </div>
      </div>
    );
  }

  const activeArchGroup = ARCH_PROFILE_OPTIONS.find(
    (g) => g.frame === (input.archFrameType ?? 'none')
  );

  return (
    <>
      {/* MAIN INTERACTIVE CALCULATOR MODAL (HIDDEN WHEN PRINTING) */}
      <div className="fixed inset-0 z-[90] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:hidden">
        <div className="w-full max-w-[1280px] h-[94dvh] bg-[#090D16] border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
          {/* TOP COMMAND HEADER */}
          <header className="px-4 py-3 bg-[#0F172A] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center shrink-0">
                <Calculator className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-50 truncate">
                    Next-Blast Clearance &amp; Stand-Up Time Calculator
                  </h2>
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono font-semibold text-cyan-300 uppercase whitespace-nowrap">
                    RMR89 + Barton Q-ESR + Hoek-Brown CCM + LG/Rib
                  </span>
                </div>
                <p className="text-[11px] font-mono text-slate-400 truncate">
                  {input.scenarioLabel} · {input.chainageLabel} · Span {input.geometry.width.toFixed(2)}m ×{' '}
                  {input.geometry.height.toFixed(2)}m · Cover H={input.overburdenM}m (P₀={result.inSituVerticalStressMpa} MPa) · Q={result.qIndex} · RMR={result.rmr89} · Cap{' '}
                  {result.totalInstalledCapacityKpa} kPa
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('result')}
                className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-mono font-bold cursor-pointer whitespace-nowrap ${verdictTheme.border} ${verdictTheme.bg} ${verdictTheme.text}`}
                title="Jump to Clearance Verdict & Calculation Report"
              >
                <VerdictIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{verdictTheme.tag}</span>
                <span className="text-slate-400">·</span>
                <span className="tabular-nums">FoS {result.postBlastFos.toFixed(2)}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsHistoryOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
                title="Open Saved Blast Clearance History Log"
              >
                <History className="w-3.5 h-3.5 text-cyan-400" />
                <span>History ({historyRecords.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const fresh = createDefaultBlastCalcInput();
                  setInput(fresh);
                  setRestoredLastShapeAt(null);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer whitespace-nowrap shrink-0"
                title="Reset all fields to standard baseline"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 cursor-pointer whitespace-nowrap shrink-0"
              >
                <X className="w-4 h-4" />
                <span>Close</span>
              </button>
            </div>
          </header>

          {/* STEP NAVIGATION TABS */}
          <nav className="px-4 py-2 bg-[#0B111E] border-b border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            {tabs.map((t) => {
              const Icon = t.Icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
                      : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isActive ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {t.num}
                  </span>
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.label}</span>
                </button>
              );
            })}

            <div className="ml-auto hidden lg:flex items-center gap-4 text-[11px] font-mono text-slate-400 tabular-nums shrink-0">
              <span>
                Barton D_max:{' '}
                <strong className="text-cyan-300">{result.maxUnsupportedSpanDmaxM}m</strong>
              </span>
              <span>
                Strain:{' '}
                <strong className="text-slate-200">{result.postBlastTunnelStrainPct}%</strong>
              </span>
              <span>
                Stand-Up (No Supp):{' '}
                <strong className="text-amber-300">
                  {formatStandUpTime(result.unsupportedStandUpPostBlastHrs)}
                </strong>
              </span>
              <span>
                Stand-Up (Installed):{' '}
                <strong className="text-emerald-300">
                  {formatStandUpTime(result.supportedStandUpPostBlastHrs)}
                </strong>
              </span>
            </div>
          </nav>

          {/* MAIN WORKSPACE BODY */}
          <div className="flex-1 min-h-0 flex relative overflow-hidden">
            <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* ============================================================
                  TAB 1: SHAPE MEMORY, DIMENSIONS & STRESS REGIME
              ============================================================ */}
              {activeTab === 'shape' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-7 space-y-4">
                    {/* Auto-Restored Banner & Saved Tunnel Shapes Vault */}
                    <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <BookmarkCheck className="w-4 h-4 text-emerald-400" />
                          <div>
                            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-300">
                              Remembered Tunnel Shapes Vault
                            </h3>
                            <p className="text-[11px] text-slate-400">
                              {restoredLastShapeAt
                                ? `Auto-restored last used shape (${new Date(restoredLastShapeAt).toLocaleString()}). Any edit is remembered automatically.`
                                : 'Every shape you design or resize is auto-remembered across sessions.'}
                            </p>
                          </div>
                        </div>
                        {shapeNotice && (
                          <span className="px-2 py-1 rounded bg-emerald-950/70 border border-emerald-500/40 text-[11px] font-mono text-emerald-300">
                            {shapeNotice}
                          </span>
                        )}
                      </div>

                      {/* Save Current Shape Bar */}
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          placeholder="Name current shape (e.g. HRT Adit-2 Custom Arch)"
                          value={newShapeName}
                          onChange={(e) => setNewShapeName(e.target.value)}
                          className="flex-1 min-w-[200px] px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-xs font-mono text-slate-100"
                        />
                        <button
                          type="button"
                          onClick={handleSaveCurrentShapePreset}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-xs font-mono font-bold text-emerald-300 cursor-pointer whitespace-nowrap"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Shape Preset</span>
                        </button>
                      </div>

                      {/* Saved Shape Chips + Project Library Importer */}
                      {(savedShapes.length > 0 || projectLibraryShapes.length > 0) && (
                        <div className="space-y-2 pt-1">
                          {savedShapes.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {savedShapes.map((s) => (
                                <div
                                  key={s.id}
                                  className="inline-flex items-center rounded-lg bg-slate-950 border border-slate-700 overflow-hidden"
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleApplySavedShape(s)}
                                    className="px-2.5 py-1 text-[11px] font-mono text-cyan-300 hover:bg-slate-800 cursor-pointer"
                                    title={`Apply ${s.name} (${s.geometry.width.toFixed(1)}×${s.geometry.height.toFixed(1)}m)`}
                                  >
                                    {s.name} ({s.geometry.width.toFixed(1)}×
                                    {s.geometry.height.toFixed(1)}m)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSavedShapes(deleteBlastCalcShapePreset(s.id))
                                    }
                                    className="px-1.5 py-1 text-slate-400 hover:text-rose-400 hover:bg-slate-900 border-l border-slate-800 cursor-pointer"
                                    title="Remove saved shape"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {projectLibraryShapes.length > 0 && (
                            <div className="flex items-center gap-2 pt-1">
                              <FolderOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  const found = projectLibraryShapes.find(
                                    (g) => g.id === e.target.value
                                  );
                                  if (found) {
                                    setInput((prev) => ({
                                      ...prev,
                                      geometry: JSON.parse(JSON.stringify(found.geometry)),
                                    }));
                                    setShapeNotice(
                                      `Imported "${found.name}" from Project Geometry Library.`
                                    );
                                    setTimeout(() => setShapeNotice(null), 2600);
                                  }
                                }}
                                className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-[11px] font-mono text-slate-200"
                              >
                                <option value="" disabled>
                                  Import Read-Only Shape from Project Geometry Library (
                                  {projectLibraryShapes.length})...
                                </option>
                                {projectLibraryShapes.map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {g.name} · {g.geometry.width.toFixed(2)}×
                                    {g.geometry.height.toFixed(2)}m ({g.tunnelName})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                            Tunnel Profile Geometry &amp; Custom Designer
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            Select a standard shape or customize exact coordinates via Custom Tunnel Designer.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsCustomDesignerOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <PencilRuler className="w-3.5 h-3.5" />
                          <span>Open Custom Tunnel Designer</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {PROFILE_PRESETS.map((p) => {
                          const isSelected = input.geometry.crownGeometry === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleSelectProfilePreset(p)}
                              className={`px-2.5 py-2 rounded-lg border text-xs font-mono font-semibold transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200'
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-mono text-slate-400 mb-1">
                            Excavation Span B (m)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="1.5"
                            max="35"
                            value={input.geometry.width}
                            onChange={(e) =>
                              handleUpdateDimension('width', parseFloat(e.target.value))
                            }
                            className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-sm font-mono tabular-nums text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-mono text-slate-400 mb-1">
                            Total Height H (m)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="1.5"
                            max="35"
                            value={input.geometry.height}
                            onChange={(e) =>
                              handleUpdateDimension('height', parseFloat(e.target.value))
                            }
                            className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-sm font-mono tabular-nums text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-mono text-slate-400 mb-1">
                            Side Wall Height (m)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="30"
                            value={input.geometry.wallHeight}
                            onChange={(e) =>
                              handleUpdateDimension('wallHeight', parseFloat(e.target.value))
                            }
                            className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-sm font-mono tabular-nums text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-mono text-slate-400 mb-1">
                            Crown Radius R (m)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="30"
                            value={input.geometry.crownRadius}
                            onChange={(e) =>
                              handleUpdateDimension('crownRadius', parseFloat(e.target.value))
                            }
                            className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-sm font-mono tabular-nums text-slate-100"
                          />
                        </div>
                      </div>
                    </div>

                    {/* In-Situ Stress & Barton ESR */}
                    <div className="bg-[#0F172A] border border-amber-500/35 rounded-xl p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
                          Overburden Cover Stress Regime &amp; Barton ESR
                        </h3>
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-[11px] font-mono font-bold text-amber-200 tabular-nums">
                          P₀ = {result.inSituVerticalStressMpa} MPa · P_h = {result.inSituHorizontalStressMpa} MPa · σ_cm/P₀ = {result.squeezingRatio}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[11px] font-mono text-slate-400 mb-1">
                            Overburden Depth H (m)
                          </label>
                          <input
                            type="number"
                            step="5"
                            min="5"
                            max="2500"
                            value={input.overburdenM}
                            onChange={(e) =>
                              updateField(
                                'overburdenM',
                                Math.max(5, parseFloat(e.target.value) || 10)
                              )
                            }
                            className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-sm font-mono tabular-nums text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-mono text-slate-400 mb-1">
                            Rock Unit Wt γ (kN/m³)
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="18"
                            max="34"
                            value={input.unitWeightKnM3}
                            onChange={(e) =>
                              updateField(
                                'unitWeightKnM3',
                                Math.max(18, parseFloat(e.target.value) || 26.5)
                              )
                            }
                            className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-sm font-mono tabular-nums text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-mono text-slate-400 mb-1">
                            Stress Ratio K₀
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.3"
                            max="3.0"
                            value={input.k0Ratio}
                            onChange={(e) =>
                              updateField(
                                'k0Ratio',
                                Math.max(0.3, parseFloat(e.target.value) || 1.0)
                              )
                            }
                            className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-sm font-mono tabular-nums text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-mono text-slate-400 mb-1">
                            Barton ESR
                          </label>
                          <select
                            value={String(input.esr)}
                            onChange={(e) => updateField('esr', parseFloat(e.target.value))}
                            className="w-full px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-xs font-mono text-slate-100"
                          >
                            <option value="0.8">0.8 · Powerhouse / Underground Station</option>
                            <option value="1.0">1.0 · Road / Rail / Hydro Headrace</option>
                            <option value="1.3">1.3 · Water Tunnel / Adit</option>
                            <option value="1.6">1.6 · Permanent Mine Openings</option>
                            <option value="3.0">3.0 · Temporary Mine Openings</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Live Tunnel Cross-Section Telemetry Schematic */}
                  <div className="lg:col-span-5 bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                        Live Profile Telemetry
                      </h3>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-cyan-300 uppercase">
                        {input.geometry.profileName || input.geometry.crownGeometry.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="bg-[#070B14] border border-slate-800 rounded-lg p-2 flex items-center justify-center">
                      <svg
                        viewBox={`0 0 ${crossSectionSvg.vbW} ${crossSectionSvg.vbH}`}
                        className="w-full max-w-[340px] h-[210px]"
                      >
                        <defs>
                          <pattern
                            id="blastCalcGrid"
                            width="16"
                            height="16"
                            patternUnits="userSpaceOnUse"
                          >
                            <path
                              d="M 16 0 L 0 0 0 16"
                              fill="none"
                              stroke="#1E293B"
                              strokeWidth="0.6"
                            />
                          </pattern>
                        </defs>
                        <rect
                          x="0"
                          y="0"
                          width={crossSectionSvg.vbW}
                          height={crossSectionSvg.vbH}
                          fill="url(#blastCalcGrid)"
                        />
                        <path
                          d={crossSectionSvg.d}
                          fill="rgba(6, 182, 212, 0.14)"
                          stroke="#06B6D4"
                          strokeWidth="2.2"
                        />
                        <line
                          x1={crossSectionSvg.leftX}
                          y1={crossSectionSvg.botY + 14}
                          x2={crossSectionSvg.rightX}
                          y2={crossSectionSvg.botY + 14}
                          stroke="#F59E0B"
                          strokeWidth="1.2"
                        />
                        <text
                          x={crossSectionSvg.midX}
                          y={crossSectionSvg.botY + 25}
                          textAnchor="middle"
                          fill="#FCD34D"
                          fontSize="11"
                          fontFamily="monospace"
                        >
                          B = {input.geometry.width.toFixed(2)} m
                        </text>
                        <line
                          x1={crossSectionSvg.rightX + 12}
                          y1={crossSectionSvg.topY}
                          x2={crossSectionSvg.rightX + 12}
                          y2={crossSectionSvg.botY}
                          stroke="#38BDF8"
                          strokeWidth="1.2"
                        />
                        <text
                          x={crossSectionSvg.rightX + 16}
                          y={(crossSectionSvg.topY + crossSectionSvg.botY) / 2 + 4}
                          fill="#7DD3FC"
                          fontSize="10"
                          fontFamily="monospace"
                        >
                          H {input.geometry.height.toFixed(2)}m
                        </text>
                      </svg>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-xs font-mono tabular-nums">
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400">EXCAVATION AREA</div>
                        <div className="text-sm font-bold text-slate-100">
                          {result.tunnelAreaM2.toFixed(2)} m²
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400">VERTICAL STRESS P₀</div>
                        <div className="text-sm font-bold text-amber-300">
                          {result.inSituVerticalStressMpa.toFixed(2)} MPa
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400">EQUIV. RADIUS</div>
                        <div className="text-sm font-bold text-slate-100">
                          {result.equivalentRadiusM.toFixed(2)} m
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400">BARTON D_MAX</div>
                        <div className="text-sm font-bold text-cyan-300">
                          {result.maxUnsupportedSpanDmaxM.toFixed(2)} m
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('rock')}
                      className="w-full py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Next: Pull Progress &amp; Rock Mass Inputs</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================
                  TAB 2: PULL ADVANCE & COMBINED ROCK MASS INPUTS
              ============================================================ */}
              {activeTab === 'rock' && (
                <div className="space-y-4">
                  <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                        Heading Details &amp; Quick Ground Calibrations
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {ROCK_QUICK_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => handleApplyRockPreset(preset)}
                            className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-200 cursor-pointer whitespace-nowrap"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          Heading / Scenario Name
                        </label>
                        <input
                          type="text"
                          value={input.scenarioLabel}
                          onChange={(e) => updateField('scenarioLabel', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-xs font-mono text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          Face Chainage
                        </label>
                        <input
                          type="text"
                          value={input.chainageLabel}
                          onChange={(e) => updateField('chainageLabel', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-xs font-mono text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          Shift Engineering Geologist
                        </label>
                        <input
                          type="text"
                          value={input.geologistName}
                          onChange={(e) => updateField('geologistName', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-xs font-mono text-slate-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Overburden Cover & In-Situ Stress (Directly synced with Tab 1) */}
                  <div className="bg-[#0F172A] border border-amber-500/35 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
                          Overburden Cover &amp; In-Situ Lithostatic Stress (Synced with Shape &amp; Stress)
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Drives P₀ = γ·H, CCM plastic radius R_p, tunnel strain, and weak-rock squeezing demand.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-amber-300">
                          P₀ = {result.inSituVerticalStressMpa} MPa
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-200">
                          P_h = {result.inSituHorizontalStressMpa} MPa
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded border font-bold ${
                            result.squeezingRatio < 0.45
                              ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                              : result.squeezingRatio < 1.0
                              ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                              : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                          }`}
                        >
                          σ_cm/P₀ = {result.squeezingRatio} · {result.squeezingClass}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-mono text-amber-200 mb-1">
                          Overburden Depth H (m)
                        </label>
                        <input
                          type="number"
                          step="5"
                          min="5"
                          max="2500"
                          value={input.overburdenM}
                          onChange={(e) =>
                            updateField(
                              'overburdenM',
                              Math.max(5, parseFloat(e.target.value) || 10)
                            )
                          }
                          className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-amber-500/60 focus:border-amber-400 outline-none text-sm font-mono font-bold tabular-nums text-amber-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          Rock Unit Wt γ (kN/m³)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="18"
                          max="34"
                          value={input.unitWeightKnM3}
                          onChange={(e) =>
                            updateField(
                              'unitWeightKnM3',
                              Math.max(18, parseFloat(e.target.value) || 26.5)
                            )
                          }
                          className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-sm font-mono tabular-nums text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          Stress Ratio K₀ (P_h/P₀)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.3"
                          max="3.0"
                          value={input.k0Ratio}
                          onChange={(e) =>
                            updateField(
                              'k0Ratio',
                              Math.max(0.3, parseFloat(e.target.value) || 1.0)
                            )
                          }
                          className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-sm font-mono tabular-nums text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          Barton ESR
                        </label>
                        <select
                          value={String(input.esr)}
                          onChange={(e) => updateField('esr', parseFloat(e.target.value))}
                          className="w-full px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-xs font-mono text-slate-100"
                        >
                          <option value="0.8">0.8 · Powerhouse / Cavern</option>
                          <option value="1.0">1.0 · Road / Rail / Headrace</option>
                          <option value="1.3">1.3 · Water Tunnel / Adit</option>
                          <option value="1.6">1.6 · Permanent Mine</option>
                          <option value="3.0">3.0 · Temporary Mine</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Advance Pull & Exposure Window */}
                  <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
                      Current Advance Pull &amp; Unbolted Overhang Behind Face
                    </h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          Current Round Pull (m)
                        </label>
                        <input
                          type="number"
                          step="0.25"
                          min="0.5"
                          max="6.0"
                          value={input.currentPullM}
                          onChange={(e) =>
                            updateField(
                              'currentPullM',
                              Math.max(0.5, parseFloat(e.target.value) || 0.5)
                            )
                          }
                          className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-sm font-mono tabular-nums text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          Total Unbolted Exposed Length (m)
                        </label>
                        <input
                          type="number"
                          step="0.25"
                          min="0.5"
                          max="25"
                          value={input.exposedLengthM}
                          onChange={(e) =>
                            updateField(
                              'exposedLengthM',
                              Math.max(0.5, parseFloat(e.target.value) || 0.5)
                            )
                          }
                          className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-sm font-mono tabular-nums text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          Target Next Blast Pull (m)
                        </label>
                        <input
                          type="number"
                          step="0.25"
                          min="0.8"
                          max="5.0"
                          value={input.requiredNextPullM}
                          onChange={(e) =>
                            updateField(
                              'requiredNextPullM',
                              Math.max(0.8, parseFloat(e.target.value) || 1.0)
                            )
                          }
                          className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-cyan-500/70 focus:border-cyan-400 outline-none text-sm font-mono font-bold tabular-nums text-cyan-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          Expected Delay Before Full Bolts (hrs)
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          max="168"
                          value={input.delayHoursBeforeFullSupport}
                          onChange={(e) =>
                            updateField(
                              'delayHoursBeforeFullSupport',
                              Math.max(1, parseFloat(e.target.value) || 4)
                            )
                          }
                          className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-sm font-mono tabular-nums text-slate-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Intact Rock & Structural Properties */}
                  <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                      Intact Rock, Blast Damage D &amp; Structural Wedge Inputs
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                      <div className="col-span-2 sm:col-span-2 lg:col-span-2">
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          Lithology / Rock Unit
                        </label>
                        <input
                          type="text"
                          value={input.rockTypeName}
                          onChange={(e) => updateField('rockTypeName', e.target.value)}
                          className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-xs font-mono text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          RQD (%)
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="5"
                          max="100"
                          value={input.rqdPct}
                          onChange={(e) =>
                            updateField(
                              'rqdPct',
                              Math.max(5, Math.min(100, parseFloat(e.target.value) || 10))
                            )
                          }
                          className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-sm font-mono tabular-nums text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          UCS (MPa)
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          max="350"
                          value={input.ucsMpa}
                          onChange={(e) =>
                            updateField('ucsMpa', Math.max(1, parseFloat(e.target.value) || 10))
                          }
                          className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-sm font-mono tabular-nums text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          Hoek-Brown mᵢ
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="4"
                          max="35"
                          value={input.mi}
                          onChange={(e) =>
                            updateField('mi', Math.max(4, parseFloat(e.target.value) || 12))
                          }
                          className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-sm font-mono tabular-nums text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          Blast Damage D
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="0.8"
                          value={input.blastDisturbanceD}
                          onChange={(e) =>
                            updateField(
                              'blastDisturbanceD',
                              Math.max(0, Math.min(0.8, parseFloat(e.target.value) || 0))
                            )
                          }
                          className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-sm font-mono tabular-nums text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          Crown Wedge Ht (m)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.2"
                          max="8"
                          value={input.wedgeHeightM}
                          onChange={(e) =>
                            updateField(
                              'wedgeHeightM',
                              Math.max(0.2, parseFloat(e.target.value) || 1.0)
                            )
                          }
                          className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-sm font-mono tabular-nums text-slate-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Barton Q-Index & Bieniawski RMR89 Dual Classification */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                            Barton Q-Index ({result.qIndex})
                          </h3>
                          <p className="text-[11px] font-mono text-slate-400">
                            Q* = {result.qEffectiveBlastAdjusted} · D_max = {result.maxUnsupportedSpanDmaxM}m · σ_c/σ₁ = {srfStressEstimate.sigmaCtoSigma1}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {input.qInputMode === 'detailed' && (
                            <button
                              type="button"
                              onClick={() => updateField('srf', srfStressEstimate.srf)}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-amber-500/50 text-[10px] font-mono text-amber-300 cursor-pointer whitespace-nowrap"
                              title={`Estimate Barton SRF from Overburden H=${input.overburdenM}m (${srfStressEstimate.regimeLabel})`}
                            >
                              Auto SRF ({srfStressEstimate.srf})
                            </button>
                          )}
                          <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-[11px] font-mono">
                            <button
                              type="button"
                              onClick={() => updateField('qInputMode', 'detailed')}
                              className={`px-2 py-1 rounded cursor-pointer ${
                                input.qInputMode === 'detailed'
                                  ? 'bg-cyan-500 text-slate-950 font-bold'
                                  : 'text-slate-400'
                              }`}
                            >
                              6-Param
                            </button>
                            <button
                              type="button"
                              onClick={() => updateField('qInputMode', 'direct')}
                              className={`px-2 py-1 rounded cursor-pointer ${
                                input.qInputMode === 'direct'
                                  ? 'bg-cyan-500 text-slate-950 font-bold'
                                  : 'text-slate-400'
                              }`}
                            >
                              Direct Q
                            </button>
                          </div>
                        </div>
                      </div>

                      {input.qInputMode === 'direct' ? (
                        <div>
                          <label className="block text-[11px] font-mono text-slate-400 mb-1">
                            Direct Barton Q Value (0.001 – 1000)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.001"
                            max="1000"
                            value={input.qDirect}
                            onChange={(e) =>
                              updateField(
                                'qDirect',
                                Math.max(0.001, parseFloat(e.target.value) || 0.01)
                              )
                            }
                            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-cyan-500 outline-none text-sm font-mono tabular-nums text-cyan-300"
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                          <div>
                            <label className="block text-[10px] font-mono text-slate-400 mb-1">
                              Jₙ (Joint Set)
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              max="20"
                              value={input.jn}
                              onChange={(e) =>
                                updateField('jn', Math.max(0.5, parseFloat(e.target.value) || 1))
                              }
                              className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-slate-400 mb-1">
                              Jᵣ (Roughness)
                            </label>
                            <input
                              type="number"
                              step="0.25"
                              min="0.5"
                              max="4"
                              value={input.jr}
                              onChange={(e) =>
                                updateField('jr', Math.max(0.5, parseFloat(e.target.value) || 1))
                              }
                              className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-slate-400 mb-1">
                              Jₐ (Alteration)
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              min="0.75"
                              max="20"
                              value={input.ja}
                              onChange={(e) =>
                                updateField(
                                  'ja',
                                  Math.max(0.75, parseFloat(e.target.value) || 1)
                                )
                              }
                              className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-slate-400 mb-1">
                              J_w (Water)
                            </label>
                            <input
                              type="number"
                              step="0.05"
                              min="0.05"
                              max="1"
                              value={input.jw}
                              onChange={(e) =>
                                updateField('jw', Math.max(0.05, parseFloat(e.target.value) || 0.5))
                              }
                              className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-slate-400 mb-1">
                              SRF (Stress)
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              max="20"
                              value={input.srf}
                              onChange={(e) =>
                                updateField('srf', Math.max(0.5, parseFloat(e.target.value) || 1))
                              }
                              className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono tabular-nums"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
                            Bieniawski RMR89 ({result.rmr89}) · {result.rockClassLabel}
                          </h3>
                          <p className="text-[11px] font-mono text-slate-400">
                            Q-Correlation ≈ {result.rmrCrossCheckFromQ} · GSI = {result.gsi}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleSyncRmrFromQ}
                            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-cyan-300 cursor-pointer whitespace-nowrap"
                          >
                            Sync RMR from Q
                          </button>
                          <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-[11px] font-mono">
                            <button
                              type="button"
                              onClick={() => updateField('rmrInputMode', 'detailed')}
                              className={`px-2 py-1 rounded cursor-pointer ${
                                input.rmrInputMode === 'detailed'
                                  ? 'bg-amber-500 text-slate-950 font-bold'
                                  : 'text-slate-400'
                              }`}
                            >
                              Detailed
                            </button>
                            <button
                              type="button"
                              onClick={() => updateField('rmrInputMode', 'direct')}
                              className={`px-2 py-1 rounded cursor-pointer ${
                                input.rmrInputMode === 'direct'
                                  ? 'bg-amber-500 text-slate-950 font-bold'
                                  : 'text-slate-400'
                              }`}
                            >
                              Direct RMR
                            </button>
                          </div>
                        </div>
                      </div>

                      {input.rmrInputMode === 'direct' ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-mono text-slate-400 mb-1">
                              Direct RMR89 (0 – 100)
                            </label>
                            <input
                              type="number"
                              step="1"
                              min="5"
                              max="100"
                              value={input.rmrDirect}
                              onChange={(e) =>
                                updateField(
                                  'rmrDirect',
                                  Math.max(5, Math.min(100, parseFloat(e.target.value) || 20))
                                )
                              }
                              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono tabular-nums text-amber-300"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-mono text-slate-400 mb-1">
                              Governing Joint Dip (°)
                            </label>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              max="90"
                              value={input.governingJointDipDeg}
                              onChange={(e) =>
                                updateField(
                                  'governingJointDipDeg',
                                  Math.max(0, Math.min(90, parseFloat(e.target.value) || 45))
                                )
                              }
                              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono tabular-nums"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="block text-[10px] font-mono text-slate-400 mb-1">
                              Spacing (5–20)
                            </label>
                            <input
                              type="number"
                              step="1"
                              min="5"
                              max="20"
                              value={input.rmrSpacingRating}
                              onChange={(e) =>
                                updateField(
                                  'rmrSpacingRating',
                                  Math.max(5, Math.min(20, parseFloat(e.target.value) || 5))
                                )
                              }
                              className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-slate-400 mb-1">
                              Condition (0–30)
                            </label>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              max="30"
                              value={input.rmrCondRating}
                              onChange={(e) =>
                                updateField(
                                  'rmrCondRating',
                                  Math.max(0, Math.min(30, parseFloat(e.target.value) || 0))
                                )
                              }
                              className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-slate-400 mb-1">
                              Water (0–15)
                            </label>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              max="15"
                              value={input.rmrWaterRating}
                              onChange={(e) =>
                                updateField(
                                  'rmrWaterRating',
                                  Math.max(0, Math.min(15, parseFloat(e.target.value) || 0))
                                )
                              }
                              className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-slate-400 mb-1">
                              Orient Adj (-12–0)
                            </label>
                            <input
                              type="number"
                              step="1"
                              min="-12"
                              max="0"
                              value={input.rmrOrientAdj}
                              onChange={(e) =>
                                updateField(
                                  'rmrOrientAdj',
                                  Math.max(-12, Math.min(0, parseFloat(e.target.value) || 0))
                                )
                              }
                              className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono tabular-nums"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('support')}
                      className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold flex items-center gap-2 cursor-pointer"
                    >
                      <span>Next: LG, Steel Rib &amp; Installed Support</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================
                  TAB 3: FULL SUPPORT SYSTEM (SHOTCRETE, MESH, LG, STEEL RIB, BOLTS, FOREPOLING, INVERT)
              ============================================================ */}
              {activeTab === 'support' && (
                <div className="space-y-4">
                  {/* Tier Selector */}
                  <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                          Current Installed Support Stage Behind Heading Face
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Configure exact partial or full support: Shotcrete, Wiremesh, LG (Lattice Girder), Steel Ribs, Bolts, Forepoling &amp; Invert Struts.
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono tabular-nums text-cyan-300">
                        Total Installed: {result.totalInstalledCapacityKpa.toFixed(1)} kPa vs Demand{' '}
                        {result.postBlastSupportDemandKpa.toFixed(1)} kPa
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
                      {SUPPORT_TIERS.map((tier) => {
                        const isSel = input.supportTier === tier.id;
                        return (
                          <button
                            key={tier.id}
                            type="button"
                            onClick={() => handleSelectSupportTier(tier.id)}
                            className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer flex flex-col justify-between gap-1 ${
                              isSel
                                ? 'bg-cyan-500/15 border-cyan-500 text-slate-50'
                                : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="text-[11px] font-mono font-bold flex items-center justify-between gap-1">
                              <span>{tier.title}</span>
                              {isSel && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                            </div>
                            <p className="text-[10px] text-slate-400 leading-snug">{tier.subtitle}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4-Panel Support Matrix */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Panel A: Shotcrete & Wiremesh */}
                    <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
                          1. Shotcrete Shell &amp; Wiremesh
                        </h3>
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-[11px] font-mono font-bold text-amber-300 tabular-nums">
                          {result.installedShotcreteCapacityKpa.toFixed(1)} kPa · f_cu={earlyAgeMpa.toFixed(1)} MPa
                        </span>
                      </div>

                      {input.supportTier === 'none' ? (
                        <p className="text-xs text-slate-400 font-mono py-2">
                          Bare rock excavation selected — no shotcrete or mesh applied.
                        </p>
                      ) : (
                        <>
                          <div className="grid grid-cols-3 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-mono text-slate-400 mb-1">
                                Thickness (mm)
                              </label>
                              <input
                                type="number"
                                step="25"
                                min="25"
                                max="400"
                                value={input.shotcreteThicknessMm}
                                onChange={(e) =>
                                  updateField(
                                    'shotcreteThicknessMm',
                                    Math.max(25, parseFloat(e.target.value) || 50)
                                  )
                                }
                                className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono tabular-nums"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-mono text-slate-400 mb-1">
                                Shotcrete Mix
                              </label>
                              <select
                                value={input.shotcreteMix}
                                onChange={(e) =>
                                  updateField(
                                    'shotcreteMix',
                                    e.target.value as BlastCalcShotcreteMix
                                  )
                                }
                                className="w-full px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono"
                              >
                                <option value="plain">Plain Shotcrete</option>
                                <option value="steel_fiber">Steel Fiber (SFRS)</option>
                                <option value="synthetic_fiber">Synthetic Macro-Fiber</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-mono text-slate-400 mb-1">
                                Cure Age (hrs)
                              </label>
                              <input
                                type="number"
                                step="1"
                                min="1"
                                max="672"
                                value={input.shotcreteAgeHours}
                                onChange={(e) =>
                                  updateField(
                                    'shotcreteAgeHours',
                                    Math.max(0.5, parseFloat(e.target.value) || 4)
                                  )
                                }
                                className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono tabular-nums"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-mono text-slate-400 mb-1">
                              Embedded Wiremesh Specification
                            </label>
                            <select
                              value={input.wiremeshSpec}
                              onChange={(e) =>
                                updateField('wiremeshSpec', e.target.value as BlastCalcMeshSpec)
                              }
                              className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono"
                            >
                              <option value="none">None (Fiber only or plain)</option>
                              <option value="welded_6mm_150">Welded Mesh Ø6mm @ 150×150mm</option>
                              <option value="welded_8mm_150">Welded Mesh Ø8mm @ 150×150mm</option>
                              <option value="heavy_chainlink">Heavy Chainlink Mesh</option>
                            </select>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Panel B: LG (Lattice Girder), Steel Rib (ISMB/HEB) & TH Yielding Arch */}
                    <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                          2. LG (Lattice Girder), Steel Rib &amp; Yielding Arch
                        </h3>
                        <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/40 text-[11px] font-mono font-bold text-cyan-300 tabular-nums">
                          {result.installedGirderCapacityKpa.toFixed(1)} kPa
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {(
                          [
                            { id: 'none', label: 'No LG / Rib' },
                            { id: 'lattice_girder', label: 'LG Lattice Girder' },
                            { id: 'steel_rib_ismb', label: 'Steel Rib (I/H)' },
                            { id: 'th_yielding_rib', label: 'TH Yielding Rib' },
                          ] as { id: BlastCalcArchFrameType; label: string }[]
                        ).map((opt) => {
                          const act = (input.archFrameType ?? 'none') === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleSelectArchFrameType(opt.id)}
                              className={`px-2 py-1.5 rounded-lg border text-[11px] font-mono font-semibold cursor-pointer ${
                                act
                                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>

                      {(input.archFrameType ?? 'none') !== 'none' && activeArchGroup && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                          <div className="sm:col-span-1">
                            <label className="block text-[11px] font-mono text-slate-400 mb-1">
                              Section Profile
                            </label>
                            <select
                              value={input.archSectionProfile ?? activeArchGroup.profiles[0].id}
                              onChange={(e) =>
                                updateField(
                                  'archSectionProfile',
                                  e.target.value as BlastCalcArchSectionProfile
                                )
                              }
                              className="w-full px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono"
                            >
                              {activeArchGroup.profiles.map((pr) => (
                                <option key={pr.id} value={pr.id}>
                                  {pr.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-mono text-slate-400 mb-1">
                              Arch Spacing c/c (m)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0.6"
                              max="2.5"
                              value={input.archSpacingM ?? 1.2}
                              onChange={(e) =>
                                updateField(
                                  'archSpacingM',
                                  Math.max(0.6, parseFloat(e.target.value) || 1.2)
                                )
                              }
                              className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-mono text-slate-400 mb-1">
                              Rib / LG Footing
                            </label>
                            <select
                              value={input.archFootSupport ?? 'standard_baseplate'}
                              onChange={(e) =>
                                updateField(
                                  'archFootSupport',
                                  e.target.value as BlastCalcArchFootSupport
                                )
                              }
                              className="w-full px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono"
                            >
                              <option value="standard_baseplate">Baseplate on Bench</option>
                              <option value="elephant_foot">Elephant Foot Enlarged</option>
                              <option value="invert_strut_closed">Closed Invert Foot</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Panel C: Rock Bolting & Anchors */}
                    <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-300">
                          3. Rock Bolts &amp; Cable Anchors
                        </h3>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-[11px] font-mono font-bold text-emerald-300 tabular-nums">
                          {result.installedBoltCapacityKpa.toFixed(1)} kPa
                        </span>
                      </div>

                      {input.supportTier !== 'partial_bolts_shotcrete' &&
                      input.supportTier !== 'full_natm_support' ? (
                        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
                          <div className="font-mono font-bold text-amber-300 flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4" />
                            <span>No Radial Bolts Active in Current Tier</span>
                          </div>
                          <p className="text-slate-400">
                            Select &ldquo;Partial Bolts + Shotcrete&rdquo; or &ldquo;Full NATM Primary Support&rdquo; above if radial rock bolts are installed.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <div>
                            <label className="block text-[11px] font-mono text-slate-400 mb-1">
                              Bolt / Anchor Type
                            </label>
                            <select
                              value={input.boltType ?? 'sn_grouted_rebar'}
                              onChange={(e) =>
                                updateField('boltType', e.target.value as BlastCalcBoltType)
                              }
                              className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono"
                            >
                              <option value="sn_grouted_rebar">SN Grouted Rebar Bolt (Standard NATM)</option>
                              <option value="swellex_friction">Swellex / Expandable Friction Bolt</option>
                              <option value="self_drilling_ibo">Self-Drilling Hollow IBO Grout Bolt</option>
                              <option value="split_set">Split-Set Stabilizer</option>
                              <option value="cable_bolt">Pre-Stressed Cable Anchor</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <label className="block text-[10px] font-mono text-slate-400 mb-1">
                                Length (m)
                              </label>
                              <input
                                type="number"
                                step="0.5"
                                min="1.5"
                                max="12"
                                value={input.boltLengthM}
                                onChange={(e) =>
                                  updateField(
                                    'boltLengthM',
                                    Math.max(1.5, parseFloat(e.target.value) || 3)
                                  )
                                }
                                className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono tabular-nums"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono text-slate-400 mb-1">
                                Spacing (m)
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                min="0.7"
                                max="3.5"
                                value={input.boltSpacingM}
                                onChange={(e) =>
                                  updateField(
                                    'boltSpacingM',
                                    Math.max(0.7, parseFloat(e.target.value) || 1.5)
                                  )
                                }
                                className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono tabular-nums"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono text-slate-400 mb-1">
                                Yield (kN)
                              </label>
                              <input
                                type="number"
                                step="10"
                                min="50"
                                max="500"
                                value={input.boltCapacityKn}
                                onChange={(e) =>
                                  updateField(
                                    'boltCapacityKn',
                                    Math.max(50, parseFloat(e.target.value) || 160)
                                  )
                                }
                                className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono tabular-nums"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono text-slate-400 mb-1">
                                Bolts / Ring
                              </label>
                              <input
                                type="number"
                                step="1"
                                min="1"
                                max="24"
                                value={input.boltsPerRing}
                                onChange={(e) =>
                                  updateField(
                                    'boltsPerRing',
                                    Math.max(1, parseInt(e.target.value, 10) || 5)
                                  )
                                }
                                className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono tabular-nums"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Panel D: Auxiliary Supports — Forepoling, Pipe Umbrella, Face Stabilization, Invert Strut & Drainage */}
                    <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                          4. Forepoling, Pipe Umbrella, Invert &amp; Face Supports
                        </h3>
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px] font-mono font-bold text-slate-200 tabular-nums">
                          +{(result.installedForepolingCapacityKpa + result.installedFaceInvertCapacityKpa).toFixed(1)} kPa
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-mono text-slate-400 mb-1">
                            Crown Pre-Support
                          </label>
                          <select
                            value={input.forepolingType ?? 'none'}
                            onChange={(e) =>
                              updateField('forepolingType', e.target.value as BlastCalcForepolingType)
                            }
                            className="w-full px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono"
                          >
                            <option value="none">None (No Spiling / Canopy)</option>
                            <option value="rebar_spiling">Forepoling Rebar Spiles (Ø25/32mm)</option>
                            <option value="pipe_umbrella">Heavy Pipe Roof Umbrella (Ø114mm)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-mono text-slate-400 mb-1">
                            Face Stabilization
                          </label>
                          <select
                            value={input.faceSupportType ?? 'none'}
                            onChange={(e) =>
                              updateField(
                                'faceSupportType',
                                e.target.value as BlastCalcFaceSupportType
                              )
                            }
                            className="w-full px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono"
                          >
                            <option value="none">Unsupported Face</option>
                            <option value="face_shotcrete_50mm">50mm Face Sealing Shotcrete</option>
                            <option value="face_fiberglass_bolts">Fiberglass Face Bolts + Sfr</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-mono text-slate-400 mb-1">
                            Invert Closure / Strut
                          </label>
                          <select
                            value={input.invertSupport ?? 'none'}
                            onChange={(e) =>
                              updateField(
                                'invertSupport',
                                e.target.value as BlastCalcInvertSupportType
                              )
                            }
                            className="w-full px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono"
                          >
                            <option value="none">Open Invert (No Strut)</option>
                            <option value="temporary_invert_strut">Temporary Steel Invert Strut</option>
                            <option value="closed_invert_arch">Closed Concrete Invert Arch</option>
                          </select>
                        </div>
                      </div>

                      {(input.forepolingType ?? 'none') !== 'none' && (
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-mono text-slate-400 mb-1">
                              Forepole / Pipe Length (m)
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              min="2"
                              max="18"
                              value={input.forepolingLengthM ?? 4.0}
                              onChange={(e) =>
                                updateField(
                                  'forepolingLengthM',
                                  Math.max(2, parseFloat(e.target.value) || 4)
                                )
                              }
                              className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-slate-400 mb-1">
                              Spacing Along Arch (cm)
                            </label>
                            <input
                              type="number"
                              step="5"
                              min="20"
                              max="80"
                              value={input.forepolingSpacingCm ?? 40}
                              onChange={(e) =>
                                updateField(
                                  'forepolingSpacingCm',
                                  Math.max(20, parseFloat(e.target.value) || 40)
                                )
                              }
                              className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono tabular-nums"
                            />
                          </div>
                        </div>
                      )}

                      <label className="flex items-center gap-2.5 pt-1 text-xs font-mono text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(input.drainageReliefHoles)}
                          onChange={(e) => updateField('drainageReliefHoles', e.target.checked)}
                          className="w-4 h-4 accent-cyan-500"
                        />
                        <span>
                          Weep / Drainage Relief Holes Drilled (Prevents pore water peel behind fresh shotcrete)
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('result')}
                      className="px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold flex items-center gap-2 cursor-pointer"
                    >
                      <span>Run Full CCM / Q-ESR / RMR Analysis &amp; Report</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================
                  TAB 4: ADVANCED ANALYSIS, STEP-BY-STEP CALCULATIONS & REPORT
              ============================================================ */}
              {activeTab === 'result' && (
                <div className="space-y-4">
                  {/* Report Action Bar */}
                  <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                      <Sliders className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>
                        Cover: <strong className="text-amber-300">{input.overburdenM}m</strong> (P₀{' '}
                        <strong className="text-slate-100">{result.inSituVerticalStressMpa} MPa</strong>, σ_cm/P₀{' '}
                        <strong className="text-slate-100">{result.squeezingRatio}</strong>) · Target Pull:{' '}
                        <strong className="text-slate-100">{input.requiredNextPullM.toFixed(2)}m</strong> · Post-Blast Exposed:{' '}
                        <strong className="text-slate-100">{result.postBlastTotalExposedM.toFixed(2)}m</strong>
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {saveToast && (
                        <span className="text-[11px] font-mono text-emerald-300 px-2 py-1 rounded bg-emerald-950/60 border border-emerald-500/40">
                          {saveToast}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveSnapshot}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono font-semibold text-cyan-300 cursor-pointer whitespace-nowrap"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save to History</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadPdf}
                        disabled={isExportingPdf}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold cursor-pointer whitespace-nowrap disabled:opacity-60"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{isExportingPdf ? 'Building 2-Page PDF...' : '2-Page PDF Report'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => exportBlastReadinessWordDoc(input, result)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono font-semibold text-slate-100 cursor-pointer whitespace-nowrap"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-300" />
                        <span>Word (.doc)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handlePrint}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono font-semibold text-slate-100 cursor-pointer whitespace-nowrap"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-300" />
                        <span>Print A4 Sheet</span>
                      </button>
                    </div>
                  </div>

                  {/* Clearance Verdict Banner */}
                  <div
                    className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${verdictTheme.border} ${verdictTheme.bg}`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-black tracking-wide ${verdictTheme.badge}`}
                        >
                          <VerdictIcon className="w-3.5 h-3.5" />
                          {verdictTheme.tag}
                        </span>
                        <span className="text-xs font-mono text-slate-300">
                          {result.governingFailureMode}
                        </span>
                      </div>
                      <h3 className={`text-base sm:text-lg font-bold ${verdictTheme.text}`}>
                        {result.verdictTitle}
                      </h3>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {result.verdictSubtitle}
                      </p>
                    </div>
                    <div className="px-4 py-2.5 rounded-lg bg-slate-950/75 border border-slate-800 text-right shrink-0 font-mono tabular-nums">
                      <div className="text-[10px] text-slate-400">MAX SAFE PULL AS-IS</div>
                      <div className="text-xl font-black text-cyan-300">
                        {result.maxSafeNextPullM.toFixed(2)} m
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Target: {input.requiredNextPullM.toFixed(2)} m
                      </div>
                    </div>
                  </div>

                  {/* Primary KPI Strip + CCM/Strain/PPV Telemetry */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 font-mono tabular-nums">
                    <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-3">
                      <div className="text-[10px] text-slate-400">POST-BLAST FoS</div>
                      <div
                        className={`text-lg font-black ${
                          result.postBlastFos >= 1.3
                            ? 'text-emerald-300'
                            : result.postBlastFos >= 1.15
                            ? 'text-amber-300'
                            : 'text-rose-400'
                        }`}
                      >
                        {result.postBlastFos.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400">Current: {result.currentFos.toFixed(2)}</div>
                    </div>
                    <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-3">
                      <div className="text-[10px] text-slate-400">WEDGE GRAVITY FoS</div>
                      <div className="text-lg font-black text-slate-100">
                        {result.wedgeGravityFos.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Load: {result.wedgeGravityDemandKpa.toFixed(1)} kPa
                      </div>
                    </div>
                    <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-3">
                      <div className="text-[10px] text-slate-400">ACTIVE SPAN / D_MAX</div>
                      <div className="text-lg font-black text-cyan-300">
                        {result.postBlastActiveSpanM.toFixed(2)}m
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Barton D_max: {result.maxUnsupportedSpanDmaxM.toFixed(2)}m
                      </div>
                    </div>
                    <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-3">
                      <div className="text-[10px] text-slate-400">CAPACITY vs DEMAND</div>
                      <div className="text-lg font-black text-slate-100">
                        {result.totalInstalledCapacityKpa.toFixed(0)} kPa
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Demand: {result.postBlastSupportDemandKpa.toFixed(0)} kPa
                      </div>
                    </div>
                    <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-3">
                      <div className="text-[10px] text-slate-400">LDP TUNNEL STRAIN</div>
                      <div className="text-lg font-black text-amber-300">
                        {result.postBlastTunnelStrainPct.toFixed(2)}%
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Disp: {result.unsupportedRadialDispMm}mm · Rp {result.plasticRadiusM}m
                      </div>
                    </div>
                    <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-3">
                      <div className="text-[10px] text-slate-400">BLAST PPV BOND</div>
                      <div
                        className={`text-lg font-black ${
                          result.shotcreteBlastBondFos >= 1.2 ? 'text-emerald-300' : 'text-amber-300'
                        }`}
                      >
                        {result.shotcreteBlastBondFos.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Est. PPV: {result.blastDynamicPpvMmSec} mm/s
                      </div>
                    </div>
                  </div>

                  {/* Multi-Component Installed Support Breakdown Strip */}
                  <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-3.5 grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono tabular-nums text-xs">
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400">SHOTCRETE + MESH</div>
                      <div className="font-bold text-amber-300">
                        {result.installedShotcreteCapacityKpa} kPa
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400">ROCK BOLTS</div>
                      <div className="font-bold text-emerald-300">
                        {result.installedBoltCapacityKpa} kPa
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400">LG / STEEL RIB ARCH</div>
                      <div className="font-bold text-cyan-300">
                        {result.installedGirderCapacityKpa} kPa
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-[10px] text-slate-400">FOREPOLING / SPILE</div>
                      <div className="font-bold text-slate-100">
                        {result.installedForepolingCapacityKpa} kPa
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 col-span-2 sm:col-span-1">
                      <div className="text-[10px] text-slate-400">INVERT / FACE AUX</div>
                      <div className="font-bold text-slate-100">
                        {result.installedFaceInvertCapacityKpa} kPa
                      </div>
                    </div>
                  </div>

                  {/* Dual Stand-Up Time Cards + Log-Log Stand-Up Curve */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-5 space-y-3">
                      <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold uppercase text-amber-300 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Stand-Up Time · WITHOUT Support
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            Bare Crown Roof
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 font-mono tabular-nums pt-1">
                          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                            <div className="text-[10px] text-slate-400">CURRENT SPAN</div>
                            <div className="text-sm font-bold text-slate-100">
                              {formatStandUpTime(result.unsupportedStandUpCurrentHrs)}
                            </div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                            <div className="text-[10px] text-slate-400">AFTER NEXT BLAST</div>
                            <div className="text-sm font-bold text-amber-300">
                              {formatStandUpTime(result.unsupportedStandUpPostBlastHrs)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold uppercase text-emerald-300 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Stand-Up Time · WITH Installed Support
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 uppercase">
                            {input.supportTier.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 font-mono tabular-nums pt-1">
                          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                            <div className="text-[10px] text-slate-400">CURRENT SPAN</div>
                            <div className="text-sm font-bold text-slate-100">
                              {formatStandUpTime(result.supportedStandUpCurrentHrs)}
                            </div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                            <div className="text-[10px] text-slate-400">AFTER NEXT BLAST</div>
                            <div className="text-sm font-bold text-emerald-300">
                              {formatStandUpTime(result.supportedStandUpPostBlastHrs)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-7 bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                          Bieniawski Stand-Up Curve (Log Hrs vs Active Span)
                        </h3>
                        <div className="flex items-center gap-3 text-[10px] font-mono">
                          <span className="flex items-center gap-1 text-amber-300">
                            <span className="w-3 h-0.5 bg-amber-400 inline-block" /> Without Support
                          </span>
                          <span className="flex items-center gap-1 text-emerald-300">
                            <span className="w-3 h-0.5 bg-emerald-400 inline-block" /> With Installed Support
                          </span>
                          <span className="flex items-center gap-1 text-cyan-300">
                            <span className="w-3 h-0.5 bg-cyan-400 inline-block" /> Barton D_max
                          </span>
                        </div>
                      </div>

                      <div className="bg-[#070B14] border border-slate-800 rounded-lg p-2">
                        <svg
                          viewBox={`0 0 ${standUpChart.W} ${standUpChart.H}`}
                          className="w-full h-[195px]"
                        >
                          {[0.1, 1, 10, 100, 1000, 10000].map((hr) => {
                            const y = standUpChart.yForHrs(hr);
                            const label =
                              hr >= 1000 ? `${hr / 1000}k h` : hr < 1 ? '6m' : `${hr}h`;
                            return (
                              <g key={hr}>
                                <line
                                  x1={standUpChart.padL}
                                  y1={y}
                                  x2={standUpChart.W - standUpChart.padR}
                                  y2={y}
                                  stroke="#1E293B"
                                  strokeWidth="0.8"
                                />
                                <text
                                  x={standUpChart.padL - 6}
                                  y={y + 3}
                                  textAnchor="end"
                                  fill="#64748B"
                                  fontSize="9"
                                  fontFamily="monospace"
                                >
                                  {label}
                                </text>
                              </g>
                            );
                          })}

                          {[2, 4, 6, 8, 10, 12]
                            .filter((s) => s <= standUpChart.maxSpan)
                            .map((sp) => {
                              const x = standUpChart.xForSpan(sp);
                              return (
                                <g key={sp}>
                                  <line
                                    x1={x}
                                    y1={standUpChart.padT}
                                    x2={x}
                                    y2={standUpChart.H - standUpChart.padB}
                                    stroke="#1E293B"
                                    strokeWidth="0.8"
                                  />
                                  <text
                                    x={x}
                                    y={standUpChart.H - 14}
                                    textAnchor="middle"
                                    fill="#64748B"
                                    fontSize="9"
                                    fontFamily="monospace"
                                  >
                                    {sp}m
                                  </text>
                                </g>
                              );
                            })}

                          {result.maxUnsupportedSpanDmaxM <= standUpChart.maxSpan && (
                            <g>
                              <line
                                x1={standUpChart.xForSpan(result.maxUnsupportedSpanDmaxM)}
                                y1={standUpChart.padT}
                                x2={standUpChart.xForSpan(result.maxUnsupportedSpanDmaxM)}
                                y2={standUpChart.H - standUpChart.padB}
                                stroke="#06B6D4"
                                strokeDasharray="4 3"
                                strokeWidth="1.4"
                              />
                              <text
                                x={standUpChart.xForSpan(result.maxUnsupportedSpanDmaxM) + 4}
                                y={standUpChart.padT + 10}
                                fill="#22D3EE"
                                fontSize="9"
                                fontFamily="monospace"
                              >
                                D_max {result.maxUnsupportedSpanDmaxM}m
                              </text>
                            </g>
                          )}

                          <path
                            d={standUpChart.unsupPath}
                            fill="none"
                            stroke="#F59E0B"
                            strokeWidth="2.2"
                          />
                          <path
                            d={standUpChart.supPath}
                            fill="none"
                            stroke="#10B981"
                            strokeWidth="2.4"
                          />

                          <circle
                            cx={standUpChart.xForSpan(result.postBlastActiveSpanM)}
                            cy={standUpChart.yForHrs(result.unsupportedStandUpPostBlastHrs)}
                            r="4.5"
                            fill="#F59E0B"
                            stroke="#090D16"
                            strokeWidth="1.5"
                          />
                          <circle
                            cx={standUpChart.xForSpan(result.postBlastActiveSpanM)}
                            cy={standUpChart.yForHrs(result.supportedStandUpPostBlastHrs)}
                            r="4.5"
                            fill="#10B981"
                            stroke="#090D16"
                            strokeWidth="1.5"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* 6-Point Engineering Safety Audit Matrix */}
                  <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-2.5 overflow-x-auto">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                      Six-Point Engineering Safety Audit Matrix
                    </h3>
                    <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                      <thead>
                        <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                          <th className="py-1.5 pr-3">Verification Check</th>
                          <th className="py-1.5 pr-3">Calculated Result</th>
                          <th className="py-1.5 pr-3">Acceptance Criterion</th>
                          <th className="py-1.5 pr-3">Margin</th>
                          <th className="py-1.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {result.safetyChecks.map((ck) => (
                          <tr key={ck.checkName} className="hover:bg-slate-900/60">
                            <td className="py-2 pr-3 font-sans font-semibold text-slate-200">
                              {ck.checkName}
                            </td>
                            <td className="py-2 pr-3 text-slate-300">{ck.computedValue}</td>
                            <td className="py-2 pr-3 text-slate-400">{ck.acceptanceCriterion}</td>
                            <td className="py-2 pr-3 text-slate-200">{ck.marginText}</td>
                            <td className="py-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                                  ck.status === 'PASS'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : ck.status === 'CAUTION'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {ck.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Step-by-Step Formal Engineering Equations & Substituted Calculation Breakdown */}
                  <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
                        Step-by-Step Geotechnical Formulas &amp; Substituted Calculations
                      </h3>
                      <span className="text-[11px] font-mono text-slate-400">
                        Included in PDF, Word &amp; Print Reports
                      </span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {result.calculationSteps.map((st) => (
                        <div
                          key={st.stepNumber}
                          className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-mono font-bold text-cyan-300">
                              STEP {st.stepNumber}: {st.title}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {st.methodStandard}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-amber-300/95">
                            Eq: {st.formula}
                          </div>
                          <div className="text-[11px] font-mono text-slate-300 leading-relaxed">
                            Calc: {st.substituted}
                          </div>
                          <div className="text-[11px] font-mono font-bold text-emerald-300">
                            Result: {st.resultValue}
                          </div>
                          <div className="text-[11px] text-slate-400">{st.interpretation}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Minimum Support Prescription & Conditional Pull Decision Matrix */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-5 bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                        Minimum Support Prescription for {input.requiredNextPullM.toFixed(2)}m Pull
                      </h3>
                      <p className="text-xs font-medium text-slate-100 leading-relaxed bg-slate-950 border border-slate-800 rounded-lg p-3">
                        {result.minimumSupportForRequiredPull.actionSummary}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
                        <div className="p-2 rounded bg-slate-950 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">SHOTCRETE REQ</span>
                          <strong className="text-slate-100">
                            {result.minimumSupportForRequiredPull.shotcreteMm} mm (
                            {result.minimumSupportForRequiredPull.shotcreteMixLabel})
                          </strong>
                        </div>
                        <div className="p-2 rounded bg-slate-950 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">MIN CURE WAIT</span>
                          <strong className="text-amber-300">
                            {result.minimumSupportForRequiredPull.waitCureHours} hrs
                          </strong>
                        </div>
                        <div className="p-2 rounded bg-slate-950 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">LG / STEEL RIB ARCH</span>
                          <strong className="text-slate-100">
                            {result.minimumSupportForRequiredPull.recommendedArchLabel || 'None'}
                          </strong>
                        </div>
                        <div className="p-2 rounded bg-slate-950 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">ROCK BOLTS REQ</span>
                          <strong className="text-cyan-300">
                            {result.minimumSupportForRequiredPull.boltsRequired
                              ? `${result.minimumSupportForRequiredPull.boltsPerRing}×${result.minimumSupportForRequiredPull.boltLengthM}m @ ${result.minimumSupportForRequiredPull.boltSpacingM}m`
                              : 'Deferred Allowed'}
                          </strong>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums text-slate-300">
                        <div>
                          Hoek-Brown σ_cm:{' '}
                          <strong className="text-slate-100">{result.sigmaCmMpa} MPa</strong>
                        </div>
                        <div>
                          Equiv c&apos; / φ&apos;:{' '}
                          <strong className="text-slate-100">
                            {result.cohesionMpa} MPa / {result.frictionAngleDeg}°
                          </strong>
                        </div>
                        <div>
                          Modulus E_rm:{' '}
                          <strong className="text-slate-100">{result.ermGpa} GPa</strong>
                        </div>
                        <div>
                          Critical P_cr:{' '}
                          <strong className="text-amber-300">
                            {result.criticalSupportPressurePcrMpa} MPa
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-7 bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-2.5 overflow-x-auto">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                        Conditional Next-Blast Pull Matrix (0.8m – 4.0m)
                      </h3>
                      <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                        <thead>
                          <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                            <th className="py-1.5 pr-2">Pull</th>
                            <th className="py-1.5 pr-2">Exposed</th>
                            <th className="py-1.5 pr-2">FoS</th>
                            <th className="py-1.5 pr-2">Stand-Up (No/Sup)</th>
                            <th className="py-1.5 pr-2">Status</th>
                            <th className="py-1.5">Minimum Required Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                          {result.conditionalPullMatrix.map((row) => (
                            <tr key={row.pullM} className="hover:bg-slate-900/60">
                              <td className="py-2 pr-2 font-bold text-slate-100">
                                {row.pullM.toFixed(1)} m
                              </td>
                              <td className="py-2 pr-2 text-slate-300">
                                {row.combinedExposedM.toFixed(1)} m
                              </td>
                              <td className="py-2 pr-2 font-bold text-slate-100">
                                {row.fos.toFixed(2)}
                              </td>
                              <td className="py-2 pr-2 text-slate-300">
                                {row.unsupportedStandUpHrs.toFixed(1)}h /{' '}
                                {row.supportedStandUpHrs.toFixed(1)}h
                              </td>
                              <td className="py-2 pr-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                                    row.statusLabel === 'SAFE AS-IS'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : row.statusLabel === 'NEEDS UPGRADE'
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-rose-500/20 text-rose-300'
                                  }`}
                                >
                                  {row.statusLabel}
                                </span>
                              </td>
                              <td className="py-2 text-[11px] font-sans text-slate-300">
                                {row.requiredUpgradeText}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Field Warnings */}
                  {result.engineeringWarnings.length > 0 && (
                    <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3.5 space-y-1.5">
                      <div className="text-xs font-mono font-bold uppercase text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Geotechnical Observations &amp; Critical Advisories</span>
                      </div>
                      <ul className="space-y-1 text-xs text-slate-200 list-disc pl-5">
                        {result.engineeringWarnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SLIDE-OVER HISTORY LOG DRAWER */}
            {isHistoryOpen && (
              <aside className="w-full sm:w-[370px] bg-[#0B111E] border-l border-slate-800 flex flex-col shrink-0 z-20">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-mono font-bold uppercase text-slate-100">
                      Saved Clearance Log
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {historyRecords.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setHistoryRecords(clearBlastCalcHistory())}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-rose-950 border border-slate-700 text-[10px] font-mono text-rose-300 cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsHistoryOpen(false)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {historyRecords.length === 0 ? (
                    <div className="text-center py-10 text-xs font-mono text-slate-400">
                      No saved calculations yet. Save any check from the Result tab.
                    </div>
                  ) : (
                    historyRecords.map((rec) => {
                      const vt = getVerdictTheme(rec.result.verdict);
                      return (
                        <div
                          key={rec.id}
                          className="p-3 rounded-lg bg-[#0F172A] border border-slate-800 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-100 truncate">
                                {rec.input.scenarioLabel}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">
                                {rec.input.chainageLabel} ·{' '}
                                {new Date(rec.savedAt).toLocaleString()}
                              </div>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold whitespace-nowrap ${vt.badge}`}
                            >
                              FoS {rec.result.postBlastFos.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-300">
                            Q={rec.result.qIndex} · RMR={rec.result.rmr89} · Max Pull{' '}
                            {rec.result.maxSafeNextPullM.toFixed(2)}m
                          </div>
                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setInput(rec.input);
                                setActiveTab('result');
                                setIsHistoryOpen(false);
                              }}
                              className="flex-1 py-1 rounded bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-[11px] font-mono font-semibold text-cyan-300 cursor-pointer"
                            >
                              Load
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                exportBlastReadinessPdfCertificate(rec.input, rec.result)
                              }
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-200 cursor-pointer"
                            >
                              PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => exportBlastReadinessWordDoc(rec.input, rec.result)}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-200 cursor-pointer"
                            >
                              DOC
                            </button>
                            <button
                              type="button"
                              onClick={() => setHistoryRecords(deleteBlastCalcSnapshot(rec.id))}
                              className="p-1 rounded bg-slate-900 hover:bg-rose-950 border border-slate-700 text-rose-300 cursor-pointer"
                              title="Delete Snapshot"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>

      {/* CLEAN LIGHT-MODE PRINTABLE A4 ENGINEERING CALCULATION REPORT */}
      <div className="hidden print:block p-6 bg-white text-slate-900 font-sans text-xs space-y-3.5">
        <div className="border-b-2 border-slate-900 pb-2 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold uppercase tracking-wide">
              Next-Blast Clearance, Stand-Up Time &amp; Geotechnical Calculation Certificate
            </h1>
            <p className="text-[11px] font-mono text-slate-600">
              {input.scenarioLabel} | {input.chainageLabel} | Geologist: {input.geologistName} |{' '}
              {new Date(result.computedAt).toLocaleString()}
            </p>
          </div>
          <span className="px-2 py-1 border border-slate-900 font-mono font-bold text-xs">
            {verdictTheme.tag}
          </span>
        </div>

        <div className="p-2.5 border-2 border-slate-800 bg-slate-50 space-y-1">
          <div className="font-bold text-sm">{result.verdictTitle}</div>
          <div>{result.verdictSubtitle}</div>
          <div className="font-mono text-[11px]">
            Governing Mechanism: {result.governingFailureMode} | Max Safe Pull As-Is:{' '}
            {result.maxSafeNextPullM.toFixed(2)} m
          </div>
        </div>

        <table className="w-full border-collapse border border-slate-400 text-[10px] font-mono">
          <tbody>
            <tr>
              <th className="border border-slate-400 bg-slate-100 p-1 text-left">Profile &amp; Overburden</th>
              <td className="border border-slate-400 p-1">
                {input.geometry.profileName || input.geometry.crownGeometry} (
                {input.geometry.width.toFixed(2)}×{input.geometry.height.toFixed(2)}m,{' '}
                {result.tunnelAreaM2}m²) · H={input.overburdenM}m (P₀={result.inSituVerticalStressMpa}MPa)
              </td>
              <th className="border border-slate-400 bg-slate-100 p-1 text-left">Q / RMR89 / GSI</th>
              <td className="border border-slate-400 p-1">
                Q={result.qIndex} (Q*={result.qEffectiveBlastAdjusted}) | RMR={result.rmr89} | GSI=
                {result.gsi} | σ_cm/P₀={result.squeezingRatio}
              </td>
            </tr>
            <tr>
              <th className="border border-slate-400 bg-slate-100 p-1 text-left">
                Support Breakdown
              </th>
              <td className="border border-slate-400 p-1">
                Shotcrete {result.installedShotcreteCapacityKpa}kPa | Bolts{' '}
                {result.installedBoltCapacityKpa}kPa | LG/Rib {result.installedGirderCapacityKpa}kPa |
                Forepole {result.installedForepolingCapacityKpa}kPa
              </td>
              <th className="border border-slate-400 bg-slate-100 p-1 text-left">
                Capacity vs Demand
              </th>
              <td className="border border-slate-400 p-1">
                {result.totalInstalledCapacityKpa} kPa vs {result.postBlastSupportDemandKpa} kPa
                (FoS {result.postBlastFos.toFixed(2)})
              </td>
            </tr>
            <tr>
              <th className="border border-slate-400 bg-slate-100 p-1 text-left">
                Stand-Up NO Support
              </th>
              <td className="border border-slate-400 p-1">
                {formatStandUpTime(result.unsupportedStandUpPostBlastHrs)} (Post-Blast)
              </td>
              <th className="border border-slate-400 bg-slate-100 p-1 text-left">
                Stand-Up WITH Support
              </th>
              <td className="border border-slate-400 p-1">
                {formatStandUpTime(result.supportedStandUpPostBlastHrs)} (D_max{' '}
                {result.maxUnsupportedSpanDmaxM}m)
              </td>
            </tr>
          </tbody>
        </table>

        {/* 6-Check Safety Audit Table */}
        <div>
          <div className="font-bold uppercase text-[11px] mb-1">
            Six-Point Engineering Safety Audit
          </div>
          <table className="w-full border-collapse border border-slate-400 text-[10px] font-mono">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 p-1 text-left">Check</th>
                <th className="border border-slate-400 p-1 text-left">Calculated</th>
                <th className="border border-slate-400 p-1 text-left">Criterion</th>
                <th className="border border-slate-400 p-1 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {result.safetyChecks.map((ck) => (
                <tr key={ck.checkName}>
                  <td className="border border-slate-400 p-1 font-sans font-semibold">
                    {ck.checkName}
                  </td>
                  <td className="border border-slate-400 p-1">{ck.computedValue}</td>
                  <td className="border border-slate-400 p-1">{ck.acceptanceCriterion}</td>
                  <td className="border border-slate-400 p-1 font-bold">{ck.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Step-by-Step Formal Equations & Substituted Calculations */}
        <div>
          <div className="font-bold uppercase text-[11px] mb-1">
            Step-by-Step Geotechnical Formulas &amp; Substituted Calculations
          </div>
          <table className="w-full border-collapse border border-slate-400 text-[9.5px] font-mono">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 p-1 text-left w-[24%]">Step &amp; Standard</th>
                <th className="border border-slate-400 p-1 text-left w-[52%]">
                  Equation &amp; Substituted Computation
                </th>
                <th className="border border-slate-400 p-1 text-left w-[24%]">Output</th>
              </tr>
            </thead>
            <tbody>
              {result.calculationSteps.map((st) => (
                <tr key={st.stepNumber}>
                  <td className="border border-slate-400 p-1 font-sans">
                    <strong>
                      #{st.stepNumber} {st.title}
                    </strong>
                    <div className="text-[9px] text-slate-600">{st.methodStandard}</div>
                  </td>
                  <td className="border border-slate-400 p-1">
                    <div>Eq: {st.formula}</div>
                    <div>Calc: {st.substituted}</div>
                  </td>
                  <td className="border border-slate-400 p-1 font-bold">{st.resultValue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Conditional Pull Matrix */}
        <div>
          <div className="font-bold uppercase text-[11px] mb-1">
            Conditional Next-Blast Pull &amp; Minimum Support Schedule
          </div>
          <table className="w-full border-collapse border border-slate-400 text-[10px] font-mono">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 p-1 text-left">Pull</th>
                <th className="border border-slate-400 p-1 text-left">Exposed</th>
                <th className="border border-slate-400 p-1 text-left">FoS</th>
                <th className="border border-slate-400 p-1 text-left">Stand-Up (No/Sup)</th>
                <th className="border border-slate-400 p-1 text-left">Status</th>
                <th className="border border-slate-400 p-1 text-left">Required Action</th>
              </tr>
            </thead>
            <tbody>
              {result.conditionalPullMatrix.map((r) => (
                <tr key={r.pullM}>
                  <td className="border border-slate-400 p-1">{r.pullM.toFixed(1)}m</td>
                  <td className="border border-slate-400 p-1">{r.combinedExposedM.toFixed(1)}m</td>
                  <td className="border border-slate-400 p-1">{r.fos.toFixed(2)}</td>
                  <td className="border border-slate-400 p-1">
                    {r.unsupportedStandUpHrs.toFixed(1)}h / {r.supportedStandUpHrs.toFixed(1)}h
                  </td>
                  <td className="border border-slate-400 p-1 font-bold">{r.statusLabel}</td>
                  <td className="border border-slate-400 p-1 font-sans">{r.requiredUpgradeText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-4 grid grid-cols-2 gap-6 font-mono text-[11px]">
          <div className="border-t border-slate-700 pt-1">
            Shift Engineering Geologist: {input.geologistName} · Sign: _________________
          </div>
          <div className="border-t border-slate-700 pt-1">
            Shift In-Charge Clearance: [ ] ALLOWED &nbsp; [ ] HOLD · Sign: _________________
          </div>
        </div>
      </div>
    </>
  );
};
