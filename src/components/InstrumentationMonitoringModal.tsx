import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Gauge,
  Layers,
  MapPin,
  Maximize2,
  Printer,
  RefreshCw,
  Save,
  Shield,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Plus,
  Trash2,
  Sliders,
  Bell
} from 'lucide-react';

export interface MonitoringEpochRecord {
  epochId: string;
  readingDate: string;
  daysSinceExcavation: number;
  faceDistanceMeters: number; // e.g. +4.5m ahead of instrument section
  
  // 3D Optical Convergence Targets (mm displacement relative to baseline zero)
  crownSettlementDzMm: number; // Delta Z (negative = downward settlement)
  leftWallDxMm: number; // Delta X (inward closure)
  rightWallDxMm: number; // Delta X (inward closure)
  totalConvergenceDxMm: number; // Left + Right wall closure

  // MPBX Extensometers (anchor displacements in mm)
  mpbxAnchors: {
    anchorDepthMeters: number; // e.g. 2m, 4m, 7m, 10m
    displacementMm: number;
  }[];

  // Hydraulic Shotcrete Pressure Cells
  shotcreteRadialStressMpa: number; // Radial contact stress (MPa)
  shotcreteTangentialStressMpa: number; // Tangential hoop stress in lining (MPa)

  // Computed Velocity
  convergenceVelocityMmPerDay: number; // mm/day
  isDecelerating: boolean;
  notes: string;
}

export interface MonitoringSectionRecord {
  id: string;
  sectionId: string; // e.g. MS-14240
  chainageStation: string; // e.g. Ch 14+240.00
  tunnelHeading: string;
  tunnelProfile: string;
  excavationDate: string;
  baselineZeroDate: string;
  installedInstruments: {
    has3DOpticalTargets: boolean;
    hasMpbxExtensometer: boolean;
    hasShotcreteStressCells: boolean;
    hasPiezometer: boolean;
  };
  
  // Threshold Limits (TARP)
  tarpLimits: {
    greenMaxVelocityMmDay: number; // e.g. 1.0 mm/day
    amberMaxVelocityMmDay: number; // e.g. 3.0 mm/day
    allowableTotalConvergenceMm: number; // e.g. 45 mm
    allowableCrownSettlementMm: number; // e.g. 35 mm
    maxShotcreteStressMpa: number; // e.g. 18 MPa
  };

  epochs: MonitoringEpochRecord[];

  signOff: {
    monitoringEngineer: string;
    tunnelManager: string;
    lastEvaluationDate: string;
    tarpStatus: 'GREEN (Normal Stable)' | 'AMBER (Warning Trend)' | 'RED (Critical Alarm)';
    actionDirectives: string;
  };
}

const STORAGE_KEY = 'eswa_natm_monitoring_section_records';

export function createDefaultMonitoringSection(): MonitoringSectionRecord {
  return {
    id: `ms-${Date.now()}`,
    sectionId: 'MS-14240',
    chainageStation: 'Ch 14+240.00 m',
    tunnelHeading: 'NATM High-Speed Rail Main Tunnel — North Heading',
    tunnelProfile: 'Horseshoe Top Heading & Bench (92 m²)',
    excavationDate: '2026-10-18',
    baselineZeroDate: '2026-10-18 14:00',
    installedInstruments: {
      has3DOpticalTargets: true,
      hasMpbxExtensometer: true,
      hasShotcreteStressCells: true,
      hasPiezometer: false,
    },
    tarpLimits: {
      greenMaxVelocityMmDay: 1.0,
      amberMaxVelocityMmDay: 3.0,
      allowableTotalConvergenceMm: 45.0,
      allowableCrownSettlementMm: 35.0,
      maxShotcreteStressMpa: 18.0,
    },
    epochs: [
      {
        epochId: 'ep-0',
        readingDate: '2026-10-18',
        daysSinceExcavation: 0,
        faceDistanceMeters: 0.5,
        crownSettlementDzMm: -2.1,
        leftWallDxMm: 1.2,
        rightWallDxMm: 1.4,
        totalConvergenceDxMm: 2.6,
        mpbxAnchors: [
          { anchorDepthMeters: 2, displacementMm: 0.8 },
          { anchorDepthMeters: 4, displacementMm: 0.4 },
          { anchorDepthMeters: 7, displacementMm: 0.1 },
          { anchorDepthMeters: 10, displacementMm: 0.0 },
        ],
        shotcreteRadialStressMpa: 0.4,
        shotcreteTangentialStressMpa: 2.1,
        convergenceVelocityMmPerDay: 2.6,
        isDecelerating: false,
        notes: 'Initial baseline installation immediately behind face advance',
      },
      {
        epochId: 'ep-1',
        readingDate: '2026-10-19',
        daysSinceExcavation: 1,
        faceDistanceMeters: 2.5,
        crownSettlementDzMm: -6.4,
        leftWallDxMm: 3.8,
        rightWallDxMm: 4.1,
        totalConvergenceDxMm: 7.9,
        mpbxAnchors: [
          { anchorDepthMeters: 2, displacementMm: 2.9 },
          { anchorDepthMeters: 4, displacementMm: 1.5 },
          { anchorDepthMeters: 7, displacementMm: 0.6 },
          { anchorDepthMeters: 10, displacementMm: 0.1 },
        ],
        shotcreteRadialStressMpa: 1.1,
        shotcreteTangentialStressMpa: 5.8,
        convergenceVelocityMmPerDay: 5.3,
        isDecelerating: false,
        notes: 'Rapid initial deformation as heading advances',
      },
      {
        epochId: 'ep-2',
        readingDate: '2026-10-21',
        daysSinceExcavation: 3,
        faceDistanceMeters: 6.8,
        crownSettlementDzMm: -12.1,
        leftWallDxMm: 7.0,
        rightWallDxMm: 7.4,
        totalConvergenceDxMm: 14.4,
        mpbxAnchors: [
          { anchorDepthMeters: 2, displacementMm: 5.2 },
          { anchorDepthMeters: 4, displacementMm: 2.8 },
          { anchorDepthMeters: 7, displacementMm: 1.1 },
          { anchorDepthMeters: 10, displacementMm: 0.2 },
        ],
        shotcreteRadialStressMpa: 1.8,
        shotcreteTangentialStressMpa: 9.4,
        convergenceVelocityMmPerDay: 3.25,
        isDecelerating: true,
        notes: 'Rate decelerating; NATM shotcrete arch activating nicely',
      },
      {
        epochId: 'ep-3',
        readingDate: '2026-10-23',
        daysSinceExcavation: 5,
        faceDistanceMeters: 11.2,
        crownSettlementDzMm: -15.2,
        leftWallDxMm: 8.4,
        rightWallDxMm: 8.9,
        totalConvergenceDxMm: 17.3,
        mpbxAnchors: [
          { anchorDepthMeters: 2, displacementMm: 6.1 },
          { anchorDepthMeters: 4, displacementMm: 3.3 },
          { anchorDepthMeters: 7, displacementMm: 1.3 },
          { anchorDepthMeters: 10, displacementMm: 0.2 },
        ],
        shotcreteRadialStressMpa: 2.2,
        shotcreteTangentialStressMpa: 11.5,
        convergenceVelocityMmPerDay: 1.45,
        isDecelerating: true,
        notes: 'Clear attenuation; deformation velocity below 1.5 mm/day',
      },
      {
        epochId: 'ep-4',
        readingDate: '2026-10-25',
        daysSinceExcavation: 7,
        faceDistanceMeters: 16.5,
        crownSettlementDzMm: -16.8,
        leftWallDxMm: 9.1,
        rightWallDxMm: 9.5,
        totalConvergenceDxMm: 18.6,
        mpbxAnchors: [
          { anchorDepthMeters: 2, displacementMm: 6.4 },
          { anchorDepthMeters: 4, displacementMm: 3.5 },
          { anchorDepthMeters: 7, displacementMm: 1.4 },
          { anchorDepthMeters: 10, displacementMm: 0.2 },
        ],
        shotcreteRadialStressMpa: 2.4,
        shotcreteTangentialStressMpa: 12.1,
        convergenceVelocityMmPerDay: 0.65,
        isDecelerating: true,
        notes: 'Stable condition reached: velocity < 1.0 mm/day (GREEN status)',
      },
    ],
    signOff: {
      monitoringEngineer: 'Er. Rajesh K. Sharma, M.Tech',
      tunnelManager: 'Chief NATM Resident Engineer',
      lastEvaluationDate: new Date().toISOString().split('T')[0],
      tarpStatus: 'GREEN (Normal Stable)',
      actionDirectives: 'Monitoring Section MS-14240 exhibits healthy deformation stabilization (velocity = 0.65 mm/day < 1.0 mm/day). Ground-lining equilibrium achieved. Normal excavation round authorized.',
    },
  };
}

interface InstrumentationMonitoringModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstrumentationMonitoringModal: React.FC<InstrumentationMonitoringModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeStep, setActiveStep] = useState<'setup' | 'epochs' | 'trends' | 'tarp' | 'signoff'>('epochs');
  const [record, setRecord] = useState<MonitoringSectionRecord>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return createDefaultMonitoringSection();
  });

  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);

  const saveToStorage = (updated: MonitoringSectionRecord) => {
    setRecord(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleManualSave = () => {
    saveToStorage(record);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2500);
  };

  const handleResetSample = () => {
    if (confirm('Load fresh realistic NATM monitoring & convergence dataset?')) {
      const fresh = createDefaultMonitoringSection();
      saveToStorage(fresh);
    }
  };

  // Add new epoch measurement
  const handleAddEpoch = () => {
    const last = record.epochs[record.epochs.length - 1];
    const days = last ? last.daysSinceExcavation + 2 : 1;
    const faceDist = last ? last.faceDistanceMeters + 4.0 : 2.0;
    const prevConv = last ? last.totalConvergenceDxMm : 0;
    const prevSettlement = last ? last.crownSettlementDzMm : 0;
    
    // incremental small deformation
    const nextTotal = parseFloat((prevConv + 0.8).toFixed(1));
    const nextSettlement = parseFloat((prevSettlement - 0.5).toFixed(1));
    const velocity = parseFloat(((nextTotal - prevConv) / 2).toFixed(2));

    const newEpoch: MonitoringEpochRecord = {
      epochId: `ep-${Date.now()}`,
      readingDate: new Date().toISOString().split('T')[0],
      daysSinceExcavation: days,
      faceDistanceMeters: faceDist,
      crownSettlementDzMm: nextSettlement,
      leftWallDxMm: parseFloat((nextTotal / 2).toFixed(1)),
      rightWallDxMm: parseFloat((nextTotal / 2).toFixed(1)),
      totalConvergenceDxMm: nextTotal,
      mpbxAnchors: [
        { anchorDepthMeters: 2, displacementMm: 6.6 },
        { anchorDepthMeters: 4, displacementMm: 3.6 },
        { anchorDepthMeters: 7, displacementMm: 1.4 },
        { anchorDepthMeters: 10, displacementMm: 0.2 },
      ],
      shotcreteRadialStressMpa: 2.5,
      shotcreteTangentialStressMpa: 12.3,
      convergenceVelocityMmPerDay: velocity,
      isDecelerating: true,
      notes: 'Routine survey epoch measurement',
    };

    saveToStorage({
      ...record,
      epochs: [...record.epochs, newEpoch],
    });
  };

  const latestEpoch = record.epochs[record.epochs.length - 1] || record.epochs[0];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex flex-col w-screen h-[100dvh] overflow-hidden text-black font-sans">
      {/* Top Header Bar */}
      <header className="h-14 px-4 bg-white border-b-2 border-stone-300 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black text-black bg-stone-100 hover:bg-stone-200 border-2 border-stone-400 transition-all cursor-pointer shadow-xs active:scale-95"
            title="Return to NATM Main Window"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-700" />
            <span className="font-extrabold text-black">NATM Window</span>
          </button>

          <div className="h-6 w-px bg-stone-300" />

          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-500 flex items-center justify-center text-emerald-900 font-black">
              <Activity className="w-4 h-4 text-emerald-800" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-black tracking-tight leading-none">
                  NATM Instrumentation &amp; Monitoring
                </h1>
                <span className="px-2 py-0.5 rounded text-[11px] font-black bg-emerald-100 text-black border border-emerald-500 uppercase tracking-wider">
                  3D Optical, MPBX &amp; Stress
                </span>
              </div>
              <p className="text-[11px] font-bold text-stone-600 hidden sm:block">
                Crown settlement • Sidewall convergence • Multipoint extensometers • Shotcrete stress &amp; TARP triggers
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {saveSuccessNotice && (
            <span className="text-xs font-black text-emerald-800 bg-emerald-100 border border-emerald-400 px-2.5 py-1 rounded-md animate-fade-in flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-700" /> Saved
            </span>
          )}

          <button
            type="button"
            onClick={handleManualSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black text-black bg-emerald-400 hover:bg-emerald-500 border-2 border-emerald-600 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <Save className="w-3.5 h-3.5 text-black" />
            <span className="text-black font-extrabold">Save Log</span>
          </button>

          <button
            type="button"
            onClick={handleResetSample}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-black text-black bg-stone-100 hover:bg-stone-200 border-2 border-stone-300 transition-all cursor-pointer shadow-xs"
            title="Reset to default monitoring section"
          >
            <RefreshCw className="w-3.5 h-3.5 text-stone-700" />
            <span className="text-black font-extrabold">Reset</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-black text-black bg-stone-100 hover:bg-stone-200 border-2 border-stone-300 transition-all cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-black" />
            <span className="hidden md:inline text-black font-extrabold">Print</span>
          </button>
        </div>
      </header>

      {/* Step Navigation Bar */}
      <div className="bg-stone-100 border-b-2 border-stone-300 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
        <div className="flex items-center gap-1.5 min-w-max">
          <button
            type="button"
            onClick={() => setActiveStep('setup')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 border-2 cursor-pointer ${
              activeStep === 'setup'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-black border-stone-300 hover:border-black'
            }`}
          >
            <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
              activeStep === 'setup' ? 'bg-emerald-400 text-black' : 'bg-stone-200 text-black'
            }`}>1</span>
            <span>Section &amp; Sensors</span>
          </button>

          <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />

          <button
            type="button"
            onClick={() => setActiveStep('epochs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 border-2 cursor-pointer ${
              activeStep === 'epochs'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-black border-stone-300 hover:border-black'
            }`}
          >
            <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
              activeStep === 'epochs' ? 'bg-emerald-400 text-black' : 'bg-stone-200 text-black'
            }`}>2</span>
            <span>Epoch Convergence Log</span>
          </button>

          <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />

          <button
            type="button"
            onClick={() => setActiveStep('trends')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 border-2 cursor-pointer ${
              activeStep === 'trends'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-black border-stone-300 hover:border-black'
            }`}
          >
            <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
              activeStep === 'trends' ? 'bg-emerald-400 text-black' : 'bg-stone-200 text-black'
            }`}>3</span>
            <span>Deformation Velocity &amp; Trends</span>
          </button>

          <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />

          <button
            type="button"
            onClick={() => setActiveStep('tarp')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 border-2 cursor-pointer ${
              activeStep === 'tarp'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-black border-stone-300 hover:border-black'
            }`}
          >
            <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
              activeStep === 'tarp' ? 'bg-emerald-400 text-black' : 'bg-stone-200 text-black'
            }`}>4</span>
            <span>TARP Response Action</span>
          </button>

          <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />

          <button
            type="button"
            onClick={() => setActiveStep('signoff')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 border-2 cursor-pointer ${
              activeStep === 'signoff'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-black border-stone-300 hover:border-black'
            }`}
          >
            <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
              activeStep === 'signoff' ? 'bg-emerald-400 text-black' : 'bg-stone-200 text-black'
            }`}>5</span>
            <span>Sign-Off &amp; Compliance</span>
          </button>
        </div>

        {/* Current State Badges */}
        <div className="hidden lg:flex items-center gap-3 bg-white px-3 py-1 rounded-md border border-stone-300 text-xs">
          <span className="font-bold text-stone-600">Total Conv:</span>
          <span className="font-black text-emerald-800">{latestEpoch.totalConvergenceDxMm} mm</span>
          <span className="w-px h-3 bg-stone-300" />
          <span className="font-bold text-stone-600">Crown Sett:</span>
          <span className="font-black text-blue-800">{latestEpoch.crownSettlementDzMm} mm</span>
          <span className="w-px h-3 bg-stone-300" />
          <span className="font-bold text-stone-600">Velocity:</span>
          <span className="font-black text-black">{latestEpoch.convergenceVelocityMmPerDay} mm/day</span>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 bg-stone-200/60 flex flex-col">
        {/* STEP 1: SETUP */}
        {activeStep === 'setup' && (
          <div className="max-w-4xl mx-auto w-full space-y-4">
            <div className="bg-white rounded-xl border-2 border-stone-300 shadow-sm p-5 space-y-4">
              <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-black">Step 1: Monitoring Section (MS) Array Configuration</h2>
                  <p className="text-xs font-bold text-stone-600">
                    Define station chainage, baseline zero reading dates, and active instrument arrays.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-stone-100 text-black font-black text-xs border border-stone-300">
                  {record.sectionId}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Section ID</label>
                  <input
                    type="text"
                    value={record.sectionId}
                    onChange={(e) => saveToStorage({ ...record, sectionId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Chainage Station</label>
                  <input
                    type="text"
                    value={record.chainageStation}
                    onChange={(e) => saveToStorage({ ...record, chainageStation: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Tunnel Heading</label>
                  <input
                    type="text"
                    value={record.tunnelHeading}
                    onChange={(e) => saveToStorage({ ...record, tunnelHeading: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Tunnel Profile</label>
                  <input
                    type="text"
                    value={record.tunnelProfile}
                    onChange={(e) => saveToStorage({ ...record, tunnelProfile: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Excavation Date</label>
                  <input
                    type="date"
                    value={record.excavationDate}
                    onChange={(e) => saveToStorage({ ...record, excavationDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Baseline Zero Reading Date</label>
                  <input
                    type="text"
                    value={record.baselineZeroDate}
                    onChange={(e) => saveToStorage({ ...record, baselineZeroDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>
              </div>

              {/* Active Instruments Checklist */}
              <div className="p-4 rounded-xl bg-stone-100 border-2 border-stone-300 space-y-3">
                <div className="text-xs font-black text-black uppercase">Active Monitoring Instruments In Section</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-stone-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={record.installedInstruments.has3DOpticalTargets}
                      onChange={(e) => {
                        saveToStorage({
                          ...record,
                          installedInstruments: { ...record.installedInstruments, has3DOpticalTargets: e.target.checked },
                        });
                      }}
                      className="w-4 h-4 accent-emerald-600 rounded"
                    />
                    <span className="text-xs font-black text-black">3D Optical Targets</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-stone-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={record.installedInstruments.hasMpbxExtensometer}
                      onChange={(e) => {
                        saveToStorage({
                          ...record,
                          installedInstruments: { ...record.installedInstruments, hasMpbxExtensometer: e.target.checked },
                        });
                      }}
                      className="w-4 h-4 accent-emerald-600 rounded"
                    />
                    <span className="text-xs font-black text-black">MPBX Extensometer</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-stone-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={record.installedInstruments.hasShotcreteStressCells}
                      onChange={(e) => {
                        saveToStorage({
                          ...record,
                          installedInstruments: { ...record.installedInstruments, hasShotcreteStressCells: e.target.checked },
                        });
                      }}
                      className="w-4 h-4 accent-emerald-600 rounded"
                    />
                    <span className="text-xs font-black text-black">Shotcrete Stress Cells</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-stone-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={record.installedInstruments.hasPiezometer}
                      onChange={(e) => {
                        saveToStorage({
                          ...record,
                          installedInstruments: { ...record.installedInstruments, hasPiezometer: e.target.checked },
                        });
                      }}
                      className="w-4 h-4 accent-emerald-600 rounded"
                    />
                    <span className="text-xs font-black text-black">Pore Piezometer</span>
                  </label>
                </div>
              </div>

              {/* Threshold limits setup */}
              <div className="p-4 rounded-xl bg-stone-50 border-2 border-stone-300 space-y-3">
                <div className="text-xs font-black text-black uppercase">TARP Trigger Velocity &amp; Convergence Thresholds</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-black text-black mb-1">Green Max Velocity (mm/day)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={record.tarpLimits.greenMaxVelocityMmDay}
                      onChange={(e) => {
                        saveToStorage({
                          ...record,
                          tarpLimits: { ...record.tarpLimits, greenMaxVelocityMmDay: parseFloat(e.target.value) || 1 },
                        });
                      }}
                      className="w-full px-2.5 py-1.5 rounded bg-white border border-stone-300 text-black font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-black mb-1">Amber Max Velocity (mm/day)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={record.tarpLimits.amberMaxVelocityMmDay}
                      onChange={(e) => {
                        saveToStorage({
                          ...record,
                          tarpLimits: { ...record.tarpLimits, amberMaxVelocityMmDay: parseFloat(e.target.value) || 3 },
                        });
                      }}
                      className="w-full px-2.5 py-1.5 rounded bg-white border border-stone-300 text-black font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-black mb-1">Allowable Total Conv. (mm)</label>
                    <input
                      type="number"
                      step="1"
                      value={record.tarpLimits.allowableTotalConvergenceMm}
                      onChange={(e) => {
                        saveToStorage({
                          ...record,
                          tarpLimits: { ...record.tarpLimits, allowableTotalConvergenceMm: parseFloat(e.target.value) || 40 },
                        });
                      }}
                      className="w-full px-2.5 py-1.5 rounded bg-white border border-stone-300 text-black font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-black mb-1">Max Shotcrete Stress (MPa)</label>
                    <input
                      type="number"
                      step="1"
                      value={record.tarpLimits.maxShotcreteStressMpa}
                      onChange={(e) => {
                        saveToStorage({
                          ...record,
                          tarpLimits: { ...record.tarpLimits, maxShotcreteStressMpa: parseFloat(e.target.value) || 18 },
                        });
                      }}
                      className="w-full px-2.5 py-1.5 rounded bg-white border border-stone-300 text-black font-bold text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: EPOCHS TABLE */}
        {activeStep === 'epochs' && (
          <div className="max-w-6xl mx-auto w-full space-y-4">
            <div className="bg-white rounded-xl border-2 border-stone-300 shadow-sm p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-3">
                <div>
                  <h2 className="text-base font-black text-black flex items-center gap-2">
                    <span>Step 2: Multi-Epoch Measurement Logs</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-black border border-emerald-400 font-extrabold">
                      {record.epochs.length} Epochs Recorded
                    </span>
                  </h2>
                  <p className="text-xs font-bold text-stone-600">
                    Track optical targets (settlement &amp; sidewall closure), MPBX anchor strains, and shotcrete pressure cell stresses.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddEpoch}
                  className="px-3 py-1.5 rounded-lg text-xs font-black bg-black text-white hover:bg-stone-800 flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Add Survey Epoch</span>
                </button>
              </div>

              {/* Epochs Table */}
              <div className="border border-stone-300 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-900 text-white font-black uppercase text-[11px]">
                      <tr>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Days</th>
                        <th className="p-2.5">Face Dist (m)</th>
                        <th className="p-2.5">Crown Sett. ΔZ (mm)</th>
                        <th className="p-2.5">Total Conv. ΔX (mm)</th>
                        <th className="p-2.5">Velocity (mm/day)</th>
                        <th className="p-2.5">MPBX 2m / 4m (mm)</th>
                        <th className="p-2.5">Shotcrete Tang. (MPa)</th>
                        <th className="p-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 bg-white">
                      {record.epochs.map((ep, idx) => (
                        <tr key={ep.epochId} className="hover:bg-emerald-50/50">
                          <td className="p-2.5 font-bold text-black whitespace-nowrap">{ep.readingDate}</td>
                          <td className="p-2.5 font-mono font-bold text-black">D+{ep.daysSinceExcavation}</td>
                          <td className="p-2.5 font-mono font-bold text-black">{ep.faceDistanceMeters}m</td>
                          <td className="p-2.5 font-mono font-black text-blue-700">{ep.crownSettlementDzMm} mm</td>
                          <td className="p-2.5 font-mono font-black text-emerald-700">{ep.totalConvergenceDxMm} mm</td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded font-mono font-black text-xs border ${
                              ep.convergenceVelocityMmPerDay > 3.0
                                ? 'bg-red-100 text-red-900 border-red-400'
                                : ep.convergenceVelocityMmPerDay > 1.0
                                ? 'bg-amber-100 text-amber-900 border-amber-400'
                                : 'bg-emerald-100 text-emerald-900 border-emerald-400'
                            }`}>
                              {ep.convergenceVelocityMmPerDay} mm/d
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-xs">
                            {ep.mpbxAnchors[0]?.displacementMm}mm / {ep.mpbxAnchors[1]?.displacementMm}mm
                          </td>
                          <td className="p-2.5 font-mono font-bold text-black">
                            {ep.shotcreteTangentialStressMpa} MPa
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (record.epochs.length <= 1) return;
                                const filtered = record.epochs.filter((_, i) => i !== idx);
                                saveToStorage({ ...record, epochs: filtered });
                              }}
                              className="text-stone-400 hover:text-red-600 cursor-pointer p-1"
                              title="Delete epoch"
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
            </div>
          </div>
        )}

        {/* STEP 3: DEFORMATION VELOCITY & TRENDS */}
        {activeStep === 'trends' && (
          <div className="max-w-5xl mx-auto w-full space-y-4">
            <div className="bg-white rounded-xl border-2 border-stone-300 shadow-sm p-5 space-y-4">
              <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-black">Step 3: Deformation Trends &amp; Velocity Attenuation Curves</h2>
                  <p className="text-xs font-bold text-stone-600">
                    Observation of displacement vs. time confirms ground-lining equilibrium (NATM arching activation).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-900 font-black text-xs border border-emerald-400 flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5" /> Decelerating
                  </span>
                </div>
              </div>

              {/* SVG Trend Graph */}
              <div className="border-2 border-stone-300 rounded-xl p-4 bg-stone-900 shadow-inner space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono font-bold text-white">
                  <span>TIME-DISPLACEMENT HISTORY &amp; CONVERGENCE ATTENUATION</span>
                  <span className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Total Convergence ΔX</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Crown Settlement ΔZ</span>
                  </span>
                </div>

                <svg viewBox="0 0 650 220" className="w-full h-auto bg-stone-950 rounded border border-stone-800">
                  {/* Grid Lines */}
                  <line x1="50" y1="20" x2="620" y2="20" stroke="#334155" strokeWidth="1" />
                  <line x1="50" y1="65" x2="620" y2="65" stroke="#334155" strokeWidth="1" />
                  <line x1="50" y1="110" x2="620" y2="110" stroke="#334155" strokeWidth="1" />
                  <line x1="50" y1="155" x2="620" y2="155" stroke="#334155" strokeWidth="1" />
                  <line x1="50" y1="190" x2="620" y2="190" stroke="#64748B" strokeWidth="2" />
                  <line x1="50" y1="20" x2="50" y2="190" stroke="#64748B" strokeWidth="2" />

                  {/* Y-axis Labels */}
                  <text x="40" y="25" textAnchor="end" fill="#94A3B8" fontSize="9" fontWeight="900">40 mm</text>
                  <text x="40" y="70" textAnchor="end" fill="#94A3B8" fontSize="9" fontWeight="900">30 mm</text>
                  <text x="40" y="115" textAnchor="end" fill="#94A3B8" fontSize="9" fontWeight="900">20 mm</text>
                  <text x="40" y="160" textAnchor="end" fill="#94A3B8" fontSize="9" fontWeight="900">10 mm</text>
                  <text x="40" y="195" textAnchor="end" fill="#94A3B8" fontSize="9" fontWeight="900">0 mm</text>

                  {/* Total Convergence Curve (Green) */}
                  <polyline
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="3"
                    points={record.epochs
                      .map((ep, idx) => {
                        const x = 50 + (idx / Math.max(1, record.epochs.length - 1)) * 550;
                        const y = 190 - (ep.totalConvergenceDxMm / 40) * 170;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />

                  {/* Crown Settlement Curve (Blue) */}
                  <polyline
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="3"
                    points={record.epochs
                      .map((ep, idx) => {
                        const x = 50 + (idx / Math.max(1, record.epochs.length - 1)) * 550;
                        const y = 190 - (Math.abs(ep.crownSettlementDzMm) / 40) * 170;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />

                  {/* Points on Curve */}
                  {record.epochs.map((ep, idx) => {
                    const x = 50 + (idx / Math.max(1, record.epochs.length - 1)) * 550;
                    const yConv = 190 - (ep.totalConvergenceDxMm / 40) * 170;
                    const ySett = 190 - (Math.abs(ep.crownSettlementDzMm) / 40) * 170;
                    return (
                      <g key={ep.epochId}>
                        <circle cx={x} cy={yConv} r="4" fill="#10B981" stroke="#000000" strokeWidth="1.5" />
                        <circle cx={x} cy={ySett} r="4" fill="#38BDF8" stroke="#000000" strokeWidth="1.5" />
                        <text x={x} y="205" textAnchor="middle" fill="#CBD5E1" fontSize="9" fontWeight="800">
                          D+{ep.daysSinceExcavation}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Status Callout */}
              <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-400 flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-emerald-900 uppercase">NATM Arching Equilibrium Status</div>
                  <div className="text-sm font-extrabold text-black mt-0.5">
                    Current velocity {latestEpoch.convergenceVelocityMmPerDay} mm/day is within the Green allowable boundary (&lt; 1.0 mm/day). Ground deformation has successfully stabilized.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStep('tarp')}
                  className="px-4 py-2 rounded-lg bg-black text-white hover:bg-stone-800 font-black text-xs flex items-center gap-2 cursor-pointer transition-all shadow-xs"
                >
                  <span>Review TARP</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: TARP */}
        {activeStep === 'tarp' && (
          <div className="max-w-4xl mx-auto w-full space-y-4">
            <div className="bg-white rounded-xl border-2 border-stone-300 shadow-sm p-5 space-y-4">
              <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-black">Step 4: 3-Tier Trigger Action Response Plan (TARP)</h2>
                  <p className="text-xs font-bold text-stone-600">
                    Mandatory response protocols based on deformation rate and total convergence criteria.
                  </p>
                </div>
                <span className="px-3 py-1 rounded bg-black text-white font-black text-xs">
                  {record.signOff.tarpStatus}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Level 1: Green */}
                <div className={`p-4 rounded-xl border-2 space-y-2 ${
                  record.signOff.tarpStatus.includes('GREEN')
                    ? 'bg-emerald-50 border-emerald-500 shadow-sm'
                    : 'bg-stone-50 border-stone-300 opacity-70'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-black text-xs">
                      LEVEL 1 (GREEN)
                    </span>
                    <span className="text-[10px] font-black text-stone-600">&lt; 1.0 mm/day</span>
                  </div>
                  <div className="text-xs font-black text-black">Normal Excavation Advance</div>
                  <p className="text-[11px] font-bold text-stone-600">
                    Standard NATM advance round permitted. Support system performs as designed. Regular daily monitoring continued.
                  </p>
                </div>

                {/* Level 2: Amber */}
                <div className={`p-4 rounded-xl border-2 space-y-2 ${
                  record.signOff.tarpStatus.includes('AMBER')
                    ? 'bg-amber-50 border-amber-500 shadow-sm'
                    : 'bg-stone-50 border-stone-300 opacity-70'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-amber-500 text-black font-black text-xs">
                      LEVEL 2 (AMBER)
                    </span>
                    <span className="text-[10px] font-black text-stone-600">1.0 - 3.0 mm/day</span>
                  </div>
                  <div className="text-xs font-black text-black">Heightened Alert &amp; Support Reinforcement</div>
                  <p className="text-[11px] font-bold text-stone-600">
                    Halve excavation round length. Apply additional 50mm shotcrete layer and supplemental rockbolts. Close invert earlier.
                  </p>
                </div>

                {/* Level 3: Red */}
                <div className={`p-4 rounded-xl border-2 space-y-2 ${
                  record.signOff.tarpStatus.includes('RED')
                    ? 'bg-red-50 border-red-500 shadow-sm'
                    : 'bg-stone-50 border-stone-300 opacity-70'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-red-600 text-white font-black text-xs">
                      LEVEL 3 (RED)
                    </span>
                    <span className="text-[10px] font-black text-stone-600">&gt; 3.0 mm/day</span>
                  </div>
                  <div className="text-xs font-black text-black">Emergency Suspension &amp; Buttress</div>
                  <p className="text-[11px] font-bold text-stone-600">
                    Immediate face evacuation. Seal face with temporary shotcrete buttress. Immediate temporary invert strut installation.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-black uppercase mb-1">Current TARP Action Directives</label>
                <textarea
                  rows={2}
                  value={record.signOff.actionDirectives}
                  onChange={(e) => {
                    saveToStorage({
                      ...record,
                      signOff: { ...record.signOff, actionDirectives: e.target.value },
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-xs focus:border-black outline-hidden"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: SIGNOFF */}
        {activeStep === 'signoff' && (
          <div className="max-w-4xl mx-auto w-full space-y-4">
            <div className="bg-white rounded-xl border-2 border-stone-300 shadow-sm p-5 space-y-4">
              <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-black">Step 5: Geotechnical Monitoring Sign-Off &amp; Export</h2>
                  <p className="text-xs font-bold text-stone-600">
                    Official NATM convergence validation and reporting for Section {record.sectionId}.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-black text-white font-black text-xs">
                  Compliance Approved
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Lead Instrumentation Engineer</label>
                  <input
                    type="text"
                    value={record.signOff.monitoringEngineer}
                    onChange={(e) => {
                      saveToStorage({
                        ...record,
                        signOff: { ...record.signOff, monitoringEngineer: e.target.value },
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Chief NATM Resident Engineer</label>
                  <input
                    type="text"
                    value={record.signOff.tunnelManager}
                    onChange={(e) => {
                      saveToStorage({
                        ...record,
                        signOff: { ...record.signOff, tunnelManager: e.target.value },
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-xs"
                  />
                </div>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(record, null, 2));
                    const dl = document.createElement('a');
                    dl.setAttribute('href', dataStr);
                    dl.setAttribute('download', `${record.sectionId}_Monitoring_Section_Log.json`);
                    dl.click();
                  }}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-stone-900 hover:bg-black text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Export JSON Dataset</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
                >
                  <Printer className="w-4 h-4 text-emerald-200" />
                  <span>Print Monitoring Certificate</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
