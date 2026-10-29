import React, { useState, useMemo } from 'react';
import {
  Database,
  X,
  Plus,
  Download,
  Upload,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Pickaxe,
  Layers,
  FileSpreadsheet,
  RefreshCw,
  HardDrive,
  Sparkles,
} from 'lucide-react';
import {
  MiningProjectItem,
  MiningStopeItem,
  MiningDrillHoleRecord,
} from '../../types/mining';
import {
  loadMiningProjects,
  saveMiningProjects,
  createMiningProject,
  updateMiningProject,
  deleteMiningProject,
  loadMiningStopes,
  saveMiningStopes,
  createMiningStope,
  deleteMiningStope,
  loadMiningDrillHoles,
  saveMiningDrillHoles,
  createMiningDrillHole,
  deleteMiningDrillHole,
  getActiveMiningProjectId,
  setActiveMiningProjectId,
  getActiveMiningStopeId,
  setActiveMiningStopeId,
  getActiveMiningDrillHoleId,
  setActiveMiningDrillHoleId,
  exportMiningVaultToJson,
  importMiningVaultFromJson,
  seedInitialMiningData,
} from '../../engine/miningStorageEngine';

export interface MiningDataStorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

export const MiningDataStorageModal: React.FC<MiningDataStorageModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
}) => {
  const [activeTab, setActiveTab] = useState<'PROJECTS' | 'STOPES' | 'DRILLHOLES' | 'VAULT'>('PROJECTS');
  const [refreshKey, setRefreshKey] = useState(0);

  // New Project Form Modal
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newMineName, setNewMineName] = useState('');
  const [newCommodity, setNewCommodity] = useState<'Gold (Au)' | 'Copper (Cu)' | 'Silver (Ag)' | 'Zinc (Zn)'>('Gold (Au)');

  // New Stope Form
  const [showNewStopeModal, setShowNewStopeModal] = useState(false);
  const [newStopeDriftId, setNewStopeDriftId] = useState('');
  const [newMineLevel, setNewMineLevel] = useState('Level 620 mRL');
  const [newCutoffGrade, setNewCutoffGrade] = useState('2.50');

  // Notifications
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const projects = useMemo(() => loadMiningProjects(), [refreshKey, isOpen]);
  const stopes = useMemo(() => loadMiningStopes(), [refreshKey, isOpen]);
  const drillHoles = useMemo(() => loadMiningDrillHoles(), [refreshKey, isOpen]);

  const activeProjId = getActiveMiningProjectId() || projects[0]?.id;
  const activeStopeId = getActiveMiningStopeId() || stopes[0]?.id;
  const activeDrillHoleId = getActiveMiningDrillHoleId() || drillHoles[0]?.id;

  if (!isOpen) return null;

  // Handlers
  const handleSelectProject = (id: string) => {
    setActiveMiningProjectId(id);
    setRefreshKey((k) => k + 1);
    if (onDataChanged) onDataChanged();
    showNotification(`Active mining project changed`);
  };

  const handleSelectStope = (id: string) => {
    setActiveMiningStopeId(id);
    setRefreshKey((k) => k + 1);
    if (onDataChanged) onDataChanged();
    showNotification(`Active stope heading selected`);
  };

  const handleSelectDrillHole = (id: string) => {
    setActiveMiningDrillHoleId(id);
    setRefreshKey((k) => k + 1);
    if (onDataChanged) onDataChanged();
    showNotification(`Active exploration core hole selected`);
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const created = createMiningProject({
      projectName: newProjectName.trim(),
      mineName: newMineName.trim() || newProjectName.trim(),
      primaryCommodity: newCommodity as any,
    });
    setShowNewProjectModal(false);
    setNewProjectName('');
    setNewMineName('');
    setRefreshKey((k) => k + 1);
    if (onDataChanged) onDataChanged();
    showNotification(`Created project "${created.projectName}"`);
  };

  const handleCreateStope = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStopeDriftId.trim()) return;
    const created = createMiningStope({
      stopeOrDriftId: newStopeDriftId.trim(),
      mineLevel: newMineLevel.trim(),
      targetCutoffGrade: parseFloat(newCutoffGrade) || 2.50,
      projectId: activeProjId,
    });
    setShowNewStopeModal(false);
    setNewStopeDriftId('');
    setRefreshKey((k) => k + 1);
    if (onDataChanged) onDataChanged();
    showNotification(`Created heading "${created.stopeOrDriftId}"`);
  };

  const handleDeleteProject = (id: string) => {
    if (projects.length <= 1) {
      showNotification('Cannot delete the only project in the vault.', 'error');
      return;
    }
    if (window.confirm('Delete this mining project and associated stopes?')) {
      deleteMiningProject(id);
      setRefreshKey((k) => k + 1);
      if (onDataChanged) onDataChanged();
      showNotification('Project deleted');
    }
  };

  const handleDeleteStope = (id: string) => {
    if (stopes.length <= 1) {
      showNotification('Cannot delete the only stope heading.', 'error');
      return;
    }
    deleteMiningStope(id);
    setRefreshKey((k) => k + 1);
    if (onDataChanged) onDataChanged();
    showNotification('Stope heading deleted');
  };

  const handleDeleteDrillHole = (id: string) => {
    if (drillHoles.length <= 1) {
      showNotification('Cannot delete the only drill hole.', 'error');
      return;
    }
    deleteMiningDrillHole(id);
    setRefreshKey((k) => k + 1);
    if (onDataChanged) onDataChanged();
    showNotification('Drill hole deleted');
  };

  const handleExportJson = () => {
    const jsonStr = exportMiningVaultToJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ESWA_MINING_VAULT_BACKUP_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Mining vault backup downloaded');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importMiningVaultFromJson(content);
      if (res.success) {
        setRefreshKey((k) => k + 1);
        if (onDataChanged) onDataChanged();
        showNotification(res.message);
      } else {
        showNotification(res.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleResetToDefault = () => {
    if (window.confirm('Reset Mining vault to default Kolar Deep Gold-Copper demo dataset? Current data will be replaced.')) {
      seedInitialMiningData();
      setRefreshKey((k) => k + 1);
      if (onDataChanged) onDataChanged();
      showNotification('Mining vault reset to default benchmark data');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 select-none font-sans text-slate-100">
      <div className="bg-slate-900 border border-amber-500/50 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-amber-300 font-mono flex items-center gap-2">
                <span>MINING DATA &amp; STORAGE VAULT</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700">
                  ISOLATED VAULT
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Independent storage isolated from NATM and TBM · {stopes.length} Stopes/Drives · {drillHoles.length} Core Holes · {projects.length} Projects
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

        {/* Floating Notification */}
        {notification && (
          <div className={`px-4 py-2 text-xs font-mono font-bold flex items-center gap-2 border-b animate-fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
              : 'bg-rose-950 border-rose-500 text-rose-300'
          }`}>
            <CheckCircle2 className="w-4 h-4" />
            <span>{notification.text}</span>
          </div>
        )}

        {/* 4 Tabs Selector */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-950/70 border-b border-slate-800 text-xs font-mono font-bold">
          {[
            { id: 'PROJECTS' as const, label: `Projects (${projects.length})`, icon: FolderOpen },
            { id: 'STOPES' as const, label: `Stopes & Headings (${stopes.length})`, icon: Pickaxe },
            { id: 'DRILLHOLES' as const, label: `Core Holes (${drillHoles.length})`, icon: Layers },
            { id: 'VAULT' as const, label: 'Vault & Backups', icon: HardDrive },
          ].map((tab) => {
            const Icon = tab.icon;
            const isAct = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  isAct
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 font-mono text-xs space-y-4">
          {/* TAB 1: PROJECTS */}
          {activeTab === 'PROJECTS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-200">Mining Projects Repository</h3>
                  <p className="text-slate-400 text-xs">Switch active project or initialize new mine sites</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Project</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {projects.map((p) => {
                  const isAct = p.id === activeProjId;
                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isAct
                          ? 'bg-slate-850 border-amber-500 shadow-lg ring-1 ring-amber-400/50'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-amber-300">{p.projectName}</h4>
                            {isAct && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p className="text-slate-400 text-xs mt-0.5">{p.mineName} · {p.mineSiteLocation}</p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteProject(p.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800"
                            title="Delete project"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-300">
                        <div>Commodity: <strong className="text-cyan-300">{p.primaryCommodity}</strong></div>
                        <div>Method: <strong>{p.activeMiningMethod.replace(/_/g, ' ')}</strong></div>
                        <div>Geologist: <strong>{p.responsibleGeologist}</strong></div>
                        <div>Datum: <strong>{p.mineDatumLevelMrl} mRL</strong></div>
                      </div>

                      {!isAct && (
                        <button
                          type="button"
                          onClick={() => handleSelectProject(p.id)}
                          className="mt-3 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold cursor-pointer text-center"
                        >
                          Switch to this Project
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: STOPES & UNDERGROUND HEADINGS */}
          {activeTab === 'STOPES' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-200">Underground Stopes &amp; Drift Headings</h3>
                  <p className="text-slate-400 text-xs">Drive faces, veins, and channel sample lines</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewStopeModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Stope / Drive</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase">
                    <tr>
                      <th className="p-2.5">Stope / Drive ID</th>
                      <th className="p-2.5">Mine Level</th>
                      <th className="p-2.5">Current Heading RD</th>
                      <th className="p-2.5">Veins</th>
                      <th className="p-2.5">Cut-off Grade</th>
                      <th className="p-2.5">Diluted Grade</th>
                      <th className="p-2.5">Dispatch</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {stopes.map((s) => {
                      const isAct = s.id === activeStopeId;
                      return (
                        <tr key={s.id} className={isAct ? 'bg-amber-950/20' : 'hover:bg-slate-800/40'}>
                          <td className="p-2.5 font-bold text-amber-300">
                            {s.stopeOrDriftId}
                            {isAct && <span className="ml-1 text-[10px] text-amber-400 font-bold">[ACTIVE]</span>}
                          </td>
                          <td className="p-2.5">{s.mineLevel}</td>
                          <td className="p-2.5">{s.currentHeadingRdChainage}</td>
                          <td className="p-2.5 text-cyan-300 font-bold">{s.veins?.length || 0} veins</td>
                          <td className="p-2.5">{s.targetCutoffGrade.toFixed(2)} g/t</td>
                          <td className="p-2.5 font-bold text-emerald-400">{s.dilutedGradeCalculated?.toFixed(2) || '4.85'} g/t</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                              {s.muckDestinationVerdict || 'MILL'}
                            </span>
                          </td>
                          <td className="p-2.5 text-right space-x-1">
                            {!isAct && (
                              <button
                                type="button"
                                onClick={() => handleSelectStope(s.id)}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-bold"
                              >
                                Select
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteStope(s.id)}
                              className="p-1 rounded text-slate-500 hover:text-rose-400"
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

          {/* TAB 3: DRILL HOLES */}
          {activeTab === 'DRILLHOLES' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-200">Exploration &amp; Production Core Drill Holes</h3>
                  <p className="text-slate-400 text-xs">Diamond core runs, assays, RQD, and significant intercepts</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    createMiningDrillHole({
                      holeId: `DDH-KD-${String(drillHoles.length + 43).padStart(3, '0')}`,
                    });
                    setRefreshKey((k) => k + 1);
                    if (onDataChanged) onDataChanged();
                    showNotification('New diamond core drill hole initialized');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Drill Hole</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase">
                    <tr>
                      <th className="p-2.5">Hole ID</th>
                      <th className="p-2.5">Type &amp; Size</th>
                      <th className="p-2.5">Dip / Azimuth</th>
                      <th className="p-2.5">Total Depth</th>
                      <th className="p-2.5">Recovery %</th>
                      <th className="p-2.5">RQD %</th>
                      <th className="p-2.5">Significant Ore Intercept</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {drillHoles.map((h) => {
                      const isAct = h.id === activeDrillHoleId;
                      return (
                        <tr key={h.id} className={isAct ? 'bg-amber-950/20' : 'hover:bg-slate-800/40'}>
                          <td className="p-2.5 font-bold text-cyan-300">
                            {h.holeId}
                            {isAct && <span className="ml-1 text-[10px] text-amber-400 font-bold">[ACTIVE]</span>}
                          </td>
                          <td className="p-2.5">{h.holeType === 'DIAMOND_CORE_DDH' ? 'Diamond Core' : 'RC'} ({h.coreDiameter})</td>
                          <td className="p-2.5">{h.collarDipDeg}° / {h.collarAzimuthDeg}°</td>
                          <td className="p-2.5 font-bold text-slate-100">{h.totalDrilledDepthM.toFixed(1)} m</td>
                          <td className="p-2.5 text-emerald-400">{h.overallRecoveryPercent.toFixed(1)}%</td>
                          <td className="p-2.5 text-cyan-300">{h.overallRqdPercent.toFixed(1)}%</td>
                          <td className="p-2.5 text-amber-300 font-bold">{h.significantInterceptsSummary}</td>
                          <td className="p-2.5 text-right space-x-1">
                            {!isAct && (
                              <button
                                type="button"
                                onClick={() => handleSelectDrillHole(h.id)}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold"
                              >
                                Select
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteDrillHole(h.id)}
                              className="p-1 rounded text-slate-500 hover:text-rose-400"
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

          {/* TAB 4: VAULT & BACKUPS */}
          {activeTab === 'VAULT' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h3 className="font-bold text-sm text-amber-300 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-amber-400" />
                  <span>Isolated Mining Vault Operations</span>
                </h3>
                <p className="text-slate-400 text-xs">
                  This vault (<code>eswa_strict_vault_MINING</code>) is 100% strictly isolated from NATM civil tunneling and TBM shield vaults. All stope surveys, channel assay lines, and drill hole runs remain private to the mining package.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer shadow"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Vault Backup (JSON)</span>
                  </button>

                  <label className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold cursor-pointer">
                    <Upload className="w-4 h-4 text-cyan-400" />
                    <span>Restore from Backup (JSON)</span>
                    <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
                  </label>

                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>Active Project: <strong className="text-amber-300">{projects.find((p) => p.id === activeProjId)?.projectName}</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
          >
            Close Vault
          </button>
        </div>
      </div>

      {/* CREATE NEW PROJECT MODAL */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <form onSubmit={handleCreateProject} className="bg-slate-900 border border-amber-500 rounded-2xl p-5 max-w-md w-full space-y-4 font-mono text-xs">
            <h3 className="font-bold text-sm text-amber-300">Create New Mining Project</h3>
            <div className="space-y-2">
              <label className="block">
                <span className="text-slate-400">Project Name *</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hutti Underground Gold Extension"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                />
              </label>
              <label className="block">
                <span className="text-slate-400">Mine Site Name</span>
                <input
                  type="text"
                  placeholder="e.g. Hutti North Lode Complex"
                  value={newMineName}
                  onChange={(e) => setNewMineName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                />
              </label>
              <label className="block">
                <span className="text-slate-400">Primary Commodity</span>
                <select
                  value={newCommodity}
                  onChange={(e) => setNewCommodity(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-amber-300"
                >
                  <option value="Gold (Au)">Gold (Au)</option>
                  <option value="Copper (Cu)">Copper (Cu)</option>
                  <option value="Silver (Ag)">Silver (Ag)</option>
                  <option value="Zinc (Zn)">Zinc (Zn)</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewProjectModal(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold"
              >
                Create Project
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CREATE NEW STOPE MODAL */}
      {showNewStopeModal && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <form onSubmit={handleCreateStope} className="bg-slate-900 border border-amber-500 rounded-2xl p-5 max-w-md w-full space-y-4 font-mono text-xs">
            <h3 className="font-bold text-sm text-amber-300">Create Underground Stope / Drift</h3>
            <div className="space-y-2">
              <label className="block">
                <span className="text-slate-400">Stope / Heading ID *</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. HW-DRV-05"
                  value={newStopeDriftId}
                  onChange={(e) => setNewStopeDriftId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                />
              </label>
              <label className="block">
                <span className="text-slate-400">Mine Level (Elevation)</span>
                <input
                  type="text"
                  placeholder="e.g. Level 620 mRL"
                  value={newMineLevel}
                  onChange={(e) => setNewMineLevel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100"
                />
              </label>
              <label className="block">
                <span className="text-slate-400">Mine Cut-Off Grade (g/t)</span>
                <input
                  type="number"
                  step="0.1"
                  value={newCutoffGrade}
                  onChange={(e) => setNewCutoffGrade(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-amber-300"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewStopeModal(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold"
              >
                Create Stope
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
