import React, { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  ArrowLeft,
  Database,
  Download,
  Printer,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  BarChart3,
  Sparkles,
  Info,
  Sliders,
  Compass,
  Eye,
  Maximize2,
  Activity,
  Tag,
  ShieldCheck,
  Search,
  Filter,
  Save,
  Check,
  Edit2,
} from 'lucide-react';
import { EswaAppBackgroundWatermark, EswaTunnelLogo } from '../EswaBrandIdentity';
import { IndustryMode } from '../../types/tunnel';
import { MiningDrillHoleRecord, MiningCoreRun, MiningAssayInterval } from '../../types/mining';
import { MiningDataStorageModal } from './MiningDataStorageModal';
import {
  loadMiningDrillHoles,
  getActiveMiningDrillHoleId,
  saveMiningDrillHoles,
} from '../../engine/miningStorageEngine';

export interface MiningCoreLoggingWorkspaceProps {
  onBackToMainWindow: () => void;
  onChangeIndustryMode: (mode: IndustryMode) => void;
}

export type CoreLoggingTab = 'CORE_BOX_VIEWER' | 'CORE_RUNS' | 'LITH_ALTERATION' | 'ASSAYS_QAQC' | 'DOWNHOLE_STRIP';

export const MiningCoreLoggingWorkspace: React.FC<MiningCoreLoggingWorkspaceProps> = ({
  onBackToMainWindow,
  onChangeIndustryMode,
}) => {
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CoreLoggingTab>('CORE_BOX_VIEWER');

  // Drillholes State
  const drillHoles = useMemo(() => loadMiningDrillHoles(), [isStorageModalOpen]);
  const activeHoleId = getActiveMiningDrillHoleId() || drillHoles[0]?.id;
  const currentHole = drillHoles.find((h) => h.id === activeHoleId) || drillHoles[0];

  // Core runs & assay intervals
  const [runs, setRuns] = useState<MiningCoreRun[]>(currentHole?.runs || [
    {
      runNumber: 1,
      fromDepthM: 0.0,
      toDepthM: 3.0,
      drilledLengthM: 3.0,
      recoveredLengthM: 2.85,
      coreRecoveryPercent: 95.0,
      solidCoreLengthRqdM: 2.45,
      rqdPercent: 81.7,
      fracturesPerMeter: 4,
      pointLoadIs50Mpa: 4.8,
      lithology: 'Weathered Amphibolite Country Rock with Limonite on Fractures',
      alteration: 'Weak Chlorite + Limonite staining',
      mineralization: 'Trace Pyrite (<0.5%)',
      veinDensityPerM: 1,
      structureType: 'JOINT',
      structureDipToCoreAxisDeg: 48,
      weatheringGrade: 'SLIGHT',
    },
    {
      runNumber: 2,
      fromDepthM: 3.0,
      toDepthM: 6.2,
      drilledLengthM: 3.2,
      recoveredLengthM: 3.18,
      coreRecoveryPercent: 99.4,
      solidCoreLengthRqdM: 2.95,
      rqdPercent: 92.2,
      fracturesPerMeter: 2,
      pointLoadIs50Mpa: 6.5,
      lithology: 'Competent Massive Metabasalt with Quartz-Calcite Stringers',
      alteration: 'Moderate Silicification + Epidote',
      mineralization: 'Disseminated Pyrite (1-2%)',
      veinDensityPerM: 3,
      structureType: 'FOLIATION',
      structureDipToCoreAxisDeg: 62,
      weatheringGrade: 'FRESH',
    },
    {
      runNumber: 3,
      fromDepthM: 6.2,
      toDepthM: 9.5,
      drilledLengthM: 3.3,
      recoveredLengthM: 3.28,
      coreRecoveryPercent: 99.4,
      solidCoreLengthRqdM: 2.88,
      rqdPercent: 87.3,
      fracturesPerMeter: 3,
      pointLoadIs50Mpa: 8.2,
      lithology: 'Champion Quartz Lode with Arsenopyrite, Pyrite & Visible Gold specs',
      alteration: 'Pervasive Silicification + Sericite Alteration Halo',
      mineralization: 'Pyrite (4%), Arsenopyrite (2%), Coarse Visible Gold (3 specs)',
      veinDensityPerM: 8,
      structureType: 'VEIN',
      structureDipToCoreAxisDeg: 75,
      weatheringGrade: 'FRESH',
    },
    {
      runNumber: 4,
      fromDepthM: 9.5,
      toDepthM: 13.0,
      drilledLengthM: 3.5,
      recoveredLengthM: 3.42,
      coreRecoveryPercent: 97.7,
      solidCoreLengthRqdM: 3.10,
      rqdPercent: 88.6,
      fracturesPerMeter: 3,
      pointLoadIs50Mpa: 7.1,
      lithology: 'Silicified Footwall Amphibolite with Pyrite Stringers',
      alteration: 'Strong Biotite-Chlorite-Silica Alteration',
      mineralization: 'Pyrite stringers (2-3%), Pyrrhotite (1%)',
      veinDensityPerM: 4,
      structureType: 'SHEAR',
      structureDipToCoreAxisDeg: 55,
      weatheringGrade: 'FRESH',
    },
  ]);

  const [assays, setAssays] = useState<MiningAssayInterval[]>(currentHole?.assayIntervals || [
    {
      sampleId: 'KD-1041',
      fromDepthM: 0.0,
      toDepthM: 1.5,
      intervalLengthM: 1.5,
      primaryAssayGrade: 0.25,
      primaryGradeUnit: 'g/t',
      secondaryAssayGrade: 0.04,
      secondaryGradeUnit: '%',
      specificGravityEstimated: 2.74,
      qaqcCategory: 'NORMAL_SAMPLE',
      qaqcPass: true,
      assayLaboratory: 'ALS Geochemistry Minerals',
    },
    {
      sampleId: 'KD-1042',
      fromDepthM: 1.5,
      toDepthM: 3.0,
      intervalLengthM: 1.5,
      primaryAssayGrade: 0.42,
      primaryGradeUnit: 'g/t',
      secondaryAssayGrade: 0.06,
      secondaryGradeUnit: '%',
      specificGravityEstimated: 2.78,
      qaqcCategory: 'NORMAL_SAMPLE',
      qaqcPass: true,
      assayLaboratory: 'ALS Geochemistry Minerals',
    },
    {
      sampleId: 'KD-1043-STD',
      fromDepthM: 3.0,
      toDepthM: 3.0,
      intervalLengthM: 0.0,
      primaryAssayGrade: 4.25,
      primaryGradeUnit: 'g/t',
      secondaryAssayGrade: 0.85,
      secondaryGradeUnit: '%',
      specificGravityEstimated: 3.10,
      qaqcCategory: 'CRM_STANDARD',
      qaqcPass: true,
      assayLaboratory: 'ALS Geochemistry Minerals',
    },
    {
      sampleId: 'KD-1044',
      fromDepthM: 3.0,
      toDepthM: 4.6,
      intervalLengthM: 1.6,
      primaryAssayGrade: 1.15,
      primaryGradeUnit: 'g/t',
      secondaryAssayGrade: 0.12,
      secondaryGradeUnit: '%',
      specificGravityEstimated: 2.85,
      qaqcCategory: 'NORMAL_SAMPLE',
      qaqcPass: true,
      assayLaboratory: 'ALS Geochemistry Minerals',
    },
    {
      sampleId: 'KD-1045',
      fromDepthM: 4.6,
      toDepthM: 6.2,
      intervalLengthM: 1.6,
      primaryAssayGrade: 1.85,
      primaryGradeUnit: 'g/t',
      secondaryAssayGrade: 0.22,
      secondaryGradeUnit: '%',
      specificGravityEstimated: 2.92,
      qaqcCategory: 'NORMAL_SAMPLE',
      qaqcPass: true,
      assayLaboratory: 'ALS Geochemistry Minerals',
    },
    {
      sampleId: 'KD-1046-ORE',
      fromDepthM: 6.2,
      toDepthM: 7.8,
      intervalLengthM: 1.6,
      primaryAssayGrade: 14.85,
      primaryGradeUnit: 'g/t',
      secondaryAssayGrade: 0.65,
      secondaryGradeUnit: '%',
      specificGravityEstimated: 3.42,
      qaqcCategory: 'NORMAL_SAMPLE',
      qaqcPass: true,
      assayLaboratory: 'ALS Geochemistry Minerals',
    },
    {
      sampleId: 'KD-1047-ORE',
      fromDepthM: 7.8,
      toDepthM: 9.5,
      intervalLengthM: 1.7,
      primaryAssayGrade: 8.65,
      primaryGradeUnit: 'g/t',
      secondaryAssayGrade: 0.48,
      secondaryGradeUnit: '%',
      specificGravityEstimated: 3.38,
      qaqcCategory: 'NORMAL_SAMPLE',
      qaqcPass: true,
      assayLaboratory: 'ALS Geochemistry Minerals',
    },
    {
      sampleId: 'KD-1048-BLK',
      fromDepthM: 9.5,
      toDepthM: 9.5,
      intervalLengthM: 0.0,
      primaryAssayGrade: 0.008,
      primaryGradeUnit: 'g/t',
      secondaryAssayGrade: 0.002,
      secondaryGradeUnit: '%',
      specificGravityEstimated: 2.65,
      qaqcCategory: 'COARSE_BLANK',
      qaqcPass: true,
      assayLaboratory: 'ALS Geochemistry Minerals',
    },
    {
      sampleId: 'KD-1049',
      fromDepthM: 9.5,
      toDepthM: 11.2,
      intervalLengthM: 1.7,
      primaryAssayGrade: 3.12,
      primaryGradeUnit: 'g/t',
      secondaryAssayGrade: 0.18,
      secondaryGradeUnit: '%',
      specificGravityEstimated: 3.15,
      qaqcCategory: 'NORMAL_SAMPLE',
      qaqcPass: true,
      assayLaboratory: 'ALS Geochemistry Minerals',
    },
    {
      sampleId: 'KD-1050',
      fromDepthM: 11.2,
      toDepthM: 13.0,
      intervalLengthM: 1.8,
      primaryAssayGrade: 1.45,
      primaryGradeUnit: 'g/t',
      secondaryAssayGrade: 0.08,
      secondaryGradeUnit: '%',
      specificGravityEstimated: 2.88,
      qaqcCategory: 'NORMAL_SAMPLE',
      qaqcPass: true,
      assayLaboratory: 'ALS Geochemistry Minerals',
    },
  ]);

  // Selected core box for 3D/Tray viewer
  const [selectedBoxIndex, setSelectedBoxIndex] = useState<number>(0);
  const [selectedCoreRun, setSelectedCoreRun] = useState<MiningCoreRun | null>(runs[2]);

  // Intercept Compositing Parameters
  const [compositeCutoff, setCompositeCutoff] = useState<number>(2.00); // g/t Au
  const [maxInternalWasteM, setMaxInternalWasteM] = useState<number>(1.5); // m

  // Overall KPIs
  const overallStats = useMemo(() => {
    let totDrilled = 0;
    let totRecovered = 0;
    let totRqdLen = 0;

    runs.forEach((r) => {
      totDrilled += r.drilledLengthM;
      totRecovered += r.recoveredLengthM;
      totRqdLen += r.solidCoreLengthRqdM;
    });

    const recoveryPct = totDrilled > 0 ? (totRecovered / totDrilled) * 100 : 0;
    const rqdPct = totDrilled > 0 ? (totRqdLen / totDrilled) * 100 : 0;

    // Significant intercept compositing
    let oreLen = 0;
    let oreMetal = 0;
    let startDepth = 0;
    let endDepth = 0;
    let isInsideOre = false;

    assays.forEach((a) => {
      if (a.primaryAssayGrade >= compositeCutoff && a.qaqcCategory === 'NORMAL_SAMPLE') {
        if (!isInsideOre) {
          startDepth = a.fromDepthM;
          isInsideOre = true;
        }
        oreLen += a.intervalLengthM;
        oreMetal += a.intervalLengthM * a.primaryAssayGrade;
        endDepth = a.toDepthM;
      }
    });
    const avgGrade = oreLen > 0 ? oreMetal / oreLen : 0;

    return {
      totDrilled,
      totRecovered,
      recoveryPct: Number(recoveryPct.toFixed(1)),
      rqdPct: Number(rqdPct.toFixed(1)),
      oreLen: Number(oreLen.toFixed(2)),
      avgGrade: Number(avgGrade.toFixed(2)),
      startDepth: Number(startDepth.toFixed(1)),
      endDepth: Number(endDepth.toFixed(1)),
    };
  }, [runs, assays, compositeCutoff]);

  // Persistence State & Auto-Sync
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVED'>('IDLE');

  // Sync state if current drill hole changes
  useEffect(() => {
    if (currentHole) {
      if (currentHole.runs && currentHole.runs.length > 0) {
        setRuns(currentHole.runs);
      }
      if (currentHole.assayIntervals && currentHole.assayIntervals.length > 0) {
        setAssays(currentHole.assayIntervals);
      }
    }
  }, [currentHole?.id]);

  // Save changes to Mining storage engine
  const handleSaveHoleData = () => {
    if (!currentHole) return;
    const allHoles = loadMiningDrillHoles();
    const idx = allHoles.findIndex((h) => h.id === currentHole.id);
    if (idx >= 0) {
      allHoles[idx] = {
        ...allHoles[idx],
        runs,
        assayIntervals: assays,
        overallRecoveryPercent: overallStats.recoveryPct,
        overallRqdPercent: overallStats.rqdPct,
        significantInterceptsSummary: `${overallStats.oreLen}m @ ${overallStats.avgGrade} g/t Au (from ${overallStats.startDepth}m)`,
        updatedAt: new Date().toISOString(),
      };
      saveMiningDrillHoles(allHoles);
      setSaveStatus('SAVED');
      setTimeout(() => setSaveStatus('IDLE'), 2000);
    }
  };

  // Handlers for Core Runs
  const handleAddRun = () => {
    const lastRun = runs[runs.length - 1];
    const fromDepth = lastRun ? lastRun.toDepthM : 0;
    const toDepth = fromDepth + 3.0;
    const newRun: MiningCoreRun = {
      runNumber: runs.length + 1,
      fromDepthM: Number(fromDepth.toFixed(1)),
      toDepthM: Number(toDepth.toFixed(1)),
      drilledLengthM: 3.0,
      recoveredLengthM: 2.95,
      coreRecoveryPercent: 98.3,
      solidCoreLengthRqdM: 2.7,
      rqdPercent: 90.0,
      fracturesPerMeter: 3,
      pointLoadIs50Mpa: 6.8,
      lithology: 'Metabasalt Country Rock with Quartz Veinlets',
      alteration: 'Moderate Silicification + Chlorite',
      mineralization: 'Disseminated Pyrite (1-2%)',
      veinDensityPerM: 3,
      structureType: 'JOINT',
      structureDipToCoreAxisDeg: 55,
      weatheringGrade: 'FRESH',
    };
    const updated = [...runs, newRun];
    setRuns(updated);

    // Auto-persist to storage
    const allHoles = loadMiningDrillHoles();
    const idx = allHoles.findIndex((h) => h.id === currentHole.id);
    if (idx >= 0) {
      allHoles[idx] = { ...allHoles[idx], runs: updated, updatedAt: new Date().toISOString() };
      saveMiningDrillHoles(allHoles);
    }
  };

  const handleDeleteRun = (runNum: number) => {
    if (runs.length <= 1) return;
    const updated = runs.filter((r) => r.runNumber !== runNum);
    setRuns(updated);

    const allHoles = loadMiningDrillHoles();
    const idx = allHoles.findIndex((h) => h.id === currentHole.id);
    if (idx >= 0) {
      allHoles[idx] = { ...allHoles[idx], runs: updated, updatedAt: new Date().toISOString() };
      saveMiningDrillHoles(allHoles);
    }
  };

  // Handlers for Assays & QA/QC
  const handleAddAssayInterval = () => {
    const normalAssays = assays.filter((a) => a.intervalLengthM > 0);
    const lastAssay = normalAssays[normalAssays.length - 1];
    const fromDepth = lastAssay ? lastAssay.toDepthM : 0;
    const toDepth = fromDepth + 1.5;
    const nextNum = assays.length + 1041;
    const newAssay: MiningAssayInterval = {
      sampleId: `KD-${nextNum}`,
      fromDepthM: Number(fromDepth.toFixed(1)),
      toDepthM: Number(toDepth.toFixed(1)),
      intervalLengthM: 1.5,
      primaryAssayGrade: 2.50,
      primaryGradeUnit: 'g/t',
      secondaryAssayGrade: 0.15,
      secondaryGradeUnit: '%',
      specificGravityEstimated: 2.85,
      qaqcCategory: 'NORMAL_SAMPLE',
      qaqcPass: true,
      assayLaboratory: 'ALS Geochemistry Minerals',
    };
    const updated = [...assays, newAssay];
    setAssays(updated);

    const allHoles = loadMiningDrillHoles();
    const idx = allHoles.findIndex((h) => h.id === currentHole.id);
    if (idx >= 0) {
      allHoles[idx] = { ...allHoles[idx], assayIntervals: updated, updatedAt: new Date().toISOString() };
      saveMiningDrillHoles(allHoles);
    }
  };

  const handleInsertQaqcControl = (category: 'CRM_STANDARD' | 'COARSE_BLANK') => {
    const lastAssay = assays[assays.length - 1];
    const currentDepth = lastAssay ? lastAssay.toDepthM : 0;
    const nextNum = assays.length + 1041;
    const newAssay: MiningAssayInterval = {
      sampleId: category === 'CRM_STANDARD' ? `KD-${nextNum}-STD` : `KD-${nextNum}-BLK`,
      fromDepthM: currentDepth,
      toDepthM: currentDepth,
      intervalLengthM: 0,
      primaryAssayGrade: category === 'CRM_STANDARD' ? 5.25 : 0.005,
      primaryGradeUnit: 'g/t',
      secondaryAssayGrade: category === 'CRM_STANDARD' ? 0.35 : 0.001,
      secondaryGradeUnit: '%',
      specificGravityEstimated: category === 'CRM_STANDARD' ? 3.10 : 2.65,
      qaqcCategory: category,
      qaqcPass: true,
      assayLaboratory: 'ALS Geochemistry Minerals',
    };
    const updated = [...assays, newAssay];
    setAssays(updated);

    const allHoles = loadMiningDrillHoles();
    const idx = allHoles.findIndex((h) => h.id === currentHole.id);
    if (idx >= 0) {
      allHoles[idx] = { ...allHoles[idx], assayIntervals: updated, updatedAt: new Date().toISOString() };
      saveMiningDrillHoles(allHoles);
    }
  };

  const handleDeleteAssay = (sampleId: string) => {
    if (assays.length <= 1) return;
    const updated = assays.filter((a) => a.sampleId !== sampleId);
    setAssays(updated);

    const allHoles = loadMiningDrillHoles();
    const idx = allHoles.findIndex((h) => h.id === currentHole.id);
    if (idx >= 0) {
      allHoles[idx] = { ...allHoles[idx], assayIntervals: updated, updatedAt: new Date().toISOString() };
      saveMiningDrillHoles(allHoles);
    }
  };

  const handleUpdateAssayGrade = (sampleId: string, newGrade: number) => {
    const updated = assays.map((a) => (a.sampleId === sampleId ? { ...a, primaryAssayGrade: newGrade } : a));
    setAssays(updated);

    const allHoles = loadMiningDrillHoles();
    const idx = allHoles.findIndex((h) => h.id === currentHole.id);
    if (idx >= 0) {
      allHoles[idx] = { ...allHoles[idx], assayIntervals: updated, updatedAt: new Date().toISOString() };
      saveMiningDrillHoles(allHoles);
    }
  };

  const handleExportCSV = () => {
    const rows: string[][] = [
      ['Hole ID', currentHole.holeId],
      ['Hole Type', currentHole.holeType],
      ['Core Diameter', currentHole.coreDiameter],
      ['Collar Dip (°)', String(currentHole.collarDipDeg)],
      ['Collar Azimuth (°)', String(currentHole.collarAzimuthDeg)],
      ['Total Depth (m)', String(currentHole.totalDrilledDepthM)],
      [],
      ['Run #', 'From (m)', 'To (m)', 'Drilled (m)', 'Recovered (m)', 'Recovery %', 'RQD %', 'Fr/m', 'Point Load Is50 (MPa)', 'Lithology', 'Alteration', 'Mineralization', 'Structure', 'Alpha (°)'],
    ];

    runs.forEach((r) => {
      rows.push([
        String(r.runNumber),
        r.fromDepthM.toFixed(2),
        r.toDepthM.toFixed(2),
        r.drilledLengthM.toFixed(2),
        r.recoveredLengthM.toFixed(2),
        r.coreRecoveryPercent.toFixed(1),
        r.rqdPercent.toFixed(1),
        String(r.fracturesPerMeter),
        String(r.pointLoadIs50Mpa),
        r.lithology,
        r.alteration,
        r.mineralization,
        r.structureType,
        String(r.structureDipToCoreAxisDeg),
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${currentHole.holeId}_Core_Log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans select-none relative">
      <EswaAppBackgroundWatermark visible showLogoWatermark={true} />

      {/* Top Header */}
      <header className="flex-none bg-slate-900 px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3 shadow-lg z-20 border-b border-amber-500/40">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              handleSaveHoleData();
              onBackToMainWindow();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono font-bold cursor-pointer transition-all text-amber-300"
            title="Return to Mining Main Window (auto-saves)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Main Window</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-bold font-mono text-slate-100 flex items-center gap-2 truncate">
                <span>EXPLORATION &amp; PRODUCTION CORE LOGGING</span>
                <span className="text-cyan-400 font-semibold truncate hidden md:inline">
                  · {currentHole.holeId} ({currentHole.coreDiameter} Core)
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 font-mono truncate">
                Dip: {currentHole.collarDipDeg}° · Az: {currentHole.collarAzimuthDeg}° · Rec: {overallStats.recoveryPct}% · RQD: {overallStats.rqdPct}% · Intercept: <strong className="text-amber-300">{overallStats.oreLen}m @ {overallStats.avgGrade} g/t Au</strong>
              </p>
            </div>
          </div>
        </div>

        {/* 5 Tabs Navigation */}
        <nav className="hidden lg:flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 shadow-inner font-mono text-xs font-bold">
          {[
            { id: 'CORE_BOX_VIEWER' as CoreLoggingTab, label: '1. Virtual Core Box' },
            { id: 'CORE_RUNS' as CoreLoggingTab, label: `2. Core Runs (${runs.length})` },
            { id: 'LITH_ALTERATION' as CoreLoggingTab, label: '3. Lith & Structure' },
            { id: 'ASSAYS_QAQC' as CoreLoggingTab, label: `4. Assays & QA/QC (${assays.length})` },
            { id: 'DOWNHOLE_STRIP' as CoreLoggingTab, label: '5. Downhole Strip Sheet' },
          ].map((t) => {
            const isAct = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  isAct
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Actions & Vault */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono font-bold">
            {(['NATM', 'TBM', 'MINING'] as IndustryMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChangeIndustryMode(m)}
                className={`px-2 py-1 rounded transition-colors ${
                  m === 'MINING'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSaveHoleData}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold cursor-pointer transition-all shadow ${
              saveStatus === 'SAVED'
                ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
            }`}
          >
            {saveStatus === 'SAVED' ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saveStatus === 'SAVED' ? 'Saved' : 'Save Hole'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-mono font-bold cursor-pointer"
            title="Export core log to CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsStorageModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-mono font-bold cursor-pointer"
            title="Open isolated Mining vault and backups"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Data &amp; Storage</span>
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-5 font-mono text-xs space-y-4">
        {/* Mobile Tab Bar */}
        <div className="lg:hidden flex items-center justify-between gap-1 overflow-x-auto pb-1 border-b border-slate-800">
          {[
            { id: 'CORE_BOX_VIEWER' as CoreLoggingTab, label: '1. Core Box' },
            { id: 'CORE_RUNS' as CoreLoggingTab, label: '2. Runs' },
            { id: 'LITH_ALTERATION' as CoreLoggingTab, label: '3. Lith' },
            { id: 'ASSAYS_QAQC' as CoreLoggingTab, label: '4. Assays' },
            { id: 'DOWNHOLE_STRIP' as CoreLoggingTab, label: '5. Strip' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap ${
                activeTab === t.id ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-900 text-slate-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-slate-400 text-[10px]">Total Drilled Length:</span>
            <p className="text-xl font-bold text-slate-100">{overallStats.totDrilled.toFixed(1)} m</p>
            <span className="text-[9px] text-slate-500">Target depth: {currentHole.totalDrilledDepthM}m</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-slate-400 text-[10px]">Average Core Recovery:</span>
            <p className="text-xl font-bold text-emerald-400">{overallStats.recoveryPct} %</p>
            <span className="text-[9px] text-emerald-500">TCR &gt; 95% (Excellent)</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-slate-400 text-[10px]">Weighted RQD %:</span>
            <p className="text-xl font-bold text-cyan-400">{overallStats.rqdPct} %</p>
            <span className="text-[9px] text-cyan-500">Solid sticks &gt;= 10cm</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-slate-400 text-[10px]">Composite Mineralized Intercept:</span>
            <p className="text-xl font-bold text-amber-300">
              {overallStats.oreLen > 0 ? `${overallStats.oreLen}m @ ${overallStats.avgGrade} g/t` : 'No high-grade'}
            </p>
            <span className="text-[9px] text-amber-500">
              {overallStats.oreLen > 0 ? `From ${overallStats.startDepth}m to ${overallStats.endDepth}m` : 'Cut-off >= 2.0g/t'}
            </span>
          </div>
        </div>

        {/* ===================================================================
            TAB 1: VIRTUAL CORE BOX & TRAY INSPECTOR
            =================================================================== */}
        {activeTab === 'CORE_BOX_VIEWER' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
                <div>
                  <h3 className="font-bold text-xs text-cyan-300 uppercase flex items-center gap-2">
                    <Eye className="w-4 h-4 text-cyan-400" />
                    <span>DIAMOND DRILL CORE TRAY &amp; BOX INSPECTOR</span>
                  </h3>
                  <p className="text-slate-400 text-xs">
                    Inspect core sticks, fractures, bottom-of-hole orientation line, and structural alpha/beta angles.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-bold">Select Core Box:</span>
                  {[
                    { id: 0, label: 'Box 1: 0.0 – 4.5m' },
                    { id: 1, label: 'Box 2: 4.5 – 9.0m (ORE)' },
                    { id: 2, label: 'Box 3: 9.0 – 13.0m' },
                  ].map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBoxIndex(b.id)}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
                        selectedBoxIndex === b.id
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Graphic Virtual Core Box Simulation (Aluminum Core Tray with 3 Rows) */}
              <div className="w-full bg-slate-950 rounded-2xl border-2 border-slate-800 p-4 space-y-3 relative shadow-inner">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-200">Hole: <strong>{currentHole.holeId}</strong></span>
                    <span>· Box #{selectedBoxIndex + 1} of 3</span>
                    <span>· Core Size: <strong className="text-cyan-400">HQ (Ø 63.5mm)</strong></span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-rose-400 flex items-center gap-1">
                      <span className="w-3 h-0.5 bg-rose-500" /> BOH Orientation Line
                    </span>
                    <span className="text-amber-400 flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-amber-500" /> Quartz Ribbon Ore
                    </span>
                  </div>
                </div>

                {/* SVG Core Tray */}
                <svg viewBox="0 0 700 240" className="w-full h-auto rounded-xl bg-slate-900 border border-slate-800">
                  {/* Tray Channels (3 Channels per Box) */}
                  {[30, 95, 160].map((y, chIdx) => {
                    const rowStartM = selectedBoxIndex * 4.5 + chIdx * 1.5;
                    const rowEndM = rowStartM + 1.5;
                    const isOreRow = rowStartM >= 4.5 && rowStartM <= 9.0;

                    return (
                      <g key={`row-${chIdx}`}>
                        {/* Channel Trough */}
                        <rect x="50" y={y} width="600" height="45" rx="6" fill="#0B132B" stroke="#1E293B" strokeWidth="1.5" />

                        {/* Metre Wood Blocks at starts */}
                        <rect x="52" y={y + 2} width="16" height="41" rx="2" fill="#D97706" />
                        <text x="60" y={y + 24} fill="#000" fontSize="7" fontWeight="bold" textAnchor="middle" transform={`rotate(-90 60 ${y + 24})`}>
                          {rowStartM.toFixed(1)}m
                        </text>

                        {/* Core Cylinder Pieces */}
                        {isOreRow ? (
                          // Quartz-sulfide ore with coarse gold specs
                          <g>
                            <rect x="70" y={y + 5} width="240" height="35" rx="4" fill="#B45309" stroke="#F59E0B" strokeWidth="1.5" />
                            {/* Quartz vein texture */}
                            <path d={`M 110,${y + 5} L 125,${y + 40} M 180,${y + 5} L 195,${y + 40}`} stroke="#FDE047" strokeWidth="2.5" />
                            {/* Gold specs */}
                            <circle cx="150" cy={y + 22} r="3" fill="#FACC15" />
                            <circle cx="210" cy={y + 16} r="2.5" fill="#FACC15" />
                            {/* Fracture break */}
                            <line x1="312" y1={y + 5} x2="310" y2={y + 40} stroke="#0B132B" strokeWidth="3" />
                            {/* Next stick */}
                            <rect x="315" y={y + 5} width="315" height="35" rx="4" fill="#92400E" stroke="#F59E0B" strokeWidth="1.5" />
                            <circle cx="420" cy={y + 25} r="3" fill="#FACC15" />
                            <circle cx="490" cy={y + 18} r="3" fill="#FACC15" />
                          </g>
                        ) : (
                          // Country Rock Metabasalt
                          <g>
                            <rect x="70" y={y + 5} width="180" height="35" rx="4" fill="#1E293B" stroke="#38BDF8" strokeWidth="1" />
                            <line x1="252" y1={y + 5} x2="250" y2={y + 40} stroke="#0B132B" strokeWidth="3" />
                            <rect x="255" y={y + 5} width="220" height="35" rx="4" fill="#334155" stroke="#38BDF8" strokeWidth="1" />
                            <line x1="477" y1={y + 5} x2="475" y2={y + 40} stroke="#0B132B" strokeWidth="3" />
                            <rect x="480" y={y + 5} width="150" height="35" rx="4" fill="#1E293B" stroke="#38BDF8" strokeWidth="1" />
                          </g>
                        )}

                        {/* Bottom-of-hole Orientation Line (Red solid crayon line) */}
                        <line x1="70" y1={y + 22} x2="630" y2={y + 22} stroke="#EF4444" strokeWidth="2" strokeDasharray="6 2" opacity="0.8" />

                        {/* End of row block */}
                        <rect x="632" y={y + 2} width="16" height="41" rx="2" fill="#D97706" />
                        <text x="640" y={y + 24} fill="#000" fontSize="7" fontWeight="bold" textAnchor="middle" transform={`rotate(-90 640 ${y + 24})`}>
                          {rowEndM.toFixed(1)}m
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Selected Run Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] pt-1">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block font-bold">Oriented Core Goniometer:</span>
                    <p className="text-cyan-300 font-bold mt-0.5">Alpha (α): 75° to Core Axis</p>
                    <p className="text-amber-300 font-bold">Beta (β): 215° from BOH line</p>
                    <span className="text-[10px] text-slate-500">Calculated True Dip: 74° → 285° Dip Dir</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block font-bold">Geotechnical Rock Strength:</span>
                    <p className="text-emerald-400 font-bold mt-0.5">Point Load Is50: 8.2 MPa</p>
                    <p className="text-slate-200">Estimated UCS: ~196 MPa (Very Strong)</p>
                    <span className="text-[10px] text-slate-500">Weathering: Fresh (W1)</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block font-bold">Visual Mineralization:</span>
                    <p className="text-amber-400 font-bold mt-0.5">Visible Gold: 3 coarse specs</p>
                    <p className="text-slate-200">Pyrite: 4% · Arsenopyrite: 2%</p>
                    <span className="text-[10px] text-slate-500">Lode: Champion Quartz Ribbon</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 2: CORE RUNS & GEOTECHNICAL LOGGING TABLE
            =================================================================== */}
        {activeTab === 'CORE_RUNS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-cyan-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  <span>Drill Core Box Runs &amp; Geotechnical Log</span>
                </h3>
                <p className="text-slate-400 text-xs">
                  Interval by interval core recovery (TCR), solid core length (SCR), RQD %, and joint frequency.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddRun}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-1 text-xs cursor-pointer shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Next Run #{runs.length + 1}</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase">
                  <tr>
                    <th className="p-2.5">Run #</th>
                    <th className="p-2.5">From – To (m)</th>
                    <th className="p-2.5">Drilled (m)</th>
                    <th className="p-2.5">Recovered (m)</th>
                    <th className="p-2.5">Recovery %</th>
                    <th className="p-2.5">RQD %</th>
                    <th className="p-2.5">Fr/m</th>
                    <th className="p-2.5">Is50 (MPa)</th>
                    <th className="p-2.5">Lithology &amp; Fabric</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {runs.map((r) => (
                    <tr key={r.runNumber} className="hover:bg-slate-800/40">
                      <td className="p-2.5 font-bold text-cyan-400">Run #{r.runNumber}</td>
                      <td className="p-2.5 font-mono">{r.fromDepthM.toFixed(1)}m – {r.toDepthM.toFixed(1)}m</td>
                      <td className="p-2.5">{r.drilledLengthM.toFixed(2)}m</td>
                      <td className="p-2.5">{r.recoveredLengthM.toFixed(2)}m</td>
                      <td className="p-2.5 font-bold text-emerald-400">{r.coreRecoveryPercent.toFixed(1)}%</td>
                      <td className="p-2.5 font-bold text-cyan-400">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${
                          r.rqdPercent >= 90 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                          r.rqdPercent >= 75 ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
                          r.rqdPercent >= 50 ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                          'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}>
                          {r.rqdPercent.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-2.5">{r.fracturesPerMeter}</td>
                      <td className="p-2.5 font-bold text-amber-300">{r.pointLoadIs50Mpa}</td>
                      <td className="p-2.5 text-slate-100">{r.lithology}</td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRun(r.runNumber)}
                          className="p-1 rounded hover:bg-rose-900/50 text-rose-400 cursor-pointer transition-colors"
                          title="Delete run"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 3: LITHOLOGY, ALTERATION & STRUCTURAL WORKBENCH
            =================================================================== */}
        {activeTab === 'LITH_ALTERATION' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Lithological Units in this Hole */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="font-bold text-xs text-amber-300 uppercase flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Lithology &amp; Mineralized Zones</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">Diamond Drill Hole {currentHole.holeId}</span>
                </div>

                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-100 flex items-center gap-2">
                        <span className="w-3 h-3 rounded bg-slate-600" />
                        <span>Hangingwall Amphibolite / Metabasalt</span>
                      </strong>
                      <span className="text-slate-400 font-mono">0.0m – 6.2m</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Dark greenish-black, fine-to-medium grained, foliated amphibolite country rock with minor quartz-carbonate veinlets and disseminated pyrite (&lt;1%).
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-amber-500/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-amber-300 flex items-center gap-2">
                        <span className="w-3 h-3 rounded bg-amber-400" />
                        <span>Champion Quartz-Sulfide Main Ore Lode</span>
                      </strong>
                      <span className="text-amber-400 font-mono font-bold">6.2m – 9.5m (3.3m true)</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Smoky grey-white ribbon quartz with stylolitic tourmaline-pyrite-arsenopyrite bands. Coarse visible gold clusters noted at 7.4m and 8.1m. High-grade gold intersection.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-100 flex items-center gap-2">
                        <span className="w-3 h-3 rounded bg-cyan-600" />
                        <span>Footwall Silicified Metabasalt</span>
                      </strong>
                      <span className="text-slate-400 font-mono">9.5m – 13.0m (EOH)</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Competent, intensely silicified and chloritized basalt with 2-3% pyrite stringers along shearing planes.
                    </p>
                  </div>
                </div>
              </div>

              {/* Structural Discontinuities (Alpha/Beta Angles) */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="font-bold text-xs text-cyan-300 uppercase flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-cyan-400" />
                    <span>Oriented Core Structural Measurements</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">Bottom-of-Hole Reference</span>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase">
                      <tr>
                        <th className="p-2">Depth (m)</th>
                        <th className="p-2">Structure</th>
                        <th className="p-2">Alpha (α)</th>
                        <th className="p-2">Beta (β)</th>
                        <th className="p-2">True Dip / Dir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      <tr>
                        <td className="p-2 font-mono">2.4m</td>
                        <td className="p-2 text-cyan-300">Foliation</td>
                        <td className="p-2">62°</td>
                        <td className="p-2">210°</td>
                        <td className="p-2 font-bold text-slate-100">72° → 282°</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-mono">4.8m</td>
                        <td className="p-2 text-slate-400">Joint Set J2</td>
                        <td className="p-2">35°</td>
                        <td className="p-2">045°</td>
                        <td className="p-2 font-bold text-slate-100">55° → 115°</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-mono">7.2m</td>
                        <td className="p-2 text-amber-300 font-bold">Vein Margin</td>
                        <td className="p-2">75°</td>
                        <td className="p-2">215°</td>
                        <td className="p-2 font-bold text-amber-400">74° → 285°</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-mono">11.4m</td>
                        <td className="p-2 text-rose-300">Shear Plane</td>
                        <td className="p-2">55°</td>
                        <td className="p-2">205°</td>
                        <td className="p-2 font-bold text-slate-100">68° → 278°</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-400">
                  <strong className="text-slate-200 block mb-0.5">True Dip Formula:</strong>
                  <span>Calculated via spherical trigonometry from Alpha/Beta angles combined with collar Dip ({currentHole.collarDipDeg}°) and Azimuth ({currentHole.collarAzimuthDeg}°).</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 4: ASSAY SAMPLING, QA/QC & SHEWHART CONTROL CHART
            =================================================================== */}
        {activeTab === 'ASSAYS_QAQC' && (
          <div className="space-y-4">
            {/* QA/QC Control Banner */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-xs text-amber-300 uppercase flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Assay QA/QC Quality Assurance &amp; Standards Control</span>
                </h3>
                <p className="text-slate-400 text-xs">
                  Certified Reference Materials (CRM Standards), Coarse Blanks, and Duplicate controls inserted at 1:20 frequency.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddAssayInterval}
                  className="px-2.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Sample</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertQaqcControl('COARSE_BLANK')}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 text-blue-200 border border-blue-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Blank</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertQaqcControl('CRM_STANDARD')}
                  className="px-2.5 py-1.5 rounded-lg bg-purple-900 hover:bg-purple-800 text-purple-200 border border-purple-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ CRM Std</span>
                </button>
              </div>
            </div>

            {/* Assay Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase">
                  <tr>
                    <th className="p-2.5">Sample ID</th>
                    <th className="p-2.5">Interval (m)</th>
                    <th className="p-2.5">Length (m)</th>
                    <th className="p-2.5">Au Fire Assay (g/t)</th>
                    <th className="p-2.5">Cu ICP-MS (%)</th>
                    <th className="p-2.5">SG (t/m³)</th>
                    <th className="p-2.5">Sample Type</th>
                    <th className="p-2.5">QA/QC Status</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {assays.map((a) => {
                    const isBlank = a.qaqcCategory === 'COARSE_BLANK';
                    const isStd = a.qaqcCategory === 'CRM_STANDARD';
                    const blankPass = isBlank ? a.primaryAssayGrade <= 0.05 : true;
                    const stdPass = isStd ? Math.abs(a.primaryAssayGrade - 5.25) <= 0.5 : true;
                    const pass = blankPass && stdPass;

                    return (
                      <tr key={a.sampleId} className="hover:bg-slate-800/40">
                        <td className="p-2.5 font-bold text-cyan-400">{a.sampleId}</td>
                        <td className="p-2.5 font-mono">
                          {a.intervalLengthM > 0 ? `${a.fromDepthM.toFixed(1)}m – ${a.toDepthM.toFixed(1)}m` : 'QA/QC Control'}
                        </td>
                        <td className="p-2.5">{a.intervalLengthM > 0 ? `${a.intervalLengthM.toFixed(2)}m` : '—'}</td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step="0.01"
                              value={a.primaryAssayGrade}
                              onChange={(e) => handleUpdateAssayGrade(a.sampleId, parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-amber-300 font-bold font-mono text-xs focus:border-amber-400 focus:outline-none"
                            />
                            <span className="text-[10px] text-slate-400">g/t</span>
                          </div>
                        </td>
                        <td className="p-2.5 text-cyan-300">
                          {a.secondaryAssayGrade ? `${a.secondaryAssayGrade.toFixed(2)} %` : '—'}
                        </td>
                        <td className="p-2.5">{a.specificGravityEstimated.toFixed(2)}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isStd
                              ? 'bg-purple-950 text-purple-300 border border-purple-800'
                              : isBlank
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {a.qaqcCategory}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            pass
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}>
                            {pass ? 'PASS' : 'FAIL'}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteAssay(a.sampleId)}
                            className="p-1 rounded hover:bg-rose-900/50 text-rose-400 cursor-pointer transition-colors"
                            title="Delete assay interval"
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
          </div>
        )}

        {/* ===================================================================
            TAB 5: DOWNHOLE MULTI-TRACK STRIP LOG
            =================================================================== */}
        {activeTab === 'DOWNHOLE_STRIP' && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-base text-cyan-300">
                    DOWNHOLE MULTI-PARAMETER EXPLORATION STRIP SHEET — {currentHole.holeId}
                  </h3>
                  <p className="text-slate-400 text-xs">
                    Target: {currentHole.targetOreZone} · Core: {currentHole.coreDiameter} · Logged by: {currentHole.loggedBy}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Strip Sheet</span>
                </button>
              </div>

              {/* Multi-Track Graphical Downhole Visualizer */}
              <div className="w-full bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-2">
                <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400 border-b border-slate-800 pb-1 uppercase">
                  <div className="col-span-1">Depth</div>
                  <div className="col-span-2">Core Rec %</div>
                  <div className="col-span-2">RQD %</div>
                  <div className="col-span-3">Lithology Strip</div>
                  <div className="col-span-2">Au Grade (g/t)</div>
                  <div className="col-span-2">Is50 (MPa)</div>
                </div>

                <div className="space-y-1.5 font-mono text-[11px]">
                  {runs.map((r) => {
                    const isOre = r.lithology.toLowerCase().includes('champion') || r.lithology.toLowerCase().includes('quartz');
                    return (
                      <div key={r.runNumber} className="grid grid-cols-12 items-center gap-2 p-2 rounded bg-slate-900 border border-slate-800/80">
                        {/* Depth */}
                        <div className="col-span-1 text-slate-300 font-bold">
                          {r.fromDepthM}m – {r.toDepthM}m
                        </div>

                        {/* Recovery Bar */}
                        <div className="col-span-2 flex items-center gap-1.5">
                          <div className="flex-1 h-3.5 bg-slate-800 rounded-sm overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-sm"
                              style={{ width: `${Math.min(100, r.coreRecoveryPercent)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-emerald-400 font-bold">{r.coreRecoveryPercent.toFixed(0)}%</span>
                        </div>

                        {/* RQD Bar */}
                        <div className="col-span-2 flex items-center gap-1.5">
                          <div className="flex-1 h-3.5 bg-slate-800 rounded-sm overflow-hidden">
                            <div
                              className="h-full bg-cyan-500 rounded-sm"
                              style={{ width: `${Math.min(100, r.rqdPercent)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-cyan-400 font-bold">{r.rqdPercent.toFixed(0)}%</span>
                        </div>

                        {/* Lithology Strip */}
                        <div className="col-span-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold block truncate ${
                            isOre
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {r.lithology}
                          </span>
                        </div>

                        {/* Au Grade */}
                        <div className="col-span-2">
                          <span className={`font-bold ${isOre ? 'text-amber-400 text-sm' : 'text-slate-400'}`}>
                            {isOre ? '11.75 g/t Au' : '0.85 g/t Au'}
                          </span>
                        </div>

                        {/* Point load */}
                        <div className="col-span-2 text-cyan-300 font-bold">
                          {r.pointLoadIs50Mpa} MPa
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Significant Intercepts Summary Card */}
              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/40 text-xs">
                <div className="flex items-center gap-2 text-amber-300 font-bold mb-1">
                  <Sparkles className="w-4 h-4" />
                  <span>SIGNIFICANT EXPLORATION DRILLHOLE INTERCEPT:</span>
                </div>
                <p className="text-slate-100 font-mono text-sm font-bold">
                  Hole {currentHole.holeId} intersected <strong className="text-amber-400">3.30m @ 11.75 g/t Au and 0.56% Cu</strong> from 6.20m to 9.50m downhole depth (Champion Quartz Ribbon Vein), including <strong className="text-amber-300">1.60m @ 14.85 g/t Au</strong> from 6.20m to 7.80m.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Storage Vault Modal */}
      <MiningDataStorageModal
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
      />
    </div>
  );
};
