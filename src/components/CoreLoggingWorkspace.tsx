import React, { useState, useEffect, useRef } from 'react';
import {
  BoreholeRecord,
  CoreRunRecord,
  CoreBoxPhotoRecord,
  calculateRunMetrics,
  calculateBoreholeSummary,
  getRqdBadgeColor,
  WEATHERING_GRADES,
  STRENGTH_GRADES,
  COMMON_LITHOLOGIES,
  CORE_DIAMETERS,
  DRILLING_METHODS,
  loadBoreholeRecordsFromStorage,
  saveBoreholeRecordsToStorage,
  createDefaultBorehole,
  createEmptyBorehole,
  getActiveBoreholeId,
  setActiveBoreholeId,
} from '../engine/coreLoggingEngine';
import { GeologistUserProfile } from '../engine/userCloudAndPackageEngine';
import { CoreLogReportModal } from './CoreLogReportModal';
import { CoreDataAndStorageModal } from './CoreDataAndStorageModal';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  FileText,
  Camera,
  Layers,
  ShieldCheck,
  Info,
  Download,
  Upload,
  Copy,
  Check,
  ChevronDown,
  Sparkles,
  Printer,
  PenTool,
  X,
  Database,
  Eye,
  FileSpreadsheet,
} from 'lucide-react';

interface CoreLoggingWorkspaceProps {
  onBackToMain: () => void;
  onOpenGlobalSettings?: () => void;
  activeGeologistProfile?: GeologistUserProfile | null;
}

export const CoreLoggingWorkspace: React.FC<CoreLoggingWorkspaceProps> = ({
  onBackToMain,
  onOpenGlobalSettings,
  activeGeologistProfile,
}) => {
  const [boreholes, setBoreholes] = useState<BoreholeRecord[]>([]);
  const [activeBoreholeIdState, setActiveBoreholeIdState] = useState<string>('');
  // Show hole detail first when opening Core Logging
  const [activeTab, setActiveTab] = useState<'metadata' | 'runs' | 'visual' | 'photos' | 'signoff' | 'storage'>('metadata');
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [targetReportBorehole, setTargetReportBorehole] = useState<BoreholeRecord | null>(null);
  const [isCreateBoreholeModalOpen, setIsCreateBoreholeModalOpen] = useState(false);
  const [isStorageCenterOpen, setIsStorageCenterOpen] = useState(false);

  // Rich Create Borehole Form State
  const [newBoreholeForm, setNewBoreholeForm] = useState({
    boreholeId: '',
    projectName: '',
    tunnelName: '',
    chainageLabel: '',
    collarElevation: 1000,
    northing: '',
    easting: '',
    inclinationDeg: -90,
    azimuthDeg: 0,
    coreDiameter: 'HQ3 (61.1 mm)',
    drillingMethod: 'Wireline Diamond Core (Triple Tube HQ3)',
    drillingContractor: '',
    pmcConsultant: '',
    clientEmployer: '',
    loggedBy: '',
    startDate: new Date().toISOString().split('T')[0],
    waterTableDepth: '',
  });

  // Run editing state
  const [editingRun, setEditingRun] = useState<CoreRunRecord | null>(null);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);

  // Photo editing state
  const [editingPhoto, setEditingPhoto] = useState<CoreBoxPhotoRecord | null>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  // Digital Signature Canvas reference
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingSig, setIsDrawingSig] = useState(false);
  const [activeSigRole, setActiveSigRole] = useState<'contractor' | 'pmc' | 'client' | null>(null);

  // Load boreholes on mount
  useEffect(() => {
    const list = loadBoreholeRecordsFromStorage();
    setBoreholes(list);
    const lastActive = getActiveBoreholeId();
    if (lastActive && list.some((b) => b.id === lastActive)) {
      setActiveBoreholeIdState(lastActive);
    } else if (list.length > 0) {
      setActiveBoreholeIdState(list[0].id);
      setActiveBoreholeId(list[0].id);
    }
  }, []);

  // Sync to storage
  const updateBorehole = (updated: BoreholeRecord) => {
    const nextList = boreholes.map((b) => (b.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : b));
    setBoreholes(nextList);
    saveBoreholeRecordsToStorage(nextList);
  };

  const currentBorehole = boreholes.find((b) => b.id === activeBoreholeIdState) || boreholes[0] || createDefaultBorehole();
  const summary = calculateBoreholeSummary(currentBorehole);
  const rqdBadge = getRqdBadgeColor(summary.overallRqdRating);

  // Switch active borehole
  const handleSelectBorehole = (id: string) => {
    setActiveBoreholeIdState(id);
    setActiveBoreholeId(id);
  };

  // Open Create Borehole Modal with smart pre-filled values
  const handleOpenCreateBorehole = () => {
    const nextNum = boreholes.length + 1;
    setNewBoreholeForm({
      boreholeId: `BH-${String(nextNum).padStart(2, '0')}`,
      projectName: currentBorehole.projectName || 'Tunnel & Cavern Project',
      tunnelName: currentBorehole.tunnelName || 'Main Drive',
      chainageLabel: currentBorehole.chainageLabel || `Ch. 0+${String(nextNum * 100).padStart(3, '0')}`,
      collarElevation: currentBorehole.collarElevation || 1250.0,
      northing: currentBorehole.coordinates?.northing || '',
      easting: currentBorehole.coordinates?.easting || '',
      inclinationDeg: -90,
      azimuthDeg: 0,
      coreDiameter: currentBorehole.coreDiameter || 'HQ3 (61.1 mm)',
      drillingMethod: currentBorehole.drillingMethod || 'Wireline Diamond Core (Triple Tube HQ3)',
      drillingContractor: currentBorehole.drillingContractor || '',
      pmcConsultant: currentBorehole.pmcConsultant || '',
      clientEmployer: currentBorehole.clientEmployer || '',
      loggedBy: activeGeologistProfile?.name || currentBorehole.loggedBy || 'Site Geologist',
      startDate: new Date().toISOString().split('T')[0],
      waterTableDepth: '',
    });
    setIsCreateBoreholeModalOpen(true);
  };

  // Submit Create new borehole
  const handleCreateNewBoreholeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const customId = newBoreholeForm.boreholeId.trim() || `BH-${boreholes.length + 1}`;
    const newBh = createEmptyBorehole(customId);
    newBh.projectName = newBoreholeForm.projectName.trim() || 'Tunnel Project';
    newBh.tunnelName = newBoreholeForm.tunnelName.trim();
    newBh.chainageLabel = newBoreholeForm.chainageLabel.trim();
    newBh.collarElevation = Number(newBoreholeForm.collarElevation) || 0;
    newBh.inclinationDeg = Number(newBoreholeForm.inclinationDeg) || -90;
    newBh.azimuthDeg = Number(newBoreholeForm.azimuthDeg) || 0;
    newBh.coreDiameter = newBoreholeForm.coreDiameter;
    newBh.drillingMethod = newBoreholeForm.drillingMethod;
    newBh.drillingContractor = newBoreholeForm.drillingContractor.trim();
    newBh.pmcConsultant = newBoreholeForm.pmcConsultant.trim();
    newBh.clientEmployer = newBoreholeForm.clientEmployer.trim();
    newBh.loggedBy = newBoreholeForm.loggedBy.trim() || 'Site Geologist';
    newBh.startDate = newBoreholeForm.startDate || new Date().toISOString().split('T')[0];
    newBh.completionDate = newBoreholeForm.startDate || new Date().toISOString().split('T')[0];
    if (newBoreholeForm.waterTableDepth) {
      newBh.waterTableDepth = parseFloat(newBoreholeForm.waterTableDepth);
    }
    if (newBoreholeForm.northing || newBoreholeForm.easting) {
      newBh.coordinates = {
        northing: newBoreholeForm.northing.trim(),
        easting: newBoreholeForm.easting.trim(),
        elevation: newBh.collarElevation ? `${newBh.collarElevation}m a.s.l.` : undefined,
      };
    }

    const updated = [newBh, ...boreholes];
    setBoreholes(updated);
    saveBoreholeRecordsToStorage(updated);
    setActiveBoreholeIdState(newBh.id);
    setActiveBoreholeId(newBh.id);
    setIsCreateBoreholeModalOpen(false);
    setActiveTab('metadata'); // First show the created hole detail
  };

  // Delete borehole
  const handleDeleteBorehole = (id: string) => {
    if (boreholes.length <= 1) {
      alert('Cannot delete the only remaining borehole.');
      return;
    }
    if (!confirm('Are you sure you want to delete this borehole record? This cannot be undone.')) return;
    const remaining = boreholes.filter((b) => b.id !== id);
    setBoreholes(remaining);
    saveBoreholeRecordsToStorage(remaining);
    setActiveBoreholeIdState(remaining[0].id);
    setActiveBoreholeId(remaining[0].id);
  };

  // Add / Edit Run helpers
  const handleOpenAddRun = () => {
    const runs = currentBorehole.runs || [];
    const lastRun = runs[runs.length - 1];
    const newFrom = lastRun ? lastRun.depthTo : 0.0;
    const defaultLen = lastRun ? lastRun.runLength : 3.0;
    const newTo = parseFloat((newFrom + defaultLen).toFixed(2));
    const nextRunNumber = lastRun ? lastRun.runNumber + 1 : 1;
    const nextBoxNumber = lastRun ? lastRun.coreBoxNumber : 1;

    const metrics = calculateRunMetrics(newFrom, newTo, defaultLen * 0.95, defaultLen * 0.8);
    const newRun: CoreRunRecord = {
      id: `run-${Date.now()}`,
      runNumber: nextRunNumber,
      depthFrom: newFrom,
      depthTo: newTo,
      runLength: metrics.runLength,
      coreRecovered: metrics.coreRecovered,
      soundPiecesOver10cm: metrics.soundPiecesOver10cm,
      tcrPercent: metrics.tcrPercent,
      rqdPercent: metrics.rqdPercent,
      rqdRating: metrics.rqdRating,
      lithology: lastRun ? lastRun.lithology : 'Granite',
      lithologyColor: lastRun ? lastRun.lithologyColor : '#FB7185',
      weathering: lastRun ? lastRun.weathering : 'W2',
      strengthGrade: lastRun ? lastRun.strengthGrade : 'R4',
      fractureFrequency: lastRun ? lastRun.fractureFrequency : 3,
      coreBoxNumber: nextBoxNumber,
      discontinuitiesDescription: 'Sub-vertical rough joints, clean contacts',
      remarks: '',
    };

    setEditingRun(newRun);
    setIsRunModalOpen(true);
  };

  const handleSaveRun = (run: CoreRunRecord) => {
    const existingIndex = currentBorehole.runs.findIndex((r) => r.id === run.id);
    let nextRuns = [...currentBorehole.runs];
    if (existingIndex >= 0) {
      nextRuns[existingIndex] = run;
    } else {
      nextRuns.push(run);
    }
    // Sort runs by depthFrom
    nextRuns.sort((a, b) => a.depthFrom - b.depthFrom);
    // Renumber runs sequentially
    nextRuns = nextRuns.map((r, idx) => ({ ...r, runNumber: idx + 1 }));

    updateBorehole({
      ...currentBorehole,
      runs: nextRuns,
    });
    setIsRunModalOpen(false);
    setEditingRun(null);
  };

  const handleDeleteRun = (runId: string) => {
    if (!confirm('Are you sure you want to remove this core run?')) return;
    let nextRuns = currentBorehole.runs.filter((r) => r.id !== runId);
    nextRuns = nextRuns.map((r, idx) => ({ ...r, runNumber: idx + 1 }));
    updateBorehole({
      ...currentBorehole,
      runs: nextRuns,
    });
  };

  // Add / Edit Photo helpers
  const handleOpenAddPhoto = () => {
    const runs = currentBorehole.runs || [];
    const lastRun = runs[runs.length - 1];
    const newFrom = lastRun ? Math.max(0, lastRun.depthTo - 6.0) : 0.0;
    const newTo = lastRun ? lastRun.depthTo : 6.0;

    const newPhoto: CoreBoxPhotoRecord = {
      id: `photo-${Date.now()}`,
      boxNumber: (currentBorehole.photos?.length || 0) + 1,
      depthFrom: parseFloat(newFrom.toFixed(2)),
      depthTo: parseFloat(newTo.toFixed(2)),
      photoUrl: '',
      photoTitle: `Core Box #${(currentBorehole.photos?.length || 0) + 1} (${newFrom.toFixed(1)}m - ${newTo.toFixed(1)}m)`,
      takenAt: new Date().toISOString().split('T')[0],
      condition: 'Wet',
      notes: 'Clear photography under diffused lighting',
    };
    setEditingPhoto(newPhoto);
    setIsPhotoModalOpen(true);
  };

  const handleSavePhoto = (photo: CoreBoxPhotoRecord) => {
    const existingIndex = (currentBorehole.photos || []).findIndex((p) => p.id === photo.id);
    let nextPhotos = [...(currentBorehole.photos || [])];
    if (existingIndex >= 0) {
      nextPhotos[existingIndex] = photo;
    } else {
      nextPhotos.push(photo);
    }
    updateBorehole({
      ...currentBorehole,
      photos: nextPhotos,
    });
    setIsPhotoModalOpen(false);
    setEditingPhoto(null);
  };

  const handleDeletePhoto = (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo record?')) return;
    const nextPhotos = (currentBorehole.photos || []).filter((p) => p.id !== photoId);
    updateBorehole({
      ...currentBorehole,
      photos: nextPhotos,
    });
  };

  // Signature canvas handlers
  const startDrawingSig = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawingSig(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const drawSig = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingSig) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawingSig = () => {
    setIsDrawingSig(false);
  };

  const clearSigCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSigCanvasToRole = (role: 'contractor' | 'pmc' | 'client') => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const today = new Date().toISOString().split('T')[0];
    const signOff = { ...currentBorehole.signOff };
    if (role === 'contractor') {
      signOff.contractorSignature = dataUrl;
      signOff.contractorDate = today;
    } else if (role === 'pmc') {
      signOff.pmcSignature = dataUrl;
      signOff.pmcDate = today;
    } else {
      signOff.clientSignature = dataUrl;
      signOff.clientDate = today;
    }
    updateBorehole({ ...currentBorehole, signOff });
    setActiveSigRole(null);
  };

  // Apply active geologist profile signature if available
  const applyActiveGeologistSignature = (role: 'contractor' | 'pmc' | 'client') => {
    if (!activeGeologistProfile) return;
    const today = new Date().toISOString().split('T')[0];
    const signOff = { ...currentBorehole.signOff };
    const sigUrl = activeGeologistProfile.pngSignatureDataUrl;
    if (role === 'contractor') {
      signOff.contractorName = activeGeologistProfile.name;
      signOff.contractorDesignation = activeGeologistProfile.designation || signOff.contractorDesignation;
      if (sigUrl) {
        signOff.contractorSignature = sigUrl;
      }
      signOff.contractorDate = today;
    } else if (role === 'pmc') {
      signOff.pmcName = activeGeologistProfile.name;
      signOff.pmcDesignation = activeGeologistProfile.designation || signOff.pmcDesignation;
      if (sigUrl) {
        signOff.pmcSignature = sigUrl;
      }
      signOff.pmcDate = today;
    } else {
      signOff.clientName = activeGeologistProfile.name;
      signOff.clientDesignation = activeGeologistProfile.designation || signOff.clientDesignation;
      if (sigUrl) {
        signOff.clientSignature = sigUrl;
      }
      signOff.clientDate = today;
    }
    updateBorehole({ ...currentBorehole, signOff });
  };

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] w-screen min-h-0 min-w-0 overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans">
      {/* Top Header Bar */}
      <header className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur flex items-center justify-between shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToMain}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition-all cursor-pointer"
            title="Return to Main Window"
          >
            <ArrowLeft className="w-4 h-4 text-orange-600" />
            <span>Main Window</span>
          </button>

          <div className="h-5 w-px bg-slate-300 dark:bg-slate-700" />

          {/* Borehole Picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:inline">Hole:</span>
            <div className="relative">
              <select
                value={currentBorehole.id}
                onChange={(e) => handleSelectBorehole(e.target.value)}
                className="pl-3 pr-8 py-1 rounded-lg text-xs font-mono font-bold bg-orange-50 dark:bg-orange-950/40 text-orange-900 dark:text-orange-200 border border-orange-300 dark:border-orange-800 cursor-pointer appearance-none shadow-xs"
              >
                {boreholes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.boreholeId} ({b.chainageLabel || b.projectName || 'Log'})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-orange-600 absolute right-2.5 top-2 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={handleOpenCreateBorehole}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-xs transition-all cursor-pointer"
              title="Create New Borehole Log"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Hole</span>
            </button>

            <button
              type="button"
              onClick={() => setIsStorageCenterOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 shadow-xs transition-all cursor-pointer"
              title="Access already logged boreholes, inspection details, backups, and storage"
            >
              <Database className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="hidden sm:inline">Data &amp; Storage</span>
              <span className="bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 px-1.5 py-0.2 rounded-full font-mono text-[10px]">
                {boreholes.length}
              </span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
            <span>&bull;</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
              {currentBorehole.projectName}
            </span>
            {currentBorehole.chainageLabel && (
              <span className="font-mono bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">
                {currentBorehole.chainageLabel}
              </span>
            )}
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {/* Quick Active Geologist Indicator */}
          {activeGeologistProfile && (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>[{activeGeologistProfile.role}]</span>
              <span className="truncate max-w-[100px]">{activeGeologistProfile.name}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleOpenAddRun}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-orange-600 border border-orange-300 dark:border-orange-800 shadow-xs transition-all cursor-pointer"
            title="Add next core run"
          >
            <Plus className="w-4 h-4" />
            <span>Add Core Run</span>
          </button>

          <button
            type="button"
            onClick={() => setIsReportOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-md transition-all cursor-pointer"
            title="Generate &amp; Print Full Geotechnical Core Strip Log Report (A4)"
          >
            <Printer className="w-4 h-4" />
            <span>Generate Report (A4)</span>
          </button>
        </div>
      </header>

      {/* Geotechnical Summary Metrics Strip */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2 shrink-0 flex items-center justify-between gap-3 overflow-x-auto text-xs">
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 uppercase font-semibold text-[10px]">Total Drilled:</span>
            <span className="font-mono font-black text-slate-900 dark:text-white">
              {summary.totalDrilledDepth.toFixed(2)} m
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 uppercase font-semibold text-[10px]">TCR:</span>
            <span className="font-mono font-black text-slate-900 dark:text-white">{summary.averageTcr.toFixed(1)}%</span>
            <span className="text-[10px] text-slate-400">({summary.totalCoreRecovered.toFixed(2)}m)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 uppercase font-semibold text-[10px]">RQD:</span>
            <span className="font-mono font-black text-slate-900 dark:text-white">{summary.averageRqd.toFixed(1)}%</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${rqdBadge.bg} ${rqdBadge.text} ${rqdBadge.border}`}
            >
              {summary.overallRqdRating}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-slate-500 uppercase font-semibold text-[10px]">Dominant Rock:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{summary.dominantLithology}</span>
            <span className="px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
              {summary.dominantWeathering}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5">
            <span className="text-slate-500 uppercase font-semibold text-[10px]">Runs:</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{summary.runCount}</span>
            <span className="text-slate-500 uppercase font-semibold text-[10px] ml-2">Boxes:</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{summary.boxCount}</span>
          </div>
        </div>

        {/* Tab Switcher Pills - Hole Details is FIRST */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('metadata')}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'metadata'
                ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Hole Details &amp; Setup
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('runs')}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'runs'
                ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Core Runs ({currentBorehole.runs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('visual')}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'visual'
                ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Visual Strip Log
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('photos')}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'photos'
                ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Core Box Photos ({currentBorehole.photos?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('signoff')}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'signoff'
                ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Tri-Party Sign-Off
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('storage')}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'storage'
                ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-amber-500" />
            <span>Data &amp; Storage ({boreholes.length})</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* TAB 1: CORE RUNS SHEET */}
        {activeTab === 'runs' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Geotechnical Core Run Log</span>
                  <span className="text-xs font-normal text-slate-500">
                    (ISO 22475-1 / ASTM D2113 standard continuous run evaluation)
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter drilled depth, core recovery, and sound core pieces (≥100mm) for instant TCR &amp; RQD calculation.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenAddRun}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Run #{currentBorehole.runs.length + 1}</span>
                </button>
              </div>
            </div>

            {/* Table Container */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                      <th className="py-2.5 px-3 text-center w-10">#</th>
                      <th className="py-2.5 px-3 text-center">From (m)</th>
                      <th className="py-2.5 px-3 text-center">To (m)</th>
                      <th className="py-2.5 px-3 text-center">Length (m)</th>
                      <th className="py-2.5 px-3 text-center">Recovered (m)</th>
                      <th className="py-2.5 px-3 text-center">TCR %</th>
                      <th className="py-2.5 px-3 text-center">≥10cm (m)</th>
                      <th className="py-2.5 px-3 text-center">RQD %</th>
                      <th className="py-2.5 px-3 text-center">Rating</th>
                      <th className="py-2.5 px-3 text-center">Lithology</th>
                      <th className="py-2.5 px-3 text-center">Wth</th>
                      <th className="py-2.5 px-3 text-center">Strength</th>
                      <th className="py-2.5 px-3 text-center">Box</th>
                      <th className="py-2.5 px-3">Discontinuities / Remarks</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {currentBorehole.runs.map((run) => {
                      const ratingColor = getRqdBadgeColor(run.rqdRating);
                      return (
                        <tr
                          key={run.id}
                          className="hover:bg-orange-50/40 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 dark:text-slate-100">
                            {run.runNumber}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-medium">{run.depthFrom.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-medium">{run.depthTo.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-500 font-medium">
                            {run.runLength.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                            {run.coreRecovered.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold">
                            <span className={run.tcrPercent >= 90 ? 'text-emerald-600' : run.tcrPercent >= 70 ? 'text-amber-600' : 'text-rose-600'}>
                              {run.tcrPercent.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-medium">
                            {run.soundPiecesOver10cm.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-black text-slate-900 dark:text-white">
                            {run.rqdPercent.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${ratingColor.bg} ${ratingColor.text} ${ratingColor.border}`}
                            >
                              {run.rqdRating}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold"
                              style={{
                                backgroundColor: run.lithologyColor ? `${run.lithologyColor}25` : '#f1f5f9',
                                color: run.lithologyColor || '#0f172a',
                                border: `1px solid ${run.lithologyColor || '#cbd5e1'}`,
                              }}
                            >
                              {run.lithology}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold font-mono">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                              {run.weathering}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold font-mono">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                              {run.strengthGrade}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600 dark:text-slate-400">
                            #{run.coreBoxNumber}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-[240px] truncate">
                            <div className="truncate font-medium">{run.discontinuitiesDescription || '—'}</div>
                            {run.remarks && <div className="text-[10px] text-slate-400 truncate">{run.remarks}</div>}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRun(run);
                                  setIsRunModalOpen(true);
                                }}
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-orange-600 cursor-pointer"
                                title="Edit Run"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRun(run.id)}
                                className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Delete Run"
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
          </div>
        )}

        {/* TAB 2: VISUAL STRIP LOG */}
        {activeTab === 'visual' && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Visual Borehole Strip Log &amp; Stratigraphy
                </h2>
                <p className="text-xs text-slate-500">
                  Continuous geotechnical drillhole column illustrating depth, lithological units, RQD rating spectrum, and fracture density.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsReportOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-600 text-white hover:bg-orange-700 shadow-sm transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Graphic Log</span>
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              {/* Graphic Column Header */}
              <div className="grid grid-cols-12 gap-2 pb-2 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-500">
                <div className="col-span-2 text-right pr-2">Depth (m)</div>
                <div className="col-span-2 text-center">Lithology</div>
                <div className="col-span-4 text-center">RQD % Rating Spectrum</div>
                <div className="col-span-1 text-center">TCR %</div>
                <div className="col-span-1 text-center">Wth / Str</div>
                <div className="col-span-2 pl-2">Joints / Discontinuities</div>
              </div>

              {/* Strip Runs */}
              <div className="space-y-2">
                {currentBorehole.runs.map((run) => (
                  <div
                    key={`visual-row-${run.id}`}
                    onClick={() => {
                      setEditingRun(run);
                      setIsRunModalOpen(true);
                    }}
                    className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-100 dark:border-slate-800 transition-all cursor-pointer text-xs"
                    title="Click to edit run data"
                  >
                    {/* Depth Range */}
                    <div className="col-span-2 text-right pr-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                      {run.depthFrom.toFixed(2)} – {run.depthTo.toFixed(2)}m
                      <div className="text-[10px] font-normal text-slate-400">Run #{run.runNumber}</div>
                    </div>

                    {/* Lithology Pill */}
                    <div className="col-span-2">
                      <div
                        className="py-1 px-2 rounded-md font-bold text-center text-xs truncate border"
                        style={{
                          backgroundColor: run.lithologyColor ? `${run.lithologyColor}25` : '#f1f5f9',
                          borderColor: run.lithologyColor || '#cbd5e1',
                          color: run.lithologyColor || '#0f172a',
                        }}
                      >
                        {run.lithology}
                      </div>
                    </div>

                    {/* RQD Bar Graphic */}
                    <div className="col-span-4">
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-full h-5 overflow-hidden relative border border-slate-200 dark:border-slate-700 flex items-center">
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(0, run.rqdPercent))}%`,
                            backgroundColor:
                              run.rqdPercent >= 90
                                ? '#10B981'
                                : run.rqdPercent >= 75
                                ? '#14B8A6'
                                : run.rqdPercent >= 50
                                ? '#F59E0B'
                                : run.rqdPercent >= 25
                                ? '#F97316'
                                : '#EF4444',
                          }}
                        />
                        <span className="absolute left-2.5 font-mono text-[10px] font-bold text-slate-900 dark:text-white drop-shadow-xs">
                          {run.rqdPercent.toFixed(1)}% &bull; {run.rqdRating}
                        </span>
                      </div>
                    </div>

                    {/* TCR */}
                    <div className="col-span-1 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                      {run.tcrPercent.toFixed(0)}%
                    </div>

                    {/* Weathering & Strength */}
                    <div className="col-span-1 text-center">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
                        {run.weathering}/{run.strengthGrade}
                      </span>
                    </div>

                    {/* Discontinuities */}
                    <div className="col-span-2 pl-2 text-[11px] text-slate-500 truncate">
                      {run.discontinuitiesDescription || run.remarks || 'Intact rock'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CORE BOX PHOTOS */}
        {activeTab === 'photos' && (
          <div className="space-y-4 max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Core Box Photographic Catalog
                </h2>
                <p className="text-xs text-slate-500">
                  Upload and organize core tray photographs with depth intervals, box numbering, and wet/dry core condition labels.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenAddPhoto}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition-all cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Add Core Box Photo</span>
              </button>
            </div>

            {(!currentBorehole.photos || currentBorehole.photos.length === 0) ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl p-8 text-center border-2 border-dashed border-slate-300 dark:border-slate-800">
                <Camera className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Core Box Photos Added Yet</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                  Add core tray photos labeled with depth ranges to include them in the final geotechnical PDF strip log report.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAddPhoto}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-orange-600 text-white hover:bg-orange-700 transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Upload First Box Photo</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {currentBorehole.photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col group"
                  >
                    {/* Header */}
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-white">
                          Core Box #{photo.boxNumber}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {photo.depthFrom.toFixed(2)}m – {photo.depthTo.toFixed(2)}m
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {photo.condition}
                      </span>
                    </div>

                    {/* Image Preview */}
                    <div className="h-44 bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative overflow-hidden">
                      {photo.photoUrl ? (
                        <img
                          src={photo.photoUrl}
                          alt={`Box ${photo.boxNumber}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="text-center p-4 text-slate-400">
                          <Camera className="w-8 h-8 mx-auto mb-1 opacity-50" />
                          <span className="text-[10px] font-medium">No photo uploaded</span>
                        </div>
                      )}
                    </div>

                    {/* Info & Actions */}
                    <div className="p-3 flex-1 flex flex-col justify-between text-xs">
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {photo.photoTitle || 'Core Tray'}
                        </div>
                        {photo.notes && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5 line-clamp-2">
                            {photo.notes}
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Date: {photo.takenAt}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPhoto(photo);
                              setIsPhotoModalOpen(true);
                            }}
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-orange-600 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 1: BOREHOLE DETAILS & METADATA (FIRST VIEW) */}
        {activeTab === 'metadata' && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Top Action Header */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Borehole Setup &amp; Geotechnical Parameters
                  </h2>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300 border border-orange-300 dark:border-orange-800">
                    {currentBorehole.boreholeId}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Collar survey coordinates, diamond core barrel geometry, drilling rig method, and client/contractor entities.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenCreateBorehole}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-orange-600 border border-orange-300 dark:border-orange-800 shadow-xs transition-all cursor-pointer"
                  title="Create a new borehole log"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Hole</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsStorageCenterOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 shadow-xs transition-all cursor-pointer"
                  title="Access already logged boreholes, inspection details, backups, and storage"
                >
                  <Database className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Logged Holes ({boreholes.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('runs')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition-all cursor-pointer"
                  title="Proceed to continuous core run logging"
                >
                  <span>Proceed to Run Log</span>
                  <span className="font-mono text-sm">&rarr;</span>
                </button>
              </div>
            </div>

            {/* Quick Hole Overview Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Depth</span>
                <span className="text-lg font-black font-mono text-slate-900 dark:text-white">
                  {summary.totalDrilledDepth.toFixed(2)} m
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{summary.runCount} continuous runs logged</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Core Recovery</span>
                <span className="text-lg font-black font-mono text-slate-900 dark:text-white">
                  {summary.averageTcr.toFixed(1)}% TCR
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {summary.totalCoreRecovered.toFixed(2)}m recovered
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">RQD Rating</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-lg font-black font-mono text-slate-900 dark:text-white">
                    {summary.averageRqd.toFixed(1)}%
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${rqdBadge.bg} ${rqdBadge.text} ${rqdBadge.border}`}>
                    {summary.overallRqdRating}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">{summary.totalSoundPieces.toFixed(2)}m sound (≥10cm)</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Core Boxes &amp; Sign-Off</span>
                <span className="text-lg font-black font-mono text-slate-900 dark:text-white">
                  {summary.boxCount} Boxes
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Signatures: {currentBorehole.signOff.contractorSignature ? '1/3' : '0/3'} recorded
                </span>
              </div>
            </div>

            {/* Structured Engineering Form Sections */}
            <div className="space-y-5">
              {/* SECTION 1: Hole Identification & Alignment Context */}
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                  1. Borehole Identification &amp; Project Context
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Borehole Identifier</label>
                    <input
                      type="text"
                      value={currentBorehole.boreholeId}
                      onChange={(e) => updateBorehole({ ...currentBorehole, boreholeId: e.target.value })}
                      placeholder="e.g. BH-01"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Project Name</label>
                    <input
                      type="text"
                      value={currentBorehole.projectName}
                      onChange={(e) => updateBorehole({ ...currentBorehole, projectName: e.target.value })}
                      placeholder="e.g. Expressway Tunnel Package-02"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Location / Chainage</label>
                    <input
                      type="text"
                      value={currentBorehole.chainageLabel || ''}
                      onChange={(e) => updateBorehole({ ...currentBorehole, chainageLabel: e.target.value })}
                      placeholder="e.g. Ch. 120+450"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tunnel Drive / Section</label>
                    <input
                      type="text"
                      value={currentBorehole.tunnelName || ''}
                      onChange={(e) => updateBorehole({ ...currentBorehole, tunnelName: e.target.value })}
                      placeholder="e.g. Main Tunnel Southbound"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Spatial Coordinates & Geometry */}
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                  2. Spatial Coordinates &amp; Borehole Geometry
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Collar Elevation (m a.s.l.)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={currentBorehole.collarElevation || 0}
                      onChange={(e) =>
                        updateBorehole({ ...currentBorehole, collarElevation: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Coordinates: Northing (Y)</label>
                    <input
                      type="text"
                      value={currentBorehole.coordinates?.northing || ''}
                      onChange={(e) =>
                        updateBorehole({
                          ...currentBorehole,
                          coordinates: { ...currentBorehole.coordinates, northing: e.target.value },
                        })
                      }
                      placeholder="e.g. 2,845,612.35 m N"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Coordinates: Easting (X)</label>
                    <input
                      type="text"
                      value={currentBorehole.coordinates?.easting || ''}
                      onChange={(e) =>
                        updateBorehole({
                          ...currentBorehole,
                          coordinates: { ...currentBorehole.coordinates, easting: e.target.value },
                        })
                      }
                      placeholder="e.g. 412,890.12 m E"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Inclination / Plunge (°)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={currentBorehole.inclinationDeg}
                        onChange={(e) =>
                          updateBorehole({ ...currentBorehole, inclinationDeg: parseInt(e.target.value, 10) || -90 })
                        }
                        className="w-24 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                      />
                      <span className="text-[11px] text-slate-500 font-semibold">
                        {currentBorehole.inclinationDeg === -90 ? 'Vertical' : `${currentBorehole.inclinationDeg}° Dip`}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Azimuth / Bearing (°)</label>
                    <input
                      type="number"
                      value={currentBorehole.azimuthDeg}
                      onChange={(e) =>
                        updateBorehole({ ...currentBorehole, azimuthDeg: parseInt(e.target.value, 10) || 0 })
                      }
                      placeholder="0 - 360"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: Drilling Specifications & Rig */}
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                  3. Drilling Equipment, Core Size &amp; Hydrogeology
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Core Diameter / Barrel</label>
                    <select
                      value={currentBorehole.coreDiameter}
                      onChange={(e) => updateBorehole({ ...currentBorehole, coreDiameter: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                    >
                      {CORE_DIAMETERS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Drilling Method</label>
                    <select
                      value={currentBorehole.drillingMethod}
                      onChange={(e) => updateBorehole({ ...currentBorehole, drillingMethod: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                    >
                      {DRILLING_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Static Water Table (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={currentBorehole.waterTableDepth !== undefined ? currentBorehole.waterTableDepth : ''}
                      onChange={(e) =>
                        updateBorehole({
                          ...currentBorehole,
                          waterTableDepth: e.target.value ? parseFloat(e.target.value) : undefined,
                        })
                      }
                      placeholder="e.g. 6.80"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                    />
                    <span className="text-[10px] text-slate-400">Depth below ground level</span>
                  </div>
                </div>
              </div>

              {/* SECTION 4: Professional Entities & Personnel */}
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                  4. Professional Entities &amp; Schedule
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Drilling Contractor</label>
                    <input
                      type="text"
                      value={currentBorehole.drillingContractor}
                      onChange={(e) => updateBorehole({ ...currentBorehole, drillingContractor: e.target.value })}
                      placeholder="e.g. Alpha Geotechnical Drilling"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">PMC / Consultant</label>
                    <input
                      type="text"
                      value={currentBorehole.pmcConsultant}
                      onChange={(e) => updateBorehole({ ...currentBorehole, pmcConsultant: e.target.value })}
                      placeholder="e.g. Geotechnical Consultants Ltd"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Client / Employer</label>
                    <input
                      type="text"
                      value={currentBorehole.clientEmployer}
                      onChange={(e) => updateBorehole({ ...currentBorehole, clientEmployer: e.target.value })}
                      placeholder="e.g. Highway Infrastructure Authority"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Logged By (Geologist)</label>
                    <input
                      type="text"
                      value={currentBorehole.loggedBy}
                      onChange={(e) => updateBorehole({ ...currentBorehole, loggedBy: e.target.value })}
                      placeholder="e.g. Dr. A. Kumar"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Reviewed By (Engineer)</label>
                    <input
                      type="text"
                      value={currentBorehole.reviewedBy}
                      onChange={(e) => updateBorehole({ ...currentBorehole, reviewedBy: e.target.value })}
                      placeholder="e.g. Lead Geotechnical Engineer"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Dates Commenced / Completed</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={currentBorehole.startDate}
                        onChange={(e) => updateBorehole({ ...currentBorehole, startDate: e.target.value })}
                        className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[11px]"
                      />
                      <span className="text-slate-400">to</span>
                      <input
                        type="date"
                        value={currentBorehole.completionDate}
                        onChange={(e) => updateBorehole({ ...currentBorehole, completionDate: e.target.value })}
                        className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[11px]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleDeleteBorehole(currentBorehole.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-300 dark:border-rose-800 flex items-center gap-1.5 cursor-pointer order-2 sm:order-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Borehole Log</span>
              </button>

              <div className="flex items-center gap-2 order-1 sm:order-2">
                <button
                  type="button"
                  onClick={() => setIsReportOpen(true)}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-orange-600" />
                  <span>Preview A4 Report</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('runs')}
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <span>Start Core Run Logging</span>
                  <span className="font-mono text-sm">&rarr;</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: TRI-PARTY SIGN-OFF */}
        {activeTab === 'signoff' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-orange-600" />
                  <span>Tri-Party Geotechnical Sign-Off &amp; Approvals</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Role-stamped digital signatures for Contractor, PMC, and Client geologists with on-screen signature pad or PNG upload.
                </p>
              </div>

              {activeGeologistProfile && (
                <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 font-semibold flex items-center gap-2">
                  <span>Logged in as: {activeGeologistProfile.name} ({activeGeologistProfile.role})</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. CONTRACTOR CARD */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-amber-300 dark:border-amber-800/60 p-4 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      Contractor
                    </span>
                    <span className="text-[10px] text-slate-400">Drilling &amp; Logging</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Geologist Name</label>
                      <input
                        type="text"
                        value={currentBorehole.signOff.contractorName}
                        onChange={(e) =>
                          updateBorehole({
                            ...currentBorehole,
                            signOff: { ...currentBorehole.signOff, contractorName: e.target.value },
                          })
                        }
                        placeholder="Contractor Geologist"
                        className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Designation</label>
                      <input
                        type="text"
                        value={currentBorehole.signOff.contractorDesignation}
                        onChange={(e) =>
                          updateBorehole({
                            ...currentBorehole,
                            signOff: { ...currentBorehole.signOff, contractorDesignation: e.target.value },
                          })
                        }
                        placeholder="Drilling Geologist"
                        className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Date</label>
                      <input
                        type="date"
                        value={currentBorehole.signOff.contractorDate}
                        onChange={(e) =>
                          updateBorehole({
                            ...currentBorehole,
                            signOff: { ...currentBorehole.signOff, contractorDate: e.target.value },
                          })
                        }
                        className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Signature</label>
                  <div className="h-20 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center overflow-hidden mb-2 relative">
                    {currentBorehole.signOff.contractorSignature ? (
                      <img
                        src={currentBorehole.signOff.contractorSignature}
                        alt="Contractor Signature"
                        className="max-h-16 object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">No signature recorded</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveSigRole('contractor')}
                      className="flex-1 py-1 rounded text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <PenTool className="w-3 h-3" />
                      <span>Draw / Sign</span>
                    </button>

                    {activeGeologistProfile && activeGeologistProfile.role === 'Contractor' && (
                      <button
                        type="button"
                        onClick={() => applyActiveGeologistSignature('contractor')}
                        className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                        title="Auto-sign with active profile"
                      >
                        Use Profile
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. PMC CONSULTANT CARD */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-blue-300 dark:border-blue-800/60 p-4 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                      PMC Consultant
                    </span>
                    <span className="text-[10px] text-slate-400">Review &amp; Witness</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">PMC Geologist</label>
                      <input
                        type="text"
                        value={currentBorehole.signOff.pmcName}
                        onChange={(e) =>
                          updateBorehole({
                            ...currentBorehole,
                            signOff: { ...currentBorehole.signOff, pmcName: e.target.value },
                          })
                        }
                        placeholder="PMC Consultant Geologist"
                        className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Designation</label>
                      <input
                        type="text"
                        value={currentBorehole.signOff.pmcDesignation}
                        onChange={(e) =>
                          updateBorehole({
                            ...currentBorehole,
                            signOff: { ...currentBorehole.signOff, pmcDesignation: e.target.value },
                          })
                        }
                        placeholder="Geotechnical Specialist"
                        className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Date</label>
                      <input
                        type="date"
                        value={currentBorehole.signOff.pmcDate}
                        onChange={(e) =>
                          updateBorehole({
                            ...currentBorehole,
                            signOff: { ...currentBorehole.signOff, pmcDate: e.target.value },
                          })
                        }
                        className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Signature</label>
                  <div className="h-20 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center overflow-hidden mb-2 relative">
                    {currentBorehole.signOff.pmcSignature ? (
                      <img
                        src={currentBorehole.signOff.pmcSignature}
                        alt="PMC Signature"
                        className="max-h-16 object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">No signature recorded</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveSigRole('pmc')}
                      className="flex-1 py-1 rounded text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <PenTool className="w-3 h-3" />
                      <span>Draw / Sign</span>
                    </button>

                    {activeGeologistProfile && activeGeologistProfile.role === 'PMC' && (
                      <button
                        type="button"
                        onClick={() => applyActiveGeologistSignature('pmc')}
                        className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                        title="Auto-sign with active profile"
                      >
                        Use Profile
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. CLIENT / EMPLOYER CARD */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-emerald-300 dark:border-emerald-800/60 p-4 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      Client / Employer
                    </span>
                    <span className="text-[10px] text-slate-400">Approval &amp; Acceptance</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Representative</label>
                      <input
                        type="text"
                        value={currentBorehole.signOff.clientName}
                        onChange={(e) =>
                          updateBorehole({
                            ...currentBorehole,
                            signOff: { ...currentBorehole.signOff, clientName: e.target.value },
                          })
                        }
                        placeholder="Client Geologist / Engineer"
                        className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Designation</label>
                      <input
                        type="text"
                        value={currentBorehole.signOff.clientDesignation}
                        onChange={(e) =>
                          updateBorehole({
                            ...currentBorehole,
                            signOff: { ...currentBorehole.signOff, clientDesignation: e.target.value },
                          })
                        }
                        placeholder="Executive Tunnel Engineer"
                        className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Date</label>
                      <input
                        type="date"
                        value={currentBorehole.signOff.clientDate}
                        onChange={(e) =>
                          updateBorehole({
                            ...currentBorehole,
                            signOff: { ...currentBorehole.signOff, clientDate: e.target.value },
                          })
                        }
                        className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Signature</label>
                  <div className="h-20 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center overflow-hidden mb-2 relative">
                    {currentBorehole.signOff.clientSignature ? (
                      <img
                        src={currentBorehole.signOff.clientSignature}
                        alt="Client Signature"
                        className="max-h-16 object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">No signature recorded</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveSigRole('client')}
                      className="flex-1 py-1 rounded text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <PenTool className="w-3 h-3" />
                      <span>Draw / Sign</span>
                    </button>

                    {activeGeologistProfile && activeGeologistProfile.role === 'Client' && (
                      <button
                        type="button"
                        onClick={() => applyActiveGeologistSignature('client')}
                        className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                        title="Auto-sign with active profile"
                      >
                        Use Profile
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: DATA & STORAGE REGISTRY IN-PAGE */}
        {activeTab === 'storage' && (
          <div className="max-w-7xl mx-auto">
            <CoreDataAndStorageModal
              boreholes={boreholes}
              activeBoreholeId={currentBorehole.id}
              onSelectBorehole={handleSelectBorehole}
              onUpdateBoreholesList={(list) => {
                setBoreholes(list);
                saveBoreholeRecordsToStorage(list);
              }}
              onCreateNewHole={handleOpenCreateBorehole}
              onOpenReportForBorehole={(b) => {
                setTargetReportBorehole(b);
                setIsReportOpen(true);
              }}
              onClose={() => setActiveTab('metadata')}
              embedded={true}
            />
          </div>
        )}
      </main>

      {/* MODAL 1: ADD / EDIT CORE RUN MODAL */}
      {isRunModalOpen && editingRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span>Core Run #{editingRun.runNumber} Data Entry</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsRunModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Depth & Recovery Inputs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Depth From (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingRun.depthFrom}
                    onChange={(e) => {
                      const from = parseFloat(e.target.value) || 0;
                      const metrics = calculateRunMetrics(from, editingRun.depthTo, editingRun.coreRecovered, editingRun.soundPiecesOver10cm);
                      setEditingRun({ ...editingRun, depthFrom: from, ...metrics });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Depth To (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingRun.depthTo}
                    onChange={(e) => {
                      const to = parseFloat(e.target.value) || 0;
                      const metrics = calculateRunMetrics(editingRun.depthFrom, to, editingRun.coreRecovered, editingRun.soundPiecesOver10cm);
                      setEditingRun({ ...editingRun, depthTo: to, ...metrics });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Core Recovered (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingRun.coreRecovered}
                    onChange={(e) => {
                      const rec = parseFloat(e.target.value) || 0;
                      const metrics = calculateRunMetrics(editingRun.depthFrom, editingRun.depthTo, rec, editingRun.soundPiecesOver10cm);
                      setEditingRun({ ...editingRun, coreRecovered: rec, ...metrics });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Pieces ≥10cm (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingRun.soundPiecesOver10cm}
                    onChange={(e) => {
                      const sound = parseFloat(e.target.value) || 0;
                      const metrics = calculateRunMetrics(editingRun.depthFrom, editingRun.depthTo, editingRun.coreRecovered, sound);
                      setEditingRun({ ...editingRun, soundPiecesOver10cm: sound, ...metrics });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Instant Calculated Metrics Preview */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800">
                  <span className="text-[10px] font-bold text-orange-800 dark:text-orange-300 block uppercase">
                    Run Length
                  </span>
                  <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                    {editingRun.runLength.toFixed(2)} m
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800">
                  <span className="text-[10px] font-bold text-orange-800 dark:text-orange-300 block uppercase">
                    TCR (Total Recovery)
                  </span>
                  <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                    {editingRun.tcrPercent.toFixed(1)}%
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800">
                  <span className="text-[10px] font-bold text-orange-800 dark:text-orange-300 block uppercase">
                    RQD &amp; Rating
                  </span>
                  <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                    {editingRun.rqdPercent.toFixed(1)}% ({editingRun.rqdRating})
                  </span>
                </div>
              </div>

              {/* Lithology & Geotechnical Classifications */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Lithology / Rock Type
                  </label>
                  <select
                    value={editingRun.lithology}
                    onChange={(e) => {
                      const selected = COMMON_LITHOLOGIES.find((l) => l.name === e.target.value);
                      setEditingRun({
                        ...editingRun,
                        lithology: e.target.value,
                        lithologyColor: selected?.color || '#FB7185',
                      });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-semibold"
                  >
                    {COMMON_LITHOLOGIES.map((l) => (
                      <option key={l.name} value={l.name}>
                        {l.name} ({l.group})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Weathering Grade
                  </label>
                  <select
                    value={editingRun.weathering}
                    onChange={(e) =>
                      setEditingRun({
                        ...editingRun,
                        weathering: e.target.value as any,
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-semibold"
                  >
                    {WEATHERING_GRADES.map((w) => (
                      <option key={w.code} value={w.code}>
                        {w.code} - {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    ISRM Strength Grade
                  </label>
                  <select
                    value={editingRun.strengthGrade}
                    onChange={(e) =>
                      setEditingRun({
                        ...editingRun,
                        strengthGrade: e.target.value as any,
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-semibold"
                  >
                    {STRENGTH_GRADES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code} ({s.ucsRange})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Core Box & Fractures */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Core Box Number
                  </label>
                  <input
                    type="text"
                    value={editingRun.coreBoxNumber}
                    onChange={(e) => setEditingRun({ ...editingRun, coreBoxNumber: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Fracture Frequency (FF/m)
                  </label>
                  <input
                    type="number"
                    value={editingRun.fractureFrequency || 0}
                    onChange={(e) =>
                      setEditingRun({ ...editingRun, fractureFrequency: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              {/* Descriptions & Remarks */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Discontinuity Description &amp; Joint Sets
                </label>
                <input
                  type="text"
                  value={editingRun.discontinuitiesDescription || ''}
                  onChange={(e) => setEditingRun({ ...editingRun, discontinuitiesDescription: e.target.value })}
                  placeholder="e.g. J1 dip 65°, rough planar, tight contact; calcite infill <1mm"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Geological Remarks &amp; Ingress Observations
                </label>
                <input
                  type="text"
                  value={editingRun.remarks || ''}
                  onChange={(e) => setEditingRun({ ...editingRun, remarks: e.target.value })}
                  placeholder="e.g. Intact solid cylindrical core; no water ingress observed"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRunModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveRun(editingRun)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-sm cursor-pointer"
              >
                Save Run Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT CORE BOX PHOTO MODAL */}
      {isPhotoModalOpen && editingPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Core Box #{editingPhoto.boxNumber} Photo Entry
              </h3>
              <button
                type="button"
                onClick={() => setIsPhotoModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Box Number
                  </label>
                  <input
                    type="text"
                    value={editingPhoto.boxNumber}
                    onChange={(e) => setEditingPhoto({ ...editingPhoto, boxNumber: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    From (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingPhoto.depthFrom}
                    onChange={(e) =>
                      setEditingPhoto({ ...editingPhoto, depthFrom: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    To (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingPhoto.depthTo}
                    onChange={(e) =>
                      setEditingPhoto({ ...editingPhoto, depthTo: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Core Condition
                </label>
                <div className="flex items-center gap-3">
                  {(['Wet', 'Dry', 'Natural'] as const).map((cond) => (
                    <label key={cond} className="flex items-center gap-1.5 cursor-pointer font-semibold">
                      <input
                        type="radio"
                        checked={editingPhoto.condition === cond}
                        onChange={() => setEditingPhoto({ ...editingPhoto, condition: cond })}
                        className="text-orange-600"
                      />
                      <span>{cond}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Photo Upload / Camera Picker */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Core Box Photo Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const dataUrl = evt.target?.result as string;
                        setEditingPhoto({ ...editingPhoto, photoUrl: dataUrl });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 cursor-pointer"
                />

                {editingPhoto.photoUrl && (
                  <div className="mt-2 h-36 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                    <img
                      src={editingPhoto.photoUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Notes / Observations
                </label>
                <input
                  type="text"
                  value={editingPhoto.notes || ''}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, notes: e.target.value })}
                  placeholder="e.g. Natural daylight photo showing clean core joints"
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPhotoModalOpen(false)}
                className="px-3 py-1.5 rounded text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSavePhoto(editingPhoto)}
                className="px-4 py-1.5 rounded text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white cursor-pointer"
              >
                Save Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DRAW SIGNATURE PAD MODAL */}
      {activeSigRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase flex items-center gap-1.5">
                <PenTool className="w-4 h-4 text-orange-600" />
                <span>Draw {activeSigRole} Geologist Signature</span>
              </h3>
              <button
                type="button"
                onClick={() => setActiveSigRole(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-500">
                Use your finger or mouse to draw your signature below or upload a PNG file.
              </p>

              <div className="border-2 border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden bg-white">
                <canvas
                  ref={sigCanvasRef}
                  width={380}
                  height={150}
                  onMouseDown={startDrawingSig}
                  onMouseMove={drawSig}
                  onMouseUp={stopDrawingSig}
                  onMouseLeave={stopDrawingSig}
                  onTouchStart={startDrawingSig}
                  onTouchMove={drawSig}
                  onTouchEnd={stopDrawingSig}
                  className="w-full h-36 touch-none cursor-crosshair block"
                />
              </div>

              {/* Upload PNG Alternative */}
              <div className="pt-2 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={clearSigCanvas}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Clear Pad
                </button>

                <label className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer inline-flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  <span>Upload PNG</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          const dataUrl = evt.target?.result as string;
                          const signOff = { ...currentBorehole.signOff };
                          const today = new Date().toISOString().split('T')[0];
                          if (activeSigRole === 'contractor') {
                            signOff.contractorSignature = dataUrl;
                            signOff.contractorDate = today;
                          } else if (activeSigRole === 'pmc') {
                            signOff.pmcSignature = dataUrl;
                            signOff.pmcDate = today;
                          } else {
                            signOff.clientSignature = dataUrl;
                            signOff.clientDate = today;
                          }
                          updateBorehole({ ...currentBorehole, signOff });
                          setActiveSigRole(null);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveSigRole(null)}
                className="px-3 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveSigCanvasToRole(activeSigRole)}
                className="px-4 py-1.5 rounded text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white cursor-pointer"
              >
                Save Signature
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE NEW BOREHOLE MODAL */}
      {isCreateBoreholeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-orange-600 text-white shadow-xs">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Create New Borehole Log</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Set up engineering parameters for a new continuous core logging sheet.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateBoreholeModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleCreateNewBoreholeSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Borehole ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newBoreholeForm.boreholeId}
                    onChange={(e) => setNewBoreholeForm({ ...newBoreholeForm, boreholeId: e.target.value })}
                    placeholder="e.g. BH-02, PBH-104"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-sm"
                    autoFocus
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={newBoreholeForm.projectName}
                    onChange={(e) => setNewBoreholeForm({ ...newBoreholeForm, projectName: e.target.value })}
                    placeholder="Project Name"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Location / Chainage
                  </label>
                  <input
                    type="text"
                    value={newBoreholeForm.chainageLabel}
                    onChange={(e) => setNewBoreholeForm({ ...newBoreholeForm, chainageLabel: e.target.value })}
                    placeholder="e.g. Ch. 120+450"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Tunnel Alignment / Drive
                  </label>
                  <input
                    type="text"
                    value={newBoreholeForm.tunnelName}
                    onChange={(e) => setNewBoreholeForm({ ...newBoreholeForm, tunnelName: e.target.value })}
                    placeholder="e.g. Main Tunnel Drive"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Collar RL (m a.s.l.)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={newBoreholeForm.collarElevation}
                    onChange={(e) => setNewBoreholeForm({ ...newBoreholeForm, collarElevation: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Inclination (°)
                  </label>
                  <input
                    type="number"
                    value={newBoreholeForm.inclinationDeg}
                    onChange={(e) => setNewBoreholeForm({ ...newBoreholeForm, inclinationDeg: parseInt(e.target.value, 10) || -90 })}
                    placeholder="-90 for vertical"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Azimuth (°)
                  </label>
                  <input
                    type="number"
                    value={newBoreholeForm.azimuthDeg}
                    onChange={(e) => setNewBoreholeForm({ ...newBoreholeForm, azimuthDeg: parseInt(e.target.value, 10) || 0 })}
                    placeholder="0 - 360"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Core Diameter
                  </label>
                  <select
                    value={newBoreholeForm.coreDiameter}
                    onChange={(e) => setNewBoreholeForm({ ...newBoreholeForm, coreDiameter: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                  >
                    {CORE_DIAMETERS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Drilling Method
                  </label>
                  <select
                    value={newBoreholeForm.drillingMethod}
                    onChange={(e) => setNewBoreholeForm({ ...newBoreholeForm, drillingMethod: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                  >
                    {DRILLING_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Drilling Contractor
                  </label>
                  <input
                    type="text"
                    value={newBoreholeForm.drillingContractor}
                    onChange={(e) => setNewBoreholeForm({ ...newBoreholeForm, drillingContractor: e.target.value })}
                    placeholder="Contractor entity"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Logged By (Geologist)
                  </label>
                  <input
                    type="text"
                    value={newBoreholeForm.loggedBy}
                    onChange={(e) => setNewBoreholeForm({ ...newBoreholeForm, loggedBy: e.target.value })}
                    placeholder="Geologist name"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateBoreholeModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-sm cursor-pointer"
                >
                  Create &amp; View Hole Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: FULL PRINTABLE GEOTECHNICAL STRIP LOG REPORT */}
      {isReportOpen && (
        <CoreLogReportModal
          borehole={targetReportBorehole || currentBorehole}
          onClose={() => {
            setIsReportOpen(false);
            setTargetReportBorehole(null);
          }}
        />
      )}

      {/* MODAL 6: DATA & STORAGE REGISTRY MODAL */}
      {isStorageCenterOpen && (
        <CoreDataAndStorageModal
          boreholes={boreholes}
          activeBoreholeId={currentBorehole.id}
          onSelectBorehole={handleSelectBorehole}
          onUpdateBoreholesList={(list) => {
            setBoreholes(list);
            saveBoreholeRecordsToStorage(list);
          }}
          onCreateNewHole={handleOpenCreateBorehole}
          onOpenReportForBorehole={(b) => {
            setTargetReportBorehole(b);
            setIsReportOpen(true);
          }}
          onClose={() => setIsStorageCenterOpen(false)}
        />
      )}
    </div>
  );
};
