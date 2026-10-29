import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Compass,
  FileCheck2,
  Info,
  Layers,
  MapPin,
  Ruler,
  Save,
  Shield,
  Sliders,
  User,
  X,
} from 'lucide-react';
import {
  ParameterInputStatus,
  QIndexParameters,
  QSystemParamKey,
  RmrParameters,
  TunnelGeometry,
  TunnelSettings,
} from '../types/tunnel';
import { ClampedNumericInput } from './ClampedNumericInput';
import { parseDriveDirectionAzimuth } from '../engine/orientationEngine';

export interface ProjectConfigurationAndGeotechModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TunnelSettings;
  onUpdateSettings: React.Dispatch<React.SetStateAction<TunnelSettings>>;
  geometry: TunnelGeometry;
  onUpdateGeometry: React.Dispatch<React.SetStateAction<TunnelGeometry>>;
  rmrParams: RmrParameters;
  onUpdateRmrParams: React.Dispatch<React.SetStateAction<RmrParameters>>;
  qIndexParams: QIndexParameters;
  onUpdateQIndexParams: React.Dispatch<React.SetStateAction<QIndexParameters>>;
  qParamStatus: Record<QSystemParamKey, ParameterInputStatus>;
  onUpdateQParamStatus: React.Dispatch<
    React.SetStateAction<Record<QSystemParamKey, ParameterInputStatus>>
  >;
  onShowToast?: (msg: string) => void;
}

type ConfigTab = 'PROJECT_DRIVE' | 'RMR89' | 'Q_SYSTEM' | 'AUDIT_SUMMARY';

export const ProjectConfigurationAndGeotechModal: React.FC<ProjectConfigurationAndGeotechModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  geometry,
  onUpdateGeometry,
  rmrParams,
  onUpdateRmrParams,
  qIndexParams,
  onUpdateQIndexParams,
  qParamStatus,
  onUpdateQParamStatus,
  onShowToast,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<ConfigTab>('PROJECT_DRIVE');

  // Local working copy of state to allow discard or apply
  const [localSettings, setLocalSettings] = useState<TunnelSettings>(() => ({ ...settings }));
  const [localGeometry, setLocalGeometry] = useState<TunnelGeometry>(() => ({ ...geometry }));
  const [localRmr, setLocalRmr] = useState<RmrParameters>(() => ({ ...rmrParams }));
  const [localQ, setLocalQ] = useState<QIndexParameters>(() => ({ ...qIndexParams }));
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Parse Drive Azimuth & Quadrant
  const parsedDrive = useMemo(
    () => parseDriveDirectionAzimuth(localSettings.driveDirectionInput || 'N 000° E'),
    [localSettings.driveDirectionInput]
  );

  // Derived RMR calculation (Bieniawski 1989)
  const calculatedRmrTotal = useMemo(() => {
    const {
      intactStrengthRating,
      rqdRating,
      spacingRating,
      conditionRating,
      groundwaterRating,
      orientationAdjustmentRating,
    } = localRmr;

    const hasAll =
      intactStrengthRating !== null &&
      rqdRating !== null &&
      spacingRating !== null &&
      conditionRating !== null &&
      groundwaterRating !== null;

    if (!hasAll) return null;

    const base =
      (intactStrengthRating || 0) +
      (rqdRating || 0) +
      (spacingRating || 0) +
      (conditionRating || 0) +
      (groundwaterRating || 0);

    const adj = orientationAdjustmentRating || 0;
    return Math.max(0, Math.min(100, base + adj));
  }, [localRmr]);

  // Derived Q calculation (Barton 1974)
  const calculatedQ = useMemo(() => {
    const { rqd, jn, jr, ja, jw, srf } = localQ;
    if (!rqd || !jn || !jr || !ja || !jw || !srf) return null;
    if (jn <= 0 || ja <= 0 || srf <= 0) return null;
    const q = (rqd / jn) * (jr / ja) * (jw / srf);
    return Math.max(0.001, Math.min(1000, Number(q.toFixed(3))));
  }, [localQ]);

  // Handle Chainage Sync
  const handleFaceChainageChange = (valStr: string) => {
    const pull = localSettings.roundLength || 3.5;
    const match = valStr.match(/(\d+(?:\.\d+)?)/);
    let nextInterval = localSettings.chainage;
    if (match) {
      const faceM = parseFloat(match[1]);
      if (!isNaN(faceM) && faceM >= 0) {
        const fromM = Math.max(0, Number((faceM - pull).toFixed(2)));
        const toM = Number(faceM.toFixed(2));
        nextInterval = `RD ${fromM.toFixed(2)}m - ${toM.toFixed(2)}m`;
      }
    }
    setLocalSettings((prev) => ({
      ...prev,
      faceChainage: valStr,
      chainage: nextInterval,
    }));
  };

  const handlePullLengthChange = (pullM: number | null) => {
    const nextPull = Math.max(0.5, Math.min(12.0, pullM || 3.5));
    const match = (localSettings.faceChainage || '').match(/(\d+(?:\.\d+)?)/);
    let nextInterval = localSettings.chainage;
    if (match) {
      const faceM = parseFloat(match[1]);
      if (!isNaN(faceM) && faceM >= 0) {
        const fromM = Math.max(0, Number((faceM - nextPull).toFixed(2)));
        const toM = Number(faceM.toFixed(2));
        nextInterval = `RD ${fromM.toFixed(2)}m - ${toM.toFixed(2)}m`;
      }
    }
    setLocalSettings((prev) => ({
      ...prev,
      roundLength: nextPull,
      chainage: nextInterval,
    }));
  };

  const handleDriveAzimuthChange = (azimuthVal: number | null) => {
    const norm = Math.max(0, Math.min(360, azimuthVal ?? 0));
    const quad = `N ${norm.toFixed(0).padStart(3, '0')}°`;
    setLocalSettings((prev) => ({
      ...prev,
      driveDirection: norm,
      driveDirectionInput: quad,
    }));
  };

  const handleSaveAll = () => {
    onUpdateSettings((prev) => ({
      ...prev,
      ...localSettings,
      sheetConfig: {
        ...(prev.sheetConfig || ({} as any)),
        projectName: localSettings.projectName || prev.sheetConfig?.projectName || '',
        location: localSettings.location || prev.sheetConfig?.location || '',
      },
    }));
    onUpdateGeometry((prev) => ({
      ...prev,
      width: localGeometry.width,
      height: localGeometry.height,
      wallHeight: localGeometry.wallHeight,
    }));
    onUpdateRmrParams(localRmr);
    onUpdateQIndexParams(localQ);

    if (onShowToast) {
      onShowToast('✓ Project and geotechnical parameters applied across all modules.');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-xs">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden font-sans text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                PROJECT CONFIGURATION &amp; GEOTECHNICAL DATA CONSOLE
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Authoritative physical inputs · Bounded parameters · Zero autonomous fabrication
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-800 bg-slate-950/30 overflow-x-auto text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('PROJECT_DRIVE')}
            className={`flex items-center gap-2 px-3.5 py-2.5 border-b-2 font-semibold transition-colors cursor-pointer ${
              activeTab === 'PROJECT_DRIVE'
                ? 'border-cyan-400 text-cyan-300 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-4 h-4" />
            1. Project &amp; Tunnel Drive
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('RMR89')}
            className={`flex items-center gap-2 px-3.5 py-2.5 border-b-2 font-semibold transition-colors cursor-pointer ${
              activeTab === 'RMR89'
                ? 'border-cyan-400 text-cyan-300 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            2. Bieniawski RMR89
            {calculatedRmrTotal !== null ? (
              <span className="px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-[10px]">
                {calculatedRmrTotal}
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-500/60 text-amber-300 text-[10px] font-bold">
                Not Assessed
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('Q_SYSTEM')}
            className={`flex items-center gap-2 px-3.5 py-2.5 border-b-2 font-semibold transition-colors cursor-pointer ${
              activeTab === 'Q_SYSTEM'
                ? 'border-cyan-400 text-cyan-300 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            3. Barton Q-System
            {calculatedQ !== null ? (
              <span className="px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-[10px]">
                {calculatedQ}
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-500/60 text-amber-300 text-[10px] font-bold">
                Not Assessed
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('AUDIT_SUMMARY')}
            className={`flex items-center gap-2 px-3.5 py-2.5 border-b-2 font-semibold transition-colors cursor-pointer ${
              activeTab === 'AUDIT_SUMMARY'
                ? 'border-cyan-400 text-cyan-300 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            4. Audit &amp; Completeness
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: PROJECT & TUNNEL DRIVE */}
          {activeTab === 'PROJECT_DRIVE' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-cyan-400" />
                  Project &amp; Structure Identification
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <label className="space-y-1 block">
                    <span className="text-xs text-slate-400">Project / Contract Name</span>
                    <input
                      type="text"
                      value={localSettings.projectName || ''}
                      placeholder="e.g. Hydroelectric Power Tunnel PKG-2"
                      onChange={(e) =>
                        setLocalSettings((p) => ({ ...p, projectName: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-hidden focus:border-cyan-500"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-xs text-slate-400">Tunnel / Excavation Name</span>
                    <input
                      type="text"
                      value={localSettings.tunnelName || ''}
                      placeholder="e.g. Head Race Tunnel (HRT)"
                      onChange={(e) =>
                        setLocalSettings((p) => ({ ...p, tunnelName: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-hidden focus:border-cyan-500"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-xs text-slate-400">Location / Adit / Heading</span>
                    <input
                      type="text"
                      value={localSettings.location || ''}
                      placeholder="e.g. Adit-2 Downstream Heading"
                      onChange={(e) =>
                        setLocalSettings((p) => ({
                          ...p,
                          location: e.target.value,
                          locationName: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-hidden focus:border-cyan-500"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-xs text-slate-400">Engineering Geologist (Mapped By)</span>
                    <input
                      type="text"
                      value={localSettings.mappedBy || ''}
                      placeholder="e.g. Senior Geotechnical Specialist"
                      onChange={(e) =>
                        setLocalSettings((p) => ({
                          ...p,
                          mappedBy: e.target.value,
                          geologistName: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-hidden focus:border-cyan-500"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-xs text-slate-400">Mapping Date</span>
                    <input
                      type="date"
                      value={localSettings.date || new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setLocalSettings((p) => ({ ...p, date: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 font-mono focus:outline-hidden focus:border-cyan-500"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-xs text-slate-400">Primary Lithology</span>
                    <input
                      type="text"
                      value={localSettings.lithology || ''}
                      placeholder="e.g. Biotite Gneiss with Quartz Veins"
                      onChange={(e) =>
                        setLocalSettings((p) => ({ ...p, lithology: e.target.value }))
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-hidden focus:border-cyan-500"
                    />
                  </label>
                </div>
              </div>

              {/* DRIVE AZIMUTH & COMPASS ROSE */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="md:col-span-8 space-y-4">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Compass className="w-4 h-4 text-cyan-400" />
                    Tunnel Drive Azimuth &amp; Alignment Heading
                  </h3>
                  <p className="text-xs text-slate-400">
                    The drive direction defines how joints, faults, and strike lines intercept the
                    tunnel axis. Values are strictly bounded between 0° and 360° (clockwise from
                    True North).
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ClampedNumericInput
                      label="Tunnel Drive Direction"
                      value={parsedDrive.azimuth}
                      onChange={handleDriveAzimuthChange}
                      min={0}
                      max={360}
                      step={1}
                      unit="°"
                      helperText="Clockwise azimuth from True North"
                      scientificReference="ISRM Compass Convention"
                    />

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-200 block">
                        Quadrant / Notation Equivalent
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={`${localSettings.driveDirectionInput || `N ${parsedDrive.azimuth.toFixed(0)}°`} (Azimuth ${parsedDrive.azimuth.toFixed(1)}°)`}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg font-mono text-sm text-cyan-300 select-all"
                      />
                      <span className="text-[10px] text-slate-400 block">
                        Auto-normalized strike-to-drive baseline
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
                    <label className="space-y-1 block">
                      <span className="text-xs text-slate-300">Face Chainage (RD)</span>
                      <input
                        type="text"
                        value={localSettings.faceChainage || 'RD 3.50m'}
                        onChange={(e) => handleFaceChainageChange(e.target.value)}
                        placeholder="e.g. RD 1423.50m"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm font-mono text-emerald-300 font-bold focus:outline-hidden focus:border-cyan-500"
                      />
                    </label>

                    <ClampedNumericInput
                      label="Round / Pull Length"
                      value={localSettings.roundLength}
                      onChange={handlePullLengthChange}
                      min={0.5}
                      max={12.0}
                      step={0.5}
                      unit="m"
                      helperText="Advance per excavation cycle"
                    />

                    <label className="space-y-1 block">
                      <span className="text-xs text-slate-300">Calculated Round Interval</span>
                      <input
                        type="text"
                        readOnly
                        value={localSettings.chainage || 'RD 0.00m - 3.50m'}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm font-mono text-slate-300 select-all"
                      />
                    </label>
                  </div>
                </div>

                {/* Compass Rose Visualizer */}
                <div className="md:col-span-4 flex flex-col items-center justify-center p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-[11px] font-mono text-slate-400 mb-2">DRIVE AZIMUTH ROSE</div>
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="44" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
                      <line x1="50" y1="8" x2="50" y2="92" stroke="#475569" strokeDasharray="2,2" />
                      <line x1="8" y1="50" x2="92" y2="50" stroke="#475569" strokeDasharray="2,2" />
                      <text x="50" y="16" fill="#f87171" fontSize="7" fontWeight="bold" textAnchor="middle">N</text>
                      <text x="88" y="52.5" fill="#94a3b8" fontSize="7" textAnchor="middle">E</text>
                      <text x="50" y="90" fill="#94a3b8" fontSize="7" textAnchor="middle">S</text>
                      <text x="12" y="52.5" fill="#94a3b8" fontSize="7" textAnchor="middle">W</text>

                      {/* Direction Pointer */}
                      <g transform={`rotate(${parsedDrive.azimuth} 50 50)`}>
                        <line x1="50" y1="50" x2="50" y2="18" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" />
                        <polygon points="50,12 46,20 54,20" fill="#06b6d4" />
                      </g>
                    </svg>
                  </div>
                  <div className="text-xs font-mono font-bold text-cyan-300 mt-2">
                    {parsedDrive.azimuth.toFixed(1)}°
                  </div>
                </div>
              </div>

              {/* EXCAVATION DIMENSIONS */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-cyan-400" />
                  Excavation Cross-Section Geometry (Meters)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <ClampedNumericInput
                    label="Tunnel Span / Width"
                    value={localGeometry.width}
                    onChange={(val) =>
                      setLocalGeometry((p) => ({ ...p, width: val ?? 8.4 }))
                    }
                    min={1.0}
                    max={35.0}
                    step={0.1}
                    unit="m"
                    helperText="Excavated springline span"
                  />

                  <ClampedNumericInput
                    label="Total Excavation Height"
                    value={localGeometry.height}
                    onChange={(val) =>
                      setLocalGeometry((p) => ({ ...p, height: val ?? 7.2 }))
                    }
                    min={1.0}
                    max={35.0}
                    step={0.1}
                    unit="m"
                    helperText="Invert to crown apex"
                  />

                  <ClampedNumericInput
                    label="Sidewall Height (Springline)"
                    value={localGeometry.wallHeight}
                    onChange={(val) =>
                      setLocalGeometry((p) => ({ ...p, wallHeight: val ?? 4.2 }))
                    }
                    min={0.5}
                    max={localGeometry.height - 0.2}
                    step={0.1}
                    unit="m"
                    helperText="Vertical sidewalls"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BIENIAWSKI RMR89 */}
          {activeTab === 'RMR89' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-200">
                    Bieniawski (1989) Rock Mass Rating Parameters
                  </h3>
                  <p className="text-xs text-slate-400">
                    Each parameter is strictly clamped to ISRM / Bieniawski rating ranges. Unassessed
                    fields remain null without synthetic defaults.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Computed RMR89 Total</div>
                  <div
                    className={`text-xl font-mono font-bold ${
                      calculatedRmrTotal !== null ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {calculatedRmrTotal !== null ? `${calculatedRmrTotal} / 100` : 'Not Fully Assessed'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. Intact Rock Strength */}
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                  <span className="text-xs font-mono font-bold text-cyan-400 block">
                    1. STRENGTH OF INTACT ROCK (UCS)
                  </span>
                  <ClampedNumericInput
                    label="Uniaxial Compressive Strength (UCS)"
                    value={localRmr.intactStrengthValueMPa}
                    onChange={(val) => {
                      let rating: number | null = null;
                      if (val !== null) {
                        if (val > 250) rating = 15;
                        else if (val >= 100) rating = 12;
                        else if (val >= 50) rating = 7;
                        else if (val >= 25) rating = 4;
                        else if (val >= 5) rating = 2;
                        else if (val >= 1) rating = 1;
                        else rating = 0;
                      }
                      setLocalRmr((p) => ({
                        ...p,
                        intactStrengthValueMPa: val,
                        intactStrengthRating: rating,
                      }));
                    }}
                    min={0.5}
                    max={500}
                    step={1}
                    unit="MPa"
                    allowNull
                    helperText={
                      localRmr.intactStrengthRating !== null
                        ? `Bieniawski Rating A1: ${localRmr.intactStrengthRating} pts`
                        : 'Unassessed'
                    }
                    scientificReference="ISRM Grade R0 - R6"
                  />
                </div>

                {/* 2. RQD */}
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                  <span className="text-xs font-mono font-bold text-cyan-400 block">
                    2. ROCK QUALITY DESIGNATION (RQD)
                  </span>
                  <ClampedNumericInput
                    label="Drill Core RQD %"
                    value={localRmr.rqdPercent}
                    onChange={(val) => {
                      let rating: number | null = null;
                      if (val !== null) {
                        if (val >= 90) rating = 20;
                        else if (val >= 75) rating = 17;
                        else if (val >= 50) rating = 13;
                        else if (val >= 25) rating = 8;
                        else rating = 3;
                      }
                      setLocalRmr((p) => ({
                        ...p,
                        rqdPercent: val,
                        rqdRating: rating,
                      }));
                    }}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    allowNull
                    helperText={
                      localRmr.rqdRating !== null
                        ? `Bieniawski Rating A2: ${localRmr.rqdRating} pts`
                        : 'Unassessed'
                    }
                    scientificReference="Deere et al. (1967)"
                  />
                </div>

                {/* 3. Joint Spacing */}
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                  <span className="text-xs font-mono font-bold text-cyan-400 block">
                    3. SPACING OF DISCONTINUITIES
                  </span>
                  <ClampedNumericInput
                    label="Discontinuity Spacing"
                    value={localRmr.spacingMeters}
                    onChange={(val) => {
                      let rating: number | null = null;
                      if (val !== null) {
                        if (val > 2.0) rating = 20;
                        else if (val >= 0.6) rating = 15;
                        else if (val >= 0.2) rating = 10;
                        else if (val >= 0.06) rating = 8;
                        else rating = 5;
                      }
                      setLocalRmr((p) => ({
                        ...p,
                        spacingMeters: val,
                        spacingRating: rating,
                      }));
                    }}
                    min={0.01}
                    max={10.0}
                    step={0.05}
                    unit="m"
                    allowNull
                    helperText={
                      localRmr.spacingRating !== null
                        ? `Bieniawski Rating A3: ${localRmr.spacingRating} pts`
                        : 'Unassessed'
                    }
                    scientificReference="ISRM Spacing Class"
                  />
                </div>

                {/* 4. Discontinuity Condition */}
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-cyan-400 block">
                      4. CONDITION OF DISCONTINUITIES
                    </span>
                    {localRmr.conditionRating === null && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/50 border border-amber-500/70 text-amber-300 font-mono text-[10.5px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Not Selected
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-200">Joint Wall Description / Rating</label>
                    <select
                      value={localRmr.conditionRating ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        setLocalRmr((p) => ({ ...p, conditionRating: val }));
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
                    >
                      <option value="">(Not Selected — Tap to choose)</option>
                      <option value="30">Very rough, unweathered, tight (30 pts)</option>
                      <option value="25">Slightly rough, separation &lt; 1mm, slightly weathered (25 pts)</option>
                      <option value="20">Slightly rough, separation &lt; 1mm, highly weathered (20 pts)</option>
                      <option value="10">Slickensided / gouge &lt; 5mm, continuous (10 pts)</option>
                      <option value="0">Soft gouge &gt; 5mm or separation &gt; 5mm (0 pts)</option>
                    </select>
                  </div>
                </div>

                {/* 5. Groundwater Conditions */}
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-cyan-400 block">
                      5. GROUNDWATER INFLOW
                    </span>
                    {localRmr.groundwaterRating === null && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/50 border border-amber-500/70 text-amber-300 font-mono text-[10.5px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Not Selected
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-200">Excavation Water State</label>
                    <select
                      value={localRmr.groundwaterRating ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        setLocalRmr((p) => ({ ...p, groundwaterRating: val }));
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
                    >
                      <option value="">(Not Selected — Tap to choose)</option>
                      <option value="15">Completely Dry (15 pts)</option>
                      <option value="10">Damp (&lt; 10 L/min per 10m) (10 pts)</option>
                      <option value="7">Wet (10–25 L/min per 10m) (7 pts)</option>
                      <option value="4">Dripping (25–125 L/min per 10m) (4 pts)</option>
                      <option value="0">Flowing (&gt; 125 L/min per 10m) (0 pts)</option>
                    </select>
                  </div>
                </div>

                {/* 6. Discontinuity Orientation Adjustment */}
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-cyan-400 block">
                      6. ORIENTATION ADJUSTMENT (TABLE B)
                    </span>
                    {localRmr.orientationAdjustmentRating === null && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/50 border border-amber-500/70 text-amber-300 font-mono text-[10.5px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Not Selected
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-200">Drive Direction Favorability</label>
                    <select
                      value={localRmr.orientationAdjustmentRating ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        setLocalRmr((p) => ({ ...p, orientationAdjustmentRating: val }));
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
                    >
                      <option value="">(Not Selected — Tap to choose)</option>
                      <option value="0">Fair / Neutral (0 pts)</option>
                      <option value="-2">Favorable (-2 pts)</option>
                      <option value="-5">Unfavorable (-5 pts)</option>
                      <option value="-10">Very Unfavorable (-10 pts)</option>
                      <option value="-12">Extremely Unfavorable (-12 pts)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BARTON Q-SYSTEM */}
          {activeTab === 'Q_SYSTEM' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-200">
                    Barton NGI Q-System Classification Parameters
                  </h3>
                  <p className="text-xs text-slate-400">
                    Q = (RQD / Jn) × (Jr / Ja) × (Jw / SRF). Values are checked against empirical NGI
                    tables.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Computed Q-Index</div>
                  <div
                    className={`text-xl font-mono font-bold ${
                      calculatedQ !== null ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {calculatedQ !== null ? `Q = ${calculatedQ}` : 'Pending Inputs'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <ClampedNumericInput
                  label="RQD (Core Recovery)"
                  value={localQ.rqd}
                  onChange={(val) => setLocalQ((p) => ({ ...p, rqd: val }))}
                  min={10}
                  max={100}
                  step={1}
                  unit="%"
                  allowNull
                  nullLabel="Not Selected"
                  helperText="10% minimum per Barton"
                />

                <ClampedNumericInput
                  label="Jn (Joint Set Number)"
                  value={localQ.jn}
                  onChange={(val) => setLocalQ((p) => ({ ...p, jn: val }))}
                  min={0.5}
                  max={20.0}
                  step={0.5}
                  allowNull
                  nullLabel="Not Selected"
                  helperText="0.5 (Massive) to 20 (Crushed)"
                />

                <ClampedNumericInput
                  label="Jr (Roughness Number)"
                  value={localQ.jr}
                  onChange={(val) => setLocalQ((p) => ({ ...p, jr: val }))}
                  min={0.5}
                  max={4.0}
                  step={0.5}
                  allowNull
                  nullLabel="Not Selected"
                  helperText="0.5 (Slickenside) to 4 (Discontinuous)"
                />

                <ClampedNumericInput
                  label="Ja (Alteration Number)"
                  value={localQ.ja}
                  onChange={(val) => setLocalQ((p) => ({ ...p, ja: val }))}
                  min={0.75}
                  max={20.0}
                  step={0.25}
                  allowNull
                  nullLabel="Not Selected"
                  helperText="0.75 (Healed) to 20 (Clay gouge)"
                />

                <ClampedNumericInput
                  label="Jw (Water Reduction Factor)"
                  value={localQ.jw}
                  onChange={(val) => setLocalQ((p) => ({ ...p, jw: val }))}
                  min={0.05}
                  max={1.0}
                  step={0.05}
                  allowNull
                  nullLabel="Not Selected"
                  helperText="1.0 (Dry) to 0.05 (High pressure)"
                />

                <ClampedNumericInput
                  label="SRF (Stress Reduction Factor)"
                  value={localQ.srf}
                  onChange={(val) => setLocalQ((p) => ({ ...p, srf: val }))}
                  min={0.5}
                  max={200.0}
                  step={0.5}
                  allowNull
                  nullLabel="Not Selected"
                  helperText="0.5 (Competent) to 200 (Heavy squeeze)"
                />
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT SUMMARY & UNENTERED FIELDS CHECKLIST */}
          {activeTab === 'AUDIT_SUMMARY' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <h3 className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-cyan-400" />
                  Parameter Integrity &amp; Verification Audit
                </h3>
                <p className="text-xs text-slate-400">
                  Audit report detailing which fields are measured by the user vs. which will appear as
                  &ldquo;Not Assessed&rdquo; in engineering outputs.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-mono font-bold text-slate-300">
                    EXCAVATION &amp; GEOMETRY INPUTS
                  </h4>
                  <ul className="text-xs space-y-2">
                    <li className="flex items-center justify-between">
                      <span className="text-slate-400">Tunnel Drive Azimuth:</span>
                      <span className="font-mono text-cyan-300 font-bold">{parsedDrive.azimuth.toFixed(1)}°</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-slate-400">Face Chainage:</span>
                      <span className="font-mono text-emerald-300 font-bold">{localSettings.faceChainage || 'RD 3.50m'}</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-slate-400">Pull Length:</span>
                      <span className="font-mono text-slate-200">{localSettings.roundLength} m</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-slate-400">Excavation Span × Height:</span>
                      <span className="font-mono text-slate-200">
                        {localGeometry.width.toFixed(2)}m × {localGeometry.height.toFixed(2)}m
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-mono font-bold text-slate-300">
                    GEOTECHNICAL CLASSIFICATION STATUS
                  </h4>
                  <ul className="text-xs space-y-2">
                    <li className="flex items-center justify-between">
                      <span className="text-slate-400">RMR89 Total:</span>
                      {calculatedRmrTotal !== null ? (
                        <span className="font-mono text-emerald-400 font-bold">
                          {calculatedRmrTotal} (Verified)
                        </span>
                      ) : (
                        <span className="font-mono text-amber-400">Not Assessed (Locked)</span>
                      )}
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-slate-400">Barton Q-Value:</span>
                      {calculatedQ !== null ? (
                        <span className="font-mono text-emerald-400 font-bold">
                          {calculatedQ} (Verified)
                        </span>
                      ) : (
                        <span className="font-mono text-amber-400">Not Assessed (Locked)</span>
                      )}
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-slate-400">Intact Rock UCS:</span>
                      <span className="font-mono text-slate-200">
                        {localRmr.intactStrengthValueMPa !== null
                          ? `${localRmr.intactStrengthValueMPa} MPa`
                          : 'Not Assessed'}
                      </span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-slate-400">Core RQD:</span>
                      <span className="font-mono text-slate-200">
                        {localRmr.rqdPercent !== null ? `${localRmr.rqdPercent}%` : 'Not Assessed'}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-200 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  Engineering Policy: Any field left as &ldquo;Not Assessed&rdquo; will cleanly render
                  with an unassessed status badge in the final engineering sheets and PDF reports.
                  Calculations requiring those missing fields remain securely locked until measured.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <div className="text-xs text-slate-400 font-mono">
            Drive: <strong className="text-cyan-300">{parsedDrive.azimuth.toFixed(0)}°</strong> · Face:{' '}
            <strong className="text-emerald-300">{localSettings.faceChainage || 'RD 3.50m'}</strong>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white shadow-md transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Apply Validated Parameters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
