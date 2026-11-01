import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Compass,
  Download,
  Droplets,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderPlus,
  Gauge,
  Info,
  Layers,
  MapPin,
  Maximize2,
  Printer,
  RefreshCw,
  Save,
  Shield,
  ShieldAlert,
  Sliders,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Plus,
  Trash2,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  computeAlertLevel,
  computeRatePerDay,
  createDefaultLocationDataset,
  exportMonitoringDataToCsv,
  InstalledInstrument,
  InstrumentPosition,
  InstrumentReading,
  InstrumentType,
  INSTRUMENT_METADATA,
  loadLocationMonitoringData,
  LocationMonitoringRecord,
  MonitoringStructureType,
  saveLocationMonitoringData,
  SENSOR_POSITION_LABELS,
  TarpAlertLevel,
} from '../engine/tunnelMonitoringEngine';

interface TunnelMonitoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProject?: string;
  defaultLocation?: string;
  defaultStructureType?: MonitoringStructureType;
  availableProjects?: string[];
  availableLocations?: string[];
  clientName?: string;
  contractorName?: string;
  consultantName?: string;
}

export const TunnelMonitoringModal: React.FC<TunnelMonitoringModalProps> = ({
  isOpen,
  onClose,
  defaultProject = '',
  defaultLocation = '',
  defaultStructureType = 'tunnel',
  availableProjects = [],
  availableLocations = [],
  clientName = '',
  contractorName = '',
  consultantName = '',
}) => {
  // Real-Time Theme Integration with the App
  const { theme, palette } = useTheme();
  // Dedicated Dark Industrial CAD Rock Engineering Theme
  // Fully harmonized with ESWA NATM & Underground Workspace dark theme & background
  const isLight = false;

  // Navigation & View Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'log' | 'graphs' | 'report'>('overview');

  // Location & Project Selection state
  const [structureType, setStructureType] = useState<MonitoringStructureType>(defaultStructureType);
  const [selectedProject, setSelectedProject] = useState<string>(defaultProject);
  const [selectedLocation, setSelectedLocation] = useState<string>(defaultLocation);
  const [chainageStation, setChainageStation] = useState<string>('');

  // Active Monitoring Dataset
  const [dataset, setDataset] = useState<LocationMonitoringRecord>(() =>
    loadLocationMonitoringData(defaultProject, defaultLocation, defaultStructureType, '')
  );

  // Selected Instrument for Chart / Details Drilldown
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>('');

  // Modals for Adding New Instrument and New Reading
  const [isAddInstrumentOpen, setIsAddInstrumentOpen] = useState<boolean>(false);
  const [isAddReadingOpen, setIsAddReadingOpen] = useState<boolean>(false);
  const [targetInstrumentForReading, setTargetInstrumentForReading] = useState<InstalledInstrument | null>(null);

  // Save Toast
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Form states for New Instrument
  const [newInstTag, setNewInstTag] = useState<string>('');
  const [newInstType, setNewInstType] = useState<InstrumentType>('loadcell');
  const [newInstName, setNewInstName] = useState<string>('');
  const [newInstPosition, setNewInstPosition] = useState<InstrumentPosition>('crown');
  const [newInstInstallDate, setNewInstInstallDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newInstUnit, setNewInstUnit] = useState<string>('kN');
  const [newInstBaseline, setNewInstBaseline] = useState<number>(0.0);
  const [newInstAmber, setNewInstAmber] = useState<number>(180.0);
  const [newInstRed, setNewInstRed] = useState<number>(240.0);
  const [newInstModel, setNewInstModel] = useState<string>('');

  // Form states for New Reading
  const [readingDate, setReadingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [readingTime, setReadingTime] = useState<string>('10:00');
  const [readingValue, setReadingValue] = useState<string>('0.0');
  const [readingRecordedBy, setReadingRecordedBy] = useState<string>('');
  const [readingNotes, setReadingNotes] = useState<string>('Routine monitoring round');

  // Editable Sign-Off Names for Monitoring Report (blank by default)
  const [reportSignOff, setReportSignOff] = useState<{
    leadGeologistName: string;
    leadGeologistRole: string;
    residentEngineerName: string;
    residentEngineerRole: string;
  }>(() => {
    try {
      const raw = localStorage.getItem('eswa_tunnel_monitoring_signoff_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          leadGeologistName: parsed.leadGeologistName || '',
          leadGeologistRole: parsed.leadGeologistRole || '',
          residentEngineerName: parsed.residentEngineerName || '',
          residentEngineerRole: parsed.residentEngineerRole || '',
        };
      }
    } catch {
      // ignore
    }
    return {
      leadGeologistName: '',
      leadGeologistRole: '',
      residentEngineerName: '',
      residentEngineerRole: '',
    };
  });

  const updateReportSignOff = (
    field: 'leadGeologistName' | 'leadGeologistRole' | 'residentEngineerName' | 'residentEngineerRole',
    value: string
  ) => {
    setReportSignOff((prev) => {
      const next = { ...prev, [field]: value };
      try {
        localStorage.setItem('eswa_tunnel_monitoring_signoff_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };
  const [mpbxAnchorsInput, setMpbxAnchorsInput] = useState<{ depthM: number; displacementMm: number }[]>([
    { depthM: 2.0, displacementMm: 0.0 },
    { depthM: 4.0, displacementMm: 0.0 },
    { depthM: 7.0, displacementMm: 0.0 },
    { depthM: 10.0, displacementMm: 0.0 },
  ]);

  // Sync state when props change or project/location changes
  useEffect(() => {
    if (isOpen) {
      const data = loadLocationMonitoringData(selectedProject, selectedLocation, structureType, chainageStation);
      setDataset(data);
      if (data.instruments.length > 0 && !selectedInstrumentId) {
        setSelectedInstrumentId(data.instruments[0].id);
      }
    }
  }, [isOpen, selectedProject, selectedLocation, structureType]);

  // Persist dataset updates
  const handleUpdateDataset = (updated: LocationMonitoringRecord) => {
    setDataset(updated);
    saveLocationMonitoringData(updated);
    setSaveToast('Saved to storage');
    setTimeout(() => setSaveToast(null), 2000);
  };

  // Reset to realistic demo data
  const handleResetSampleData = () => {
    const fresh = createDefaultLocationDataset(selectedProject, selectedLocation, structureType, chainageStation);
    handleUpdateDataset(fresh);
    if (fresh.instruments.length > 0) {
      setSelectedInstrumentId(fresh.instruments[0].id);
    }
  };

  // Quick stats computed across all installed instruments
  const stats = useMemo(() => {
    const totalInst = dataset.instruments.length;
    let normalCount = 0;
    let amberCount = 0;
    let redCount = 0;
    let maxDisplacementMm = 0;
    let maxRateMmDay = 0;

    dataset.instruments.forEach((inst) => {
      const latest = inst.readings[inst.readings.length - 1];
      if (latest) {
        if (latest.alertLevel === 'RED') redCount++;
        else if (latest.alertLevel === 'AMBER') amberCount++;
        else normalCount++;

        const absDelta = Math.abs(latest.deltaFromBaseline);
        if (inst.unit === 'mm' && absDelta > maxDisplacementMm) {
          maxDisplacementMm = absDelta;
        }
        if (inst.unit === 'mm' && latest.ratePerDay > maxRateMmDay) {
          maxRateMmDay = latest.ratePerDay;
        }
      } else {
        normalCount++;
      }
    });

    const isStable = maxRateMmDay < 1.0;
    const isWarning = maxRateMmDay >= 1.0 && maxRateMmDay <= 3.0;
    const isCritical = maxRateMmDay > 3.0 || redCount > 0;

    return {
      totalInst,
      normalCount,
      amberCount,
      redCount,
      maxDisplacementMm,
      maxRateMmDay,
      stabilityStatus: isCritical ? 'CRITICAL (Accelerating)' : isWarning ? 'WARNING (Transient)' : 'STABLE (Arching Engaged)',
      statusColor: isCritical
        ? 'text-red-400 bg-red-950/70 border-red-500/60'
        : isWarning
        ? 'text-amber-400 bg-amber-950/70 border-amber-500/60'
        : 'text-emerald-400 bg-emerald-950/70 border-emerald-500/60',
    };
  }, [dataset]);

  // Selected Instrument Object
  const selectedInstrument = useMemo(() => {
    return dataset.instruments.find((i) => i.id === selectedInstrumentId) || dataset.instruments[0] || null;
  }, [dataset, selectedInstrumentId]);

  // Add New Instrument Handler
  const handleAddNewInstrumentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstTag.trim()) {
      setSaveToast('Please enter an Instrument ID / Tag (e.g., LC-02, MPBX-02)');
      setTimeout(() => setSaveToast(null), 3000);
      return;
    }

    const newInst: InstalledInstrument = {
      id: `inst-${Date.now()}`,
      instrumentId: newInstTag.trim(),
      type: newInstType,
      name: newInstName.trim() || `${INSTRUMENT_METADATA[newInstType].name} (${newInstTag.trim()})`,
      structureType,
      project: selectedProject,
      location: selectedLocation,
      chainageStation,
      position: newInstPosition,
      installDate: newInstInstallDate,
      unit: newInstUnit,
      baselineZero: Number(newInstBaseline) || 0.0,
      amberThreshold: Number(newInstAmber) || INSTRUMENT_METADATA[newInstType].defaultAmber,
      redThreshold: Number(newInstRed) || INSTRUMENT_METADATA[newInstType].defaultRed,
      manufacturerOrModel: newInstModel.trim() || undefined,
      status: 'ACTIVE',
      readings: [
        {
          id: `r-${Date.now()}`,
          readingDate: newInstInstallDate,
          readingTime: '09:00',
          daysSinceInstall: 0,
          value: Number(newInstBaseline) || 0.0,
          deltaFromBaseline: 0.0,
          ratePerDay: 0.0,
          recordedBy: 'Geotechnical Engineer',
          notes: 'Initial zero datum / baseline calibration',
          alertLevel: 'NORMAL',
        },
      ],
    };

    const nextDataset: LocationMonitoringRecord = {
      ...dataset,
      lastUpdated: new Date().toISOString(),
      instruments: [...dataset.instruments, newInst],
    };

    handleUpdateDataset(nextDataset);
    setSelectedInstrumentId(newInst.id);
    setIsAddInstrumentOpen(false);
    // Reset inputs
    setNewInstTag('');
    setNewInstName('');
  };

  // Open Add Reading Dialog for specific instrument
  const handleOpenAddReading = (inst: InstalledInstrument) => {
    setTargetInstrumentForReading(inst);
    setReadingDate(new Date().toISOString().split('T')[0]);
    setReadingTime('10:00');
    const last = inst.readings[inst.readings.length - 1];
    setReadingValue(last ? String(last.value) : String(inst.baselineZero));
    if (inst.type === 'mpbx') {
      const lastAnchors = last?.mpbxAnchorValues || [
        { depthM: 2.0, displacementMm: 0.0 },
        { depthM: 4.0, displacementMm: 0.0 },
        { depthM: 7.0, displacementMm: 0.0 },
        { depthM: 10.0, displacementMm: 0.0 },
      ];
      setMpbxAnchorsInput([...lastAnchors]);
    }
    setIsAddReadingOpen(true);
  };

  // Submit New Reading
  const handleAddReadingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetInstrumentForReading) return;

    const val = parseFloat(readingValue) || 0.0;
    const lastReading = targetInstrumentForReading.readings[targetInstrumentForReading.readings.length - 1];

    const prevDate = lastReading ? lastReading.readingDate : targetInstrumentForReading.installDate;
    const prevVal = lastReading ? lastReading.value : targetInstrumentForReading.baselineZero;
    const rate = computeRatePerDay(val, readingDate, prevVal, prevDate);
    const delta = Number((val - targetInstrumentForReading.baselineZero).toFixed(2));
    const alertLvl = computeAlertLevel(
      val,
      targetInstrumentForReading.baselineZero,
      targetInstrumentForReading.amberThreshold,
      targetInstrumentForReading.redThreshold
    );

    // Days since installation
    const t0 = new Date(targetInstrumentForReading.installDate).getTime();
    const t1 = new Date(readingDate).getTime();
    const days = Math.max(0, Math.round((t1 - t0) / (1000 * 60 * 60 * 24)));

    const newReading: InstrumentReading = {
      id: `r-${Date.now()}`,
      readingDate,
      readingTime,
      daysSinceInstall: days,
      value: val,
      deltaFromBaseline: delta,
      ratePerDay: rate,
      recordedBy: readingRecordedBy.trim() || 'Observer',
      notes: readingNotes.trim() || 'Periodic survey reading',
      alertLevel: alertLvl,
      mpbxAnchorValues: targetInstrumentForReading.type === 'mpbx' ? mpbxAnchorsInput : undefined,
    };

    const updatedInstruments = dataset.instruments.map((inst) => {
      if (inst.id === targetInstrumentForReading.id) {
        return {
          ...inst,
          readings: [...inst.readings, newReading],
        };
      }
      return inst;
    });

    handleUpdateDataset({
      ...dataset,
      lastUpdated: new Date().toISOString(),
      instruments: updatedInstruments,
    });

    setIsAddReadingOpen(false);
    setTargetInstrumentForReading(null);
  };

  // Delete Instrument
  const handleDeleteInstrument = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = dataset.instruments.filter((i) => i.id !== id);
    handleUpdateDataset({
      ...dataset,
      instruments: filtered,
    });
    if (selectedInstrumentId === id && filtered.length > 0) {
      setSelectedInstrumentId(filtered[0].id);
    }
  };

  // Delete Reading
  const handleDeleteReading = (instId: string, readingId: string) => {
    const updated = dataset.instruments.map((inst) => {
      if (inst.id === instId) {
        return {
          ...inst,
          readings: inst.readings.filter((r) => r.id !== readingId),
        };
      }
      return inst;
    });
    handleUpdateDataset({ ...dataset, instruments: updated });
  };

  // Export CSV
  const handleExportCsv = () => {
    const csvContent = exportMonitoringDataToCsv(dataset);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${dataset.location}_Geotechnical_Monitoring_Log.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dataset, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute('href', dataStr);
    dl.setAttribute('download', `${dataset.location}_Geotechnical_Monitoring.json`);
    document.body.appendChild(dl);
    dl.click();
    document.body.removeChild(dl);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950 flex flex-col w-screen h-[100dvh] overflow-hidden font-sans text-slate-100 select-none"
      style={{
        backgroundImage: `radial-gradient(circle at 50% 0%, ${palette?.primaryHex ? palette.primaryHex + '18' : 'rgba(245, 158, 11, 0.08)'} 0%, transparent 60%), radial-gradient(rgba(148, 163, 184, 0.09) 1px, transparent 1px)`,
        backgroundSize: '100% 100%, 24px 24px',
      }}
    >
      {/* Dynamic Theme Color Geological Map Backdrop Ambient Glow */}
      <div
        className="absolute inset-0 pointer-events-none select-none z-0 flex items-center justify-center overflow-hidden opacity-10"
        aria-hidden="true"
      >
        <div
          className="w-[600px] h-[600px] rounded-full blur-3xl pointer-events-none"
          style={{ backgroundColor: palette?.primaryHex || '#D97706' }}
        />
      </div>

      {/* ==================================================================== */}
      {/* 1. TOP HEADER & TITLE BAR (Dark CAD Rock Mechanics Theme)            */}
      {/* ==================================================================== */}
      <header
        className="h-14 px-4 flex items-center justify-between shrink-0 shadow-lg border-b border-slate-800/90 bg-slate-900/95 backdrop-blur-md transition-colors relative z-10"
        style={{
          borderBottomColor: palette?.accentHex ? `${palette.accentHex}40` : undefined,
        }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 hover:border-slate-500"
            title="Return to Main NATM Workspace"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            <span className="font-extrabold">NATM Window</span>
          </button>

          <div className="h-6 w-px bg-slate-700/60 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-black shrink-0 border ${
                isLight
                  ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              }`}
            >
              <Activity className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1
                  className={`text-sm sm:text-base font-black tracking-tight leading-none ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  Tunnel &amp; Shaft Monitoring Suite
                </h1>
                <span className="px-2 py-0.5 rounded text-[10.5px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider hidden sm:inline-block">
                  NATM Geotechnical Array
                </span>
              </div>
              <p className={`text-[11px] font-bold hidden md:block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Load Cells • Inclinometers • Piezometers • MPBX • Crackmeters • Tape Convergence • 3D Optical Prisms
              </p>
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {saveToast && (
            <span className="text-xs font-black text-emerald-300 bg-emerald-950/80 border border-emerald-500/60 px-2.5 py-1 rounded-md animate-fade-in flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-400" /> {saveToast}
            </span>
          )}

          <button
            type="button"
            onClick={() => handleUpdateDataset(dataset)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="font-extrabold">Save Data</span>
          </button>

          <button
            type="button"
            onClick={handleResetSampleData}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer shadow-xs ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Load realistic field instrumentation sample dataset"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-extrabold">Demo Sample</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer shadow-xs ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Print or Save PDF report"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline font-extrabold">Print Report</span>
          </button>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* 2. PROJECT, LOCATION & STRUCTURE SETUP BAR                           */}
      {/* ==================================================================== */}
      <div
        className={`px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0 border-b transition-colors ${
          isLight
            ? 'bg-slate-100 border-slate-300 text-slate-900'
            : 'bg-slate-950/90 border-slate-800 text-slate-100'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Structure Type: Tunnel vs Shaft */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => {
                setStructureType('tunnel');
                const next = loadLocationMonitoringData(selectedProject, selectedLocation, 'tunnel', chainageStation);
                setDataset(next);
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-black transition-all cursor-pointer ${
                structureType === 'tunnel'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tunnel
            </button>
            <button
              type="button"
              onClick={() => {
                setStructureType('vertical_shaft');
                const next = loadLocationMonitoringData(selectedProject, selectedLocation, 'vertical_shaft', chainageStation);
                setDataset(next);
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-black transition-all cursor-pointer ${
                structureType === 'vertical_shaft'
                  ? 'bg-cyan-400 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Vertical Shaft
            </button>
          </div>

          {/* Project Input / Selector */}
          <div
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 border shadow-2xs ${
              isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700'
            }`}
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-bold text-slate-400 uppercase text-[10px]">Project:</span>
            {availableProjects.length > 0 ? (
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className={`font-black text-xs bg-transparent border-none outline-hidden cursor-pointer ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                {availableProjects.map((p) => (
                  <option key={p} value={p} className={isLight ? 'text-slate-900 bg-white' : 'text-white bg-slate-900'}>
                    {p}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                placeholder="Enter Project Name..."
                className={`font-black text-xs bg-transparent border-none outline-hidden w-40 sm:w-48 ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              />
            )}
          </div>

          {/* Location Input / Selector */}
          <div
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 border shadow-2xs ${
              isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-bold text-slate-400 uppercase text-[10px]">Location:</span>
            {availableLocations.length > 0 ? (
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className={`font-black text-xs bg-transparent border-none outline-hidden cursor-pointer ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                {availableLocations.map((loc) => (
                  <option key={loc} value={loc} className={isLight ? 'text-slate-900 bg-white' : 'text-white bg-slate-900'}>
                    {loc}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                placeholder="Tunnel Heading / Shaft Name..."
                className={`font-black text-xs bg-transparent border-none outline-hidden w-44 sm:w-56 ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              />
            )}
          </div>

          {/* Chainage / Station Input */}
          <div
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 border shadow-2xs ${
              isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700'
            }`}
          >
            <span className="font-bold text-slate-400 uppercase text-[10px]">
              {structureType === 'tunnel' ? 'Station / Ch:' : 'Depth / RL:'}
            </span>
            <input
              type="text"
              value={chainageStation}
              onChange={(e) => {
                setChainageStation(e.target.value);
                setDataset((prev) => ({ ...prev, chainageStation: e.target.value }));
              }}
              placeholder={structureType === 'tunnel' ? 'e.g. Ch 14+240.00' : 'e.g. Depth -45.0m'}
              className={`font-black text-xs bg-transparent border-none outline-hidden w-28 font-mono ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}
            />
          </div>
        </div>

        {/* Live Stability Status Badge */}
        <div className="flex items-center gap-2">
          <div className={`px-2.5 py-1 rounded-lg border text-xs font-black flex items-center gap-1.5 shadow-2xs ${stats.statusColor}`}>
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            <span>{stats.stabilityStatus}</span>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. WORKSPACE TAB NAVIGATION                                         */}
      {/* ==================================================================== */}
      <div
        className={`px-4 py-1.5 flex items-center justify-between gap-2 overflow-x-auto shrink-0 shadow-xs border-b transition-colors ${
          isLight ? 'bg-white border-slate-300' : 'bg-slate-900/90 border-slate-800'
        }`}
      >
        <div className="flex items-center gap-2 min-w-max">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                : isLight
                ? 'bg-slate-100 text-slate-700 border-slate-300 hover:text-slate-900'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
            }`}
          >
            <Gauge className={`w-3.5 h-3.5 ${activeTab === 'overview' ? 'text-slate-950' : 'text-amber-400'}`} />
            <span>1. Overview &amp; Cross-Section</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('log')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === 'log'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                : isLight
                ? 'bg-slate-100 text-slate-700 border-slate-300 hover:text-slate-900'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
            }`}
          >
            <FileSpreadsheet className={`w-3.5 h-3.5 ${activeTab === 'log' ? 'text-slate-950' : 'text-emerald-400'}`} />
            <span>2. Installed Instruments &amp; Readings</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'log' ? 'bg-slate-950 text-amber-300' : 'bg-emerald-950 text-emerald-300'
              }`}
            >
              {dataset.instruments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('graphs')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === 'graphs'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                : isLight
                ? 'bg-slate-100 text-slate-700 border-slate-300 hover:text-slate-900'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
            }`}
          >
            <TrendingUp className={`w-3.5 h-3.5 ${activeTab === 'graphs' ? 'text-slate-950' : 'text-cyan-400'}`} />
            <span>3. Time-Series Graphs &amp; Velocity</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('report')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === 'report'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                : isLight
                ? 'bg-slate-100 text-slate-700 border-slate-300 hover:text-slate-900'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
            }`}
          >
            <FileText className={`w-3.5 h-3.5 ${activeTab === 'report' ? 'text-slate-950' : 'text-purple-400'}`} />
            <span>4. Geotechnical Summary Report</span>
          </button>
        </div>

        {/* Quick Add Instrument Button */}
        <button
          type="button"
          onClick={() => {
            setNewInstType('loadcell');
            setNewInstTag(`INST-${dataset.instruments.length + 1}`);
            setNewInstName('');
            setIsAddInstrumentOpen(true);
          }}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add New Instrument</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* 4. MAIN CONTENT WORKSPACE                                            */}
      {/* ==================================================================== */}
      <main
        className={`flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col relative transition-colors ${
          isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'
        }`}
      >
        {/* Subtle Architectural CAD Grid Backdrop */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" aria-hidden="true">
          <defs>
            <pattern id="monitoringDarkGrid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#64748B" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#monitoringDarkGrid)" />
        </svg>

        {/* ================================================================== */}
        {/* TAB 1: OVERVIEW & CROSS-SECTION SENSOR MAP                         */}
        {/* ================================================================== */}
        {activeTab === 'overview' && (
          <div className="max-w-7xl mx-auto w-full space-y-4 relative z-10">
            {/* Quick KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <div
                className={`p-3 rounded-xl border shadow-xs space-y-1 ${
                  isLight ? 'bg-white border-slate-300' : 'bg-slate-900/90 border-slate-800'
                }`}
              >
                <span className="text-[10px] font-black uppercase text-slate-400">Total Installed</span>
                <div className={`text-xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {stats.totalInst} Units
                </div>
                <span className="text-[10px] text-slate-400 font-bold">In Section {chainageStation}</span>
              </div>

              <div
                className={`p-3 rounded-xl border shadow-xs space-y-1 ${
                  isLight ? 'bg-emerald-50 border-emerald-300' : 'bg-emerald-950/40 border-emerald-500/40'
                }`}
              >
                <span className="text-[10px] font-black uppercase text-emerald-400">Normal (Green)</span>
                <div className="text-xl font-black text-emerald-400">{stats.normalCount} Normal</div>
                <span className="text-[10px] text-emerald-400/80 font-bold">Within Allowable</span>
              </div>

              <div
                className={`p-3 rounded-xl border shadow-xs space-y-1 ${
                  isLight ? 'bg-amber-50 border-amber-300' : 'bg-amber-950/40 border-amber-500/40'
                }`}
              >
                <span className="text-[10px] font-black uppercase text-amber-400">Warning (Amber)</span>
                <div className="text-xl font-black text-amber-400">{stats.amberCount} Alert</div>
                <span className="text-[10px] text-amber-400/80 font-bold">Heightened Trend</span>
              </div>

              <div
                className={`p-3 rounded-xl border shadow-xs space-y-1 ${
                  isLight ? 'bg-red-50 border-red-300' : 'bg-red-950/40 border-red-500/40'
                }`}
              >
                <span className="text-[10px] font-black uppercase text-red-400">Action (Red)</span>
                <div className="text-xl font-black text-red-400">{stats.redCount} Critical</div>
                <span className="text-[10px] text-red-400/80 font-bold">TARP Action Required</span>
              </div>

              <div
                className={`p-3 rounded-xl border shadow-xs space-y-1 ${
                  isLight ? 'bg-white border-slate-300' : 'bg-slate-900/90 border-slate-800'
                }`}
              >
                <span className="text-[10px] font-black uppercase text-slate-400">Max Deformation</span>
                <div className="text-xl font-black text-cyan-400">{stats.maxDisplacementMm.toFixed(1)} mm</div>
                <span className="text-[10px] text-slate-400 font-bold">Total Wall / Crown</span>
              </div>

              <div
                className={`p-3 rounded-xl border shadow-xs space-y-1 ${
                  isLight ? 'bg-white border-slate-300' : 'bg-slate-900/90 border-slate-800'
                }`}
              >
                <span className="text-[10px] font-black uppercase text-slate-400">Current Velocity</span>
                <div className={`text-xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {stats.maxRateMmDay.toFixed(2)} mm/d
                </div>
                <span className="text-[10px] text-slate-400 font-bold">&lt; 1.0 mm/d = Stable</span>
              </div>
            </div>

            {/* Main Interactive CAD Cross-Section & Sensor Placement Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* CAD Cross-Section Canvas View */}
              <div
                className={`lg:col-span-7 rounded-xl border p-4 shadow-md flex flex-col justify-between ${
                  isLight ? 'bg-white border-slate-300' : 'bg-slate-900/90 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div>
                    <h2 className="text-sm font-black text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                      <Compass className="w-4 h-4 text-amber-400" />
                      <span>
                        {structureType === 'tunnel'
                          ? '2D CAD Tunnel Cross-Section & Sensor Layout'
                          : 'Circular Vertical Shaft Perimeter & Sensor Layout'}
                      </span>
                    </h2>
                    <p className="text-xs font-bold text-slate-400">
                      Click any sensor pin on the profile to inspect real-time readings and threshold status.
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-slate-950 text-cyan-400 font-mono text-[10px] font-black border border-slate-800">
                    {chainageStation}
                  </span>
                </div>

                {/* SVG CAD Profile Diagram */}
                <div className="relative w-full h-80 my-2 bg-slate-950 rounded-xl border-2 border-slate-800 overflow-hidden flex items-center justify-center p-3 select-none">
                  {/* Technical CAD Grid Background */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
                    <defs>
                      <pattern id="cadGridMonitorDark" width="24" height="24" patternUnits="userSpaceOnUse">
                        <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#475569" strokeWidth="0.5" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#cadGridMonitorDark)" />
                  </svg>

                  {structureType === 'tunnel' ? (
                    // Horseshoe Tunnel Profile SVG
                    <svg viewBox="0 0 400 320" className="w-full h-full relative z-10">
                      {/* Tunnel Center Axis */}
                      <line x1="200" y1="20" x2="200" y2="300" stroke="#475569" strokeWidth="1" strokeDasharray="4 4" />
                      <line x1="40" y1="210" x2="360" y2="210" stroke="#475569" strokeWidth="1" strokeDasharray="4 4" />

                      {/* Rock Mass Surroundings */}
                      <path
                        d="M 50 300 L 70 210 A 130 130 0 0 1 330 210 L 350 300 Z"
                        fill="none"
                        stroke="#0EA5E9"
                        strokeWidth="8"
                        strokeLinejoin="round"
                        className="opacity-70"
                      />

                      {/* Primary Shotcrete Arch */}
                      <path
                        d="M 58 296 L 76 210 A 124 124 0 0 1 324 210 L 342 296 Z"
                        fill="#020617"
                        stroke="#F59E0B"
                        strokeWidth="3"
                        strokeLinejoin="round"
                      />

                      {/* Invert Floor */}
                      <line x1="58" y1="296" x2="342" y2="296" stroke="#F59E0B" strokeWidth="3" />

                      {/* Convergence Eye-Pins (A-B & B-C lines) */}
                      <line x1="90" y1="180" x2="310" y2="180" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 3" />
                      <line x1="200" y1="88" x2="100" y2="280" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 3" />
                      <line x1="200" y1="88" x2="300" y2="280" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 3" />
                      <text x="200" y="175" fill="#38BDF8" fontSize="10" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                        Optical Convergence Chord
                      </text>

                      {/* Sensor Pin Icons Plotted by Position */}
                      {dataset.instruments.map((inst) => {
                        let cx = 200;
                        let cy = 88;
                        let labelOffset = { x: 0, y: -14 };

                        if (inst.position === 'crown') {
                          cx = 200;
                          cy = 88;
                          labelOffset = { x: 0, y: -12 };
                        } else if (inst.position === 'left_shoulder') {
                          cx = 120;
                          cy = 135;
                          labelOffset = { x: -25, y: -10 };
                        } else if (inst.position === 'right_shoulder') {
                          cx = 280;
                          cy = 135;
                          labelOffset = { x: 25, y: -10 };
                        } else if (inst.position === 'left_wall') {
                          cx = 76;
                          cy = 220;
                          labelOffset = { x: -28, y: 0 };
                        } else if (inst.position === 'right_wall') {
                          cx = 324;
                          cy = 220;
                          labelOffset = { x: 28, y: 0 };
                        } else if (inst.position === 'invert') {
                          cx = 200;
                          cy = 296;
                          labelOffset = { x: 0, y: 14 };
                        }

                        const isSelected = inst.id === selectedInstrumentId;
                        const latestReading = inst.readings[inst.readings.length - 1];
                        const alertColor =
                          latestReading?.alertLevel === 'RED'
                            ? '#EF4444'
                            : latestReading?.alertLevel === 'AMBER'
                            ? '#F59E0B'
                            : '#10B981';

                        return (
                          <g
                            key={inst.id}
                            onClick={() => setSelectedInstrumentId(inst.id)}
                            className="cursor-pointer transition-transform hover:scale-110"
                          >
                            <circle
                              cx={cx}
                              cy={cy}
                              r={isSelected ? 14 : 9}
                              fill={alertColor}
                              fillOpacity={isSelected ? 0.45 : 0.25}
                              stroke={alertColor}
                              strokeWidth={isSelected ? 2.5 : 1.5}
                              className={isSelected ? 'animate-pulse' : ''}
                            />
                            <circle cx={cx} cy={cy} r={isSelected ? 6 : 4} fill={alertColor} />
                            <text
                              x={cx + labelOffset.x}
                              y={cy + labelOffset.y}
                              textAnchor="middle"
                              fill={isSelected ? '#F8FAFC' : '#CBD5E1'}
                              fontSize={isSelected ? '11' : '9.5'}
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              {inst.instrumentId}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  ) : (
                    // Circular Vertical Shaft SVG
                    <svg viewBox="0 0 360 320" className="w-full h-full relative z-10">
                      <circle cx="180" cy="160" r="130" fill="none" stroke="#0EA5E9" strokeWidth="8" className="opacity-70" />
                      <circle cx="180" cy="160" r="118" fill="#020617" stroke="#F59E0B" strokeWidth="3" />
                      <line x1="180" y1="30" x2="180" y2="290" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1="50" y1="160" x2="310" y2="160" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
                      <text x="180" y="155" fill="#38BDF8" fontSize="11" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                        SHAFT SECTION
                      </text>
                      <text x="180" y="172" fill="#94A3B8" fontSize="9" textAnchor="middle" fontFamily="monospace">
                        {chainageStation}
                      </text>

                      {dataset.instruments.map((inst, idx) => {
                        const total = dataset.instruments.length;
                        const angle = (idx / Math.max(1, total)) * 2 * Math.PI - Math.PI / 2;
                        const cx = 180 + 118 * Math.cos(angle);
                        const cy = 160 + 118 * Math.sin(angle);
                        const isSelected = inst.id === selectedInstrumentId;
                        const latestReading = inst.readings[inst.readings.length - 1];
                        const alertColor =
                          latestReading?.alertLevel === 'RED'
                            ? '#EF4444'
                            : latestReading?.alertLevel === 'AMBER'
                            ? '#F59E0B'
                            : '#10B981';

                        return (
                          <g
                            key={inst.id}
                            onClick={() => setSelectedInstrumentId(inst.id)}
                            className="cursor-pointer transition-transform hover:scale-110"
                          >
                            <circle
                              cx={cx}
                              cy={cy}
                              r={isSelected ? 14 : 9}
                              fill={alertColor}
                              fillOpacity={isSelected ? 0.45 : 0.25}
                              stroke={alertColor}
                              strokeWidth={isSelected ? 2.5 : 1.5}
                              className={isSelected ? 'animate-pulse' : ''}
                            />
                            <circle cx={cx} cy={cy} r={isSelected ? 6 : 4} fill={alertColor} />
                            <text
                              x={cx + (Math.cos(angle) * 22)}
                              y={cy + (Math.sin(angle) * 16) + 4}
                              textAnchor="middle"
                              fill={isSelected ? '#F8FAFC' : '#CBD5E1'}
                              fontSize={isSelected ? '11' : '9.5'}
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              {inst.instrumentId}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Normal (&lt; Amber)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Amber Alert
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Red Critical
                    </span>
                  </div>
                  <span className="text-slate-500 font-mono text-[10px]">Scale 1:50 True Geometry</span>
                </div>
              </div>

              {/* Selected Sensor Quick Inspection Panel */}
              <div
                className={`lg:col-span-5 rounded-xl border p-4 shadow-md flex flex-col justify-between ${
                  isLight ? 'bg-white border-slate-300' : 'bg-slate-900/90 border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-black uppercase text-slate-400">Selected Sensor Details</span>
                    {selectedInstrument && (
                      <span
                        className={`px-2 py-0.5 rounded text-[10.5px] font-black border ${
                          isLight
                            ? INSTRUMENT_METADATA[selectedInstrument.type]?.badgeColor
                            : 'bg-slate-950 text-amber-300 border-amber-500/50'
                        }`}
                      >
                        {selectedInstrument.type.toUpperCase()}
                      </span>
                    )}
                  </div>

                  {selectedInstrument ? (
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="text-lg font-black text-amber-400 flex items-center justify-between">
                          <span>{selectedInstrument.instrumentId}</span>
                          <span className="text-xs font-mono text-slate-400">
                            {SENSOR_POSITION_LABELS[selectedInstrument.position]}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-300">{selectedInstrument.name}</div>
                      </div>

                      {/* Latest Reading Highlights */}
                      {(() => {
                        const latest = selectedInstrument.readings[selectedInstrument.readings.length - 1];
                        return (
                          <div
                            className={`p-3 rounded-xl border space-y-2 ${
                              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10.5px] font-black uppercase text-slate-400">Latest Reading</span>
                              <span className="text-[10.5px] font-mono text-cyan-400 font-bold">
                                {latest?.readingDate} ({latest ? `D+${latest.daysSinceInstall}` : 'N/A'})
                              </span>
                            </div>

                            <div className="flex items-baseline justify-between">
                              <div className="text-2xl font-black text-white">
                                {latest ? latest.value.toFixed(1) : selectedInstrument.baselineZero.toFixed(1)}{' '}
                                <span className="text-sm font-bold text-slate-400">{selectedInstrument.unit}</span>
                              </div>

                              <div className="text-right">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Baseline Delta</span>
                                <span
                                  className={`text-sm font-black font-mono ${
                                    latest && latest.deltaFromBaseline > selectedInstrument.amberThreshold
                                      ? 'text-amber-400'
                                      : 'text-emerald-400'
                                  }`}
                                >
                                  {latest ? `${latest.deltaFromBaseline >= 0 ? '+' : ''}${latest.deltaFromBaseline.toFixed(1)}` : '0.0'}{' '}
                                  {selectedInstrument.unit}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800 text-xs">
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block">Velocity</span>
                                <span className="font-mono font-bold text-slate-200">
                                  {latest ? `${latest.ratePerDay.toFixed(2)} ${selectedInstrument.unit}/day` : '0.00'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block">TARP Trigger</span>
                                <span
                                  className={`font-mono font-black text-xs ${
                                    latest?.alertLevel === 'RED'
                                      ? 'text-red-400'
                                      : latest?.alertLevel === 'AMBER'
                                      ? 'text-amber-400'
                                      : 'text-emerald-400'
                                  }`}
                                >
                                  {latest ? latest.alertLevel : 'NORMAL'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Threshold Ranges */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div
                          className={`p-2.5 rounded-lg border ${
                            isLight
                              ? 'bg-amber-50 border-amber-300 text-amber-950'
                              : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                          }`}
                        >
                          <span className="text-[10px] font-black uppercase block">Amber Warning Limit</span>
                          <span className="font-mono font-bold text-sm">
                            &gt; {selectedInstrument.amberThreshold} {selectedInstrument.unit}
                          </span>
                        </div>
                        <div
                          className={`p-2.5 rounded-lg border ${
                            isLight
                              ? 'bg-red-50 border-red-300 text-red-950'
                              : 'bg-red-950/30 border-red-500/40 text-red-300'
                          }`}
                        >
                          <span className="text-[10px] font-black uppercase block">Red Action Limit</span>
                          <span className="font-mono font-bold text-sm">
                            &gt; {selectedInstrument.redThreshold} {selectedInstrument.unit}
                          </span>
                        </div>
                      </div>

                      {/* MPBX Multi-Anchor Breakdown if applicable */}
                      {selectedInstrument.type === 'mpbx' && (() => {
                        const latest = selectedInstrument.readings[selectedInstrument.readings.length - 1];
                        const anchors = latest?.mpbxAnchorValues || [];
                        if (anchors.length === 0) return null;
                        return (
                          <div
                            className={`p-2.5 rounded-lg border space-y-1 ${
                              isLight
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                                : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                            }`}
                          >
                            <span className="text-[10px] font-black uppercase block">
                              MPBX Deep Anchor Radial Displacement
                            </span>
                            <div className="grid grid-cols-4 gap-1 text-center font-mono text-[11px]">
                              {anchors.map((a) => (
                                <div
                                  key={a.depthM}
                                  className={`p-1 rounded border ${
                                    isLight
                                      ? 'bg-white border-emerald-200'
                                      : 'bg-slate-900 border-emerald-500/30'
                                  }`}
                                >
                                  <div className="text-[9.5px] text-slate-400 font-bold">{a.depthM}m Depth</div>
                                  <div className="font-black text-emerald-400">{a.displacementMm}mm</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs font-bold text-slate-500">
                      No instruments installed yet. Click &quot;Add New Instrument&quot; to begin.
                    </div>
                  )}
                </div>

                {selectedInstrument && (
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleOpenAddReading(selectedInstrument)}
                      className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5 text-white" />
                      <span>Log Reading for {selectedInstrument.instrumentId}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('graphs')}
                      className={`py-2 px-3 rounded-lg text-xs font-black border flex items-center gap-1 cursor-pointer ${
                        isLight
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                    >
                      <span>Graph →</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 2: INSTALLED INSTRUMENTS & READINGS LOG                         */}
        {/* ================================================================== */}
        {activeTab === 'log' && (
          <div className="max-w-7xl mx-auto w-full space-y-4 relative z-10">
            <div
              className={`rounded-xl border p-4 space-y-4 shadow-md ${
                isLight ? 'bg-white border-slate-300' : 'bg-slate-900/90 border-slate-800'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-black text-amber-400 flex items-center gap-2">
                    <span>Installed Instruments in {selectedLocation}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/50 font-black">
                      {dataset.instruments.length} Units Active
                    </span>
                  </h2>
                  <p className="text-xs font-bold text-slate-400">
                    Track loadcells, extensometers, piezometers, crackmeters, and inclinometers with calibrated baselines and TARP limits.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black border flex items-center gap-1.5 cursor-pointer shadow-xs ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                    title="Export all readings to CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewInstType('loadcell');
                      setNewInstTag(`INST-${dataset.instruments.length + 1}`);
                      setNewInstName('');
                      setIsAddInstrumentOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New Instrument</span>
                  </button>
                </div>
              </div>

              {/* Table of Instruments */}
              <div className="border border-slate-800 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10.5px] border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">Tag ID</th>
                        <th className="p-2.5">Instrument Type</th>
                        <th className="p-2.5">Position</th>
                        <th className="p-2.5">Install Date</th>
                        <th className="p-2.5">Baseline Zero</th>
                        <th className="p-2.5">Latest Reading</th>
                        <th className="p-2.5">Delta (Δ)</th>
                        <th className="p-2.5">Velocity (Rate/day)</th>
                        <th className="p-2.5">TARP Status</th>
                        <th className="p-2.5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                      {dataset.instruments.map((inst) => {
                        const latest = inst.readings[inst.readings.length - 1];
                        const isSelected = inst.id === selectedInstrumentId;

                        return (
                          <tr
                            key={inst.id}
                            onClick={() => setSelectedInstrumentId(inst.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-amber-500/15 font-semibold text-white'
                                : 'hover:bg-slate-800/60 text-slate-300'
                            }`}
                          >
                            <td className="p-2.5 font-mono font-black text-amber-400 whitespace-nowrap">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                {inst.instrumentId}
                              </span>
                            </td>
                            <td className="p-2.5 font-bold">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black border bg-slate-950 text-cyan-300 border-cyan-500/40">
                                {INSTRUMENT_METADATA[inst.type]?.name || inst.type}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-300 font-bold whitespace-nowrap">
                              {SENSOR_POSITION_LABELS[inst.position] || inst.position}
                            </td>
                            <td className="p-2.5 font-mono text-slate-400">{inst.installDate}</td>
                            <td className="p-2.5 font-mono text-slate-300">
                              {inst.baselineZero} {inst.unit}
                            </td>
                            <td className="p-2.5 font-mono font-black text-white">
                              {latest ? `${latest.value.toFixed(1)} ${inst.unit}` : 'None'}
                            </td>
                            <td className="p-2.5 font-mono font-black text-cyan-400">
                              {latest ? `${latest.deltaFromBaseline >= 0 ? '+' : ''}${latest.deltaFromBaseline.toFixed(1)} ${inst.unit}` : '0.0'}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-slate-200">
                              {latest ? `${latest.ratePerDay.toFixed(2)} ${inst.unit}/d` : '0.00'}
                            </td>
                            <td className="p-2.5">
                              <span
                                className={`px-2 py-0.5 rounded font-mono font-black text-[10.5px] border ${
                                  latest?.alertLevel === 'RED'
                                    ? 'bg-red-950 text-red-400 border-red-500/60'
                                    : latest?.alertLevel === 'AMBER'
                                    ? 'bg-amber-950 text-amber-400 border-amber-500/60'
                                    : 'bg-emerald-950 text-emerald-400 border-emerald-500/60'
                                }`}
                              >
                                {latest ? latest.alertLevel : 'NORMAL'}
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddReading(inst)}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[10.5px] font-black flex items-center gap-1 cursor-pointer border border-emerald-500/40"
                                  title="Add new reading"
                                >
                                  <Plus className="w-3 h-3 text-emerald-400" />
                                  <span>Log</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteInstrument(inst.id, e)}
                                  className="p-1 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800 cursor-pointer"
                                  title="Delete instrument"
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

              {/* Readings History for Selected Instrument */}
              {selectedInstrument && (
                <div
                  className={`mt-4 p-4 rounded-xl border space-y-3 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-amber-400 flex items-center gap-2">
                        <span>Measurement Reading History: {selectedInstrument.instrumentId}</span>
                        <span className="text-xs font-mono text-slate-400">
                          ({selectedInstrument.name} • Position: {SENSOR_POSITION_LABELS[selectedInstrument.position]})
                        </span>
                      </h3>
                      <p className="text-[11px] font-bold text-slate-400">
                        Baseline Zero: {selectedInstrument.baselineZero} {selectedInstrument.unit} • Amber Limit: &gt;{selectedInstrument.amberThreshold} {selectedInstrument.unit} • Red Limit: &gt;{selectedInstrument.redThreshold} {selectedInstrument.unit}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenAddReading(selectedInstrument)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log New Reading</span>
                    </button>
                  </div>

                  <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/80">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                        <tr>
                          <th className="p-2">Date / Time</th>
                          <th className="p-2">Days Since Install</th>
                          <th className="p-2">Measured Value</th>
                          <th className="p-2">Delta from Zero</th>
                          <th className="p-2">Rate of Movement</th>
                          <th className="p-2">Observer</th>
                          <th className="p-2">Field Notes</th>
                          <th className="p-2">Status</th>
                          <th className="p-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {selectedInstrument.readings.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-800/50">
                            <td className="p-2 font-bold text-white whitespace-nowrap">
                              {r.readingDate} {r.readingTime ? `@ ${r.readingTime}` : ''}
                            </td>
                            <td className="p-2 font-mono font-bold text-slate-300">D+{r.daysSinceInstall}</td>
                            <td className="p-2 font-mono font-black text-white">
                              {r.value} {selectedInstrument.unit}
                            </td>
                            <td className="p-2 font-mono font-black text-cyan-400">
                              {r.deltaFromBaseline >= 0 ? '+' : ''}
                              {r.deltaFromBaseline} {selectedInstrument.unit}
                            </td>
                            <td className="p-2 font-mono font-bold text-slate-200">
                              {r.ratePerDay} {selectedInstrument.unit}/d
                            </td>
                            <td className="p-2 text-slate-300">{r.recordedBy}</td>
                            <td className="p-2 text-slate-400 max-w-xs truncate">{r.notes}</td>
                            <td className="p-2">
                              <span
                                className={`px-1.5 py-0.2 rounded font-mono font-black text-[9.5px] border ${
                                  r.alertLevel === 'RED'
                                    ? 'bg-red-950 text-red-400 border-red-500/60'
                                    : r.alertLevel === 'AMBER'
                                    ? 'bg-amber-950 text-amber-400 border-amber-500/60'
                                    : 'bg-emerald-950 text-emerald-400 border-emerald-500/60'
                                }`}
                              >
                                {r.alertLevel}
                              </span>
                            </td>
                            <td className="p-2 text-center">
                              {selectedInstrument.readings.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteReading(selectedInstrument.id, r.id)}
                                  className="text-slate-500 hover:text-red-400 p-0.5 cursor-pointer"
                                  title="Delete reading"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 3: TIME-SERIES GRAPHS & VELOCITY CURVES                        */}
        {/* ================================================================== */}
        {activeTab === 'graphs' && (
          <div className="max-w-6xl mx-auto w-full space-y-4 relative z-10">
            <div
              className={`rounded-xl border p-4 sm:p-5 space-y-4 shadow-md ${
                isLight ? 'bg-white border-slate-300' : 'bg-slate-900/90 border-slate-800'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-black text-amber-400 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>Time-Displacement History &amp; Velocity Attenuation</span>
                  </h2>
                  <p className="text-xs font-bold text-slate-400">
                    Observation of deformation vs. time verifies NATM ground-lining equilibrium and stabilization velocity (&lt; 1.0 mm/day).
                  </p>
                </div>

                {/* Instrument Filter for Graphs */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-400 uppercase">Instrument:</span>
                  <select
                    value={selectedInstrumentId}
                    onChange={(e) => setSelectedInstrumentId(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-cyan-300 font-black text-xs cursor-pointer focus:border-amber-400 outline-hidden"
                  >
                    {dataset.instruments.map((inst) => (
                      <option key={inst.id} value={inst.id} className="bg-slate-900 text-white">
                        {inst.instrumentId} — {inst.name} ({inst.unit})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedInstrument && (
                <>
                  {/* SVG Chart 1: Time vs Measured Value & Baseline Delta with Amber/Red Thresholds */}
                  <div className="border border-slate-800 rounded-xl p-4 bg-slate-950 shadow-inner space-y-2">
                    <div className="flex flex-wrap items-center justify-between text-[11px] font-mono font-bold text-white gap-2">
                      <span className="uppercase text-amber-400">
                        {selectedInstrument.instrumentId} TIME-SERIES TREND ({selectedInstrument.name})
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Measured Value
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-0.5 bg-amber-400" /> Amber Limit ({selectedInstrument.amberThreshold}{' '}
                          {selectedInstrument.unit})
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-0.5 bg-red-500" /> Red Limit ({selectedInstrument.redThreshold}{' '}
                          {selectedInstrument.unit})
                        </span>
                      </div>
                    </div>

                    <div className="relative w-full overflow-hidden">
                      {(() => {
                        const readings = selectedInstrument.readings;
                        if (readings.length === 0) {
                          return <div className="p-8 text-center text-slate-500 text-xs font-bold">No readings recorded yet.</div>;
                        }

                        // Determine Y scale
                        const maxVal = Math.max(
                          selectedInstrument.redThreshold * 1.15,
                          ...readings.map((r) => r.value),
                          selectedInstrument.baselineZero * 1.2
                        );
                        const minVal = Math.min(0, ...readings.map((r) => r.value));
                        const range = Math.max(1, maxVal - minVal);

                        const W = 700;
                        const H = 220;
                        const padX = 60;
                        const padY = 25;
                        const chartW = W - padX - 30;
                        const chartH = H - padY - 35;

                        const getY = (val: number) => padY + chartH - ((val - minVal) / range) * chartH;
                        const getX = (idx: number) => padX + (idx / Math.max(1, readings.length - 1)) * chartW;

                        const points = readings.map((r, i) => `${getX(i)},${getY(r.value)}`).join(' ');
                        const amberY = getY(selectedInstrument.amberThreshold);
                        const redY = getY(selectedInstrument.redThreshold);
                        const baselineY = getY(selectedInstrument.baselineZero);

                        return (
                          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-slate-950 rounded border border-slate-800">
                            {/* Grid Horizontal Lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                              const y = padY + chartH * (1 - pct);
                              const v = minVal + range * pct;
                              return (
                                <g key={pct}>
                                  <line x1={padX} y1={y} x2={W - 30} y2={y} stroke="#334155" strokeWidth="0.75" />
                                  <text x={padX - 8} y={y + 3.5} textAnchor="end" fill="#94A3B8" fontSize="9" fontWeight="800" fontFamily="monospace">
                                    {v.toFixed(1)}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Threshold Lines */}
                            {amberY >= padY && amberY <= padY + chartH && (
                              <line
                                x1={padX}
                                y1={amberY}
                                x2={W - 30}
                                y2={amberY}
                                stroke="#F59E0B"
                                strokeWidth="1.5"
                                strokeDasharray="5 3"
                              />
                            )}
                            {redY >= padY && redY <= padY + chartH && (
                              <line
                                x1={padX}
                                y1={redY}
                                x2={W - 30}
                                y2={redY}
                                stroke="#EF4444"
                                strokeWidth="1.5"
                                strokeDasharray="5 3"
                              />
                            )}
                            {/* Baseline Zero Line */}
                            <line
                              x1={padX}
                              y1={baselineY}
                              x2={W - 30}
                              y2={baselineY}
                              stroke="#64748B"
                              strokeWidth="1.5"
                              strokeDasharray="2 2"
                            />

                            {/* Measured Trend Polyline */}
                            <polyline fill="none" stroke="#10B981" strokeWidth="3" points={points} />

                            {/* Data points */}
                            {readings.map((r, i) => {
                              const cx = getX(i);
                              const cy = getY(r.value);
                              return (
                                <g key={r.id}>
                                  <circle cx={cx} cy={cy} r="4.5" fill="#10B981" stroke="#000000" strokeWidth="1.5" />
                                  <text
                                    x={cx}
                                    y={H - 12}
                                    textAnchor="middle"
                                    fill="#94A3B8"
                                    fontSize="8.5"
                                    fontWeight="bold"
                                    fontFamily="monospace"
                                  >
                                    D+{r.daysSinceInstall}
                                  </text>
                                  <text
                                    x={cx}
                                    y={cy - 8}
                                    textAnchor="middle"
                                    fill="#FFFFFF"
                                    fontSize="8.5"
                                    fontWeight="black"
                                    fontFamily="monospace"
                                  >
                                    {r.value.toFixed(1)}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                        );
                      })()}
                    </div>
                  </div>

                  {/* SVG Chart 2: Velocity Rate of Movement (mm/day or kN/day) */}
                  <div className="border border-slate-800 rounded-xl p-4 bg-slate-950 shadow-inner space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono font-bold text-white">
                      <span className="uppercase text-cyan-400">
                        DEFORMATION VELOCITY ATTENUATION (ΔV / ΔT RATE PER DAY)
                      </span>
                      <span className="text-[10.5px] text-emerald-400">
                        Target: Rate &lt; 1.0 {selectedInstrument.unit}/day (Stable Equilibrium)
                      </span>
                    </div>

                    <div className="relative w-full overflow-hidden">
                      {(() => {
                        const readings = selectedInstrument.readings;
                        const maxRate = Math.max(5.0, ...readings.map((r) => r.ratePerDay));

                        const W = 700;
                        const H = 160;
                        const padX = 60;
                        const padY = 20;
                        const chartW = W - padX - 30;
                        const chartH = H - padY - 30;

                        const getY = (val: number) => padY + chartH - (val / maxRate) * chartH;
                        const getX = (idx: number) => padX + (idx / Math.max(1, readings.length - 1)) * chartW;
                        const points = readings.map((r, i) => `${getX(i)},${getY(r.ratePerDay)}`).join(' ');

                        return (
                          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-slate-950 rounded border border-slate-800">
                            {/* Allowable 1.0 boundary line */}
                            <line
                              x1={padX}
                              y1={getY(1.0)}
                              x2={W - 30}
                              y2={getY(1.0)}
                              stroke="#10B981"
                              strokeWidth="1.5"
                              strokeDasharray="4 2"
                            />
                            <text x={W - 25} y={getY(1.0) + 3} fill="#10B981" fontSize="9" fontWeight="bold">
                              1.0 Limit
                            </text>

                            {/* Warning 3.0 boundary line */}
                            <line
                              x1={padX}
                              y1={getY(3.0)}
                              x2={W - 30}
                              y2={getY(3.0)}
                              stroke="#F59E0B"
                              strokeWidth="1.5"
                              strokeDasharray="4 2"
                            />

                            <polyline fill="none" stroke="#38BDF8" strokeWidth="2.5" points={points} />

                            {readings.map((r, i) => {
                              const cx = getX(i);
                              const cy = getY(r.ratePerDay);
                              return (
                                <g key={r.id}>
                                  <circle cx={cx} cy={cy} r="4" fill="#38BDF8" stroke="#000" strokeWidth="1" />
                                  <text x={cx} y={H - 8} textAnchor="middle" fill="#94A3B8" fontSize="8" fontFamily="monospace">
                                    D+{r.daysSinceInstall}
                                  </text>
                                  <text x={cx} y={cy - 6} textAnchor="middle" fill="#E2E8F0" fontSize="8" fontWeight="bold" fontFamily="monospace">
                                    {r.ratePerDay.toFixed(2)}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                        );
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 4: GEOTECHNICAL SUMMARY REPORT & COMPLIANCE                    */}
        {/* ================================================================== */}
        {activeTab === 'report' && (
          <div className="max-w-5xl mx-auto w-full space-y-4 relative z-10">
            <div
              className={`rounded-xl border p-6 space-y-6 shadow-md print:p-0 print:border-none print:bg-white print:text-black ${
                isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-800 text-slate-100'
              }`}
            >
              {/* Report Formal Header */}
              <div className="border-b-2 border-slate-700 print:border-black pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-black tracking-widest text-emerald-400 uppercase">
                    ESWA NATM GEOTECHNICAL ENGINEERING SUITE
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-amber-400 print:text-black tracking-tight">
                    Tunnel Instrumentation &amp; Convergence Monitoring Report
                  </h1>
                  <p className="text-xs font-bold text-slate-400 print:text-slate-600 mt-0.5">
                    Field Section: {dataset.chainageStation} • Heading: {dataset.location}
                  </p>
                </div>

                <div className="text-right text-xs space-y-1 text-slate-300 print:text-black">
                  <div className="font-bold">
                    Date of Report: <strong>{new Date().toISOString().split('T')[0]}</strong>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 font-bold">
                    <span>Client:</span>
                    <input
                      type="text"
                      value={dataset.clientName ?? clientName}
                      onChange={(e) => handleUpdateDataset({ ...dataset, clientName: e.target.value })}
                      placeholder="Enter Client..."
                      className="w-44 px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-100 font-bold text-xs text-right focus:border-amber-400 outline-none print:border-none print:bg-transparent print:text-black print:p-0 print:placeholder-transparent"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-1.5 font-bold">
                    <span>Contractor:</span>
                    <input
                      type="text"
                      value={dataset.contractorName ?? contractorName}
                      onChange={(e) => handleUpdateDataset({ ...dataset, contractorName: e.target.value })}
                      placeholder="Enter Contractor..."
                      className="w-44 px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-100 font-bold text-xs text-right focus:border-amber-400 outline-none print:border-none print:bg-transparent print:text-black print:p-0 print:placeholder-transparent"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-1.5 font-bold">
                    <span>Consultant:</span>
                    <input
                      type="text"
                      value={dataset.consultantName ?? consultantName}
                      onChange={(e) => handleUpdateDataset({ ...dataset, consultantName: e.target.value })}
                      placeholder="Enter Consultant..."
                      className="w-44 px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-100 font-bold text-xs text-right focus:border-amber-400 outline-none print:border-none print:bg-transparent print:text-black print:p-0 print:placeholder-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Executive Summary & TARP Decision */}
              <div
                className={`p-4 rounded-xl border space-y-2 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-amber-400 print:text-black tracking-wider">
                    Executive Geotechnical Stability Assessment
                  </h3>
                  <span className={`px-2.5 py-1 rounded text-xs font-black border ${stats.statusColor}`}>
                    {stats.stabilityStatus}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-300 print:text-black font-medium">
                  Monitoring Section at <strong>{dataset.chainageStation}</strong> within <strong>{dataset.project}</strong> has been
                  evaluated against the standard 3-tier Trigger Action Response Plan (TARP). Across{' '}
                  <strong>{stats.totalInst} installed sensors</strong>, {stats.normalCount} are within Level 1 Normal limits,{' '}
                  {stats.amberCount} in Level 2 Alert, and {stats.redCount} in Level 3 Critical. Current maximum deformation rate is{' '}
                  <strong>{stats.maxRateMmDay.toFixed(2)} mm/day</strong>. Ground-lining equilibrium is verified; standard advance rounds are authorized.
                </p>
              </div>

              {/* Tabular Summary of Installed Array */}
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase text-amber-400 print:text-black tracking-wider">
                  Summary Table of Installed Instruments &amp; Current Values
                </h3>
                <div className="border border-slate-800 print:border-slate-300 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 print:bg-slate-100 text-slate-300 print:text-black font-mono uppercase text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="p-2">Instrument ID</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Position</th>
                        <th className="p-2">Baseline</th>
                        <th className="p-2">Latest Reading</th>
                        <th className="p-2">Total Δ</th>
                        <th className="p-2">Velocity</th>
                        <th className="p-2">TARP Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 print:divide-slate-200 bg-slate-900/60 print:bg-white">
                      {dataset.instruments.map((inst) => {
                        const latest = inst.readings[inst.readings.length - 1];
                        return (
                          <tr key={inst.id} className="hover:bg-slate-800/50 print:hover:bg-slate-50">
                            <td className="p-2 font-mono font-black text-amber-400 print:text-black">{inst.instrumentId}</td>
                            <td className="p-2 font-bold text-slate-200 print:text-black">
                              {INSTRUMENT_METADATA[inst.type]?.name || inst.type}
                            </td>
                            <td className="p-2 text-slate-300 print:text-black">{SENSOR_POSITION_LABELS[inst.position] || inst.position}</td>
                            <td className="p-2 font-mono text-slate-300 print:text-black">
                              {inst.baselineZero} {inst.unit}
                            </td>
                            <td className="p-2 font-mono font-bold text-white print:text-black">
                              {latest ? `${latest.value.toFixed(1)} ${inst.unit}` : 'N/A'}
                            </td>
                            <td className="p-2 font-mono font-black text-cyan-400 print:text-blue-700">
                              {latest ? `${latest.deltaFromBaseline >= 0 ? '+' : ''}${latest.deltaFromBaseline.toFixed(1)} ${inst.unit}` : '0.0'}
                            </td>
                            <td className="p-2 font-mono text-slate-300 print:text-black">
                              {latest ? `${latest.ratePerDay.toFixed(2)} ${inst.unit}/d` : '0.00'}
                            </td>
                            <td className="p-2">
                              <span
                                className={`px-1.5 py-0.2 rounded font-mono font-black text-[9.5px] border ${
                                  latest?.alertLevel === 'RED'
                                    ? 'bg-red-950 text-red-400 border-red-500/60'
                                    : latest?.alertLevel === 'AMBER'
                                    ? 'bg-amber-950 text-amber-400 border-amber-500/60'
                                    : 'bg-emerald-950 text-emerald-400 border-emerald-500/60'
                                }`}
                              >
                                {latest ? latest.alertLevel : 'NORMAL'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sign-off Blocks (Editable & Blank by Default) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-800 print:border-black text-xs">
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 print:text-black block">
                    Lead Monitoring Geologist / Engineer
                  </span>
                  <div className="mt-4 border-b border-slate-700 print:border-black w-56" />
                  <input
                    type="text"
                    value={reportSignOff.leadGeologistName}
                    onChange={(e) => updateReportSignOff('leadGeologistName', e.target.value)}
                    placeholder="Enter Geologist / Engineer Name..."
                    className="w-full max-w-xs px-2.5 py-1 rounded bg-slate-950 border border-slate-700 font-bold text-slate-100 print:text-black text-[11px] block mt-1 focus:border-amber-400 outline-none print:border-none print:bg-transparent print:p-0 print:placeholder-transparent"
                  />
                  <input
                    type="text"
                    value={reportSignOff.leadGeologistRole}
                    onChange={(e) => updateReportSignOff('leadGeologistRole', e.target.value)}
                    placeholder="Site Geotechnical Team / Designation..."
                    className="w-full max-w-xs px-2.5 py-0.5 rounded bg-slate-950/60 border border-slate-800 text-[10px] text-slate-400 print:text-slate-700 block focus:border-amber-400 outline-none print:border-none print:bg-transparent print:p-0 print:placeholder-transparent"
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 print:text-black block">
                    Chief NATM Resident Engineer
                  </span>
                  <div className="mt-4 border-b border-slate-700 print:border-black w-56" />
                  <input
                    type="text"
                    value={reportSignOff.residentEngineerName}
                    onChange={(e) => updateReportSignOff('residentEngineerName', e.target.value)}
                    placeholder="Enter Resident Engineer Name..."
                    className="w-full max-w-xs px-2.5 py-1 rounded bg-slate-950 border border-slate-700 font-bold text-slate-100 print:text-black text-[11px] block mt-1 focus:border-amber-400 outline-none print:border-none print:bg-transparent print:p-0 print:placeholder-transparent"
                  />
                  <input
                    type="text"
                    value={reportSignOff.residentEngineerRole}
                    onChange={(e) => updateReportSignOff('residentEngineerRole', e.target.value)}
                    placeholder="Owner / Consultant Authority..."
                    className="w-full max-w-xs px-2.5 py-0.5 rounded bg-slate-950/60 border border-slate-800 text-[10px] text-slate-400 print:text-slate-700 block focus:border-amber-400 outline-none print:border-none print:bg-transparent print:p-0 print:placeholder-transparent"
                  />
                </div>
              </div>

              {/* Print & Export Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-800 print:hidden">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black border flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
                  }`}
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span>Export CSV Spreadsheets</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportJson}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-slate-950 hover:bg-black text-white text-xs font-black border border-slate-800 flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>Export JSON Dataset</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95"
                >
                  <Printer className="w-4 h-4 text-emerald-200" />
                  <span>Print Formal Report</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ==================================================================== */}
      {/* 5. MODAL: ADD NEW INSTRUMENT (Dark Theme Styled)                     */}
      {/* ==================================================================== */}
      {isAddInstrumentOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-slate-900 rounded-2xl border-2 border-slate-700 shadow-2xl max-w-lg w-full p-5 space-y-4 animate-scale-in text-white">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-black text-amber-400 uppercase flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Add New Installed Instrument</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddInstrumentOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewInstrumentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-black text-slate-300 mb-1">Instrument Type *</label>
                <select
                  value={newInstType}
                  onChange={(e) => {
                    const t = e.target.value as InstrumentType;
                    setNewInstType(t);
                    setNewInstUnit(INSTRUMENT_METADATA[t].defaultUnit);
                    setNewInstAmber(INSTRUMENT_METADATA[t].defaultAmber);
                    setNewInstRed(INSTRUMENT_METADATA[t].defaultRed);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-bold text-white focus:border-amber-400 outline-hidden"
                >
                  <option value="loadcell">Load Cell (Rock Bolt / Lining Stress)</option>
                  <option value="inclinometer">Inclinometer (Borehole Deflection)</option>
                  <option value="piezometer">Piezometer (Pore Water Pressure)</option>
                  <option value="mpbx">MPBX (Multi-Point Borehole Extensometer)</option>
                  <option value="crackmeter">Crackmeter (Lining Joint Opening)</option>
                  <option value="extensometer">Tape / Optical Convergence Extensometer</option>
                  <option value="optical_target">3D Optical Prism Target</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-300 mb-1">Instrument Tag / ID *</label>
                  <input
                    type="text"
                    required
                    value={newInstTag}
                    onChange={(e) => setNewInstTag(e.target.value)}
                    placeholder="e.g. LC-02, MPBX-02"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-black text-amber-400 focus:border-amber-400 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-black text-slate-300 mb-1">Profile Position *</label>
                  <select
                    value={newInstPosition}
                    onChange={(e) => setNewInstPosition(e.target.value as InstrumentPosition)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-bold text-white focus:border-amber-400 outline-hidden"
                  >
                    <option value="crown">Crown (Top Center)</option>
                    <option value="left_shoulder">Left Shoulder</option>
                    <option value="right_shoulder">Right Shoulder</option>
                    <option value="left_wall">Left Sidewall</option>
                    <option value="right_wall">Right Sidewall</option>
                    <option value="invert">Invert (Floor)</option>
                    <option value="collar">Collar (Shaft Top)</option>
                    <option value="shaft_wall">Shaft Perimeter Wall</option>
                    <option value="borehole_depth">Deep Borehole Collar</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-300 mb-1">Instrument Name / Description</label>
                <input
                  type="text"
                  value={newInstName}
                  onChange={(e) => setNewInstName(e.target.value)}
                  placeholder="e.g. Crown Tension Load Cell #2"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-bold text-white focus:border-amber-400 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-black text-slate-300 mb-1">Install Date</label>
                  <input
                    type="date"
                    value={newInstInstallDate}
                    onChange={(e) => setNewInstInstallDate(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-bold text-white"
                  />
                </div>
                <div>
                  <label className="block font-black text-slate-300 mb-1">Unit</label>
                  <input
                    type="text"
                    value={newInstUnit}
                    onChange={(e) => setNewInstUnit(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-black text-cyan-300"
                  />
                </div>
                <div>
                  <label className="block font-black text-slate-300 mb-1">Baseline Zero</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newInstBaseline}
                    onChange={(e) => setNewInstBaseline(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono font-bold text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <div>
                  <label className="block text-[11px] font-black text-amber-400 mb-0.5">Amber Alert Limit ({newInstUnit})</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newInstAmber}
                    onChange={(e) => setNewInstAmber(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 rounded bg-slate-900 border border-amber-500/50 font-mono font-black text-amber-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-red-400 mb-0.5">Red Action Limit ({newInstUnit})</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newInstRed}
                    onChange={(e) => setNewInstRed(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 rounded bg-slate-900 border border-red-500/50 font-mono font-black text-red-300"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddInstrumentOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 font-black text-slate-300 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Check className="w-4 h-4" />
                  <span>Create Instrument</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. MODAL: LOG NEW READING (Dark Theme Styled)                         */}
      {/* ==================================================================== */}
      {isAddReadingOpen && targetInstrumentForReading && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-slate-900 rounded-2xl border-2 border-slate-700 shadow-2xl max-w-lg w-full p-5 space-y-4 animate-scale-in text-white">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-black text-amber-400 uppercase flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>Log Reading: {targetInstrumentForReading.instrumentId}</span>
                </h3>
                <span className="text-[11px] text-slate-400 font-bold">
                  {targetInstrumentForReading.name} • Baseline: {targetInstrumentForReading.baselineZero}{' '}
                  {targetInstrumentForReading.unit}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddReadingOpen(false);
                  setTargetInstrumentForReading(null);
                }}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddReadingSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-300 mb-1">Reading Date *</label>
                  <input
                    type="date"
                    required
                    value={readingDate}
                    onChange={(e) => setReadingDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-bold text-white focus:border-amber-400 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-black text-slate-300 mb-1">Time</label>
                  <input
                    type="time"
                    value={readingTime}
                    onChange={(e) => setReadingTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-bold text-white focus:border-amber-400 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-300 mb-1">
                  Recorded Value ({targetInstrumentForReading.unit}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={readingValue}
                  onChange={(e) => setReadingValue(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-mono font-black text-lg text-emerald-400 focus:border-amber-400 outline-hidden"
                  autoFocus
                />
              </div>

              {/* MPBX Multi-Anchor Inputs */}
              {targetInstrumentForReading.type === 'mpbx' && (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[11px] font-black uppercase text-amber-400 block">
                    Anchor Depth Displacements (mm)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {mpbxAnchorsInput.map((a, idx) => (
                      <div key={a.depthM} className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded border border-slate-700">
                        <span className="text-[10px] font-bold text-slate-400 w-16">{a.depthM}m Anchor:</span>
                        <input
                          type="number"
                          step="0.1"
                          value={a.displacementMm}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const next = [...mpbxAnchorsInput];
                            next[idx] = { ...next[idx], displacementMm: val };
                            setMpbxAnchorsInput(next);
                          }}
                          className="w-full px-1.5 py-0.5 rounded font-mono font-bold text-xs bg-slate-950 border border-slate-700 text-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-slate-300 mb-1">Recorded By</label>
                  <input
                    type="text"
                    value={readingRecordedBy}
                    onChange={(e) => setReadingRecordedBy(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-bold text-white focus:border-amber-400 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-black text-slate-300 mb-1">Field Notes</label>
                  <input
                    type="text"
                    value={readingNotes}
                    onChange={(e) => setReadingNotes(e.target.value)}
                    placeholder="e.g. Blasting nearby, dampness"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-bold text-white focus:border-amber-400 outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddReadingOpen(false);
                    setTargetInstrumentForReading(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 font-black text-slate-300 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Reading</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
