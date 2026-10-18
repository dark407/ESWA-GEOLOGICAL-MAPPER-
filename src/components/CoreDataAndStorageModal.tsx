import React, { useState, useRef } from 'react';
import {
  BoreholeRecord,
  calculateBoreholeSummary,
  getRqdBadgeColor,
  getAllBenchmarkBoreholes,
  duplicateBoreholeRecord,
  downloadBoreholeJSONFile,
  downloadRunsCSVFile,
  importBoreholesFromJSON,
  calculateStorageUsage,
} from '../engine/coreLoggingEngine';
import {
  Database,
  Download,
  Upload,
  Plus,
  Trash2,
  Copy,
  Printer,
  X,
  Search,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  AlertTriangle,
  FolderArchive,
  Sparkles,
  ShieldCheck,
  Eye,
  Camera,
} from 'lucide-react';

interface CoreDataAndStorageModalProps {
  boreholes: BoreholeRecord[];
  activeBoreholeId: string;
  onSelectBorehole: (id: string) => void;
  onUpdateBoreholesList: (list: BoreholeRecord[]) => void;
  onCreateNewHole: () => void;
  onOpenReportForBorehole: (borehole: BoreholeRecord) => void;
  onClose: () => void;
  embedded?: boolean;
}

export const CoreDataAndStorageModal: React.FC<CoreDataAndStorageModalProps> = ({
  boreholes,
  activeBoreholeId,
  onSelectBorehole,
  onUpdateBoreholesList,
  onCreateNewHole,
  onOpenReportForBorehole,
  onClose,
  embedded = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedBoreholeId, setInspectedBoreholeId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Storage metrics
  const storageUsage = calculateStorageUsage();

  // Aggregate stats across all logged holes
  const totalDrilledAllHoles = boreholes.reduce((acc, b) => {
    const sum = calculateBoreholeSummary(b);
    return acc + sum.totalDrilledDepth;
  }, 0);

  const totalRunsAllHoles = boreholes.reduce((acc, b) => acc + (b.runs?.length || 0), 0);
  const totalPhotosAllHoles = boreholes.reduce((acc, b) => acc + (b.photos?.length || 0), 0);

  // Filtered boreholes
  const filteredBoreholes = boreholes.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      b.boreholeId.toLowerCase().includes(q) ||
      b.projectName.toLowerCase().includes(q) ||
      (b.tunnelName && b.tunnelName.toLowerCase().includes(q)) ||
      (b.chainageLabel && b.chainageLabel.toLowerCase().includes(q)) ||
      (b.loggedBy && b.loggedBy.toLowerCase().includes(q))
    );
  });

  const inspectedBorehole = boreholes.find((b) => b.id === inspectedBoreholeId) || null;
  const inspectedSummary = inspectedBorehole ? calculateBoreholeSummary(inspectedBorehole) : null;

  // Show status feedback
  const triggerStatus = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Duplicate a borehole
  const handleDuplicate = (source: BoreholeRecord) => {
    const nextNum = boreholes.length + 1;
    const nextId = `BH-${String(nextNum).padStart(2, '0')}`;
    const duplicated = duplicateBoreholeRecord(source, nextId);
    const updatedList = [...boreholes, duplicated];
    onUpdateBoreholesList(updatedList);
    triggerStatus(`Borehole ${source.boreholeId} duplicated as ${nextId}`, 'success');
  };

  // Delete a borehole
  const handleDelete = (id: string) => {
    if (boreholes.length <= 1) {
      triggerStatus('Cannot delete the last remaining borehole record.', 'error');
      setDeleteConfirmId(null);
      return;
    }
    const target = boreholes.find((b) => b.id === id);
    const updatedList = boreholes.filter((b) => b.id !== id);
    onUpdateBoreholesList(updatedList);
    if (activeBoreholeId === id) {
      onSelectBorehole(updatedList[0].id);
    }
    if (inspectedBoreholeId === id) {
      setInspectedBoreholeId(null);
    }
    setDeleteConfirmId(null);
    triggerStatus(`Deleted borehole ${target?.boreholeId || id}`, 'info');
  };

  // Load benchmark dataset
  const handleLoadBenchmarks = () => {
    const benchmarks = getAllBenchmarkBoreholes();
    // Merge without duplicating existing IDs
    const existingIds = new Set(boreholes.map((b) => b.boreholeId));
    const toAdd = benchmarks.filter((b) => !existingIds.has(b.boreholeId));
    if (toAdd.length === 0) {
      triggerStatus('All 3 benchmark boreholes (BH-01, BH-02, BH-03) are already in your storage.', 'info');
      return;
    }
    const merged = [...boreholes, ...toAdd];
    onUpdateBoreholesList(merged);
    triggerStatus(`Added ${toAdd.length} benchmark borehole(s) (BH-02, BH-03) to storage.`, 'success');
  };

  // Handle JSON Import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const res = importBoreholesFromJSON(text);
      if (res.success && res.records.length > 0) {
        // Merge with existing boreholes by boreholeId or append
        const existingMap = new Map(boreholes.map((b) => [b.boreholeId, b]));
        res.records.forEach((imported) => {
          existingMap.set(imported.boreholeId, imported);
        });
        const mergedList = Array.from(existingMap.values());
        onUpdateBoreholesList(mergedList);
        triggerStatus(`Successfully imported ${res.records.length} borehole(s) into local storage.`, 'success');
      } else {
        triggerStatus(res.message, 'error');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const mainContent = (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full flex flex-col overflow-hidden ${embedded ? '' : 'max-w-6xl max-h-[94vh] my-auto'}`}>
      {/* Top Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-md">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Geotechnical Core Data &amp; Storage Registry
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300 border border-orange-300 dark:border-orange-800">
                {boreholes.length} Logged Hole{boreholes.length !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Access, inspect, backup, import, duplicate, and manage all borehole run logs and core box records.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!embedded && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Data &amp; Storage"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

        {/* Global Storage & Data KPI Metrics Strip */}
        <div className="bg-slate-100 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-semibold uppercase text-[10px]">Total Boreholes:</span>
              <span className="font-mono font-black text-slate-900 dark:text-white">{boreholes.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-semibold uppercase text-[10px]">Total Drilled Depth:</span>
              <span className="font-mono font-black text-slate-900 dark:text-white">
                {totalDrilledAllHoles.toFixed(2)} m
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-semibold uppercase text-[10px]">Total Core Runs:</span>
              <span className="font-mono font-black text-slate-900 dark:text-white">{totalRunsAllHoles}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-semibold uppercase text-[10px]">Core Box Photos:</span>
              <span className="font-mono font-black text-slate-900 dark:text-white">{totalPhotosAllHoles}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-semibold uppercase text-[10px]">Local Storage:</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {storageUsage.formattedSize}
              </span>
              <div className="w-16 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.max(4, storageUsage.percentageOfLimit)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadBenchmarks}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
              title="Load 3 complete benchmark borehole datasets (BH-01, BH-02, BH-03)"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Load Benchmark Holes</span>
            </button>
          </div>
        </div>

        {/* Status Toast Banner */}
        {statusMessage && (
          <div
            className={`px-5 py-2 text-xs font-semibold flex items-center justify-between gap-2 shrink-0 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500 text-white'
                : statusMessage.type === 'error'
                ? 'bg-rose-600 text-white'
                : 'bg-blue-600 text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
              {statusMessage.type === 'error' && <AlertTriangle className="w-4 h-4" />}
              {statusMessage.type === 'info' && <FolderArchive className="w-4 h-4" />}
              <span>{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-white/80 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Toolbar & Search Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search boreholes by ID, project, chainage, geologist..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Backup All JSON */}
            <button
              type="button"
              onClick={() => {
                downloadBoreholeJSONFile(boreholes);
                triggerStatus(`Downloaded full backup JSON with ${boreholes.length} borehole logs.`, 'success');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
              title="Download all borehole records in JSON archive"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span>Backup All (JSON)</span>
            </button>

            {/* Export All CSV */}
            <button
              type="button"
              onClick={() => {
                downloadRunsCSVFile(boreholes);
                triggerStatus(`Exported continuous runs CSV for ${boreholes.length} boreholes.`, 'success');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
              title="Export all run data into CSV for CAD / Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Runs (CSV)</span>
            </button>

            {/* Import JSON */}
            <label
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
              title="Import borehole archive from JSON file"
            >
              <Upload className="w-3.5 h-3.5 text-orange-500" />
              <span>Import JSON</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Create New Hole */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onCreateNewHole();
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Hole</span>
            </button>
          </div>
        </div>

        {/* Content Area: Main Registry Table & Inspector */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Borehole Cards / Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-4 w-12 text-center">Status</th>
                    <th className="py-2.5 px-4">Borehole ID</th>
                    <th className="py-2.5 px-4">Project &amp; Location</th>
                    <th className="py-2.5 px-4 text-center">Drilled Depth</th>
                    <th className="py-2.5 px-4 text-center">Runs</th>
                    <th className="py-2.5 px-4 text-center">TCR % (Recovery)</th>
                    <th className="py-2.5 px-4 text-center">RQD %</th>
                    <th className="py-2.5 px-4">Dominant Rock</th>
                    <th className="py-2.5 px-4 text-center">Sign-Off</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredBoreholes.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <FolderArchive className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                        <p className="font-semibold text-slate-600 dark:text-slate-300">No boreholes found</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Try adjusting your search query or click "Create Hole" to begin logging.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredBoreholes.map((b) => {
                      const sm = calculateBoreholeSummary(b);
                      const badge = getRqdBadgeColor(sm.overallRqdRating);
                      const isActive = b.id === activeBoreholeId;
                      const isInspected = b.id === inspectedBoreholeId;

                      const signOffCount = [
                        Boolean(b.signOff?.contractorSignature || b.signOff?.contractorName),
                        Boolean(b.signOff?.pmcSignature || b.signOff?.pmcName),
                        Boolean(b.signOff?.clientSignature || b.signOff?.clientName),
                      ].filter(Boolean).length;

                      return (
                        <tr
                          key={b.id}
                          className={`transition-colors ${
                            isActive
                              ? 'bg-orange-50/60 dark:bg-orange-950/20'
                              : isInspected
                              ? 'bg-slate-50 dark:bg-slate-800/40'
                              : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30'
                          }`}
                        >
                          {/* Active Status Badge */}
                          <td className="py-3 px-4 text-center">
                            {isActive ? (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                title="Currently open in workspace"
                              >
                                Active
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectBorehole(b.id);
                                  triggerStatus(`Switched active hole to ${b.boreholeId}`, 'info');
                                }}
                                className="text-[10px] font-semibold text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 hover:underline cursor-pointer"
                                title="Click to make this borehole active in workspace"
                              >
                                Select
                              </button>
                            )}
                          </td>

                          {/* Hole ID */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                                {b.boreholeId}
                              </span>
                              {b.coreDiameter && (
                                <span className="font-mono text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                                  {b.coreDiameter.split(' ')[0]}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {b.chainageLabel || 'Chainage N/A'}
                            </div>
                          </td>

                          {/* Project & Alignment */}
                          <td className="py-3 px-4 max-w-[200px]">
                            <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {b.projectName}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {b.tunnelName || 'Tunnel Alignment'} &bull; RL: {b.collarElevation || 0}m
                            </div>
                          </td>

                          {/* Total Depth */}
                          <td className="py-3 px-4 text-center font-mono font-black text-slate-900 dark:text-white">
                            {sm.totalDrilledDepth.toFixed(2)} m
                          </td>

                          {/* Runs count */}
                          <td className="py-3 px-4 text-center font-mono text-slate-700 dark:text-slate-300">
                            {sm.runCount}
                          </td>

                          {/* TCR % Recovery */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                {sm.averageTcr.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-16 mx-auto h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mt-1">
                              <div
                                className={`h-full ${
                                  sm.averageTcr >= 90
                                    ? 'bg-emerald-500'
                                    : sm.averageTcr >= 70
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(100, sm.averageTcr)}%` }}
                              />
                            </div>
                          </td>

                          {/* RQD % */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className="font-mono font-bold text-slate-900 dark:text-white">
                                {sm.averageRqd.toFixed(1)}%
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                              >
                                {sm.overallRqdRating}
                              </span>
                            </div>
                          </td>

                          {/* Dominant Rock */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {sm.dominantLithology}
                            </div>
                            <div className="text-[10px] text-slate-400">Weathering: {sm.dominantWeathering}</div>
                          </td>

                          {/* Sign-Off status */}
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                signOffCount === 3
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : signOffCount > 0
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              <ShieldCheck className="w-3 h-3" />
                              <span>{signOffCount}/3 Parties</span>
                            </span>
                          </td>

                          {/* Action Buttons */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Open / Switch Hole */}
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectBorehole(b.id);
                                  onClose();
                                }}
                                className="px-2.5 py-1 rounded text-xs font-bold bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 hover:bg-orange-600 hover:text-white border border-orange-200 dark:border-orange-800 transition-colors cursor-pointer"
                                title="Open this hole in main logging workspace"
                              >
                                Open
                              </button>

                              {/* Inspect Details Toggle */}
                              <button
                                type="button"
                                onClick={() =>
                                  setInspectedBoreholeId(inspectedBoreholeId === b.id ? null : b.id)
                                }
                                className={`p-1.5 rounded transition-colors cursor-pointer ${
                                  inspectedBoreholeId === b.id
                                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                                title="Inspect complete details and all runs for this hole"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Print / Report A4 */}
                              <button
                                type="button"
                                onClick={() => onOpenReportForBorehole(b)}
                                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-orange-600 transition-colors cursor-pointer"
                                title="Generate A4 Engineering Strip Log Report"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {/* Duplicate Hole */}
                              <button
                                type="button"
                                onClick={() => handleDuplicate(b)}
                                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors cursor-pointer"
                                title="Duplicate borehole parameters for next hole"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              {/* Single JSON Export */}
                              <button
                                type="button"
                                onClick={() => {
                                  downloadBoreholeJSONFile([b], `${b.boreholeId}_Core_Log_${new Date().toISOString().split('T')[0]}.json`);
                                  triggerStatus(`Exported JSON for ${b.boreholeId}`, 'success');
                                }}
                                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-colors cursor-pointer"
                                title="Export single borehole JSON"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Hole */}
                              {deleteConfirmId === b.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(b.id)}
                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(b.id)}
                                  className="p-1.5 rounded hover:bg-rose-100 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                  title="Delete borehole record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* COMPLETE HOLE DETAIL INSPECTOR ACCORDION / DRAWER */}
          {inspectedBorehole && inspectedSummary && (
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-md border-2 border-orange-400 dark:border-orange-600 overflow-hidden animate-fadeIn">
              {/* Inspector Header */}
              <div className="px-5 py-3.5 bg-orange-500 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Eye className="w-4 h-4" />
                  <h3 className="font-bold text-sm">
                    Complete Geotechnical Inspection: {inspectedBorehole.boreholeId} ({inspectedBorehole.projectName})
                  </h3>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono">
                    Total Depth: {inspectedSummary.totalDrilledDepth.toFixed(2)}m &bull; {inspectedSummary.runCount} Runs
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectBorehole(inspectedBorehole.id);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-3 py-1 rounded text-xs font-bold bg-white text-orange-600 hover:bg-orange-50 transition-colors cursor-pointer shadow-xs"
                  >
                    <span>Open in Workspace</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setInspectedBoreholeId(null)}
                    className="p-1 rounded text-white/80 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Inspector Content Grid */}
              <div className="p-5 space-y-5 text-xs">
                {/* Hole Parameters Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Collar RL</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {inspectedBorehole.collarElevation || 0} m a.s.l.
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Inclination / Azimuth</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {inspectedBorehole.inclinationDeg}° / {inspectedBorehole.azimuthDeg}°
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Core Diameter</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{inspectedBorehole.coreDiameter}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Drilling Method</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                      {inspectedBorehole.drillingMethod}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Core Recovery</span>
                    <span className="font-mono font-black text-slate-900 dark:text-white">
                      {inspectedSummary.averageTcr.toFixed(1)}% TCR
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">RQD Rating</span>
                    <span className="font-mono font-black text-slate-900 dark:text-white">
                      {inspectedSummary.averageRqd.toFixed(1)}% ({inspectedSummary.overallRqdRating})
                    </span>
                  </div>
                </div>

                {/* All Continuous Runs Table */}
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Continuous Run Log Table ({inspectedBorehole.runs.length} runs)</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      ISO 22475-1 / ASTM D2113 Engineering Runs
                    </span>
                  </h4>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-700">
                            <th className="py-2 px-3 text-center">Run #</th>
                            <th className="py-2 px-3 text-center">Depth (From - To)</th>
                            <th className="py-2 px-3 text-center">Length</th>
                            <th className="py-2 px-3 text-center">Recovered</th>
                            <th className="py-2 px-3 text-center">TCR %</th>
                            <th className="py-2 px-3 text-center">≥10cm Sound</th>
                            <th className="py-2 px-3 text-center">RQD %</th>
                            <th className="py-2 px-3 text-center">Rating</th>
                            <th className="py-2 px-3 text-center">Lithology</th>
                            <th className="py-2 px-3 text-center">Wth / Strength</th>
                            <th className="py-2 px-3">Discontinuities / Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {inspectedBorehole.runs.map((r) => {
                            const rb = getRqdBadgeColor(r.rqdRating);
                            return (
                              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="py-2 px-3 text-center font-mono font-bold">{r.runNumber}</td>
                                <td className="py-2 px-3 text-center font-mono">
                                  {r.depthFrom.toFixed(2)} - {r.depthTo.toFixed(2)}m
                                </td>
                                <td className="py-2 px-3 text-center font-mono text-slate-500">
                                  {r.runLength.toFixed(2)}m
                                </td>
                                <td className="py-2 px-3 text-center font-mono font-bold">{r.coreRecovered.toFixed(2)}m</td>
                                <td className="py-2 px-3 text-center font-mono font-bold">
                                  <span className={r.tcrPercent >= 90 ? 'text-emerald-600' : 'text-amber-600'}>
                                    {r.tcrPercent.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-center font-mono">{r.soundPiecesOver10cm.toFixed(2)}m</td>
                                <td className="py-2 px-3 text-center font-mono font-black">{r.rqdPercent.toFixed(1)}%</td>
                                <td className="py-2 px-3 text-center">
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${rb.bg} ${rb.text} ${rb.border}`}
                                  >
                                    {r.rqdRating}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span
                                    className="px-2 py-0.5 rounded text-[11px] font-semibold"
                                    style={{
                                      backgroundColor: r.lithologyColor ? `${r.lithologyColor}25` : '#f1f5f9',
                                      color: r.lithologyColor || '#0f172a',
                                      border: `1px solid ${r.lithologyColor || '#cbd5e1'}`,
                                    }}
                                  >
                                    {r.lithology}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-center font-mono font-bold">
                                  {r.weathering} / {r.strengthGrade}
                                </td>
                                <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                                  <div className="truncate max-w-[260px] font-medium">
                                    {r.discontinuitiesDescription || r.remarks || '—'}
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

                {/* Core Box Photos Gallery */}
                {inspectedBorehole.photos && inspectedBorehole.photos.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Camera className="w-3.5 h-3.5 text-orange-500" />
                      <span>Core Box Photographic Records ({inspectedBorehole.photos.length} boxes)</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {inspectedBorehole.photos.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800"
                        >
                          <div className="aspect-16/9 bg-slate-200 dark:bg-slate-800 rounded flex items-center justify-center overflow-hidden mb-2">
                            {p.photoUrl ? (
                              <img src={p.photoUrl} alt={p.photoTitle} className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-center p-3 text-slate-400">
                                <Camera className="w-6 h-6 mx-auto mb-1 opacity-50" />
                                <span className="text-[10px]">Photo Recorded</span>
                              </div>
                            )}
                          </div>
                          <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                            Box #{p.boxNumber} ({p.depthFrom.toFixed(2)}m - {p.depthTo.toFixed(2)}m)
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {p.photoTitle || p.notes || 'Condition: ' + p.condition}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sign-Off Parties Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">1. Contractor Geologist</span>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {inspectedBorehole.signOff?.contractorName || 'Pending'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {inspectedBorehole.signOff?.contractorDesignation || inspectedBorehole.drillingContractor}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">2. PMC Geotechnical Lead</span>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {inspectedBorehole.signOff?.pmcName || 'Pending'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {inspectedBorehole.signOff?.pmcDesignation || inspectedBorehole.pmcConsultant}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">3. Client Project Director</span>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {inspectedBorehole.signOff?.clientName || 'Pending'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {inspectedBorehole.signOff?.clientDesignation || inspectedBorehole.clientEmployer}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <div className="text-slate-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Persistent HTML5 LocalStorage Active &bull; Auto-syncs continuously</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              {embedded ? 'Close Registry' : 'Close'}
            </button>
          </div>
        </div>
      </div>
  );

  if (embedded) {
    return <div className="max-w-7xl mx-auto">{mainContent}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      {mainContent}
    </div>
  );
};
