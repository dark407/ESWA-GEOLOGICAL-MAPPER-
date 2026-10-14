import React, { useRef, useState } from 'react';
import {
  OutputSheetMode,
  RockMassClassificationMethodId,
  SavedProjectRecord,
} from '../types/tunnel';
import { SheetLayoutArrangement } from '../engine/sheetLayoutEngine';
import { parseNumericChainageMeters } from '../engine/projectMemoryEngine';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  Eye,
  FileCode,
  FileSpreadsheet,
  FolderUp,
  Image as ImageIcon,
  Layers,
  Pause,
  Play,
  Plus,
  Printer,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react';

export type BatchItemStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'ERROR';

export interface BatchQueueItem {
  queueId: string;
  record: SavedProjectRecord;
  status: BatchItemStatus;
  processedAt?: string;
  errorMessage?: string;
  outputs?: {
    svgString: string;
    pngDataUrl: string;
    dxfString: string;
    csvString: string;
    fileBaseName: string;
    summaryMetrics: {
      sequenceNumber: number;
      projectName: string;
      location: string;
      tunnelName: string;
      chainage: string;
      faceChainage: string;
      numericRdMeters: number | null;
      date: string;
      outputMode: OutputSheetMode;
      classificationMethod: RockMassClassificationMethodId;
      widthM: number;
      heightM: number;
      driveDirectionDeg: number;
      lithology: string;
      jointCount: number;
      jointSetCount: number;
      qValue: string;
      rmrValue: string;
      gsiValue: string;
      designAreaSqM: number;
      surveyedAreaSqM: number;
      overbreakAreaSqM: number;
      overbreakPct: number;
      undercutAreaSqM: number;
      undercutPct: number;
      overbreakVolM3: string;
      qcStatus: string;
    };
  };
}

export interface BatchStandardizedConfig {
  outputMode: OutputSheetMode;
  arrangement: SheetLayoutArrangement;
  classificationOverride: 'KEEP_RECORD' | RockMassClassificationMethodId;
  standardizeHeaderAndLogos: boolean;
  confirmAllOrientations: boolean;
  overlayOverbreakOnGeology: boolean;
  overlayJointsOnQuantity: boolean;
  autoDownloadFormat: {
    svg: boolean;
    png: boolean;
    dxf: boolean;
    csv: boolean;
  };
}

interface BatchSheetProcessorPanelProps {
  savedProjects: SavedProjectRecord[];
  queue: BatchQueueItem[];
  config: BatchStandardizedConfig;
  onUpdateConfig: React.Dispatch<React.SetStateAction<BatchStandardizedConfig>>;
  isRunning: boolean;
  isPaused: boolean;
  activeQueueIndex: number | null;
  previewQueueId: string | null;
  onAddRecordToQueue: (record: SavedProjectRecord) => void;
  onAddAllSavedToQueue: () => void;
  onAddCurrentWorkspaceToQueue: () => void;
  onImportJsonFilesToQueue: (files: FileList) => void;
  onRemoveQueueItem: (queueId: string) => void;
  onMoveQueueItem: (queueId: string, dir: -1 | 1) => void;
  onSortQueue: (by: 'chainage_asc' | 'chainage_desc' | 'date_asc') => void;
  onClearQueue: () => void;
  onSelectPreviewItem: (queueId: string | null) => void;
  onStartBatch: () => void;
  onPauseResumeBatch: () => void;
  onStopResetBatch: () => void;
  onDownloadSingleOutput: (
    item: BatchQueueItem,
    format: 'svg' | 'png' | 'dxf' | 'csv'
  ) => void;
  onDownloadConsolidatedCSV: () => void;
  onDownloadConsolidatedJSON: () => void;
  onDownloadMultiSheetHtmlBook: () => void;
  onPrintMultiSheetPdfBook: () => void;
}

export const BatchSheetProcessorPanel: React.FC<BatchSheetProcessorPanelProps> = ({
  savedProjects,
  queue,
  config,
  onUpdateConfig,
  isRunning,
  isPaused,
  activeQueueIndex,
  previewQueueId,
  onAddRecordToQueue,
  onAddAllSavedToQueue,
  onAddCurrentWorkspaceToQueue,
  onImportJsonFilesToQueue,
  onRemoveQueueItem,
  onMoveQueueItem,
  onSortQueue,
  onClearQueue,
  onSelectPreviewItem,
  onStartBatch,
  onPauseResumeBatch,
  onStopResetBatch,
  onDownloadSingleOutput,
  onDownloadConsolidatedCSV,
  onDownloadConsolidatedJSON,
  onDownloadMultiSheetHtmlBook,
  onPrintMultiSheetPdfBook,
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'standardize' | 'results'>('queue');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const completedItems = queue.filter((item) => item.status === 'COMPLETED' && item.outputs);
  const progressPct =
    queue.length > 0 ? Math.round((completedItems.length / queue.length) * 100) : 0;

  const filteredSavedProjects = savedProjects.filter((rec) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (rec.projectName || '').toLowerCase().includes(q) ||
      (rec.tunnelName || '').toLowerCase().includes(q) ||
      (rec.location || '').toLowerCase().includes(q) ||
      (rec.faceChainage || '').toLowerCase().includes(q) ||
      (rec.chainage || '').toLowerCase().includes(q) ||
      (rec.date || '').toLowerCase().includes(q)
    );
  });

  const isRecordInQueue = (recordId: string) =>
    queue.some((item) => item.record.id === recordId);

  return (
    <div className="flex flex-col h-full text-xs font-mono text-slate-100 bg-[#111621]">
      {/* Segmented Navigation Bar */}
      <div className="grid grid-cols-3 gap-1 p-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('queue')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded font-semibold transition-colors cursor-pointer ${
            activeTab === 'queue'
              ? 'bg-cyan-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">1. Queue ({queue.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('standardize')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded font-semibold transition-colors cursor-pointer ${
            activeTab === 'standardize'
              ? 'bg-cyan-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">2. Standardize</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('results')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded font-semibold transition-colors cursor-pointer ${
            activeTab === 'results'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:text-white'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            3. Outputs ({completedItems.length}/{queue.length})
          </span>
        </button>
      </div>

      {/* Persistent Batch Execution Control Bar */}
      <div className="p-3 bg-[#0D121B] border-b border-slate-800 space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-200 truncate">
              {isRunning
                ? isPaused
                  ? `Paused at Record ${(activeQueueIndex ?? 0) + 1} of ${queue.length}`
                  : `Processing Record ${(activeQueueIndex ?? 0) + 1} of ${queue.length}...`
                : completedItems.length > 0 && completedItems.length === queue.length
                ? `Batch Sequence Complete (${completedItems.length} Sheets Ready)`
                : `${queue.length} Record(s) Queued for Standardized Output`}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              Mode: {config.outputMode.replace(/_/g, ' ')} ·{' '}
              {config.classificationOverride === 'KEEP_RECORD'
                ? 'Record Classification'
                : `Forced ${config.classificationOverride}`}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isRunning ? (
              <button
                type="button"
                disabled={queue.length === 0}
                onClick={() => {
                  onStartBatch();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-semibold text-xs transition-colors cursor-pointer ${
                  queue.length === 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                Run Sequence
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onPauseResumeBatch}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs cursor-pointer"
                >
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
                <button
                  type="button"
                  onClick={onStopResetBatch}
                  className="flex items-center gap-1 px-2 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs cursor-pointer"
                  title="Stop Batch Processing"
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {completedItems.length > 0 && !isRunning && (
              <button
                type="button"
                onClick={onStopResetBatch}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                title="Reset Processed Status to Re-run"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {queue.length > 0 && (
          <div className="space-y-1">
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-200"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>
                {completedItems.length} of {queue.length} processed ({progressPct}%)
              </span>
              {previewQueueId && (
                <button
                  type="button"
                  onClick={() => onSelectPreviewItem(null)}
                  className="text-cyan-400 hover:underline cursor-pointer"
                >
                  Restore Live Workspace Sheet
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {activeTab === 'queue' && (
          <>
            {/* Quick Queue Actions */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="font-semibold text-cyan-400 text-[11px]">
                  01. Add Project Records to Batch Queue
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.akash.json"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      onImportJsonFilesToQueue(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={onAddCurrentWorkspaceToQueue}
                  className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-cyan-950/90 hover:bg-cyan-900 text-cyan-200 border border-cyan-700/60 rounded font-semibold text-[11px] transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Queue Active Face</span>
                </button>

                <button
                  type="button"
                  onClick={onAddAllSavedToQueue}
                  disabled={savedProjects.length === 0}
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded font-semibold text-[11px] border transition-colors cursor-pointer ${
                    savedProjects.length === 0
                      ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                      : 'bg-emerald-950/90 hover:bg-emerald-900 text-emerald-200 border-emerald-700/60'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Queue All Saved ({savedProjects.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="col-span-2 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded font-medium text-[11px] transition-colors cursor-pointer"
                >
                  <FolderUp className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Import Multiple .akash.json Project Files to Queue</span>
                </button>
              </div>
            </div>

            {/* Active Sequence Queue */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-800 pb-1.5">
                <span className="font-semibold text-emerald-400 text-[11px]">
                  02. Queued Processing Sequence ({queue.length})
                </span>
                {queue.length > 0 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSortQueue('chainage_asc')}
                      className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] cursor-pointer"
                      title="Sort Queue by Chainage (RD Ascending)"
                    >
                      RD ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => onSortQueue('chainage_desc')}
                      className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] cursor-pointer"
                      title="Sort Queue by Chainage (RD Descending)"
                    >
                      RD ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => onSortQueue('date_asc')}
                      className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] cursor-pointer"
                      title="Sort Queue Chronologically by Date"
                    >
                      Date
                    </button>
                    <button
                      type="button"
                      onClick={onClearQueue}
                      disabled={isRunning}
                      className="px-1.5 py-0.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 rounded text-[10px] cursor-pointer"
                      title="Clear Entire Queue"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {queue.length === 0 ? (
                <div className="py-5 text-center text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300">Batch Queue is Empty</div>
                  <div className="text-[11px] text-slate-500">
                    Click &ldquo;Queue Active Face&rdquo;, select from Saved Project Records below, or import .akash.json files.
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {queue.map((item, idx) => {
                    const isPreviewing = previewQueueId === item.queueId;
                    const rd =
                      item.record.numericChainageMeters ??
                      parseNumericChainageMeters(
                        item.record.faceChainage,
                        item.record.chainage
                      );
                    return (
                      <div
                        key={item.queueId}
                        className={`p-2 rounded border transition-colors ${
                          isPreviewing
                            ? 'bg-cyan-950/50 border-cyan-500/70'
                            : item.status === 'PROCESSING'
                            ? 'bg-amber-950/40 border-amber-500/70'
                            : item.status === 'COMPLETED'
                            ? 'bg-emerald-950/25 border-emerald-700/50'
                            : 'bg-slate-950/80 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-100 truncate">
                              <span className="text-cyan-400">
                                {String(idx + 1).padStart(2, '0')}.
                              </span>
                              <span className="truncate">{item.record.tunnelName}</span>
                              <span className="text-slate-500" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-emerald-300">
                                {item.record.faceChainage || item.record.chainage}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">
                              {item.record.location || 'Main Heading'}
                              {' · '}
                              {item.record.joints?.length || 0} Traces
                              {rd !== null ? ` · RD ${rd.toFixed(2)}m` : ''}
                              {' · '}
                              <span
                                className={
                                  item.status === 'COMPLETED'
                                    ? 'text-emerald-400 font-semibold'
                                    : item.status === 'PROCESSING'
                                    ? 'text-amber-300 font-semibold'
                                    : item.status === 'ERROR'
                                    ? 'text-rose-400 font-semibold'
                                    : 'text-slate-400'
                                }
                              >
                                {item.status}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                onSelectPreviewItem(isPreviewing ? null : item.queueId)
                              }
                              className={`px-1.5 py-1 rounded text-[10px] flex items-center gap-1 cursor-pointer ${
                                isPreviewing
                                  ? 'bg-cyan-600 text-white font-semibold'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                              }`}
                              title="Preview this queued record on the Engineering Sheet Canvas"
                            >
                              <Eye className="w-3 h-3" />
                              {isPreviewing ? 'Viewing' : 'View'}
                            </button>
                            <button
                              type="button"
                              disabled={idx === 0 || isRunning}
                              onClick={() => onMoveQueueItem(item.queueId, -1)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 cursor-pointer"
                              title="Move Up in Sequence"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === queue.length - 1 || isRunning}
                              onClick={() => onMoveQueueItem(item.queueId, 1)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 cursor-pointer"
                              title="Move Down in Sequence"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={isRunning}
                              onClick={() => onRemoveQueueItem(item.queueId)}
                              className="p-1 rounded bg-slate-800 hover:bg-rose-700 disabled:opacity-40 text-slate-400 hover:text-white cursor-pointer"
                              title="Remove from Batch Queue"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Saved Project Memory Browser to Pick Individual Records */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="font-semibold text-slate-200 text-[11px]">
                  03. Saved Project Records ({savedProjects.length})
                </span>
              </div>

              {savedProjects.length > 0 && (
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by tunnel, chainage, location or date..."
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-[11px]"
                />
              )}

              {filteredSavedProjects.length === 0 ? (
                <div className="py-3 text-center text-[11px] text-slate-500">
                  {savedProjects.length === 0
                    ? 'No saved records in Project Memory yet. Use "Queue Active Face" or "Save to Storage" to add sections.'
                    : 'No saved project records match your filter.'}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {filteredSavedProjects.map((rec) => {
                    const alreadyQueued = isRecordInQueue(rec.id);
                    return (
                      <div
                        key={rec.id}
                        className="flex items-center justify-between gap-2 p-2 rounded bg-slate-950/70 border border-slate-800/90"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-semibold text-slate-200 truncate">
                            {rec.tunnelName} ·{' '}
                            <span className="text-cyan-300">
                              {rec.faceChainage || rec.chainage}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {rec.location || 'Main Heading'} · {rec.date} ·{' '}
                            {rec.joints?.length || 0} Traces
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onAddRecordToQueue(rec)}
                          className={`px-2.5 py-1 rounded text-[10px] font-semibold shrink-0 cursor-pointer ${
                            alreadyQueued
                              ? 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-700/50'
                              : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                          }`}
                        >
                          {alreadyQueued ? '+ Queue Copy' : '+ Add to Queue'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'standardize' && (
          <div className="space-y-3">
            {/* Standardized Sheet Mode & Layout */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded space-y-3">
              <div className="border-b border-slate-800 pb-1.5">
                <div className="font-semibold text-cyan-400 text-[11px]">
                  01. Standardized Sheet Mode &amp; Geometry Arrangement
                </div>
                <div className="text-[10px] text-slate-400">
                  Applied uniformly to every project record during batch processing
                </div>
              </div>

              <label className="block space-y-1">
                <span className="text-[10px] text-slate-300">Target Engineering Sheet Mode</span>
                <select
                  value={config.outputMode}
                  onChange={(e) =>
                    onUpdateConfig((prev) => ({
                      ...prev,
                      outputMode: e.target.value as OutputSheetMode,
                    }))
                  }
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                >
                  <option value="FINAL_ENGINEERING_SHEET">
                    1. Geological Mapping Sheet (Final Engineering Sheet)
                  </option>
                  <option value="ENGINEERING_QUANTITY_SHEET">
                    2. Overbreak &amp; Engineering Quantity Sheet
                  </option>
                  <option value="CLEAN_MAPPING_DRAWING">3. Clean Mapping Drawing</option>
                  <option value="PHOTO_AND_AI_TRACING">4. Photo + Vector Tracing</option>
                  <option value="VECTOR_MAPPING_ONLY">5. Vector Mapping Only</option>
                  <option value="CROWN_AND_WALL_VECTOR_ONLY">
                    6. Crown &amp; Wall Vector Only Sheet
                  </option>
                  <option value="EXPORT_PHOTO_ONLY">7. Main Photo Only</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-[10px] text-slate-300">Drawing Arena Arrangement</span>
                <select
                  value={config.arrangement}
                  onChange={(e) =>
                    onUpdateConfig((prev) => ({
                      ...prev,
                      arrangement: e.target.value as SheetLayoutArrangement,
                    }))
                  }
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                >
                  <option value="AUTO_INTELLIGENT">
                    Auto Fit (Prominent Tunnel Face + Developed Perimeter)
                  </option>
                  <option value="MAXIMIZE_FACE">
                    Maximize Tunnel Face Across Drawing Arena
                  </option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-[10px] text-slate-300">
                  Standardized Rock Mass Classification Method
                </span>
                <select
                  value={config.classificationOverride}
                  onChange={(e) =>
                    onUpdateConfig((prev) => ({
                      ...prev,
                      classificationOverride: e.target.value as
                        | 'KEEP_RECORD'
                        | RockMassClassificationMethodId,
                    }))
                  }
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                >
                  <option value="KEEP_RECORD">Keep Each Record&apos;s Saved Method</option>
                  <option value="Q_SYSTEM">Standardize All: Q-System (Barton NGI)</option>
                  <option value="RMR">Standardize All: RMR (Bieniawski)</option>
                  <option value="BOTH_RMR_AND_Q">
                    Standardize All: Both (RMR + Q-System)
                  </option>
                  <option value="GSI">Standardize All: GSI (Hoek &amp; Marinos)</option>
                </select>
              </label>
            </div>

            {/* Standardized Title Block & Quality Control Options */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded space-y-2.5">
              <div className="border-b border-slate-800 pb-1.5">
                <div className="font-semibold text-emerald-400 text-[11px]">
                  02. Title Block, Overlays &amp; Quality Control Rules
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.standardizeHeaderAndLogos}
                  onChange={(e) =>
                    onUpdateConfig((prev) => ({
                      ...prev,
                      standardizeHeaderAndLogos: e.target.checked,
                    }))
                  }
                  className="mt-0.5 rounded border-slate-700 bg-slate-950 text-cyan-500"
                />
                <div>
                  <div className="text-[11px] font-semibold text-slate-200">
                    Unify Project Title Block, Logos &amp; Signatories
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Applies current Project Name, Client/Contractor/Consultant logos, and block order across all queued sheets
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.confirmAllOrientations}
                  onChange={(e) =>
                    onUpdateConfig((prev) => ({
                      ...prev,
                      confirmAllOrientations: e.target.checked,
                    }))
                  }
                  className="mt-0.5 rounded border-slate-700 bg-slate-950 text-cyan-500"
                />
                <div>
                  <div className="text-[11px] font-semibold text-slate-200">
                    Auto-Confirm Estimated Orientations in Batch
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Marks estimated joint orientations as confirmed so all batch sheets pass QC validation cleanly
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.overlayOverbreakOnGeology}
                  onChange={(e) =>
                    onUpdateConfig((prev) => ({
                      ...prev,
                      overlayOverbreakOnGeology: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-700 bg-slate-950 text-rose-500"
                />
                <span className="text-[11px] text-slate-200">
                  Include Overbreak/Undercut Hatch Overlay on Geological Sheets
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.overlayJointsOnQuantity}
                  onChange={(e) =>
                    onUpdateConfig((prev) => ({
                      ...prev,
                      overlayJointsOnQuantity: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-700 bg-slate-950 text-cyan-500"
                />
                <span className="text-[11px] text-slate-200">
                  Include Geological Joint Traces on Quantity Sheets
                </span>
              </label>
            </div>

            {/* Automatic Per-Sheet File Download Triggers */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded space-y-2.5">
              <div className="border-b border-slate-800 pb-1.5">
                <div className="font-semibold text-amber-300 text-[11px]">
                  03. Auto-Download Individual Files During Run (Optional)
                </div>
                <div className="text-[10px] text-slate-400">
                  All formats are always captured in the Outputs tab &amp; Multi-Sheet Book. Enable below to also trigger individual browser downloads as each sheet processes:
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { key: 'svg', label: 'Vector Sheet (.SVG)' },
                    { key: 'png', label: 'High-Res Sheet (.PNG)' },
                    { key: 'dxf', label: 'AutoCAD Vector (.DXF)' },
                    { key: 'csv', label: 'Engineering Data (.CSV)' },
                  ] as const
                ).map((fmt) => (
                  <label
                    key={fmt.key}
                    className="flex items-center gap-2 p-2 rounded bg-slate-950 border border-slate-800 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={config.autoDownloadFormat[fmt.key]}
                      onChange={(e) =>
                        onUpdateConfig((prev) => ({
                          ...prev,
                          autoDownloadFormat: {
                            ...prev.autoDownloadFormat,
                            [fmt.key]: e.target.checked,
                          },
                        }))
                      }
                      className="rounded border-slate-700 bg-slate-900 text-emerald-500"
                    />
                    <span className="text-[11px] text-slate-200">{fmt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div className="space-y-3">
            {/* Master Batch Package Deliverables */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded space-y-2.5">
              <div className="border-b border-slate-800 pb-1.5">
                <div className="font-semibold text-emerald-400 text-[11px]">
                  01. Consolidated Batch Deliverables ({completedItems.length} Processed)
                </div>
                <div className="text-[10px] text-slate-400">
                  Export all processed records as a unified multi-sheet engineering package or master schedule
                </div>
              </div>

              {completedItems.length === 0 ? (
                <div className="py-4 text-center text-slate-400 space-y-1.5">
                  <div>No processed batch outputs yet.</div>
                  <div className="text-[10px] text-slate-500">
                    Queue your project records in Step 1 and click &ldquo;Run Sequence&rdquo; above.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={onPrintMultiSheetPdfBook}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded text-xs transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4 shrink-0" />
                    <span>
                      Print / Export Multi-Sheet PDF Book ({completedItems.length} A3 Sheets)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onDownloadMultiSheetHtmlBook}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded text-xs transition-colors cursor-pointer"
                  >
                    <FileCode className="w-4 h-4 shrink-0" />
                    <span>
                      Download Standalone Multi-Sheet Engineering Book (.HTML/SVG)
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={onDownloadConsolidatedCSV}
                      className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded font-semibold text-[11px] cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                      <span>Master Register (.CSV)</span>
                    </button>

                    <button
                      type="button"
                      onClick={onDownloadConsolidatedJSON}
                      className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded font-semibold text-[11px] cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span>Batch Package (.JSON)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Individual Processed Sheet Outputs */}
            {completedItems.length > 0 && (
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded space-y-2.5">
                <div className="border-b border-slate-800 pb-1.5">
                  <div className="font-semibold text-cyan-400 text-[11px]">
                    02. Per-Section Standardized Sheet Files
                  </div>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {completedItems.map((item) => {
                    const m = item.outputs!.summaryMetrics;
                    const isPreviewing = previewQueueId === item.queueId;
                    return (
                      <div
                        key={item.queueId}
                        className={`p-2.5 rounded border space-y-2 ${
                          isPreviewing
                            ? 'bg-cyan-950/40 border-cyan-500/70'
                            : 'bg-slate-950/90 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-slate-100 truncate">
                              #{String(m.sequenceNumber).padStart(2, '0')} · {m.tunnelName} ·{' '}
                              <span className="text-emerald-300">{m.faceChainage}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {m.jointCount} Traces ({m.jointSetCount} Sets) · Q={m.qValue} · RMR=
                              {m.rmrValue} · OB={m.overbreakAreaSqM.toFixed(2)}m² ({m.overbreakPct.toFixed(1)}%)
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              onSelectPreviewItem(isPreviewing ? null : item.queueId)
                            }
                            className={`px-2 py-1 rounded text-[10px] font-semibold shrink-0 cursor-pointer ${
                              isPreviewing
                                ? 'bg-cyan-600 text-white'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                            }`}
                          >
                            {isPreviewing ? 'Viewing' : 'Preview'}
                          </button>
                        </div>

                        <div className="grid grid-cols-4 gap-1">
                          <button
                            type="button"
                            onClick={() => onDownloadSingleOutput(item, 'svg')}
                            className="flex items-center justify-center gap-1 py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-semibold cursor-pointer"
                          >
                            <FileCode className="w-3 h-3" />
                            SVG
                          </button>
                          <button
                            type="button"
                            onClick={() => onDownloadSingleOutput(item, 'png')}
                            className="flex items-center justify-center gap-1 py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[10px] font-semibold cursor-pointer"
                          >
                            <ImageIcon className="w-3 h-3" />
                            PNG
                          </button>
                          <button
                            type="button"
                            onClick={() => onDownloadSingleOutput(item, 'dxf')}
                            className="flex items-center justify-center gap-1 py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-semibold cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            DXF
                          </button>
                          <button
                            type="button"
                            onClick={() => onDownloadSingleOutput(item, 'csv')}
                            className="flex items-center justify-center gap-1 py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 text-[10px] font-semibold cursor-pointer"
                          >
                            <FileSpreadsheet className="w-3 h-3" />
                            CSV
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
