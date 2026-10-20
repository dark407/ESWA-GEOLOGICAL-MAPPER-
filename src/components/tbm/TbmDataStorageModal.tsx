// ============================================================================
// ESWA TBM MECHANIZED TUNNELING — ISOLATED DATA STORAGE & IMPORT/EXPORT MODAL
// Strictly isolated from NATM and Mining vaults
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  X,
  Database,
  Download,
  Upload,
  FolderOpen,
  Trash2,
  FileSpreadsheet,
  FileJson,
  FileCode,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  Layers,
} from 'lucide-react';
import {
  TbmProjectItem,
  TbmLocationItem,
  TbmExcavationRecord,
} from '../../types/tbm';
import {
  loadTbmProjects,
  loadTbmLocations,
  loadTbmExcavationRecords,
  saveTbmProjects,
  saveTbmLocations,
  saveTbmExcavationRecords,
  deleteTbmProject,
  deleteTbmExcavationRecord,
  seedInitialTbmData,
  setActiveTbmProjectId,
  setActiveTbmLocationId,
  setActiveTbmRecordId,
} from '../../engine/tbmStorageEngine';

interface TbmDataStorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadProject: (projectId: string) => void;
  onLoadLocation: (locationId: string) => void;
  onLoadRecord: (recordId: string) => void;
}

export const TbmDataStorageModal: React.FC<TbmDataStorageModalProps> = ({
  isOpen,
  onClose,
  onLoadProject,
  onLoadLocation,
  onLoadRecord,
}) => {
  const [activeTab, setActiveTab] = useState<'records' | 'projects' | 'export_import'>('records');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const projects = useMemo(() => loadTbmProjects(), [isOpen, statusMsg]);
  const locations = useMemo(() => loadTbmLocations(), [isOpen, statusMsg]);
  const records = useMemo(() => loadTbmExcavationRecords(), [isOpen, statusMsg]);

  if (!isOpen) return null;

  const filteredRecords = records.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.chainageRecord.ringNumber.toString().includes(q) ||
      r.chainageRecord.startChainage.toString().includes(q) ||
      r.chainageRecord.endChainage.toString().includes(q) ||
      r.geology.mainLithology.toLowerCase().includes(q) ||
      r.chainageRecord.shift.toLowerCase().includes(q)
    );
  });

  // Export full TBM Project JSON
  const handleExportFullJson = () => {
    const backup = {
      format: 'ESWA_TBM_BACKUP_V1',
      exportedAt: new Date().toISOString(),
      projects,
      locations,
      records,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ESWA_TBM_Project_Backup_${new Date().toISOString().slice(0, 10)}.tbm.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg({ text: 'Full TBM Project JSON backup exported successfully.', type: 'success' });
  };

  // Export CSV of Excavation Records
  const handleExportRecordsCsv = () => {
    const headers = [
      'RecordID',
      'RingNumber',
      'StartChainageRD',
      'EndChainageRD',
      'AdvanceMeters',
      'Shift',
      'Timestamp',
      'Lithology',
      'BartonQ',
      'QClass',
      'RMR89',
      'RMRClass',
      'Thrust_kN',
      'Torque_kNm',
      'FPI_kNCutterMm',
      'SpecificEnergy_MJM3',
      'Inflow_LMin',
      'GroutVolume_M3',
      'SurfaceSettlement_mm',
    ];

    const rows = records.map((r) => [
      r.id,
      r.chainageRecord.ringNumber,
      r.chainageRecord.startChainage.toFixed(2),
      r.chainageRecord.endChainage.toFixed(2),
      r.chainageRecord.advanceLengthMeters.toFixed(2),
      r.chainageRecord.shift,
      r.chainageRecord.timestamp,
      `"${r.geology.mainLithology.replace(/"/g, '""')}"`,
      r.classification.calculatedQ.toFixed(2),
      `"${r.classification.qClassLabel}"`,
      r.classification.calculatedRmr,
      `"${r.classification.rmrClassLabel}"`,
      r.telemetry.thrustForceKn,
      r.telemetry.cutterheadTorqueKnm,
      r.classification.fieldPenetrationIndexKnCutterMm ?? 0,
      r.classification.specificEnergyMJM3 ?? 0,
      r.groundwater.inflowRateLitersPerMin,
      r.supportLining.annularGroutVolumeActualM3,
      r.instrumentation?.surfaceSettlementMeasuredMm ?? 0,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TBM_Excavation_Records_RD_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg({ text: 'Excavation & Geotechnical CSV exported successfully.', type: 'success' });
  };

  // Import JSON backup
  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.projects && parsed.locations && parsed.records) {
          saveTbmProjects(parsed.projects);
          saveTbmLocations(parsed.locations);
          saveTbmExcavationRecords(parsed.records);
          setStatusMsg({
            text: `Imported ${parsed.projects.length} projects, ${parsed.locations.length} locations, and ${parsed.records.length} ring records!`,
            type: 'success',
          });
        } else {
          setStatusMsg({ text: 'Invalid backup format. Missing projects/locations/records keys.', type: 'error' });
        }
      } catch (err: any) {
        setStatusMsg({ text: `Failed to import JSON: ${err?.message}`, type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Factory reset to seed data
  const handleFactoryReset = () => {
    seedInitialTbmData();
    setConfirmResetOpen(false);
    setStatusMsg({ text: 'Reset TBM storage to initial site dataset (Metro Line 3 Basalt drive).', type: 'success' });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none font-sans">
      <div className="bg-slate-900 border border-cyan-500/50 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cyan-500/20 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-cyan-300 font-mono flex items-center gap-2">
                <span>TBM ISOLATED DATA VAULT &amp; EXPORT CENTER</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-600 text-cyan-400 font-bold">
                  TBM MODE ONLY
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Independent storage isolated from NATM and Mining vaults · {records.length} Ring Records · {projects.length} Projects
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('records')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'records'
                ? 'bg-cyan-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Excavation &amp; Ring Records ({records.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('projects')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'projects'
                ? 'bg-cyan-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Saved Projects ({projects.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export_import')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'export_import'
                ? 'bg-cyan-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Import / Export &amp; Backup</span>
          </button>
        </div>

        {/* Status notification */}
        {statusMsg && (
          <div
            className={`px-5 py-2 text-xs font-mono flex items-center justify-between ${
              statusMsg.type === 'success'
                ? 'bg-emerald-950/80 text-emerald-300 border-b border-emerald-800'
                : 'bg-rose-950/80 text-rose-300 border-b border-rose-800'
            }`}
          >
            <span>{statusMsg.text}</span>
            <button
              type="button"
              onClick={() => setStatusMsg(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Body Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 font-mono text-xs">
          {/* TAB 1: EXCAVATION & RING RECORDS */}
          {activeTab === 'records' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by Ring #, RD Chainage, Lithology, or Shift..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleExportRecordsCsv}
                  className="px-3 py-2 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500 text-cyan-300 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>

              {filteredRecords.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                  No TBM excavation records found matching &quot;{searchQuery}&quot;.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">Ring #</th>
                        <th className="p-2.5">Chainage (RD)</th>
                        <th className="p-2.5">Advance</th>
                        <th className="p-2.5">Shift</th>
                        <th className="p-2.5">Lithology</th>
                        <th className="p-2.5">Q / RMR</th>
                        <th className="p-2.5">FPI</th>
                        <th className="p-2.5">Grout</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {filteredRecords.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-2.5 font-bold text-cyan-300">#{r.chainageRecord.ringNumber}</td>
                          <td className="p-2.5 text-slate-200">
                            RD {r.chainageRecord.startChainage.toFixed(2)}m → {r.chainageRecord.endChainage.toFixed(2)}m
                          </td>
                          <td className="p-2.5">{r.chainageRecord.advanceLengthMeters.toFixed(2)}m</td>
                          <td className="p-2.5">{r.chainageRecord.shift}</td>
                          <td className="p-2.5 text-amber-300 font-medium truncate max-w-[140px]">
                            {r.geology.mainLithology}
                          </td>
                          <td className="p-2.5">
                            Q {r.classification.calculatedQ.toFixed(1)} · RMR {r.classification.calculatedRmr}
                          </td>
                          <td className="p-2.5 text-emerald-400 font-bold">
                            {r.classification.fieldPenetrationIndexKnCutterMm?.toFixed(1) || '—'}
                          </td>
                          <td className="p-2.5">
                            {r.supportLining.annularGroutVolumeActualM3.toFixed(2)}m³
                          </td>
                          <td className="p-2.5 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                onLoadRecord(r.id);
                                onClose();
                              }}
                              className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-[11px] font-bold cursor-pointer"
                            >
                              Load Ring
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                deleteTbmExcavationRecord(r.id);
                                setStatusMsg({ text: `Deleted ring record #${r.chainageRecord.ringNumber}`, type: 'success' });
                              }}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 cursor-pointer"
                              title="Delete record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SAVED PROJECTS */}
          {activeTab === 'projects' && (
            <div className="space-y-3">
              {projects.map((p) => {
                const projLocs = locations.filter((l) => l.projectId === p.id);
                const projRecs = records.filter((r) => r.projectId === p.id);
                return (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/40 transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-cyan-300">{p.projectName}</h4>
                        <p className="text-slate-400 text-xs">
                          {p.tunnelName} · {p.client || 'Client N/A'} · {p.contractor || 'Contractor N/A'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onLoadProject(p.id);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 cursor-pointer"
                        >
                          Open Project
                        </button>
                        {projects.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              deleteTbmProject(p.id);
                              setStatusMsg({ text: `Deleted project ${p.projectName}`, type: 'success' });
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                            title="Delete project"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                      <div>
                        <span className="text-slate-600">Alignment:</span> {p.tunnelAlignment}
                      </div>
                      <div>
                        <span className="text-slate-600">Locations:</span> {projLocs.length} defined
                      </div>
                      <div>
                        <span className="text-slate-600">Ring Records:</span> {projRecs.length} logged
                      </div>
                      <div>
                        <span className="text-slate-600">Geologist:</span> {p.responsibleGeologist}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: IMPORT / EXPORT & BACKUP */}
          {activeTab === 'export_import' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Export Panel */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Download className="w-4 h-4 text-cyan-400" />
                  <h4 className="font-bold text-slate-200">TBM Project Data Export</h4>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Export complete TBM project database or filtered excavation records for external geotechnical analysis.
                </p>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={handleExportFullJson}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-cyan-500/30 hover:border-cyan-500 text-cyan-300 font-bold cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FileJson className="w-4 h-4 text-cyan-400" />
                      <span>Full Project JSON Backup (.tbm.json)</span>
                    </span>
                    <span className="text-[10px] text-slate-400">All data &amp; telemetry</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportRecordsCsv}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-200 font-bold cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span>Excavation &amp; Geotech CSV Table</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Excel compatible</span>
                  </button>
                </div>
              </div>

              {/* Import Panel */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Upload className="w-4 h-4 text-amber-400" />
                  <h4 className="font-bold text-slate-200">Import &amp; Restore</h4>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Restore a previously saved .tbm.json file from another PC, field tablet, or team member.
                </p>

                <label className="flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed border-slate-700 hover:border-cyan-500 bg-slate-900/50 cursor-pointer transition-colors">
                  <Upload className="w-6 h-6 text-cyan-400 mb-1" />
                  <span className="font-bold text-slate-200">Select .tbm.json File to Import</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Click or drag file here</span>
                  <input
                    type="file"
                    accept=".json,.tbm.json"
                    onChange={handleImportJsonFile}
                    className="hidden"
                  />
                </label>

                {/* Reset to Seed Data */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Need sample site data?</span>
                  <button
                    type="button"
                    onClick={() => setConfirmResetOpen(true)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold cursor-pointer"
                  >
                    Restore Demo Project Data
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Factory Reset Modal Confirmation */}
        {confirmResetOpen && (
          <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-slate-950 border border-amber-500 rounded-xl p-5 max-w-sm w-full space-y-3 font-mono text-xs shadow-2xl">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <AlertTriangle className="w-5 h-5" />
                <span>Confirm Demo Data Reset</span>
              </div>
              <p className="text-slate-300">
                This will reset the isolated TBM storage to the official Metro Line 3 Basalt excavation dataset (8 sample rings with complete geotechnical logs).
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmResetOpen(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFactoryReset}
                  className="px-3 py-1.5 rounded bg-amber-500 text-slate-950 font-bold hover:bg-amber-400"
                >
                  Yes, Reset Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>ESWA TBM Isolated Storage System v2.0</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
