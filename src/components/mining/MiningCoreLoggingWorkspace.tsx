import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Edit3,
  Download,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Compass,
  Award,
  Camera,
  FolderOpen,
  ChevronRight,
  Printer,
  X,
  PenTool,
  RotateCcw,
  Check,
  Database,
  Sparkles,
  Eye,
  FlaskConical,
  Box,
} from 'lucide-react';
import {
  MiningDrillHoleRecord,
  MiningCoreRun,
  MiningAssayInterval,
  MiningCoreBoxPhoto,
  MiningCoreLogSignOff,
} from '../../types/mining';
import {
  loadMiningDrillHoles,
  saveMiningDrillHoles,
  createMiningDrillHole,
  deleteMiningDrillHole,
  getActiveMiningDrillHoleId,
  setActiveMiningDrillHoleId,
} from '../../engine/miningStorageEngine';
import { IndustryMode } from '../../types/tunnel';

interface MiningCoreLoggingWorkspaceProps {
  onBackToMainWindow?: () => void;
  onChangeIndustryMode?: (mode: IndustryMode) => void;
  onSelectHole?: (hole: MiningDrillHoleRecord) => void;
}

type ActiveTab = 'metadata' | 'runs' | 'visual' | 'assays' | 'photos' | 'signoff';

const EXPLORATION_LITHOLOGIES: { name: string; color: string; code: string }[] = [
  { name: 'Smoky Ribbon Quartz Vein (Lode)', color: '#f59e0b', code: 'QV' },
  { name: 'Massive Sulfide Zone (Py-Cpy-Aspy)', color: '#dc2626', code: 'MSZ' },
  { name: 'Silicified Shear Zone (Ore Host)', color: '#d97706', code: 'SSZ' },
  { name: 'Hangingwall Amphibolite', color: '#065f46', code: 'AMP' },
  { name: 'Fine-Grained Metabasalt', color: '#1e3a8a', code: 'MBAS' },
  { name: 'Chlorite-Biotite Schist', color: '#0f766e', code: 'CBS' },
  { name: 'Quartz-Feldspar Porphyry Dyke', color: '#9333ea', code: 'QFP' },
  { name: 'Banded Iron Formation (BIF)', color: '#991b1b', code: 'BIF' },
  { name: 'Graphitic Phyllite / Fault Gouge', color: '#334155', code: 'GPH' },
  { name: 'Footwall Granodiorite / Gneiss', color: '#be185d', code: 'GRD' },
  { name: 'Dolerite Dyke (Post-Mineral)', color: '#475569', code: 'DOL' },
];

const ALTERATION_STYLES = [
  'Unaltered / Fresh',
  'Intense Silicification + Sericite',
  'Moderate Silicification + Carbonate',
  'Chlorite-Biotite-Epidote (Propylitic)',
  'Sericite-Pyrite (Phyllic)',
  'Potassic (Biotite / K-Feldspar)',
  'Argillic / Clay-Gouge',
  'Carbonate-Ankerite-Quartz',
];

const WEATHERING_GRADES: { value: MiningCoreRun['weatheringGrade']; label: string }[] = [
  { value: 'FRESH', label: 'W1 - Fresh (Unweathered)' },
  { value: 'SLIGHT', label: 'W2 - Slightly Weathered' },
  { value: 'MODERATE', label: 'W3 - Moderately Weathered' },
  { value: 'HIGH', label: 'W4 - Highly Weathered' },
  { value: 'COMPLETE', label: 'W5 - Completely Weathered' },
];

const ROCK_STRENGTH_OPTIONS = [
  'R0 - Extremely Weak (<1 MPa)',
  'R1 - Very Weak (1-5 MPa)',
  'R2 - Weak (5-25 MPa)',
  'R3 - Medium Strong (25-50 MPa)',
  'R4 - Strong (50-100 MPa)',
  'R5 - Very Strong (100-250 MPa)',
  'R6 - Extremely Strong (>250 MPa)',
];

function getRqdRatingInfo(rqd: number): { label: string; colorClass: string; barColor: string } {
  if (rqd >= 90) return { label: 'Excellent', colorClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60', barColor: '#10b981' };
  if (rqd >= 75) return { label: 'Good', colorClass: 'bg-teal-950/80 text-teal-300 border-teal-700/60', barColor: '#14b8a6' };
  if (rqd >= 50) return { label: 'Fair', colorClass: 'bg-amber-950/80 text-amber-300 border-amber-700/60', barColor: '#f59e0b' };
  if (rqd >= 25) return { label: 'Poor', colorClass: 'bg-orange-950/80 text-orange-300 border-orange-700/60', barColor: '#f97316' };
  return { label: 'Very Poor', colorClass: 'bg-red-950/80 text-red-300 border-red-700/60', barColor: '#ef4444' };
}

/**
 * Calculates true dip & dip direction from oriented core Alpha (0-90°) and Beta (0-360°)
 * relative to drillhole plunge and azimuth.
 */
function calculateOrientedStructureTrueAttitude(
  holeDipDeg: number,
  holeAzimuthDeg: number,
  alphaDeg: number,
  betaDeg: number
): { trueDip: number; trueDipDir: number } {
  const alphaRad = (Math.max(0, Math.min(90, alphaDeg)) * Math.PI) / 180;
  const betaRad = (((betaDeg % 360) + 360) % 360) * (Math.PI / 180);
  const plungeRad = (Math.abs(holeDipDeg) * Math.PI) / 180;
  const azRad = (holeAzimuthDeg * Math.PI) / 180;

  // Pole in core frame (z along core axis downwards, x along BOH line)
  const nxCore = Math.cos(alphaRad) * Math.cos(betaRad);
  const nyCore = Math.cos(alphaRad) * Math.sin(betaRad);
  const nzCore = -Math.sin(alphaRad);

  // Rotate from core frame to ENU geographic frame
  const sinP = Math.sin(plungeRad);
  const cosP = Math.cos(plungeRad);
  const sinA = Math.sin(azRad);
  const cosA = Math.cos(azRad);

  const nEast = nxCore * sinP * sinA + nyCore * cosA + nzCore * cosP * sinA;
  const nNorth = nxCore * sinP * cosA - nyCore * sinA + nzCore * cosP * cosA;
  const nUp = nxCore * cosP - nzCore * sinP;

  const trueDipRad = Math.acos(Math.min(1, Math.abs(nUp)));
  const trueDip = Math.round((trueDipRad * 180) / Math.PI);

  let dipDirDeg = (Math.atan2(nUp >= 0 ? -nEast : nEast, nUp >= 0 ? -nNorth : nNorth) * 180) / Math.PI;
  dipDirDeg = Math.round((dipDirDeg + 360) % 360);

  return { trueDip, trueDipDir: dipDirDeg };
}

export const MiningCoreLoggingWorkspace: React.FC<MiningCoreLoggingWorkspaceProps> = ({
  onBackToMainWindow,
  onSelectHole,
}) => {
  const [holes, setHoles] = useState<MiningDrillHoleRecord[]>(() => loadMiningDrillHoles());
  const [activeHoleId, setActiveHoleId] = useState<string>(() => {
    const savedId = getActiveMiningDrillHoleId();
    const loaded = loadMiningDrillHoles();
    if (savedId && loaded.some((h) => h.id === savedId)) return savedId;
    return loaded[0]?.id || '';
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('runs');
  const [selectedBoxIndex, setSelectedBoxIndex] = useState<number>(0);

  // Modals state
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [editingRunNumber, setEditingRunNumber] = useState<number | null>(null);

  const [isNewHoleModalOpen, setIsNewHoleModalOpen] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [confirmDeleteHole, setConfirmDeleteHole] = useState(false);

  // Assay modal state
  const [isAssayModalOpen, setIsAssayModalOpen] = useState(false);
  const [editingAssaySampleId, setEditingAssaySampleId] = useState<string | null>(null);
  const [assayForm, setAssayForm] = useState<MiningAssayInterval>({
    sampleId: 'SAM-1001',
    fromDepthM: 0,
    toDepthM: 1.5,
    intervalLengthM: 1.5,
    primaryAssayGrade: 0,
    primaryGradeUnit: 'g/t Au',
    secondaryAssayGrade: 0,
    secondaryGradeUnit: '% Cu',
    specificGravityEstimated: 2.8,
    qaqcCategory: 'NORMAL_SAMPLE',
    qaqcPass: true,
    assayLaboratory: 'SGS Geochemical Lab',
    certificateNumber: '',
  });

  // Photo modal state
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [photoForm, setPhotoForm] = useState<{
    boxNumber: number;
    fromDepth: number;
    toDepth: number;
    condition: 'Wet' | 'Dry' | 'Natural';
    imageUrl: string;
    caption: string;
    dateTaken: string;
  }>({
    boxNumber: 1,
    fromDepth: 0,
    toDepth: 6,
    condition: 'Wet',
    imageUrl: '',
    caption: '',
    dateTaken: new Date().toISOString().slice(0, 10),
  });

  // Signature Pad modal state
  const [signingParty, setSigningParty] = useState<'contractor' | 'consultant' | 'client' | null>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingSig, setIsDrawingSig] = useState(false);

  // New Hole Form state
  const [newHoleForm, setNewHoleForm] = useState({
    holeId: '',
    targetOreZone: 'Champion Main Lode',
    purpose: 'EXPLORATION' as MiningDrillHoleRecord['purpose'],
    coreDiameter: 'HQ' as MiningDrillHoleRecord['coreDiameter'],
    drillingMethod: 'Wireline Triple-Tube Diamond Core',
    collarEasting: 48250,
    collarNorthing: 12500,
    collarElevationMrl: 620,
    collarDipDeg: -60,
    collarAzimuthDeg: 90,
    totalDrilledDepthM: 150,
    drillingContractor: '',
    explorationConsultant: '',
    miningCompany: '',
    loggedBy: '',
    cutOffGrade: 1.5,
    primaryGradeUnit: 'g/t Au',
  });

  // Run Form state
  const [runForm, setRunForm] = useState<MiningCoreRun>({
    runNumber: 1,
    fromDepthM: 0,
    toDepthM: 3.0,
    drilledLengthM: 3.0,
    recoveredLengthM: 2.9,
    coreRecoveryPercent: 96.7,
    solidCoreLengthRqdM: 2.5,
    rqdPercent: 83.3,
    fracturesPerMeter: 3,
    pointLoadIs50Mpa: 5.5,
    lithology: 'Hangingwall Amphibolite',
    lithologyColor: '#065f46',
    rockStrength: 'R4 - Strong (50-100 MPa)',
    weatheringGrade: 'FRESH',
    alteration: 'Unaltered / Fresh',
    alterationIntensity: 1,
    mineralization: 'Trace disseminated pyrite (<1%)',
    sulfidePercent: 0.5,
    oreZoneCategory: 'WASTE',
    veinDensityPerM: 1,
    structureType: 'FOLIATION',
    structureDipToCoreAxisDeg: 55,
    betaAngleDeg: 180,
    jointRoughness: 'Rough Undulating',
    jointAlteration: 'Unaltered (Ja=1)',
    infilling: 'Quartz-Calcite',
    waterCondition: 'Dry',
    boxNumber: 1,
    sampleId: '',
    qaqcType: 'REGULAR',
    assayGradeAu: 0,
    assayGradeCu: 0,
    specificGravity: 2.78,
    geologistNotes: '',
  });

  const activeHole = useMemo(() => {
    return holes.find((h) => h.id === activeHoleId) || holes[0];
  }, [holes, activeHoleId]);

  useEffect(() => {
    if (activeHole && onSelectHole) {
      onSelectHole(activeHole);
    }
  }, [activeHole, onSelectHole]);

  // Persist changes to active hole
  const updateActiveHole = (updater: (hole: MiningDrillHoleRecord) => MiningDrillHoleRecord) => {
    if (!activeHole) return;
    const updatedHole = updater(activeHole);

    // Recompute summary statistics strictly from user-logged runs
    const runs = [...(updatedHole.runs || [])].sort((a, b) => a.fromDepthM - b.fromDepthM);
    let totalDrilled = 0;
    let totalRec = 0;
    let totalSolid = 0;
    runs.forEach((r) => {
      const len = Math.max(0, r.toDepthM - r.fromDepthM);
      totalDrilled += len;
      totalRec += Math.min(len, Math.max(0, r.recoveredLengthM));
      totalSolid += Math.min(len, Math.max(0, r.solidCoreLengthRqdM));
    });

    const overallRecoveryPercent = totalDrilled > 0 ? Number(((totalRec / totalDrilled) * 100).toFixed(1)) : 0;
    const overallRqdPercent = totalDrilled > 0 ? Number(((totalSolid / totalDrilled) * 100).toFixed(1)) : 0;

    const cutOff = updatedHole.cutOffGrade ?? 1.5;
    const unit = updatedHole.primaryGradeUnit || 'g/t Au';
    const oreRuns = runs.filter((r) => (r.assayGradeAu ?? 0) >= cutOff);
    let interceptSummary = 'Awaiting User Input';
    if (runs.length > 0) {
      if (oreRuns.length > 0) {
        let oreLen = 0;
        let weightedSum = 0;
        let minFrom = Infinity;
        let maxTo = -Infinity;
        oreRuns.forEach((r) => {
          const l = Math.max(0, r.toDepthM - r.fromDepthM);
          oreLen += l;
          weightedSum += l * (r.assayGradeAu || 0);
          if (r.fromDepthM < minFrom) minFrom = r.fromDepthM;
          if (r.toDepthM > maxTo) maxTo = r.toDepthM;
        });
        const avgGrade = oreLen > 0 ? weightedSum / oreLen : 0;
        interceptSummary = `${oreLen.toFixed(2)}m @ ${avgGrade.toFixed(2)} ${unit} (from ${minFrom.toFixed(1)}m to ${maxTo.toFixed(1)}m)`;
      } else {
        interceptSummary = `No intervals >= ${cutOff} ${unit} cut-off`;
      }
    }

    const finalizedHole: MiningDrillHoleRecord = {
      ...updatedHole,
      runs,
      overallRecoveryPercent,
      overallRqdPercent,
      significantInterceptsSummary: interceptSummary,
      updatedAt: new Date().toISOString(),
    };

    const nextHoles = holes.map((h) => (h.id === finalizedHole.id ? finalizedHole : h));
    setHoles(nextHoles);
    saveMiningDrillHoles(nextHoles);
  };

  // Summary statistics
  const holeStats = useMemo(() => {
    if (!activeHole || !activeHole.runs || activeHole.runs.length === 0) {
      return {
        totalDrilled: 0,
        totalRecovered: 0,
        totalSolidRqd: 0,
        avgTcr: 0,
        avgRqd: 0,
        rqdRating: 'Awaiting Input',
        oreLength: 0,
        compositeGrade: 0,
        gramMeters: 0,
        boxCount: 0,
        hasInput: false,
      };
    }

    let totalDrilled = 0;
    let totalRecovered = 0;
    let totalSolidRqd = 0;
    let oreLength = 0;
    let oreWeightedSum = 0;
    const cutOff = activeHole.cutOffGrade ?? 1.5;
    const boxes = new Set<number>();

    activeHole.runs.forEach((r, idx) => {
      const len = Math.max(0, r.toDepthM - r.fromDepthM);
      totalDrilled += len;
      totalRecovered += Math.min(len, Math.max(0, r.recoveredLengthM));
      totalSolidRqd += Math.min(len, Math.max(0, r.solidCoreLengthRqdM));
      boxes.add(r.boxNumber || Math.floor(idx / 3) + 1);

      const grade = r.assayGradeAu ?? 0;
      if (grade >= cutOff && len > 0) {
        oreLength += len;
        oreWeightedSum += len * grade;
      }
    });

    // Also check assayIntervals if runs don't have assayGradeAu
    if (oreLength === 0 && activeHole.assayIntervals && activeHole.assayIntervals.length > 0) {
      activeHole.assayIntervals.forEach((a) => {
        if (a.qaqcCategory === 'NORMAL_SAMPLE' && a.primaryAssayGrade >= cutOff) {
          const len = Math.max(0, a.toDepthM - a.fromDepthM);
          oreLength += len;
          oreWeightedSum += len * a.primaryAssayGrade;
        }
      });
    }

    const avgTcr = totalDrilled > 0 ? (totalRecovered / totalDrilled) * 100 : 0;
    const avgRqd = totalDrilled > 0 ? (totalSolidRqd / totalDrilled) * 100 : 0;
    const rqdInfo = getRqdRatingInfo(avgRqd);
    const compositeGrade = oreLength > 0 ? oreWeightedSum / oreLength : 0;

    return {
      totalDrilled,
      totalRecovered,
      totalSolidRqd,
      avgTcr,
      avgRqd,
      rqdRating: rqdInfo.label,
      oreLength,
      compositeGrade,
      gramMeters: oreLength * compositeGrade,
      boxCount: boxes.size,
      hasInput: true,
    };
  }, [activeHole]);

  // Group runs into Core Boxes for Virtual Core Box Viewer
  const coreBoxes = useMemo(() => {
    if (!activeHole || !activeHole.runs || activeHole.runs.length === 0) return [];
    const map = new Map<number, MiningCoreRun[]>();
    activeHole.runs.forEach((run, i) => {
      const bNum = run.boxNumber || Math.floor(i / 3) + 1;
      const list = map.get(bNum) || [];
      list.push(run);
      map.set(bNum, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([boxNumber, runs]) => ({
        boxNumber,
        fromDepth: Math.min(...runs.map((r) => r.fromDepthM)),
        toDepth: Math.max(...runs.map((r) => r.toDepthM)),
        runs,
      }));
  }, [activeHole]);

  // Handlers for Create / Delete Hole
  const handleOpenCreateHole = () => {
    setNewHoleForm({
      holeId: `DDH-KD-${String(holes.length + 1).padStart(3, '0')}`,
      targetOreZone: activeHole?.targetOreZone || 'Champion Main Lode',
      purpose: 'EXPLORATION',
      coreDiameter: 'HQ',
      drillingMethod: 'Wireline Triple-Tube Diamond Core',
      collarEasting: activeHole?.collarEasting || 48250,
      collarNorthing: activeHole?.collarNorthing || 12500,
      collarElevationMrl: activeHole?.collarElevationMrl || 620,
      collarDipDeg: -60,
      collarAzimuthDeg: 90,
      totalDrilledDepthM: 150,
      drillingContractor: activeHole?.drillingContractor || '',
      explorationConsultant: activeHole?.explorationConsultant || '',
      miningCompany: activeHole?.miningCompany || '',
      loggedBy: activeHole?.loggedBy || '',
      cutOffGrade: activeHole?.cutOffGrade ?? 1.5,
      primaryGradeUnit: activeHole?.primaryGradeUnit || 'g/t Au',
    });
    setIsNewHoleModalOpen(true);
  };

  const handleCreateHoleSubmit = () => {
    const created = createMiningDrillHole({
      holeId: newHoleForm.holeId.trim() || `DDH-KD-${String(holes.length + 1).padStart(3, '0')}`,
      targetOreZone: newHoleForm.targetOreZone,
      purpose: newHoleForm.purpose,
      coreDiameter: newHoleForm.coreDiameter,
      drillingMethod: newHoleForm.drillingMethod,
      collarEasting: Number(newHoleForm.collarEasting) || 0,
      collarNorthing: Number(newHoleForm.collarNorthing) || 0,
      collarElevationMrl: Number(newHoleForm.collarElevationMrl) || 0,
      collarDipDeg: Number(newHoleForm.collarDipDeg) || -60,
      collarAzimuthDeg: Number(newHoleForm.collarAzimuthDeg) || 90,
      totalDrilledDepthM: Number(newHoleForm.totalDrilledDepthM) || 0,
      drillingContractor: newHoleForm.drillingContractor,
      explorationConsultant: newHoleForm.explorationConsultant,
      miningCompany: newHoleForm.miningCompany,
      loggedBy: newHoleForm.loggedBy,
      cutOffGrade: Number(newHoleForm.cutOffGrade) || 1.5,
      primaryGradeUnit: newHoleForm.primaryGradeUnit || 'g/t Au',
      runs: [],
      assayIntervals: [],
      coreBoxPhotos: [],
    });
    const reloaded = loadMiningDrillHoles();
    setHoles(reloaded);
    setActiveHoleId(created.id);
    setActiveMiningDrillHoleId(created.id);
    setIsNewHoleModalOpen(false);
    setActiveTab('metadata');
  };

  const handleDeleteCurrentHole = () => {
    if (!activeHole || holes.length <= 1) return;
    deleteMiningDrillHole(activeHole.id);
    const remaining = loadMiningDrillHoles();
    setHoles(remaining);
    if (remaining.length > 0) {
      setActiveHoleId(remaining[0].id);
      setActiveMiningDrillHoleId(remaining[0].id);
    }
    setConfirmDeleteHole(false);
  };

  // Handlers for Add / Edit Core Run
  const handleOpenAddRun = () => {
    const runs = activeHole?.runs || [];
    const lastRun = runs.length > 0 ? runs[runs.length - 1] : null;
    const nextFrom = lastRun ? Number(lastRun.toDepthM.toFixed(2)) : 0;
    const nextTo = Number((nextFrom + 3.0).toFixed(2));
    const nextBox = lastRun?.boxNumber ? (runs.filter((r) => r.boxNumber === lastRun.boxNumber).length >= 3 ? lastRun.boxNumber + 1 : lastRun.boxNumber) : 1;

    setEditingRunNumber(null);
    setRunForm({
      runNumber: runs.length + 1,
      fromDepthM: nextFrom,
      toDepthM: nextTo,
      drilledLengthM: 3.0,
      recoveredLengthM: 2.9,
      coreRecoveryPercent: 96.7,
      solidCoreLengthRqdM: 2.5,
      rqdPercent: 83.3,
      fracturesPerMeter: 3,
      pointLoadIs50Mpa: 5.5,
      lithology: lastRun?.lithology || 'Hangingwall Amphibolite',
      lithologyColor: lastRun?.lithologyColor || '#065f46',
      rockStrength: lastRun?.rockStrength || 'R4 - Strong (50-100 MPa)',
      weatheringGrade: 'FRESH',
      alteration: lastRun?.alteration || 'Unaltered / Fresh',
      alterationIntensity: lastRun?.alterationIntensity ?? 1,
      mineralization: lastRun?.mineralization || 'Trace disseminated pyrite (<1%)',
      sulfidePercent: lastRun?.sulfidePercent ?? 0.5,
      oreZoneCategory: 'WASTE',
      veinDensityPerM: 1,
      structureType: 'FOLIATION',
      structureDipToCoreAxisDeg: 55,
      betaAngleDeg: 180,
      jointRoughness: 'Rough Undulating',
      jointAlteration: 'Unaltered (Ja=1)',
      infilling: 'Quartz-Calcite',
      waterCondition: 'Dry',
      boxNumber: nextBox,
      sampleId: `SAM-${activeHole?.holeId || 'DDH'}-${String(runs.length + 1).padStart(2, '0')}`,
      qaqcType: 'REGULAR',
      assayGradeAu: 0,
      assayGradeCu: 0,
      specificGravity: 2.78,
      geologistNotes: '',
    });
    setIsRunModalOpen(true);
  };

  const handleOpenEditRun = (run: MiningCoreRun) => {
    setEditingRunNumber(run.runNumber);
    setRunForm({
      ...run,
      lithologyColor:
        run.lithologyColor ||
        EXPLORATION_LITHOLOGIES.find((l) => l.name === run.lithology)?.color ||
        '#065f46',
      rockStrength: run.rockStrength || 'R4 - Strong (50-100 MPa)',
      alterationIntensity: run.alterationIntensity ?? 2,
      sulfidePercent: run.sulfidePercent ?? 1,
      oreZoneCategory: run.oreZoneCategory || ((run.assayGradeAu ?? 0) >= (activeHole?.cutOffGrade ?? 1.5) ? 'HIGH_GRADE' : 'WASTE'),
      betaAngleDeg: run.betaAngleDeg ?? 180,
      jointRoughness: run.jointRoughness || 'Rough Undulating',
      jointAlteration: run.jointAlteration || 'Unaltered (Ja=1)',
      infilling: run.infilling || 'Quartz-Sulfide',
      waterCondition: run.waterCondition || 'Dry',
      boxNumber: run.boxNumber || 1,
      sampleId: run.sampleId || `SAM-${run.runNumber}`,
      qaqcType: run.qaqcType || 'REGULAR',
      assayGradeAu: run.assayGradeAu ?? 0,
      assayGradeCu: run.assayGradeCu ?? 0,
      specificGravity: run.specificGravity ?? 2.8,
    });
    setIsRunModalOpen(true);
  };

  const handleSaveRun = () => {
    const from = Math.max(0, Number(runForm.fromDepthM) || 0);
    const to = Math.max(from + 0.1, Number(runForm.toDepthM) || from + 1.0);
    const runLen = Number((to - from).toFixed(2));
    const rec = Math.min(runLen, Math.max(0, Number(runForm.recoveredLengthM) || 0));
    const solid = Math.min(rec, Math.max(0, Number(runForm.solidCoreLengthRqdM) || 0));
    const tcr = runLen > 0 ? Number(((rec / runLen) * 100).toFixed(1)) : 0;
    const rqd = runLen > 0 ? Number(((solid / runLen) * 100).toFixed(1)) : 0;

    const finalizedRun: MiningCoreRun = {
      ...runForm,
      fromDepthM: from,
      toDepthM: to,
      drilledLengthM: runLen,
      recoveredLengthM: rec,
      coreRecoveryPercent: tcr,
      solidCoreLengthRqdM: solid,
      rqdPercent: rqd,
    };

    updateActiveHole((hole) => {
      let nextRuns: MiningCoreRun[];
      if (editingRunNumber !== null) {
        nextRuns = hole.runs.map((r) => (r.runNumber === editingRunNumber ? finalizedRun : r));
      } else {
        nextRuns = [...hole.runs, finalizedRun];
      }
      nextRuns = nextRuns
        .sort((a, b) => a.fromDepthM - b.fromDepthM)
        .map((r, i) => ({ ...r, runNumber: i + 1 }));

      // Also sync assay interval if sampleId or assayGradeAu is provided
      let nextAssays = [...(hole.assayIntervals || [])];
      if (finalizedRun.sampleId && finalizedRun.sampleId.trim() !== '') {
        const existingIdx = nextAssays.findIndex((a) => a.sampleId === finalizedRun.sampleId);
        const syncedAssay: MiningAssayInterval = {
          sampleId: finalizedRun.sampleId.trim(),
          fromDepthM: finalizedRun.fromDepthM,
          toDepthM: finalizedRun.toDepthM,
          intervalLengthM: finalizedRun.drilledLengthM,
          primaryAssayGrade: Number(finalizedRun.assayGradeAu) || 0,
          primaryGradeUnit: hole.primaryGradeUnit || 'g/t Au',
          secondaryAssayGrade: Number(finalizedRun.assayGradeCu) || 0,
          secondaryGradeUnit: '% Cu',
          specificGravityEstimated: Number(finalizedRun.specificGravity) || 2.8,
          qaqcCategory:
            finalizedRun.qaqcType === 'CRM_STANDARD'
              ? 'CRM_STANDARD'
              : finalizedRun.qaqcType === 'COARSE_BLANK'
              ? 'COARSE_BLANK'
              : finalizedRun.qaqcType === 'DUPLICATE'
              ? 'PULP_DUPLICATE'
              : 'NORMAL_SAMPLE',
          qaqcPass: true,
          assayLaboratory: 'On-Site Exploration Geochem Lab',
        };
        if (existingIdx >= 0) {
          nextAssays[existingIdx] = syncedAssay;
        } else {
          nextAssays.push(syncedAssay);
        }
      }

      return {
        ...hole,
        runs: nextRuns,
        assayIntervals: nextAssays,
      };
    });

    setIsRunModalOpen(false);
  };

  const handleDeleteRun = (runNumber: number) => {
    updateActiveHole((hole) => {
      const filtered = hole.runs
        .filter((r) => r.runNumber !== runNumber)
        .sort((a, b) => a.fromDepthM - b.fromDepthM)
        .map((r, idx) => ({ ...r, runNumber: idx + 1 }));
      return { ...hole, runs: filtered };
    });
  };

  // Optional Sample Loader (never auto-fed, only on explicit user click)
  const handleLoadSampleExplorationHole = () => {
    const sampleRuns: MiningCoreRun[] = [
      {
        runNumber: 1,
        fromDepthM: 0.0,
        toDepthM: 3.0,
        drilledLengthM: 3.0,
        recoveredLengthM: 2.88,
        coreRecoveryPercent: 96.0,
        solidCoreLengthRqdM: 2.4,
        rqdPercent: 80.0,
        fracturesPerMeter: 4,
        pointLoadIs50Mpa: 5.2,
        lithology: 'Hangingwall Amphibolite',
        lithologyColor: '#065f46',
        rockStrength: 'R4 - Strong (50-100 MPa)',
        weatheringGrade: 'SLIGHT',
        alteration: 'Chlorite-Biotite-Epidote (Propylitic)',
        alterationIntensity: 2,
        mineralization: 'Trace Pyrite (<1%)',
        sulfidePercent: 0.5,
        oreZoneCategory: 'WASTE',
        veinDensityPerM: 1,
        structureType: 'FOLIATION',
        structureDipToCoreAxisDeg: 62,
        betaAngleDeg: 175,
        jointRoughness: 'Rough Undulating',
        jointAlteration: 'Unaltered (Ja=1)',
        infilling: 'Calcite',
        waterCondition: 'Dry',
        boxNumber: 1,
        sampleId: 'SAM-001',
        qaqcType: 'REGULAR',
        assayGradeAu: 0.35,
        assayGradeCu: 0.08,
        specificGravity: 2.78,
        geologistNotes: 'Competent hangingwall amphibolite with weak chlorite',
      },
      {
        runNumber: 2,
        fromDepthM: 3.0,
        toDepthM: 6.0,
        drilledLengthM: 3.0,
        recoveredLengthM: 2.95,
        coreRecoveryPercent: 98.3,
        solidCoreLengthRqdM: 2.7,
        rqdPercent: 90.0,
        fracturesPerMeter: 3,
        pointLoadIs50Mpa: 6.8,
        lithology: 'Silicified Shear Zone (Ore Host)',
        lithologyColor: '#d97706',
        rockStrength: 'R4 - Strong (50-100 MPa)',
        weatheringGrade: 'FRESH',
        alteration: 'Moderate Silicification + Carbonate',
        alterationIntensity: 4,
        mineralization: 'Disseminated Pyrite & Arsenopyrite (3-5%)',
        sulfidePercent: 4.2,
        oreZoneCategory: 'MEDIUM_GRADE',
        veinDensityPerM: 5,
        structureType: 'SHEAR',
        structureDipToCoreAxisDeg: 48,
        betaAngleDeg: 190,
        jointRoughness: 'Smooth Planar',
        jointAlteration: 'Slightly Altered (Ja=2)',
        infilling: 'Quartz-Ankerite',
        waterCondition: 'Damp',
        boxNumber: 1,
        sampleId: 'SAM-002',
        qaqcType: 'REGULAR',
        assayGradeAu: 3.45,
        assayGradeCu: 0.62,
        specificGravity: 2.95,
        geologistNotes: 'Sheared hangingwall lode margin with quartz stringers',
      },
      {
        runNumber: 3,
        fromDepthM: 6.0,
        toDepthM: 9.0,
        drilledLengthM: 3.0,
        recoveredLengthM: 3.0,
        coreRecoveryPercent: 100.0,
        solidCoreLengthRqdM: 2.85,
        rqdPercent: 95.0,
        fracturesPerMeter: 2,
        pointLoadIs50Mpa: 8.4,
        lithology: 'Smoky Ribbon Quartz Vein (Lode)',
        lithologyColor: '#f59e0b',
        rockStrength: 'R5 - Very Strong (100-250 MPa)',
        weatheringGrade: 'FRESH',
        alteration: 'Intense Silicification + Sericite',
        alterationIntensity: 5,
        mineralization: 'Semi-massive Pyrite, Chalcopyrite, Galena & Visible Gold',
        sulfidePercent: 12.5,
        oreZoneCategory: 'HIGH_GRADE',
        veinDensityPerM: 12,
        structureType: 'VEIN',
        structureDipToCoreAxisDeg: 70,
        betaAngleDeg: 182,
        jointRoughness: 'Rough Undulating',
        jointAlteration: 'Unaltered (Ja=1)',
        infilling: 'Quartz-Sulfide-Gold',
        waterCondition: 'Dry',
        boxNumber: 2,
        sampleId: 'SAM-003',
        qaqcType: 'REGULAR',
        assayGradeAu: 11.80,
        assayGradeCu: 1.95,
        specificGravity: 3.42,
        geologistNotes: 'Main Champion Lode intercept: laminated smoky quartz with visible gold specks at 7.4m',
      },
      {
        runNumber: 4,
        fromDepthM: 9.0,
        toDepthM: 12.0,
        drilledLengthM: 3.0,
        recoveredLengthM: 2.91,
        coreRecoveryPercent: 97.0,
        solidCoreLengthRqdM: 2.46,
        rqdPercent: 82.0,
        fracturesPerMeter: 4,
        pointLoadIs50Mpa: 6.1,
        lithology: 'Fine-Grained Metabasalt',
        lithologyColor: '#1e3a8a',
        rockStrength: 'R4 - Strong (50-100 MPa)',
        weatheringGrade: 'FRESH',
        alteration: 'Chlorite-Biotite-Epidote (Propylitic)',
        alterationIntensity: 2,
        mineralization: 'Minor chalcopyrite blebs (1%)',
        sulfidePercent: 1.0,
        oreZoneCategory: 'LOW_GRADE',
        veinDensityPerM: 2,
        structureType: 'JOINT',
        structureDipToCoreAxisDeg: 52,
        betaAngleDeg: 210,
        jointRoughness: 'Rough Undulating',
        jointAlteration: 'Unaltered (Ja=1)',
        infilling: 'Epidote-Quartz',
        waterCondition: 'Dry',
        boxNumber: 2,
        sampleId: 'SAM-004',
        qaqcType: 'REGULAR',
        assayGradeAu: 1.15,
        assayGradeCu: 0.25,
        specificGravity: 2.84,
        geologistNotes: 'Sharp footwall contact at 9.2m into massive metabasalt',
      },
    ];

    const sampleAssays: MiningAssayInterval[] = sampleRuns.map((r) => ({
      sampleId: r.sampleId || `SAM-00${r.runNumber}`,
      fromDepthM: r.fromDepthM,
      toDepthM: r.toDepthM,
      intervalLengthM: r.drilledLengthM,
      primaryAssayGrade: r.assayGradeAu || 0,
      primaryGradeUnit: activeHole?.primaryGradeUnit || 'g/t Au',
      secondaryAssayGrade: r.assayGradeCu || 0,
      secondaryGradeUnit: '% Cu',
      specificGravityEstimated: r.specificGravity || 2.8,
      qaqcCategory: 'NORMAL_SAMPLE',
      qaqcPass: true,
      assayLaboratory: 'SGS Geochemical Lab',
      certificateNumber: 'CERT-2025-DDH01',
    }));

    updateActiveHole((hole) => ({
      ...hole,
      runs: sampleRuns,
      assayIntervals: sampleAssays,
    }));
  };

  // Assay Handlers
  const handleOpenAddAssay = (qaqcCategory: MiningAssayInterval['qaqcCategory'] = 'NORMAL_SAMPLE') => {
    const assays = activeHole?.assayIntervals || [];
    const last = assays.length > 0 ? assays[assays.length - 1] : null;
    const from = last ? last.toDepthM : 0;
    const to = qaqcCategory === 'CRM_STANDARD' || qaqcCategory === 'COARSE_BLANK' ? from : Number((from + 1.5).toFixed(2));
    setEditingAssaySampleId(null);
    setAssayForm({
      sampleId:
        qaqcCategory === 'CRM_STANDARD'
          ? `CRM-STD-${assays.length + 1}`
          : qaqcCategory === 'COARSE_BLANK'
          ? `BLK-${assays.length + 1}`
          : `SAM-${String(assays.length + 1).padStart(3, '0')}`,
      fromDepthM: from,
      toDepthM: to,
      intervalLengthM: Number((to - from).toFixed(2)),
      primaryAssayGrade: qaqcCategory === 'COARSE_BLANK' ? 0.01 : 0,
      primaryGradeUnit: activeHole?.primaryGradeUnit || 'g/t Au',
      secondaryAssayGrade: 0,
      secondaryGradeUnit: '% Cu',
      specificGravityEstimated: 2.85,
      qaqcCategory,
      qaqcPass: true,
      assayLaboratory: 'SGS Geochemical Lab',
      certificateNumber: '',
    });
    setIsAssayModalOpen(true);
  };

  const handleSaveAssay = () => {
    const from = Math.max(0, Number(assayForm.fromDepthM) || 0);
    const to = Math.max(from, Number(assayForm.toDepthM) || from);
    const len = Number((to - from).toFixed(2));
    const entry: MiningAssayInterval = {
      ...assayForm,
      fromDepthM: from,
      toDepthM: to,
      intervalLengthM: len,
      primaryAssayGrade: Number(assayForm.primaryAssayGrade) || 0,
      secondaryAssayGrade: Number(assayForm.secondaryAssayGrade) || 0,
      specificGravityEstimated: Number(assayForm.specificGravityEstimated) || 2.8,
    };

    updateActiveHole((hole) => {
      const list = [...(hole.assayIntervals || [])];
      if (editingAssaySampleId) {
        const idx = list.findIndex((a) => a.sampleId === editingAssaySampleId);
        if (idx >= 0) list[idx] = entry;
      } else {
        list.push(entry);
      }
      return { ...hole, assayIntervals: list };
    });
    setIsAssayModalOpen(false);
  };

  const handleDeleteAssay = (sampleId: string) => {
    updateActiveHole((hole) => ({
      ...hole,
      assayIntervals: (hole.assayIntervals || []).filter((a) => a.sampleId !== sampleId),
    }));
  };

  // Core Box Photo Handlers
  const handleSavePhoto = () => {
    if (!photoForm.imageUrl) return;
    const entry: MiningCoreBoxPhoto = {
      id: editingPhotoId || `PHOTO-${Date.now()}`,
      boxNumber: Number(photoForm.boxNumber) || 1,
      fromDepth: Number(photoForm.fromDepth) || 0,
      toDepth: Number(photoForm.toDepth) || 6,
      condition: photoForm.condition,
      imageUrl: photoForm.imageUrl,
      caption: photoForm.caption,
      dateTaken: photoForm.dateTaken,
    };

    updateActiveHole((hole) => {
      const list = [...(hole.coreBoxPhotos || [])];
      if (editingPhotoId) {
        const idx = list.findIndex((p) => p.id === editingPhotoId);
        if (idx >= 0) list[idx] = entry;
      } else {
        list.push(entry);
      }
      return { ...hole, coreBoxPhotos: list.sort((a, b) => a.boxNumber - b.boxNumber) };
    });
    setIsPhotoModalOpen(false);
  };

  // CSV Export
  const handleExportCsv = () => {
    if (!activeHole) return;
    const headers = [
      'Hole_ID',
      'Run_No',
      'From_m',
      'To_m',
      'Length_m',
      'Recovered_m',
      'TCR_Pct',
      'Solid_Core_10cm_m',
      'RQD_Pct',
      'FF_per_m',
      'Is50_MPa',
      'Lithology',
      'Weathering',
      'Rock_Strength',
      'Alteration',
      'Alteration_Intensity',
      'Mineralization',
      'Sulfide_Pct',
      'Vein_Density_m',
      'Structure_Type',
      'Alpha_Deg',
      'Beta_Deg',
      'True_Dip_Deg',
      'True_DipDir_Deg',
      'Sample_ID',
      'QAQC_Type',
      'Assay_Primary',
      'Assay_Secondary_Cu_Pct',
      'SG',
      'Box_No',
      'Notes',
    ];
    const rows = activeHole.runs.map((r) => {
      const att = calculateOrientedStructureTrueAttitude(
        activeHole.collarDipDeg,
        activeHole.collarAzimuthDeg,
        r.structureDipToCoreAxisDeg,
        r.betaAngleDeg ?? 180
      );
      return [
        activeHole.holeId,
        r.runNumber,
        r.fromDepthM.toFixed(2),
        r.toDepthM.toFixed(2),
        r.drilledLengthM.toFixed(2),
        r.recoveredLengthM.toFixed(2),
        r.coreRecoveryPercent.toFixed(1),
        r.solidCoreLengthRqdM.toFixed(2),
        r.rqdPercent.toFixed(1),
        r.fracturesPerMeter,
        r.pointLoadIs50Mpa,
        `"${(r.lithology || '').replace(/"/g, '""')}"`,
        r.weatheringGrade,
        `"${(r.rockStrength || '').replace(/"/g, '""')}"`,
        `"${(r.alteration || '').replace(/"/g, '""')}"`,
        r.alterationIntensity ?? '',
        `"${(r.mineralization || '').replace(/"/g, '""')}"`,
        r.sulfidePercent ?? 0,
        r.veinDensityPerM,
        r.structureType,
        r.structureDipToCoreAxisDeg,
        r.betaAngleDeg ?? 180,
        att.trueDip,
        att.trueDipDir,
        r.sampleId || '',
        r.qaqcType || 'REGULAR',
        r.assayGradeAu ?? 0,
        r.assayGradeCu ?? 0,
        r.specificGravity ?? 2.8,
        r.boxNumber ?? 1,
        `"${(r.geologistNotes || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeHole.holeId}_Exploration_CoreLog.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // JSON Export / Import
  const handleExportJson = () => {
    if (!activeHole) return;
    const blob = new Blob([JSON.stringify(activeHole, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeHole.holeId}_Exploration_Drillhole.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed && parsed.holeId && Array.isArray(parsed.runs)) {
          const importedHole: MiningDrillHoleRecord = {
            ...parsed,
            id: parsed.id || `DH-${Date.now().toString(36).toUpperCase()}`,
            updatedAt: new Date().toISOString(),
          };
          const exists = holes.some((h) => h.id === importedHole.id);
          const next = exists
            ? holes.map((h) => (h.id === importedHole.id ? importedHole : h))
            : [importedHole, ...holes];
          setHoles(next);
          saveMiningDrillHoles(next);
          setActiveHoleId(importedHole.id);
          setActiveMiningDrillHoleId(importedHole.id);
        }
      } catch (err) {
        console.warn('Invalid Drillhole JSON file', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Signature Pad Drawing
  const startSigDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawingSig(true);
  };

  const moveSigDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingSig) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const endSigDraw = () => {
    setIsDrawingSig(false);
  };

  const clearSigCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSigCanvas = () => {
    if (!signingParty || !sigCanvasRef.current) return;
    const dataUrl = sigCanvasRef.current.toDataURL('image/png');
    updateActiveHole((hole) => {
      const signOff: MiningCoreLogSignOff = hole.signOff || {
        contractorRepName: '',
        contractorDesignation: 'Drilling Supervisor',
        contractorCompany: hole.drillingContractor || '',
        contractorDate: new Date().toISOString().slice(0, 10),
        consultantRepName: hole.loggedBy || '',
        consultantDesignation: 'Senior Exploration Geologist',
        consultantCompany: hole.explorationConsultant || '',
        consultantDate: new Date().toISOString().slice(0, 10),
        clientRepName: '',
        clientDesignation: 'Chief Mine Geologist (Competent Person)',
        clientCompany: hole.miningCompany || '',
        clientDate: new Date().toISOString().slice(0, 10),
      };
      if (signingParty === 'contractor') signOff.contractorSignatureUrl = dataUrl;
      if (signingParty === 'consultant') signOff.consultantSignatureUrl = dataUrl;
      if (signingParty === 'client') signOff.clientSignatureUrl = dataUrl;
      return { ...hole, signOff: { ...signOff } };
    });
    setSigningParty(null);
  };

  // Live preview of Run Modal auto-calculations
  const modalPreview = useMemo(() => {
    const len = Math.max(0, (Number(runForm.toDepthM) || 0) - (Number(runForm.fromDepthM) || 0));
    const rec = Math.min(len, Math.max(0, Number(runForm.recoveredLengthM) || 0));
    const solid = Math.min(rec, Math.max(0, Number(runForm.solidCoreLengthRqdM) || 0));
    const tcr = len > 0 ? (rec / len) * 100 : 0;
    const rqd = len > 0 ? (solid / len) * 100 : 0;
    const att = calculateOrientedStructureTrueAttitude(
      activeHole?.collarDipDeg ?? -60,
      activeHole?.collarAzimuthDeg ?? 90,
      runForm.structureDipToCoreAxisDeg ?? 55,
      runForm.betaAngleDeg ?? 180
    );
    return { len, tcr, rqd, rqdInfo: getRqdRatingInfo(rqd), trueDip: att.trueDip, trueDipDir: att.trueDipDir };
  }, [runForm, activeHole]);

  if (!activeHole) return null;

  return (
    <div className="flex flex-col h-full w-full bg-[#060a10] text-slate-100 overflow-hidden select-none">
      {/* ================================================================= */}
      {/* TOP NAVIGATION HEADER (Matches NATM Core Logging Layout)          */}
      {/* ================================================================= */}
      <header className="shrink-0 bg-[#0b111b] border-b border-slate-800/90 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          {onBackToMainWindow && (
            <button
              onClick={onBackToMainWindow}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              Main Window
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Exploration & Production Core Logging
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  DDH / JORC / ISRM
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Target: <span className="text-amber-300 font-semibold">{activeHole.targetOreZone || 'Unassigned Target'}</span> • Collar:{' '}
                <span className="font-mono text-slate-300">
                  {activeHole.collarElevationMrl}mRL ({activeHole.collarDipDeg}° / {String(activeHole.collarAzimuthDeg).padStart(3, '0')}°)
                </span>
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block" />

          {/* Drillhole Picker Dropdown */}
          <div className="flex items-center gap-1.5">
            <select
              value={activeHole.id}
              onChange={(e) => {
                setActiveHoleId(e.target.value);
                setActiveMiningDrillHoleId(e.target.value);
              }}
              className="bg-slate-900 border border-slate-700 hover:border-amber-500/50 rounded-lg px-3 py-1.5 text-xs font-bold text-amber-300 focus:outline-none cursor-pointer"
            >
              {holes.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.holeId} — {h.targetOreZone || 'Exploration Hole'} ({h.runs.length} runs)
                </option>
              ))}
            </select>

            <button
              onClick={handleOpenCreateHole}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-colors cursor-pointer"
              title="Create a new exploration or grade-control drillhole"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Hole
            </button>

            <button
              onClick={() => setIsStorageModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              title="Manage all saved drillholes, import/export JSON"
            >
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              Data & Storage ({holes.length})
            </button>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleOpenAddRun}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            + Add Core Run
          </button>

          <button
            onClick={handleExportCsv}
            disabled={!holeStats.hasInput}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
              holeStats.hasInput
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 cursor-pointer'
                : 'bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            Export CSV
          </button>

          <button
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-black shadow-sm transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            Generate Report (A4)
          </button>
        </div>
      </header>

      {/* ================================================================= */}
      {/* SUMMARY KPI BAR & 6-TAB BAR (Matches NATM Core Logging)           */}
      {/* ================================================================= */}
      <div className="shrink-0 bg-[#0d1522] border-b border-slate-800/80 px-4 py-2 flex flex-wrap items-center justify-between gap-3">
        {/* 6 Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <button
            onClick={() => setActiveTab('metadata')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'metadata'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            1. Hole Details & Setup
          </button>

          <button
            onClick={() => setActiveTab('runs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'runs'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            2. Core Runs & Geotech/Assay ({activeHole.runs.length})
          </button>

          <button
            onClick={() => setActiveTab('visual')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'visual'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            3. Visual Strip Log & Core Tray
          </button>

          <button
            onClick={() => setActiveTab('assays')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'assays'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            4. Assays & QA/QC ({(activeHole.assayIntervals || []).length})
          </button>

          <button
            onClick={() => setActiveTab('photos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'photos'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            5. Core Box Photos ({(activeHole.coreBoxPhotos || []).length})
          </button>

          <button
            onClick={() => setActiveTab('signoff')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'signoff'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            6. Tri-Party Sign-Off
          </button>
        </div>

        {/* Live Telemetry Strip */}
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-slate-500 uppercase text-[10px] font-bold block">Logged Depth</span>
            <span className="font-mono font-bold text-white">
              {holeStats.totalDrilled.toFixed(2)} m
            </span>
          </div>
          <div>
            <span className="text-slate-500 uppercase text-[10px] font-bold block">Avg TCR %</span>
            <span className="font-mono font-bold text-cyan-400">
              {holeStats.hasInput ? `${holeStats.avgTcr.toFixed(1)}%` : '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 uppercase text-[10px] font-bold block">Avg RQD %</span>
            <span className="font-mono font-bold text-emerald-400">
              {holeStats.hasInput ? `${holeStats.avgRqd.toFixed(1)}% (${holeStats.rqdRating})` : '—'}
            </span>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1">
            <span className="text-amber-400/80 uppercase text-[9px] font-black block">
              Ore Intercept (≥{activeHole.cutOffGrade ?? 1.5} {activeHole.primaryGradeUnit || 'g/t'})
            </span>
            <span className="font-mono font-black text-amber-300 text-xs">
              {holeStats.hasInput && holeStats.oreLength > 0
                ? `${holeStats.oreLength.toFixed(2)}m @ ${holeStats.compositeGrade.toFixed(2)} ${activeHole.primaryGradeUnit || 'g/t'}`
                : holeStats.hasInput
                ? 'Sub-Economic / Waste'
                : 'Awaiting Input'}
            </span>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MAIN TAB CONTENT AREA                                             */}
      {/* ================================================================= */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* --------------------------------------------------------------- */}
        {/* TAB 1: HOLE DETAILS & COLLAR SETUP                              */}
        {/* --------------------------------------------------------------- */}
        {activeTab === 'metadata' && (
          <div className="max-w-6xl mx-auto bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Compass className="w-5 h-5 text-amber-400" />
                  Exploration & Production Drillhole Collar Setup — {activeHole.holeId}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure collar survey coordinates, azimuth/plunge orientation, target lode, core barrel diameter, and project stakeholders.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  Import JSON
                  <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
                </label>
                <button
                  onClick={handleExportJson}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  Export JSON
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Drillhole ID</label>
                <input
                  type="text"
                  value={activeHole.holeId}
                  onChange={(e) => updateActiveHole((h) => ({ ...h, holeId: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Target Orebody / Lode</label>
                <input
                  type="text"
                  value={activeHole.targetOreZone}
                  onChange={(e) => updateActiveHole((h) => ({ ...h, targetOreZone: e.target.value }))}
                  placeholder="e.g. Champion Main Quartz Lode"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Drilling Purpose</label>
                <select
                  value={activeHole.purpose}
                  onChange={(e) =>
                    updateActiveHole((h) => ({
                      ...h,
                      purpose: e.target.value as MiningDrillHoleRecord['purpose'],
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="EXPLORATION">Exploration Step-Out</option>
                  <option value="RESOURCE_INFILL">Resource Definition Infill</option>
                  <option value="GRADE_CONTROL">Stope Grade Control</option>
                  <option value="GEOTECHNICAL_STABILITY">Geotechnical Rock Mass</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Core Size / Diameter</label>
                <select
                  value={activeHole.coreDiameter}
                  onChange={(e) =>
                    updateActiveHole((h) => ({
                      ...h,
                      coreDiameter: e.target.value as MiningDrillHoleRecord['coreDiameter'],
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-cyan-300"
                >
                  <option value="HQ">HQ (63.5 mm Core)</option>
                  <option value="HQ3">HQ3 Triple-Tube (61.1 mm)</option>
                  <option value="NQ">NQ (47.6 mm Core)</option>
                  <option value="NQ2">NQ2 (50.6 mm Core)</option>
                  <option value="PQ">PQ (85.0 mm Core)</option>
                  <option value="BQ">BQ (36.4 mm Underground)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Collar Easting (mE)</label>
                <input
                  type="number"
                  step="0.1"
                  value={activeHole.collarEasting}
                  onChange={(e) => updateActiveHole((h) => ({ ...h, collarEasting: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Collar Northing (mN)</label>
                <input
                  type="number"
                  step="0.1"
                  value={activeHole.collarNorthing}
                  onChange={(e) => updateActiveHole((h) => ({ ...h, collarNorthing: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Collar Elevation (mRL)</label>
                <input
                  type="number"
                  step="0.1"
                  value={activeHole.collarElevationMrl}
                  onChange={(e) => updateActiveHole((h) => ({ ...h, collarElevationMrl: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Planned Depth (EOH m)</label>
                <input
                  type="number"
                  step="1"
                  value={activeHole.totalDrilledDepthM}
                  onChange={(e) => updateActiveHole((h) => ({ ...h, totalDrilledDepthM: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Collar Dip / Plunge (°)</label>
                <input
                  type="number"
                  step="1"
                  min="-90"
                  max="90"
                  value={activeHole.collarDipDeg}
                  onChange={(e) => updateActiveHole((h) => ({ ...h, collarDipDeg: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-amber-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Collar Azimuth (0-360°)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="360"
                  value={activeHole.collarAzimuthDeg}
                  onChange={(e) => updateActiveHole((h) => ({ ...h, collarAzimuthDeg: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-amber-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Economic Cut-Off Grade</label>
                <input
                  type="number"
                  step="0.1"
                  value={activeHole.cutOffGrade ?? 1.5}
                  onChange={(e) => updateActiveHole((h) => ({ ...h, cutOffGrade: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-amber-300"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Primary Commodity & Unit</label>
                <select
                  value={activeHole.primaryGradeUnit || 'g/t Au'}
                  onChange={(e) => updateActiveHole((h) => ({ ...h, primaryGradeUnit: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="g/t Au">Gold (g/t Au)</option>
                  <option value="% Cu">Copper (% Cu)</option>
                  <option value="g/t Ag">Silver (g/t Ag)</option>
                  <option value="% Zn">Zinc (% Zn)</option>
                  <option value="% Ni">Nickel (% Ni)</option>
                  <option value="% Li2O">Lithium (% Li2O)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Drilling Method & Rig</label>
                <input
                  type="text"
                  value={activeHole.drillingMethod || ''}
                  onChange={(e) => updateActiveHole((h) => ({ ...h, drillingMethod: e.target.value }))}
                  placeholder="Wireline Triple-Tube Diamond Core"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Mining Company / Owner</label>
                <input
                  type="text"
                  value={activeHole.miningCompany || ''}
                  onChange={(e) => updateActiveHole((h) => ({ ...h, miningCompany: e.target.value }))}
                  placeholder="e.g. Bharat Gold & Copper Mines Corp."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Drilling Contractor</label>
                <input
                  type="text"
                  value={activeHole.drillingContractor}
                  onChange={(e) => updateActiveHole((h) => ({ ...h, drillingContractor: e.target.value }))}
                  placeholder="e.g. Major Drilling International"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Exploration Geologist</label>
                <input
                  type="text"
                  value={activeHole.loggedBy}
                  onChange={(e) => updateActiveHole((h) => ({ ...h, loggedBy: e.target.value }))}
                  placeholder="e.g. Dr. V. Raghavan"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Start Date</label>
                <input
                  type="date"
                  value={activeHole.startDate}
                  onChange={(e) => updateActiveHole((h) => ({ ...h, startDate: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Completion Date</label>
                <input
                  type="date"
                  value={activeHole.completionDate || ''}
                  onChange={(e) => updateActiveHole((h) => ({ ...h, completionDate: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                {holes.length > 1 && (
                  !confirmDeleteHole ? (
                    <button
                      onClick={() => setConfirmDeleteHole(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-800/60 text-xs font-bold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Drillhole
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 bg-red-950/70 border border-red-700 rounded-lg px-3 py-1.5">
                      <span className="text-xs text-red-200 font-bold">Confirm delete {activeHole.holeId}?</span>
                      <button
                        onClick={handleDeleteCurrentHole}
                        className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
                      >
                        Yes, Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteHole(false)}
                        className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setIsReportModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-amber-400" />
                  Preview Report (A4)
                </button>
                <button
                  onClick={() => setActiveTab('runs')}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-md cursor-pointer"
                >
                  Start Core Run Logging
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* TAB 2: CORE RUNS & EXPLORATION / GEOTECH SCHEDULE               */}
        {/* --------------------------------------------------------------- */}
        {activeTab === 'runs' && (
          <div className="space-y-4">
            {/* Top Ore Intercept & Cut-off Control Strip */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Significant Intercept Summary</span>
                  <div className="text-sm font-black text-amber-300 font-mono mt-0.5">
                    {activeHole.significantInterceptsSummary || 'Awaiting User Input'}
                  </div>
                </div>

                <div className="h-8 w-px bg-slate-800 hidden sm:block" />

                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Cut-Off Grade:</label>
                  <input
                    type="number"
                    step="0.1"
                    value={activeHole.cutOffGrade ?? 1.5}
                    onChange={(e) => updateActiveHole((h) => ({ ...h, cutOffGrade: parseFloat(e.target.value) || 0 }))}
                    className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-amber-300"
                  />
                  <span className="text-xs text-slate-400 font-mono">{activeHole.primaryGradeUnit || 'g/t Au'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeHole.runs.length === 0 && (
                  <button
                    onClick={handleLoadSampleExplorationHole}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-bold cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Load Sample Exploration Hole (Optional)
                  </button>
                )}
                <button
                  onClick={handleOpenAddRun}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  + Add Core Run
                </button>
              </div>
            </div>

            {/* Runs Table or Empty State */}
            {activeHole.runs.length === 0 ? (
              <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-xl p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  No Core Runs Logged Yet — Awaiting User Input
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Click <span className="text-emerald-400 font-bold">"+ Add Core Run"</span> to log diamond drillhole intervals with automatic TCR %, RQD %, ISRM rock quality, lithology, hydrothermal alteration, sulfide %, oriented core α/β angles, and assay grades.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleOpenAddRun}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    + Log First Core Run (0.00m)
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950/90 border-b border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-3">Run</th>
                        <th className="py-2.5 px-3">Depth (m)</th>
                        <th className="py-2.5 px-3">Run / Rec</th>
                        <th className="py-2.5 px-3">TCR %</th>
                        <th className="py-2.5 px-3">RQD % & Class</th>
                        <th className="py-2.5 px-3">Lithology & Strength</th>
                        <th className="py-2.5 px-3">Alteration & Sulfides</th>
                        <th className="py-2.5 px-3">Oriented α/β → Dip/Dir</th>
                        <th className="py-2.5 px-3">Sample & Assay</th>
                        <th className="py-2.5 px-3">Box</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {activeHole.runs.map((run) => {
                        const rqdInfo = getRqdRatingInfo(run.rqdPercent);
                        const isOre = (run.assayGradeAu ?? 0) >= (activeHole.cutOffGrade ?? 1.5);
                        const att = calculateOrientedStructureTrueAttitude(
                          activeHole.collarDipDeg,
                          activeHole.collarAzimuthDeg,
                          run.structureDipToCoreAxisDeg,
                          run.betaAngleDeg ?? 180
                        );
                        return (
                          <tr
                            key={run.runNumber}
                            className={`transition-colors ${
                              isOre ? 'bg-amber-950/15 hover:bg-amber-950/25' : 'hover:bg-slate-800/50'
                            }`}
                          >
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-300">#{run.runNumber}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-white whitespace-nowrap">
                              {run.fromDepthM.toFixed(2)} – {run.toDepthM.toFixed(2)}m
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                              {run.drilledLengthM.toFixed(2)}m / {run.recoveredLengthM.toFixed(2)}m
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <div className="w-12 h-2 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-cyan-400"
                                    style={{ width: `${Math.min(100, run.coreRecoveryPercent)}%` }}
                                  />
                                </div>
                                <span className="font-mono font-bold text-cyan-300">
                                  {run.coreRecoveryPercent.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-white">{run.rqdPercent.toFixed(1)}%</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${rqdInfo.colorClass}`}
                                >
                                  {rqdInfo.label}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-3 h-3 rounded-sm shrink-0 border border-white/20"
                                  style={{ backgroundColor: run.lithologyColor || '#065f46' }}
                                />
                                <div>
                                  <div className="font-bold text-slate-100">{run.lithology}</div>
                                  <div className="text-[10px] text-slate-400">
                                    {run.weatheringGrade} • {run.rockStrength?.split(' ')[0] || 'R4'} • Is50: {run.pointLoadIs50Mpa} MPa
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="text-slate-200 font-medium">{run.alteration}</div>
                              <div className="text-[10px] text-amber-300/90">
                                {run.mineralization} ({run.sulfidePercent ?? 0}% Sulfides • {run.veinDensityPerM} v/m)
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              <div className="text-slate-200">
                                {run.structureType}: α={run.structureDipToCoreAxisDeg}° β={run.betaAngleDeg ?? 180}°
                              </div>
                              <div className="text-[10px] text-cyan-400">
                                True: {att.trueDip}° / {String(att.trueDipDir).padStart(3, '0')}°
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded font-bold text-xs ${
                                    isOre
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                      : 'bg-slate-800 text-slate-300'
                                  }`}
                                >
                                  {(run.assayGradeAu ?? 0).toFixed(2)} {activeHole.primaryGradeUnit || 'g/t'}
                                </span>
                                {isOre && (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">
                                    ORE
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {run.sampleId || `SAM-${run.runNumber}`} • SG {run.specificGravity ?? 2.8}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-300">
                              Box #{run.boxNumber || 1}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => handleOpenEditRun(run)}
                                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 transition-colors cursor-pointer"
                                  title="Edit Core Run"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRun(run.runNumber)}
                                  className="p-1.5 rounded bg-slate-800 hover:bg-red-950/80 text-red-400 transition-colors cursor-pointer"
                                  title="Delete Core Run"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* TAB 3: VISUAL DOWNHOLE STRIP LOG & VIRTUAL CORE TRAY            */}
        {/* --------------------------------------------------------------- */}
        {activeTab === 'visual' && (
          <div className="space-y-6">
            {activeHole.runs.length === 0 ? (
              <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-xl p-12 text-center space-y-3">
                <Box className="w-10 h-10 text-amber-400 mx-auto" />
                <h3 className="text-sm font-black uppercase text-white">
                  Visual Strip Log & Virtual Core Tray Awaiting Runs
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Log core runs in Tab 2 to automatically generate the downhole graphic strip log and interactive virtual core box tray.
                </p>
                <button
                  onClick={handleOpenAddRun}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  + Add Core Run
                </button>
              </div>
            ) : (
              <>
                {/* 1. Downhole Graphic Strip Log */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                        <Layers className="w-4 h-4 text-amber-400" />
                        Interactive Downhole Graphic Strip Log — {activeHole.holeId}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Click any depth interval row to edit its lithology, RQD, oriented structure, or assay grade.
                      </p>
                    </div>
                  </div>

                  <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-12 bg-slate-950 border-b border-slate-800 text-[10px] font-black uppercase text-slate-400 py-2 px-3">
                      <div className="col-span-2">Depth (m)</div>
                      <div className="col-span-3">Lithology Column</div>
                      <div className="col-span-2">RQD % Spectrum</div>
                      <div className="col-span-2">Alteration & Sulfides</div>
                      <div className="col-span-2">Assay Grade ({activeHole.primaryGradeUnit || 'g/t'})</div>
                      <div className="col-span-1 text-right">Attitude</div>
                    </div>

                    <div className="divide-y divide-slate-800/80">
                      {activeHole.runs.map((run) => {
                        const rqdInfo = getRqdRatingInfo(run.rqdPercent);
                        const grade = run.assayGradeAu ?? 0;
                        const isOre = grade >= (activeHole.cutOffGrade ?? 1.5);
                        const att = calculateOrientedStructureTrueAttitude(
                          activeHole.collarDipDeg,
                          activeHole.collarAzimuthDeg,
                          run.structureDipToCoreAxisDeg,
                          run.betaAngleDeg ?? 180
                        );
                        return (
                          <div
                            key={run.runNumber}
                            onClick={() => handleOpenEditRun(run)}
                            className="grid grid-cols-12 items-center py-2.5 px-3 text-xs hover:bg-slate-800/60 cursor-pointer transition-colors"
                          >
                            <div className="col-span-2 font-mono font-bold text-slate-200">
                              {run.fromDepthM.toFixed(2)} – {run.toDepthM.toFixed(2)}m
                              <span className="block text-[10px] text-slate-500">Run #{run.runNumber}</span>
                            </div>

                            <div className="col-span-3 flex items-center gap-2.5 pr-2">
                              <div
                                className="w-8 h-9 rounded border border-white/20 shrink-0 flex items-center justify-center text-[9px] font-black text-white/90 shadow-inner"
                                style={{ backgroundColor: run.lithologyColor || '#065f46' }}
                              >
                                {run.structureType.slice(0, 3)}
                              </div>
                              <div className="truncate">
                                <div className="font-bold text-white truncate">{run.lithology}</div>
                                <div className="text-[10px] text-slate-400">{run.weatheringGrade}</div>
                              </div>
                            </div>

                            <div className="col-span-2 pr-3">
                              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                                <span className="font-bold text-white">{run.rqdPercent.toFixed(1)}%</span>
                                <span className="text-slate-400">TCR {run.coreRecoveryPercent.toFixed(0)}%</span>
                              </div>
                              <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                <div
                                  className="h-full transition-all"
                                  style={{
                                    width: `${Math.min(100, run.rqdPercent)}%`,
                                    backgroundColor: rqdInfo.barColor,
                                  }}
                                />
                              </div>
                            </div>

                            <div className="col-span-2 pr-2 truncate">
                              <div className="text-[11px] text-slate-200 truncate">{run.alteration}</div>
                              <div className="text-[10px] text-amber-300 font-mono">
                                Sulfides: {run.sulfidePercent ?? 0}% • {run.veinDensityPerM} v/m
                              </div>
                            </div>

                            <div className="col-span-2 pr-3">
                              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                                <span className={isOre ? 'font-black text-amber-300' : 'text-slate-300'}>
                                  {grade.toFixed(2)} {activeHole.primaryGradeUnit || 'g/t'}
                                </span>
                                {isOre && <span className="text-[9px] font-black text-amber-400">ORE ZONE</span>}
                              </div>
                              <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                <div
                                  className={`h-full ${isOre ? 'bg-amber-400' : 'bg-slate-600'}`}
                                  style={{ width: `${Math.min(100, grade * 10)}%` }}
                                />
                              </div>
                            </div>

                            <div className="col-span-1 text-right font-mono text-[11px] text-cyan-300">
                              {att.trueDip}°/{String(att.trueDipDir).padStart(3, '0')}°
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 2. Interactive Virtual Core Box Tray SVG */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                        <Box className="w-4 h-4 text-cyan-400" />
                        Virtual Core Box Tray Viewer ({activeHole.coreDiameter} Core)
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Generated directly from your logged runs. Red dashed line = Bottom-of-Hole (BOH) orientation reference line. Click any channel to edit.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {coreBoxes.map((b, idx) => (
                        <button
                          key={b.boxNumber}
                          onClick={() => setSelectedBoxIndex(idx)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                            selectedBoxIndex === idx
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          Box #{b.boxNumber} ({b.fromDepth.toFixed(1)}–{b.toDepth.toFixed(1)}m)
                        </button>
                      ))}
                    </div>
                  </div>

                  {coreBoxes[selectedBoxIndex] && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto">
                      <svg viewBox="0 0 860 260" className="w-full h-auto min-w-[640px]">
                        {/* Outer Wooden/Plastic Core Tray Frame */}
                        <rect
                          x="10"
                          y="10"
                          width="840"
                          height="240"
                          rx="8"
                          fill="#0f172a"
                          stroke="#334155"
                          strokeWidth="3"
                        />
                        <text x="26" y="32" fill="#f8fafc" fontSize="13" fontWeight="bold" fontFamily="monospace">
                          {activeHole.holeId} — CORE BOX #{coreBoxes[selectedBoxIndex].boxNumber} ({coreBoxes[selectedBoxIndex].fromDepth.toFixed(2)}m to {coreBoxes[selectedBoxIndex].toDepth.toFixed(2)}m)
                        </text>

                        {coreBoxes[selectedBoxIndex].runs.map((run, rIdx) => {
                          const yTop = 48 + rIdx * 64;
                          const recRatio = Math.min(1, Math.max(0.05, run.coreRecoveryPercent / 100));
                          const coreWidth = 740 * recRatio;
                          const isOre = (run.assayGradeAu ?? 0) >= (activeHole.cutOffGrade ?? 1.5);
                          const numFractures = Math.min(25, Math.max(1, Math.round(run.fracturesPerMeter * run.drilledLengthM)));

                          return (
                            <g
                              key={run.runNumber}
                              onClick={() => handleOpenEditRun(run)}
                              className="cursor-pointer"
                            >
                              {/* Tray Compartment Slot */}
                              <rect
                                x="25"
                                y={yTop}
                                width="810"
                                height="50"
                                rx="4"
                                fill="#020617"
                                stroke={isOre ? '#f59e0b' : '#1e293b'}
                                strokeWidth={isOre ? '2' : '1'}
                              />

                              {/* Solid Cylindrical Core Stick */}
                              <rect
                                x="65"
                                y={yTop + 7}
                                width={coreWidth}
                                height="36"
                                rx="3"
                                fill={run.lithologyColor || '#065f46'}
                                fillOpacity="0.88"
                              />

                              {/* Red Dashed BOH Orientation Line */}
                              <line
                                x1="65"
                                y1={yTop + 25}
                                x2={65 + coreWidth}
                                y2={yTop + 25}
                                stroke="#ef4444"
                                strokeWidth="1.5"
                                strokeDasharray="6 4"
                              />

                              {/* Structural Fracture Ticks along Core */}
                              {Array.from({ length: numFractures }).map((_, fIdx) => {
                                const fx = 65 + ((fIdx + 1) / (numFractures + 1)) * coreWidth;
                                return (
                                  <line
                                    key={fIdx}
                                    x1={fx - 4}
                                    y1={yTop + 7}
                                    x2={fx + 4}
                                    y2={yTop + 43}
                                    stroke="#020617"
                                    strokeWidth="2"
                                  />
                                );
                              })}

                              {/* Start Depth Marker Block */}
                              <rect x="28" y={yTop + 5} width="34" height="40" rx="2" fill="#1e293b" />
                              <text
                                x="45"
                                y={yTop + 29}
                                textAnchor="middle"
                                fill="#38bdf8"
                                fontSize="10"
                                fontWeight="bold"
                                fontFamily="monospace"
                              >
                                {run.fromDepthM.toFixed(1)}m
                              </text>

                              {/* End Depth Marker Wooden Block */}
                              <rect x="795" y={yTop + 5} width="36" height="40" rx="2" fill="#78350f" />
                              <text
                                x="813"
                                y={yTop + 29}
                                textAnchor="middle"
                                fill="#fde68a"
                                fontSize="10"
                                fontWeight="bold"
                                fontFamily="monospace"
                              >
                                {run.toDepthM.toFixed(1)}m
                              </text>

                              {/* Overlay Run Info Label */}
                              <text
                                x="78"
                                y={yTop + 21}
                                fill="#ffffff"
                                fontSize="11"
                                fontWeight="bold"
                                fontFamily="monospace"
                              >
                                Run #{run.runNumber}: {run.lithology} | RQD {run.rqdPercent.toFixed(0)}% | {run.structureType} α={run.structureDipToCoreAxisDeg}°
                              </text>
                              <text
                                x="78"
                                y={yTop + 38}
                                fill="#fef08a"
                                fontSize="10"
                                fontFamily="monospace"
                              >
                                {run.sampleId || `SAM-${run.runNumber}`}: {(run.assayGradeAu ?? 0).toFixed(2)} {activeHole.primaryGradeUnit || 'g/t'} • Sulfides {run.sulfidePercent ?? 0}%
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* TAB 4: ASSAYS, QA/QC & INTERCEPT COMPOSITOR                     */}
        {/* --------------------------------------------------------------- */}
        {activeTab === 'assays' && (
          <div className="space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-amber-400" />
                  Exploration Geochemical Assay Ledger & QA/QC Controls
                </h3>
                <p className="text-[11px] text-slate-400">
                  Manage half-core sample intervals, Certified Reference Materials (CRM Standards), Coarse Blanks, and Field Duplicates.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleOpenAddAssay('NORMAL_SAMPLE')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Add Core Sample
                </button>
                <button
                  onClick={() => handleOpenAddAssay('CRM_STANDARD')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold cursor-pointer"
                >
                  + Insert CRM Standard
                </button>
                <button
                  onClick={() => handleOpenAddAssay('COARSE_BLANK')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold cursor-pointer"
                >
                  + Insert Coarse Blank
                </button>
              </div>
            </div>

            {(activeHole.assayIntervals || []).length === 0 ? (
              <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-xl p-10 text-center space-y-3">
                <FlaskConical className="w-8 h-8 text-amber-400 mx-auto" />
                <div className="text-sm font-bold text-white">No Geochemical Assays Logged Yet</div>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Assays are automatically synced when you enter a Sample ID and grade in a Core Run, or you can insert standalone assay intervals and QA/QC controls here.
                </p>
              </div>
            ) : (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-black uppercase text-slate-400">
                      <th className="py-2.5 px-3">Sample ID</th>
                      <th className="py-2.5 px-3">QA/QC Type</th>
                      <th className="py-2.5 px-3">Interval (m)</th>
                      <th className="py-2.5 px-3">Length (m)</th>
                      <th className="py-2.5 px-3">Primary Grade ({activeHole.primaryGradeUnit || 'g/t'})</th>
                      <th className="py-2.5 px-3">Secondary (% Cu)</th>
                      <th className="py-2.5 px-3">SG (t/m³)</th>
                      <th className="py-2.5 px-3">QA/QC Status</th>
                      <th className="py-2.5 px-3">Laboratory</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {(activeHole.assayIntervals || []).map((a) => {
                      const isOre =
                        a.qaqcCategory === 'NORMAL_SAMPLE' &&
                        a.primaryAssayGrade >= (activeHole.cutOffGrade ?? 1.5);
                      return (
                        <tr key={a.sampleId} className="hover:bg-slate-800/50">
                          <td className="py-2.5 px-3 font-mono font-bold text-white">{a.sampleId}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                a.qaqcCategory === 'CRM_STANDARD'
                                  ? 'bg-purple-950 text-purple-300 border border-purple-700'
                                  : a.qaqcCategory === 'COARSE_BLANK'
                                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {a.qaqcCategory}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">
                            {a.fromDepthM.toFixed(2)} – {a.toDepthM.toFixed(2)}m
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">{a.intervalLengthM.toFixed(2)}m</td>
                          <td className="py-2.5 px-3 font-mono font-bold">
                            <span className={isOre ? 'text-amber-300' : 'text-slate-200'}>
                              {a.primaryAssayGrade.toFixed(2)} {a.primaryGradeUnit}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">
                            {(a.secondaryAssayGrade ?? 0).toFixed(2)}%
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">
                            {a.specificGravityEstimated.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              PASS
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">{a.assayLaboratory}</td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleDeleteAssay(a.sampleId)}
                              className="p-1.5 rounded bg-slate-800 hover:bg-red-950 text-red-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* TAB 5: CORE BOX PHOTOGRAPHIC CATALOG                            */}
        {/* --------------------------------------------------------------- */}
        {activeTab === 'photos' && (
          <div className="space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <Camera className="w-4 h-4 text-amber-400" />
                  Core Tray Photographic Archive (Wet & Dry Core)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Attach high-resolution wet and dry core box photographs for JORC / NI 43-101 QA/QC documentation and A4 log inclusion.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingPhotoId(null);
                  setPhotoForm({
                    boxNumber: (activeHole.coreBoxPhotos?.length || 0) + 1,
                    fromDepth: 0,
                    toDepth: 6,
                    condition: 'Wet',
                    imageUrl: '',
                    caption: '',
                    dateTaken: new Date().toISOString().slice(0, 10),
                  });
                  setIsPhotoModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                + Upload Core Box Photo
              </button>
            </div>

            {(activeHole.coreBoxPhotos || []).length === 0 ? (
              <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-xl p-12 text-center space-y-3">
                <Camera className="w-9 h-9 text-slate-500 mx-auto" />
                <div className="text-sm font-bold text-white">No Core Box Photos Uploaded Yet</div>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Upload wet or dry core tray photographs to include them in the printable A4 Exploration Core Log Report.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(activeHole.coreBoxPhotos || []).map((photo) => (
                  <div
                    key={photo.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col"
                  >
                    <div className="h-48 bg-slate-950 relative overflow-hidden">
                      <img
                        src={photo.imageUrl}
                        alt={`Core Box ${photo.boxNumber}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-[10px] font-mono font-bold text-amber-300">
                        Box #{photo.boxNumber} ({photo.fromDepth.toFixed(1)}–{photo.toDepth.toFixed(1)}m)
                      </span>
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-cyan-950/90 border border-cyan-700 text-[10px] font-bold text-cyan-300">
                        {photo.condition}
                      </span>
                    </div>
                    <div className="p-3 flex items-center justify-between gap-2">
                      <div className="truncate">
                        <div className="text-xs font-bold text-white truncate">
                          {photo.caption || `Core Box #${photo.boxNumber}`}
                        </div>
                        <div className="text-[10px] text-slate-400">{photo.dateTaken}</div>
                      </div>
                      <button
                        onClick={() =>
                          updateActiveHole((h) => ({
                            ...h,
                            coreBoxPhotos: (h.coreBoxPhotos || []).filter((p) => p.id !== photo.id),
                          }))
                        }
                        className="p-1.5 rounded bg-slate-800 hover:bg-red-950 text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --------------------------------------------------------------- */}
        {/* TAB 6: TRI-PARTY / COMPETENT PERSON DIGITAL SIGN-OFF            */}
        {/* --------------------------------------------------------------- */}
        {activeTab === 'signoff' && (
          <div className="max-w-6xl mx-auto bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-6">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                Tri-Party Exploration & JORC / NI 43-101 Competent Person Sign-Off
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Sign on-screen or upload PNG signatures for the Drilling Contractor, Logging Exploration Geologist, and Chief Mine Geologist.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* 1. Drilling Contractor */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="text-xs font-black uppercase text-amber-400">
                  1. Drilling Contractor Representative
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 mb-1">Representative Name</label>
                  <input
                    type="text"
                    value={activeHole.signOff?.contractorRepName || ''}
                    onChange={(e) =>
                      updateActiveHole((h) => ({
                        ...h,
                        signOff: { ...(h.signOff as MiningCoreLogSignOff), contractorRepName: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 mb-1">Contractor Company</label>
                  <input
                    type="text"
                    value={activeHole.signOff?.contractorCompany || activeHole.drillingContractor || ''}
                    onChange={(e) =>
                      updateActiveHole((h) => ({
                        ...h,
                        signOff: { ...(h.signOff as MiningCoreLogSignOff), contractorCompany: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="eswa-signature-fit-box h-24 bg-white rounded-lg border border-slate-700 p-1.5 flex items-center justify-center overflow-hidden relative">
                  {activeHole.signOff?.contractorSignatureUrl ? (
                    <>
                      <img
                        src={activeHole.signOff.contractorSignatureUrl}
                        alt="Contractor Signature"
                        className="max-h-20 max-w-full w-auto h-auto object-contain"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateActiveHole((h) => ({
                            ...h,
                            signOff: { ...(h.signOff as MiningCoreLogSignOff), contractorSignatureUrl: '' },
                          }))
                        }
                        title="Clear Signature"
                        className="absolute top-1 right-1.5 text-[10px] font-black text-rose-600 hover:text-rose-800 cursor-pointer"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 italic">No signature captured</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSigningParty('contractor')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold cursor-pointer"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    Draw Signature
                  </button>
                  <label className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload PNG</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          updateActiveHole((h) => ({
                            ...h,
                            signOff: {
                              ...(h.signOff as MiningCoreLogSignOff),
                              contractorSignatureUrl: String(reader.result || ''),
                            },
                          }));
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* 2. Logging Exploration Geologist */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="text-xs font-black uppercase text-cyan-400">
                  2. Logging Exploration Geologist
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 mb-1">Geologist Name</label>
                  <input
                    type="text"
                    value={activeHole.signOff?.consultantRepName || activeHole.loggedBy || ''}
                    onChange={(e) =>
                      updateActiveHole((h) => ({
                        ...h,
                        signOff: { ...(h.signOff as MiningCoreLogSignOff), consultantRepName: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 mb-1">Exploration Division / Firm</label>
                  <input
                    type="text"
                    value={activeHole.signOff?.consultantCompany || activeHole.explorationConsultant || ''}
                    onChange={(e) =>
                      updateActiveHole((h) => ({
                        ...h,
                        signOff: { ...(h.signOff as MiningCoreLogSignOff), consultantCompany: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="eswa-signature-fit-box h-24 bg-white rounded-lg border border-slate-700 p-1.5 flex items-center justify-center overflow-hidden relative">
                  {activeHole.signOff?.consultantSignatureUrl ? (
                    <>
                      <img
                        src={activeHole.signOff.consultantSignatureUrl}
                        alt="Geologist Signature"
                        className="max-h-20 max-w-full w-auto h-auto object-contain"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateActiveHole((h) => ({
                            ...h,
                            signOff: { ...(h.signOff as MiningCoreLogSignOff), consultantSignatureUrl: '' },
                          }))
                        }
                        title="Clear Signature"
                        className="absolute top-1 right-1.5 text-[10px] font-black text-rose-600 hover:text-rose-800 cursor-pointer"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 italic">No signature captured</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSigningParty('consultant')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold cursor-pointer"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    Draw Signature
                  </button>
                  <label className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload PNG</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          updateActiveHole((h) => ({
                            ...h,
                            signOff: {
                              ...(h.signOff as MiningCoreLogSignOff),
                              consultantSignatureUrl: String(reader.result || ''),
                            },
                          }));
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* 3. Chief Mine Geologist / Competent Person */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="text-xs font-black uppercase text-emerald-400">
                  3. Competent Person (JORC / NI 43-101)
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 mb-1">Chief Geologist Name</label>
                  <input
                    type="text"
                    value={activeHole.signOff?.clientRepName || ''}
                    onChange={(e) =>
                      updateActiveHole((h) => ({
                        ...h,
                        signOff: { ...(h.signOff as MiningCoreLogSignOff), clientRepName: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 mb-1">Mining Company</label>
                  <input
                    type="text"
                    value={activeHole.signOff?.clientCompany || activeHole.miningCompany || ''}
                    onChange={(e) =>
                      updateActiveHole((h) => ({
                        ...h,
                        signOff: { ...(h.signOff as MiningCoreLogSignOff), clientCompany: e.target.value },
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div className="eswa-signature-fit-box h-24 bg-white rounded-lg border border-slate-700 p-1.5 flex items-center justify-center overflow-hidden relative">
                  {activeHole.signOff?.clientSignatureUrl ? (
                    <>
                      <img
                        src={activeHole.signOff.clientSignatureUrl}
                        alt="Client Signature"
                        className="max-h-20 max-w-full w-auto h-auto object-contain"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateActiveHole((h) => ({
                            ...h,
                            signOff: { ...(h.signOff as MiningCoreLogSignOff), clientSignatureUrl: '' },
                          }))
                        }
                        title="Clear Signature"
                        className="absolute top-1 right-1.5 text-[10px] font-black text-rose-600 hover:text-rose-800 cursor-pointer"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 italic">No signature captured</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSigningParty('client')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold cursor-pointer"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    Draw Signature
                  </button>
                  <label className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload PNG</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          updateActiveHole((h) => ({
                            ...h,
                            signOff: {
                              ...(h.signOff as MiningCoreLogSignOff),
                              clientSignatureUrl: String(reader.result || ''),
                            },
                          }));
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* MODAL 1: ADD / EDIT EXPLORATION CORE RUN MODAL                    */}
      {/* ================================================================= */}
      {isRunModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  {editingRunNumber !== null ? `Edit Core Run #${editingRunNumber}` : `Log New Exploration Core Run #${runForm.runNumber}`} — {activeHole.holeId}
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time ISRM RQD %, TCR %, Oriented Core α/β to True Dip/DipDir, Hydrothermal Alteration, and Assay Grade entry.
                </p>
              </div>
              <button
                onClick={() => setIsRunModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Auto-Calculated Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 border border-slate-800 rounded-xl p-3">
              <div>
                <span className="text-[10px] uppercase text-slate-400 block">Run Length</span>
                <span className="font-mono font-black text-white text-sm">{modalPreview.len.toFixed(2)} m</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block">Calculated TCR %</span>
                <span className="font-mono font-black text-cyan-400 text-sm">{modalPreview.tcr.toFixed(1)} %</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block">Calculated RQD %</span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  {modalPreview.rqd.toFixed(1)}% ({modalPreview.rqdInfo.label})
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block">True Structure Dip/Dir</span>
                <span className="font-mono font-black text-amber-300 text-sm">
                  {modalPreview.trueDip}° / {String(modalPreview.trueDipDir).padStart(3, '0')}°
                </span>
              </div>
            </div>

            {/* Section 1: Depth, Recovery & RQD */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">From Depth (m)</label>
                <input
                  type="number"
                  step="0.05"
                  value={runForm.fromDepthM}
                  onChange={(e) => setRunForm({ ...runForm, fromDepthM: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">To Depth (m)</label>
                <input
                  type="number"
                  step="0.05"
                  value={runForm.toDepthM}
                  onChange={(e) => setRunForm({ ...runForm, toDepthM: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Core Recovered (m)</label>
                <input
                  type="number"
                  step="0.05"
                  value={runForm.recoveredLengthM}
                  onChange={(e) => setRunForm({ ...runForm, recoveredLengthM: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-cyan-300"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Solid Core ≥10cm (m)</label>
                <input
                  type="number"
                  step="0.05"
                  value={runForm.solidCoreLengthRqdM}
                  onChange={(e) => setRunForm({ ...runForm, solidCoreLengthRqdM: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-emerald-300"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Core Box #</label>
                <input
                  type="number"
                  min="1"
                  value={runForm.boxNumber || 1}
                  onChange={(e) => setRunForm({ ...runForm, boxNumber: parseInt(e.target.value, 10) || 1 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-amber-300"
                />
              </div>
            </div>

            {/* Section 2: Exploration Lithology, Alteration & Sulfide Mineralization */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Host / Lode Lithology</label>
                <select
                  value={
                    EXPLORATION_LITHOLOGIES.some((l) => l.name === runForm.lithology)
                      ? runForm.lithology
                      : '__custom__'
                  }
                  onChange={(e) => {
                    if (e.target.value !== '__custom__') {
                      const found = EXPLORATION_LITHOLOGIES.find((l) => l.name === e.target.value);
                      setRunForm({
                        ...runForm,
                        lithology: e.target.value,
                        lithologyColor: found?.color || runForm.lithologyColor,
                      });
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white mb-1.5"
                >
                  {EXPLORATION_LITHOLOGIES.map((l) => (
                    <option key={l.code} value={l.name}>
                      {l.name} ({l.code})
                    </option>
                  ))}
                  <option value="__custom__">Custom Lithology...</option>
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={runForm.lithology}
                    onChange={(e) => setRunForm({ ...runForm, lithology: e.target.value })}
                    placeholder="Custom rock type"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                  />
                  <input
                    type="color"
                    value={runForm.lithologyColor || '#065f46'}
                    onChange={(e) => setRunForm({ ...runForm, lithologyColor: e.target.value })}
                    className="w-8 h-7 rounded bg-slate-950 border border-slate-700 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Hydrothermal Alteration</label>
                <select
                  value={runForm.alteration}
                  onChange={(e) => setRunForm({ ...runForm, alteration: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white mb-1.5"
                >
                  {ALTERATION_STYLES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Alteration Intensity (1-5):</span>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={runForm.alterationIntensity ?? 2}
                    onChange={(e) => setRunForm({ ...runForm, alterationIntensity: parseInt(e.target.value, 10) || 1 })}
                    className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-amber-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Mineralization & Sulfide %
                </label>
                <input
                  type="text"
                  value={runForm.mineralization}
                  onChange={(e) => setRunForm({ ...runForm, mineralization: e.target.value })}
                  placeholder="e.g. Pyrite + Arsenopyrite + Native Au"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white mb-1.5"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Sulfide %:</span>
                    <input
                      type="number"
                      step="0.5"
                      value={runForm.sulfidePercent ?? 0}
                      onChange={(e) => setRunForm({ ...runForm, sulfidePercent: parseFloat(e.target.value) || 0 })}
                      className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-amber-300"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Veins/m:</span>
                    <input
                      type="number"
                      value={runForm.veinDensityPerM}
                      onChange={(e) => setRunForm({ ...runForm, veinDensityPerM: parseInt(e.target.value, 10) || 0 })}
                      className="w-14 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Oriented Core Structural Angles & Rock Mechanics */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Structure Type</label>
                <select
                  value={runForm.structureType}
                  onChange={(e) =>
                    setRunForm({ ...runForm, structureType: e.target.value as MiningCoreRun['structureType'] })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value="VEIN">Vein / Lode</option>
                  <option value="SHEAR">Shear Zone</option>
                  <option value="FAULT">Fault</option>
                  <option value="FOLIATION">Foliation</option>
                  <option value="JOINT">Joint</option>
                  <option value="BEDDING">Bedding</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Alpha α (0-90°)</label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={runForm.structureDipToCoreAxisDeg}
                  onChange={(e) =>
                    setRunForm({ ...runForm, structureDipToCoreAxisDeg: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-cyan-300"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Beta β (0-360°)</label>
                <input
                  type="number"
                  min="0"
                  max="360"
                  value={runForm.betaAngleDeg ?? 180}
                  onChange={(e) => setRunForm({ ...runForm, betaAngleDeg: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-cyan-300"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Fractures / m</label>
                <input
                  type="number"
                  min="0"
                  value={runForm.fracturesPerMeter}
                  onChange={(e) => setRunForm({ ...runForm, fracturesPerMeter: parseInt(e.target.value, 10) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Point Load Is50 (MPa)</label>
                <input
                  type="number"
                  step="0.1"
                  value={runForm.pointLoadIs50Mpa}
                  onChange={(e) => setRunForm({ ...runForm, pointLoadIs50Mpa: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Weathering</label>
                <select
                  value={runForm.weatheringGrade}
                  onChange={(e) =>
                    setRunForm({
                      ...runForm,
                      weatheringGrade: e.target.value as MiningCoreRun['weatheringGrade'],
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  {WEATHERING_GRADES.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Section 4: Sample ID, QA/QC & Geochemical Assay Grade */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-[10px] font-bold uppercase text-amber-400 mb-1">Sample Tag ID</label>
                <input
                  type="text"
                  value={runForm.sampleId || ''}
                  onChange={(e) => setRunForm({ ...runForm, sampleId: e.target.value })}
                  placeholder="SAM-001"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-amber-400 mb-1">QA/QC Type</label>
                <select
                  value={runForm.qaqcType || 'REGULAR'}
                  onChange={(e) =>
                    setRunForm({ ...runForm, qaqcType: e.target.value as MiningCoreRun['qaqcType'] })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="REGULAR">Half-Core Regular</option>
                  <option value="CRM_STANDARD">CRM Standard</option>
                  <option value="COARSE_BLANK">Coarse Blank</option>
                  <option value="DUPLICATE">Field Duplicate</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-amber-400 mb-1">
                  Primary Grade ({activeHole.primaryGradeUnit || 'g/t'})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={runForm.assayGradeAu ?? 0}
                  onChange={(e) => setRunForm({ ...runForm, assayGradeAu: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-amber-500/50 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-amber-300"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Secondary (% Cu)</label>
                <input
                  type="number"
                  step="0.01"
                  value={runForm.assayGradeCu ?? 0}
                  onChange={(e) => setRunForm({ ...runForm, assayGradeCu: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Bulk Density SG (t/m³)</label>
                <input
                  type="number"
                  step="0.01"
                  value={runForm.specificGravity ?? 2.8}
                  onChange={(e) => setRunForm({ ...runForm, specificGravity: parseFloat(e.target.value) || 2.8 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Exploration Geologist Remarks & Structural Description
              </label>
              <input
                type="text"
                value={runForm.geologistNotes || ''}
                onChange={(e) => setRunForm({ ...runForm, geologistNotes: e.target.value })}
                placeholder="e.g. Laminated smoky quartz vein with visible gold specks and arsenopyrite selvages..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsRunModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRun}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Save Core Run
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 2: CREATE NEW EXPLORATION DRILLHOLE MODAL                   */}
      {/* ================================================================= */}
      {isNewHoleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Create New Exploration / Grade-Control Drillhole
              </h3>
              <button
                onClick={() => setIsNewHoleModalOpen(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Drillhole ID</label>
                <input
                  type="text"
                  value={newHoleForm.holeId}
                  onChange={(e) => setNewHoleForm({ ...newHoleForm, holeId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-300"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Target Orebody / Lode</label>
                <input
                  type="text"
                  value={newHoleForm.targetOreZone}
                  onChange={(e) => setNewHoleForm({ ...newHoleForm, targetOreZone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Core Diameter</label>
                <select
                  value={newHoleForm.coreDiameter}
                  onChange={(e) =>
                    setNewHoleForm({
                      ...newHoleForm,
                      coreDiameter: e.target.value as MiningDrillHoleRecord['coreDiameter'],
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="HQ">HQ (63.5mm)</option>
                  <option value="NQ2">NQ2 (50.6mm)</option>
                  <option value="PQ">PQ (85.0mm)</option>
                  <option value="BQ">BQ (36.4mm)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Collar Elevation (mRL)</label>
                <input
                  type="number"
                  value={newHoleForm.collarElevationMrl}
                  onChange={(e) =>
                    setNewHoleForm({ ...newHoleForm, collarElevationMrl: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Dip / Plunge (°)</label>
                <input
                  type="number"
                  value={newHoleForm.collarDipDeg}
                  onChange={(e) => setNewHoleForm({ ...newHoleForm, collarDipDeg: parseFloat(e.target.value) || -60 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Azimuth (°)</label>
                <input
                  type="number"
                  value={newHoleForm.collarAzimuthDeg}
                  onChange={(e) =>
                    setNewHoleForm({ ...newHoleForm, collarAzimuthDeg: parseFloat(e.target.value) || 90 })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsNewHoleModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateHoleSubmit}
                className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
              >
                Create Drillhole (Clean Slate)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 3: ASSAY SAMPLE ENTRY MODAL                                 */}
      {/* ================================================================= */}
      {isAssayModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase text-white">Add Assay Interval / QA-QC Control</h3>
              <button
                onClick={() => setIsAssayModalOpen(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Sample ID</label>
                <input
                  type="text"
                  value={assayForm.sampleId}
                  onChange={(e) => setAssayForm({ ...assayForm, sampleId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">QA/QC Category</label>
                <select
                  value={assayForm.qaqcCategory}
                  onChange={(e) =>
                    setAssayForm({
                      ...assayForm,
                      qaqcCategory: e.target.value as MiningAssayInterval['qaqcCategory'],
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                >
                  <option value="NORMAL_SAMPLE">NORMAL_SAMPLE</option>
                  <option value="CRM_STANDARD">CRM_STANDARD</option>
                  <option value="COARSE_BLANK">COARSE_BLANK</option>
                  <option value="PULP_DUPLICATE">PULP_DUPLICATE</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">From Depth (m)</label>
                <input
                  type="number"
                  step="0.1"
                  value={assayForm.fromDepthM}
                  onChange={(e) => setAssayForm({ ...assayForm, fromDepthM: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">To Depth (m)</label>
                <input
                  type="number"
                  step="0.1"
                  value={assayForm.toDepthM}
                  onChange={(e) => setAssayForm({ ...assayForm, toDepthM: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-amber-400 mb-1">
                  Primary Grade ({activeHole.primaryGradeUnit || 'g/t'})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={assayForm.primaryAssayGrade}
                  onChange={(e) => setAssayForm({ ...assayForm, primaryAssayGrade: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-amber-500/50 rounded-lg px-3 py-1.5 text-xs font-mono text-amber-300"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Specific Gravity (SG)</label>
                <input
                  type="number"
                  step="0.01"
                  value={assayForm.specificGravityEstimated}
                  onChange={(e) =>
                    setAssayForm({ ...assayForm, specificGravityEstimated: parseFloat(e.target.value) || 2.8 })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsAssayModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAssay}
                className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
              >
                Save Assay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 4: CORE BOX PHOTO UPLOAD MODAL                              */}
      {/* ================================================================= */}
      {isPhotoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase text-white">Upload Core Box Tray Photo</h3>
              <button
                onClick={() => setIsPhotoModalOpen(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Box Number</label>
                <input
                  type="number"
                  value={photoForm.boxNumber}
                  onChange={(e) => setPhotoForm({ ...photoForm, boxNumber: parseInt(e.target.value, 10) || 1 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Core Condition</label>
                <select
                  value={photoForm.condition}
                  onChange={(e) =>
                    setPhotoForm({ ...photoForm, condition: e.target.value as 'Wet' | 'Dry' | 'Natural' })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                >
                  <option value="Wet">Wet Core</option>
                  <option value="Dry">Dry Core</option>
                  <option value="Natural">Natural</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">From Depth (m)</label>
                <input
                  type="number"
                  step="0.1"
                  value={photoForm.fromDepth}
                  onChange={(e) => setPhotoForm({ ...photoForm, fromDepth: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">To Depth (m)</label>
                <input
                  type="number"
                  step="0.1"
                  value={photoForm.toDepth}
                  onChange={(e) => setPhotoForm({ ...photoForm, toDepth: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Select Core Tray Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const r = new FileReader();
                  r.onload = () => setPhotoForm((prev) => ({ ...prev, imageUrl: String(r.result) }));
                  r.readAsDataURL(f);
                }}
                className="w-full text-xs text-slate-300"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Caption</label>
              <input
                type="text"
                value={photoForm.caption}
                onChange={(e) => setPhotoForm({ ...photoForm, caption: e.target.value })}
                placeholder="e.g. Box 1 showing smoky quartz lode contact at 6.0m"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsPhotoModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePhoto}
                disabled={!photoForm.imageUrl}
                className="px-5 py-2 rounded-lg bg-amber-500 text-slate-950 text-xs font-black disabled:opacity-40 cursor-pointer"
              >
                Save Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 5: SIGNATURE PAD MODAL                                      */}
      {/* ================================================================= */}
      {signingParty && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase text-white">
                Draw Official Signature ({signingParty.toUpperCase()})
              </h3>
              <button
                onClick={() => setSigningParty(null)}
                className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <canvas
              ref={sigCanvasRef}
              width={380}
              height={160}
              onMouseDown={startSigDraw}
              onMouseMove={moveSigDraw}
              onMouseUp={endSigDraw}
              onMouseLeave={endSigDraw}
              onTouchStart={startSigDraw}
              onTouchMove={moveSigDraw}
              onTouchEnd={endSigDraw}
              className="w-full h-40 bg-white rounded-xl border-2 border-slate-600 cursor-crosshair touch-none"
            />

            <div className="flex items-center justify-between">
              <button
                onClick={clearSigCanvas}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear
              </button>
              <button
                onClick={saveSigCanvas}
                className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Apply Signature
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 6: DATA & STORAGE REGISTRY MODAL                            */}
      {/* ================================================================= */}
      {isStorageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                Exploration Drillhole Registry ({holes.length} Holes)
              </h3>
              <button
                onClick={() => setIsStorageModalOpen(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {holes.map((h) => (
                <div
                  key={h.id}
                  onClick={() => {
                    setActiveHoleId(h.id);
                    setActiveMiningDrillHoleId(h.id);
                    setIsStorageModalOpen(false);
                  }}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                    h.id === activeHole.id
                      ? 'bg-amber-500/10 border-amber-500/50'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="text-xs font-black text-amber-300 font-mono">{h.holeId}</div>
                    <div className="text-[11px] text-slate-300">
                      Target: {h.targetOreZone || 'Unassigned'} • {h.runs.length} Core Runs • RQD {h.overallRqdPercent}%
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{h.significantInterceptsSummary}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Import Drillhole JSON
                <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
              </label>
              <button
                onClick={handleExportJson}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export Active Hole JSON
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 7: PRINTABLE A4 EXPLORATION CORE LOG REPORT MODAL           */}
      {/* ================================================================= */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col overflow-hidden">
          <div className="shrink-0 bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between print:hidden">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-black uppercase text-white">
                A4 Exploration Diamond Drillhole Core Log Sheet — {activeHole.holeId}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Download CSV
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / Save PDF (A4)
              </button>
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-slate-950 print:bg-white print:p-0">
            <div className="a4-page max-w-[210mm] min-h-[297mm] mx-auto bg-white text-slate-900 p-8 rounded-lg shadow-2xl print:shadow-none space-y-5 flex flex-col justify-between">
              <div className="space-y-5">
                {/* Engineering Title Block */}
                <div className="border-2 border-slate-900 p-4 flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      EXPLORATION &amp; GRADE CONTROL DIAMOND CORE LOG (ISRM / JORC COMPLIANT)
                    </div>
                    <h1 className="text-xl font-black text-slate-900 mt-0.5">
                      DRILLHOLE ID: {activeHole.holeId} — TARGET: {activeHole.targetOreZone || 'N/A'}
                    </h1>
                    <p className="text-xs font-semibold text-slate-700">
                      Company: {activeHole.miningCompany || 'N/A'} • Contractor: {activeHole.drillingContractor || 'N/A'} • Logged By: {activeHole.loggedBy || 'N/A'}
                    </p>
                  </div>
                  <div className="text-right font-mono text-xs">
                    <div className="font-black">Core Size: {activeHole.coreDiameter}</div>
                    <div>Collar: {activeHole.collarEasting}E, {activeHole.collarNorthing}N</div>
                    <div>RL: {activeHole.collarElevationMrl}mRL | Dip {activeHole.collarDipDeg}° / Az {activeHole.collarAzimuthDeg}°</div>
                  </div>
                </div>

                {/* Summary KPIs */}
                <div className="grid grid-cols-5 gap-2 border border-slate-300 p-3 bg-slate-50 text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 block font-bold">Logged Depth</span>
                    <span className="font-mono font-black">{holeStats.totalDrilled.toFixed(2)} m</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 block font-bold">Mean TCR %</span>
                    <span className="font-mono font-black">{holeStats.avgTcr.toFixed(1)} %</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 block font-bold">Mean RQD %</span>
                    <span className="font-mono font-black">{holeStats.avgRqd.toFixed(1)} % ({holeStats.rqdRating})</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] uppercase text-slate-500 block font-bold">Significant Ore Intercept</span>
                    <span className="font-mono font-black text-amber-800">{activeHole.significantInterceptsSummary}</span>
                  </div>
                </div>

                {/* Runs Schedule Table */}
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider border-b-2 border-slate-900 pb-1 mb-2">
                    Downhole Core Run, Geotechnical, Alteration &amp; Assay Schedule
                  </h2>
                  {activeHole.runs.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-300">
                      No core runs logged by user yet.
                    </div>
                  ) : (
                    <table className="w-full border-collapse border border-slate-400 text-[10px]">
                      <thead>
                        <tr className="bg-slate-200 text-slate-900 font-black uppercase">
                          <th className="border border-slate-400 p-1.5">Run</th>
                          <th className="border border-slate-400 p-1.5">From–To (m)</th>
                          <th className="border border-slate-400 p-1.5">TCR %</th>
                          <th className="border border-slate-400 p-1.5">RQD %</th>
                          <th className="border border-slate-400 p-1.5">Lithology &amp; Strength</th>
                          <th className="border border-slate-400 p-1.5">Alteration &amp; Sulfides</th>
                          <th className="border border-slate-400 p-1.5">Struct α/β</th>
                          <th className="border border-slate-400 p-1.5">Sample &amp; Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeHole.runs.map((r) => (
                          <tr key={r.runNumber}>
                            <td className="border border-slate-400 p-1.5 font-mono text-center">#{r.runNumber}</td>
                            <td className="border border-slate-400 p-1.5 font-mono whitespace-nowrap">
                              {r.fromDepthM.toFixed(2)}–{r.toDepthM.toFixed(2)}
                            </td>
                            <td className="border border-slate-400 p-1.5 font-mono text-center">
                              {r.coreRecoveryPercent.toFixed(1)}%
                            </td>
                            <td className="border border-slate-400 p-1.5 font-mono text-center font-bold">
                              {r.rqdPercent.toFixed(1)}%
                            </td>
                            <td className="border border-slate-400 p-1.5">
                              <div className="font-bold">{r.lithology}</div>
                              <div className="text-[9px] text-slate-600">{r.weatheringGrade} | Is50 {r.pointLoadIs50Mpa} MPa</div>
                            </td>
                            <td className="border border-slate-400 p-1.5">
                              <div>{r.alteration}</div>
                              <div className="text-[9px] text-slate-600">{r.mineralization} ({r.sulfidePercent ?? 0}%)</div>
                            </td>
                            <td className="border border-slate-400 p-1.5 font-mono text-center">
                              {r.structureType} {r.structureDipToCoreAxisDeg}°/{r.betaAngleDeg ?? 180}°
                            </td>
                            <td className="border border-slate-400 p-1.5 font-mono font-bold">
                              {r.sampleId || '-'}: {(r.assayGradeAu ?? 0).toFixed(2)} {activeHole.primaryGradeUnit || 'g/t'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Tri-Party Signatures */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t-2 border-slate-900 text-xs">
                <div className="border border-slate-400 p-3">
                  <div className="text-[10px] font-black uppercase text-slate-600">Drilling Contractor</div>
                  <div className="eswa-signature-fit-box h-14 px-2 py-1 border border-slate-200 rounded flex items-center justify-center my-1">
                    {activeHole.signOff?.contractorSignatureUrl ? (
                      <img src={activeHole.signOff.contractorSignatureUrl} alt="Sig" className="max-h-11 max-w-full w-auto h-auto object-contain" />
                    ) : (
                      <span className="text-[9px] text-slate-400 italic">[Signature Box]</span>
                    )}
                  </div>
                  <div className="font-bold border-t border-slate-300 pt-1 truncate">
                    {activeHole.signOff?.contractorRepName || '____________________'}
                  </div>
                  <div className="text-[10px] text-slate-600 truncate">{activeHole.drillingContractor || 'Drilling Supervisor'}</div>
                </div>

                <div className="border border-slate-400 p-3">
                  <div className="text-[10px] font-black uppercase text-slate-600">Exploration Geologist</div>
                  <div className="eswa-signature-fit-box h-14 px-2 py-1 border border-slate-200 rounded flex items-center justify-center my-1">
                    {activeHole.signOff?.consultantSignatureUrl ? (
                      <img src={activeHole.signOff.consultantSignatureUrl} alt="Sig" className="max-h-11 max-w-full w-auto h-auto object-contain" />
                    ) : (
                      <span className="text-[9px] text-slate-400 italic">[Signature Box]</span>
                    )}
                  </div>
                  <div className="font-bold border-t border-slate-300 pt-1 truncate">
                    {activeHole.signOff?.consultantRepName || activeHole.loggedBy || '____________________'}
                  </div>
                  <div className="text-[10px] text-slate-600 truncate">Logging Geologist</div>
                </div>

                <div className="border border-slate-400 p-3">
                  <div className="text-[10px] font-black uppercase text-slate-600">Competent Person (JORC)</div>
                  <div className="eswa-signature-fit-box h-14 px-2 py-1 border border-slate-200 rounded flex items-center justify-center my-1">
                    {activeHole.signOff?.clientSignatureUrl ? (
                      <img src={activeHole.signOff.clientSignatureUrl} alt="Sig" className="max-h-11 max-w-full w-auto h-auto object-contain" />
                    ) : (
                      <span className="text-[9px] text-slate-400 italic">[Signature Box]</span>
                    )}
                  </div>
                  <div className="font-bold border-t border-slate-300 pt-1 truncate">
                    {activeHole.signOff?.clientRepName || '____________________'}
                  </div>
                  <div className="text-[10px] text-slate-600 truncate">{activeHole.miningCompany || 'Chief Mine Geologist'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
