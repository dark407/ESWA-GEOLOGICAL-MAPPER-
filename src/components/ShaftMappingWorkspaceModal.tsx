import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Download,
  FileSpreadsheet,
  Layers,
  MapPin,
  PenTool,
  Printer,
  RefreshCw,
  Save,
  Shield,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
  Plus,
  Eye,
  Sliders,
  AlertTriangle,
  Info
} from 'lucide-react';

export interface ShaftMappingRecord {
  id: string;
  shaftId: string;
  projectName: string;
  collarElevation: number; // m a.s.l.
  shaftDiameter: number; // m
  benchTopDepth: number; // m from collar
  benchBottomDepth: number; // m from collar
  advanceLength: number; // m
  excavationDate: string;
  shift: 'Day' | 'Night' | 'Swing';
  geologist: string;
  tunnelEngineer: string;
  
  // 360 Cylindrical Perimeter Data (Quadrant 0°-90° N-E, 90°-180° E-S, 180°-270° S-W, 270°-360° W-N)
  perimeterSectors: {
    sector: 'North-East (0°-90°)' | 'East-South (90°-180°)' | 'South-West (180°-270°)' | 'West-North (270°-360°)';
    azimuthRange: string;
    primaryLithology: string;
    weatheringGrade: string;
    jointSpacingCm: number;
    waterInflowLpm: number;
    overbreakCm: number;
    shearZones: string;
  }[];

  // Shaft Bottom Floor Data
  floorMapping: {
    rockType: string;
    rqdPercent: number;
    gsiEstimate: number;
    jointSets: {
      id: string;
      dipDirectionDeg: number;
      dipDeg: number;
      spacingMeters: number;
      roughness: string;
      apertureMm: number;
      infilling: string;
    }[];
    waterPooling: 'Dry' | 'Damp' | 'Seeping (<10 L/min)' | 'Heavy Ingress (>50 L/min)';
    heaveObserved: boolean;
    floorRemarks: string;
  };

  // NATM Shaft Support System
  supportSystem: {
    supportClass: 'Shaft-I (Stable)' | 'Shaft-II (Medium)' | 'Shaft-III (Heavy)' | 'Shaft-IV (Severe Shear/Fault)';
    ringBeamProfile: 'None' | '3-Bar Lattice Girder' | '4-Bar Heavy Girder' | 'HEB 160 Steel Rib';
    ringBeamSpacingMeters: number;
    shotcreteThicknessMm: number;
    shotcreteFiberType: 'Steel Fiber' | 'Synthetic Macro-fiber' | 'Dual Mesh Reinforced';
    rockboltsPerRing: number;
    boltLengthMeters: number;
    boltType: 'Fully Grouted Rebar' | 'Self-Drilling Hollow Bar (IBO)' | 'Swellex Friction Bolt';
    forepolingSpiles: boolean;
    forepolingDetails?: string;
  };

  // Classification & Sign-Off
  qSystemRating: number;
  rmrRating: number;
  signOff: {
    geologistSignature?: string;
    engineerSignature?: string;
    approvedDate?: string;
    notes?: string;
  };
}

const STORAGE_KEY = 'eswa_natm_shaft_mapping_records';

export function createDefaultShaftRecord(): ShaftMappingRecord {
  return {
    id: `shaft-${Date.now()}`,
    shaftId: 'SH-01 Vent & Access Shaft',
    projectName: 'NATM Hydro & Transport Tunnel Project',
    collarElevation: 485.5,
    shaftDiameter: 8.5,
    benchTopDepth: 42.0,
    benchBottomDepth: 45.2,
    advanceLength: 3.2,
    excavationDate: new Date().toISOString().split('T')[0],
    shift: 'Day',
    geologist: 'Site Tunnel Geologist',
    tunnelEngineer: 'NATM Resident Engineer',
    perimeterSectors: [
      {
        sector: 'North-East (0°-90°)',
        azimuthRange: '000° - 090°',
        primaryLithology: 'Granodiorite Gneiss',
        weatheringGrade: 'W2 (Slightly Weathered)',
        jointSpacingCm: 35,
        waterInflowLpm: 4,
        overbreakCm: 8,
        shearZones: 'Sub-vertical continuous joint set J1 (045°/78°SE)',
      },
      {
        sector: 'East-South (90°-180°)',
        azimuthRange: '090° - 180°',
        primaryLithology: 'Biotite Schist Band',
        weatheringGrade: 'W3 (Moderately Weathered)',
        jointSpacingCm: 18,
        waterInflowLpm: 12,
        overbreakCm: 15,
        shearZones: 'Chlorite slickensides on foliation planes, minor ravelling',
      },
      {
        sector: 'South-West (180°-270°)',
        azimuthRange: '180° - 270°',
        primaryLithology: 'Granodiorite Gneiss',
        weatheringGrade: 'W2 (Slightly Weathered)',
        jointSpacingCm: 45,
        waterInflowLpm: 2,
        overbreakCm: 6,
        shearZones: 'Tight calcite-healed joints, sound rock boundary',
      },
      {
        sector: 'West-North (270°-360°)',
        azimuthRange: '270° - 360°',
        primaryLithology: 'Pegmatite Intrusion & Gneiss',
        weatheringGrade: 'W1 (Fresh Rock)',
        jointSpacingCm: 60,
        waterInflowLpm: 1,
        overbreakCm: 5,
        shearZones: 'No significant shears, Blocky intact rock mass',
      },
    ],
    floorMapping: {
      rockType: 'Competent Granodiorite Gneiss with Schist Intercalations',
      rqdPercent: 68,
      gsiEstimate: 58,
      jointSets: [
        { id: 'J1', dipDirectionDeg: 135, dipDeg: 78, spacingMeters: 0.45, roughness: 'Rough Undulating', apertureMm: 1.2, infilling: 'Stained / Quartz' },
        { id: 'J2', dipDirectionDeg: 220, dipDeg: 55, spacingMeters: 0.80, roughness: 'Smooth Planar', apertureMm: 0.5, infilling: 'Chlorite film' },
        { id: 'J3', dipDirectionDeg: 10, dipDeg: 82, spacingMeters: 1.20, roughness: 'Stepped Rough', apertureMm: 0.2, infilling: 'Clean tight' },
      ],
      waterPooling: 'Seeping (<10 L/min)',
      heaveObserved: false,
      floorRemarks: 'Shaft bottom sound, ready for perimeter dowel anchors and next round pre-split drilling.',
    },
    supportSystem: {
      supportClass: 'Shaft-II (Medium)',
      ringBeamProfile: '3-Bar Lattice Girder',
      ringBeamSpacingMeters: 1.0,
      shotcreteThicknessMm: 150,
      shotcreteFiberType: 'Steel Fiber',
      rockboltsPerRing: 12,
      boltLengthMeters: 3.5,
      boltType: 'Fully Grouted Rebar',
      forepolingSpiles: false,
    },
    qSystemRating: 5.8,
    rmrRating: 54,
    signOff: {
      notes: 'NATM Shaft Bench 42.0m - 45.2m logged and verified against design support class S-II.',
      approvedDate: new Date().toISOString().split('T')[0],
    },
  };
}

interface ShaftMappingWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShaftMappingWorkspaceModal: React.FC<ShaftMappingWorkspaceModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'bench' | 'perimeter' | 'floor' | 'support' | 'summary'>('bench');
  const [record, setRecord] = useState<ShaftMappingRecord>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return createDefaultShaftRecord();
  });

  const [selectedSectorIdx, setSelectedSectorIdx] = useState<number>(0);
  const [activeFloorJoint, setActiveFloorJoint] = useState<string>('J1');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);

  // Auto-persist changes
  const saveToStorage = (updated: ShaftMappingRecord) => {
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
    if (confirm('Load fresh authentic NATM Shaft Face Mapping dataset?')) {
      const fresh = createDefaultShaftRecord();
      saveToStorage(fresh);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex flex-col w-screen h-[100dvh] overflow-hidden text-black font-sans">
      {/* Top Header Bar */}
      <header className="h-14 px-4 bg-white border-b-2 border-stone-300 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black text-black bg-stone-100 hover:bg-stone-200 border-2 border-stone-400 transition-all cursor-pointer shadow-xs active:scale-95"
            title="Return to NATM Main Window"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-700" />
            <span className="font-extrabold text-black">NATM Window</span>
          </button>

          <div className="h-6 w-px bg-stone-300" />

          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-cyan-100 border border-cyan-400 flex items-center justify-center text-cyan-900 font-black">
              <Compass className="w-4 h-4 text-cyan-800" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-black tracking-tight leading-none">
                  NATM Shaft Face Mapping
                </h1>
                <span className="px-2 py-0.5 rounded text-[11px] font-black bg-cyan-100 text-black border border-cyan-500 uppercase tracking-wider">
                  360° Unwrapped &amp; Bench Floor
                </span>
              </div>
              <p className="text-[11px] font-bold text-stone-600 hidden sm:block">
                Cylindrical perimeter wall unfolding • Deep excavation benches • NATM ring beam lining
              </p>
            </div>
          </div>
        </div>

        {/* Right Action Buttons */}
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
            title="Reset to default example shaft log"
          >
            <RefreshCw className="w-3.5 h-3.5 text-stone-700" />
            <span className="text-black font-extrabold">Reset</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-black text-black bg-stone-100 hover:bg-stone-200 border-2 border-stone-300 transition-all cursor-pointer shadow-xs"
            title="Print Shaft Face Mapping Sheet"
          >
            <Printer className="w-3.5 h-3.5 text-black" />
            <span className="hidden md:inline text-black font-extrabold">Print</span>
          </button>
        </div>
      </header>

      {/* Sequential Steps Navigation Bar */}
      <div className="bg-stone-100 border-b-2 border-stone-300 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
        <div className="flex items-center gap-1.5 min-w-max">
          <button
            type="button"
            onClick={() => setActiveTab('bench')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 border-2 cursor-pointer ${
              activeTab === 'bench'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-black border-stone-300 hover:border-black'
            }`}
          >
            <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
              activeTab === 'bench' ? 'bg-cyan-400 text-black' : 'bg-stone-200 text-black'
            }`}>1</span>
            <span>Shaft &amp; Bench Setup</span>
          </button>

          <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />

          <button
            type="button"
            onClick={() => setActiveTab('perimeter')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 border-2 cursor-pointer ${
              activeTab === 'perimeter'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-black border-stone-300 hover:border-black'
            }`}
          >
            <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
              activeTab === 'perimeter' ? 'bg-cyan-400 text-black' : 'bg-stone-200 text-black'
            }`}>2</span>
            <span>360° Unwrapped Perimeter</span>
          </button>

          <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />

          <button
            type="button"
            onClick={() => setActiveTab('floor')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 border-2 cursor-pointer ${
              activeTab === 'floor'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-black border-stone-300 hover:border-black'
            }`}
          >
            <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
              activeTab === 'floor' ? 'bg-cyan-400 text-black' : 'bg-stone-200 text-black'
            }`}>3</span>
            <span>Shaft Bottom Floor</span>
          </button>

          <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />

          <button
            type="button"
            onClick={() => setActiveTab('support')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 border-2 cursor-pointer ${
              activeTab === 'support'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-black border-stone-300 hover:border-black'
            }`}
          >
            <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
              activeTab === 'support' ? 'bg-cyan-400 text-black' : 'bg-stone-200 text-black'
            }`}>4</span>
            <span>NATM Shaft Support</span>
          </button>

          <ArrowRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />

          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 border-2 cursor-pointer ${
              activeTab === 'summary'
                ? 'bg-black text-white border-black shadow-xs'
                : 'bg-white text-black border-stone-300 hover:border-black'
            }`}
          >
            <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${
              activeTab === 'summary' ? 'bg-cyan-400 text-black' : 'bg-stone-200 text-black'
            }`}>5</span>
            <span>Sign-Off &amp; Export</span>
          </button>
        </div>

        {/* Quick Shaft Depth Indicator Badge */}
        <div className="hidden lg:flex items-center gap-3 bg-white px-3 py-1 rounded-md border border-stone-300 font-mono text-xs">
          <span className="font-bold text-stone-600">Depth Range:</span>
          <span className="font-black text-cyan-800">{record.benchTopDepth.toFixed(1)}m → {record.benchBottomDepth.toFixed(1)}m</span>
          <span className="w-px h-3 bg-stone-300" />
          <span className="font-bold text-stone-600">Diameter:</span>
          <span className="font-black text-black">{record.shaftDiameter}m</span>
        </div>
      </div>

      {/* Main Workspace Body */}
      <main className="flex-1 overflow-y-auto p-4 bg-stone-200/60 flex flex-col">
        {/* STEP 1: BENCH SETUP */}
        {activeTab === 'bench' && (
          <div className="max-w-4xl mx-auto w-full space-y-4">
            <div className="bg-white rounded-xl border-2 border-stone-300 shadow-sm p-5 space-y-4">
              <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-black">Step 1: Shaft Project &amp; Bench Sinking Geometry</h2>
                  <p className="text-xs font-bold text-stone-600">
                    Define collar elevation, circular excavation diameter, and current bench sinking depth interval.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-stone-100 text-black font-black text-xs border border-stone-300">
                  NATM Shaft Standard
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Shaft ID / Name</label>
                  <input
                    type="text"
                    value={record.shaftId}
                    onChange={(e) => saveToStorage({ ...record, shaftId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Project Name</label>
                  <input
                    type="text"
                    value={record.projectName}
                    onChange={(e) => saveToStorage({ ...record, projectName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Collar Elevation (m a.s.l.)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={record.collarElevation}
                    onChange={(e) => saveToStorage({ ...record, collarElevation: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Excavated Diameter (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={record.shaftDiameter}
                    onChange={(e) => saveToStorage({ ...record, shaftDiameter: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Bench Top Depth (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={record.benchTopDepth}
                    onChange={(e) => {
                      const top = parseFloat(e.target.value) || 0;
                      saveToStorage({
                        ...record,
                        benchTopDepth: top,
                        advanceLength: parseFloat((record.benchBottomDepth - top).toFixed(2)),
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Bench Bottom Depth (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={record.benchBottomDepth}
                    onChange={(e) => {
                      const bot = parseFloat(e.target.value) || 0;
                      saveToStorage({
                        ...record,
                        benchBottomDepth: bot,
                        advanceLength: parseFloat((bot - record.benchTopDepth).toFixed(2)),
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Sinking Advance Round (m)</label>
                  <div className="w-full px-3 py-2 rounded-lg bg-cyan-50 border-2 border-cyan-400 text-black font-black text-sm">
                    {record.advanceLength.toFixed(2)} m
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Excavation Shift</label>
                  <select
                    value={record.shift}
                    onChange={(e) => saveToStorage({ ...record, shift: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  >
                    <option value="Day">Day Shift</option>
                    <option value="Night">Night Shift</option>
                    <option value="Swing">Swing Shift</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Mapping Geologist</label>
                  <input
                    type="text"
                    value={record.geologist}
                    onChange={(e) => saveToStorage({ ...record, geologist: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>
              </div>

              {/* Schematic Viewport */}
              <div className="mt-4 p-4 rounded-xl bg-stone-100 border-2 border-stone-300 flex flex-col md:flex-row items-center justify-around gap-4">
                <div className="text-center md:text-left">
                  <div className="text-xs font-black text-black uppercase tracking-wider">Shaft Cross-Section Geometry</div>
                  <div className="text-2xl font-black text-black mt-1">Dia: {record.shaftDiameter}m</div>
                  <div className="text-xs font-bold text-stone-600 mt-1">
                    Excavation Area: {((Math.PI * Math.pow(record.shaftDiameter / 2, 2))).toFixed(2)} m²
                  </div>
                  <div className="text-xs font-bold text-stone-600">
                    Round Volume: {((Math.PI * Math.pow(record.shaftDiameter / 2, 2)) * record.advanceLength).toFixed(2)} m³
                  </div>
                </div>

                {/* SVG Radial Diagram */}
                <svg width="140" height="140" viewBox="0 0 140 140" className="drop-shadow-sm">
                  <circle cx="70" cy="70" r="55" fill="#E2E8F0" stroke="#000000" strokeWidth="3" />
                  <circle cx="70" cy="70" r="48" fill="#F8FAFC" stroke="#0284C7" strokeWidth="2" strokeDasharray="4 2" />
                  <line x1="70" y1="10" x2="70" y2="130" stroke="#94A3B8" strokeWidth="1" />
                  <line x1="10" y1="70" x2="130" y2="70" stroke="#94A3B8" strokeWidth="1" />
                  <text x="70" y="24" textAnchor="middle" fill="#000000" fontSize="10" fontWeight="900">0° N</text>
                  <text x="125" y="74" textAnchor="middle" fill="#000000" fontSize="10" fontWeight="900">90° E</text>
                  <text x="70" y="125" textAnchor="middle" fill="#000000" fontSize="10" fontWeight="900">180° S</text>
                  <text x="16" y="74" textAnchor="middle" fill="#000000" fontSize="10" fontWeight="900">270° W</text>
                  <circle cx="70" cy="70" r="3" fill="#DC2626" />
                </svg>

                <button
                  type="button"
                  onClick={() => setActiveTab('perimeter')}
                  className="px-4 py-2.5 rounded-lg bg-black text-white hover:bg-stone-800 font-black text-xs flex items-center gap-2 cursor-pointer transition-all shadow-sm active:scale-95"
                >
                  <span>Proceed to 360° Perimeter Wall</span>
                  <ArrowRight className="w-4 h-4 text-cyan-400" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: 360 UNWRAPPED PERIMETER WALL */}
        {activeTab === 'perimeter' && (
          <div className="max-w-6xl mx-auto w-full space-y-4">
            <div className="bg-white rounded-xl border-2 border-stone-300 shadow-sm p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-3">
                <div>
                  <h2 className="text-base font-black text-black flex items-center gap-2">
                    <span>Step 2: 360° Cylindrical Unwrapped Shaft Wall</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-cyan-100 text-black border border-cyan-400 font-extrabold">
                      Bench {record.benchTopDepth}m - {record.benchBottomDepth}m
                    </span>
                  </h2>
                  <p className="text-xs font-bold text-stone-600">
                    The circular perimeter of the shaft is unfolded into 4 cardinal sectors. Click a sector to record lithology, overbreak, and geological features.
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {record.perimeterSectors.map((s, idx) => (
                    <button
                      key={s.sector}
                      type="button"
                      onClick={() => setSelectedSectorIdx(idx)}
                      className={`px-2.5 py-1 rounded text-xs font-black border-2 cursor-pointer transition-all ${
                        selectedSectorIdx === idx
                          ? 'bg-cyan-500 text-black border-black shadow-xs'
                          : 'bg-stone-100 text-black border-stone-300 hover:border-black'
                      }`}
                    >
                      {s.sector.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* 360 Unwrapped Visual Canvas (SVG) */}
              <div className="border-2 border-black rounded-xl overflow-hidden bg-stone-900 p-2 shadow-inner">
                <div className="flex items-center justify-between text-white text-[11px] font-mono font-bold px-2 mb-1">
                  <span>UNROLLED PERIMETER WALL (DEVELOPED VIEW: 0° TO 360°)</span>
                  <span>Circumference = {(Math.PI * record.shaftDiameter).toFixed(2)} m</span>
                </div>

                <svg viewBox="0 0 800 220" className="w-full h-auto bg-stone-950 rounded border border-stone-700">
                  <defs>
                    <pattern id="graniteHatch" width="20" height="20" patternUnits="userSpaceOnUse">
                      <circle cx="5" cy="5" r="1.5" fill="#FB7185" />
                      <circle cx="15" cy="15" r="1.5" fill="#FB7185" />
                    </pattern>
                    <pattern id="schistHatch" width="20" height="20" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="0" x2="20" y2="20" stroke="#38BDF8" strokeWidth="1.5" />
                    </pattern>
                    <pattern id="shearHatch" width="10" height="10" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="10" x2="10" y2="0" stroke="#EF4444" strokeWidth="2" />
                    </pattern>
                  </defs>

                  {/* 4 Cardinal Quadrant Panels */}
                  {record.perimeterSectors.map((sec, idx) => {
                    const x = idx * 200;
                    const isSelected = selectedSectorIdx === idx;
                    const color = idx === 0 ? '#334155' : idx === 1 ? '#475569' : idx === 2 ? '#334155' : '#1E293B';

                    return (
                      <g key={sec.sector} onClick={() => setSelectedSectorIdx(idx)} className="cursor-pointer">
                        {/* Sector Wall Panel */}
                        <rect
                          x={x + 2}
                          y="20"
                          width="196"
                          height="160"
                          fill={color}
                          stroke={isSelected ? '#38BDF8' : '#64748B'}
                          strokeWidth={isSelected ? '3' : '1'}
                          rx="4"
                        />

                        {/* Geological Fault / Joint Traces */}
                        {idx === 0 && (
                          <line x1={x + 30} y1="40" x2={x + 170} y2="160" stroke="#F59E0B" strokeWidth="3" strokeDasharray="4 2" />
                        )}
                        {idx === 1 && (
                          <g>
                            <line x1={x + 10} y1="60" x2={x + 190} y2="130" stroke="#EF4444" strokeWidth="4" />
                            <text x={x + 100} y="100" fill="#FCA5A5" fontSize="10" fontWeight="900" textAnchor="middle">
                              SHEAR ZONE ({sec.waterInflowLpm} L/min)
                            </text>
                          </g>
                        )}
                        {idx === 2 && (
                          <circle cx={x + 100} cy="100" r="14" fill="#38BDF8" fillOpacity="0.4" stroke="#0284C7" strokeWidth="2" />
                        )}

                        {/* Top Cardinal Label */}
                        <text x={x + 100} y="15" fill="#FFFFFF" fontSize="10" fontWeight="900" textAnchor="middle">
                          {sec.azimuthRange} ({sec.sector.split(' ')[0]})
                        </text>

                        {/* Bottom Information */}
                        <text x={x + 10} y="150" fill="#E2E8F0" fontSize="10" fontWeight="800">
                          {sec.primaryLithology}
                        </text>
                        <text x={x + 10} y="165" fill="#CBD5E1" fontSize="9" fontWeight="700">
                          Overbreak: +{sec.overbreakCm}cm | W: {sec.waterInflowLpm}L/m
                        </text>
                      </g>
                    );
                  })}

                  {/* Depth Reference Markers */}
                  <text x="10" y="32" fill="#F8FAFC" fontSize="9" fontWeight="900">
                    Depth: {record.benchTopDepth}m
                  </text>
                  <text x="10" y="175" fill="#F8FAFC" fontSize="9" fontWeight="900">
                    Depth: {record.benchBottomDepth}m
                  </text>
                </svg>
              </div>

              {/* Sector Inspector / Editor Form */}
              <div className="bg-stone-50 border-2 border-stone-300 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-cyan-600" />
                    <span className="text-sm font-black text-black">
                      Editing Sector: {record.perimeterSectors[selectedSectorIdx]?.sector} ({record.perimeterSectors[selectedSectorIdx]?.azimuthRange})
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-stone-600">
                    Quadrant {selectedSectorIdx + 1} of 4
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-black text-black mb-1">Primary Lithology</label>
                    <input
                      type="text"
                      value={record.perimeterSectors[selectedSectorIdx]?.primaryLithology || ''}
                      onChange={(e) => {
                        const updated = [...record.perimeterSectors];
                        updated[selectedSectorIdx].primaryLithology = e.target.value;
                        saveToStorage({ ...record, perimeterSectors: updated });
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border-2 border-stone-300 text-black font-bold text-xs focus:border-black outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-black mb-1">Weathering Grade</label>
                    <select
                      value={record.perimeterSectors[selectedSectorIdx]?.weatheringGrade || 'W2'}
                      onChange={(e) => {
                        const updated = [...record.perimeterSectors];
                        updated[selectedSectorIdx].weatheringGrade = e.target.value;
                        saveToStorage({ ...record, perimeterSectors: updated });
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border-2 border-stone-300 text-black font-bold text-xs focus:border-black outline-hidden"
                    >
                      <option value="W1 (Fresh Rock)">W1 (Fresh Rock)</option>
                      <option value="W2 (Slightly Weathered)">W2 (Slightly Weathered)</option>
                      <option value="W3 (Moderately Weathered)">W3 (Moderately Weathered)</option>
                      <option value="W4 (Highly Weathered)">W4 (Highly Weathered)</option>
                      <option value="W5 (Completely Weathered)">W5 (Completely Weathered)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-black mb-1">Joint Spacing (cm)</label>
                    <input
                      type="number"
                      value={record.perimeterSectors[selectedSectorIdx]?.jointSpacingCm || 0}
                      onChange={(e) => {
                        const updated = [...record.perimeterSectors];
                        updated[selectedSectorIdx].jointSpacingCm = parseInt(e.target.value) || 0;
                        saveToStorage({ ...record, perimeterSectors: updated });
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border-2 border-stone-300 text-black font-bold text-xs focus:border-black outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-black mb-1">Water Inflow (L/min)</label>
                    <input
                      type="number"
                      value={record.perimeterSectors[selectedSectorIdx]?.waterInflowLpm || 0}
                      onChange={(e) => {
                        const updated = [...record.perimeterSectors];
                        updated[selectedSectorIdx].waterInflowLpm = parseFloat(e.target.value) || 0;
                        saveToStorage({ ...record, perimeterSectors: updated });
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border-2 border-stone-300 text-black font-bold text-xs focus:border-black outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-black mb-1">Perimeter Overbreak (cm)</label>
                    <input
                      type="number"
                      value={record.perimeterSectors[selectedSectorIdx]?.overbreakCm || 0}
                      onChange={(e) => {
                        const updated = [...record.perimeterSectors];
                        updated[selectedSectorIdx].overbreakCm = parseInt(e.target.value) || 0;
                        saveToStorage({ ...record, perimeterSectors: updated });
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border-2 border-stone-300 text-black font-bold text-xs focus:border-black outline-hidden"
                    />
                  </div>

                  <div className="sm:col-span-2 md:col-span-1">
                    <label className="block text-xs font-black text-black mb-1">Shear &amp; Structural Notes</label>
                    <input
                      type="text"
                      value={record.perimeterSectors[selectedSectorIdx]?.shearZones || ''}
                      onChange={(e) => {
                        const updated = [...record.perimeterSectors];
                        updated[selectedSectorIdx].shearZones = e.target.value;
                        saveToStorage({ ...record, perimeterSectors: updated });
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border-2 border-stone-300 text-black font-bold text-xs focus:border-black outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: SHAFT BOTTOM FLOOR MAPPING */}
        {activeTab === 'floor' && (
          <div className="max-w-5xl mx-auto w-full space-y-4">
            <div className="bg-white rounded-xl border-2 border-stone-300 shadow-sm p-5 space-y-4">
              <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-black">Step 3: Shaft Bottom Floor Face (Horizontal Face)</h2>
                  <p className="text-xs font-bold text-stone-600">
                    Record floor face lithology, major joint sets (dip &amp; dip direction), floor water pooling, and basal heave stability.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-stone-100 text-black font-black text-xs border border-stone-300">
                  Depth: {record.benchBottomDepth} m
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                {/* Left: Circular Floor Face SVG */}
                <div className="border-2 border-stone-300 rounded-xl p-4 bg-stone-50 flex flex-col items-center">
                  <div className="text-xs font-black text-black uppercase mb-2">Shaft Bottom Face Floor Plan</div>

                  <svg width="240" height="240" viewBox="0 0 240 240" className="drop-shadow-md">
                    {/* Outer Circle (Excavated Perimeter) */}
                    <circle cx="120" cy="120" r="100" fill="#E2E8F0" stroke="#000000" strokeWidth="4" />
                    <circle cx="120" cy="120" r="92" fill="#CBD5E1" stroke="#0284C7" strokeWidth="1.5" strokeDasharray="3 3" />

                    {/* Joint Traces across floor */}
                    <line x1="40" y1="90" x2="200" y2="150" stroke="#DC2626" strokeWidth="3" />
                    <text x="180" y="145" fill="#991B1B" fontSize="10" fontWeight="900">J1 (78°SE)</text>

                    <line x1="80" y1="40" x2="160" y2="200" stroke="#2563EB" strokeWidth="2.5" />
                    <text x="165" y="195" fill="#1E40AF" fontSize="10" fontWeight="900">J2 (55°SW)</text>

                    <line x1="60" y1="180" x2="190" y2="80" stroke="#16A34A" strokeWidth="2" strokeDasharray="4 2" />
                    <text x="170" y="75" fill="#166534" fontSize="10" fontWeight="900">J3 (82°N)</text>

                    {/* Cardinal markers */}
                    <text x="120" y="16" textAnchor="middle" fill="#000000" fontSize="11" fontWeight="900">0° N</text>
                    <text x="230" y="124" textAnchor="middle" fill="#000000" fontSize="11" fontWeight="900">90° E</text>
                    <text x="120" y="235" textAnchor="middle" fill="#000000" fontSize="11" fontWeight="900">180° S</text>
                    <text x="10" y="124" textAnchor="middle" fill="#000000" fontSize="11" fontWeight="900">270° W</text>

                    <circle cx="120" cy="120" r="4" fill="#000000" />
                  </svg>

                  <div className="text-[11px] font-bold text-stone-600 mt-3 text-center">
                    Diameter: {record.shaftDiameter}m | Excavated Area: {((Math.PI * Math.pow(record.shaftDiameter / 2, 2))).toFixed(1)} m²
                  </div>
                </div>

                {/* Right: Structural Joint Set Table & Parameters */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-black text-black mb-1">RQD Rating (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={record.floorMapping.rqdPercent}
                        onChange={(e) => {
                          const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                          saveToStorage({
                            ...record,
                            floorMapping: { ...record.floorMapping, rqdPercent: val },
                          });
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-black text-sm focus:border-black outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black text-black mb-1">GSI Estimate (1-100)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={record.floorMapping.gsiEstimate}
                        onChange={(e) => {
                          const val = Math.min(100, Math.max(1, parseInt(e.target.value) || 1));
                          saveToStorage({
                            ...record,
                            floorMapping: { ...record.floorMapping, gsiEstimate: val },
                          });
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-black text-sm focus:border-black outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-black mb-1">Water Influx at Shaft Floor</label>
                    <select
                      value={record.floorMapping.waterPooling}
                      onChange={(e) => {
                        saveToStorage({
                          ...record,
                          floorMapping: { ...record.floorMapping, waterPooling: e.target.value as any },
                        });
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                    >
                      <option value="Dry">Dry (No visible moisture)</option>
                      <option value="Damp">Damp / Minor seepage</option>
                      <option value="Seeping (<10 L/min)">Seeping (&lt;10 L/min)</option>
                      <option value="Heavy Ingress (>50 L/min)">Heavy Ingress (&gt;50 L/min - sump required)</option>
                    </select>
                  </div>

                  {/* Joint Sets Table */}
                  <div className="border border-stone-300 rounded-lg overflow-hidden">
                    <div className="bg-stone-100 px-3 py-1.5 border-b border-stone-300 flex items-center justify-between">
                      <span className="text-xs font-black text-black">Mapped Floor Discontinuity Sets</span>
                      <span className="text-[10px] font-black text-cyan-800 bg-cyan-100 px-1.5 py-0.5 rounded">
                        {record.floorMapping.jointSets.length} Sets
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-stone-200 text-black font-black">
                          <tr>
                            <th className="p-2">Set</th>
                            <th className="p-2">Dip Dir (°)</th>
                            <th className="p-2">Dip (°)</th>
                            <th className="p-2">Spacing (m)</th>
                            <th className="p-2">Roughness</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200">
                          {record.floorMapping.jointSets.map((js, idx) => (
                            <tr key={js.id} className="hover:bg-stone-50 font-bold text-black">
                              <td className="p-2 font-black">{js.id}</td>
                              <td className="p-2 font-mono">{js.dipDirectionDeg}°</td>
                              <td className="p-2 font-mono">{js.dipDeg}°</td>
                              <td className="p-2 font-mono">{js.spacingMeters}m</td>
                              <td className="p-2">{js.roughness}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-black mb-1">Floor Face Remarks</label>
                    <textarea
                      rows={2}
                      value={record.floorMapping.floorRemarks}
                      onChange={(e) => {
                        saveToStorage({
                          ...record,
                          floorMapping: { ...record.floorMapping, floorRemarks: e.target.value },
                        });
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-xs focus:border-black outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: NATM SHAFT SUPPORT SYSTEM */}
        {activeTab === 'support' && (
          <div className="max-w-4xl mx-auto w-full space-y-4">
            <div className="bg-white rounded-xl border-2 border-stone-300 shadow-sm p-5 space-y-4">
              <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-black">Step 4: NATM Shaft Support &amp; Ring Lining System</h2>
                  <p className="text-xs font-bold text-stone-600">
                    Specify circular lattice girders/ring beams, radial perimeter rockbolts, and shotcrete thickness.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-stone-100 text-black font-black text-xs border border-stone-300">
                  {record.supportSystem.supportClass}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Shaft Support Class</label>
                  <select
                    value={record.supportSystem.supportClass}
                    onChange={(e) => {
                      saveToStorage({
                        ...record,
                        supportSystem: { ...record.supportSystem, supportClass: e.target.value as any },
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-black text-sm focus:border-black outline-hidden"
                  >
                    <option value="Shaft-I (Stable)">Shaft-I (Stable - Minimal Bolting)</option>
                    <option value="Shaft-II (Medium)">Shaft-II (Medium - Lattice Girder + 150mm Shotcrete)</option>
                    <option value="Shaft-III (Heavy)">Shaft-III (Heavy - Ring Beams + 200mm Shotcrete)</option>
                    <option value="Shaft-IV (Severe Shear/Fault)">Shaft-IV (Severe Shear - Heavy HEB + Spiles)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Circular Ring Beam Profile</label>
                  <select
                    value={record.supportSystem.ringBeamProfile}
                    onChange={(e) => {
                      saveToStorage({
                        ...record,
                        supportSystem: { ...record.supportSystem, ringBeamProfile: e.target.value as any },
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  >
                    <option value="None">None</option>
                    <option value="3-Bar Lattice Girder">3-Bar Lattice Girder</option>
                    <option value="4-Bar Heavy Girder">4-Bar Heavy Girder</option>
                    <option value="HEB 160 Steel Rib">HEB 160 Steel Rib</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Ring Beam Spacing (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={record.supportSystem.ringBeamSpacingMeters}
                    onChange={(e) => {
                      saveToStorage({
                        ...record,
                        supportSystem: {
                          ...record.supportSystem,
                          ringBeamSpacingMeters: parseFloat(e.target.value) || 1,
                        },
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Shotcrete Thickness (mm)</label>
                  <input
                    type="number"
                    step="10"
                    value={record.supportSystem.shotcreteThicknessMm}
                    onChange={(e) => {
                      saveToStorage({
                        ...record,
                        supportSystem: {
                          ...record.supportSystem,
                          shotcreteThicknessMm: parseInt(e.target.value) || 100,
                        },
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Shotcrete Reinforcement</label>
                  <select
                    value={record.supportSystem.shotcreteFiberType}
                    onChange={(e) => {
                      saveToStorage({
                        ...record,
                        supportSystem: {
                          ...record.supportSystem,
                          shotcreteFiberType: e.target.value as any,
                        },
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  >
                    <option value="Steel Fiber">Steel Fiber (35 kg/m³)</option>
                    <option value="Synthetic Macro-fiber">Synthetic Macro-fiber (6 kg/m³)</option>
                    <option value="Dual Mesh Reinforced">Dual Welded Wire Mesh (Q188)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Rockbolts Per Ring</label>
                  <input
                    type="number"
                    value={record.supportSystem.rockboltsPerRing}
                    onChange={(e) => {
                      saveToStorage({
                        ...record,
                        supportSystem: {
                          ...record.supportSystem,
                          rockboltsPerRing: parseInt(e.target.value) || 8,
                        },
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Bolt Length (m)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={record.supportSystem.boltLengthMeters}
                    onChange={(e) => {
                      saveToStorage({
                        ...record,
                        supportSystem: {
                          ...record.supportSystem,
                          boltLengthMeters: parseFloat(e.target.value) || 3.0,
                        },
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-black uppercase mb-1">Rockbolt Anchor Type</label>
                  <select
                    value={record.supportSystem.boltType}
                    onChange={(e) => {
                      saveToStorage({
                        ...record,
                        supportSystem: {
                          ...record.supportSystem,
                          boltType: e.target.value as any,
                        },
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-stone-50 border-2 border-stone-300 text-black font-bold text-sm focus:border-black outline-hidden"
                  >
                    <option value="Fully Grouted Rebar">Fully Grouted Rebar (25mm)</option>
                    <option value="Self-Drilling Hollow Bar (IBO)">Self-Drilling Hollow Bar (IBO R32)</option>
                    <option value="Swellex Friction Bolt">Swellex Friction Bolt</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="forepoling"
                    checked={record.supportSystem.forepolingSpiles}
                    onChange={(e) => {
                      saveToStorage({
                        ...record,
                        supportSystem: {
                          ...record.supportSystem,
                          forepolingSpiles: e.target.checked,
                        },
                      });
                    }}
                    className="w-4 h-4 accent-cyan-600 rounded"
                  />
                  <label htmlFor="forepoling" className="text-xs font-black text-black cursor-pointer">
                    Install Forepoling Spiles / Umbrella Ahead
                  </label>
                </div>
              </div>

              {/* Support Summary Box */}
              <div className="p-4 rounded-xl bg-cyan-50 border-2 border-cyan-400 flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-cyan-900 uppercase">Support Compliance Status</div>
                  <div className="text-sm font-extrabold text-black mt-0.5">
                    {record.supportSystem.supportClass}: {record.supportSystem.shotcreteThicknessMm}mm Shotcrete + {record.supportSystem.rockboltsPerRing}x {record.supportSystem.boltLengthMeters}m Bolts/Ring
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('summary')}
                  className="px-4 py-2 rounded-lg bg-black text-white hover:bg-stone-800 font-black text-xs flex items-center gap-2 cursor-pointer transition-all shadow-xs"
                >
                  <span>Verify &amp; Sign-Off</span>
                  <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: SUMMARY, SIGN-OFF & EXPORT */}
        {activeTab === 'summary' && (
          <div className="max-w-4xl mx-auto w-full space-y-4">
            <div className="bg-white rounded-xl border-2 border-stone-300 shadow-sm p-5 space-y-4">
              <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-black">Step 5: Geotechnical Sign-Off &amp; Export</h2>
                  <p className="text-xs font-bold text-stone-600">
                    Official NATM excavation sign-off for Shaft Bench {record.benchTopDepth}m - {record.benchBottomDepth}m.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-900 font-black text-xs border border-emerald-400">
                    Q-Value: {record.qSystemRating}
                  </span>
                  <span className="px-2.5 py-1 rounded bg-amber-100 text-amber-900 font-black text-xs border border-amber-400">
                    RMR: {record.rmrRating}
                  </span>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-stone-50 border border-stone-300">
                  <div className="text-[10px] font-black uppercase text-stone-500">Shaft Geometry</div>
                  <div className="text-sm font-black text-black mt-1">{record.shaftId}</div>
                  <div className="text-xs font-bold text-stone-700">Diameter: {record.shaftDiameter}m</div>
                  <div className="text-xs font-bold text-stone-700">Depth: {record.benchTopDepth}m - {record.benchBottomDepth}m</div>
                </div>

                <div className="p-3 rounded-lg bg-stone-50 border border-stone-300">
                  <div className="text-[10px] font-black uppercase text-stone-500">Rock Mass Rating</div>
                  <div className="text-sm font-black text-black mt-1">GSI {record.floorMapping.gsiEstimate} | RQD {record.floorMapping.rqdPercent}%</div>
                  <div className="text-xs font-bold text-stone-700">Water: {record.floorMapping.waterPooling}</div>
                  <div className="text-xs font-bold text-stone-700">{record.floorMapping.jointSets.length} Dominant Joint Sets</div>
                </div>

                <div className="p-3 rounded-lg bg-stone-50 border border-stone-300">
                  <div className="text-[10px] font-black uppercase text-stone-500">Approved Support</div>
                  <div className="text-sm font-black text-black mt-1">{record.supportSystem.supportClass}</div>
                  <div className="text-xs font-bold text-stone-700">{record.supportSystem.shotcreteThicknessMm}mm {record.supportSystem.shotcreteFiberType}</div>
                  <div className="text-xs font-bold text-stone-700">{record.supportSystem.ringBeamProfile} @ {record.supportSystem.ringBeamSpacingMeters}m</div>
                </div>
              </div>

              {/* Sign-off Form */}
              <div className="border border-stone-300 rounded-xl p-4 bg-stone-50 space-y-3">
                <div className="text-xs font-black text-black uppercase">Official NATM Sign-Off Credentials</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-black mb-1">Lead Geologist</label>
                    <input
                      type="text"
                      value={record.geologist}
                      onChange={(e) => saveToStorage({ ...record, geologist: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border-2 border-stone-300 text-black font-bold text-xs focus:border-black outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-black mb-1">Resident Tunnel Engineer</label>
                    <input
                      type="text"
                      value={record.tunnelEngineer}
                      onChange={(e) => saveToStorage({ ...record, tunnelEngineer: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border-2 border-stone-300 text-black font-bold text-xs focus:border-black outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-black mb-1">Geotechnical Verification Notes</label>
                  <textarea
                    rows={2}
                    value={record.signOff.notes || ''}
                    onChange={(e) => {
                      saveToStorage({
                        ...record,
                        signOff: { ...record.signOff, notes: e.target.value },
                      });
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-white border-2 border-stone-300 text-black font-bold text-xs focus:border-black outline-hidden"
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
                    dl.setAttribute('download', `${record.shaftId.replace(/\s+/g, '_')}_Bench_${record.benchTopDepth}_${record.benchBottomDepth}.json`);
                    dl.click();
                  }}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-stone-900 hover:bg-black text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span>Export JSON Dataset</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
                >
                  <Printer className="w-4 h-4 text-cyan-200" />
                  <span>Print Formal Sheet</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
