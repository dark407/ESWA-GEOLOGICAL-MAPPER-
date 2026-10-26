import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Check,
  Download,
  Droplets,
  FileSpreadsheet,
  Layers,
  MapPin,
  Printer,
  RefreshCw,
  Save,
  Shield,
  ShieldAlert,
  Sparkles,
  Target,
  X,
  Plus,
  Trash2,
  Activity,
  Sliders,
  ChevronRight
} from 'lucide-react';

export interface ProbeIntervalLog {
  intervalId: string;
  fromDepthM: number;
  toDepthM: number;
  penetrationRateMinPerMeter: number; // min/m
  feedPressureBar: number;
  flushReturnPercent: number; // 0 to 100%
  rockCuttingsLithology: string;
  rqdForecastPercent: number;
  voidOrSoftPocketDetected: boolean;
  remarks: string;
}

export interface ProbeWaterIngressRecord {
  id: string;
  depthMeters: number;
  flowRateLpm: number;
  staticPressureBar: number;
  waterAppearance: 'Clear' | 'Milky' | 'Turbid / Silt' | 'Heavy Mud Slurry';
  temperatureC: number;
  actionRequired: 'Monitor' | 'Grout Curtain Ahead' | 'Drainage Hole Required' | 'Immediate Face Halt';
}

export interface ProbeHoleRecord {
  id: string;
  holeId: string;
  faceStationChainage: string; // e.g. Ch 14+320.00
  tunnelHeading: string; // e.g. Main Tunnel East Heading
  holePosition: 'Crown Center' | 'Crown Left Shoulder' | 'Crown Right Shoulder' | 'Invert Drainage' | 'Face Centerline';
  drillDate: string;
  shift: 'Day' | 'Night' | 'Swing';
  rigModel: string;
  bitDiameterMm: number;
  plannedLengthM: number;
  actualDrilledLengthM: number;
  dipDegrees: number; // e.g. +5° up
  azimuthDegrees: number; // e.g. 092°
  leadDriller: string;
  loggingGeologist: string;
  
  // Interval drilling data
  intervals: ProbeIntervalLog[];

  // Hydrogeological water intercepts
  waterIngressEvents: ProbeWaterIngressRecord[];

  // Ahead Hazard Evaluation
  hazardForecast: {
    faultZoneDistanceMeters: number | null;
    faultWidthMeters: number | null;
    highWaterBurstRisk: boolean;
    cavityOrKarstDetected: boolean;
    gasDetected: boolean;
    overallRiskLevel: 'LOW (Green)' | 'MEDIUM (Amber)' | 'HIGH (Red)' | 'CRITICAL (Emergency)';
    safeAdvanceClearanceMeters: number; // safe distance before mandatory next probe
    recommendations: string;
  };

  signOff: {
    superintendent: string;
    geologist: string;
    signOffDate: string;
    tarpActionStatus: 'Normal Advance' | 'Pre-Excavation Grouting' | 'Drainage Drill Required' | 'Halt & Review';
  };
}

const STORAGE_KEY = 'eswa_natm_probe_hole_records';

export function createDefaultProbeHole(): ProbeHoleRecord {
  return {
    id: `probe-${Date.now()}`,
    holeId: 'PH-CRW-14320',
    faceStationChainage: 'Ch 14+320.00 m',
    tunnelHeading: 'NATM High-Speed Rail Main Tunnel — North Heading',
    holePosition: 'Crown Center',
    drillDate: new Date().toISOString().split('T')[0],
    shift: 'Day',
    rigModel: 'Atlas Copco Boomer E2C Dual-Boom Jumbo',
    bitDiameterMm: 89,
    plannedLengthM: 24.0,
    actualDrilledLengthM: 24.0,
    dipDegrees: 4.5,
    azimuthDegrees: 88.0,
    leadDriller: 'Foreman Hans Gruber',
    loggingGeologist: 'Senior NATM Geologist',
    intervals: [
      {
        intervalId: 'int-1',
        fromDepthM: 0.0,
        toDepthM: 3.0,
        penetrationRateMinPerMeter: 3.2,
        feedPressureBar: 120,
        flushReturnPercent: 95,
        rockCuttingsLithology: 'Sound Biotite Gneiss chips (competent)',
        rqdForecastPercent: 75,
        voidOrSoftPocketDetected: false,
        remarks: 'Normal drilling resistance, clear return water',
      },
      {
        intervalId: 'int-2',
        fromDepthM: 3.0,
        toDepthM: 6.0,
        penetrationRateMinPerMeter: 3.0,
        feedPressureBar: 125,
        flushReturnPercent: 90,
        rockCuttingsLithology: 'Biotite Gneiss with Quartz veins',
        rqdForecastPercent: 78,
        voidOrSoftPocketDetected: false,
        remarks: 'Steady drilling advance',
      },
      {
        intervalId: 'int-3',
        fromDepthM: 6.0,
        toDepthM: 9.0,
        penetrationRateMinPerMeter: 2.8,
        feedPressureBar: 120,
        flushReturnPercent: 88,
        rockCuttingsLithology: 'Quartzitic Schist',
        rqdForecastPercent: 70,
        voidOrSoftPocketDetected: false,
        remarks: 'Minor drop in flush return',
      },
      {
        intervalId: 'int-4',
        fromDepthM: 9.0,
        toDepthM: 12.0,
        penetrationRateMinPerMeter: 1.4,
        feedPressureBar: 90,
        flushReturnPercent: 50,
        rockCuttingsLithology: 'Fractured Chlorite Schist & Clay Gouge',
        rqdForecastPercent: 32,
        voidOrSoftPocketDetected: true,
        remarks: 'Rapid rod penetration spike at 10.4m, water ingress noticed',
      },
      {
        intervalId: 'int-5',
        fromDepthM: 12.0,
        toDepthM: 15.0,
        penetrationRateMinPerMeter: 1.1,
        feedPressureBar: 80,
        flushReturnPercent: 30,
        rockCuttingsLithology: 'Severe Shear Gouge & Breccia',
        rqdForecastPercent: 20,
        voidOrSoftPocketDetected: true,
        remarks: 'Shear zone intersection between 10.4m and 13.8m. Heavy water rush.',
      },
      {
        intervalId: 'int-6',
        fromDepthM: 15.0,
        toDepthM: 18.0,
        penetrationRateMinPerMeter: 2.5,
        feedPressureBar: 110,
        flushReturnPercent: 70,
        rockCuttingsLithology: 'Gneiss transition with healed micro-shears',
        rqdForecastPercent: 55,
        voidOrSoftPocketDetected: false,
        remarks: 'Ground regaining competence beyond 16.5m',
      },
      {
        intervalId: 'int-7',
        fromDepthM: 18.0,
        toDepthM: 21.0,
        penetrationRateMinPerMeter: 3.4,
        feedPressureBar: 130,
        flushReturnPercent: 92,
        rockCuttingsLithology: 'Intact Granodiorite Gneiss',
        rqdForecastPercent: 82,
        voidOrSoftPocketDetected: false,
        remarks: 'Stable competent bedrock reached',
      },
      {
        intervalId: 'int-8',
        fromDepthM: 21.0,
        toDepthM: 24.0,
        penetrationRateMinPerMeter: 3.6,
        feedPressureBar: 135,
        flushReturnPercent: 95,
        rockCuttingsLithology: 'Intact Granodiorite Gneiss',
        rqdForecastPercent: 85,
        voidOrSoftPocketDetected: false,
        remarks: 'Target borehole end depth reached',
      },
    ],
    waterIngressEvents: [
      {
        id: 'wi-1',
        depthMeters: 10.8,
        flowRateLpm: 68,
        staticPressureBar: 3.5,
        waterAppearance: 'Turbid / Silt',
        temperatureC: 17.5,
        actionRequired: 'Grout Curtain Ahead',
      },
    ],
    hazardForecast: {
      faultZoneDistanceMeters: 10.4,
      faultWidthMeters: 3.4,
      highWaterBurstRisk: true,
      cavityOrKarstDetected: false,
      gasDetected: false,
      overallRiskLevel: 'HIGH (Red)',
      safeAdvanceClearanceMeters: 7.0,
      recommendations: 'Permitted safe excavation advance is capped at 7.0 meters. At Ch 14+327, install pre-excavation microfine cement grout umbrella (12 radial holes) before penetrating shear zone.',
    },
    signOff: {
      superintendent: 'Eng. Marco Rossi',
      geologist: 'Dr. Sarah Lindqvist, P.Geo',
      signOffDate: new Date().toISOString().split('T')[0],
      tarpActionStatus: 'Pre-Excavation Grouting',
    },
  };
}

interface ProbeHoleDrillingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProbeHoleDrillingModal: React.FC<ProbeHoleDrillingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeStep, setActiveStep] = useState<'setup' | 'intervals' | 'water' | 'hazards' | 'signoff'>('setup');
  const [record, setRecord] = useState<ProbeHoleRecord>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return createDefaultProbeHole();
  });

  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);

  const saveToStorage = (updated: ProbeHoleRecord) => {
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
    if (confirm('Load fresh realistic forward probe drilling dataset?')) {
      const fresh = createDefaultProbeHole();
      saveToStorage(fresh);
    }
  };

  // Add new interval run
  const handleAddInterval = () => {
    const last = record.intervals[record.intervals.length - 1];
    const from = last ? last.toDepthM : 0;
    const to = from + 3.0;
    const newInt: ProbeIntervalLog = {
      intervalId: `int-${Date.now()}`,
      fromDepthM: from,
      toDepthM: to,
      penetrationRateMinPerMeter: 3.0,
      feedPressureBar: 120,
      flushReturnPercent: 90,
      rockCuttingsLithology: 'Gneiss chips',
      rqdForecastPercent: 70,
      voidOrSoftPocketDetected: false,
      remarks: '',
    };
    saveToStorage({
      ...record,
      intervals: [...record.intervals, newInt],
      actualDrilledLengthM: to,
    });
  };

  // Add new water ingress event
  const handleAddWaterEvent = () => {
    const newEvent: ProbeWaterIngressRecord = {
      id: `wi-${Date.now()}`,
      depthMeters: 12.0,
      flowRateLpm: 25,
      staticPressureBar: 2.0,
      waterAppearance: 'Clear',
      temperatureC: 16.0,
      actionRequired: 'Monitor',
    };
    saveToStorage({
      ...record,
      waterIngressEvents: [...record.waterIngressEvents, newEvent],
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex flex-col w-screen h-[100dvh] overflow-hidden text-black font-sans">
      {/* Top Header */}
      <header className="h-14 px-4 bg-white border-b-2 border-stone-300 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black text-black bg-stone-100 hover:bg-stone-200 border-2 border-stone-400 transition-all cursor-pointer shadow-xs active:scale-95"
            title="Return to NATM Main Window"
          >
            <ArrowLeft className="w-4 h-4 text-amber-700" />
            <span className="font-extrabold text-black">NATM Window</span>
          </button>

          <div className="h-6 w-px bg-stone-300" />

          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-500 flex items-center justify-center text-amber-900 font-black">
              <Target className="w-4 h-4 text-amber-800" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-black tracking-tight leading-none">
                  Probe Hole Drilling &amp; Hazard Forecast
                </h1>
                <span className="px-2 py-0.5 rounded text-[11px] font-black bg-amber-100 text-black border border-amber-500 uppercase tracking-wider">
                  Forward Probing Ahead
                </span>
              </div>
              <p className="text-[11px] font-bold text-stone-600 hidden sm:block">
                Penetration rate logging • Ingress flow &amp; pressure • Forward hazard forecast
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
            title="Reset to default authentic probe hole dataset"
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
              activeStep === 'setup' ? 'bg-amber-400 text-black' : 'bg-stone-200 text-black'
            }`}>1</span>
            <span>Probe Rig &amp; Geometry</span>
          </button>

          <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />

          <button
            type="button"
            onClick={() => setActiveStep('intervals')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 border-2 cursor-pointer ${
              activeStep === 'intervals'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-black border-stone-300 hover:border-black'
            }`}
          >
            <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
              activeStep === 'intervals' ? 'bg-amber-400 text-black' : 'bg-stone-200 text-black'
            }`}>2</span>
            <span>Interval Drilling Log</span>
          </button>

          <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />

          <button
            type="button"
            onClick={() => setActiveStep('water')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 border-2 cursor-pointer ${
              activeStep === 'water'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-black border-stone-300 hover:border-black'
            }`}
          >
            <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
              activeStep === 'water' ? 'bg-amber-400 text-black' : 'bg-stone-200 text-black'
            }`}>3</span>
            <span>Water Ingress &amp; Seeps</span>
          </button>

          <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />

          <button
            type="button"
            onClick={() => setActiveStep('hazards')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 border-2 cursor-pointer ${
              activeStep === 'hazards'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-black border-stone-300 hover:border-black'
            }`}
          >
            <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
              activeStep === 'hazards' ? 'bg-amber-400 text-black' : 'bg-stone-200 text-black'
            }`}>4</span>
            <span>Forward Hazard Forecast</span>
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
              activeStep === 'signoff' ? 'bg-amber-400 text-black' : 'bg-stone-200 text-black'
            }`}>5</span>
            <span>TARP Dispatch &amp; Sign-Off</span>
          </button>
        </div>

        {/* Hazard Level Badge */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-xs font-extrabold text-stone-700">Ahead Status:</span>
          <span className={`px-2.5 py-0.5 rounded text-xs font-black border ${
            record.hazardForecast.overallRiskLevel.includes('Red')
              ? 'bg-red-100 text-red-950 border-red-500'
              : record.hazardForecast.overallRiskLevel.includes('Amber')
              ? 'bg-amber-100 text-amber-950 border-amber-500'
              : 'bg-emerald-100 text-emerald-950 border-emerald-500'
          }`}>
            {record.hazardForecast.overallRiskLevel}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 bg-stone-200/60 flex flex-col">
        {/* STEP 1: PROBE SETUP */}
        {activeStep === 'setup' && (
          <div className="max-w-4xl mx-auto w-full space-y-4">
            <div className="bg-white rounded-xl border-2 border-stone-300 shadow-sm p-5 space-y-4">
              <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-black">Step 1: Probe Hole Geometry &amp; Rig Configuration</h2>
                  <p className="text-xs font-bold text-stone-600">
                    Define face chainage station, probe orientation vector, drill rig model, and target penetration length.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-stone-100 text-black font-black text-xs border border-stone-300">
                  {record.faceStationChainage}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Probe Hole ID</label>
                  <input
                    type="text"
                    value={record.holeId}
                    onChange={(e) => saveToStorage({ ...record, holeId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Face Chainage Station</label>
                  <input
                    type="text"
                    value={record.faceStationChainage}
                    onChange={(e) => saveToStorage({ ...record, faceStationChainage: e.target.value })}
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
                  <label className="block text-xs font-black text-black uppercase mb-1">Hole Face Location</label>
                  <select
                    value={record.holePosition}
                    onChange={(e) => saveToStorage({ ...record, holePosition: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  >
                    <option value="Crown Center">Crown Center (Ahead Probing)</option>
                    <option value="Crown Left Shoulder">Crown Left Shoulder</option>
                    <option value="Crown Right Shoulder">Crown Right Shoulder</option>
                    <option value="Face Centerline">Face Centerline</option>
                    <option value="Invert Drainage">Invert Drainage</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Planned Probe Length (m)</label>
                  <input
                    type="number"
                    step="1"
                    value={record.plannedLengthM}
                    onChange={(e) => saveToStorage({ ...record, plannedLengthM: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Actual Drilled Length (m)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={record.actualDrilledLengthM}
                    onChange={(e) => saveToStorage({ ...record, actualDrilledLengthM: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Dip Inclination (°)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={record.dipDegrees}
                    onChange={(e) => saveToStorage({ ...record, dipDegrees: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Azimuth (°)</label>
                  <input
                    type="number"
                    step="1"
                    value={record.azimuthDegrees}
                    onChange={(e) => saveToStorage({ ...record, azimuthDegrees: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Drill Bit Diameter (mm)</label>
                  <input
                    type="number"
                    value={record.bitDiameterMm}
                    onChange={(e) => saveToStorage({ ...record, bitDiameterMm: parseInt(e.target.value) || 76 })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>
              </div>

              {/* Jumbo / Drilling Rig Info */}
              <div className="p-4 rounded-xl bg-stone-100 border-2 border-stone-300 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Drill Jumbo / Rig Model</label>
                  <input
                    type="text"
                    value={record.rigModel}
                    onChange={(e) => saveToStorage({ ...record, rigModel: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border-2 border-stone-300 text-black font-bold text-xs focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Lead Driller / Rig Operator</label>
                  <input
                    type="text"
                    value={record.leadDriller}
                    onChange={(e) => saveToStorage({ ...record, leadDriller: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white border-2 border-stone-300 text-black font-bold text-xs focus:border-black outline-hidden"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setActiveStep('intervals')}
                  className="px-4 py-2.5 rounded-lg bg-black text-white hover:bg-stone-800 font-black text-xs flex items-center gap-2 cursor-pointer transition-all shadow-sm active:scale-95"
                >
                  <span>Proceed to Interval Drilling Log</span>
                  <ArrowRight className="w-4 h-4 text-amber-400" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: INTERVAL DRILLING LOG */}
        {activeStep === 'intervals' && (
          <div className="max-w-6xl mx-auto w-full space-y-4">
            <div className="bg-white rounded-xl border-2 border-stone-300 shadow-sm p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-3">
                <div>
                  <h2 className="text-base font-black text-black flex items-center gap-2">
                    <span>Step 2: Discrete Drilling Interval Logs</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-black border border-amber-400 font-extrabold">
                      Total: {record.intervals.length} Runs ({record.actualDrilledLengthM}m)
                    </span>
                  </h2>
                  <p className="text-xs font-bold text-stone-600">
                    Track penetration rate (min/m), feed pressure, flush water loss %, rock cuttings lithology, and rod drop detection.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddInterval}
                  className="px-3 py-1.5 rounded-lg text-xs font-black bg-black text-white hover:bg-stone-800 flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Add 3m Interval</span>
                </button>
              </div>

              {/* Intervals Table */}
              <div className="border border-stone-300 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-900 text-white font-black uppercase text-[11px]">
                      <tr>
                        <th className="p-2.5">Interval</th>
                        <th className="p-2.5">Pen. Rate (min/m)</th>
                        <th className="p-2.5">Feed Press (bar)</th>
                        <th className="p-2.5">Flush Ret (%)</th>
                        <th className="p-2.5">RQD (%)</th>
                        <th className="p-2.5">Void / Rod Drop</th>
                        <th className="p-2.5">Rock Cuttings &amp; Remarks</th>
                        <th className="p-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 bg-white">
                      {record.intervals.map((int, idx) => (
                        <tr key={int.intervalId} className={`hover:bg-amber-50/50 ${int.voidOrSoftPocketDetected ? 'bg-red-50/60' : ''}`}>
                          <td className="p-2.5 font-black text-black whitespace-nowrap">
                            {int.fromDepthM.toFixed(1)}m - {int.toDepthM.toFixed(1)}m
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              step="0.1"
                              value={int.penetrationRateMinPerMeter}
                              onChange={(e) => {
                                const updated = [...record.intervals];
                                updated[idx].penetrationRateMinPerMeter = parseFloat(e.target.value) || 0;
                                saveToStorage({ ...record, intervals: updated });
                              }}
                              className="w-20 px-2 py-1 rounded bg-stone-50 border border-stone-300 font-mono font-bold text-xs focus:border-black outline-hidden"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              value={int.feedPressureBar}
                              onChange={(e) => {
                                const updated = [...record.intervals];
                                updated[idx].feedPressureBar = parseInt(e.target.value) || 0;
                                saveToStorage({ ...record, intervals: updated });
                              }}
                              className="w-20 px-2 py-1 rounded bg-stone-50 border border-stone-300 font-mono font-bold text-xs focus:border-black outline-hidden"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={int.flushReturnPercent}
                              onChange={(e) => {
                                const updated = [...record.intervals];
                                updated[idx].flushReturnPercent = parseInt(e.target.value) || 0;
                                saveToStorage({ ...record, intervals: updated });
                              }}
                              className={`w-16 px-2 py-1 rounded border font-mono font-bold text-xs focus:border-black outline-hidden ${
                                int.flushReturnPercent < 60 ? 'bg-red-100 text-red-900 border-red-400' : 'bg-stone-50 border-stone-300'
                              }`}
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={int.rqdForecastPercent}
                              onChange={(e) => {
                                const updated = [...record.intervals];
                                updated[idx].rqdForecastPercent = parseInt(e.target.value) || 0;
                                saveToStorage({ ...record, intervals: updated });
                              }}
                              className="w-16 px-2 py-1 rounded bg-stone-50 border border-stone-300 font-mono font-bold text-xs focus:border-black outline-hidden"
                            />
                          </td>
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={int.voidOrSoftPocketDetected}
                              onChange={(e) => {
                                const updated = [...record.intervals];
                                updated[idx].voidOrSoftPocketDetected = e.target.checked;
                                saveToStorage({ ...record, intervals: updated });
                              }}
                              className="w-4 h-4 accent-red-600 rounded"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={int.rockCuttingsLithology}
                              onChange={(e) => {
                                const updated = [...record.intervals];
                                updated[idx].rockCuttingsLithology = e.target.value;
                                saveToStorage({ ...record, intervals: updated });
                              }}
                              className="w-full px-2 py-1 rounded bg-stone-50 border border-stone-300 text-black font-bold text-xs focus:border-black outline-hidden"
                            />
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (record.intervals.length <= 1) return;
                                const filtered = record.intervals.filter((_, i) => i !== idx);
                                saveToStorage({ ...record, intervals: filtered });
                              }}
                              className="text-stone-400 hover:text-red-600 cursor-pointer p-1"
                              title="Delete interval"
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

              {/* Penetration Profile Visual Graph */}
              <div className="bg-stone-50 border-2 border-stone-300 rounded-xl p-4 space-y-2">
                <div className="text-xs font-black text-black uppercase">Penetration Rate Profile (min/m along borehole length)</div>
                <div className="h-16 flex items-end gap-1.5 pt-2 border-b-2 border-black">
                  {record.intervals.map((int, i) => {
                    const heightPercent = Math.min(100, Math.max(15, (int.penetrationRateMinPerMeter / 5.0) * 100));
                    const isSoft = int.penetrationRateMinPerMeter < 1.8;
                    return (
                      <div key={int.intervalId} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-t transition-all ${
                            isSoft ? 'bg-red-500' : 'bg-amber-500'
                          }`}
                        />
                        <span className="text-[9px] font-mono font-bold text-stone-600">
                          {int.toDepthM}m
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold text-stone-600">
                  <span>Face (0.0m)</span>
                  <span className="text-red-700 font-black">Low min/m = Soft fault / void penetration drop</span>
                  <span>End of Hole ({record.actualDrilledLengthM}m)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: WATER INGRESS LOG */}
        {activeStep === 'water' && (
          <div className="max-w-4xl mx-auto w-full space-y-4">
            <div className="bg-white rounded-xl border-2 border-stone-300 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <div>
                  <h2 className="text-base font-black text-black">Step 3: Hydrogeological Water Ingress &amp; Seepage Events</h2>
                  <p className="text-xs font-bold text-stone-600">
                    Log water inflow rate, static pressure, water turbidity, and pre-excavation grouting triggers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddWaterEvent}
                  className="px-3 py-1.5 rounded-lg text-xs font-black bg-cyan-700 hover:bg-cyan-800 text-white flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 text-cyan-200" />
                  <span>Log Water Event</span>
                </button>
              </div>

              {record.waterIngressEvents.length === 0 ? (
                <div className="p-8 text-center bg-stone-50 rounded-xl border-2 border-dashed border-stone-300">
                  <Droplets className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-stone-600">No significant water ingress logged in this probe hole.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {record.waterIngressEvents.map((ev, idx) => (
                    <div key={ev.id} className="p-4 rounded-xl border-2 border-cyan-300 bg-cyan-50/50 space-y-3">
                      <div className="flex items-center justify-between border-b border-cyan-200 pb-2">
                        <span className="text-xs font-black text-cyan-900 flex items-center gap-1.5">
                          <Droplets className="w-3.5 h-3.5 text-cyan-700" />
                          Ingress Event #{idx + 1} at Depth {ev.depthMeters}m
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const filtered = record.waterIngressEvents.filter((_, i) => i !== idx);
                            saveToStorage({ ...record, waterIngressEvents: filtered });
                          }}
                          className="text-stone-400 hover:text-red-600 cursor-pointer p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[11px] font-black text-black mb-1">Depth (m)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={ev.depthMeters}
                            onChange={(e) => {
                              const updated = [...record.waterIngressEvents];
                              updated[idx].depthMeters = parseFloat(e.target.value) || 0;
                              saveToStorage({ ...record, waterIngressEvents: updated });
                            }}
                            className="w-full px-2.5 py-1.5 rounded bg-white border border-stone-300 text-black font-mono font-bold text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-black text-black mb-1">Flow Rate (L/min)</label>
                          <input
                            type="number"
                            value={ev.flowRateLpm}
                            onChange={(e) => {
                              const updated = [...record.waterIngressEvents];
                              updated[idx].flowRateLpm = parseFloat(e.target.value) || 0;
                              saveToStorage({ ...record, waterIngressEvents: updated });
                            }}
                            className="w-full px-2.5 py-1.5 rounded bg-white border border-stone-300 text-black font-mono font-bold text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-black text-black mb-1">Pressure (bar)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={ev.staticPressureBar}
                            onChange={(e) => {
                              const updated = [...record.waterIngressEvents];
                              updated[idx].staticPressureBar = parseFloat(e.target.value) || 0;
                              saveToStorage({ ...record, waterIngressEvents: updated });
                            }}
                            className="w-full px-2.5 py-1.5 rounded bg-white border border-stone-300 text-black font-mono font-bold text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-black text-black mb-1">Appearance</label>
                          <select
                            value={ev.waterAppearance}
                            onChange={(e) => {
                              const updated = [...record.waterIngressEvents];
                              updated[idx].waterAppearance = e.target.value as any;
                              saveToStorage({ ...record, waterIngressEvents: updated });
                            }}
                            className="w-full px-2.5 py-1.5 rounded bg-white border border-stone-300 text-black font-bold text-xs"
                          >
                            <option value="Clear">Clear</option>
                            <option value="Milky">Milky</option>
                            <option value="Turbid / Silt">Turbid / Silt</option>
                            <option value="Heavy Mud Slurry">Heavy Mud Slurry</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-black text-black mb-1">Mandatory Engineering Action</label>
                        <select
                          value={ev.actionRequired}
                          onChange={(e) => {
                            const updated = [...record.waterIngressEvents];
                            updated[idx].actionRequired = e.target.value as any;
                            saveToStorage({ ...record, waterIngressEvents: updated });
                          }}
                          className="w-full px-2.5 py-1.5 rounded bg-white border-2 border-cyan-400 text-black font-black text-xs"
                        >
                          <option value="Monitor">Monitor (Normal face advance)</option>
                          <option value="Grout Curtain Ahead">Pre-Excavation Grout Curtain Ahead</option>
                          <option value="Drainage Hole Required">Dedicated Sub-Horizontal Drainage Hole</option>
                          <option value="Immediate Face Halt">Immediate Face Halt &amp; Evacuate</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: HAZARD FORECAST */}
        {activeStep === 'hazards' && (
          <div className="max-w-4xl mx-auto w-full space-y-4">
            <div className="bg-white rounded-xl border-2 border-stone-300 shadow-sm p-5 space-y-4">
              <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-black">Step 4: Ahead-of-Face Geological Hazard Assessment</h2>
                  <p className="text-xs font-bold text-stone-600">
                    Calculated forward hazard clearance and safe advance distance before mandatory overlapping probe hole.
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded text-xs font-black border ${
                  record.hazardForecast.overallRiskLevel.includes('Red')
                    ? 'bg-red-100 text-red-950 border-red-500'
                    : 'bg-emerald-100 text-emerald-950 border-emerald-500'
                }`}>
                  {record.hazardForecast.overallRiskLevel}
                </span>
              </div>

              {/* 2D Tunnel & Forward Probe Vector Schematic */}
              <div className="border-2 border-stone-300 rounded-xl p-3 bg-stone-900 shadow-inner">
                <div className="text-[11px] font-mono font-bold text-white mb-1">
                  LONGITUDINAL PROFILE AHEAD OF FACE (PROBE VECTOR &amp; HAZARD ENCOUNTER)
                </div>

                <svg viewBox="0 0 600 160" className="w-full h-auto bg-stone-950 rounded border border-stone-800">
                  {/* Excavated Tunnel Profile */}
                  <rect x="10" y="30" width="140" height="90" fill="#334155" stroke="#94A3B8" strokeWidth="2" />
                  <line x1="150" y1="30" x2="150" y2="120" stroke="#EF4444" strokeWidth="4" />
                  <text x="145" y="24" textAnchor="end" fill="#F87171" fontSize="10" fontWeight="900">TUNNEL FACE</text>

                  {/* Forward Probe Vector */}
                  <line x1="150" y1="45" x2="520" y2="25" stroke="#F59E0B" strokeWidth="3" strokeDasharray="5 3" />
                  <text x="320" y="20" fill="#FBBF24" fontSize="9" fontWeight="900">
                    PROBE HOLE (24m @ +4.5° DIP)
                  </text>

                  {/* Encountered Fault / Shear Zone Ahead */}
                  <polygon points="310,15 350,15 365,145 325,145" fill="#EF4444" fillOpacity="0.45" stroke="#EF4444" strokeWidth="2" />
                  <text x="340" y="85" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="900">
                    SHEAR ZONE (10.4m - 13.8m)
                  </text>

                  {/* Safe Advance Limit Barrier */}
                  <line x1="260" y1="15" x2="260" y2="145" stroke="#10B981" strokeWidth="2" strokeDasharray="3 3" />
                  <text x="255" y="140" textAnchor="end" fill="#34D399" fontSize="9" fontWeight="900">
                    SAFE ADVANCE LIMIT (7.0m)
                  </text>
                </svg>
              </div>

              {/* Hazard Parameter Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Fault Distance Ahead (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={record.hazardForecast.faultZoneDistanceMeters || ''}
                    onChange={(e) => {
                      saveToStorage({
                        ...record,
                        hazardForecast: {
                          ...record.hazardForecast,
                          faultZoneDistanceMeters: parseFloat(e.target.value) || null,
                        },
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Fault Width (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={record.hazardForecast.faultWidthMeters || ''}
                    onChange={(e) => {
                      saveToStorage({
                        ...record,
                        hazardForecast: {
                          ...record.hazardForecast,
                          faultWidthMeters: parseFloat(e.target.value) || null,
                        },
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Safe Advance Clearance (m)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={record.hazardForecast.safeAdvanceClearanceMeters}
                    onChange={(e) => {
                      saveToStorage({
                        ...record,
                        hazardForecast: {
                          ...record.hazardForecast,
                          safeAdvanceClearanceMeters: parseFloat(e.target.value) || 0,
                        },
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-emerald-50 border-2 border-emerald-500 text-black font-black text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="waterBurst"
                    checked={record.hazardForecast.highWaterBurstRisk}
                    onChange={(e) => {
                      saveToStorage({
                        ...record,
                        hazardForecast: {
                          ...record.hazardForecast,
                          highWaterBurstRisk: e.target.checked,
                        },
                      });
                    }}
                    className="w-4 h-4 accent-red-600 rounded"
                  />
                  <label htmlFor="waterBurst" className="text-xs font-black text-black cursor-pointer">
                    High Water Burst Potential Ahead
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="cavity"
                    checked={record.hazardForecast.cavityOrKarstDetected}
                    onChange={(e) => {
                      saveToStorage({
                        ...record,
                        hazardForecast: {
                          ...record.hazardForecast,
                          cavityOrKarstDetected: e.target.checked,
                        },
                      });
                    }}
                    className="w-4 h-4 accent-amber-600 rounded"
                  />
                  <label htmlFor="cavity" className="text-xs font-black text-black cursor-pointer">
                    Karst Cavity / Void Void Intercept
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="gas"
                    checked={record.hazardForecast.gasDetected}
                    onChange={(e) => {
                      saveToStorage({
                        ...record,
                        hazardForecast: {
                          ...record.hazardForecast,
                          gasDetected: e.target.checked,
                        },
                      });
                    }}
                    className="w-4 h-4 accent-purple-600 rounded"
                  />
                  <label htmlFor="gas" className="text-xs font-black text-black cursor-pointer">
                    Harmful Gas (CH4 / H2S) Alert
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-black uppercase mb-1">Geotechnical Advance Directives</label>
                <textarea
                  rows={2}
                  value={record.hazardForecast.recommendations}
                  onChange={(e) => {
                    saveToStorage({
                      ...record,
                      hazardForecast: {
                        ...record.hazardForecast,
                        recommendations: e.target.value,
                      },
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-xs focus:border-black outline-hidden"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: SIGNOFF & TARP DISPATCH */}
        {activeStep === 'signoff' && (
          <div className="max-w-4xl mx-auto w-full space-y-4">
            <div className="bg-white rounded-xl border-2 border-stone-300 shadow-sm p-5 space-y-4">
              <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-black">Step 5: Forward Probing Sign-Off &amp; Shift TARP Action</h2>
                  <p className="text-xs font-bold text-stone-600">
                    Issue shift geotechnical directives to tunnel excavation superintendent.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-black text-white font-black text-xs">
                  {record.holeId}
                </span>
              </div>

              {/* TARP Action Selector */}
              <div className="p-4 rounded-xl border-2 border-stone-300 bg-stone-50 space-y-3">
                <div className="text-xs font-black text-black uppercase">TARP Operational Response Trigger</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                  {(['Normal Advance', 'Pre-Excavation Grouting', 'Drainage Drill Required', 'Halt & Review'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => {
                        saveToStorage({
                          ...record,
                          signOff: { ...record.signOff, tarpActionStatus: status },
                        });
                      }}
                      className={`p-3 rounded-lg text-xs font-black border-2 cursor-pointer transition-all text-left ${
                        record.signOff.tarpActionStatus === status
                          ? status === 'Normal Advance'
                            ? 'bg-emerald-500 text-black border-black shadow-xs'
                            : status === 'Pre-Excavation Grouting'
                            ? 'bg-amber-400 text-black border-black shadow-xs'
                            : 'bg-red-500 text-white border-black shadow-xs'
                          : 'bg-white text-black border-stone-300 hover:border-black'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sign-Off Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Tunnel Superintendent</label>
                  <input
                    type="text"
                    value={record.signOff.superintendent}
                    onChange={(e) => {
                      saveToStorage({
                        ...record,
                        signOff: { ...record.signOff, superintendent: e.target.value },
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Logging Geotechnical Engineer</label>
                  <input
                    type="text"
                    value={record.signOff.geologist}
                    onChange={(e) => {
                      saveToStorage({
                        ...record,
                        signOff: { ...record.signOff, geologist: e.target.value },
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
                    dl.setAttribute('download', `${record.holeId}_Forward_Probe_Log.json`);
                    dl.click();
                  }}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-stone-900 hover:bg-black text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>Export JSON Dataset</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
                >
                  <Printer className="w-4 h-4 text-amber-200" />
                  <span>Print Shift Directives Sheet</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
